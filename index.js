// ==================== index.js (NOVA XMD V1) ====================
// ✅ 100% CommonJS | ✅ /pair | ✅ AntiDelete store (2 keys)
// ✅ Welcome/Goodbye ON/OFF | ✅ AutoStatus FIXED | ✅ Pair stable

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const { Boom } = require("@hapi/boom");
const express = require("express");
const fs = require("fs");
const path = require("path");

const config = require("./config");

let newsletterHandler = async () => {};
let antideleteHandler = async () => {};
try { newsletterHandler = require("./data/newsletter.js"); } catch {}
try { antideleteHandler = require("./data/antidelete.js"); } catch {}

const app = express();
const port = process.env.PORT || 3000;

const sessionsDir = path.join(__dirname, "accounts");
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

let tempSocks = {};
global.msgStore = global.msgStore || {};
global.owner = String(config.OWNER_NUMBER || "").replace(/[^0-9]/g, "");
global.botStartTime = Date.now();

app.use(express.static(__dirname));

// ================= HELPERS =================
function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function readAutoStatus() {
  const file = path.join(__dirname, "data", "autostatus.json");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ enabled: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readWelcomeDb() {
  const file = path.join(__dirname, "data", "welcome.json");
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

// ================= START BOT =================
async function startUserBot(phoneNumber, isPairing = false) {
  const cleanNumber = String(phoneNumber || "").replace(/[^0-9]/g, "");
  const sessionName = `session_${cleanNumber}`;
  const sessionPath = path.join(sessionsDir, sessionName);

  if (isPairing) {
    if (tempSocks[sessionName]) {
      try { tempSocks[sessionName].end(); } catch {}
      delete tempSocks[sessionName];
    }
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  let currentMode = (config.MODE || "public").toLowerCase();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],

    // ✅ IMPORTANT POUR AUTOSTATUS
    syncFullHistory: true,
    markOnlineOnConnect: true,

    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    }
  });

  tempSocks[sessionName] = sock;

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) {
        startUserBot(cleanNumber);
      }
    }

    if (connection === "open") {
      console.log("✅ Session connectée");

      // ✅ ACTIVER RECEPTION DES STATUS
      try {
        await sock.statusSubscribe();
        console.log("AutoStatus activé");
      } catch (e) {
        console.log("statusSubscribe error:", e?.message || e);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // ===== Welcome / Goodbye =====
  sock.ev.on("group-participants.update", async (ev) => {
    const db = readWelcomeDb();
    if (!db.welcome && !db.goodbye) return;

    const meta = await sock.groupMetadata(ev.id);
    const subject = meta.subject;

    for (const user of ev.participants) {
      const mention = "@" + user.split("@")[0];

      if (ev.action === "add" && db.welcome) {
        await sock.sendMessage(ev.id, {
          text: `👋 Bienvenue ${mention}\n👥 ${subject}`,
          mentions: [user]
        });
      }

      if (ev.action === "remove" && db.goodbye) {
        await sock.sendMessage(ev.id, {
          text: `👋 Au revoir ${mention}\n👥 ${subject}`,
          mentions: [user]
        });
      }
    }
  });

  // ===== Messages =====
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    const m = chatUpdate.messages?.[0];
    if (!m || !m.message) return;

    const jid = m.key.remoteJid;

    // ===== AUTOSTATUS =====
    if (jid === "status@broadcast") {
      const st = readAutoStatus();
      if (st.enabled) {
        try {
          await sock.readMessages([m.key]);
          console.log("Status vu automatiquement");
        } catch {}
      }
      return;
    }

    global.msgStore[m.key.id] = m;
    global.msgStore[`${m.key.remoteJid}:${m.key.id}`] = m;

    setTimeout(() => {
      delete global.msgStore[m.key.id];
      delete global.msgStore[`${m.key.remoteJid}:${m.key.id}`];
    }, 7200000);

    const cmdHandler = require("./case.js");
    await cmdHandler(
      sock,
      m,
      config.PREFIX || ".",
      (newMode) => { currentMode = newMode; },
      currentMode
    );
  });

  sock.ev.on("messages.update", async (updates) => {
    for (const upd of updates) {
      await antideleteHandler(sock, upd);
    }
  });

  return sock;
}

// ===== Restore sessions =====
async function restoreSessions() {
  const folders = fs.readdirSync(sessionsDir);
  for (const folder of folders) {
    if (folder.startsWith("session_")) {
      await startUserBot(folder.replace("session_", ""));
      await delay(3000);
    }
  }
}

// ===== Routes =====
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/pair", async (req, res) => {
  try {
    const num = String(req.query.number || "").replace(/[^0-9]/g, "");
    if (!num || num.length < 8)
      return res.status(400).json({ error: "Numéro invalide" });

    const sock = await startUserBot(num, true);
    await delay(4000);

    const code = await sock.requestPairingCode(num);
    res.json({ code });
  } catch {
    res.status(500).json({ error: "Impossible de générer le code" });
  }
});

app.listen(port, async () => {
  console.log(`Bot prêt sur http://localhost:${port}`);
  await restoreSessions();
});
