import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerAnimated(registry: CommandRegistry): void {
  registry.describeCategory('animated', 'Animations de profil et Rich Presence');

  const defs: SubcommandDef[] = [
    {
      category: 'animated',
      group: 'status',
      name: 'start',
      description: 'Démarre l\'animation du custom status',
      build: s =>
        s
          .addStringOption(o => o.setName('frames').setDescription('Frames JSON: [{"text":"...","emoji":"😀"}]').setRequired(true))
          .addIntegerOption(o => o.setName('delai').setDescription('Délai en ms (1000-60000, défaut 3000)').setRequired(false)),
      async execute(interaction, ctx) {
        const framesRaw = interaction.options.getString('frames');
        const delay = interaction.options.getInteger('delai') || 3000;
        if (!framesRaw) {
          await interaction.reply({ content: '❌ Frames requises.', ephemeral: true });
          return;
        }
        let frames: Array<{ text: string; emoji?: string }>;
        try {
          frames = JSON.parse(framesRaw);
        } catch {
          await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true });
          return;
        }
        if (!Array.isArray(frames) || frames.length === 0) {
          await interaction.reply({ content: '❌ Frames invalides.', ephemeral: true });
          return;
        }
        ctx.animationService.startCustomStatusAnimation(frames, delay);
        await interaction.reply({ content: `✨ Animation du status démarrée (${frames.length} frames, ${delay}ms).`, ephemeral: true });
      },
    },
    {
      category: 'animated',
      group: 'status',
      name: 'stop',
      description: 'Arrête l\'animation du custom status',
      async execute(interaction, ctx) {
        ctx.animationService.stopCustomStatusAnimation();
        await interaction.reply({ content: '⏹️ Animation du status arrêtée.', ephemeral: true });
      },
    },
    {
      category: 'animated',
      group: 'rpc',
      name: 'start',
      description: 'Démarre la rotation RPC',
      build: s =>
        s
          .addStringOption(o => o.setName('frames').setDescription('Frames JSON RpcFrame[]').setRequired(true))
          .addIntegerOption(o => o.setName('delai').setDescription('Délai en ms (5000-300000, défaut 10000)').setRequired(false)),
      async execute(interaction, ctx) {
        const framesRaw = interaction.options.getString('frames');
        const delay = interaction.options.getInteger('delai') || 10000;
        if (!framesRaw) {
          await interaction.reply({ content: '❌ Frames requises.', ephemeral: true });
          return;
        }
        let frames: any[];
        try {
          frames = JSON.parse(framesRaw);
        } catch {
          await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true });
          return;
        }
        if (!Array.isArray(frames) || frames.length === 0) {
          await interaction.reply({ content: '❌ Frames invalides.', ephemeral: true });
          return;
        }
        await ctx.animationService.startRpcAnimation(frames, delay);
        await interaction.reply({ content: `🎮 Rotation RPC démarrée (${frames.length} frames, ${delay}ms).`, ephemeral: true });
      },
    },
    {
      category: 'animated',
      group: 'rpc',
      name: 'stop',
      description: 'Arrête la rotation RPC',
      async execute(interaction, ctx) {
        ctx.animationService.stopRpcAnimation();
        await interaction.reply({ content: '⏹️ Rotation RPC arrêtée.', ephemeral: true });
      },
    },
    {
      category: 'animated',
      group: 'rpc',
      name: 'set',
      description: 'Définit un RPC statique',
      build: s => s.addStringOption(o => o.setName('frame').setDescription('Frame JSON RpcFrame').setRequired(true)),
      async execute(interaction, ctx) {
        const frameRaw = interaction.options.getString('frame');
        if (!frameRaw) {
          await interaction.reply({ content: '❌ Frame requise.', ephemeral: true });
          return;
        }
        let frame: any;
        try {
          frame = JSON.parse(frameRaw);
        } catch {
          await interaction.reply({ content: '❌ JSON invalide.', ephemeral: true });
          return;
        }
        await ctx.animationService.setRichPresence(frame);
        await interaction.reply({ content: '🎮 RPC défini.', ephemeral: true });
      },
    },
    {
      category: 'animated',
      group: 'rpc',
      name: 'clear',
      description: 'Efface le RPC',
      async execute(interaction, ctx) {
        await ctx.animationService.clearRichPresence();
        await interaction.reply({ content: '🧹 RPC effacé.', ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
