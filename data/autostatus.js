// data/autostatus.js
// Auto view/download statuses (WhatsApp Status) + optional forward to owner

const fs = require("fs");
const path = require("path");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");

const dbPath = path.join(__dirname, "autostatus.json");

function ensureDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ enabled: false, forwardToOwner: false }, null, 2));
  }
}
function readDb() {
  ensureDb();
  try { return JSON.parse(fs.readFileSync(dbPath, "utf8")); }
  catch { return { enabled: false, forwardToOwner: false }; }
}

function ownerJid() {
  const cfg = require("../config");
  return String(cfg.OWNER_NUMBER || "").replace(/[^0-9]/g, "") + "@s.whatsapp.net";
}

async function streamToBuffer(stream) {
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return buffer;
}

module.exports = async function autoStatusHandler(sock, m) {
  const db = readDb();
  if (!db.enabled) return;

  const from = m.key?.remoteJid;
  if (from !== "status@broadcast") return;

  // ✅ Marquer "vu" (important)
  try { await sock.readMessages([m.key]); } catch {}

  // récupérer le vrai message de statut
  const msg = m.message || {};
  const type = Object.keys(msg)[0];
  if (!type) return;

  // Status peut être dans ephemeral/viewonce wrappers
  let inner = msg;
  if (type === "ephemeralMessage") inner = msg.ephemeralMessage?.message || {};
  const t2 = Object.keys(inner)[0];

  // image status
  if (t2 === "imageMessage") {
    const stream = await downloadContentFromMessage(inner.imageMessage, "image");
    const buffer = await streamToBuffer(stream);

    if (db.forwardToOwner) {
      await sock.sendMessage(ownerJid(), {
        image: buffer,
        caption: "✅ AutoStatus (Image)",
      });
    }
    return;
  }

  // video status
  if (t2 === "videoMessage") {
    const stream = await downloadContentFromMessage(inner.videoMessage, "video");
    const buffer = await streamToBuffer(stream);

    if (db.forwardToOwner) {
      await sock.sendMessage(ownerJid(), {
        video: buffer,
        caption: "✅ AutoStatus (Vidéo)",
      });
    }
    return;
  }

  // texte status (rare)
  if (t2 === "extendedTextMessage") {
    const text = inner.extendedTextMessage?.text || "";
    if (db.forwardToOwner && text) {
      await sock.sendMessage(ownerJid(), { text: "✅ AutoStatus (Texte)\n\n" + text });
    }
    return;
  }
};
