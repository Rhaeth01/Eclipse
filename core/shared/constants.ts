/**
 * Constantes partagées entre commands.ts et DiscordManager.ts
 * Évite la duplication de ~300 lignes de données statiques.
 */

export const asciiMap: Record<string, string> = {
    'A': ' ██████\n██    ██\n████████\n██    ██\n██    ██',
    'B': '███████\n██    ██\n███████\n██    ██\n███████',
    'C': ' ██████\n██      \n██      \n██      \n ██████',
    'D': '███████ \n██    ██\n██    ██\n██    ██\n███████',
    'E': '████████\n██      \n██████  \n██      \n████████',
    'F': '████████\n██      \n██████  \n██      \n██      ',
    'G': ' ██████ \n██      \n██  ████\n██    ██\n ██████',
    'H': '██    ██\n██    ██\n████████\n██    ██\n██    ██',
    'I': '██\n██\n██\n██\n██',
    'J': '      ██\n      ██\n      ██\n██    ██\n ██████',
    'K': '██    ██\n██   ██ \n██████  \n██   ██ \n██    ██',
    'L': '██      \n██      \n██      \n██      \n████████',
    'M': '███    ███\n████  ████\n██ ████ ██\n██  ██  ██\n██      ██',
    'N': '███     ██\n████    ██\n██ ██   ██\n██  ██  ██\n██   ████',
    'O': ' ██████ \n██    ██\n██    ██\n██    ██\n ██████',
    'P': '███████ \n██    ██\n███████ \n██      \n██      ',
    'Q': ' ██████ \n██    ██\n██    ██\n██   ███\n ██████ ██',
    'R': '███████ \n██    ██\n███████ \n██   ██ \n██    ██',
    'S': ' ███████\n██      \n ███████\n      ██\n███████',
    'T': '████████\n   ██   \n   ██   \n   ██   \n   ██   ',
    'U': '██    ██\n██    ██\n██    ██\n██    ██\n ██████',
    'V': '██    ██\n██    ██\n██    ██\n ███  ██\n   ████',
    'W': '██      ██\n██  ██  ██\n██ ████ ██\n████  ████\n██      ██',
    'X': '██    ██\n ███  ██\n   ████  \n ███  ██\n██    ██',
    'Y': '██    ██\n ███  ██\n   ████  \n   ██   \n   ██   ',
    'Z': '████████\n    ███ \n   ███  \n  ███   \n████████'
};

export const smallCaps: Record<string, string> = {
    'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ', 'g': 'ɢ',
    'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ', 'm': 'ᴍ', 'n': 'ɴ',
    'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ', 's': 's', 't': 'ᴛ', 'u': 'ᴜ',
    'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x', 'y': 'ʏ', 'z': 'ᴢ',
    'A': 'ᴀ', 'B': 'ʙ', 'C': 'ᴄ', 'D': 'ᴅ', 'E': 'ᴇ', 'F': 'ғ', 'G': 'ɢ',
    'H': 'ʜ', 'I': 'ɪ', 'J': 'ᴊ', 'K': 'ᴋ', 'L': 'ʟ', 'M': 'ᴍ', 'N': 'ɴ',
    'O': 'ᴏ', 'P': 'ᴘ', 'Q': 'ǫ', 'R': 'ʀ', 'S': 's', 'T': 'ᴛ', 'U': 'ᴜ',
    'V': 'ᴠ', 'W': 'ᴡ', 'X': 'x', 'Y': 'ʏ', 'Z': 'ᴢ'
};

export const fullwidth: Record<string, string> = {
    'a': 'ａ', 'b': 'ｂ', 'c': 'ｃ', 'd': 'ｄ', 'e': 'ｅ', 'f': 'ｆ', 'g': 'ｇ',
    'h': 'ｈ', 'i': 'ｉ', 'j': 'ｊ', 'k': 'ｋ', 'l': 'ｌ', 'm': 'ｍ', 'n': 'ｎ',
    'o': 'ｏ', 'p': 'ｐ', 'q': 'ｑ', 'r': 'ｒ', 's': 'ｓ', 't': 'ｔ', 'u': 'ｕ',
    'v': 'ｖ', 'w': 'ｗ', 'x': 'ｘ', 'y': 'ｙ', 'z': 'ｚ',
    'A': 'Ａ', 'B': 'Ｂ', 'C': 'Ｃ', 'D': 'Ｄ', 'E': 'Ｅ', 'F': 'Ｆ', 'G': 'Ｇ',
    'H': 'Ｈ', 'I': 'Ｉ', 'J': 'Ｊ', 'K': 'Ｋ', 'L': 'Ｌ', 'M': 'Ｍ', 'N': 'Ｎ',
    'O': 'Ｏ', 'P': 'Ｐ', 'Q': 'Ｑ', 'R': 'Ｒ', 'S': 'Ｓ', 'T': 'Ｔ', 'U': 'Ｕ',
    'V': 'Ｖ', 'W': 'Ｗ', 'X': 'Ｘ', 'Y': 'Ｙ', 'Z': 'Ｚ',
    '0': '０', '1': '１', '2': '２', '3': '３', '4': '４',
    '5': '５', '6': '６', '7': '７', '8': '８', '9': '９',
    ' ': '　', '!': '！', '?': '？', '.': '．', ',': '，'
};

export const emojiMap: Record<string, string> = {
    'a': '🇦', 'b': '🇧', 'c': '🇨', 'd': '🇩', 'e': '🇪', 'f': '🇫', 'g': '🇬',
    'h': '🇭', 'i': '🇮', 'j': '🇯', 'k': '🇰', 'l': '🇱', 'm': '🇲', 'n': '🇳',
    'o': '🇴', 'p': '🇵', 'q': '🇶', 'r': '🇷', 's': '🇸', 't': '🇹', 'u': '🇺',
    'v': '🇻', 'w': '🇼', 'x': '🇽', 'y': '🇾', 'z': '🇿',
    'A': '🅰️', 'B': '🅱️', 'C': '©️⃣', 'D': '🇩', 'E': '🇪', 'F': '🇫', 'G': '🇬',
    'H': '♓', 'I': 'ℹ️', 'J': '🇯', 'K': '🇰', 'L': '🇱', 'M': 'ⓜ️', 'N': '🇳',
    'O': '🅾️', 'P': '🅿️', 'Q': '🇶', 'R': '🇷', 'S': '🇸', 'T': '🇹', 'U': '🇺',
    'V': '🇻', 'W': '🇼', 'X': '❌', 'Y': '🇾', 'Z': 'Ⓩ',
    '0': '0️⃣', '1': '1️⃣', '2': '2️⃣', '3': '3️⃣', '4': '4️⃣',
    '5': '5️⃣', '6': '6️⃣', '7': '7️⃣', '8': '8️⃣', '9': '9️⃣',
    ' ': '  ', '!': '❗', '?': '❓', '.': '▪️'
};

export const responses: string[] = [
    '✅ Absolument!', '❌ Non.', '🤔 Peut-être...', '✨ Les signes disent oui',
    '🚫 Pas question', '🔮 Les étoiles sont incertaines', '😂 Bonne chance avec ça',
    '👍 Oui, définitivement', '👎 Ma réponse est non', '😶 Je ne peux pas répondre maintenant',
    '🤨 Demande à nouveau plus tard', '🌟 Concentration et demande encore',
    '💯 Sans aucun doute', '🙅‍♂️ Compte pas dessus', '🎯 C\'est certain'
];

export const roasts: string[] = [
    'Tu es comme un nuage... quand tu disparais, la journée devient plus belle.',
    'Je ne te insulte pas, je te décris.',
    'Tu as quelque chose en commun avec les étoiles, tu es invisible le jour.',
    'Si l\'intelligence était une monnaie, tu serais en faillite.',
    'Tu es la raison pour laquelle il y a des instructions sur les shampooings.',
    'Je t\'aimerais autant qu\'une calculatrice sans piles.',
    'Tu n\'es pas stupide, tu possèdes juste une chance négative de réussir.',
    'Si tu étais une épice, tu serais de la farine.',
    'Ton cerveau a trop de pages blanches.',
    'Tu es comme un logiciel gratuit, tout le monde utilise ton WiFi mais personne ne veut de toi.'
];

export const compliments: string[] = [
    'Tu es aussi brillant qu\'une supernova! 🌟',
    'Ton sourire pourrait éclairer une pièce sombre. 😊',
    'Tu es la preuve que la perfection existe. ✨',
    'Ton intelligence est impressionnante! 🧠',
    'Tu rends le monde meilleur juste en étant là. 🌍',
    'Tu es plus unique qu\'une licorne! 🦄',
    'Ta gentillesse est contagieuse. 💝',
    'Tu es un rayon de soleil humain. ☀️',
    'Ton humour est meilleur que la moyenne. 😄',
    'Tu es la personne la plus cool que je connaisse! 😎'
];

export const jokes: string[] = [
    'Pourquoi les plongeurs plongent-ils toujours en arrière? Parce que sinon ils tombent dans le bateau!',
    'Quel est le comble pour un électricien? De ne pas être au courant.',
    'Pourquoi les maths sont tristes? Parce qu\'elles ont trop de problèmes.',
    'Que dit un informaticien quand il s\'ennuie? Je vais me faire un café, ça va me réveiller le système.',
    'Pourquoi les squelettes ne se battent jamais entre eux? Parce qu\'ils n\'ont pas de tripes.',
    'Quel est le sport le plus fruité? La boxe, parce qu\'ils finissent tous en jus.',
    'Pourquoi les vaches regardent-elles les trains passer? Pour voir les wagons-boeufs.',
    'Quel est le comble pour un prof de français? De faire des fotes.',
    'Pourquoi les poissons détestent l\'ordinateur? Parce qu\'ils ont peur du net.',
    'Que dit une maman tomate à sa petite tomate qui traîne? Ketchup!'
];

export const steps: string[] = [
    '🔍 Recherche de l\'IP...',
    '💻 Connexion au serveur...',
    '📁 Téléchargement des données...',
    '🔓 Décryptage du mot de passe...',
    '💳 Récupération des informations bancaires...',
    '📸 Accès à la webcam...',
    '✅ Hack terminé!'
];
