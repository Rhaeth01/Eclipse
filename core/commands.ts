import { DiscordUserClient, IMessage, IChannel, Permissions } from './discord';
import { asciiMap, smallCaps, fullwidth, emojiMap, responses, roasts, compliments, jokes, steps } from './shared/constants';

// Définition de la structure d'une commande
export interface Command {
    name: string;
    description: string;
    usage: string;
    execute: (client: DiscordUserClient, message: IMessage, args: string[]) => Promise<void>;
}

export class CommandManager {
    private commands: Map<string, Command> = new Map();
    public prefix: string = '.';

    constructor() {
        this.registerCommands();
    }

    private registerCommands() {
        // ============== COMMANDES BASIQUES ==============

        this.commands.set('ping', {
            name: 'ping',
            description: 'Vérifie la latence du selfbot',
            usage: '.ping',
            execute: async (client, message, args) => {
                const start = Date.now();
                await message.edit('🏓 Pong!');
                const latency = Date.now() - start;
                await message.edit(`🏓 Pong! \`${latency}ms\``);
            }
        });

        this.commands.set('help', {
            name: 'help',
            description: 'Affiche la liste des commandes',
            usage: '.help',
            execute: async (client, message, args) => {
                const categories = {
                    'Basiques': ['ping', 'help', 'stats'],
                    'Modération': ['clear', 'purge'],
                    'Fun': ['mimic', 'spam', 'react', 'tts', 'ascii', 'mock', 'nighty', 'vaporwave', 'reverse', 'clap', 'emojify', 'shrug', 'tableflip', 'unflip', 'lenny', 'roll', 'coinflip', '8ball', 'choose', 'love', 'roast', 'compliment', 'joke', 'ship', 'rate'],
                    'Utilitaires': ['snipe', 'editsnipe', 'avatar', 'userinfo', 'serverinfo', 'calc', 'poll', 'remind', 'password', 'base64', 'binary', 'color', 'deploy'],
                    'Troll': ['ghostping', 'reactroll', 'autoreply', 'typing', 'disconnect', 'hack', 'virus', 'annoy', 'dmall']
                };

                let helpText = '**🌙 Eclipse - Commandes**\n\n';

                for (const [category, cmds] of Object.entries(categories)) {
                    helpText += `**${category}**\n`;
                    for (const cmdName of cmds) {
                        const cmd = this.commands.get(cmdName);
                        if (cmd) {
                            helpText += `\`${this.prefix}${cmd.name}\` - ${cmd.description}\n`;
                        }
                    }
                    helpText += '\n';
                }

                await message.edit(helpText);
            }
        });

        this.commands.set('stats', {
            name: 'stats',
            description: 'Affiche les statistiques du compte',
            usage: '.stats',
            execute: async (client, message, args) => {
                const user = client.user;
                if (!user) return;

                const stats = `
**📊 Statistiques**

👤 Nom: ${user.tag}
🆔 ID: ${user.id}
📅 Créé: <t:${Math.floor(user.createdTimestamp / 1000)}:R>
🏰 Serveurs: ${client.guilds.cache.size}
👥 Amis: ${client.users.cache.size}
                `.trim();

                await message.edit(stats);
            }
        });

        // ============== COMMANDES MODÉRATION ==============

        this.commands.set('clear', {
            name: 'clear',
            description: 'Supprime vos messages (1-100)',
            usage: '.clear <nombre>',
            execute: async (client, message, args) => {
                const count = parseInt(args[0], 10);
                if (isNaN(count) || count <= 0 || count > 100) {
                    await message.edit('❌ Utilisation : `.clear <nombre>` (1-100)');
                    return;
                }

                await message.edit(`🔄 Suppression de ${count} messages...`);

                try {
                    const messages = await message.channel.messages.fetch({ limit: 100 });
                    const msgArray = Array.from(messages instanceof Map ? messages.values() : [messages]).filter((m): m is IMessage => !!m);
                    const myMessages = msgArray.filter(m => m.author.id === client.user?.id).slice(0, count);

                    for (const m of myMessages) {
                        if (!m) continue;
                        await m.delete().catch(() => { });
                        await new Promise(r => setTimeout(r, 500 + Math.random() * 200));
                    }
                } catch (e) {
                    console.error("[Command] Erreur clear :", e);
                }
            }
        });

        this.commands.set('purge', {
            name: 'purge',
            description: 'Supprime les messages de quelqu\'un (besoin de permissions)',
            usage: '.purge @user <nombre>',
            execute: async (client, message, args) => {
                if (!message.guild) {
                    await message.edit('❌ Commande serveur uniquement');
                    return;
                }

                const target = message.mentions.users.first();
                const count = parseInt(args[1], 10);

                if (!target || isNaN(count) || count <= 0) {
                    await message.edit('❌ Utilisation : `.purge @user <nombre>`');
                    return;
                }

                try {
                    const channel = message.channel;
                    const messages = await channel.messages.fetch({ limit: 100 });
                    const msgArray = Array.from(messages instanceof Map ? messages.values() : [messages]).filter((m): m is IMessage => !!m);
                    const targetMessages = msgArray.filter(m => m.author.id === target.id).slice(0, count);

                    // Supprime un par un car bulkDelete nécessite des permissions
                    for (const m of targetMessages) {
                        if (!m) continue;
                        await m.delete().catch(() => { });
                        await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
                    }

                    await message.delete().catch(() => { });
                } catch (e) {
                    await message.edit('❌ Erreur lors de la purge').catch(() => { });
                }
            }
        });

        // ============== COMMANDES FUN ==============

        this.commands.set('mimic', {
            name: 'mimic',
            description: 'Imite quelqu\'un avec webhook (nécessite permissions)',
            usage: '.mimic @user <message>',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first();
                if (!target) {
                    await message.edit('❌ Mentionne quelqu\'un : `.mimic @user message`');
                    return;
                }

                const mimicText = args.slice(1).join(' ');
                if (!mimicText) {
                    await message.edit('❌ Ajoute un message à envoyer');
                    return;
                }

                try {
                    let targetChannel: IChannel = message.channel;
                    let threadId: string | undefined = undefined;

                    if (message.channel.isThread()) {
                        targetChannel = message.channel.parent || message.channel;
                        threadId = message.channel.id;
                    }

                    // Crée un webhook temporaire
                    const webhook = await targetChannel.createWebhook(target.username, {
                        avatar: target.displayAvatarURL()
                    });

                    await webhook.send({ content: mimicText, threadId });
                    await webhook.delete();
                    await message.delete().catch(() => { });
                } catch (e) {
                    // v0.4.1: .catch() car message.delete() a pu supprimer le msg de commande
                    await message.edit('❌ Impossible de créer le webhook (permissions ?)').catch(() => { });
                }
            }
        });

        this.commands.set('spam', {
            name: 'spam',
            description: 'Spam un message (dangereux - rate limit)',
            usage: '.spam <nombre> <message>',
            execute: async (client, message, args) => {
                const count = parseInt(args[0], 10);
                const spamText = args.slice(1).join(' ');

                if (isNaN(count) || count <= 0 || count > 20 || !spamText) {
                    await message.edit('❌ Utilisation : `.spam <nombre> <message>` (max 20)');
                    return;
                }

                await message.delete().catch(() => { });

                for (let i = 0; i < count; i++) {
                    await message.channel.send(spamText).catch(() => { });
                    await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
                }
            }
        });

        this.commands.set('react', {
            name: 'react',
            description: 'Ajoute une réaction au dernier message',
            usage: '.react <emoji>',
            execute: async (client, message, args) => {
                const emoji = args[0];
                if (!emoji) {
                    await message.edit('❌ Ajoute un emoji : `.react 😎`');
                    return;
                }

                try {
                    const messages = await message.channel.messages.fetch({ limit: 2 });
                    const msgArray = Array.from(messages instanceof Map ? messages.values() : [messages]).filter((m): m is IMessage => !!m);
                    const targetMessage = msgArray.find(m => m && m.id !== message.id);

                    if (targetMessage) {
                        await targetMessage.react(emoji);
                        await message.delete().catch(() => { });
                    }
                } catch (e) {
                    // v0.4.1 (audit fix): .catch() car message.delete() a pu
                    // supprimer le message de commande avant qu'on tente d'éditer
                    await message.edit('❌ Impossible de réagir').catch(() => { });
                }
            }
        });

        this.commands.set('tts', {
            name: 'tts',
            description: 'Envoie un message TTS',
            usage: '.tts <message>',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                if (!text) {
                    await message.edit('❌ Ajoute un message');
                    return;
                }

                await message.delete().catch(() => { });
                await message.channel.send({ content: text, tts: true });
            }
        });

        this.commands.set('ascii', {
            name: 'ascii',
            description: 'Convertit du texte en ASCII art',
            usage: '.ascii <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ').toUpperCase();
                if (!text || text.length > 10) {
                    await message.edit('❌ Texte trop long (max 10 caractères)');
                    return;
                }

                // Simple ASCII art
                let result = '';
                for (const char of text) {
                    if (asciiMap[char]) {
                        result += asciiMap[char] + '\n\n';
                    }
                }

                if (result.length > 2000) {
                    await message.edit('❌ Résultat trop long');
                    return;
                }

                await message.edit('```\n' + result + '\n```');
            }
        });

        this.commands.set('mock', {
            name: 'mock',
            description: 'MoCkInG sPoNgEbOb TeXt',
            usage: '.mock <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                if (!text) {
                    await message.edit('❌ Ajoute un texte');
                    return;
                }

                let mocked = '';
                for (let i = 0; i < text.length; i++) {
                    mocked += i % 2 === 0 ? text[i].toLowerCase() : text[i].toUpperCase();
                }

                await message.edit(mocked);
            }
        });

        // ============== COMMANDES FUN TEXTE (NIGHTY STYLE) ==============

        this.commands.set('nighty', {
            name: 'nighty',
            description: 'Convertit le texte en style small caps (ɴɪɢʜᴛʏ)',
            usage: '.nighty <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                if (!text) {
                    await message.edit('❌ Ajoute un texte : `.nighty hello`');
                    return;
                }

                const result = text.split('').map(char => smallCaps[char] || char).join('');
                await message.edit(result);
            }
        });

        this.commands.set('vaporwave', {
            name: 'vaporwave',
            description: 'Convertit le texte en fullwidth (ｖａｐｏｒｗａｖｅ)',
            usage: '.vaporwave <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                if (!text) {
                    await message.edit('❌ Ajoute un texte : `.vaporwave hello`');
                    return;
                }

                const result = text.split('').map(char => fullwidth[char] || char).join('');
                await message.edit(result);
            }
        });

        this.commands.set('reverse', {
            name: 'reverse',
            description: 'Inverse le texte (ʎʇɘxǝ ꞁꞁᴉʍ)',
            usage: '.reverse <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                if (!text) {
                    await message.edit('❌ Ajoute un texte : `.reverse hello`');
                    return;
                }

                const flipped: Record<string, string> = {
                    'a': 'ɒ', 'b': 'd', 'c': 'ɔ', 'd': 'b', 'e': 'ǝ', 'f': 'ɟ', 'g': 'ƃ',
                    'h': 'ɥ', 'i': 'ᴉ', 'j': 'ɾ', 'k': 'ʞ', 'l': 'ꞁ', 'm': 'ɯ', 'n': 'u',
                    'o': 'o', 'p': 'd', 'q': 'b', 'r': 'ɹ', 's': 's', 't': 'ʇ', 'u': 'n',
                    'v': 'ʌ', 'w': 'ʍ', 'x': 'x', 'y': 'ʎ', 'z': 'z',
                    'A': 'Ɐ', 'B': 'ᗺ', 'C': 'Ɔ', 'D': 'ᗡ', 'E': 'Ǝ', 'F': 'ᖵ', 'G': '⅁',
                    'H': 'H', 'I': 'I', 'J': 'ᒐ', 'K': 'ʞ', 'L': '⅃', 'M': 'M', 'N': 'N',
                    'O': 'O', 'P': 'Ԁ', 'Q': 'Ỏ', 'R': 'R', 'S': 'S', 'T': '┴', 'U': '∩',
                    'V': 'Λ', 'W': 'M', 'X': 'X', 'Y': '⅄', 'Z': 'Z',
                    '0': '0', '1': '⥜', '2': 'ς', '3': 'Ɛ', '4': 'ᔭ', '5': 'ϛ', '6': '9', '7': 'Ɫ', '8': 'Ȣ', '9': '6'
                };

                const result = text.split('').reverse().map(char => flipped[char] || char).join('');
                await message.edit(result);
            }
        });

        this.commands.set('clap', {
            name: 'clap',
            description: 'Ajoute des 👏 entre les mots',
            usage: '.clap <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                if (!text) {
                    await message.edit('❌ Ajoute un texte : `.clap hello world`');
                    return;
                }

                const result = text.split(' ').join(' 👏 ');
                await message.edit(`👏 ${result} 👏`);
            }
        });

        this.commands.set('emojify', {
            name: 'emojify',
            description: 'Convertit le texte en emojis',
            usage: '.emojify <texte>',
            execute: async (client, message, args) => {
                const text = args.join(' ').toLowerCase();
                if (!text) {
                    await message.edit('❌ Ajoute un texte : `.emojify hello`');
                    return;
                }

                const result = text.split('').map(char => emojiMap[char] || char).join(' ');
                await message.edit(result);
            }
        });

        this.commands.set('shrug', {
            name: 'shrug',
            description: '¯\_(ツ)_/¯',
            usage: '.shrug [texte]',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                const shrug = '¯\\_(ツ)_/¯';
                await message.edit(text ? `${text} ${shrug}` : shrug);
            }
        });

        this.commands.set('tableflip', {
            name: 'tableflip',
            description: '(╯°□°）╯︵ ┻━┻',
            usage: '.tableflip [texte]',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                const flip = '(╯°□°）╯︵ ┻━┻';
                await message.edit(text ? `${text} ${flip}` : flip);
            }
        });

        this.commands.set('unflip', {
            name: 'unflip',
            description: '┬─┬ ノ( ゜-゜ノ)',
            usage: '.unflip [texte]',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                const unflip = '┬─┬ ノ( ゜-゜ノ)';
                await message.edit(text ? `${text} ${unflip}` : unflip);
            }
        });

        this.commands.set('lenny', {
            name: 'lenny',
            description: '( ͡° ͜ʖ ͡°)',
            usage: '.lenny [texte]',
            execute: async (client, message, args) => {
                const text = args.join(' ');
                const lenny = '( ͡° ͜ʖ ͡°)';
                await message.edit(text ? `${text} ${lenny}` : lenny);
            }
        });

        // ============== COMMANDES UTILITAIRES ==============

        this.commands.set('avatar', {
            name: 'avatar',
            description: 'Affiche l\'avatar de quelqu\'un',
            usage: '.avatar [@user]',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first() || client.user;
                if (!target) return;

                const avatarURL = target.displayAvatarURL({ size: 4096 });
                await message.edit(`🖼️ Avatar de **${target.tag}**\n${avatarURL}`);
            }
        });

        this.commands.set('userinfo', {
            name: 'userinfo',
            description: 'Affiche les infos d\'un utilisateur',
            usage: '.userinfo [@user]',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first() || client.user;
                if (!target) return;

                const member = message.guild?.members.cache.get(target.id);

                const info = `
**👤 Infos sur ${target.tag}**

🆔 ID: \`${target.id}\`
📅 Créé: <t:${Math.floor(target.createdTimestamp / 1000)}:R>
🤖 Bot: ${target.bot ? 'Oui' : 'Non'}
${member ? `📥 Rejoint: <t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>` : ''}
                `.trim();

                await message.edit(info);
            }
        });

        this.commands.set('serverinfo', {
            name: 'serverinfo',
            description: 'Affiche les infos du serveur',
            usage: '.serverinfo',
            execute: async (client, message, args) => {
                if (!message.guild) {
                    await message.edit('❌ Commande serveur uniquement');
                    return;
                }

                const guild = message.guild;
                const info = `
**🏰 ${guild.name}**

🆔 ID: \`${guild.id}\`
👥 Membres: ${guild.memberCount}
📅 Créé: <t:${Math.floor(guild.createdTimestamp / 1000)}:R>
👑 Propriétaire: <@${guild.ownerId}>
💬 Salons: ${guild.channels.cache.size}
                `.trim();

                await message.edit(info);
            }
        });

        // ============== COMMANDES TROLL ==============

        this.commands.set('ghostping', {
            name: 'ghostping',
            description: 'Mentionne quelqu\'un puis supprime instantanément',
            usage: '.ghostping @user',
            execute: async (client, message, args) => {
                await message.delete().catch(() => { });
            }
        });

        this.commands.set('reactroll', {
            name: 'reactroll',
            description: 'Réagit automatiquement aux messages de quelqu\'un (toggle)',
            usage: '.reactroll @user <emoji>',
            execute: async (client, message, args) => {
                await message.edit('⚠️ Cette commande nécessite l\'activation via le Dashboard');
            }
        });

        this.commands.set('autoreply', {
            name: 'autoreply',
            description: 'Répond automatiquement à quelqu\'un (toggle)',
            usage: '.autoreply @user <message>',
            execute: async (client, message, args) => {
                await message.edit('⚠️ Cette commande nécessite l\'activation via le Dashboard');
            }
        });

        this.commands.set('typing', {
            name: 'typing',
            description: 'Indicateur d\'écriture infini pendant 60s',
            usage: '.typing',
            execute: async (client, message, args) => {
                await message.edit('⌨️ Typing activé pendant 60s...');

                const interval = setInterval(() => {
                    message.channel.sendTyping().catch(() => { });
                }, 7000 + Math.random() * 2000);

                setTimeout(() => {
                    clearInterval(interval);
                    message.delete().catch(() => { });
                }, 60000);
            }
        });

        // ============== COMMANDES UTILES SUPPLÉMENTAIRES ==============

        this.commands.set('calc', {
            name: 'calc',
            description: 'Calculatrice (opérations simples)',
            usage: '.calc <expression>',
            execute: async (client, message, args) => {
                const expression = args.join(' ');
                if (!expression) {
                    await message.edit('❌ Ajoute une expression : `.calc 2 + 2`');
                    return;
                }

                try {
                    // Sécurité: uniquement chiffres et opérateurs basiques
                    const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, '');
                    if (sanitized !== expression.replace(/\s/g, '')) {
                        await message.edit('❌ Caractères non autorisés. Uniquement: 0-9 + - * / ( )');
                        return;
                    }

                    // Évaluation sécurisée avec Function
                    const result = new Function('return ' + sanitized)();
                    await message.edit(`🧮 ${expression} = **${result}**`);
                } catch {
                    await message.edit('❌ Expression invalide');
                }
            }
        });

        this.commands.set('poll', {
            name: 'poll',
            description: 'Crée un sondage avec réactions',
            usage: '.poll <question> | option1 | option2 | ...',
            execute: async (client, message, args) => {
                const fullText = args.join(' ');
                const parts = fullText.split('|').map(p => p.trim()).filter(p => p);

                if (parts.length < 2) {
                    await message.edit('❌ Format: `.poll Question ? | Option 1 | Option 2`');
                    return;
                }

                const question = parts[0];
                const options = parts.slice(1, 10); // Max 9 options
                const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];

                let pollText = `📊 **${question}**\n\n`;
                options.forEach((opt, i) => {
                    pollText += `${emojis[i]} ${opt}\n`;
                });

                const pollMsg = await message.edit(pollText);

                // Ajoute les réactions
                for (let i = 0; i < options.length; i++) {
                    await pollMsg.react(emojis[i]).catch(() => { });
                }
            }
        });

        this.commands.set('remind', {
            name: 'remind',
            description: 'Rappel après X minutes',
            usage: '.remind <minutes> <message>',
            execute: async (client, message, args) => {
                const minutes = parseInt(args[0], 10);
                const reminderText = args.slice(1).join(' ');

                if (isNaN(minutes) || minutes <= 0 || minutes > 1440 || !reminderText) {
                    await message.edit('❌ Usage: `.remind 30 Prendre le gâteau au four` (max 24h)');
                    return;
                }

                await message.edit(`⏰ Rappel défini dans ${minutes} minutes!`);

                setTimeout(async () => {
                    try {
                        await message.channel.send(`🔔 <@${message.author.id}> Rappel: ${reminderText}`);
                    } catch { }
                }, minutes * 60 * 1000);
            }
        });

        this.commands.set('password', {
            name: 'password',
            description: 'Génère un mot de passe sécurisé',
            usage: '.password [longueur]',
            execute: async (client, message, args) => {
                const length = parseInt(args[0], 10) || 16;
                const maxLength = Math.min(length, 64);

                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
                let password = '';

                for (let i = 0; i < maxLength; i++) {
                    password += chars.charAt(Math.floor(Math.random() * chars.length));
                }

                await message.edit(`🔐 Mot de passe généré (${maxLength} caractères):\n||${password}||`);

                // Envoie en MP aussi
                try {
                    await message.author.send(`Voici ton mot de passe:\n\`${password}\``);
                } catch {
                    // MP fermés, on ignore
                }
            }
        });

        this.commands.set('base64', {
            name: 'base64',
            description: 'Encode ou decode en Base64',
            usage: '.base64 <texte> | .base64 decode <texte>',
            execute: async (client, message, args) => {
                const isDecode = args[0]?.toLowerCase() === 'decode';
                const text = isDecode ? args.slice(1).join(' ') : args.join(' ');

                if (!text) {
                    await message.edit('❌ Usage: `.base64 hello` ou `.base64 decode aGVsbG8=`');
                    return;
                }

                try {
                    if (isDecode) {
                        const decoded = Buffer.from(text, 'base64').toString('utf8');
                        await message.edit(`📜 Décode:\n\`${decoded}\``);
                    } else {
                        const encoded = Buffer.from(text).toString('base64');
                        await message.edit(`📜 Encodé:\n\`${encoded}\``);
                    }
                } catch {
                    await message.edit('❌ Erreur d\'encodage/décodage');
                }
            }
        });

        this.commands.set('binary', {
            name: 'binary',
            description: 'Convertit texte ↔ binaire',
            usage: '.binary <texte> | .binary decode <binaire>',
            execute: async (client, message, args) => {
                const isDecode = args[0]?.toLowerCase() === 'decode';
                const text = isDecode ? args.slice(1).join(' ') : args.join(' ');

                if (!text) {
                    await message.edit('❌ Usage: `.binary hello` ou `.binary decode 01101000`');
                    return;
                }

                try {
                    if (isDecode) {
                        const decoded = text.split(' ').map(bin =>
                            String.fromCharCode(parseInt(bin, 2))
                        ).join('');
                        await message.edit(`🔓 Décode:\n\`${decoded}\``);
                    } else {
                        const encoded = text.split('').map(char =>
                            char.charCodeAt(0).toString(2).padStart(8, '0')
                        ).join(' ');
                        await message.edit(`🔒 Binaire:\n\`${encoded}\``);
                    }
                } catch {
                    await message.edit('❌ Erreur de conversion');
                }
            }
        });

        this.commands.set('color', {
            name: 'color',
            description: 'Génère une couleur aléatoire ou affiche un code couleur',
            usage: '.color | .color #FF5733',
            execute: async (client, message, args) => {
                const input = args[0];

                if (input) {
                    // Affiche la couleur demandée
                    const hex = input.replace('#', '');
                    if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
                        await message.edit('❌ Format hex invalide. Exemple: `#FF5733`');
                        return;
                    }
                    const r = parseInt(hex.substr(0, 2), 16);
                    const g = parseInt(hex.substr(2, 2), 16);
                    const b = parseInt(hex.substr(4, 2), 16);

                    await message.edit(`🎨 Couleur #${hex.toUpperCase()}\nRGB: ${r}, ${g}, ${b}\nhttps://singlecolorimage.com/get/${hex}/100x100`);
                } else {
                    // Génère une couleur aléatoire
                    const randomColor = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
                    const r = parseInt(randomColor.substr(0, 2), 16);
                    const g = parseInt(randomColor.substr(2, 2), 16);
                    const b = parseInt(randomColor.substr(4, 2), 16);

                    await message.edit(`🎨 Couleur aléatoire: #${randomColor.toUpperCase()}\nRGB: ${r}, ${g}, ${b}\nhttps://singlecolorimage.com/get/${randomColor}/100x100`);
                }
            }
        });

        // ============== COMMANDES FUN SUPPLÉMENTAIRES ==============

        this.commands.set('roll', {
            name: 'roll',
            description: 'Lance un dé (1-100 par défaut ou précisez)',
            usage: '.roll | .roll 6 | .roll 2d6',
            execute: async (client, message, args) => {
                const input = args[0] || '100';

                if (input.includes('d')) {
                    // Format D&D: 2d6, 3d20, etc.
                    const [count, sides] = input.split('d').map(Number);
                    if (count > 0 && sides > 0 && count <= 10) {
                        const rolls = [];
                        let total = 0;
                        for (let i = 0; i < count; i++) {
                            const roll = Math.floor(Math.random() * sides) + 1;
                            rolls.push(roll);
                            total += roll;
                        }
                        await message.edit(`🎲 ${input}: [${rolls.join(', ')}] = **${total}**`);
                        return;
                    }
                }

                const max = parseInt(input, 10) || 100;
                const result = Math.floor(Math.random() * max) + 1;
                await message.edit(`🎲 Rolled **${result}** (1-${max})`);
            }
        });

        this.commands.set('coinflip', {
            name: 'coinflip',
            description: 'Pile ou Face',
            usage: '.coinflip',
            execute: async (client, message, args) => {
                const result = Math.random() < 0.5 ? '🪙 Pile' : '🪙 Face';
                await message.edit(result);
            }
        });

        this.commands.set('8ball', {
            name: '8ball',
            description: 'Pose une question à la boule magique',
            usage: '.8ball <question>',
            execute: async (client, message, args) => {
                const question = args.join(' ');
                if (!question) {
                    await message.edit('❌ Pose une question: `.8ball Est-ce que je vais réussir?`');
                    return;
                }

                const answer = responses[Math.floor(Math.random() * responses.length)];
                await message.edit(`🎱 **Question:** ${question}\n**Réponse:** ${answer}`);
            }
        });

        this.commands.set('choose', {
            name: 'choose',
            description: 'Choisit aléatoirement entre plusieurs options',
            usage: '.choose option1 | option2 | option3',
            execute: async (client, message, args) => {
                const fullText = args.join(' ');
                const options = fullText.split('|').map(o => o.trim()).filter(o => o);

                if (options.length < 2) {
                    await message.edit('❌ Format: `.choose Pizza | Burger | Sushi`');
                    return;
                }

                const choice = options[Math.floor(Math.random() * options.length)];
                await message.edit(`🤔 Je choisis: **${choice}**`);
            }
        });

        this.commands.set('love', {
            name: 'love',
            description: 'Calculateur d\'amour',
            usage: '.love @user | .love @user1 @user2',
            execute: async (client, message, args) => {
                const mentions = message.mentions.users;

                let user1, user2;
                if (mentions.size === 0) {
                    await message.edit('❌ Mentionne au moins une personne: `.love @crush`');
                    return;
                } else if (mentions.size === 1) {
                    user1 = message.author;
                    user2 = mentions.first()!;
                } else {
                    user1 = mentions.first()!;
                    user2 = mentions.at(1)!;
                }

                // Calcul "aléatoire" basé sur les IDs (toujours le même résultat pour la même paire)
                const combined = user1.id.slice(-4) + user2.id.slice(-4);
                const percentage = (parseInt(combined, 10) % 100) + 1;

                let emoji = percentage > 80 ? '💕' : percentage > 50 ? '❤️' : percentage > 20 ? '💔' : '🖤';

                await message.edit(`${emoji} **${user1.username}** + **${user2.username}** = **${percentage}%** d'amour!`);
            }
        });

        this.commands.set('roast', {
            name: 'roast',
            description: 'Envoie une pique humoristique',
            usage: '.roast [@user]',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first();
                const roast = roasts[Math.floor(Math.random() * roasts.length)];

                if (target) {
                    await message.edit(`🔥 <@${target.id}>, ${roast}`);
                } else {
                    await message.edit(`🔥 ${roast}`);
                }
            }
        });

        this.commands.set('compliment', {
            name: 'compliment',
            description: 'Envoie un compliment',
            usage: '.compliment [@user]',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first();
                const compliment = compliments[Math.floor(Math.random() * compliments.length)];

                if (target) {
                    await message.edit(`💝 <@${target.id}>, ${compliment}`);
                } else {
                    await message.edit(`💝 ${compliment}`);
                }
            }
        });

        this.commands.set('joke', {
            name: 'joke',
            description: 'Raconte une blague',
            usage: '.joke',
            execute: async (client, message, args) => {
                const joke = jokes[Math.floor(Math.random() * jokes.length)];
                await message.edit(`😄 ${joke}`);
            }
        });

        this.commands.set('ship', {
            name: 'ship',
            description: 'Ship deux personnes ensemble',
            usage: '.ship @user1 @user2',
            execute: async (client, message, args) => {
                const mentions = message.mentions.users;
                if (mentions.size < 2) {
                    await message.edit('❌ Mentionne deux personnes: `.ship @user1 @user2`');
                    return;
                }

                const user1 = mentions.first()!;
                const user2 = mentions.at(1)!;

                // Combine les noms (ship name)
                const name1 = user1.username.slice(0, Math.ceil(user1.username.length / 2));
                const name2 = user2.username.slice(Math.floor(user2.username.length / 2));
                const shipName = name1 + name2;

                const percentage = Math.floor(Math.random() * 100) + 1;
                const hearts = percentage > 80 ? '💕💕💕' : percentage > 60 ? '💕💕' : percentage > 40 ? '💕' : '💔';

                await message.edit(`🚢 **${user1.username}** x **${user2.username}**\nNom du ship: **${shipName}**\nCompatibilité: **${percentage}%** ${hearts}`);
            }
        });

        this.commands.set('rate', {
            name: 'rate',
            description: 'Note quelque chose sur 10',
            usage: '.rate <chose>',
            execute: async (client, message, args) => {
                const thing = args.join(' ') || 'rien';
                const rating = Math.floor(Math.random() * 11);
                const bar = '█'.repeat(rating) + '░'.repeat(10 - rating);

                await message.edit(`📊 Je note **${thing}**:\n**${rating}/10**\n${bar}`);
            }
        });

        // ============== COMMANDES TROLL SUPPLÉMENTAIRES ==============

        this.commands.set('disconnect', {
            name: 'disconnect',
            description: 'Fait semblant de se déconnecter (fake)',
            usage: '.disconnect',
            execute: async (client, message, args) => {
                await message.delete().catch(() => { });

                // Simule un message de déconnexion Discord
                const disconnectMsg: IMessage | void = await message.channel.send({
                    content: `**${client.user?.username}** s'est déconnecté du serveur.`,
                    tts: false
                }).catch(() => { });

                // Supprime après 5 secondes
                if (disconnectMsg) {
                    setTimeout(() => {
                        disconnectMsg.delete().catch(() => { });
                    }, 5000);
                }
            }
        });

        this.commands.set('hack', {
            name: 'hack',
            description: 'Simulation de hack (fake, pour troll)',
            usage: '.hack @user',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first();
                if (!target) {
                    await message.edit('❌ Mentionne quelqu\'un à hacker: `.hack @victim`');
                    return;
                }

                await message.edit(`🕵️ **HACKING ${target.username.toUpperCase()}...**`);

                for (let i = 0; i < steps.length; i++) {
                    await new Promise(r => setTimeout(r, 1500));
                    await message.edit(steps[i]);
                }

                await new Promise(r => setTimeout(r, 1000));
                await message.edit(`🎉 **${target.username}** a été hacké avec succès!\n📧 Email: ${target.username.toLowerCase()}@hacked.com\n🔑 Password: ${'x'.repeat(10)}\n💰 Solde: 0.00$ (pauvre!)`);
            }
        });

        this.commands.set('virus', {
            name: 'virus',
            description: 'Troll avec un faux virus',
            usage: '.virus',
            execute: async (client, message, args) => {
                await message.edit('⚠️ **ALERTE VIRUS DÉTECTÉ** ⚠️\n\nAnalyse du système en cours...');

                setTimeout(() => {
                    message.edit('🔴 Virus trouvé: **Trojan.Win32.Discord**\n📍 Localisation: C:\\Windows\\System32\\discord.exe\n\nSuppression... 0%');
                }, 2000);

                setTimeout(() => {
                    message.edit('🔴 Virus trouvé: **Trojan.Win32.Discord**\n📍 Localisation: C:\\Windows\\System32\\discord.exe\n\nSuppression... 50%');
                }, 4000);

                setTimeout(() => {
                    message.edit('✅ Virus supprimé avec succès!\n\n🔒 Votre système est sécurisé.\n\n*P.S: C\'était une blague 😄*');
                }, 6000);
            }
        });

        this.commands.set('annoy', {
            name: 'annoy',
            description: 'Spam mention silencieux (troll)',
            usage: '.annoy @user [nombre]',
            execute: async (client, message, args) => {
                const target = message.mentions.users.first();
                const count = Math.min(parseInt(args[1], 10) || 3, 5); // Max 5

                if (!target) {
                    await message.edit('❌ Mentionne quelqu\'un: `.annoy @user 3`');
                    return;
                }

                await message.delete().catch(() => { });

                for (let i = 0; i < count; i++) {
                    await message.channel.send(`<@${target.id}> 👋`).then(m => {
                        setTimeout(() => m.delete().catch(() => { }), 400 + Math.random() * 200);
                    });
                    await new Promise(r => setTimeout(r, 650 + Math.random() * 300));
                }
            }
        });

        this.commands.set('dmall', {
            name: 'dmall',
            description: 'Envoie un message à tous les membres du serveur (Admin seulement)',
            usage: '.dmall <message>',
            execute: async (client, message, args) => {
                if (!message.guild) {
                    await message.edit('❌ Commande serveur uniquement');
                    return;
                }

                // Vérifie si c'est bien l'admin qui utilise
                if (message.author.id !== message.guild.ownerId) {
                    await message.edit('❌ Seul le propriétaire du serveur peut utiliser cette commande');
                    return;
                }

                const msg = args.join(' ');
                if (!msg) {
                    await message.edit('❌ Ajoute un message: `.dmall Bonjour à tous!`');
                    return;
                }

                await message.edit('📨 Envoi en cours à tous les membres...');

                // v0.4.1 (audit fix): l'ancien code faisait `fetch(author.id).then(() => cache.values())`
                // mais `.then(() => ...)` retourne `void` et la closure du `.fetch` était ignorée.
                // Résultat: on lisait le cache au lieu du résultat du fetch, et comme
                // Discord ne cache pas les membres non-récents, .dmall n'envoyait
                // jamais rien (0 messages). Maintenant: await direct sur fetch().
                let members: any[] = [];
                try {
                  await message.guild.members.fetch();
                  members = Array.from(message.guild!.members.cache.values());
                } catch (_e) {
                  // fallback silencieux sur le cache (probablement vide)
                  members = Array.from(message.guild!.members.cache.values());
                }
                let sent = 0;

                for (const member of members) {
                    if (!member.id || (member as any).user?.bot) continue;
                    try {
                        await (member as any).send(`**Message de ${message.guild.name}:**\n${msg}`);
                        sent++;
                        await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
                    } catch (_e) {
                        // MP fermés
                    }
                }

                await message.edit(`✅ Message envoyé à ${sent} membres!`);
            }
        });

        // ============== COMMANDES AUTOSLASH ==============

        this.commands.set('autobump', {
            name: 'autobump',
            description: 'Active le bump automatique (Disboard)',
            usage: '.autobump [interval_minutes]',
            execute: async (client, message, args) => {
                if (!message.guild) {
                    await message.edit('❌ Commande serveur uniquement');
                    return;
                }

                // Vérifier les permissions (uniquement pour les salons de guild)
                if ('permissionsFor' in message.channel) {
                    const permissions = message.channel.permissionsFor(client.user!.id);
                    if (permissions && !permissions.has(Permissions.FLAGS.SEND_MESSAGES)) {
                        await message.edit('❌ Permissions insuffisantes dans ce salon');
                        return;
                    }
                }

                let interval = parseInt(args[0], 10) || 120; // 2h par défaut

                // Sécurité: intervalle minimum 60 minutes
                if (interval < 60) {
                    await message.edit(`⚠️ Intervalle minimum: 60 minutes. Utilisation de 120 minutes.`);
                    interval = 120;
                }

                // Limite maximum
                if (interval > 1440) {
                    await message.edit(`⚠️ Intervalle maximum: 24h (1440 minutes)`);
                    interval = 1440;
                }

                await message.edit(`🔼 Bump auto activé toutes les ${interval} minutes dans ce salon`);

                // Notifie le Core via global
                const result = (global as any).eclipseCore?.autoSlashService?.enableBump(
                    message.guild.id,
                    message.channel.id,
                    interval
                );

                if (result && !result.success) {
                    await message.edit(`❌ Erreur: ${result.error}`);
                }
            }
        });

        this.commands.set('stopbump', {
            name: 'stopbump',
            description: 'Désactive le bump automatique',
            usage: '.stopbump',
            execute: async (client, message, args) => {
                if (!message.guild) {
                    await message.edit('❌ Commande serveur uniquement');
                    return;
                }

                (global as any).eclipseCore?.autoSlashService?.disableBump(message.guild.id);
                await message.edit('🔼 Bump auto désactivé');
            }
        });

        this.commands.set('bumpstatus', {
            name: 'bumpstatus',
            description: 'Statut du bump automatique',
            usage: '.bumpstatus',
            execute: async (client, message, args) => {
                if (!message.guild) {
                    await message.edit('❌ Commande serveur uniquement');
                    return;
                }

                const status = (global as any).eclipseCore?.autoSlashService?.getBumpStatus(message.guild.id);

                if (!status || !status.enabled) {
                    await message.edit('🔼 Bump auto: Désactivé');
                    return;
                }

                const timeLeft = (global as any).eclipseCore?.autoSlashService?.getTimeUntilBump(message.guild.id);
                const formatted = (global as any).eclipseCore?.autoSlashService?.formatTimeRemaining(timeLeft);

                const info = `
🔼 **Bump Auto Status**

✅ Activé
📍 Salon: <#${status.channelId}>
⏱️ Interval: ${status.interval / 60000} min
🕐 Prochain bump: ${formatted}
                `.trim();

                await message.edit(info);
            }
        });

        this.commands.set('deploy', {
            name: 'deploy',
            description: 'Redéploie les commandes slash (si elles n\'apparaissent pas)',
            usage: '.deploy',
            execute: async (client, message, args) => {
                await message.edit('🔄 Redéploiement des commandes slash...');

                const discordManager = (global as any).eclipseCore?.discordManager;
                if (!discordManager) {
                    await message.edit('❌ Discord Manager non disponible');
                    return;
                }

                const result = await discordManager.redeployCommands();
                await message.edit(result);
            }
        });
    }

    public async handleMessage(client: DiscordUserClient, message: IMessage) {
        if (!client.user || message.author.id !== client.user.id) return;
        if (!message.content.startsWith(this.prefix)) return;

        const args = message.content.slice(this.prefix.length).trim().split(/ +/);
        const commandName = args.shift()?.toLowerCase();

        if (!commandName) return;

        const command = this.commands.get(commandName);

        if (command) {
            try {
                console.log(`[Core] Exécution de la commande : ${commandName}`);
                await command.execute(client, message, args);
            } catch (error) {
                console.error(`[Core] Erreur commande ${commandName}:`, error);
                await message.edit('❌ Une erreur est survenue').catch(() => { });
            }
        }
    }
}
