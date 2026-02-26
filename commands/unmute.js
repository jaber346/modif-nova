module.exports = {
  name: "unmute",
  category: "Group",
  description: "Ouvre le groupe (tout le monde peut écrire)",

  async execute(sock, m, args, { isGroup, isBotAdmin, isAdminOrOwner, prefix } = {}) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Commande groupe uniquement." }, { quoted: m });
    }
    if (!isAdminOrOwner) {
      return sock.sendMessage(from, { text: "🚫 Admin seulement." }, { quoted: m });
    }
    if (!isBotAdmin) {
      return sock.sendMessage(from, { text: "❌ Je dois être *admin* pour unmute." }, { quoted: m });
    }

    try {
      await sock.groupSettingUpdate(from, "not_announcement"); // ouvre
      return sock.sendMessage(from, { text: `🔊 Groupe *unmuté*.\nTout le monde peut écrire.\n\nUtilisation: ${prefix || "."}mute` }, { quoted: m });
    } catch (e) {
      return sock.sendMessage(from, { text: "❌ Impossible de unmute (droits manquants ou erreur WhatsApp)." }, { quoted: m });
    }
  }
};