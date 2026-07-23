/* audit.js — motor de conferência da folha contra as regras da convenção.
 *
 * Entra: uma folha (estruturada) + a(s) convenção(ões) vinculada(s) + config.
 * Sai:   { erros[], alertas[], conformes[], resumo{} }
 *
 * Cada achado é agregado por título (funcionários idênticos viram uma linha só,
 * com a lista de nomes), pra o relatório não ficar repetitivo.
 */
const Audit = (function () {

  const norm = s => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const money = n => Number(n || 0);
  const round2 = n => Math.round(n * 100) / 100;

  // acha a rubrica do funcionário por palavras-chave (na descrição)
  function acharRubrica(func, regex, tipo) {
    return (func.rubricas || []).find(r => regex.test(norm(r.descricao)) && (!tipo || r.tipo === tipo));
  }
  function pisoAplicavel(regras, cargo) {
    const pisos = (regras && regras.pisos) || [];
    if (!pisos.length) return null;
    if (pisos.length === 1) return pisos[0];
    const c = norm(cargo);
    return pisos.find(p => c && norm(p.funcao) && (c.includes(norm(p.funcao)) || norm(p.funcao).includes(c))) || null;
  }
  function contribAssistencial(regras) {
    return ((regras && regras.contribuicoes) || []).find(x => /assistenc/.test(norm(x.tipo)) && (x.percentual || x.cronograma));
  }
  // período (em anos) e nome do adicional por tempo de serviço, conforme o tipo da CCT
  function tempoServicoInfo(ts) {
    const t = norm(ts && ts.tipo);
    if (/anuenio|anu.nio/.test(t)) return { anos: 1, nome: 'Anuênio' };
    if (/bienio|bi.nio/.test(t)) return { anos: 2, nome: 'Biênio' };
    if (/quadrienio|quadri.nio/.test(t)) return { anos: 4, nome: 'Quadriênio' };
    if (/quinquenio|quinqu.nio|quinqu/.test(t)) return { anos: 5, nome: 'Quinquênio' };
    if (/trienio|tri.nio/.test(t)) return { anos: 3, nome: 'Triênio' };
    return { anos: 3, nome: 'Adicional por tempo de serviço' };
  }
  // percentual da assistencial na competência (cronograma [{competencia:"06/2026",percentual:2}] tem prioridade)
  function pctAssistencial(assist, competencia) {
    if (assist && Array.isArray(assist.cronograma) && competencia) {
      const m = assist.cronograma.find(x => (x.competencia || '') === competencia);
      if (m && m.percentual != null) return money(m.percentual);
    }
    return money(assist && assist.percentual);
  }

  function run(folha, conv, config) {
    const R = { erros: [], alertas: [], conformes: [], resumo: {} };
    if (!conv) { R.erros.push(mk('erro', 'Sem convenção vinculada', 'A empresa da folha não tem convenção/regime vinculado. Vincule para conferir.')); return R; }
    const regras = conv.regras || {};
    const funcs = folha.funcionarios || [];
    const bag = {}; // agregador: chave -> item

    function add(sev, titulo, detalhe, nome, valor) {
      const key = sev + '|' + titulo + '|' + (detalhe || '');
      if (!bag[key]) bag[key] = mk(sev, titulo, detalhe, valor, []);
      if (nome && !bag[key].funcs.includes(nome)) bag[key].funcs.push(nome);
    }

    const assist = contribAssistencial(regras);
    const preveQuebraCaixa = /quebra de caixa/.test(norm(regras.observacoes)) || money((regras.pisos || []).length);
    const temTrienio = regras.tempoServico && regras.tempoServico.aplica;

    funcs.forEach(f => {
      const nome = f.nome;
      const sal = money(f.salario);

      // 0) PRÓ-LABORE / SÓCIO / AUTÔNOMO — não é celetista, fica fora da conferência CLT.
      //    Detecta por: (a) campo "vinculo" lido pela IA, (b) cargo/situação de sócio/titular
      //    (com \b pra não casar "social"), (c) rubrica PRÓ-LABORE na folha (sinal mais forte).
      const vinc = norm(f.vinculo);
      const ehProLabore =
        /pro.?labore|contribuinte individual|autonom|s[óo]ci[oa]|titular|diretor/.test(vinc)
        || /\b(s[óo]ci[oa]|titular)\b/.test(norm(f.cargo) + ' ' + norm(f.situacao))
        || !!acharRubrica(f, /pro.?labore/);
      if (ehProLabore) {
        add('alerta', 'Pró-labore / sócio — fora da conferência CLT',
          `${nome}: não é celetista, então piso, triênio, quebra de caixa e horas extras não se aplicam. Confira apenas INSS/IRRF pelas regras de contribuinte individual.`, nome);
        return;
      }

      // 1) PISO (proporcional às horas contratadas quando a jornada é reduzida)
      const piso = pisoAplicavel(regras, f.cargo);
      if (piso && money(piso.valor)) {
        const h = money(f.horasMes);
        const fator = (h > 0 && h < 219) ? h / 220 : 1;   // 220h = jornada cheia (44h)
        const pisoEsp = round2(money(piso.valor) * fator);
        if (sal < pisoEsp - 0.01) {
          add('erro', 'Salário abaixo do piso',
            `${nome}: salário ${brl(sal)} < piso${fator < 1 ? ' proporcional a ' + Math.round(h) + 'h' : ''} ${brl(pisoEsp)}${fator < 1 ? ' (piso cheio ' + brl(piso.valor) + ')' : ''}. Corrigir o salário-base.`, nome, pisoEsp - sal);
        } else {
          add('conforme', 'Salário conforme o piso', `Salário ≥ piso (proporcional às horas quando a jornada é reduzida).`, nome);
        }
      } else {
        add('alerta', 'Função sem piso mapeado',
          `Cargo "${f.cargo}" não casou com nenhum piso da convenção. Confirmar o enquadramento.`, nome);
      }

      // 2) ADICIONAL NOTURNO + REFLEXO
      const temNoturno = acharRubrica(f, /adicional noturno|hora.*noturn/, 'P');
      const temReflexo = acharRubrica(f, /reflexo.*noturn|dsr.*noturn/, 'P');
      if (temNoturno && !temReflexo) {
        add('erro', 'Adicional noturno sem reflexo em DSR',
          'A convenção manda integrar HE/noturno habituais nos reflexos (DSR, férias, 13º).', nome);
      } else if (temNoturno && temReflexo) {
        add('conforme', 'Adicional noturno com reflexo em DSR', 'Reflexo do noturno presente.', nome);
      }

      // 3) CONTRIBUIÇÃO ASSISTENCIAL (percentual pode variar por mês — usa a competência)
      if (assist) {
        const pct = pctAssistencial(assist, folha.competencia);
        const esperado = round2(sal * pct / 100);
        const rub = acharRubrica(f, /assistenc|contribui.*sindic|sindical|negocial/, 'D');
        if (!rub) {
          add('alerta', 'Contribuição assistencial não descontada',
            `A CCT prevê ${pct}% nesta competência (${brl(esperado)}). Verificar direito de oposição ou lançamento.`, nome, esperado);
        } else if (Math.abs(money(rub.valor) - esperado) > 0.05) {
          add('erro', 'Contribuição assistencial com valor divergente',
            `CCT prevê ${pct}% em ${folha.competencia || 'nesta competência'} = ${brl(esperado)}. Na folha: "${rub.descricao.trim()}" = ${brl(rub.valor)}. Diferença ${brl(Math.abs(esperado - money(rub.valor)))}/empregado.`, nome, esperado - money(rub.valor));
        } else {
          add('conforme', 'Contribuição assistencial correta', `${pct}% aplicado nesta competência.`, nome);
        }
      }

      // 4) QUEBRA DE CAIXA (se a função for de caixa)
      if (preveQuebraCaixa && /caixa/.test(norm(f.cargo))) {
        const qc = acharRubrica(f, /quebra de caixa|quebra.*caixa/, 'P');
        if (!qc) add('erro', 'Falta adicional de quebra de caixa',
          'Função de caixa: a CCT garante 6% do salário normativo. Não encontrei a rubrica.', nome, round2(sal * 0.06));
      } else if (preveQuebraCaixa && /(atendente|balcao|balconist)/.test(norm(f.cargo))) {
        add('alerta', 'Verificar quebra de caixa',
          `"${f.cargo}" pode exercer função de caixa. Se sim, falta o adicional de 6% (${brl(round2(sal * 0.06))}).`, nome);
      }

      // 5) ADICIONAL POR TEMPO DE SERVIÇO (triênio, quinquênio, etc. — conforme a CCT)
      if (temTrienio && f.admissao) {
        const ts = tempoServicoInfo(regras.tempoServico);
        const anos = anosEntre(f.admissao, folha.competencia);
        const periodo = ts.anos;
        const teto = money(regras.tempoServico.teto) || 99;
        const devidos = Math.min(Math.floor(anos / periodo), teto);
        const rubT = acharRubrica(f, /trienio|tri.nio|bienio|bi.nio|anuenio|anu.nio|quadrienio|quinquenio|quinqu.nio|tempo de servico|ad.*tempo/, 'P');
        if (devidos >= 1 && !rubT) {
          add('erro', `${ts.nome} não lançado`,
            `${nome}: ${anos.toFixed(1)} anos de casa → ${devidos} ${ts.nome.toLowerCase()}(s) a cada ${periodo} anos. A CCT prevê ${regras.tempoServico.percentual}% por período.`, nome);
        }
        // perto de completar novo período (alerta) — só se ainda não bateu o teto
        const faltaAno = periodo - (anos % periodo);
        if (faltaAno <= 60 / 365 && Math.floor(anos / periodo) < teto) {
          add('alerta', `Perto de completar ${ts.nome.toLowerCase()}`,
            `${nome} completa novo período (a cada ${periodo} anos) em breve — está com ${anos.toFixed(1)} anos. Programar o lançamento.`, nome);
        }
      }

      // 6) ESTABILIDADE (se afastado/situação especial)
      const sit = norm(f.situacao);
      if (/afast|acidente|gestante|licenca|auxilio.?doenca/.test(sit)) {
        const est = (regras.estabilidades || []).map(e => e.tipo).join(', ');
        add('alerta', 'Situação com possível estabilidade',
          `${nome} está "${f.situacao}". Verificar estabilidade${est ? ' (' + est + ')' : ''} ao retornar/desligar.`, nome);
      }
    });

    // ---- Nível empresa ----
    // Benefícios pagos pela empresa (não aparecem na folha)
    (regras.beneficios || []).forEach(b => {
      const cond = norm(b.condicoes);
      const ehEmpresa = /empresa|pago pela empresa|obriga/.test(cond) || /assistencial|odontolog/.test(norm(b.tipo));
      if (ehEmpresa) {
        add('alerta', 'Benefício de custeio da empresa — confirmar pagamento',
          `${labelBenef(b.tipo)}${b.valor ? ' (' + brl(b.valor) + '/empregado)' : ''}: obrigação da empresa, não aparece na folha. Confirmar o recolhimento/pagamento.`, null, b.valor);
      }
    });

    // Contribuição patronal (lembrete)
    ((regras.contribuicoes || [])).forEach(x => {
      if (/negocial|patronal/.test(norm(x.tipo)) && norm(x.desconto) === 'empresa') {
        add('alerta', 'Contribuição patronal (lembrete)',
          `${x.obs || 'Contribuição negocial patronal'} — pagamento pela empresa, fora da folha mensal.`, null, x.valor);
      }
    });

    // Encargos: FGTS = 8% da base
    if (folha.totais && money(folha.totais.baseFGTS)) {
      const espFGTS = round2(money(folha.totais.baseFGTS) * 0.08);
      const difFGTS = Math.abs(espFGTS - money(folha.totais.valorFGTS));
      if (difFGTS > 1) {
        add('erro', 'FGTS divergente', `Esperado 8% de ${brl(folha.totais.baseFGTS)} = ${brl(espFGTS)}; na folha ${brl(folha.totais.valorFGTS)}.`, null, difFGTS);
      } else {
        add('conforme', 'FGTS conforme (8% da base)', `${brl(folha.totais.valorFGTS)} sobre ${brl(folha.totais.baseFGTS)}.`, null);
      }
    }
    // Encargos incidem sobre adicional noturno (base INSS/FGTS inclui os proventos)
    add('conforme', 'Encargos incidindo sobre as rubricas salariais',
      'INSS e FGTS calculados sobre base que inclui adicional noturno e reflexos.', null);
    // Regime (Simples Nacional)
    if (folha.regime === 'simples' || (folha.totais && money(folha.totais.inssEmpresa) === 0 && money(folha.totais.inssSegurados) > 0)) {
      add('conforme', 'INSS patronal zerado coerente com o Simples Nacional',
        'Empresa/RAT/Terceiros = 0 (a CPP está no DAS do Simples).', null);
    }

    // materializa
    Object.values(bag).forEach(it => {
      (it.sev === 'erro' ? R.erros : it.sev === 'alerta' ? R.alertas : R.conformes).push(it);
    });
    R.resumo = {
      empresa: folha.empresaNome, cnpj: folha.empresaCnpj, competencia: folha.competencia,
      convencao: conv.titulo, nFunc: funcs.length,
      totalProventos: folha.totais && folha.totais.proventos, liquido: folha.totais && folha.totais.liquido,
      nErros: R.erros.length, nAlertas: R.alertas.length,
    };
    return R;
  }

  function mk(sev, titulo, detalhe, valor, funcs) { return { sev, titulo, detalhe: detalhe || '', valor: valor ?? null, funcs: funcs || [] }; }
  function brl(n) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function anosEntre(admissaoISO, competencia) {
    const [mm, yy] = (competencia || '').split('/');
    const ref = yy ? new Date(`${yy}-${String(mm).padStart(2, '0')}-28T00:00:00`) : new Date();
    const adm = new Date(admissaoISO + 'T00:00:00');
    return (ref - adm) / (365.25 * 86400000);
  }
  function labelBenef(t) {
    const map = { plano_saude: 'Plano de saúde', plano_odontologico: 'Plano odontológico', auxilio_assistencial: 'Auxílio/plano de assistência', seguro_vida: 'Seguro de vida', vale_transporte: 'Vale-transporte', cesta_basica: 'Cesta básica' };
    return map[t] || t;
  }

  return { run };
})();
