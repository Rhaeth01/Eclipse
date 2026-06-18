import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerVoice(registry: CommandRegistry): void {
  registry.describeCategory('voice', 'Commandes vocales');

  const defs: SubcommandDef[] = [
    {
      category: 'voice',
      name: 'joinvc',
      description: 'Rejoindre un salon vocal',
      build: s => s.addChannelOption(o => o.setName('salon').setDescription('Salon vocal à rejoindre').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const vcChannel = interaction.options.getChannel('salon');
        if (!vcChannel || (vcChannel as any).type !== 2) {
          await interaction.reply({ content: '❌ Salon vocal invalide.', ephemeral: true });
          return;
        }
        try {
          await (ctx.dm.selfbot as any)?.voice?.joinChannel((vcChannel as any).id, { selfDeaf: true });
          await interaction.reply({ content: `🔊 Rejoint ${(vcChannel as any).name}`, ephemeral: true });
        } catch {
          await interaction.reply({ content: '❌ Impossible de rejoindre le salon vocal.', ephemeral: true });
        }
      },
    },
    {
      category: 'voice',
      name: 'leavevc',
      description: 'Quitter le salon vocal actuel',
      contexts: [0],
      async execute(interaction, ctx) {
        try {
          (ctx.dm.selfbot as any)?.voice?.disconnect();
          await interaction.reply({ content: '🔇 Salon vocal quitté.', ephemeral: true });
        } catch {
          await interaction.reply({ content: '❌ Pas dans un salon vocal.', ephemeral: true });
        }
      },
    },
    {
      category: 'voice',
      name: 'tts',
      description: 'Envoie un message TTS',
      build: s => s.addStringOption(o => o.setName('message').setDescription('Message').setRequired(true)),
      async execute(interaction, ctx) {
        const ttsText = interaction.options.getString('message');
        if (!ttsText) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Message requis.');
          return;
        }
        try {
          await ctx.dm.sendAsSelfbot(interaction, ttsText, { tts: true });
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer le TTS via le compte utilisateur.');
        }
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
