module.exports = {
  name: "mute",
  category: "Group",
  description: "Ferme le groupe (seuls les admins peuvent écrire)",

  async execute(sock, m, args, { isGroup, isBotAdmin, isAdminOrOwner, prefix } = {}) {
    const from = m.key.remoteJid;

    if (!isGroup) {
      return sock.sendMessage(from, { text: "❌ Commande groupe uniquement." }, { quoted: m });
    }
    if (!isAdminOrOwner) {
      return sock.sendMessage(from, { text: "🚫 Admin seulement." }, { quoted: m });
    }
    if (!isBotAdmin) {
      return sock.sendMessage(from, { text: "❌ Je dois être *admin* pour mute." }, { quoted: m });
    }

    try {
      await sock.groupSettingUpdate(from, "announcement"); // ferme
      return sock.sendMessage(from, { text: `🔇 Groupe *muté*.\nSeuls les admins peuvent écrire.\n\nUtilisation: ${prefix || "."}unmute` }, { quoted: m });
    } catch (e) {
      return sock.sendMessage(from, { text: "❌ Impossible de mute (droits manquants ou erreur WhatsApp)." }, { quoted: m });
    }
  }
};