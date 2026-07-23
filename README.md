# Folha Certa

App (PWA instalável) para **conferência de folha de pagamento com base na convenção coletiva**.
Feito para a Totali Contabilidade.

> Nome "Folha Certa" é provisório — pode trocar quando quiser.

## O que ele faz (visão completa)

1. **Sindicatos** — cadastro com nome e CNPJ.
2. **Convenções** — cadastra a última CCT/ACT e "absorve" as regras (piso por função,
   triênio/tempo de serviço, produtividade, adiantamento, estabilidades, benefícios),
   mostrando **data-base** e **vigência/vencimento**.
3. **Empresas** — cada empresa ligada a uma ou mais convenções (pelo CNPJ).
4. **Conferência de folha** por empresa — sobe o PDF da folha, digita os lançamentos
   variáveis do mês, e o sistema confere pela convenção: salário ≥ piso, triênio,
   produtividade, estabilidade de afastados, e **incidência de encargos** (INSS/FGTS).
5. **Relatório** dividido em **Erros** (precisa corrigir) e **Alertas** (perto de
   completar triênio, faltou adiantamento etc.), exportável em **PDF**.
6. **Histórico** — folhas conferidas ficam guardadas e são comparadas mês a mês
   (mudança de cargo, quem saiu, quem entrou, variação de salário).
7. **Dúvidas** — pergunta livre sobre a convenção, respondida pela IA.

## Estado atual (MVP — fase 1)

| Módulo | Status |
|---|---|
| Esqueleto do app / navegação / instalável | ✅ pronto |
| Cadastro de Sindicatos | ✅ funcionando |
| Cadastro de Convenções + editor de regras | ✅ funcionando (preenchimento manual) |
| Cadastro de Empresas + vínculo com convenções | ✅ funcionando |
| Painel com alertas de vigência | ✅ funcionando |
| Conferência (plano de conferência a partir da convenção) | 🟡 fluxo ligado, motor de leitura pendente |
| Absorção da convenção por IA | ⏳ próxima fase (precisa Claude API) |
| Leitura do PDF da folha + auditoria | ⏳ próxima fase (precisa folha real) |
| Relatório PDF (erros x alertas) | ⏳ próxima fase |
| Histórico / comparação de folhas | ⏳ próxima fase |
| Aba de Dúvidas (IA) | ⏳ próxima fase |

## Como testar agora (sem instalar nada)

Abra o arquivo `index.html` no navegador do celular ou do PC (dois toques no arquivo).
Os dados ficam salvos **no próprio aparelho** (localStorage). Dá pra cadastrar
sindicato, convenção (com as regras), empresa e ver o fluxo da conferência.

> No modo "abrir arquivo" o botão de *instalar na tela* não aparece — isso só
> funciona quando estiver publicado (Firebase Hosting). A lógica toda já roda.

## Arquitetura

- **Front-end**: HTML + CSS + JavaScript puro (sem framework), estilo do GeRescisão.
- **Dados hoje**: `js/db.js` guarda em localStorage.
- **Dados depois**: trocar só o `js/db.js` por um adaptador do **Firebase Firestore**
  (a API `list/get/add/update/remove/where` já foi desenhada igual). Nenhum outro
  arquivo muda.
- **IA (fases seguintes)**: Cloud Function do Firebase chamando a **Claude API**
  (Anthropic) para (a) absorver a CCT em regras estruturadas, (b) ler a folha em PDF,
  (c) responder dúvidas. A chave da API fica no backend, nunca no celular.

### Arquivos
```
index.html              estrutura + registro do service worker
manifest.webmanifest    dados de PWA (instalação)
sw.js                   cache offline (app shell)
assets/styles.css       visual (navy/gold Totali)
assets/icon*.svg        ícones
js/db.js                camada de dados (localStorage -> Firestore depois)
js/schema.js            estrutura das REGRAS da convenção + utilitários (CNPJ, datas, moeda)
js/app.js               roteador + todas as telas
```

## Roadmap

- **Fase 1 (feita)**: cadastros + editor de regras + navegação + PWA.
- **Fase 2**: publicar no Firebase Hosting + login + Firestore (dados na nuvem, multiusuário).
- **Fase 3**: absorção da convenção por IA (sobe PDF → IA preenche as regras → você confere).
- **Fase 4**: leitura da folha em PDF + motor de auditoria (erros x alertas) + relatório PDF.
- **Fase 5**: histórico e comparação mês a mês.
- **Fase 6**: aba de dúvidas com IA.

## Para as próximas fases eu vou precisar de

1. **1 convenção real** (PDF da CCT/ACT de um cliente seu) — para calibrar a absorção.
2. **1 folha de pagamento real** em PDF (pode tarjar nomes/CPF) — para calibrar a leitura.
3. Um **projeto Firebase** + uma **chave da Claude API** (quando formos ligar a nuvem e a IA).
