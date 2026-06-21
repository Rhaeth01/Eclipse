import { EmbedBuilder } from 'discord.js';
import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import { buildEclipseEmbed, ECLIPSE_COLOR, eclipseAck } from '../../shared/embeds';

export function registerUtils(registry: CommandRegistry): void {
  registry.describeCategory('utils', 'Commandes utilitaires');

  const defs: SubcommandDef[] = [
    {
      category: 'utils',
      name: 'calc',
      description: 'Calculatrice',
      build: s => s.addStringOption(o => o.setName('expression').setDescription('Ex: 2 + 2').setRequired(true)),
      async execute(interaction, ctx) {
        const expression = interaction.options.getString('expression') || '';
        try {
          const sanitized = expression.replace(/[^0-9+\-*/.()\s]/g, '');
          if (sanitized !== expression.replace(/\s/g, '')) {
            await interaction.reply({ content: '❌ Caractères non autorisés. Uniquement: 0-9 + - * / ( )', ephemeral: true });
            return;
          }
          const result = new Function('return ' + sanitized)();
          await ctx.dm.stealthReply(interaction, `🧮 ${expression} = **${result}**`);
        } catch {
          await interaction.reply({ content: '❌ Expression invalide', ephemeral: true });
        }
      },
    },
    {
      category: 'utils',
      name: 'poll',
      description: 'Crée un sondage',
      build: s =>
        s
          .addStringOption(o => o.setName('question').setDescription('Question').setRequired(true))
          .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
          .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
          .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false))
          .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false)),
      contexts: [0],
      async execute(interaction) {
        const question = interaction.options.getString('question');
        const options = [1, 2, 3, 4]
          .map(i => interaction.options.getString(`option${i}`))
          .filter((o): o is string => !!o);
        const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];
        let pollText = `📊 **${question}**\n\n`;
        options.forEach((opt, i) => (pollText += `${emojis[i]} ${opt}\n`));
        const pollMsg = await interaction.reply({ content: pollText, fetchReply: true });
        if (pollMsg && 'react' in pollMsg) {
          for (let i = 0; i < options.length; i++) await pollMsg.react(emojis[i]).catch(() => {});
        }
      },
    },
    {
      category: 'utils',
      name: 'password',
      description: 'Génère un mot de passe sécurisé',
      build: s => s.addIntegerOption(o => o.setName('longueur').setDescription('Longueur (défaut: 16)').setRequired(false)),
      async execute(interaction) {
        const length = interaction.options.getInteger('longueur') || 16;
        const maxLength = Math.min(length, 64);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
        let password = '';
        for (let i = 0; i < maxLength; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
        await interaction.reply({ content: `🔐 Mot de passe généré (${maxLength} caractères):\n||${password}||`, ephemeral: true });
      },
    },
    {
      category: 'utils',
      name: 'color',
      description: 'Génère ou affiche une couleur',
      build: s => s.addStringOption(o => o.setName('hex').setDescription('Code hex (optionnel)').setRequired(false)),
      async execute(interaction, ctx) {
        const input = interaction.options.getString('hex');
        if (input) {
          const hex = input.replace('#', '');
          if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
            await interaction.reply({ content: '❌ Format hex invalide. Exemple: `FF5733`', ephemeral: true });
            return;
          }
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          await ctx.dm.stealthReply(interaction, `🎨 Couleur #${hex.toUpperCase()}\nRGB: ${r}, ${g}, ${b}\nhttps://singlecolorimage.com/get/${hex}/100x100`);
        } else {
          const randomColor = Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
          const r = parseInt(randomColor.substr(0, 2), 16);
          const g = parseInt(randomColor.substr(2, 2), 16);
          const b = parseInt(randomColor.substr(4, 2), 16);
          await ctx.dm.stealthReply(interaction, `🎨 Couleur aléatoire: #${randomColor.toUpperCase()}\nRGB: ${r}, ${g}, ${b}\nhttps://singlecolorimage.com/get/${randomColor}/100x100`);
        }
      },
    },
    {
      category: 'utils',
      name: 'translate',
      description: 'Traduit un texte',
      build: s =>
        s
          .addStringOption(o => o.setName('texte').setDescription('Texte à traduire').setRequired(true))
          .addStringOption(o => o.setName('langue').setDescription('Code langue cible (fr, en, es, de...)').setRequired(false)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || '';
        const lang = (interaction.options.getString('langue') || 'fr').slice(0, 2);
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          const encoded = encodeURIComponent(text);
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encoded}`;
          const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
          const data = (await response.json()) as any;
          const translated = data?.[0]?.map((s: any) => s[0]).join('') || text;
          await ctx.dm.stealthReply(interaction, `🌐 **Traduit (→${lang})**: ${translated}`);
        } catch {
          await interaction.editReply({ content: '❌ Erreur de traduction.' }).catch(() => {});
        }
      },
    },
    {
      category: 'utils',
      name: 'weather',
      description: 'Météo d\'une ville',
      build: s => s.addStringOption(o => o.setName('ville').setDescription('Nom de la ville').setRequired(true)),
      async execute(interaction) {
        const city = interaction.options.getString('ville') || 'Paris';
        const encoded = encodeURIComponent(city);
        const embed = buildEclipseEmbed({
          title: `🌤️ Météo: ${city}`,
          description: `https://wttr.in/${encoded}_0pq_lang=fr.png?m`,
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'utils',
      name: 'qr',
      description: 'Génère un QR code',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte ou URL à encoder').setRequired(true)),
      async execute(interaction) {
        const text = interaction.options.getString('texte') || 'https://eclipse';
        const encoded = encodeURIComponent(text);
        const embed = buildEclipseEmbed({
          title: '📱 QR Code',
          image: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}`,
          footerText: text,
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'utils',
      name: 'remind',
      description: 'Rappel après X minutes',
      build: s =>
        s
          .addIntegerOption(o => o.setName('minutes').setDescription('Minutes (1-1440)').setRequired(true))
          .addStringOption(o => o.setName('message').setDescription('Message du rappel').setRequired(true)),
      async execute(interaction, ctx) {
        const minutes = interaction.options.getInteger('minutes');
        const reminderText = interaction.options.getString('message');
        if (!minutes || minutes <= 0 || minutes > 1440 || !reminderText) {
          await interaction.reply({ content: '❌ Usage: minutes (1-1440) + message', ephemeral: true });
          return;
        }
        await interaction.reply({ content: `⏰ Rappel défini dans ${minutes} minutes!`, ephemeral: true });
        setTimeout(async () => {
          try {
            const channel = interaction.channel;
            if (channel?.isTextBased()) await (channel as any).send(`🔔 <@${interaction.user.id}> Rappel: ${reminderText}`);
          } catch {}
        }, minutes * 60 * 1000);
        void ctx;
      },
    },
    {
      category: 'utils',
      name: 'base64',
      description: 'Encode ou décode en Base64',
      build: s =>
        s
          .addStringOption(o => o.setName('mode').setDescription('Mode').addChoices({ name: 'Encode', value: 'encode' }, { name: 'Décode', value: 'decode' }).setRequired(true))
          .addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)),
      async execute(interaction, ctx) {
        const mode = interaction.options.getString('mode');
        const text = interaction.options.getString('texte') || '';
        try {
          if (mode === 'decode') {
            const decoded = Buffer.from(text, 'base64').toString('utf8');
            await ctx.dm.stealthReply(interaction, `📜 Décode:\n\`${decoded}\``);
          } else {
            const encoded = Buffer.from(text).toString('base64');
            await ctx.dm.stealthReply(interaction, `📜 Encodé:\n\`${encoded}\``);
          }
        } catch {
          await interaction.reply({ content: '❌ Erreur d\'encodage/décodage', ephemeral: true });
        }
      },
    },
    {
      category: 'utils',
      name: 'binary',
      description: 'Convertit texte ↔ binaire',
      build: s =>
        s
          .addStringOption(o => o.setName('mode').setDescription('Mode').addChoices({ name: 'Encode', value: 'encode' }, { name: 'Décode', value: 'decode' }).setRequired(true))
          .addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)),
      async execute(interaction, ctx) {
        const mode = interaction.options.getString('mode');
        const text = interaction.options.getString('texte') || '';
        try {
          if (mode === 'decode') {
            const decoded = text.split(' ').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
            await ctx.dm.stealthReply(interaction, `🔓 Décode:\n\`${decoded}\``);
          } else {
            const encoded = text.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
            await ctx.dm.stealthReply(interaction, `🔒 Binaire:\n\`${encoded}\``);
          }
        } catch {
          await interaction.reply({ content: '❌ Erreur de conversion', ephemeral: true });
        }
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
