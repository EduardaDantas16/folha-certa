/* app.js — roteador + telas do Folha Certa (MVP) */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const app = $('#app');

  const APP_VERSION = 'v16 · 23/07/2026';   // aparece no rodapé do menu ☰

  const NAV = [
    { id: 'painel', label: 'Painel', icon: '🏠', primary: true },
    { id: 'sindicatos', label: 'Sindicatos', icon: '🏛️', primary: false },
    { id: 'convencoes', label: 'Convenções', icon: '📄', primary: true },
    { id: 'empresas', label: 'Empresas', icon: '🏢', primary: true },
    { id: 'conferencia', label: 'Conferência', icon: '✅', primary: true },
    { id: 'conversor', label: 'Conversor PDF→JSON', icon: '🔄', primary: false },
    { id: 'historico', label: 'Histórico', icon: '📊', primary: true },
    { id: 'duvidas', label: 'Dúvidas', icon: '💬', primary: false },
  ];

  const state = { view: 'painel' };

  /* ------------- infra ui ------------- */
  function toast(msg, kind) {
    let t = $('#toast');
    t.textContent = msg;
    t.className = 'toast on ' + (kind || '');
    clearTimeout(t._t);
    t._t = setTimeout(() => (t.className = 'toast'), 2600);
  }
  function openModal(html) {
    const s = $('#modalScrim');
    $('#modalBody').innerHTML = html;
    s.classList.add('on');
    return $('#modalBody');
  }
  function closeModal() { $('#modalScrim').classList.remove('on'); }

  function go(view) {
    state.view = view;
    render();
    closeDrawer();
    window.scrollTo(0, 0);
  }

  /* ------------- nav ------------- */
  function renderNav() {
    const bn = $('#bottomnav');
    bn.innerHTML = NAV.filter(n => n.primary).map(n => `
      <button class="navitem ${state.view === n.id ? 'on' : ''}" data-go="${n.id}">
        <span class="i">${n.icon}</span>${n.label}
      </button>`).join('');
    const dn = $('#drawerNav');
    dn.innerHTML = NAV.map(n => `
      <a class="${state.view === n.id ? 'on' : ''}" data-go="${n.id}">
        <span class="i">${n.icon}</span>${n.label}
      </a>`).join('');
  }
  function openDrawer() { $('#scrim').classList.add('on'); $('#drawer').classList.add('on'); }
  function closeDrawer() { $('#scrim').classList.remove('on'); $('#drawer').classList.remove('on'); }

  /* ============================================================
     PAINEL
  ============================================================ */
  async function viewPainel() {
    const [sinds, convsAll, emps] = await Promise.all([
      DB.list('sindicatos'), DB.list('convencoes'), DB.list('empresas'),
    ]);
    const convs = convsAll.filter(c => !c.arquivada);

    // alertas de vigência (não vale para o regime CLT)
    const alertas = convs.filter(c => c.tipo !== 'clt').map(c => ({ c, st: Util.statusVigencia(c.vigenciaFim) }))
      .filter(x => x.st.dias !== null && x.st.dias <= 60)
      .sort((a, b) => a.st.dias - b.st.dias);

    const pendentes = convs.filter(c => !c.aprovada && c.tipo !== 'clt');

    return `
      <div class="view">
        <div class="view-title">Bom dia 👋</div>
        <p class="view-sub">Visão geral do escritório.</p>

        ${(!sinds.length && !convs.length && !emps.length) ? `
        <div class="card" style="border:1.5px solid var(--gold)">
          <h3>👋 Primeira vez por aqui?</h3>
          <p class="mini" style="margin:4px 0 12px">Carregue um exemplo pronto (dados fictícios) e veja a conferência de folha funcionando na hora.</p>
          <button class="btn primary block" data-seed-demo>▶ Ver com dados de demonstração</button>
        </div>` : ''}

        <div class="tiles">
          <div class="tile" data-go="sindicatos"><div class="ic">🏛️</div><div class="n">${sinds.length}</div><div class="l">Sindicatos</div></div>
          <div class="tile" data-go="convencoes"><div class="ic">📄</div><div class="n">${convs.length}</div><div class="l">Convenções</div></div>
          <div class="tile" data-go="empresas"><div class="ic">🏢</div><div class="n">${emps.length}</div><div class="l">Empresas</div></div>
          <div class="tile" data-go="conferencia"><div class="ic">✅</div><div class="n">›</div><div class="l">Conferir folha</div></div>
        </div>

        ${alertas.length ? `
          <div class="section-hd">Convenções a vencer</div>
          ${alertas.map(x => `
            <div class="card">
              <div class="row between">
                <div class="grow"><h3 class="truncate">${Util.escape(x.c.titulo)}</h3>
                  <div class="mini">Data-base: ${x.c.dataBaseMes || '—'}</div></div>
                <span class="badge ${x.st.cls}">${x.st.txt}</span>
              </div>
              <button class="btn gold sm" data-mediador="${x.c.id}" style="margin-top:10px">🔎 Procurar nova no Mediador</button>
            </div>`).join('')}
        ` : ''}

        ${pendentes.length ? `
          <div class="notice gold" style="margin-top:14px">
            <b>${pendentes.length} convenção(ões)</b> ainda sem regras conferidas/aprovadas.
            Abra a convenção e confira as regras absorvidas antes de usar na conferência.
          </div>` : ''}

        <div class="section-hd">Atalhos</div>
        <div class="card tap" data-go="duvidas"><div class="row between">
          <div><h3>💬 Tirar dúvida da convenção</h3><div class="mini">Pergunte o que o funcionário tem direito</div></div><span>›</span>
        </div></div>
      </div>`;
  }

  /* ============================================================
     SINDICATOS
  ============================================================ */
  async function viewSindicatos() {
    const list = await DB.list('sindicatos');
    return `
      <div class="view">
        <div class="view-title">Sindicatos</div>
        <p class="view-sub">Cadastro base. Cada convenção pertence a um sindicato.</p>
        <div class="fab-row"><button class="btn primary" data-new-sind>+ Novo sindicato</button></div>
        ${list.length ? list.map(s => `
          <div class="card">
            <div class="row between">
              <div class="grow"><h3 class="truncate">${Util.escape(s.nome)}</h3>
                <div class="kv"><span>CNPJ: <b>${Util.formatCNPJ(s.cnpj) || '—'}</b></span>
                ${s.categoria ? `<span>Categoria: <b>${Util.escape(s.categoria)}</b></span>` : ''}</div>
              </div>
            </div>
            <div class="row" style="margin-top:12px;gap:8px">
              <button class="btn ghost sm" data-edit-sind="${s.id}">Editar</button>
              <button class="btn danger sm" data-del-sind="${s.id}">Excluir</button>
            </div>
          </div>`).join('') : emptyState('🏛️', 'Nenhum sindicato ainda', 'Cadastre o primeiro para começar.')}
      </div>`;
  }

  function formSindicato(s) {
    s = s || {};
    return `
      <div class="mh"><h3>${s.id ? 'Editar' : 'Novo'} sindicato</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="field"><label>Nome do sindicato *</label>
        <input id="f_nome" value="${Util.escape(s.nome || '')}" placeholder="Ex.: SINDICOM / SEAC-SE"></div>
      <div class="field"><label>CNPJ</label>
        <input id="f_cnpj" inputmode="numeric" value="${Util.formatCNPJ(s.cnpj || '')}" placeholder="00.000.000/0000-00"></div>
      <div class="field"><label>Categoria representada</label>
        <input id="f_cat" value="${Util.escape(s.categoria || '')}" placeholder="Ex.: Comerciários, Vigilantes..."></div>
      <button class="btn primary block" data-save-sind="${s.id || ''}">Salvar</button>`;
  }

  /* ============================================================
     CONVENÇÕES
  ============================================================ */
  async function viewConvencoes() {
    const [todas, sinds] = await Promise.all([DB.list('convencoes'), DB.list('sindicatos')]);
    const convs = todas.filter(c => !c.arquivada);
    const nArq = todas.length - convs.length;
    const nomeSind = id => (sinds.find(s => s.id === id) || {}).nome || '—';
    const temClt = convs.some(c => c.tipo === 'clt');

    return `
      <div class="view">
        <div class="view-title">Convenções</div>
        <p class="view-sub">Cadastre a CCT/ACT, ou use o regime CLT para quem não segue convenção.</p>
        <div class="fab-row">
          <button class="btn primary" data-new-conv ${sinds.length ? '' : 'disabled'}>+ Nova convenção</button>
          <button class="btn ghost" data-import-conv>⤵ Importar (JSON da IA)</button>
          ${temClt ? '' : '<button class="btn gold" data-new-clt>+ Regime CLT (sem convenção)</button>'}
        </div>
        ${!sinds.length ? `<div class="notice">Cadastre um <b>sindicato</b> para adicionar uma CCT. Mas o <b>regime CLT</b> pode ser criado sem sindicato. <a data-go="sindicatos" style="color:var(--navy);font-weight:700;cursor:pointer">Ir para sindicatos ›</a></div>` : ''}
        ${convs.length ? convs.map(c => {
          const isClt = c.tipo === 'clt';
          const st = Util.statusVigencia(c.vigenciaFim);
          const nPisos = (c.regras && c.regras.pisos || []).length;
          const pisoVal = (c.regras && c.regras.pisos && c.regras.pisos[0]) ? c.regras.pisos[0].valor : null;
          return `
          <div class="card">
            <div class="row between">
              <div class="grow"><h3 class="truncate">${Util.escape(c.titulo)}</h3>
                <div class="mini">${isClt ? 'Apenas CLT + salário mínimo' : Util.escape(nomeSind(c.sindicatoId))}</div></div>
              ${isClt ? '<span class="badge gold">CLT</span>' : (c.aprovada ? '<span class="badge ok">✓ Conferida</span>' : '<span class="badge warn">Regras pendentes</span>')}
            </div>
            ${isClt ? `
            <div class="kv" style="margin-top:10px"><span>Salário mínimo: <b>${Util.formatBRL(pisoVal)}</b></span></div>
            <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
              <button class="btn gold sm" data-regras="${c.id}">⚙️ Ver regras CLT</button>
              <button class="btn ghost sm" data-config>Alterar salário mínimo</button>
              <button class="btn danger sm" data-del-conv="${c.id}">Excluir</button>
            </div>` : `
            <div class="kv" style="margin-top:10px">
              <span>Data-base: <b>${c.dataBaseMes || '—'}</b></span>
              <span>Vigência: <b>${Util.formatDateBR(c.vigenciaInicio)} a ${Util.formatDateBR(c.vigenciaFim)}</b></span>
            </div>
            <div class="row between" style="margin-top:8px">
              <span class="badge ${st.cls}">${st.txt}</span>
              <span class="badge neutral">${nPisos} piso(s)</span>
            </div>
            ${st.dias !== null && st.dias <= 60 ? `<div class="notice ${st.dias < 0 ? '' : 'gold'}" style="margin-top:10px">${st.dias < 0 ? '⛔ Convenção vencida.' : '⏳ Vence em breve.'} Verifique se saiu uma nova no Mediador.</div>` : ''}
            <div class="row" style="margin-top:12px;gap:8px;flex-wrap:wrap">
              <button class="btn gold sm" data-regras="${c.id}">⚙️ Regras absorvidas</button>
              <button class="btn ghost sm" data-mediador="${c.id}">🔎 Mediador</button>
              <button class="btn ghost sm" data-edit-conv="${c.id}">Editar</button>
              <button class="btn danger sm" data-del-conv="${c.id}">Excluir</button>
            </div>`}
          </div>`;
        }).join('') : (sinds.length ? emptyState('📄', 'Nenhuma convenção', 'Cadastre a CCT do sindicato ou crie o regime CLT.') : '')}
        ${nArq ? `<div class="mini" style="text-align:center;margin-top:8px">${nArq} convenção(ões) arquivada(s) por substituição (guardadas no histórico).</div>` : ''}
      </div>`;
  }

  function formConvencao(c, sinds) {
    c = c || {};
    const mesOpts = ['<option value="">—</option>'].concat(
      Schema.meses.map(m => `<option ${c.dataBaseMes === m ? 'selected' : ''}>${m}</option>`)).join('');
    const sindOpts = sinds.map(s => `<option value="${s.id}" ${c.sindicatoId === s.id ? 'selected' : ''}>${Util.escape(s.nome)}</option>`).join('');
    return `
      <div class="mh"><h3>${c.id ? 'Editar' : 'Nova'} convenção</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="field"><label>Sindicato *</label><select id="c_sind">${sindOpts}</select></div>
      <div class="field"><label>Título / identificação *</label>
        <input id="c_tit" value="${Util.escape(c.titulo || '')}" placeholder="Ex.: CCT 2025/2026 Comerciários Aracaju"></div>
      <div class="field two">
        <div><label>Nº registro MTE</label><input id="c_reg" value="${Util.escape(c.numeroRegistro || '')}" placeholder="SE000000/2025"></div>
        <div><label>Data-base</label><select id="c_base">${mesOpts}</select></div>
      </div>
      <div class="field two">
        <div><label>Abrangência territorial</label>
          <input id="c_abr" value="${Util.escape(c.abrangencia || '')}" placeholder="Ex.: Aracaju/SE"></div>
        <div><label>UF <span class="mini">(p/ busca no Mediador)</span></label>
          <input id="c_uf" maxlength="2" value="${Util.escape(c.uf || Util.parseUF(c.abrangencia) || '')}" placeholder="SE" style="text-transform:uppercase"></div>
      </div>
      <div class="field two">
        <div><label>Início da vigência</label><input id="c_vi" type="date" value="${c.vigenciaInicio || ''}"></div>
        <div><label>Fim da vigência</label><input id="c_vf" type="date" value="${c.vigenciaFim || ''}"></div>
      </div>
      <div class="field"><label>PDF da convenção</label>
        <div class="drop ${c.pdfName ? 'has' : ''}" id="c_drop">
          ${c.pdfName ? '📎 ' + Util.escape(c.pdfName) : '<b>Toque para anexar</b> o PDF da CCT/ACT'}
        </div>
        <input id="c_pdf" type="file" accept="application/pdf" hidden>
        <button class="btn gold block sm" id="c_absorver" disabled style="margin-top:8px">🤖 Absorver PDF com IA (preenche tudo)</button>
        <div class="mini" id="c_ia_status" style="margin-top:6px"></div>
      </div>
      <button class="btn primary block" data-save-conv="${c.id || ''}">Salvar convenção</button>`;
  }

  /* ---- Editor de REGRAS (a tela de "conferir o que a IA absorveu") ---- */
  async function editorRegras(id) {
    const c = await DB.get('convencoes', id);
    if (!c) return;
    const r = c.regras || Schema.emptyRegras();
    _regrasCache = JSON.parse(JSON.stringify(r)); // trabalho em cima de uma cópia
    _regrasConvId = id;

    const body = openModal(renderRegras(c, _regrasCache));
    body.scrollTop = 0;
  }
  let _regrasCache = null, _regrasConvId = null;

  function renderRegras(c, r) {
    const estOpts = Schema.tiposEstabilidade;
    return `
      <div class="mh"><h3>Regras absorvidas</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="mini" style="margin:-4px 2px 12px">${Util.escape(c.titulo)}</div>

      <div class="notice gold" style="margin-bottom:14px">
        🤖 Quando ligarmos a IA, estes campos vêm <b>pré-preenchidos</b> da leitura do PDF.
        Aqui é onde você <b>confere e ajusta</b> antes de aprovar. Por enquanto, dá pra preencher à mão.
      </div>

      <!-- PISOS -->
      <div class="section-hd">Pisos salariais por função</div>
      <div id="reg_pisos">${(r.pisos || []).map(pisoRow).join('') || '<div class="mini" style="padding:6px 0">Nenhum piso adicionado.</div>'}</div>
      <button class="btn ghost sm" data-add-piso style="margin-top:8px">+ Adicionar piso</button>

      <!-- TEMPO DE SERVIÇO -->
      <div class="section-hd">Adicional por tempo de serviço (triênio etc.)</div>
      <label class="chip ${r.tempoServico.aplica ? 'on' : ''}" data-toggle="tempoServico.aplica" style="display:inline-block">${r.tempoServico.aplica ? '✓ ' : ''}A convenção prevê</label>
      <div class="field two" style="margin-top:10px">
        <div><label>Tipo</label><select data-bind="tempoServico.tipo">${Schema.tiposTempoServico.map(t => `<option value="${t.v}" ${r.tempoServico.tipo === t.v ? 'selected' : ''}>${t.l}</option>`).join('')}</select></div>
        <div><label>% por período</label><input data-bind="tempoServico.percentual" inputmode="decimal" value="${r.tempoServico.percentual ?? ''}" placeholder="Ex.: 3"></div>
      </div>
      <div class="field"><label>Condições / teto (texto)</label><input data-bind="tempoServico.condicoes" value="${Util.escape(r.tempoServico.condicoes || '')}" placeholder="Ex.: sobre o salário base, sem limite"></div>

      <!-- PRODUTIVIDADE -->
      <div class="section-hd">Produtividade / prêmio</div>
      <label class="chip ${r.produtividade.aplica ? 'on' : ''}" data-toggle="produtividade.aplica" style="display:inline-block">${r.produtividade.aplica ? '✓ ' : ''}A convenção prevê</label>
      <div class="field two" style="margin-top:10px">
        <div><label>Tipo</label><select data-bind="produtividade.tipo"><option value="percentual" ${r.produtividade.tipo === 'percentual' ? 'selected' : ''}>Percentual</option><option value="valor_fixo" ${r.produtividade.tipo === 'valor_fixo' ? 'selected' : ''}>Valor fixo</option></select></div>
        <div><label>Valor / %</label><input data-bind="produtividade.valor" inputmode="decimal" value="${r.produtividade.valor ?? ''}"></div>
      </div>
      <div class="field"><label>Condições</label><input data-bind="produtividade.condicoes" value="${Util.escape(r.produtividade.condicoes || '')}"></div>

      <!-- ADIANTAMENTO -->
      <div class="section-hd">Adiantamento salarial (vale)</div>
      <label class="chip ${r.adiantamento.obrigatorio ? 'on' : ''}" data-toggle="adiantamento.obrigatorio" style="display:inline-block">${r.adiantamento.obrigatorio ? '✓ ' : ''}Obrigatório</label>
      <div class="field two" style="margin-top:10px">
        <div><label>% do salário</label><input data-bind="adiantamento.percentual" inputmode="decimal" value="${r.adiantamento.percentual ?? ''}"></div>
        <div><label>Dia limite de pagamento</label><input data-bind="adiantamento.diaLimite" inputmode="numeric" value="${r.adiantamento.diaLimite ?? ''}"></div>
      </div>

      <!-- ADICIONAIS -->
      <div class="section-hd">Adicionais (%)</div>
      <div class="field two">
        <div><label>Hora extra</label><input data-bind="adicionais.horaExtra" inputmode="decimal" value="${r.adicionais.horaExtra ?? ''}"></div>
        <div><label>H.E. 100% (dom/feriado)</label><input data-bind="adicionais.horaExtra100" inputmode="decimal" value="${r.adicionais.horaExtra100 ?? ''}"></div>
      </div>
      <div class="field two">
        <div><label>Adicional noturno</label><input data-bind="adicionais.noturno" inputmode="decimal" value="${r.adicionais.noturno ?? ''}"></div>
        <div><label>Insalubridade (texto)</label><input data-bind="adicionais.insalubridade" value="${Util.escape(r.adicionais.insalubridade || '')}"></div>
      </div>

      <!-- ESTABILIDADES -->
      <div class="section-hd">Estabilidades previstas</div>
      <div id="reg_est">${(r.estabilidades || []).map(estRow).join('') || '<div class="mini" style="padding:6px 0">Nenhuma.</div>'}</div>
      <button class="btn ghost sm" data-add-est style="margin-top:8px">+ Adicionar estabilidade</button>

      <!-- BENEFÍCIOS -->
      <div class="section-hd">Benefícios</div>
      <div id="reg_ben">${(r.beneficios || []).map(benRow).join('') || '<div class="mini" style="padding:6px 0">Nenhum.</div>'}</div>
      <button class="btn ghost sm" data-add-ben style="margin-top:8px">+ Adicionar benefício</button>

      <!-- OBSERVAÇÕES -->
      <div class="section-hd">Observações da convenção</div>
      <div class="field"><textarea data-bind="observacoes" placeholder="Cláusulas relevantes que a conferência deve considerar...">${Util.escape(r.observacoes || '')}</textarea></div>

      <div class="divider"></div>
      <label class="chip ${c.aprovada ? 'on' : ''}" id="chk_aprov" data-aprov style="display:inline-block;margin-bottom:12px">${c.aprovada ? '✓ ' : ''}Marcar regras como conferidas/aprovadas</label>
      <button class="btn primary block" data-save-regras>Salvar regras</button>`;
  }

  function pisoRow(p) {
    p = p || {};
    return `<div class="list-row piso-row">
      <input class="p_func" placeholder="Função" value="${Util.escape(p.funcao || '')}" style="flex:2">
      <input class="p_val" placeholder="Piso R$" inputmode="decimal" value="${p.valor ?? ''}" style="flex:1">
      <input class="p_jor" placeholder="Jornada" value="${Util.escape(p.jornada || '')}" style="flex:1">
      <button class="iconbtn" style="background:#f3d3d3;color:#a33" data-rm-row>✕</button>
    </div>`;
  }
  function estRow(e) {
    e = e || {};
    const opts = Schema.tiposEstabilidade.map(t => `<option value="${t.v}" ${e.tipo === t.v ? 'selected' : ''}>${t.l}</option>`).join('');
    return `<div class="list-row est-row">
      <select class="e_tipo" style="flex:2">${opts}</select>
      <input class="e_dur" placeholder="Meses" inputmode="numeric" value="${e.duracaoMeses ?? ''}" style="flex:1">
      <button class="iconbtn" style="background:#f3d3d3;color:#a33" data-rm-row>✕</button>
    </div>`;
  }
  function benRow(b) {
    b = b || {};
    const opts = Schema.tiposBeneficio.map(t => `<option value="${t.v}" ${b.tipo === t.v ? 'selected' : ''}>${t.l}</option>`).join('');
    return `<div class="list-row ben-row">
      <select class="b_tipo" style="flex:2">${opts}</select>
      <input class="b_val" placeholder="Valor R$" inputmode="decimal" value="${b.valor ?? ''}" style="flex:1">
      <button class="iconbtn" style="background:#f3d3d3;color:#a33" data-rm-row>✕</button>
    </div>`;
  }

  /* ============================================================
     EMPRESAS
  ============================================================ */
  async function viewEmpresas() {
    const [emps, convs, sinds] = await Promise.all([DB.list('empresas'), DB.list('convencoes'), DB.list('sindicatos')]);
    const convTit = id => (convs.find(c => c.id === id) || {}).titulo || '(convenção removida)';
    return `
      <div class="view">
        <div class="view-title">Empresas</div>
        <p class="view-sub">Cada empresa é ligada a uma ou mais convenções pelo CNPJ.</p>
        <div class="fab-row"><button class="btn primary" data-new-emp>+ Nova empresa</button></div>
        ${!convs.length ? `<div class="notice">Você ainda não tem convenções. Pode cadastrar a empresa mesmo assim e vincular depois.</div>` : ''}
        ${emps.length ? emps.map(e => `
          <div class="card">
            <div class="row between"><div class="grow"><h3 class="truncate">${Util.escape(e.nome)}</h3>
              <div class="mini">CNPJ: ${Util.formatCNPJ(e.cnpj) || '—'}</div></div></div>
            <div style="margin-top:8px">${(e.convencaoIds || []).length
              ? e.convencaoIds.map(id => `<span class="tag-linha">📄 ${Util.escape(convTit(id))}</span>`).join('')
              : '<span class="badge warn">Sem convenção vinculada</span>'}</div>
            <div class="row" style="margin-top:12px;gap:8px">
              <button class="btn ghost sm" data-edit-emp="${e.id}">Editar</button>
              <button class="btn primary sm" data-conf-emp="${e.id}">Conferir folha</button>
              <button class="btn danger sm" data-del-emp="${e.id}">Excluir</button>
            </div>
          </div>`).join('') : emptyState('🏢', 'Nenhuma empresa', 'Cadastre a primeira empresa cliente.')}
      </div>`;
  }

  function formEmpresa(e, convs) {
    e = e || {};
    const sel = new Set(e.convencaoIds || []);
    return `
      <div class="mh"><h3>${e.id ? 'Editar' : 'Nova'} empresa</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="field"><label>Razão social / nome *</label><input id="e_nome" value="${Util.escape(e.nome || '')}" placeholder="Nome da empresa"></div>
      <div class="field"><label>CNPJ</label><input id="e_cnpj" inputmode="numeric" value="${Util.formatCNPJ(e.cnpj || '')}" placeholder="00.000.000/0000-00"></div>
      <div class="field"><label>Convenções vinculadas</label>
        ${convs.length ? `<div class="chips" id="e_convs">${convs.filter(c => !c.arquivada || sel.has(c.id)).map(c => `<span class="chip ${sel.has(c.id) ? 'on' : ''}" data-conv="${c.id}">${c.tipo === 'clt' ? '⚖️ ' : '📄 '}${Util.escape(c.titulo)}${c.arquivada ? ' (arquivada)' : ''}</span>`).join('')}</div>`
          : '<div class="mini">Nenhuma convenção cadastrada ainda.</div>'}
        <div class="hint">Toque para vincular <b>uma ou mais</b>. Uma empresa pode seguir 2 convenções, ou o regime CLT quando não segue nenhuma.</div>
      </div>
      <button class="btn primary block" data-save-emp="${e.id || ''}">Salvar empresa</button>`;
  }

  /* ============================================================
     CONFERÊNCIA
  ============================================================ */
  async function viewConferencia(preEmpId) {
    const [emps, convs] = await Promise.all([DB.list('empresas'), DB.list('convencoes')]);
    const empOpts = ['<option value="">Selecione a empresa...</option>']
      .concat(emps.map(e => `<option value="${e.id}" ${preEmpId === e.id ? 'selected' : ''}>${Util.escape(e.nome)}</option>`)).join('');

    return `
      <div class="view">
        <div class="view-title">Conferência de folha</div>
        <p class="view-sub">A conferência usa as regras da convenção vinculada à empresa.</p>

        <div class="card">
          <div class="field"><label>Empresa</label><select id="cf_emp">${empOpts}</select></div>
          <div id="cf_vinculo"></div>
        </div>

        <div class="card">
          <div class="field"><label>Folha em PDF</label>
            <div class="drop" id="cf_drop"><b>Toque para anexar</b> a folha de pagamento (PDF)</div>
            <input id="cf_pdf" type="file" accept="application/pdf" hidden>
            <button class="btn gold block sm" id="cf_absorver" disabled style="margin-top:8px">🤖 Ler folha com IA e auditar</button>
            <div class="mini" id="cf_ia_status" style="margin-top:6px"></div>
            <div class="notice" style="margin-top:8px">💡 Quer <b>de graça</b>? O <a data-go="conversor" style="cursor:pointer;color:var(--navy);font-weight:700">Conversor PDF→JSON ›</a> lê a folha aqui no aparelho (sem IA, ideal para o Extrato Mensal).</div>
          </div>
          <div class="field"><label>Lançamentos variáveis do mês</label>
            <textarea id="cf_var" placeholder="Ex.: João - 10h extras 50%; Maria - 2 faltas; Pedro afastado desde 05/07 (INSS)..."></textarea>
            <div class="hint">Digite hora extra, faltas, afastamentos e o que mais tiver de variável.</div>
          </div>
          <div class="fab-row">
            <button class="btn primary grow" id="cf_run">Ver plano de conferência</button>
            <button class="btn gold grow" id="cf_import">⤵ Importar folha (JSON) e auditar</button>
          </div>
          <div class="hint">A folha em PDF é lida pela IA no backend e vira este JSON estruturado, que roda no motor de auditoria.</div>
        </div>

        <div id="cf_result"></div>
      </div>`;
  }

  async function renderVinculo(empId) {
    const box = $('#cf_vinculo');
    if (!empId) { box.innerHTML = ''; return; }
    const emp = await DB.get('empresas', empId);
    const convs = await DB.list('convencoes');
    const vinc = (emp.convencaoIds || []).map(id => convs.find(c => c.id === id)).filter(Boolean);
    if (!vinc.length) {
      box.innerHTML = `<div class="notice" style="margin-top:6px">⚠️ Esta empresa não tem convenção vinculada. <a data-go="empresas" style="cursor:pointer;color:var(--navy);font-weight:700">Vincular agora ›</a></div>`;
      return;
    }
    box.innerHTML = vinc.map(c => {
      const st = Util.statusVigencia(c.vigenciaFim);
      return `<div class="notice" style="margin-top:6px">
        📄 <b>${Util.escape(c.titulo)}</b> — <span class="badge ${st.cls}">${st.txt}</span>
        ${c.aprovada ? '' : '<br><span style="color:var(--warn)">Regras ainda não aprovadas.</span>'}</div>`;
    }).join('');
  }

  async function rodarConferencia(empId, variaveis) {
    const result = $('#cf_result');
    if (!empId) { toast('Selecione a empresa', 'err'); return; }
    const emp = await DB.get('empresas', empId);
    const convs = await DB.list('convencoes');
    const vinc = (emp.convencaoIds || []).map(id => convs.find(c => c.id === id)).filter(Boolean);
    if (!vinc.length) { toast('Empresa sem convenção vinculada', 'err'); return; }

    // Mostra o "plano de conferência" derivado das regras — prova que o fluxo
    // empresa → convenção → regras está ligado. O motor completo (ler o PDF e
    // apontar erros por funcionário) entra quando você mandar uma folha real.
    const checks = [];
    vinc.forEach(c => {
      const r = c.regras || Schema.emptyRegras();
      (r.pisos || []).forEach(p => checks.push(`Piso de <b>${Util.escape(p.funcao)}</b>: salário ≥ ${Util.formatBRL(Util.parseNum(p.valor))}`));
      if (r.tempoServico && r.tempoServico.aplica) checks.push(`Triênio/tempo de serviço: <b>${r.tempoServico.percentual || '?'}%</b> por período`);
      if (r.produtividade && r.produtividade.aplica) checks.push('Produtividade prevista na convenção');
      if (r.adiantamento && r.adiantamento.obrigatorio) checks.push(`Adiantamento obrigatório de <b>${r.adiantamento.percentual}%</b> até dia ${r.adiantamento.diaLimite}`);
      (r.estabilidades || []).forEach(e => checks.push(`Estabilidade: ${Util.escape((Schema.tiposEstabilidade.find(t => t.v === e.tipo) || {}).l || e.tipo)}`));
      checks.push('Encargos: conferir incidência de INSS/FGTS nas rubricas');
    });

    result.innerHTML = `
      <div class="section-hd">Plano de conferência (a partir da convenção)</div>
      <div class="card">
        <p class="mini" style="margin-top:0">Estas são as verificações que serão aplicadas automaticamente à folha desta empresa:</p>
        ${checks.map(c => `<div class="list-row">✅ <span>${c}</span></div>`).join('')}
      </div>
      <div class="notice gold">
        🚧 <b>Próximo passo:</b> ligar a leitura automática do PDF da folha + o motor de auditoria (IA).
        Aí cada item acima vira <b>erro</b> ou <b>alerta</b> por funcionário, com o relatório em PDF.
        Pra isso eu preciso de <b>uma folha real de exemplo</b> (pode tarjar nomes/CPF).
      </div>
      ${variaveis && variaveis.trim() ? `<div class="notice" style="margin-top:10px">📝 Lançamentos anotados:<br>${Util.escape(variaveis).replace(/\n/g, '<br>')}</div>` : ''}`;
    result.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ============================================================
     HISTÓRICO / DÚVIDAS (esqueleto do MVP)
  ============================================================ */
  const compKey = c => { const m = /^(\d{1,2})\/(\d{4})$/.exec((c || '').trim()); return m ? m[2] + m[1].padStart(2, '0') : '000000'; };
  async function viewHistorico() {
    const folhas = await DB.list('folhas');
    if (!folhas.length) return `<div class="view">
      <div class="view-title">Histórico de folhas</div>
      <p class="view-sub">Comparativo mês a mês entre as folhas conferidas.</p>
      ${emptyState('📊', 'Ainda sem folhas conferidas', 'Quando você conferir uma folha na aba Conferência, ela fica guardada aqui — e dá para re-auditar de graça sempre que o motor for atualizado.')}
    </div>`;
    const [emps, convs] = await Promise.all([DB.list('empresas'), DB.list('convencoes')]);
    const nomeEmp = id => { const e = emps.find(x => x.id === id); return e ? e.nome : '(empresa removida)'; };
    const porEmp = {};
    folhas.forEach(f => { (porEmp[f.empresaId] = porEmp[f.empresaId] || []).push(f); });
    const cards = Object.keys(porEmp).map(empId => {
      const lista = porEmp[empId].slice().sort((a, b) => compKey(b.competencia).localeCompare(compKey(a.competencia)));
      const rows = lista.map(f => `
        <div class="list-row">
          <span><b>${Util.escape(f.competencia || '—')}</b><br>
            <span class="mini">${(f.funcionarios || []).length} func. · conferida ${Util.formatDateBR((f.auditadaEm || '').slice(0, 10))}</span></span>
          <span class="grow"></span>
          <button class="btn sm" data-reaudit="${f.id}">🔁 Re-auditar</button>
          <button class="iconbtn" data-del-folha="${f.id}" title="Excluir">🗑</button>
        </div>`).join('');
      return `<div class="card"><div class="list-row" style="border-bottom:1px solid var(--line)"><b>${Util.escape(nomeEmp(empId))}</b></div>${rows}</div>`;
    }).join('');
    return `<div class="view">
      <div class="view-title">Histórico de folhas</div>
      <p class="view-sub">Folhas já conferidas. <b>Re-auditar</b> roda o motor atualizado sem gastar leitura de PDF de novo.</p>
      ${cards}
      <div class="notice">🔒 As folhas ficam só neste aparelho (contêm CPF). Nada vai para o GitHub nem para a nuvem.</div>
    </div>`;
  }
  async function reauditarFolha(folhaId) {
    const folha = await DB.get('folhas', folhaId);
    if (!folha) return toast('Folha não encontrada', 'err');
    const emp = folha.empresaId ? await DB.get('empresas', folha.empresaId) : null;
    const convs = await DB.list('convencoes');
    const vinc = emp ? (emp.convencaoIds || []).map(id => convs.find(c => c.id === id)).filter(Boolean) : [];
    if (!vinc.length) return toast('Empresa sem convenção vinculada — vincule na aba Empresas', 'warn');
    const conv = vinc[0];
    const cfg = await DB.getConfig();
    const rel = Audit.run(folha, conv, cfg);
    const html = relatorioHtml(rel);
    const body = openModal(`
      <div class="mh"><h3>Re-auditoria — ${Util.escape(folha.competencia || '')}</h3><button class="iconbtn" data-close>✕</button></div>
      ${vinc.length > 1 ? '<div class="notice" style="margin-bottom:10px">Empresa com mais de uma convenção — auditei pela primeira.</div>' : ''}
      <div class="fab-row no-print"><button class="btn primary" id="rel_pdf2">🖨️ Salvar / Imprimir PDF</button></div>
      ${html}`);
    const b = body.querySelector('#rel_pdf2');
    if (b) b.addEventListener('click', () => salvarPdf(html));
  }
  async function viewDuvidas() {
    const ativas = (await DB.list('convencoes')).filter(c => !c.arquivada);
    if (!ativas.length) return `<div class="view">
      <div class="view-title">Dúvidas da convenção</div>
      <p class="view-sub">Pergunte o que o funcionário tem direito, com base na convenção.</p>
      ${emptyState('💬', 'Nenhuma convenção cadastrada', 'Cadastre ou importe uma convenção primeiro. Aí você pode perguntar sobre os direitos dela aqui.')}
    </div>`;
    const opts = ativas.map(c => `<option value="${c.id}">${Util.escape(c.titulo || 'Convenção')}</option>`).join('');
    return `<div class="view">
      <div class="view-title">Dúvidas da convenção</div>
      <p class="view-sub">Pergunte o que o funcionário tem direito, com base na convenção.</p>
      <div class="card">
        <div class="field"><label>Convenção</label>
          <select id="dv_conv">${opts}</select></div>
        <div class="field"><label>Sua pergunta</label>
          <textarea id="dv_q" placeholder="Ex.: O caixa com 4 anos de casa tem direito a quantos triênios e a quebra de caixa?"></textarea></div>
        <button class="btn primary block" id="dv_ask">Perguntar</button>
        <div id="dv_status" class="mini" style="margin-top:8px"></div>
      </div>
      <div id="dv_ans"></div>
      <div class="notice">💬 A resposta usa a IA (Claude) com base nas <b>regras já cadastradas</b> da convenção. Precisa da chave da API configurada (menu ☰) e do app aberto pelo site (https) — não funciona abrindo o arquivo direto.</div>
    </div>`;
  }
  function wireDuvidas() {
    const btn = $('#dv_ask'); if (!btn) return;
    btn.addEventListener('click', async () => {
      const convId = $('#dv_conv') && $('#dv_conv').value;
      const q = ($('#dv_q').value || '').trim();
      const status = $('#dv_status'), ans = $('#dv_ans');
      if (!q) return toast('Escreva a pergunta', 'warn');
      if (!convId) return toast('Escolha a convenção', 'warn');
      const cfg = await DB.getConfig();
      if (!cfg.apiKey) { toast('Configure a chave da API em Configurações (menu ☰)', 'err'); return; }
      const conv = await DB.get('convencoes', convId);
      btn.disabled = true; btn.textContent = '🤖 Consultando...';
      status.textContent = 'A IA está lendo as regras da convenção...';
      ans.innerHTML = '';
      try {
        const resp = await IA.perguntarRegras(conv, q, cfg);
        ans.innerHTML = `<div class="card"><div class="section-hd">Resposta</div>
          <div style="white-space:pre-wrap;line-height:1.5">${Util.escape(resp)}</div>
          <div class="mini" style="margin-top:10px">⚖️ Confira sempre no texto oficial da convenção — a resposta é um apoio, não vale como parecer jurídico.</div></div>`;
        status.textContent = '';
      } catch (e) {
        status.innerHTML = '<span style="color:var(--err)">Erro: ' + Util.escape(e.message) + '</span>';
      }
      btn.disabled = false; btn.textContent = 'Perguntar';
    });
  }

  /* ============================================================
     CONVERSOR PDF → JSON (grátis, no aparelho, via pdf.js)
  ============================================================ */
  let _convTexto = '';
  async function viewConversor() {
    const ok = typeof PDFConvert !== 'undefined' && typeof pdfjsLib !== 'undefined';
    return `<div class="view">
      <div class="view-title">Conversor de folha (PDF → JSON)</div>
      <p class="view-sub">Grátis e sem IA: o PDF é lido aqui no aparelho, nada é enviado pra internet.</p>
      <div class="card">
        <div class="field"><label>Folha em PDF</label>
          <div class="drop" id="cv_drop"><b>Toque para anexar</b> a folha (PDF com texto — não escaneado)</div>
          <input id="cv_pdf" type="file" accept="application/pdf" hidden>
          <div class="mini" id="cv_status" style="margin-top:8px"></div>
        </div>
        <div class="hint">Feito para o <b>Extrato Mensal</b> do sistema. Em PDF escaneado (imagem) o texto não sai — nesse caso use a leitura por IA na Conferência.</div>
      </div>
      <div id="cv_out"></div>
      ${ok ? '' : '<div class="notice">O leitor de PDF (pdf.js) não carregou nesta versão. Abra o app pelo site (GitHub Pages) para usar o conversor grátis.</div>'}
    </div>`;
  }
  function wireConversor() {
    const drop = $('#cv_drop'); if (!drop) return;
    const inp = $('#cv_pdf');
    drop.addEventListener('click', () => inp.click());
    inp.addEventListener('change', e => { const f = e.target.files[0]; if (f) converterPDF(f); });
  }
  async function converterPDF(file) {
    const status = $('#cv_status'), drop = $('#cv_drop');
    if (typeof PDFConvert === 'undefined') { toast('Leitor de PDF indisponível — recarregue a página (Ctrl+Shift+R)', 'err'); return; }
    drop.classList.add('has'); drop.innerHTML = '📎 ' + Util.escape(file.name);
    $('#cv_out').innerHTML = '';
    status.textContent = 'Lendo o PDF no aparelho...';
    try {
      const buf = await file.arrayBuffer();
      const txt = await PDFConvert.extrairTexto(buf, (p, n) => { status.textContent = `Lendo página ${p}/${n}...`; });
      const r = PDFConvert.parseFolha(txt);
      _convTexto = r.texto;
      status.textContent = '';
      renderConversao(r);
    } catch (e) {
      status.innerHTML = '<span style="color:var(--err)">Erro ao ler o PDF: ' + Util.escape(e.message) + '</span>';
    }
  }
  function renderConversao(r) {
    const f = r.folha;
    const json = JSON.stringify(f, null, 2);
    const alertasHtml = r.alertas.length
      ? `<div class="notice gold" style="margin-top:8px">⚠️ Confira:<br>${r.alertas.map(Util.escape).join('<br>')}</div>`
      : '<div class="notice" style="margin-top:8px">✅ Sem pendências detectadas. Ainda assim, confira o JSON antes de auditar.</div>';
    $('#cv_out').innerHTML = `
      <div class="card">
        <div class="section-hd">Resultado da conversão</div>
        <div class="kv"><span>Empresa: <b>${Util.escape(f.empresaNome || '—')}</b></span><span>CNPJ: <b>${Util.formatCNPJ(f.empresaCnpj || '')}</b></span></div>
        <div class="kv"><span>Competência: <b>${Util.escape(f.competencia || '—')}</b></span><span>Funcionários: <b>${f.funcionarios.length}</b></span></div>
        <div class="kv"><span>Formato: <b>${Util.escape(r.formato)}</b></span></div>
        ${alertasHtml}
        <div class="fab-row" style="flex-wrap:wrap;margin-top:10px">
          <button class="btn primary" id="cv_baixar">⤓ Baixar JSON</button>
          <button class="btn" id="cv_copiar">⧉ Copiar</button>
          <button class="btn gold" id="cv_auditar">✅ Auditar esta folha</button>
          <button class="btn ghost" id="cv_vertexto">📄 Ver texto extraído</button>
        </div>
        <div class="field" style="margin-top:10px"><label>JSON (edite se precisar antes de auditar)</label>
          <textarea id="cv_json" spellcheck="false" style="min-height:260px;font-family:ui-monospace,monospace;font-size:12px">${Util.escape(json)}</textarea></div>
        <div id="cv_texto" style="display:none"></div>
      </div>`;
    $('#cv_baixar').addEventListener('click', () => {
      const nome = `folha-${(f.empresaNome || 'empresa').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)}-${(f.competencia || '').replace('/', '-')}.json`;
      baixarArquivo(nome, $('#cv_json').value, 'application/json');
      toast('JSON baixado ✓', 'ok');
    });
    $('#cv_copiar').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#cv_json').value); toast('JSON copiado ✓', 'ok'); }
      catch (e) { toast('Não consegui copiar — selecione o texto e copie manualmente', 'warn'); }
    });
    $('#cv_auditar').addEventListener('click', async () => {
      let folha; try { folha = JSON.parse($('#cv_json').value); } catch (e) { return toast('JSON inválido: ' + e.message, 'err'); }
      state.view = 'conferencia'; await render(); window.scrollTo(0, 0);
      await importFolha(folha);
    });
    $('#cv_vertexto').addEventListener('click', () => {
      const box = $('#cv_texto');
      if (box.style.display === 'none') {
        box.style.display = 'block';
        box.innerHTML = `<div class="field" style="margin-top:10px"><label>Texto extraído do PDF (conferência)</label>
          <textarea readonly spellcheck="false" style="min-height:200px;font-family:ui-monospace,monospace;font-size:11px">${Util.escape(_convTexto || '')}</textarea></div>`;
      } else { box.style.display = 'none'; box.innerHTML = ''; }
    });
  }
  function baixarArquivo(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo || 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nome; a.click();
    URL.revokeObjectURL(url);
  }

  /* ------------- helpers ------------- */
  function emptyState(em, t, p) {
    return `<div class="empty"><div class="em">${em}</div><h3 style="margin:10px 0 0">${t}</h3><p>${p}</p></div>`;
  }
  function pathVal(obj, path) { return path.split('.').reduce((o, k) => (o || {})[k], obj); }
  function pathSet(obj, path, val) {
    const ks = path.split('.'); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val;
  }

  /* ------------- render dispatcher ------------- */
  const VIEWS = {
    painel: viewPainel, sindicatos: viewSindicatos, convencoes: viewConvencoes,
    empresas: viewEmpresas, conferencia: viewConferencia, conversor: viewConversor,
    historico: viewHistorico, duvidas: viewDuvidas,
  };
  async function render(arg) {
    renderNav();
    app.innerHTML = '<div class="view"><div class="empty"><div class="em">⏳</div></div></div>';
    app.innerHTML = await VIEWS[state.view](arg);
    if (state.view === 'conferencia') wireConferencia();
    if (state.view === 'conversor') wireConversor();
    if (state.view === 'duvidas') wireDuvidas();
  }

  function wireConferencia() {
    const emp = $('#cf_emp'); if (!emp) return;
    if (emp.value) renderVinculo(emp.value);
    emp.addEventListener('change', () => renderVinculo(emp.value));
    $('#cf_drop').addEventListener('click', () => $('#cf_pdf').click());
    $('#cf_pdf').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      $('#cf_drop').classList.add('has'); $('#cf_drop').innerHTML = '📎 ' + Util.escape(f.name);
      const b = $('#cf_absorver'); if (b) b.disabled = false;
    });
    $('#cf_run').addEventListener('click', () => rodarConferencia($('#cf_emp').value, $('#cf_var').value));
    $('#cf_import').addEventListener('click', importFolhaPick);
    const abs = $('#cf_absorver');
    if (abs) abs.addEventListener('click', () => absorverFolhaPDF($('#cf_pdf').files[0]));
  }
  async function absorverFolhaPDF(file) {
    const btn = $('#cf_absorver'), status = $('#cf_ia_status');
    if (!file) return;
    const cfg = await DB.getConfig();
    if (!cfg.apiKey) { toast('Configure a chave da API em Configurações (menu ☰)', 'err'); return; }
    btn.disabled = true; btn.textContent = '🤖 Lendo a folha... aguarde';
    status.textContent = 'A IA está lendo a folha. Pode levar de 30s a 1,5 min se tiver muitos funcionários.';
    try {
      const b64 = await fileToBase64(file);
      const folha = await IA.absorverFolha(b64, cfg);
      btn.textContent = '✅ Lida — auditando';
      status.innerHTML = '✅ Folha lida. Rodando a conferência...';
      await importFolha(folha);
      btn.textContent = '🤖 Ler folha com IA e auditar'; btn.disabled = false;
    } catch (e) {
      status.innerHTML = '<span style="color:var(--err)">Erro: ' + Util.escape(e.message) + '</span>';
      btn.disabled = false; btn.textContent = '🤖 Tentar de novo';
    }
  }

  /* ---- importar folha estruturada (JSON) e auditar ---- */
  let _pendingFolha = null;
  function importFolhaPick() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { await importFolha(JSON.parse(await f.text())); }
      catch (e) { toast('Folha inválida: ' + e.message, 'err'); }
    };
    inp.click();
  }
  async function importFolha(folha) {
    if (!folha || !folha.funcionarios) return toast('JSON sem "funcionarios"', 'err');
    const cnpj = (folha.empresaCnpj || '').replace(/\D/g, '');
    let emp = cnpj ? (await DB.where('empresas', e => (e.cnpj || '') === cnpj))[0] : null;
    const selId = $('#cf_emp') && $('#cf_emp').value;
    if (!emp && selId) emp = await DB.get('empresas', selId);
    if (!emp) { _pendingFolha = folha; return abrirCadastroEmpresaDaFolha(folha, cnpj, null); }
    const convs = await DB.list('convencoes');
    const vinc = (emp.convencaoIds || []).map(id => convs.find(c => c.id === id)).filter(Boolean);
    if (!vinc.length) { _pendingFolha = folha; toast('Marque a convenção desta empresa para auditar', 'warn'); return abrirCadastroEmpresaDaFolha(folha, cnpj, emp); }
    const conv = vinc[0];
    const cfg = await DB.getConfig();
    const rel = Audit.run(folha, conv, cfg);
    await DB.add('folhas', Object.assign({ empresaId: emp.id, auditadaEm: new Date().toISOString() }, folha));
    renderRelatorio(rel, folha, conv, emp, vinc.length);
  }

  async function abrirCadastroEmpresaDaFolha(folha, cnpj, empExistente) {
    const convs = await DB.list('convencoes');
    const e = empExistente || { nome: folha.empresaNome || '', cnpj };
    const body = openModal(formEmpresa(e, convs));
    const nota = empExistente
      ? '🔗 Esta empresa está cadastrada, mas <b>sem convenção</b>. Marque a(s) convenção(ões) e salve para eu auditar a folha.'
      : '🆕 A empresa da folha <b>não está cadastrada</b>. Já puxei a razão social e o CNPJ — só marque a(s) convenção(ões) e salve.';
    body.insertAdjacentHTML('afterbegin', `<div class="notice gold" style="margin-bottom:12px">${nota}</div>`);
    if (!convs.length) body.insertAdjacentHTML('beforeend', '<div class="notice" style="margin-top:10px">Você ainda não tem convenções. Cadastre/importe a convenção desta categoria primeiro (ou crie o regime CLT).</div>');
  }

  function relatorioHtml(rel) {
    const r = rel.resumo;
    const grp = (arr, cls, icon, titulo) => arr.length ? `
      <div class="result-group ${cls}">
        <div class="gh">${icon} ${titulo} (${arr.length})</div>
        ${arr.map(it => `<div class="item"><b>${Util.escape(it.titulo)}</b>${(it.valor != null && !isNaN(it.valor) && Math.abs(it.valor) > 0.001) ? ` <span class="badge ${cls}">${Util.formatBRL(Math.abs(it.valor))}</span>` : ''}
          <small>${Util.escape(it.detalhe)}</small>
          ${it.funcs.length ? `<small>👤 ${it.funcs.map(Util.escape).join(', ')}</small>` : ''}</div>`).join('')}
      </div>` : '';
    return `
      <div id="rel">
        <div class="card">
          <h3 style="margin:0 0 6px">Relatório de conferência de folha</h3>
          <div class="kv"><span>Empresa: <b>${Util.escape(r.empresa || '')}</b></span><span>CNPJ: <b>${Util.formatCNPJ(r.cnpj || '')}</b></span></div>
          <div class="kv"><span>Competência: <b>${Util.escape(r.competencia || '')}</b></span><span>Funcionários: <b>${r.nFunc}</b></span></div>
          <div class="kv"><span>Convenção: <b>${Util.escape(r.convencao || '')}</b></span></div>
          <div class="row" style="margin-top:10px;gap:8px;flex-wrap:wrap">
            <span class="badge err">${rel.erros.length} erro(s)</span>
            <span class="badge warn">${rel.alertas.length} alerta(s)</span>
            <span class="badge ok">${rel.conformes.length} conforme(s)</span>
          </div>
        </div>
        ${grp(rel.erros, 'err', '⛔', 'ERROS — precisa alterar')}
        ${grp(rel.alertas, 'warn', '⚠️', 'ALERTAS — verificar')}
        ${rel.conformes.length ? `<details class="card"><summary style="cursor:pointer;font-weight:700">✅ Conformes (${rel.conformes.length}) — o que está certo</summary>
          <div style="margin-top:8px">${rel.conformes.map(it => `<div class="list-row">✅ <span><b>${Util.escape(it.titulo)}</b><br><span class="mini">${Util.escape(it.detalhe)}</span></span></div>`).join('')}</div></details>` : ''}
        <div class="mini" style="text-align:center;margin-top:14px">Folha Certa · Totali Contabilidade · gerado em ${Util.formatDateBR(new Date().toISOString().slice(0, 10))}</div>
      </div>`;
  }
  function renderRelatorio(rel, folha, conv, emp, nConv) {
    const html = relatorioHtml(rel);
    const box = $('#cf_result');
    box.innerHTML = `<div class="section-hd">Resultado da conferência</div>
      ${nConv > 1 ? '<div class="notice" style="margin-bottom:10px">Esta empresa tem mais de uma convenção. Auditei pela primeira; o mapeamento por função entre convenções entra numa próxima etapa.</div>' : ''}
      <div class="fab-row no-print"><button class="btn primary" id="rel_pdf">🖨️ Salvar / Imprimir PDF</button></div>
      ${html}`;
    const btn = $('#rel_pdf');
    if (btn) btn.addEventListener('click', () => salvarPdf(html));
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function salvarPdf(html) {
    const area = document.createElement('div');
    area.id = 'printArea';
    area.innerHTML = html;
    document.body.appendChild(area);
    window.print();
    setTimeout(() => area.remove(), 500);
  }

  /* ---- dados de demonstração (fictícios, sem CPF real) ---- */
  async function seedDemo() {
    const sind = await DB.add('sindicatos', { nome: 'SINDHOTRE - Hotelaria e Restaurantes/SE', cnpj: '06084597000186', categoria: 'Hotelaria e alimentação' });
    const regras = Object.assign(Schema.emptyRegras(), {
      pisos: [{ funcao: 'Piso geral da categoria', valor: 1670, jornada: '44h semanais' }],
      tempoServico: { aplica: false, tipo: 'trienio' },
      adicionais: { horaExtra: 50, horaExtra100: 100, noturno: 20, insalubridade: '', periculosidade: '' },
      estabilidades: [{ tipo: 'pre_aposentadoria', descricao: '12 meses antes do direito, mín. 5 anos na empresa', duracaoMeses: 12 }],
      beneficios: [
        { tipo: 'plano_saude', valor: 210.78, condicoes: 'empresa 50% / empregado 50%' },
        { tipo: 'plano_odontologico', valor: 9.50, condicoes: 'pago pela empresa' },
        { tipo: 'auxilio_assistencial', valor: 14.90, condicoes: 'pago pela empresa' },
      ],
      contribuicoes: [
        { tipo: 'assistencial', percentual: 1.5, desconto: 'empregado' },
        { tipo: 'negocial', valor: 20, desconto: 'empresa', obs: 'R$ 20/empregado ao SEHASE em setembro' },
      ],
      observacoes: 'Quebra de caixa 6% para funções de caixa. HE 50% (100% em feriados). Reflexos do noturno em DSR/férias/13º.',
    });
    const conv = await DB.add('convencoes', { tipo: 'convencao', sindicatoId: sind.id, titulo: 'CCT 2026/2028 SINDHOTRE (demonstração)', numeroRegistro: 'SE000084/2026', abrangencia: 'Aracaju/SE', uf: 'SE', dataBaseMes: 'Maio', vigenciaInicio: '2026-05-01', vigenciaFim: '2028-04-30', aprovada: true, regras });
    const emp = await DB.add('empresas', { nome: 'Restaurante Sabor Demo Ltda', cnpj: '11222333000181', convencaoIds: [conv.id] });
    const baseRub = [
      { descricao: 'HORAS NORMAIS', valor: 1322.97, tipo: 'P' }, { descricao: 'HORAS NOTURNAS', valor: 347.03, tipo: 'P' },
      { descricao: 'REFLEXO HORAS ADIC. NOTURNO', valor: 10.68, tipo: 'P' }, { descricao: 'ADICIONAL NOTURNO', valor: 69.41, tipo: 'P' },
      { descricao: 'I.N.S.S.', valor: 133.18, tipo: 'D' }, { descricao: 'CONTRIBUICAO SINDICAL', valor: 16.70, tipo: 'D' },
    ];
    const mkF = (nome, cargo, adm) => ({ nome, cargo, admissao: adm, situacao: 'Trabalhando', salario: 1670, horasMes: 220, rubricas: baseRub, proventos: 1750.09, descontos: 149.88, liquido: 1600.21, baseINSS: 1750.09, baseFGTS: 1750.09, valorFGTS: 140 });
    const folha = {
      empresaNome: 'Restaurante Sabor Demo Ltda', empresaCnpj: '11222333000181', competencia: '06/2026', emitidoEm: '2026-06-23', regime: 'simples',
      totais: { proventos: 8750.45, descontos: 749.40, liquido: 8001.05, baseFGTS: 8750.45, valorFGTS: 700, inssSegurados: 665.90, inssEmpresa: 0 },
      funcionarios: [
        mkF('João da Silva', 'GARÇON', '2025-09-01'),
        mkF('Maria Souza', 'GARÇONETE', '2025-09-01'),
        mkF('Pedro Santos', 'CHURRASQUEIRO', '2025-10-24'),
        mkF('Carlos Lima', 'GARÇON', '2025-08-15'),
        mkF('Ana Oliveira', 'ATENDENTE DE BALCÃO', '2026-05-25'),
      ],
    };
    toast('Demonstração carregada ✓', 'ok');
    state.view = 'conferencia'; renderNav();
    app.innerHTML = await viewConferencia(emp.id); wireConferencia(); window.scrollTo(0, 0);
    await importFolha(folha);
  }

  /* ============================================================
     EVENTOS (delegação)
  ============================================================ */
  document.addEventListener('click', async (ev) => {
    const t = ev.target.closest('[data-go],[data-close],[data-open-conv],[data-new-sind],[data-edit-sind],[data-del-sind],[data-save-sind],[data-new-conv],[data-import-conv],[data-edit-conv],[data-del-conv],[data-save-conv],[data-regras],[data-add-piso],[data-add-est],[data-add-ben],[data-rm-row],[data-save-regras],[data-aprov],[data-new-emp],[data-edit-emp],[data-del-emp],[data-save-emp],[data-conf-emp],[data-conv],[data-toggle],[data-export],[data-new-clt],[data-config],[data-save-config],[data-mediador],[data-mediador-open],[data-mediador-update],[data-seed-demo],[data-reaudit],[data-del-folha]');
    if (!t) return;

    // navegação
    if (t.dataset.go) return go(t.dataset.go);
    if (t.hasAttribute('data-seed-demo')) return seedDemo();
    if (t.dataset.reaudit) return reauditarFolha(t.dataset.reaudit);
    if (t.dataset.delFolha) {
      if (confirm('Excluir esta folha do histórico? Ela contém dados do cliente e não dá para desfazer.')) { await DB.remove('folhas', t.dataset.delFolha); toast('Folha excluída'); render(); }
      return;
    }
    if (t.hasAttribute('data-export')) return exportBackup();
    if (t.hasAttribute('data-close')) return closeModal();
    if (t.dataset.openConv) { go('convencoes'); return; }

    /* ---- Sindicatos ---- */
    if (t.hasAttribute('data-new-sind')) return void openModal(formSindicato());
    if (t.dataset.editSind) return void openModal(formSindicato(await DB.get('sindicatos', t.dataset.editSind)));
    if (t.dataset.delSind) {
      if (confirm('Excluir este sindicato?')) { await DB.remove('sindicatos', t.dataset.delSind); toast('Sindicato excluído'); render(); }
      return;
    }
    if (t.hasAttribute('data-save-sind')) {
      const nome = $('#f_nome').value.trim();
      if (!nome) return toast('Informe o nome', 'err');
      const cnpj = $('#f_cnpj').value.replace(/\D/g, '');
      if (cnpj && !Util.validaCNPJ(cnpj)) return toast('CNPJ inválido', 'err');
      const data = { nome, cnpj, categoria: $('#f_cat').value.trim() };
      if (t.dataset.saveSind) await DB.update('sindicatos', t.dataset.saveSind, data);
      else await DB.add('sindicatos', data);
      closeModal(); toast('Salvo', 'ok'); render();
      return;
    }

    /* ---- Convenções ---- */
    if (t.hasAttribute('data-new-conv')) {
      const sinds = await DB.list('sindicatos');
      return void wireConvForm(openModal(formConvencao(null, sinds)), null);
    }
    if (t.dataset.editConv) {
      const [c, sinds] = await Promise.all([DB.get('convencoes', t.dataset.editConv), DB.list('sindicatos')]);
      return void wireConvForm(openModal(formConvencao(c, sinds)), c);
    }
    if (t.dataset.delConv) {
      if (confirm('Excluir esta convenção?')) { await DB.remove('convencoes', t.dataset.delConv); toast('Convenção excluída'); render(); }
      return;
    }
    if (t.hasAttribute('data-save-conv')) return saveConv(t.dataset.saveConv);
    if (t.hasAttribute('data-import-conv')) return importConvPick();
    if (t.hasAttribute('data-new-clt')) return createCltRegime();
    if (t.hasAttribute('data-config')) return openConfig();
    if (t.hasAttribute('data-save-config')) return saveConfig();
    if (t.hasAttribute('data-mediador-open')) { const w = window.open(MEDIADOR_URL, '_blank', 'noopener'); if (!w) toast('Abra no navegador: mediador.trabalho.gov.br', 'warn'); return; }
    if (t.dataset.mediadorUpdate) return atualizarConvencaoDoMediador(t.dataset.mediadorUpdate);
    if (t.dataset.mediador) return openMediadorModal(t.dataset.mediador);
    if (t.dataset.regras) return editorRegras(t.dataset.regras);

    /* ---- Editor de regras ---- */
    if (t.hasAttribute('data-add-piso')) { $('#reg_pisos').insertAdjacentHTML('beforeend', pisoRow()); cleanEmptyMini('#reg_pisos'); return; }
    if (t.hasAttribute('data-add-est')) { $('#reg_est').insertAdjacentHTML('beforeend', estRow()); cleanEmptyMini('#reg_est'); return; }
    if (t.hasAttribute('data-add-ben')) { $('#reg_ben').insertAdjacentHTML('beforeend', benRow()); cleanEmptyMini('#reg_ben'); return; }
    if (t.hasAttribute('data-rm-row')) { t.closest('.list-row').remove(); return; }
    if (t.hasAttribute('data-toggle')) {
      const path = t.dataset.toggle; const cur = pathVal(_regrasCache, path);
      pathSet(_regrasCache, path, !cur);
      t.classList.toggle('on', !cur); t.textContent = (!cur ? '✓ ' : '') + t.textContent.replace('✓ ', '');
      return;
    }
    if (t.hasAttribute('data-aprov')) { t.classList.toggle('on'); t.dataset.checked = t.classList.contains('on') ? '1' : ''; t.textContent = (t.classList.contains('on') ? '✓ ' : '') + 'Marcar regras como conferidas/aprovadas'; return; }
    if (t.hasAttribute('data-save-regras')) return saveRegras();

    /* ---- Empresas ---- */
    if (t.hasAttribute('data-new-emp')) { const convs = await DB.list('convencoes'); return void openModal(formEmpresa(null, convs)); }
    if (t.dataset.editEmp) { const [e, convs] = await Promise.all([DB.get('empresas', t.dataset.editEmp), DB.list('convencoes')]); return void openModal(formEmpresa(e, convs)); }
    if (t.dataset.delEmp) { if (confirm('Excluir esta empresa?')) { await DB.remove('empresas', t.dataset.delEmp); toast('Empresa excluída'); render(); } return; }
    if (t.dataset.confEmp) { state.view = 'conferencia'; renderNav(); app.innerHTML = await viewConferencia(t.dataset.confEmp); wireConferencia(); window.scrollTo(0, 0); return; }
    if (t.dataset.conv) { t.classList.toggle('on'); return; }
    if (t.hasAttribute('data-save-emp')) {
      const nome = $('#e_nome').value.trim();
      if (!nome) return toast('Informe o nome', 'err');
      const cnpj = $('#e_cnpj').value.replace(/\D/g, '');
      if (cnpj && !Util.validaCNPJ(cnpj)) return toast('CNPJ inválido', 'err');
      const convencaoIds = Array.from(document.querySelectorAll('#e_convs .chip.on')).map(x => x.dataset.conv);
      const data = { nome, cnpj, convencaoIds };
      const empSaved = t.dataset.saveEmp ? await DB.update('empresas', t.dataset.saveEmp, data) : await DB.add('empresas', data);
      closeModal(); toast('Salvo', 'ok');
      // veio do fluxo "importar folha de empresa não cadastrada"? continua a auditoria
      if (_pendingFolha) {
        const pf = _pendingFolha; _pendingFolha = null;
        if (!convencaoIds.length) { toast('Empresa salva. Vincule uma convenção para auditar.', 'warn'); return render(); }
        state.view = 'conferencia'; renderNav();
        app.innerHTML = await viewConferencia(empSaved.id); wireConferencia(); window.scrollTo(0, 0);
        await importFolha(pf);
        return;
      }
      render();
      return;
    }
  });

  // fecha modal/drawer clicando fora
  $('#modalScrim').addEventListener('click', e => { if (e.target.id === 'modalScrim') closeModal(); });
  $('#scrim').addEventListener('click', closeDrawer);
  $('#menuBtn').addEventListener('click', openDrawer);

  // CNPJ mask ao vivo (delegado no input)
  document.addEventListener('input', e => {
    if (['f_cnpj', 'e_cnpj'].includes(e.target.id)) e.target.value = Util.formatCNPJ(e.target.value);
  });

  /* ---- form convenção: upload + absorção por IA + save ---- */
  let _convAbsorb = null;
  function fileToBase64(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(',')[1]);
      r.onerror = () => rej(new Error('não consegui ler o arquivo'));
      r.readAsDataURL(file);
    });
  }
  function wireConvForm(body, c) {
    _convAbsorb = null;
    const drop = $('#c_drop'), pdf = $('#c_pdf'), absBtn = $('#c_absorver');
    if (drop) {
      drop.addEventListener('click', () => pdf.click());
      pdf.addEventListener('change', e => {
        const f = e.target.files[0]; if (!f) return;
        drop.classList.add('has'); drop.innerHTML = '📎 ' + Util.escape(f.name); drop.dataset.name = f.name;
        if (absBtn) { absBtn.disabled = false; }
      });
    }
    if (absBtn) absBtn.addEventListener('click', () => absorverConvPDF(pdf.files[0]));
  }
  async function absorverConvPDF(file) {
    const btn = $('#c_absorver'), status = $('#c_ia_status');
    if (!file) return;
    const cfg = await DB.getConfig();
    if (!cfg.apiKey) { toast('Configure a chave da API em Configurações (menu ☰)', 'err'); return; }
    btn.disabled = true; btn.textContent = '🤖 Lendo o PDF... aguarde';
    status.textContent = 'A IA está lendo a convenção. Pode levar de 20s a 1 min.';
    try {
      const b64 = await fileToBase64(file);
      const bundle = await IA.absorverConvencao(b64, cfg);
      const conv = bundle.convencao || {};
      const set = (id, v) => { const el = $(id); if (el && v != null && v !== '') el.value = v; };
      set('#c_tit', conv.titulo); set('#c_reg', conv.numeroRegistro); set('#c_abr', conv.abrangencia);
      set('#c_uf', (conv.uf || '').toUpperCase()); set('#c_vi', conv.vigenciaInicio); set('#c_vf', conv.vigenciaFim);
      if ($('#c_base') && conv.dataBaseMes) $('#c_base').value = conv.dataBaseMes;
      if (bundle.sindicato && bundle.sindicato.cnpj && $('#c_sind') && !$('#c_sind').value) {
        // se nenhum sindicato escolhido, tenta casar pelo CNPJ absorvido
        const cnpj = (bundle.sindicato.cnpj || '').replace(/\D/g, '');
        const s = (await DB.where('sindicatos', x => (x.cnpj || '') === cnpj))[0];
        if (s) $('#c_sind').value = s.id;
      }
      _convAbsorb = { regras: Object.assign(Schema.emptyRegras(), conv.regras || {}) };
      status.innerHTML = '✅ <b>Preenchido pela IA.</b> Confira os campos e salve. Depois abra ⚙️ Regras para revisar.';
      btn.textContent = '✅ Absorvido — pode salvar';
    } catch (e) {
      status.innerHTML = '<span style="color:var(--err)">Erro: ' + Util.escape(e.message) + '</span>';
      btn.disabled = false; btn.textContent = '🤖 Tentar absorver de novo';
    }
  }
  async function saveConv(id) {
    const sindicatoId = $('#c_sind').value;
    const titulo = $('#c_tit').value.trim();
    if (!sindicatoId) return toast('Escolha o sindicato', 'err');
    if (!titulo) return toast('Informe o título', 'err');
    const drop = $('#c_drop');
    const data = {
      sindicatoId, titulo,
      numeroRegistro: $('#c_reg').value.trim(),
      dataBaseMes: $('#c_base').value,
      abrangencia: $('#c_abr').value.trim(),
      uf: ($('#c_uf').value || '').trim().toUpperCase(),
      vigenciaInicio: $('#c_vi').value,
      vigenciaFim: $('#c_vf').value,
      pdfName: (drop && drop.dataset.name) || (await maybeKeepPdf(id)),
    };
    const regrasIA = _convAbsorb && _convAbsorb.regras;
    if (id) await DB.update('convencoes', id, regrasIA ? Object.assign({}, data, { regras: regrasIA, aprovada: false }) : data);
    else { data.regras = regrasIA || Schema.emptyRegras(); data.aprovada = false; await DB.add('convencoes', data); }
    _convAbsorb = null;
    closeModal(); toast(regrasIA ? 'Convenção absorvida ✓ revise as regras' : 'Convenção salva', 'ok'); render();
  }
  async function maybeKeepPdf(id) { if (!id) return ''; const c = await DB.get('convencoes', id); return c ? c.pdfName || '' : ''; }

  /* ---- importar convenção (JSON gerado pela IA) ---- */
  function importConvPick() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try { await importConvencao(JSON.parse(await f.text())); }
      catch (e) { toast('Arquivo inválido: ' + e.message, 'err'); }
    };
    inp.click();
  }
  async function importConvencao(bundle, opts) {
    opts = opts || {};
    if (!bundle || !bundle.convencao) { toast('JSON sem "convencao"', 'err'); return null; }
    const s = bundle.sindicato || {};
    const cnpj = (s.cnpj || '').replace(/\D/g, '');
    let sind = null;
    if (cnpj) sind = (await DB.where('sindicatos', x => (x.cnpj || '') === cnpj))[0];
    if (!sind && s.nome) sind = (await DB.where('sindicatos', x => x.nome === s.nome))[0];
    if (!sind) sind = await DB.add('sindicatos', { nome: s.nome || 'Sindicato importado', cnpj, categoria: s.categoria || '' });
    const c = bundle.convencao;
    const rec = Object.assign({ regras: Schema.emptyRegras(), aprovada: false }, c, { sindicatoId: sind.id });
    // mescla regras importadas sobre a estrutura padrão (garante todos os campos)
    rec.regras = Object.assign(Schema.emptyRegras(), c.regras || {});
    if (!rec.uf) rec.uf = Util.parseUF(rec.abrangencia);
    // dedupe: mesma convenção já cadastrada (mesmo sindicato + nº de registro OU título)?
    // Atualiza no lugar — preserva o id, então o vínculo da empresa e o histórico continuam valendo.
    const reg = (c.numeroRegistro || '').trim();
    const existente = opts.substituir === false ? null : (await DB.where('convencoes', x =>
      !x.arquivada && x.sindicatoId === sind.id &&
      ((reg && (x.numeroRegistro || '').trim() === reg) || (x.titulo || '') === (c.titulo || ''))
    ))[0];
    if (existente) {
      rec.aprovada = existente.aprovada;   // não rebaixa uma convenção já aprovada
      const saved = await DB.update('convencoes', existente.id, rec);
      if (!opts.silent) { toast('Convenção atualizada no lugar ✓ (vínculos preservados)', 'ok'); render(); }
      return saved;
    }
    const saved = await DB.add('convencoes', rec);
    if (!opts.silent) { toast('Convenção importada ✓ — revise e aprove', 'ok'); render(); }
    return saved;
  }

  /* ---- Mediador (verificar / atualizar convenção vencida) ---- */
  const MEDIADOR_URL = 'https://mediador.trabalho.gov.br/sistemas/mediador/ConsultarInstColetivo';
  async function openMediadorModal(convId) {
    const c = await DB.get('convencoes', convId);
    if (!c) return;
    const sind = c.sindicatoId ? await DB.get('sindicatos', c.sindicatoId) : null;
    const cnpj = sind && sind.cnpj ? Util.formatCNPJ(sind.cnpj) : '(cadastre o CNPJ no sindicato)';
    const uf = c.uf || Util.parseUF(c.abrangencia) || '—';
    const st = Util.statusVigencia(c.vigenciaFim);
    openModal(`
      <div class="mh"><h3>Procurar no Mediador</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="notice ${st.dias !== null && st.dias < 0 ? '' : 'gold'}" style="margin-bottom:12px">
        <b>${Util.escape(c.titulo)}</b><br>${st.txt}
      </div>
      <p class="mini" style="margin:0 2px 6px">No site, vá em <b>Consulta → Instrumentos Coletivos Registrados</b> e preencha:</p>
      <div class="card" style="margin:6px 0">
        <div class="list-row"><span>CNPJ do sindicato</span><span class="grow"></span><b>${cnpj}</b></div>
        <div class="list-row"><span>Vigência</span><span class="grow"></span><b>Ativa</b></div>
        <div class="list-row"><span>UF da convenção</span><span class="grow"></span><b>${uf}</b></div>
        <div class="mini" style="margin-top:6px">Clique em <b>Pesquisar</b> e, se houver uma mais nova, baixe o PDF.</div>
      </div>
      <button class="btn primary block" data-mediador-open style="margin-bottom:12px">🌐 Abrir o Mediador</button>
      <div class="divider"></div>
      <p class="mini" style="margin:0 2px 8px">Baixou a convenção nova? A IA lê o PDF e gera o JSON; aqui você importa, eu <b>comparo</b> com a atual, <b>re-vinculo</b> as empresas e <b>guardo a antiga</b> no histórico.</p>
      <button class="btn gold block" data-mediador-update="${convId}">⤵ Importar a nova e atualizar</button>`);
  }

  async function atualizarConvencaoDoMediador(oldId) {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      try {
        const bundle = JSON.parse(await f.text());
        const old = await DB.get('convencoes', oldId);
        // aqui queremos SEMPRE uma convenção nova (a antiga vai para o histórico), então não deduplica
        const novo = await importConvencao(bundle, { silent: true, substituir: false });
        if (!novo) return;
        const emps = await DB.where('empresas', e => (e.convencaoIds || []).includes(oldId));
        for (const e of emps) {
          await DB.update('empresas', e.id, { convencaoIds: e.convencaoIds.map(id => id === oldId ? novo.id : id) });
        }
        await DB.update('convencoes', oldId, { arquivada: true, substituidaPor: novo.id });
        await DB.update('convencoes', novo.id, { substituiu: oldId });
        mostrarDiffConvencao(old, novo, emps.length);
      } catch (e) { toast('Arquivo inválido: ' + e.message, 'err'); }
    };
    inp.click();
  }

  function mostrarDiffConvencao(old, novo, nEmp) {
    const pisoOld = (old.regras && old.regras.pisos && old.regras.pisos[0]) ? old.regras.pisos[0].valor : null;
    const pisoNew = (novo.regras && novo.regras.pisos && novo.regras.pisos[0]) ? novo.regras.pisos[0].valor : null;
    render();
    openModal(`
      <div class="mh"><h3>Convenção atualizada ✓</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="card">
        <div class="list-row"><span>Piso</span><span class="grow"></span><b>${Util.formatBRL(pisoOld)} → ${Util.formatBRL(pisoNew)}</b></div>
        <div class="list-row"><span>Vigência até</span><span class="grow"></span><b>${Util.formatDateBR(old.vigenciaFim)} → ${Util.formatDateBR(novo.vigenciaFim)}</b></div>
        <div class="list-row"><span>Registro MTE</span><span class="grow"></span><b>${Util.escape(old.numeroRegistro || '—')} → ${Util.escape(novo.numeroRegistro || '—')}</b></div>
      </div>
      <div class="notice gold"><b>${nEmp}</b> empresa(s) re-vinculada(s) à nova convenção. A anterior foi guardada no histórico. Revise e aprove as regras da nova.</div>
      <button class="btn primary block" data-regras="${novo.id}">Revisar regras da nova</button>`);
  }

  /* ---- regime CLT (sem convenção) ---- */
  async function createCltRegime() {
    const cfg = await DB.getConfig();
    if (!cfg.salarioMinimo) { toast('Defina o salário mínimo em Configurações primeiro', 'err'); return openConfig(); }
    const existing = (await DB.where('convencoes', c => c.tipo === 'clt'))[0];
    if (existing) { toast('Já existe um regime CLT', 'err'); return; }
    await DB.add('convencoes', {
      tipo: 'clt', sindicatoId: '',
      titulo: 'CLT — Salário Mínimo (sem convenção)',
      dataBaseMes: '', vigenciaInicio: '', vigenciaFim: '',
      regras: Schema.cltRegras(cfg.salarioMinimo), aprovada: true,
    });
    toast('Regime CLT criado ✓', 'ok'); render();
  }

  /* ---- configurações (salário mínimo) ---- */
  async function openConfig() {
    closeDrawer();
    const cfg = await DB.getConfig();
    openModal(`
      <div class="mh"><h3>Configurações</h3><button class="iconbtn" data-close>✕</button></div>
      <div class="field"><label>Salário mínimo nacional vigente (R$)</label>
        <input id="cfg_sm" inputmode="decimal" value="${cfg.salarioMinimo ?? ''}" placeholder="Ex.: 1518,00">
        <div class="hint">Usado no regime CLT (sem convenção). Atualize a cada virada de ano.</div>
      </div>
      <div class="divider"></div>
      <div class="section-hd" style="margin-top:0">Inteligência artificial (ler PDFs)</div>
      <div class="field"><label>Chave da API da Anthropic</label>
        <input id="cfg_key" type="password" value="${Util.escape(cfg.apiKey || '')}" placeholder="sk-ant-...">
        <div class="hint">Fica salva só neste aparelho. Pegue em console.anthropic.com. Usada para o PDF preencher os campos sozinho.</div>
      </div>
      <div class="field"><label>Modelo</label>
        <select id="cfg_model">
          <option value="claude-opus-4-8" ${(cfg.iaModel || 'claude-opus-4-8') === 'claude-opus-4-8' ? 'selected' : ''}>Opus 4.8 (melhor leitura)</option>
          <option value="claude-sonnet-5" ${cfg.iaModel === 'claude-sonnet-5' ? 'selected' : ''}>Sonnet 5 (mais barato)</option>
        </select>
      </div>
      <button class="btn primary block" data-save-config>Salvar</button>`);
  }
  async function saveConfig() {
    const sm = Util.parseNum($('#cfg_sm').value);
    const apiKey = ($('#cfg_key').value || '').trim();
    const iaModel = $('#cfg_model').value;
    await DB.setConfig({ salarioMinimo: sm || (await DB.getConfig()).salarioMinimo, apiKey, iaModel });
    // atualiza o piso dos regimes CLT existentes (só se o mínimo foi informado)
    if (sm) {
      const clts = await DB.where('convencoes', c => c.tipo === 'clt');
      for (const c of clts) {
        const r = c.regras || Schema.cltRegras(sm);
        if (r.pisos && r.pisos[0]) r.pisos[0].valor = sm; else r.pisos = [{ funcao: 'Salário mínimo nacional', valor: sm, jornada: '44h semanais' }];
        await DB.update('convencoes', c.id, { regras: r });
      }
    }
    closeModal(); toast('Configurações salvas', 'ok'); render();
  }

  async function exportBackup() {
    const data = await DB.dump();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'folha-certa-backup.json'; a.click();
    URL.revokeObjectURL(url);
    closeDrawer(); toast('Backup exportado', 'ok');
  }

  /* ---- salvar regras (lê o editor) ---- */
  async function saveRegras() {
    const r = _regrasCache;
    // pisos
    r.pisos = Array.from(document.querySelectorAll('.piso-row')).map(row => ({
      funcao: row.querySelector('.p_func').value.trim(),
      valor: Util.parseNum(row.querySelector('.p_val').value),
      jornada: row.querySelector('.p_jor').value.trim(),
    })).filter(p => p.funcao);
    // estabilidades
    r.estabilidades = Array.from(document.querySelectorAll('.est-row')).map(row => ({
      tipo: row.querySelector('.e_tipo').value,
      duracaoMeses: Util.parseNum(row.querySelector('.e_dur').value),
    }));
    // beneficios
    r.beneficios = Array.from(document.querySelectorAll('.ben-row')).map(row => ({
      tipo: row.querySelector('.b_tipo').value,
      valor: Util.parseNum(row.querySelector('.b_val').value),
    }));
    // campos data-bind
    document.querySelectorAll('[data-bind]').forEach(el => {
      const path = el.dataset.bind;
      let v = el.value;
      if (['tempoServico.percentual', 'produtividade.valor', 'adiantamento.percentual', 'adiantamento.diaLimite',
        'adicionais.horaExtra', 'adicionais.horaExtra100', 'adicionais.noturno'].includes(path)) v = Util.parseNum(v);
      pathSet(r, path, v);
    });
    const aprovada = $('#chk_aprov').classList.contains('on');
    await DB.update('convencoes', _regrasConvId, { regras: r, aprovada });
    closeModal(); toast(aprovada ? 'Regras aprovadas ✓' : 'Regras salvas', 'ok'); render();
  }

  function cleanEmptyMini(sel) {
    const box = $(sel); const mini = box.querySelector(':scope > .mini'); if (mini) mini.remove();
  }

  /* boot */
  const _ver = $('#appVersion'); if (_ver) _ver.textContent = 'Folha Certa ' + APP_VERSION;
  render();
  window.FC = { go, DB, toast, Util, Schema, Audit, IA, importConvencao, importFolha, exportBackup, createCltRegime, openMediadorModal, versao: APP_VERSION }; // atalho p/ debug/console
})();
