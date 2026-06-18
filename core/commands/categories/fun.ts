import { SlashCommandSubcommandBuilder } from 'discord.js';
import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import { responses, roasts, compliments, jokes } from '../../shared/constants';

export function registerFun(registry: CommandRegistry): void {
  registry.describeCategory('fun', 'Commandes fun et jeux');

  const defs: SubcommandDef[] = [
    {
      category: 'fun',
      name: 'roll',
      description: 'Lance un dé (1-100 par défaut)',
      build: s => s.addStringOption(o => o.setName('dice').setDescription('Format: 6, 2d6, 20...').setRequired(false)),
      async execute(interaction, ctx) {
        const input = interaction.options.getString('dice') || '100';
        let result: number;
        let details = '';
        if (input.includes('d')) {
          const [count, sides] = input.split('d').map(Number);
          if (count > 0 && sides > 0 && count <= 10) {
            const rolls: number[] = [];
            let total = 0;
            for (let i = 0; i < count; i++) {
              const roll = Math.floor(Math.random() * sides) + 1;
              rolls.push(roll);
              total += roll;
            }
            details = `[${rolls.join(', ')}] = `;
            result = total;
          } else {
            result = Math.floor(Math.random() * 100) + 1;
          }
        } else {
          const max = parseInt(input, 10) || 100;
          result = Math.floor(Math.random() * max) + 1;
        }
        await ctx.dm.stealthReply(interaction, `🎲 ${details}**${result}**`);
      },
    },
    {
      category: 'fun',
      name: 'coinflip',
      description: 'Pile ou Face',
      async execute(interaction, ctx) {
        const result = Math.random() < 0.5 ? '🪙 Pile' : '🪙 Face';
        await ctx.dm.stealthReply(interaction, result);
      },
    },
    {
      category: 'fun',
      name: '8ball',
      description: 'Pose une question à la boule magique',
      build: s => s.addStringOption(o => o.setName('question').setDescription('Ta question').setRequired(true)),
      async execute(interaction, ctx) {
        const question = interaction.options.getString('question');
        const answer = responses[Math.floor(Math.random() * responses.length)];
        await ctx.dm.stealthReply(interaction, `🎱 **Question:** ${question}\n**Réponse:** ${answer}`);
      },
    },
    {
      category: 'fun',
      name: 'choose',
      description: 'Choisit aléatoirement entre plusieurs options',
      build: s => s.addStringOption(o => o.setName('options').setDescription('Options séparées par |').setRequired(true)),
      async execute(interaction, ctx) {
        const optionsText = interaction.options.getString('options');
        const options = optionsText?.split('|').map(o => o.trim()).filter(o => o) || [];
        if (options.length < 2) {
          await interaction.reply({ content: '❌ Il faut au moins 2 options séparées par |', ephemeral: true });
          return;
        }
        const choice = options[Math.floor(Math.random() * options.length)];
        await ctx.dm.stealthReply(interaction, `🤔 Je choisis: **${choice}**`);
      },
    },
    {
      category: 'fun',
      name: 'love',
      description: 'Calculateur d\'amour',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Personne à tester').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        if (!target) {
          await interaction.reply({ content: '❌ Cible requise.', ephemeral: true });
          return;
        }
        const user1 = interaction.user;
        const user2 = target;
        const combined = user1.id.slice(-4) + user2.id.slice(-4);
        const percentage = (parseInt(combined, 10) % 100) + 1;
        const emoji = percentage > 80 ? '💕' : percentage > 50 ? '❤️' : percentage > 20 ? '💔' : '🖤';
        await ctx.dm.stealthReply(interaction, `${emoji} **${user1.username}** + **${user2.username}** = **${percentage}%** d'amour!`);
      },
    },
    {
      category: 'fun',
      name: 'roast',
      description: 'Envoie une pique humoristique',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(false)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const roast = roasts[Math.floor(Math.random() * roasts.length)];
        if (target) await ctx.dm.stealthReply(interaction, `🔥 <@${target.id}>, ${roast}`);
        else await ctx.dm.stealthReply(interaction, `🔥 ${roast}`);
      },
    },
    {
      category: 'fun',
      name: 'compliment',
      description: 'Envoie un compliment',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Personne à complimenter').setRequired(false)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const compliment = compliments[Math.floor(Math.random() * compliments.length)];
        if (target) await ctx.dm.stealthReply(interaction, `💝 <@${target.id}>, ${compliment}`);
        else await ctx.dm.stealthReply(interaction, `💝 ${compliment}`);
      },
    },
    {
      category: 'fun',
      name: 'joke',
      description: 'Raconte une blague',
      async execute(interaction, ctx) {
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        await ctx.dm.stealthReply(interaction, `😄 ${joke}`);
      },
    },
    {
      category: 'fun',
      name: 'rate',
      description: 'Note quelque chose sur 10',
      build: s => s.addStringOption(o => o.setName('chose').setDescription('Chose à noter').setRequired(true)),
      async execute(interaction, ctx) {
        const thing = interaction.options.getString('chose') || 'rien';
        const rating = Math.floor(Math.random() * 11);
        const bar = '█'.repeat(rating) + '░'.repeat(10 - rating);
        await ctx.dm.stealthReply(interaction, `📊 Je note **${thing}**:\n**${rating}/10**\n${bar}`);
      },
    },
    {
      category: 'fun',
      name: 'ship',
      description: 'Ship deux personnes',
      build: s =>
        s
          .addUserOption(o => o.setName('user1').setDescription('Première personne').setRequired(true))
          .addUserOption(o => o.setName('user2').setDescription('Deuxième personne').setRequired(true)),
      async execute(interaction, ctx) {
        const user1 = interaction.options.getUser('user1');
        const user2 = interaction.options.getUser('user2');
        if (!user1 || !user2) {
          await interaction.reply({ content: '❌ Deux utilisateurs requis.', ephemeral: true });
          return;
        }
        const name1 = user1.username.slice(0, Math.ceil(user1.username.length / 2));
        const name2 = user2.username.slice(Math.floor(user2.username.length / 2));
        const shipName = name1 + name2;
        const percentage = Math.floor(Math.random() * 100) + 1;
        const hearts = percentage > 80 ? '💕💕💕' : percentage > 60 ? '💕💕' : percentage > 40 ? '💕' : '💔';
        await ctx.dm.stealthReply(interaction, `🚢 **${user1.username}** x **${user2.username}**\nNom du ship: **${shipName}**\nCompatibilité: **${percentage}%** ${hearts}`);
      },
    },
    {
      category: 'fun',
      name: 'spam',
      description: 'Spam un message (max 20)',
      build: s =>
        s
          .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de messages (1-20)').setRequired(true))
          .addStringOption(o => o.setName('message').setDescription('Message à spammer').setRequired(true)),
      async execute(interaction, ctx) {
        const count = interaction.options.getInteger('nombre')!;
        const spamText = interaction.options.getString('message')!;
        if (isNaN(count) || count <= 0 || count > 20 || !spamText) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Utilisation: nombre (1-20) + message');
          return;
        }
        try {
          if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
          const channel = ctx.dm.selfbot && interaction.channelId ? await ctx.dm.selfbot.channels.fetch(interaction.channelId) : null;
          if (!channel || !channel.isText()) {
            await ctx.dm.safeEphemeralReply(interaction, '❌ Canal invalide.');
            return;
          }
          for (let i = 0; i < count; i++) {
            await (channel as any).send(spamText).catch(() => {});
            await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
          }
          await interaction.deleteReply().catch(() => {});
        } catch (err) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer les messages.');
        }
      },
    },
    {
      category: 'fun',
      name: 'react',
      description: 'Ajoute une réaction au dernier message',
      build: s => s.addStringOption(o => o.setName('emoji').setDescription('Emoji à réagir').setRequired(true)),
      async execute(interaction, ctx) {
        const emoji = interaction.options.getString('emoji');
        if (!emoji) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Emoji requis.');
          return;
        }
        try {
          if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
          const channel = ctx.dm.selfbot && interaction.channelId ? await ctx.dm.selfbot.channels.fetch(interaction.channelId) : null;
          if (!channel || !channel.isText()) {
            await ctx.dm.safeEphemeralReply(interaction, '❌ Canal invalide.');
            return;
          }
          const messages = await (channel as any).messages.fetch({ limit: 2 });
          const arr = Array.from(messages instanceof Map ? messages.values() : [messages]);
          const targetMessage = arr.find((m: any) => m && m.id !== interaction.id);
          if (targetMessage) {
            await targetMessage.react(emoji).catch(() => {});
            await interaction.deleteReply().catch(() => {});
          } else {
            await ctx.dm.safeEphemeralReply(interaction, '❌ Aucun message à réagir.');
          }
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible de réagir.');
        }
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
