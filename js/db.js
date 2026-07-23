/* db.js — Camada de dados do Folha Certa.
 *
 * HOJE: guarda tudo no localStorage do aparelho (funciona abrindo o arquivo,
 *       sem instalar nada, sem internet).
 * DEPOIS: pra sincronizar entre celulares/usuários, trocamos só este arquivo
 *       por um adaptador do Firebase Firestore. A API abaixo (list/get/add/
 *       update/remove/where) foi desenhada pra ficar igual, então nenhum outro
 *       arquivo muda quando migrarmos.
 *
 * Coleções usadas:
 *   sindicatos  { id, nome, cnpj, categoria }
 *   convencoes  { id, sindicatoId, titulo, numeroRegistro, abrangencia,
 *                 dataBaseMes, vigenciaInicio, vigenciaFim, pdfName,
 *                 regras{...}, aprovada, origemRegras }
 *   empresas    { id, nome, cnpj, convencaoIds[] }
 *   folhas      { id, empresaId, competencia, ... }   (fase futura)
 */
const DB = (function () {
  const PREFIX = 'fc.';
  const mem = {}; // fallback em memória se o localStorage estiver indisponível

  function read(coll) {
    try {
      const v = localStorage.getItem(PREFIX + coll);
      return v ? JSON.parse(v) : (mem[coll] || []);
    } catch (e) { return mem[coll] || []; }
  }
  function write(coll, arr) {
    mem[coll] = arr;
    try { localStorage.setItem(PREFIX + coll, JSON.stringify(arr)); } catch (e) { /* usa memória */ }
  }
  function uid() {
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  return {
    async list(coll) { return read(coll); },
    async get(coll, id) { return read(coll).find(x => x.id === id) || null; },
    async where(coll, pred) { return read(coll).filter(pred); },
    async add(coll, obj) {
      const arr = read(coll);
      const rec = Object.assign({}, obj, { id: uid(), createdAt: new Date().toISOString() });
      arr.push(rec);
      write(coll, arr);
      return rec;
    },
    async update(coll, id, patch) {
      const arr = read(coll);
      const i = arr.findIndex(x => x.id === id);
      if (i < 0) return null;
      arr[i] = Object.assign({}, arr[i], patch, { updatedAt: new Date().toISOString() });
      write(coll, arr);
      return arr[i];
    },
    async remove(coll, id) {
      write(coll, read(coll).filter(x => x.id !== id));
    },
    // configuração global (salário mínimo etc.)
    async getConfig() {
      try { return JSON.parse(localStorage.getItem(PREFIX + 'config')) || mem._config || {}; }
      catch (e) { return mem._config || {}; }
    },
    async setConfig(patch) {
      const cur = await this.getConfig();
      const next = Object.assign({}, cur, patch);
      mem._config = next;
      try { localStorage.setItem(PREFIX + 'config', JSON.stringify(next)); } catch (e) { /* usa memória */ }
      return next;
    },
    // utilitário p/ exportar todos os dados (backup em JSON)
    async dump() {
      return {
        sindicatos: read('sindicatos'),
        convencoes: read('convencoes'),
        empresas: read('empresas'),
        folhas: read('folhas'),
        config: await this.getConfig(),
        exportadoEm: new Date().toISOString(),
      };
    },
  };
})();
