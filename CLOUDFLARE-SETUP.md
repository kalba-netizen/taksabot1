# Taksabot Cloudflare backend

## Что уже подготовлено в GitHub
- `worker.js` — API с проверкой подписи WebApp initData.
- `schema.sql` — структура D1 для игроков и профессий.
- `admin.html` — отдельная админ-панель: список и поиск игроков, карточка таксы, изменение баланса/XP/уровня, блокировка, сброс, статистика, редактирование профессий.
- `index.html` — поддержка загрузки/сохранения прогресса через API после настройки адреса Worker.

Администратор: StaticGram ID `1780245841`.

## Настройка Cloudflare
1. Создай D1 Database с именем `taksabot-db`.
2. Открой D1 Console и выполни весь SQL из `schema.sql`.
3. Создай Worker с именем `taksabot-api`, вставь содержимое `worker.js` и нажми Deploy.
4. В Worker → Settings → Bindings добавь D1 database binding с переменной `DB`, выбери `taksabot-db`.
5. В Worker → Settings → Variables and Secrets добавь секрет `BOT_TOKEN` — токен бота, который используется для запуска StaticGram Mini App. Не публикуй его в GitHub и не отправляй в чат.
6. В настройках Worker → Triggers проверь, что включён workers.dev. Скопируй адрес вида `https://taksabot-api.ТВОЙ-СУБДОМЕН.workers.dev`.

## Подключение адреса API
После публикации Worker адрес нужно один раз вписать в `index.html` в строку:
`const API_BASE='';`
Вместо пустой строки вставь URL Worker, сохрани файл в GitHub. В `admin.html` адрес Worker вводится в поле на самой странице.

## Открытие админки
Открой `https://kalba-netizen.github.io/taksabot1/admin.html` внутри StaticGram Mini App. Вставь URL Worker и нажми «Подключить». Сервер разрешит доступ только StaticGram ID `1780245841`.

## Важно
- Бот-токен должен соответствовать тому же Telegram/StaticGram WebApp, чьи подписанные `initData` передаются в Mini App.
- Если объект `StaticGram.WebApp.initData` недоступен в вашей версии StaticGram, сервер не сможет подтвердить личность игрока; сначала нужно уточнить официальный способ получения подписанных initData в StaticGram.
- Я подготовил файлы в GitHub, но не могу войти в твой Cloudflare аккаунт или опубликовать Worker от твоего имени. Не отправляй пароли, токены и коды входа.
