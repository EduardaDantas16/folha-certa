/* ia.js — chamada direta à Claude API (Anthropic) a partir do navegador.
 * A chave fica só no aparelho (Configurações). Funciona quando o app está
 * hospedado em http/https (GitHub Pages) — não funciona abrindo como arquivo
 * nem dentro do preview do Claude (CSP bloqueia).
 */
const IA = (function () {
  const ENDPOINT = 'https://api.anthropic.com/v1/messages';
  const VERSION = '2023-06-01';

  async function chamar(cfg, system, userContent, maxTokens) {
    if (!cfg || !cfg.apiKey) throw new Error('Configure a chave da API da Anthropic em Configurações (menu ☰).');
    const body = {
      model: (cfg && cfg.iaModel) || 'claude-opus-4-8',
      max_tokens: maxTokens || 12000,
      system: system,
      messages: [{ role: 'user', content: userContent }],
    };
    let res;
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': cfg.apiKey,
          'anthropic-version': VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error('Falha de rede ao chamar a IA. Abra o app pelo site (https), não como arquivo.');
    }
    if (!res.ok) {
      let msg = 'Erro ' + res.status;
      try { const j = await res.json(); if (j && j.error && j.error.message) msg = j.error.message; } catch (e) {}
      if (res.status === 401) msg = 'Chave da API inválida. Confira em Configurações.';
      throw new Error(msg);
    }
    const data = await res.json();
    return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  }

  function extrairJSON(texto) {
    let t = (texto || '').trim();
    const cerca = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (cerca) t = cerca[1].trim();
    const ini = t.indexOf('{'), fim = t.lastIndexOf('}');
    if (ini >= 0 && fim > ini) t = t.slice(ini, fim + 1);
    return JSON.parse(t);
  }

  function doc(base64) {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } };
  }

  /* ---- Absorver convenção (CCT/ACT) ---- */
  async function absorverConvencao(base64pdf, cfg) {
    const system =
      'Você é um analista trabalhista brasileiro. Leia o PDF da convenção coletiva (CCT/ACT), inclusive ' +
      'quando for escaneado, e extraia as regras num JSON. Responda APENAS com o JSON, sem texto antes ou ' +
      'depois e sem cercas de código.\n\n' +
      'Formato exato:\n' +
      '{\n' +
      '  "sindicato": {"nome": string, "cnpj": string (só dígitos), "categoria": string},\n' +
      '  "convencao": {\n' +
      '    "titulo": string, "numeroRegistro": string (registro no MTE), "abrangencia": string,\n' +
      '    "uf": string (2 letras), "dataBaseMes": um de [Janeiro..Dezembro],\n' +
      '    "vigenciaInicio": "AAAA-MM-DD", "vigenciaFim": "AAAA-MM-DD",\n' +
      '    "regras": {\n' +
      '      "pisos": [{"funcao": string, "valor": number, "jornada": string}],\n' +
      '      "reajuste": {"percentual": number|null, "aPartirDe": "AAAA-MM-DD"|""},\n' +
      '      "tempoServico": {"aplica": boolean, "tipo": "anuenio"|"bienio"|"trienio"|"quinquenio", "percentual": number|null, "base": "salario_base", "teto": number|null, "condicoes": string},\n' +
      '      "produtividade": {"aplica": boolean, "tipo": "percentual"|"valor_fixo", "valor": number|null, "condicoes": string},\n' +
      '      "adiantamento": {"obrigatorio": boolean, "percentual": number|null, "diaLimite": number|null},\n' +
      '      "adicionais": {"horaExtra": number, "horaExtra100": number, "noturno": number, "insalubridade": string, "periculosidade": string},\n' +
      '      "estabilidades": [{"tipo": "gestante"|"pre_aposentadoria"|"acidente"|"retorno_afastamento"|"membro_cipa"|"servico_militar", "descricao": string, "duracaoMeses": number|null}],\n' +
      '      "beneficios": [{"tipo": "vale_alimentacao"|"vale_refeicao"|"vale_transporte"|"cesta_basica"|"plano_saude"|"plano_odontologico"|"seguro_vida"|"auxilio_assistencial"|"auxilio_creche"|"auxilio_alimentacao_local", "valor": number|null, "condicoes": string}],\n' +
      '      "contribuicoes": [{"tipo": "assistencial"|"confederativa"|"mensalidade"|"negocial", "base": string, "percentual": number|null, "valor": number|null, "desconto": "empregado"|"empresa", "obs": string}],\n' +
      '      "observacoes": string\n' +
      '    }\n' +
      '  }\n' +
      '}\n\n' +
      'Regras: valores em número (ponto decimal), percentuais em número (ex.: 1.5 para 1,5%). Se a convenção NÃO ' +
      'prevê triênio/tempo de serviço, use "aplica": false; idem produtividade e adiantamento (obrigatorio false). ' +
      'Em "observacoes" liste os pontos importantes para a conferência da folha (quebra de caixa, reflexos, ' +
      'estabilidades extras, multas). Não invente valores: se não achar, use null ou "".';
    const content = [doc(base64pdf), { type: 'text', text: 'Absorva as regras desta convenção no JSON pedido.' }];
    return extrairJSON(await chamar(cfg, system, content, 16000));
  }

  /* ---- Absorver folha de pagamento ---- */
  async function absorverFolha(base64pdf, cfg) {
    const system =
      'Você é um analista de departamento pessoal brasileiro. Leia o PDF da folha/extrato de pagamento e ' +
      'extraia os dados num JSON. Responda APENAS com o JSON, sem texto antes/depois e sem cercas.\n\n' +
      'Formato exato:\n' +
      '{\n' +
      '  "empresaNome": string, "empresaCnpj": string (só dígitos), "competencia": "MM/AAAA",\n' +
      '  "regime": "simples"|"normal" (use "simples" se INSS empresa/RAT/terceiros forem 0),\n' +
      '  "totais": {"proventos": number, "descontos": number, "liquido": number, "baseFGTS": number, "valorFGTS": number, "inssSegurados": number, "inssEmpresa": number},\n' +
      '  "funcionarios": [{\n' +
      '    "matricula": string, "nome": string, "cpf": string, "cargo": string, "cbo": string,\n' +
      '    "admissao": "AAAA-MM-DD", "situacao": string, "vinculo": string, "salario": number, "horasMes": number,\n' +
      '    "rubricas": [{"cod": string, "descricao": string, "referencia": number, "valor": number, "tipo": "P"|"D"|"I"}],\n' +
      '    "proventos": number, "descontos": number, "liquido": number, "baseINSS": number, "baseFGTS": number, "valorFGTS": number\n' +
      '  }]\n' +
      '}\n\n' +
      'tipo da rubrica: "P" provento, "D" desconto, "I" informativa. Valores em número (ponto decimal).\n' +
      '"vinculo": tipo de vínculo do trabalhador. Use "pro-labore" se for sócio/diretor/titular com retirada de pró-labore ' +
      '(indícios: rubrica "PRÓ-LABORE", cargo "SÓCIO"/"DIRETOR"/"TITULAR", contribuinte individual, ausência de FGTS/INSS de empregado); ' +
      'senão use "clt" (ou o que o documento indicar, ex.: "estagiario", "aprendiz"). "horasMes": horas mensais CONTRATADAS (220 para 44h; menor se jornada reduzida/parcial).\n' +
      'Transcreva TODOS os funcionários e TODAS as rubricas exatamente como no documento. Não invente dados.';
    const content = [doc(base64pdf), { type: 'text', text: 'Extraia a folha no JSON pedido.' }];
    return extrairJSON(await chamar(cfg, system, content, 24000));
  }

  /* ---- Tirar dúvida sobre a convenção (texto livre, com PDF) ---- */
  async function perguntarConvencao(base64pdf, pergunta, cfg) {
    const system = 'Você é um especialista em convenções coletivas de trabalho no Brasil. Responda à pergunta ' +
      'com base APENAS no PDF da convenção anexado, citando a cláusula quando possível. Seja objetivo e em português.';
    const content = [doc(base64pdf), { type: 'text', text: pergunta }];
    return (await chamar(cfg, system, content, 4000)).trim();
  }

  /* ---- Tirar dúvida com base nas REGRAS já cadastradas (não precisa do PDF) ---- */
  async function perguntarRegras(conv, pergunta, cfg) {
    const ctx = {
      titulo: conv.titulo, abrangencia: conv.abrangencia, uf: conv.uf,
      dataBaseMes: conv.dataBaseMes, vigenciaInicio: conv.vigenciaInicio, vigenciaFim: conv.vigenciaFim,
      regras: conv.regras || {},
    };
    const system =
      'Você é um especialista em convenções coletivas de trabalho no Brasil, ajudando um contador na conferência de folha. ' +
      'Responda à pergunta usando SOMENTE os dados da convenção fornecidos em JSON (pisos, tempo de serviço/triênio, ' +
      'adicionais, estabilidades, benefícios, contribuições e observações). Cite o valor ou percentual exato quando houver e ' +
      'faça as contas se a pergunta pedir (ex.: quantos triênios, valor do adicional). Se a convenção não trata do ponto, diga ' +
      'isso com clareza e, quando couber, lembre que vale a regra geral da CLT. Seja objetivo, em português, sem inventar valores.';
    const content = [{ type: 'text', text: 'CONVENÇÃO (dados cadastrados):\n' + JSON.stringify(ctx, null, 1) + '\n\nPERGUNTA:\n' + pergunta }];
    return (await chamar(cfg, system, content, 1500)).trim();
  }

  return { absorverConvencao, absorverFolha, perguntarConvencao, perguntarRegras, extrairJSON };
})();
