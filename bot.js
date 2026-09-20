const fs = require("fs");
const path = require("path");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");

const PREFIX = process.env.PREFIX || ".";
const BOT_NAME = process.env.BOT_NAME || "DIANA V12";
const OWNER_NUMBER = (process.env.OWNER_NUMBER || "").replace(/\D/g, "");
const AUTH_DIR = process.env.AUTH_DIR || path.join(process.cwd(), "auth");

function decodeSession(session) {
  const encoded = session.includes(":")
    ? session.slice(session.indexOf(":") + 1)
    : session;

  return JSON.parse(
    Buffer.from(encoded, "base64").toString("utf8")
  );
}

async function restoreSession() {
  if (!process.env.SESSION_ID) {
    console.log("SESSION_ID is not set.");
    return;
  }

  const data = decodeSession(process.env.SESSION_ID);

  if (!data || !data.files) {
    throw new Error("Invalid SESSION_ID.");
  }

  fs.mkdirSync(AUTH_DIR, { recursive: true });

  for (const [filename, content] of Object.entries(data.files)) {
    fs.writeFileSync(
      path.join(AUTH_DIR, filename),
      content,
      "utf8"
    );
  }

  console.log("WhatsApp session restored.");
}

async function startBot() {
  await restoreSession();

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(
        state.keys,
        pino({ level: "silent" })
      )
    },
    browser: [BOT_NAME, "Chrome", "1.0.0"],
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect }) => {
    if (connection === "open") {
      console.log(`🤖 ${BOT_NAME} is connected.`);
    }

    if (connection === "close") {
      const statusCode =
        lastDisconnect?.error?.output?.statusCode;

      if (statusCode === DisconnectReason.loggedOut) {
        console.error("WhatsApp session was logged out.");
        return;
      }

      console.log("Connection closed. Reconnecting in 5 seconds...");
      setTimeout(() => {
        startBot().catch(console.error);
      }, 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    const message = messages[0];

    if (!message?.message || message.key.fromMe) return;

    const jid = message.key.remoteJid;

    const text =
      message.message.conversation ||
      message.message.extendedTextMessage?.text ||
      message.message.imageMessage?.caption ||
      message.message.videoMessage?.caption ||
      "";

    if (!text.startsWith(PREFIX)) return;

    const parts = text
      .slice(PREFIX.length)
      .trim()
      .split(/\s+/);

    const command = (parts.shift() || "").toLowerCase();
    const args = parts;

    const reply = (text) =>
      sock.sendMessage(
        jid,
        { text },
        { quoted: message }
      );

    if (command === "ping") {
      const start = Date.now();
      return reply(`🏓 Pong!\n⚡ ${Date.now() - start} ms`);
    }

    if (command === "alive") {
      return reply(
`🤖 *${BOT_NAME}*

✅ Status: Online
📌 Prefix: ${PREFIX}
👤 Owner: ${OWNER_NUMBER ? "+" + OWNER_NUMBER : "Not configured"}
☁️ Host: Render`
      );
    }

    if (command === "owner") {
      return reply(
        `👑 Owner: ${
          OWNER_NUMBER ? "+" + OWNER_NUMBER : "Not configured"
        }`
      );
    }

    if (command === "say") {
      if (!args.length) {
        return reply(`Usage: ${PREFIX}say hello`);
      }

      return reply(args.join(" "));
    }

    if (command === "menu" || command === "help") {
      return reply(
`┏▣ ◈ *DIANA V12 🤖* ◈
┃ *ᴏᴡɴᴇʀ* : 📎😭💕Promzy 📎😭💕
┃ *ᴘʀᴇғɪx* : [ ${PREFIX} ]
┃ *ʜᴏsᴛ* : Render
┃ *ᴍᴏᴅᴇ* : ${process.env.MODE || "Private"}
┃ *ᴠᴇʀsɪᴏɴ* : 1.8.4
┗▣

*MAIN COMMANDS*
• ${PREFIX}ping
• ${PREFIX}alive
• ${PREFIX}owner
• ${PREFIX}say
• ${PREFIX}menu

*MENU CATEGORIES*
🤖 AI
🎵 AUDIO
📥 DOWNLOAD
🎨 EPHOTO360
💰 FINANCE
😂 FUN
👥 GROUP
🖼️ IMAGE
⚙️ OTHERS
👑 OWNER
✝️ RELIGION
🔎 SEARCH
⚙️ SETTINGS
⚽ SPORTS
🆘 SUPPORT
🛠️ TOOLS
🎬 VIDEO`
      );
    }

    return reply(
      `❌ Unknown command: ${PREFIX}${command}\nUse ${PREFIX}menu`
    );
  });
}

module.exports = { startBot };
