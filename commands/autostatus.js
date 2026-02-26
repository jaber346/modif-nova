// commands/autostatus.js
const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/autostatus.json");

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
function saveDb(db) {
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

module.exports = {
  name: "autostatus",
  category: "Tools",
  description: "AutoStatus on/off + forward on/off",

  async execute(sock, m, args, { isOwner, prefix } = {}) {
    const from = m.key.remoteJid;
    if (!isOwner) {
      return sock.sendMessage(from, { text: "🚫 Owner seulement." }, { quoted: m });
    }

    const sub = (args[0] || "").toLowerCase();
    const db = readDb();

    if (sub === "on") {
      db.enabled = true;
      saveDb(db);
      return sock.sendMessage(from, { text: "✅ AutoStatus activé." }, { quoted: m });
    }
    if (sub === "off") {
      db.enabled = false;
      saveDb(db);
      return sock.sendMessage(from, { text: "❌ AutoStatus désactivé." }, { quoted: m });
    }
    if (sub === "forward") {
      const v = (args[1] || "").toLowerCase();
      if (v !== "on" && v !== "off") {
        return sock.sendMessage(from, { text: `Utilisation : ${prefix}autostatus forward on|off` }, { quoted: m });
      }
      db.forwardToOwner = v === "on";
      saveDb(db);
      return sock.sendMessage(from, { text: `✅ Forward : *${db.forwardToOwner ? "ON" : "OFF"}*` }, { quoted: m });
    }

    return sock.sendMessage(from, {
      text:
`Utilisation :
${prefix}autostatus on
${prefix}autostatus off
${prefix}autostatus forward on|off`
    }, { quoted: m });
  }
};
