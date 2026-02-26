const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/autostatus.json");

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ enabled: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath));
}

module.exports = {
  name: "autostatus",
  category: "Owner",
  description: "Activer ou désactiver la lecture automatique des statuts",

  async execute(sock, m, args, { isOwner, prefix }) {
    const from = m.key.remoteJid;

    if (!isOwner) {
      return sock.sendMessage(from, {
        text: "🚫 Commande réservée au propriétaire."
      }, { quoted: m });
    }

    const db = readDb();

    if (args[0] === "on") {
      db.enabled = true;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, {
        text: "✅ AutoStatus activé.\nLe bot verra automatiquement les statuts."
      }, { quoted: m });
    }

    if (args[0] === "off") {
      db.enabled = false;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, {
        text: "❌ AutoStatus désactivé."
      }, { quoted: m });
    }

    return sock.sendMessage(from, {
      text: `Utilisation : ${prefix}autostatus on/off`
    }, { quoted: m });
  }
};