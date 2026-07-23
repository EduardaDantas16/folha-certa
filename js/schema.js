/* schema.js — estrutura das "regras" absorvidas de uma convenção + utilitários.
 *
 * Este é o coração do sistema: o formato para o qual a IA vai converter a CCT,
 * e que você confere/edita antes de valer. Cada campo aqui vira uma verificação
 * na conferência de folha.
 */
const Schema = {

  /* Estrutura vazia de regras de uma convenção. */
  emptyRegras() {
    return {
      pisos: [],            // [{ funcao, valor, jornada }]
      reajuste: { percentual: null, aPartirDe: '' },
      tempoServico: {       // triênio/anuênio/quinquênio
        aplica: false,
        tipo: 'trienio',    // anuenio | bienio | trienio | quinquenio
        percentual: null,   // % por período
        base: 'salario_base',
        teto: null,         // nº máx de períodos (null = sem teto)
        condicoes: '',
      },
      produtividade: {
        aplica: false,
        tipo: 'percentual', // percentual | valor_fixo
        valor: null,
        condicoes: '',
      },
      adiantamento: {
        obrigatorio: false,
        percentual: 40,
        diaLimite: 20,
      },
      adicionais: {
        horaExtra: 50,      // %
        horaExtra100: 100,  // domingos/feriados
        noturno: 20,        // %
        insalubridade: '',  // texto: grau/base
        periculosidade: '', // texto
      },
      estabilidades: [],    // [{ tipo, descricao, duracaoMeses }]
      beneficios: [],       // [{ tipo, valor, condicoes }]
      contribuicoes: [],    // [{ tipo, base, valor, desconto }]
      encargos: {           // rubricas que DEVEM incidir INSS/FGTS (checagem de encargos)
        incideINSS: ['salario', 'hora_extra', 'adicional_noturno', 'trienio', 'produtividade', 'insalubridade', 'periculosidade', 'dsr', 'ferias_gozadas'],
        incideFGTS: ['salario', 'hora_extra', 'adicional_noturno', 'trienio', 'produtividade', 'insalubridade', 'periculosidade', 'dsr', 'ferias_gozadas', 'aviso_previo', '13_salario'],
        naoIncide: ['vale_transporte', 'vale_refeicao_pat', 'ferias_indenizadas', 'ajuda_custo'],
      },
      observacoes: '',
    };
  },

  /* Regras-base da CLT pura (para empresas/funcionários sem convenção).
     Piso = salário mínimo nacional vigente (vem das Configurações). */
  cltRegras(salarioMinimo) {
    const r = this.emptyRegras();
    r.pisos = [{ funcao: 'Salário mínimo nacional', valor: salarioMinimo || null, jornada: '44h semanais' }];
    r.adicionais = {
      horaExtra: 50, horaExtra100: 100, noturno: 20,
      insalubridade: 'Conforme NR-15 (10/20/40% do salário mínimo) + laudo',
      periculosidade: '30% sobre o salário base (NR-16)',
    };
    r.estabilidades = [
      { tipo: 'gestante', descricao: 'Gestante: da confirmação da gravidez até 5 meses após o parto (art. 10, II, b, ADCT).', duracaoMeses: 5 },
      { tipo: 'acidente', descricao: 'Acidentária: 12 meses após o retorno do afastamento por acidente de trabalho (Lei 8.213/91, art. 118).', duracaoMeses: 12 },
    ];
    r.beneficios = [
      { tipo: 'vale_transporte', valor: null, condicoes: 'Obrigatório se o empregado solicitar (Lei 7.418/85); desconto de até 6% do salário base.' },
    ];
    r.observacoes = 'REGIME CLT PURO (sem convenção). Aplicam-se apenas as normas da CLT e o salário mínimo nacional vigente. Base: HE 50% (100% em domingos/feriados), adicional noturno 20% (hora reduzida 52min30s), DSR, 13º, férias + 1/3, FGTS 8%, INSS. Sem piso de categoria, triênio, produtividade ou benefícios de convenção. Atualize o salário mínimo em Configurações a cada virada de ano.';
    return r;
  },

  tiposEstabilidade: [
    { v: 'gestante', l: 'Gestante' },
    { v: 'pre_aposentadoria', l: 'Pré-aposentadoria' },
    { v: 'acidente', l: 'Acidente de trabalho / retorno do INSS' },
    { v: 'retorno_afastamento', l: 'Retorno de afastamento' },
    { v: 'membro_cipa', l: 'Membro da CIPA' },
    { v: 'servico_militar', l: 'Retorno do serviço militar' },
  ],
  tiposBeneficio: [
    { v: 'vale_alimentacao', l: 'Vale alimentação' },
    { v: 'vale_refeicao', l: 'Vale refeição' },
    { v: 'vale_transporte', l: 'Vale transporte' },
    { v: 'cesta_basica', l: 'Cesta básica' },
    { v: 'plano_saude', l: 'Plano de saúde' },
    { v: 'plano_odontologico', l: 'Plano odontológico' },
    { v: 'seguro_vida', l: 'Seguro de vida' },
    { v: 'auxilio_assistencial', l: 'Auxílio/plano de assistência' },
    { v: 'auxilio_creche', l: 'Auxílio creche' },
    { v: 'auxilio_alimentacao_local', l: 'Refeição no local' },
  ],
  tiposContribuicao: [
    { v: 'assistencial', l: 'Contribuição assistencial' },
    { v: 'confederativa', l: 'Contribuição confederativa' },
    { v: 'mensalidade', l: 'Mensalidade sindical' },
    { v: 'negocial', l: 'Taxa negocial' },
  ],
  tiposTempoServico: [
    { v: 'anuenio', l: 'Anuênio (1 ano)' },
    { v: 'bienio', l: 'Biênio (2 anos)' },
    { v: 'trienio', l: 'Triênio (3 anos)' },
    { v: 'quinquenio', l: 'Quinquênio (5 anos)' },
  ],

  /* Meses para data-base */
  meses: ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'],
};

/* ---------------- Utils ---------------- */
const Util = {
  // ---- CNPJ ----
  formatCNPJ(v) {
    v = (v || '').replace(/\D/g, '').slice(0, 14);
    if (v.length <= 2) return v;
    let out = v.slice(0, 2) + '.' + v.slice(2, 5);
    if (v.length > 5) out += '.' + v.slice(5, 8);
    if (v.length > 8) out += '/' + v.slice(8, 12);
    if (v.length > 12) out += '-' + v.slice(12, 14);
    return out;
  },
  validaCNPJ(v) {
    v = (v || '').replace(/\D/g, '');
    if (v.length !== 14 || /^(\d)\1{13}$/.test(v)) return false;
    const calc = (base) => {
      let len = base.length, pos = len - 7, sum = 0;
      for (let i = len; i >= 1; i--) {
        sum += parseInt(base[len - i]) * pos--;
        if (pos < 2) pos = 9;
      }
      const r = sum % 11;
      return r < 2 ? 0 : 11 - r;
    };
    const d1 = calc(v.slice(0, 12));
    const d2 = calc(v.slice(0, 12) + d1);
    return v.slice(12) === '' + d1 + d2;
  },

  // ---- Datas ----
  formatDateBR(iso) {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  },
  diasAte(iso) {
    if (!iso) return null;
    const alvo = new Date(iso + 'T00:00:00');
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    return Math.round((alvo - hoje) / 86400000);
  },
  // Status de vigência da convenção com base no fim
  statusVigencia(vigenciaFim) {
    const d = Util.diasAte(vigenciaFim);
    if (d === null) return { cls: 'neutral', txt: 'Sem vigência', dias: null };
    if (d < 0) return { cls: 'err', txt: `Vencida há ${Math.abs(d)} dia(s)`, dias: d };
    if (d <= 60) return { cls: 'warn', txt: `Vence em ${d} dia(s)`, dias: d };
    return { cls: 'ok', txt: `Vigente (${d} dia(s))`, dias: d };
  },

  // ---- Moeda ----
  formatBRL(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '—';
    return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  },
  parseNum(v) {
    if (v === '' || v === null || v === undefined) return null;
    const n = parseFloat(String(v).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  },

  escape(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // extrai a UF de um texto de abrangência tipo "Aracaju/SE" ou "todo o estado de SE"
  parseUF(s) {
    const m = (s || '').toUpperCase().match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    return m ? m[1] : '';
  },
};
