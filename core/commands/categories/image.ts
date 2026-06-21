import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerImage(registry: CommandRegistry): void {
  registry.describeCategory('image', 'Commandes d\'images aléatoires');

  const defs: SubcommandDef[] = [
    {
      category: 'image',
      name: 'cat',
      description: 'Image aléatoire de chat',
      async execute(interaction, ctx) {
        const url = ['https://cataas.com/cat', 'https://cataas.com/cat/gif'][Math.floor(Math.random() * 2)];
        await ctx.dm.stealthReply(interaction, `🐱 ${url}?t=${Date.now()}`);
      },
    },
    {
      category: 'image',
      name: 'dog',
      description: 'Image aléatoire de chien',
      async execute(interaction, ctx) {
        const breeds = ['labrador', 'poodle', 'bulldog', 'beagle', 'pug', 'husky', 'corgi'];
        const breed = breeds[Math.floor(Math.random() * breeds.length)];
        await ctx.dm.stealthReply(interaction, `🐕 https://placedog.net/500/400?${breed}&t=${Date.now()}`);
      },
    },
    {
      category: 'image',
      name: 'meme',
      description: 'Meme aléatoire depuis Reddit',
      async execute(interaction, ctx) {
        const subreddits = ['memes', 'dankmemes', 'ProgrammerHumor', 'wholesomememes'];
        const sub = subreddits[Math.floor(Math.random() * subreddits.length)];
        await ctx.dm.stealthReply(interaction, `🔥 Meme aléatoire de r/${sub}: https://www.reddit.com/r/${sub}/random`);
      },
    },
    {
      category: 'image',
      name: 'fox',
      description: 'Image aléatoire de renard',
      async execute(interaction, ctx) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          const res = await fetch('https://randomfox.ca/floof/', { signal: AbortSignal.timeout(5000) });
          const data = (await res.json()) as any;
          await ctx.dm.stealthReply(interaction, `🦊 ${data?.image || 'https://randomfox.ca/'}`);
        } catch {
          await interaction.editReply({ content: '❌ Erreur récupération renard.' }).catch(() => {});
        }
      },
    },
    {
      category: 'image',
      name: 'panda',
      description: 'Image aléatoire de panda',
      async execute(interaction, ctx) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          const res = await fetch('https://some-random-api.com/animal/panda', { signal: AbortSignal.timeout(5000) });
          const data = (await res.json()) as any;
          await ctx.dm.stealthReply(interaction, `🐼 ${data?.image || 'https://some-random-api.com/'}`);
        } catch {
          await interaction.editReply({ content: '❌ Erreur récupération panda.' }).catch(() => {});
        }
      },
    },
    {
      category: 'image',
      name: 'duck',
      description: 'Image aléatoire de canard',
      async execute(interaction, ctx) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          const res = await fetch('https://random-d.uk/api/random', { signal: AbortSignal.timeout(5000) });
          const data = (await res.json()) as any;
          await ctx.dm.stealthReply(interaction, `🦆 ${data?.url || 'https://random-d.uk/'}`);
        } catch {
          await interaction.editReply({ content: '❌ Erreur récupération canard.' }).catch(() => {});
        }
      },
    },
    {
      category: 'image',
      name: 'bird',
      description: 'Image aléatoire d\'oiseau',
      async execute(interaction, ctx) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          const res = await fetch('https://some-random-api.com/animal/birb', { signal: AbortSignal.timeout(5000) });
          const data = (await res.json()) as any;
          await ctx.dm.stealthReply(interaction, `🐦 ${data?.image || 'https://some-random-api.com/'}`);
        } catch {
          await interaction.editReply({ content: '❌ Erreur récupération oiseau.' }).catch(() => {});
        }
      },
    },
    {
      category: 'image',
      name: 'achievement',
      description: 'Génère une achievement Minecraft',
      build: s => s.addStringOption(o => o.setName('texte').setDescription('Texte de l\'achievement').setRequired(true)),
      async execute(interaction, ctx) {
        const text = interaction.options.getString('texte') || 'Eclipse';
        const encoded = encodeURIComponent(text);
        await ctx.dm.stealthReply(interaction, `🏆 https://minecraftskinstealer.com/achievement/1/Achievement%20Get%21/${encoded}`);
      },
    },
    {
      category: 'image',
      name: 'caption',
      description: 'Génère un meme avec caption (imgflip)',
      build: s =>
        s
          .addStringOption(o => o.setName('haut').setDescription('Texte du haut').setRequired(false))
          .addStringOption(o => o.setName('bas').setDescription('Texte du bas').setRequired(false)),
      async execute(interaction, ctx) {
        const top = encodeURIComponent(interaction.options.getString('haut') || '');
        const bottom = encodeURIComponent(interaction.options.getString('bas') || '');
        await ctx.dm.stealthReply(interaction, `🖼️ https://apimeme.com/meme?meme=Ancient-Aliens&top=${top}&bottom=${bottom}`);
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
