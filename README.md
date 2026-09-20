# DIANA V12

Render-ready WhatsApp bot architecture using Baileys.

## Files

- `index.js` starts the bot.
- `bot.js` contains the WhatsApp bot.
- `pairing.js` runs the separate pairing website.
- `package.json` contains dependencies and start commands.

## Render BOT service

Create a **Background Worker**.

Build command:
`npm install`

Start command:
`npm start`

Environment variables:
- `SESSION_ID`
- `OWNER_NUMBER`
- `PREFIX`
- `BOT_NAME`
- `MODE`
- `AUTH_DIR`

Use a persistent disk for `AUTH_DIR`, for example:
`/opt/render/project/src/auth`

## Render PAIRING service

Create a second **Web Service** using the same repository.

Build command:
`npm install`

Start command:
`npm run pairing`

The pairing page will use Render's `PORT` automatically.

## Security

Never commit a real SESSION_ID or `.env` file.
Treat SESSION_ID like a password.

## Current commands

`.menu`
`.ping`
`.alive`
`.owner`
`.say`

The category structure is ready for the larger DIANA V12 command modules.
