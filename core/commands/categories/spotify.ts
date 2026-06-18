import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import type { SpotifyService } from '../../services/SpotifyService';

export function registerSpotify(registry: CommandRegistry, spotifyService: SpotifyService): void {
  registry.describeCategory('spotify', 'Contrôle Spotify & now-playing');

  const defs: SubcommandDef[] = [
    {
      category: 'spotify',
      name: 'nowplaying',
      description: 'Affiche la piste Spotify en cours',
      async execute(interaction, _ctx) {
        const track = spotifyService.getNowPlaying();
        if (!track) {
          await interaction.reply({ content: '🎵 Aucune piste Spotify en cours. Lance Spotify sur Discord.', ephemeral: true });
          return;
        }
        const text = `🎵 **${track.title}**\n👤 ${track.artist}\n${track.album ? `💿 ${track.album}\n` : ''}${track.url ? `🔗 ${track.url}` : ''}`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'spotify',
      name: 'pause',
      description: 'Met la lecture Spotify en pause',
      async execute(interaction, _ctx) {
        await interaction.reply({ content: await spotifyService.pause(), ephemeral: true });
      },
    },
    {
      category: 'spotify',
      name: 'resume',
      description: 'Reprend la lecture Spotify',
      async execute(interaction, _ctx) {
        await interaction.reply({ content: await spotifyService.resume(), ephemeral: true });
      },
    },
    {
      category: 'spotify',
      name: 'skip',
      description: 'Passe à la piste Spotify suivante',
      async execute(interaction, _ctx) {
        await interaction.reply({ content: await spotifyService.skip(), ephemeral: true });
      },
    },
    {
      category: 'spotify',
      name: 'status',
      description: 'Statut de l\'intégration Spotify',
      async execute(interaction, _ctx) {
        const configured = spotifyService.isConfigured();
        const track = spotifyService.getNowPlaying();
        const text = `**🎵 Spotify**\n\nOAuth: ${configured ? '✅ Configuré' : '❌ Non configuré (détection only)'}\nNow playing: ${track ? track.title : 'Aucune'}`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
