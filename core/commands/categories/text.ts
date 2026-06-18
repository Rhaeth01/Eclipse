import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import { asciiMap, smallCaps, fullwidth, emojiMap } from '../../shared/constants';

export function registerText(registry: CommandRegistry): void {
  registry.describeCategory('text', 'Commandes de texte et encodage');

  const defs: SubcommandDef[] = [
    {
      category: 'text',
      name: 'mock',
      description: 'MoCkInG sPoNgEbOb TeXt',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte');
        if (!text) {
          await interaction.reply({ content: '❌ Texte requis.', ephemeral: true });
          return;
        }
        let mocked = '';
        for (let i = 0; i < text.length; i++) mocked += i % 2 === 0 ? text[i].toLowerCase() : text[i].toUpperCase();
        await ctx.dm.stealthReply(interaction, mocked);
      },
    },
    {
      category: 'text',
      name: 'ascii',
      description: 'Convertit en ASCII art (max 10 caractères)',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte (max 10)').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte')?.toUpperCase();
        if (!text || text.length > 10) {
          await interaction.reply({ content: '❌ Texte requis (max 10 caractères).', ephemeral: true });
          return;
        }
        let result = '';
        for (const char of text) if (asciiMap[char]) result += asciiMap[char] + '\n\n';
        if (result.length > 1900) {
          await interaction.reply({ content: '❌ Résultat trop long.', ephemeral: true });
          return;
        }
        await ctx.dm.stealthReply(interaction, '```\n' + result + '\n```');
      },
    },
    {
      category: 'text',
      name: 'vaporwave',
      description: 'Convertit en fullwidth (ｖａｐｏｒｗａｖｅ)',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || '';
        const result = text.split('').map(char => fullwidth[char] || char).join('');
        await ctx.dm.stealthReply(interaction, result || '❌ Texte requis');
      },
    },
    {
      category: 'text',
      name: 'emojify',
      description: 'Convertit en emojis (🇭🇪🇱🇱🇴)',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true)),
      async execute(interaction, ctx) {
        const text = (interaction.options.getString('texte') || '').toLowerCase();
        const result = text.split('').map(char => emojiMap[char] || char).join(' ');
        await ctx.dm.stealthReply(interaction, result || '❌ Texte requis');
      },
    },
    {
      category: 'text',
      name: 'clap',
      description: 'Ajoute des 👏 entre les mots',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || '';
        const result = text.split(' ').join(' 👏 ');
        await ctx.dm.stealthReply(interaction, `👏 ${result} 👏`);
      },
    },
    {
      category: 'text',
      name: 'nighty',
      description: 'Convertit en small caps (ɴɪɢʜᴛʏ)',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || '';
        const result = text.split('').map(char => smallCaps[char] || char).join('');
        await ctx.dm.stealthReply(interaction, result || '❌ Texte requis');
      },
    },
    {
      category: 'text',
      name: 'reverse',
      description: 'Retourne le texte',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte à inverser').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || '';
        const reversed = text.split('').reverse().join('');
        await ctx.dm.stealthReply(interaction, `🔄 ${reversed}`);
      },
    },
    {
      category: 'text',
      name: 'uwu',
      description: 'Convertit en texte uwu',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte à convertir').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || '';
        const uwuText = text
          .replace(/r/g, 'w')
          .replace(/l/g, 'w')
          .replace(/R/g, 'W')
          .replace(/L/g, 'W')
          .replace(/n([aeiou])/g, 'ny$1')
          .replace(/N([aeiou])/g, 'Ny$1')
          .replace(/([!?])/g, ' $1 uwu');
        await ctx.dm.stealthReply(interaction, `🌸 ${uwuText}`);
      },
    },
    {
      category: 'text',
      name: 'shrug',
      description: '¯\\_(ツ)_/¯',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte optionnel').setRequired(false)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte');
        const shrug = '¯\\_(ツ)_/¯';
        await ctx.dm.stealthReply(interaction, text ? `${text} ${shrug}` : shrug);
      },
    },
    {
      category: 'text',
      name: 'tableflip',
      description: '(╯°□°）╯︵ ┻━┻',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte optionnel').setRequired(false)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte');
        const flip = '(╯°□°）╯︵ ┻━┻';
        await ctx.dm.stealthReply(interaction, text ? `${text} ${flip}` : flip);
      },
    },
    {
      category: 'text',
      name: 'unflip',
      description: '┬─┬ ノ( ゜-゜ノ)',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte optionnel').setRequired(false)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte');
        const unflip = '┬─┬ ノ( ゜-゜ノ)';
        await ctx.dm.stealthReply(interaction, text ? `${text} ${unflip}` : unflip);
      },
    },
    {
      category: 'text',
      name: 'lenny',
      description: '( ͡° ͜ʖ ͡°)',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte optionnel').setRequired(false)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte');
        const lenny = '( ͡° ͜ʖ ͡°)';
        await ctx.dm.stealthReply(interaction, text ? `${text} ${lenny}` : lenny);
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
