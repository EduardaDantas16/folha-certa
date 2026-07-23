/* convert.js — conversor GRÁTIS de PDF para JSON, 100% no navegador (pdf.js).
 * Não usa a IA nem manda nada pra internet: o PDF é lido localmente.
 * Tem um parser dedicado ao "EXTRATO MENSAL" (sistema Totali) e um fallback
 * genérico. Em PDF escaneado (imagem) o texto não sai — aí precisa da IA.
 */
const PDFConvert = (function () {
  if (window.pdfjsLib) {
    try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js'; } catch (e) {}
  }

  /* ---------- extração de texto, reconstruindo linhas pela posição ---------- */
  async function extrairTexto(arrayBuffer, onProgress) {
    if (!window.pdfjsLib) throw new Error('A biblioteca de leitura de PDF (pdf.js) não carregou. Recarregue a página.');
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, isEvalSupported: false }).promise;
    const linhas = [];
    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const tc = await page.getTextContent();
      const itens = tc.items
        .filter(it => it.str !== undefined)
        .map(it => ({ str: it.str, x: it.transform[4], y: it.transform[5] }));
      agruparLinhas(itens).forEach(l => linhas.push(l));
      if (onProgress) onProgress(p, pdf.numPages);
    }
    return linhas.join('\n');
  }

  // agrupa os pedaços de texto por linha (mesma coordenada Y) e ordena pela X
  function agruparLinhas(itens) {
    const buckets = [];
    itens.forEach(it => {
      let b = buckets.find(b => Math.abs(b.y - it.y) < 3.2);
      if (!b) { b = { y: it.y, itens: [] }; buckets.push(b); }
      b.itens.push(it);
    });
    buckets.sort((a, b) => b.y - a.y);
    return buckets.map(b => b.itens.sort((a, b) => a.x - b.x).map(i => i.str).join(' ').replace(/[ \t]+/g, ' ').trim())
      .filter(l => l.length);
  }

  /* ---------- correção de "embaralhamento" (fonte com ToUnicode quebrado) ---------- */
  const PALAVRAS = ['salario', 'total', 'liquido', 'proventos', 'descontos', 'admiss', 'vinculo',
    'funcionario', 'empresa', 'competencia', 'referencia', 'inss', 'fgts', 'horas', 'cargo',
    'folha', 'pagamento', 'base', 'rubrica', 'valor', 'situacao', 'extrato'];
  function pontua(txt) {
    const t = txt.toLowerCase(); let s = 0;
    for (const w of PALAVRAS) if (t.indexOf(w) >= 0) s++;
    return s;
  }
  function deslocar(txt, k) {
    let out = '';
    for (let i = 0; i < txt.length; i++) {
      const c = txt.charCodeAt(i);
      if (c >= 65 && c <= 90) out += String.fromCharCode((c - 65 + k + 26 * 40) % 26 + 65);
      else if (c >= 97 && c <= 122) out += String.fromCharCode((c - 97 + k + 26 * 40) % 26 + 97);
      else out += txt[i];
    }
    return out;
  }
  function corrigirEmbaralhamento(txt) {
    const base = pontua(txt);
    if (base >= 4) return { texto: txt, deslocamento: 0, embaralhado: false };
    let melhor = { k: 0, score: base };
    for (let k = 1; k < 26; k++) {
      const s = pontua(deslocar(txt.slice(0, 8000), k));
      if (s > melhor.score) melhor = { k, score: s };
    }
    if (melhor.k && melhor.score >= 4) return { texto: deslocar(txt, melhor.k), deslocamento: melhor.k, embaralhado: true };
    return { texto: txt, deslocamento: 0, embaralhado: false };
  }

  /* ---------- utilidades ---------- */
  const RE_CNPJ = /(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/;
  const RE_CPF = /(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/;
  const RE_COMPET = /(0?[1-9]|1[0-2])\s*\/\s*(20\d{2})/;
  const RE_DATA = /([0-3]?\d)\/([01]?\d)\/(\d{4})/;
  const RE_MOEDA = /-?\d{1,3}(?:\.\d{3})*,\d{2}-?/;

  function num(br) {
    if (br == null) return null;
    let s = ('' + br).trim();
    const neg = /-$/.test(s) || /^-/.test(s);
    s = s.replace(/-/g, '').replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    if (isNaN(n)) return null;
    return neg ? -n : n;
  }
  function soDigitos(s) { return (s || '').replace(/\D/g, ''); }
  function dataISO(dstr) {
    const m = RE_DATA.exec(dstr || '');
    if (!m) return '';
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }

  /* ---------- rubricas de uma linha (1 ou 2 colunas: provento à esq., desconto à dir.) ---------- */
  function parseRubricas(l) {
    const out = [];
    const re = /(\d{1,5})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})\s+([PD])(?=\s+\d|\s*$)/g;
    let m;
    while ((m = re.exec(l))) {
      let meio = m[2].trim(), ref = null;
      const tk = meio.split(/\s+/);
      if (tk.length > 1 && /^[\d.:,%]+$/.test(tk[tk.length - 1]) && /\d/.test(tk[tk.length - 1])) { ref = tk.pop(); meio = tk.join(' '); }
      out.push({ cod: m[1], descricao: meio, referencia: ref, valor: num(m[3]), tipo: m[4] });
    }
    return out;
  }

  /* ---------- parser dedicado ao EXTRATO MENSAL (Totali) ---------- */
  function ehExtratoMensal(texto) {
    return /extrato mensal/i.test(texto) || /^\s*Empr\.?:\s*\d+\s+.+Situa[çc]/im.test(texto);
  }
  function parseExtratoMensal(linhas) {
    let empresaNome = '', empresaCnpj = '', competencia = '';
    const funcs = [];
    let cur = null;
    const push = () => { if (cur) { funcs.push(cur); cur = null; } };

    for (const l of linhas) {
      let m;
      if ((m = l.match(/^Empresa:\s*\d*\s*-?\s*(.+?)\s+P[áa]gina:/i))) { if (!empresaNome) empresaNome = m[1].trim(); continue; }
      if (!empresaNome && (m = l.match(/^Empresa:\s*\d*\s*-?\s*(.+)$/i))) { empresaNome = m[1].trim(); continue; }
      if ((m = l.match(/^CNPJ:\s*([\d.\/-]{14,})/i))) { if (!empresaCnpj) empresaCnpj = soDigitos(m[1]); continue; }
      if ((m = l.match(/Compet[êe]ncia:\s*(\d{1,2}\/\d{4})/i))) { if (!competencia) competencia = m[1]; continue; }

      if ((m = l.match(/^Empr\.?:\s*(\d+)\s+(.+?)\s+Situa[çc][ãa]o:\s*(.+?)\s+CPF:\s*([\d.\-]+)\s+Adm:\s*([\d\/]+)/i))) {
        push();
        cur = {
          matricula: m[1], nome: m[2].trim(), situacao: m[3].trim(), cpf: soDigitos(m[4]), admissao: dataISO(m[5]),
          cargo: '', cbo: '', vinculo: '', salario: null, horasMes: null, rubricas: [],
          proventos: null, descontos: null, liquido: null, baseINSS: null, baseFGTS: null, valorFGTS: null,
        };
        continue;
      }
      if (!cur) continue;
      if ((m = l.match(/^V[íi]nculo:\s*(.+?)\s+CC:.*?Horas\s*M[êe]s:\s*([\d.,]+)/i))) { cur.vinculo = m[1].trim(); cur.horasMes = num(m[2]); continue; }
      if ((m = l.match(/^Cargo:\s*\d*\s*(.+?)\s+C\.?\s?B\.?\s?O\.?:?\s*(\d+)?.*?Sal[áa]rio:\s*([\d.,]+)/i))) { cur.cargo = m[1].trim(); cur.cbo = m[2] || ''; cur.salario = num(m[3]); continue; }
      if ((m = l.match(/Proventos:\s*([\d.,]+).*?Descontos:\s*([\d.,]+).*?L[íi]quido:\s*(-?[\d.,]+)/i))) { cur.proventos = num(m[1]); cur.descontos = num(m[2]); cur.liquido = num(m[3]); continue; }
      if ((m = l.match(/Base\s*INSS:\s*([\d.,]+).*?Base\s*FGTS:\s*([\d.,]+).*?Valor\s*FGTS:\s*([\d.,]+)/i))) { cur.baseINSS = num(m[1]); cur.baseFGTS = num(m[2]); cur.valorFGTS = num(m[3]); continue; }
      if (/^(Data de pagamento|Assinatura|Sistema licenciado|C[áa]lculo:|EXTRATO MENSAL|ND:|NF:)/i.test(l)) continue;
      const rub = parseRubricas(l);
      if (rub.length) cur.rubricas.push(...rub);
    }
    push();
    return { empresaNome, empresaCnpj, competencia, regime: 'normal', funcionarios: funcs };
  }

  /* ---------- fallback genérico (layouts desconhecidos) ---------- */
  function parseGenerico(linhas, texto) {
    let empresaCnpj = '', empresaNome = '', competencia = '';
    const mC = texto.match(RE_CNPJ); if (mC) empresaCnpj = soDigitos(mC[1]);
    const mK = texto.match(RE_COMPET); if (mK) competencia = `${mK[1].padStart(2, '0')}/${mK[2]}`;
    for (const l of linhas.slice(0, 12)) {
      if (l.length > 4 && !RE_CNPJ.test(l) && /[A-Za-zÀ-ÿ]/.test(l) && !/folha|extrato|p[áa]gina|competen/i.test(l)) { empresaNome = l.trim(); break; }
    }
    return { empresaNome, empresaCnpj, competencia, regime: 'normal', funcionarios: [] };
  }

  /* ---------- orquestra ---------- */
  function parseFolha(textoBruto) {
    const fix = corrigirEmbaralhamento(textoBruto);
    const texto = fix.texto;
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const alertas = [];
    let folha, formato;
    if (ehExtratoMensal(texto)) { folha = parseExtratoMensal(linhas); formato = 'Extrato Mensal (Totali)'; }
    else { folha = parseGenerico(linhas, texto); formato = 'genérico'; }

    if (fix.embaralhado) alertas.push(`O PDF vinha com as letras deslocadas (fonte fora do padrão); corrigi automaticamente (deslocamento ${fix.deslocamento}). Confira os nomes.`);
    if (!folha.funcionarios.length) alertas.push('Não consegui separar os funcionários automaticamente. Provavelmente é um PDF escaneado (imagem) ou um layout diferente — confira o texto extraído, ajuste o JSON, ou use a leitura por IA.');
    else {
      const semSalario = folha.funcionarios.filter(f => !f.salario).length;
      if (semSalario) alertas.push(`${semSalario} funcionário(s) sem salário-base identificado — confira no JSON.`);
    }
    if (!folha.competencia) alertas.push('Não achei a competência (MM/AAAA) — preencha no JSON.');

    return { folha, texto, alertas, formato, embaralhado: fix.embaralhado };
  }

  return { extrairTexto, parseFolha, parseRubricas, corrigirEmbaralhamento, _num: num };
})();
