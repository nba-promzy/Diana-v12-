require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const pino = require("pino");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const app = express();
const sessions = new Map();

app.use(express.json());

const PAGE = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>DIANA V12 Pairing</title>
<style>
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#070a10;color:#fff;font-family:Arial,sans-serif}
.card{width:min(92%,430px);padding:26px;border:1px solid #263044;border-radius:22px;background:#111722;box-shadow:0 20px 70px #0008}
h1{margin:0 0 8px}
p{color:#aeb8ca;line-height:1.5}
input,button{width:100%;padding:14px;border-radius:12px;font-size:16px}
input{margin:10px 0;background:#080b12;color:#fff;border:1px solid #34415b}
button{border:0;background:#fff;color:#000;font-weight:700}
.code{margin:20px 0;padding:16px;text-align:center;border:1px dashed #53627e;border-radius:14px;font-size:28px;letter-spacing:4px}
pre{padding:14px;border-radius:12px;background:#080b12;color:#dce5f5;white-space:pre-wrap;word-break:break-all;font-size:11px;max-height:260px;overflow:auto}
small{color:#7f8aa0}
</style>
</head>
<body>
<div class="card">
<h1>🤖 DIANA V12</h1>
<p>WhatsApp pairing and SESSION_ID generator.</p>
<input id="phone" inputmode="numeric" placeholder="233XXXXXXXXX">
<button onclick="pair()">Generate Pairing Code</button>
<div id="output"></div>
</div>

<script>
async function pair(){
  const output=document.getElementById("output");
  const phone=document.getElementById("phone").value.trim();

  output.innerHTML="<p>Generating pairing code...</p>";

  const response=await fetch("/api/pair",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({phone})
  });

  const data=await response.json();

  if(!data.ok){
    output.innerHTML="<p>❌ "+data.error+"</p>";
    return;
  }

  output.innerHTML=
    "<div class='code'>"+data.code+"</div>"+
    "<p>WhatsApp → Linked devices → Link a device → Link with phone number instead.</p>"+
    "<p id='status'>Waiting for WhatsApp connection...</p>";

  const timer=setInterval(async()=>{
    const r=await fetch("/api/session/"+data.id);
    const s=await r.json();

    if(s.connected && s.session){
      clearInterval(timer);

      output.innerHTML=
        "<p>✅ Connected successfully.</p>"+
        "<p>Copy this SESSION_ID into Render:</p>"+
        "<pre>"+s.session+"</pre>"+
        "<small>Keep this secret. Anyone with it may be able to access the bot session.</small>";
    }
  },2000);
}
</script>
</body>
</html>`;

app.get("/", (req, res) => {
  res.type("html").send(PAGE);
});

function createSessionId(authDir) {
  const files = {};

  for (const filename of fs.readdirSync(authDir)) {
    const fullPath = path.join(authDir, filename);

    if (fs.statSync(fullPath).isFile()) {
      files[filename] = fs.readFileSync(fullPath, "utf8");
    }
  }

  return (
    "DIANA-X:" +
    Buffer.from(JSON.stringify({ files })).toString("base64")
  );
}

app.post("/api/pair", async (req, res) => {
  try {
    const phone = String(req.body.phone || "").replace(/\D/g, "");

    if (phone.length < 8) {
      throw new Error(
        "Enter your WhatsApp number with country code, for example 233XXXXXXXXX."
      );
    }

    const id = "pair_" + Date.now();
    const authDir = path.join(
      process.cwd(),
      "pair-auth",
      id
    );

    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } =
      await useMultiFileAuthState(authDir);

    const { version } =
      await fetchLatestBaileysVersion();

    const socket = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      browser: ["DIANA V12 Pairing", "Chrome", "1.0.0"]
    });

    const session = {
      socket,
      authDir,
      connected: false,
      sessionId: null
    };

    sessions.set(id, session);

    socket.ev.on("creds.update", saveCreds);

    socket.ev.on("connection.update", async ({ connection }) => {
      if (connection === "open") {
        session.connected = true;

        // Give creds.update a moment to flush the latest auth files.
        setTimeout(() => {
          try {
            session.sessionId =
              createSessionId(authDir);
          } catch (error) {
            console.error(
              "Session export error:",
              error
            );
          }
        }, 1500);
      }
    });

    const code =
      await socket.requestPairingCode(phone);

    res.json({
      ok: true,
      id,
      code
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      error: error.message
    });
  }
});

app.get("/api/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);

  if (!session) {
    return res.status(404).json({
      ok: false,
      error: "Pairing session not found."
    });
  }

  res.json({
    ok: true,
    connected: session.connected,
    session: session.sessionId
  });
});

const port = process.env.PORT || 10000;

app.listen(port, "0.0.0.0", () => {
  console.log(
    `DIANA V12 pairing server listening on port ${port}`
  );
});
