/**
 * SpotifyService — intégration Spotify (now-playing + contrôle RPC).
 * Voir AGENTS.md roadmap (🟡 Large pour RPC complet).
 *
 * NOTE : Le contrôle de lecture (play/pause/skip) nécessite une authentification
 * OAuth PKCE avec l'API Spotify Web. La détection du "now playing" se fait via
 * l'activité Spotify de la présence Discord du selfbot.
 *
 * L'OAuth n'est pas encore implémenté (nécessite SPOTIFY_CLIENT_ID env var) —
 * les méthodes de contrôle retournent une erreur explicite tant que le token
 * Spotify n'est pas configuré. La détection now-playing fonctionne déjà via
 * la présence Discord.
 */

import { EventEmitter } from 'events';
import { logger } from './Logger';

export interface SpotifyTrack {
  title: string;
  artist: string;
  album?: string;
  url?: string;
  durationMs?: number;
}

export class SpotifyService extends EventEmitter {
  private accessToken: string | null = null;
  private lastTrack: SpotifyTrack | null = null;

  /** Indique si l'OAuth Spotify est configuré. */
  isConfigured(): boolean {
    return this.accessToken !== null;
  }

  /** Définit le token d'accès Spotify (après OAuth PKCE). */
  setAccessToken(token: string | null): void {
    this.accessToken = token;
    logger.info('Spotify', token ? 'Token configuré' : 'Token effacé');
  }

  /**
   * Extrait la piste Spotify en cours depuis une activité de présence Discord.
   * @param activities Liste des activités du selfbot
   */
  detectFromPresence(activities: any[]): SpotifyTrack | null {
    if (!Array.isArray(activities)) return null;
    const spotifyActivity = activities.find(
      (a: any) => a?.type === 2 && a?.name === 'Spotify'
    );
    if (!spotifyActivity) {
      this.lastTrack = null;
      return null;
    }
    // sync_id peut être absent sur certaines présences — on retourne la piste
    // même sans, juste sans URL.
    const track: SpotifyTrack = {
      title: spotifyActivity.details || 'Inconnu',
      artist: spotifyActivity.state || 'Inconnu',
      album: spotifyActivity.assets?.large_text,
      url: spotifyActivity.sync_id ? `https://open.spotify.com/track/${spotifyActivity.sync_id}` : undefined,
    };
    this.lastTrack = track;
    this.emit('trackChange', track);
    return track;
  }

  /** Retourne la dernière piste détectée. */
  getNowPlaying(): SpotifyTrack | null {
    return this.lastTrack;
  }

  // --- Contrôle de lecture (nécessite OAuth) ---

  async pause(): Promise<string> {
    if (!this.accessToken) return '❌ OAuth Spotify non configuré. Définis SPOTIFY_CLIENT_ID et connecte-toi.';
    try {
      await fetch('https://api.spotify.com/v1/me/player/pause', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return '⏸️ Lecture en pause.';
    } catch {
      return '❌ Erreur pause Spotify.';
    }
  }

  async resume(): Promise<string> {
    if (!this.accessToken) return '❌ OAuth Spotify non configuré.';
    try {
      await fetch('https://api.spotify.com/v1/me/player/play', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return '▶️ Lecture reprise.';
    } catch {
      return '❌ Erreur resume Spotify.';
    }
  }

  async skip(): Promise<string> {
    if (!this.accessToken) return '❌ OAuth Spotify non configuré.';
    try {
      await fetch('https://api.spotify.com/v1/me/player/next', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}` },
      });
      return '⏭️ Piste suivante.';
    } catch {
      return '❌ Erreur skip Spotify.';
    }
  }
}
