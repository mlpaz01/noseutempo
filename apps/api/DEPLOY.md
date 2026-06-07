# Deploy do backend de pagamento (api.noseutempo.app)

Backend Node.js que integra o **Mercado Pago Checkout Pro**. Roda como um
**site Node.js no CloudPanel**, no subdomínio `api.noseutempo.app`.

## Visão geral do que vamos fazer
1. DNS: criar registro `A` para `api` → `2.24.104.195` (na GoDaddy).
2. CloudPanel: criar um **site Node.js** para `api.noseutempo.app`.
3. Subir a pasta `backend/`, rodar `npm install`, criar o `.env`.
4. Emitir SSL (Let's Encrypt) para `api.noseutempo.app`.
5. Configurar o **webhook** no painel do Mercado Pago.
6. Testar com cartões de teste → depois trocar para credenciais de produção.

---

## 1) DNS na GoDaddy
- Adicionar um registro: **Tipo `A`** · **Nome `api`** · **Valor `2.24.104.195`** · TTL 1 hora.
  (Fica `api.noseutempo.app` apontando pro mesmo VPS.)

## 2) Criar o site Node.js no CloudPanel
- CloudPanel → **+ Add Site** → **Create a Node.js Site**.
- **Domain:** `api.noseutempo.app`
- **Node.js version:** 20 (ou a mais recente disponível)
- **App Port:** `3000`  ← anote; é a porta que o nosso `server.js` escuta
- Crie. Anote o **Site User** e a pasta (ex.: `/home/<user>/htdocs/api.noseutempo.app`).

## 3) Subir o código
No **File Manager** do site `api.noseutempo.app`, dentro da pasta do site:
- Faça upload de **`backend.zip`** (gerado na pasta do projeto) → **Extract**.
- Garanta que `server.js` e `package.json` fiquem na **raiz** da pasta do site.

Depois, via **SSH** (usuário do site ou root):
```bash
cd /home/<user>/htdocs/api.noseutempo.app
npm install
cp .env.example .env
nano .env          # cole o MP_ACCESS_TOKEN (TEST-... para testar)
```
No `.env`, confirme:
```
MP_ACCESS_TOKEN=TEST-xxxxxxxx...   # depois troque pelo APP_USR-... de produção
SITE_URL=https://noseutempo.app
API_URL=https://api.noseutempo.app
PORT=3000
```

## 4) Iniciar / reiniciar o app
No CloudPanel, na tela do site Node.js:
- **Start Command / App:** deixe como `npm start` (ou `node server.js`).
- Clique em **Restart** (o CloudPanel usa o gerenciador de processo dele).
- Teste: abra `https://api.noseutempo.app/api/health` → deve responder `{"ok":true,...}`.

## 5) SSL
- Aba **SSL/TLS** do site `api.noseutempo.app` → **New Let's Encrypt Certificate** → Force HTTPS.

## 6) Webhook no Mercado Pago
- Painel do MP → sua aplicação → **Webhooks / Notificações**.
- URL: `https://api.noseutempo.app/api/webhook`
- Evento: **Pagamentos** (payment).

---

## Testar (ambiente de teste)
1. No `.env`, use o **Access Token de TESTE** (`TEST-...`).
2. No site, escolha um plano → **Pagar com Mercado Pago**.
3. Use um **cartão de teste** do Mercado Pago (ex.: Mastercard `5031 4332 1540 6351`,
   validade `11/30`, CVV `123`, nome `APRO` para aprovar).
4. Após aprovar, você volta para `sucesso.html`, que confirma e libera o curso.

## Ir para produção
1. No painel do MP, pegue o **Access Token de produção** (`APP_USR-...`).
2. Troque no `.env` (`MP_ACCESS_TOKEN=APP_USR-...`) → **Restart** do app.
3. Pronto: pagamentos reais liberam o acesso automaticamente.

---

## ⚠️ Sobre liberar o acesso (importante)
Hoje o "acesso liberado" é guardado no **navegador do aluno** (localStorage),
porque o site ainda não tem login/contas. Funciona para liberar na hora após o
pagamento, mas:
- o acesso vale por navegador (se trocar de aparelho, refaz o login do pagamento);
- não impede compartilhamento determinado.

Quando quiser **acesso por conta (login + senha) com entitlement no servidor**,
me avise — aí adicionamos cadastro de usuários e banco de dados, e o webhook
passa a liberar o acesso pela conta (mais seguro).
