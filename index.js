// ==================== index.js (NOVA XMD V1) ====================
// ✅ 100% CommonJS | ✅ /pair | ✅ AntiDelete store (2 keys) | ✅ Welcome/Goodbye ON/OFF | ✅ AutoStatus ON/OFF | ✅ Pair stable wait open

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

// handlers (safe load)
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
global.botStartTime = global.botStartTime || Date.now();

// ⚠️ static
app.use(express.static(__dirname));

// ==================== HELPERS ====================
function normJid(jid = "") {
  jid = String(jid || "");
  if (!jid) return jid;
  if (jid.includes(":") && jid.includes("@")) {
    const [l, r] = jid.split("@");
    return l.split(":")[0] + "@" + r;
  }
  return jid;
}

function newsletterContext() {
  return {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: "120363423249667073@newsletter",
      newsletterName: config.BOT_NAME || "NOVA XMD V1",
      serverMessageId: 1
    }
  };
}

// ✅ bouton “Voir Channel”
function channelCardContext() {
  const channelUrl = "https://whatsapp.com/channel/0029VbBrAUYAojYjf3Ndw70d";
  return {
    ...newsletterContext(),
    externalAdReply: {
      title: config.BOT_NAME || "NOVA XMD V1",
      body: "Voir Channel • Updates & News",
      thumbnailUrl: "https://files.catbox.moe/jf30v4.png",
      sourceUrl: channelUrl,
      mediaType: 1,
      renderLargerThumbnail: true,
      showAdAttribution: false
    }
  };
}

// ==================== WELCOME / GOODBYE DB ====================
const welcomeDbPath = path.join(__dirname, "data", "welcome.json");

function readWelcomeDb() {
  try {
    if (!fs.existsSync(welcomeDbPath)) {
      fs.mkdirSync(path.dirname(welcomeDbPath), { recursive: true });
      fs.writeFileSync(welcomeDbPath, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(welcomeDbPath, "utf8"));
  } catch {
    return { welcome: false, goodbye: false };
  }
}

// ==================== AUTOSTATUS DB ====================
const autoStatusPath = path.join(__dirname, "data", "autostatus.json");

function readAutoStatus() {
  try {
    if (!fs.existsSync(autoStatusPath)) {
      fs.mkdirSync(path.dirname(autoStatusPath), { recursive: true });
      fs.writeFileSync(autoStatusPath, JSON.stringify({ enabled: false }, null, 2));
    }
    return JSON.parse(fs.readFileSync(autoStatusPath, "utf8"));
  } catch {
    return { enabled: false };
  }
}

// ==================== WAIT SOCKET OPEN (pair stable) ====================
function waitConnectionOpen(sock, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("TIMEOUT_WAIT_OPEN"));
    }, timeoutMs);

    const onUpdate = (u) => {
      if (done) return;
      if (u.connection === "open") {
        done = true;
        clearTimeout(t);
        sock.ev.off("connection.update", onUpdate);
        resolve(true);
      }
      if (u.connection === "close") {
        done = true;
        clearTimeout(t);
        sock.ev.off("connection.update", onUpdate);
        reject(new Error("CONNECTION_CLOSED"));
      }
    };

    sock.ev.on("connection.update", onUpdate);
  });
}

// ===============================
// START BOT
// ===============================
async function startUserBot(phoneNumber, isPairing = false) {
  const cleanNumber = String(phoneNumber || "").replace(/[^0-9]/g, "");
  const sessionName = `session_${cleanNumber}`;
  const sessionPath = path.join(sessionsDir, sessionName);

  // reset session si pairing
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
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    }
  });

  tempSocks[sessionName] = sock;

  // --- Connection update ---
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log(`[${cleanNumber}] Reconnexion...`);
        startUserBot(cleanNumber);
      } else {
        console.log(`[${cleanNumber}] Déconnecté (loggedOut).`);
      }
    }

    if (connection === "open") {
      console.log(`✅ [${cleanNumber}] Session connectée`);

      try {
        const userJid = normJid(sock.user?.id);
        const modeTxt = String(currentMode || "public").toUpperCase();

        await sock.sendMessage(userJid, {
          text:
`╭━━〔 🤖 *${config.BOT_NAME || "NOVA XMD V1"}* 〕━━╮
┃ ✅ CONNECTÉ AVEC SUCCÈS
┃ 👨‍💻 Developer : ${config.OWNER_NAME || "DEV NOVA"}
┃ 🌐 Mode : ${modeTxt}
┣━━━━━━━━━━━━━━━━━━
┃ 📢 Rejoins la chaîne officielle
┃ 🔔 Updates • News • Support
╰━━━━━━━━━━━━━━━━━━╯`,
          contextInfo: channelCardContext()
        });
      } catch (err) {
        console.log("WELCOME MSG ERROR:", err?.message || err);
      }
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // --- Welcome / Goodbye (sans preview chaîne)
  sock.ev.on("group-participants.update", async (ev) => {
    try {
      const db = readWelcomeDb();
      if (!db.welcome && !db.goodbye) return;

      const gid = ev.id;
      if (!gid || !gid.endsWith("@g.us")) return;

      const meta = await sock.groupMetadata(gid);
      const subject = meta?.subject || "Groupe";

      for (const user of (ev.participants || [])) {
        const mention = "@" + String(user).split("@")[0];

        if (ev.action === "add" && db.welcome) {
          await sock.sendMessage(gid, {
            text:
`👋 *Bienvenue* ${mention} !
👥 Groupe : *${subject}*
🤖 Bot : *${config.BOT_NAME || "NOVA XMD V1"}*`,
            mentions: [user]
          });
        }

        if (ev.action === "remove" && db.goodbye) {
          await sock.sendMessage(gid, {
            text:
`👋 *Au revoir* ${mention}
👥 Groupe : *${subject}*
🤖 Bot : *${config.BOT_NAME || "NOVA XMD V1"}*`,
            mentions: [user]
          });
        }
      }
    } catch (e) {
      console.log("WELCOME/GOODBYE ERROR:", e?.message || e);
    }
  });

  // --- Messages upsert (commands + store antidelete) ---
  sock.ev.on("messages.upsert", async (chatUpdate) => {
    try {
      const m = chatUpdate.messages?.[0];
      if (!m || !m.message) return;

      const jid = m.key.remoteJid;

      // ✅ AutoStatus ON/OFF
      if (jid === "status@broadcast") {
        try {
          const st = readAutoStatus();
          if (st.enabled) await sock.readMessages([m.key]);
        } catch {}
        return;
      }

      // store antidelete (2 keys)
      global.msgStore[m.key.id] = m;
      global.msgStore[`${m.key.remoteJid}:${m.key.id}`] = m;

      setTimeout(() => {
        delete global.msgStore[m.key.id];
        delete global.msgStore[`${m.key.remoteJid}:${m.key.id}`];
      }, 7200000);

      try { await newsletterHandler(sock, m); } catch {}

      const cmdHandler = require("./case.js");
      const usedPrefix = config.PREFIX || ".";
      await cmdHandler(
        sock,
        m,
        usedPrefix,
        (newMode) => { currentMode = String(newMode || "public").toLowerCase(); },
        currentMode
      );
    } catch (err) {
      console.log("UPSERT ERROR:", err?.message || err);
    }
  });

  // --- messages.update (antidelete) ---
  sock.ev.on("messages.update", async (updates) => {
    try {
      for (const upd of updates) {
        await antideleteHandler(sock, upd);
      }
    } catch (e) {
      console.log("messages.update error:", e?.message || e);
    }
  });

  return sock;
}

// ===============================
// RESTORE SESSIONS
// ===============================
async function restoreSessions() {
  if (!fs.existsSync(sessionsDir)) return;

  const folders = fs.readdirSync(sessionsDir);
  for (const folder of folders) {
    if (folder.startsWith("session_")) {
      const phoneNumber = folder.replace("session_", "");
      console.log(`🔄 Restore: ${phoneNumber}`);
      await startUserBot(phoneNumber);
      await delay(4000);
    }
  }
}

// ===============================
// ROUTES
// ===============================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ✅ /pair (stable)
app.get("/pair", async (req, res) => {
  try {
    const num = String(req.query.number || "").replace(/[^0-9]/g, "");
    if (!num || num.length < 8) return res.status(400).json({ error: "Numéro invalide" });

    const sock = await startUserBot(num, true);

    // ✅ attendre OPEN (plus fiable)
    try { await waitConnectionOpen(sock, 12000); } catch {}

    // ✅ petit délai pour laisser WA ready
    await delay(1200);

    const code = await sock.requestPairingCode(num);
    return res.json({ code });
  } catch (e) {
    console.log("PAIR ERROR:", e?.message || e);
    return res.status(500).json({ error: "Impossible de générer le code" });
  }
});

// ===============================
// SERVER
// ===============================
app.listen(port, async () => {
  console.log(`🌐 ${config.BOT_NAME || "NOVA XMD V1"} prêt : http://localhost:${port}`);
  global.botStartTime = Date.now();
  await restoreSessions();
});