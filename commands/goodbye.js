const fs = require("fs");
const path = require("path");

const dbPath = path.join(__dirname, "../data/welcome.json");

function readDb() {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ welcome: false, goodbye: false }, null, 2));
  }
  return JSON.parse(fs.readFileSync(dbPath));
}

module.exports = {
  name: "goodbye",
  category: "Group",
  description: "goodbye on/off",

  async execute(sock, m, args, { isGroup, prefix }) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Groupe uniquement." }, { quoted: m });
    }

    const db = readDb();

    if (args[0] === "on") {
      db.goodbye = true;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, { text: "✅ Goodbye activé." }, { quoted: m });
    }

    if (args[0] === "off") {
      db.goodbye = false;
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
      return sock.sendMessage(from, { text: "❌ Goodbye désactivé." }, { quoted: m });
    }

    return sock.sendMessage(from, {
      text: `Utilisation : ${prefix}goodbye on/off`
    }, { quoted: m });
  }
};