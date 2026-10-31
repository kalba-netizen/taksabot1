# Taksabot Cloudflare backend

## Что это
- Worker API с проверкой подписи StaticGram/Telegram WebApp initData.
- D1 stores shared player records and profession settings.
- Admin routes require verified user ID 1780245841.
- Never put BOT_TOKEN in GitHub or frontend code.

## Setup
1. Create a Cloudflare D1 database named `taksabot-db`.
2. In D1 Console, run all SQL from `schema.sql`.
3. Create a Worker named `taksabot-api` and paste `worker.js` into its editor.
4. Add a D1 binding named `DB` and select `taksabot-db`.
5. In Worker > Settings > Variables and Secrets, add secret `BOT_TOKEN` with your bot token. Do not send it in chat or commit it to GitHub.
6. Deploy the Worker and copy its `workers.dev` URL.

Official guides:
- https://developers.cloudflare.com/d1/get-started/
- https://developers.cloudflare.com/workers/configuration/secrets/

Note: The current game still stores gameplay locally. Shared balances and full admin actions are not live until the frontend is migrated to this API and the Worker is deployed.
