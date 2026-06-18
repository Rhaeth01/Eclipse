/**
 * Tests pour SpotifyService — détection now-playing + contrôle (OAuth gating).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotifyService } from '../SpotifyService';

describe('SpotifyService', () => {
  let service: SpotifyService;

  beforeEach(() => {
    service = new SpotifyService();
  });

  describe('isConfigured()', () => {
    it('retourne false par défaut', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('retourne true après setAccessToken()', () => {
      service.setAccessToken('token-abc');
      expect(service.isConfigured()).toBe(true);
    });

    it('retourne false après setAccessToken(null)', () => {
      service.setAccessToken('token-abc');
      service.setAccessToken(null);
      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('detectFromPresence()', () => {
    it('retourne null si pas d\'activité Spotify', () => {
      const track = service.detectFromPresence([
        { type: 0, name: 'Visual Studio Code' },
      ]);
      expect(track).toBeNull();
    });

    it('retourne null si activities est vide', () => {
      expect(service.detectFromPresence([])).toBeNull();
    });

    it('extrait les infos de piste d\'une activité Spotify', () => {
      const track = service.detectFromPresence([
        {
          type: 2,
          name: 'Spotify',
          details: 'Bohemian Rhapsody',
          state: 'Queen',
          sync_id: '3z8h0TU7ReDPLIbEnYhWZb',
          assets: { large_text: 'A Night at the Opera' },
        },
      ]);
      expect(track).not.toBeNull();
      expect(track!.title).toBe('Bohemian Rhapsody');
      expect(track!.artist).toBe('Queen');
      expect(track!.album).toBe('A Night at the Opera');
      expect(track!.url).toBe('https://open.spotify.com/track/3z8h0TU7ReDPLIbEnYhWZb');
    });

    it('gère les activités Spotify malformées (champs manquants)', () => {
      const track = service.detectFromPresence([
        { type: 2, name: 'Spotify' }, // pas de details/state
      ]);
      expect(track).not.toBeNull();
      expect(track!.title).toBe('Inconnu');
      expect(track!.artist).toBe('Inconnu');
      expect(track!.url).toBeUndefined();
    });

    it('ne matche pas une activité type 2 mais pas Spotify', () => {
      const track = service.detectFromPresence([
        { type: 2, name: 'YouTube Music', details: 'x', state: 'y' },
      ]);
      expect(track).toBeNull();
    });

    it('mémorise la dernière piste détectée (getNowPlaying)', () => {
      service.detectFromPresence([
        { type: 2, name: 'Spotify', details: 'Stairway to Heaven', state: 'Led Zeppelin', sync_id: 'abc' },
      ]);
      const np = service.getNowPlaying();
      expect(np).not.toBeNull();
      expect(np!.title).toBe('Stairway to Heaven');
    });

    it('reset la dernière piste si plus d\'activité Spotify', () => {
      service.detectFromPresence([
        { type: 2, name: 'Spotify', details: 'X', state: 'Y' },
      ]);
      expect(service.getNowPlaying()).not.toBeNull();
      service.detectFromPresence([]);
      expect(service.getNowPlaying()).toBeNull();
    });
  });

  describe('émission d\'événements', () => {
    it('émet "trackChange" quand une nouvelle piste est détectée', () => {
      const handler = vi.fn();
      service.on('trackChange', handler);
      service.detectFromPresence([
        { type: 2, name: 'Spotify', details: 'New Track', state: 'Artist', sync_id: 'id1' },
      ]);
      expect(handler).toHaveBeenCalledOnce();
      expect(handler.mock.calls[0][0].title).toBe('New Track');
    });
  });

  describe('contrôle (pause/resume/skip)', () => {
    it('refuse pause() si OAuth non configuré', async () => {
      const result = await service.pause();
      expect(result).toMatch(/OAuth.*non configuré/);
    });

    it('refuse resume() si OAuth non configuré', async () => {
      const result = await service.resume();
      expect(result).toMatch(/OAuth.*non configuré/);
    });

    it('refuse skip() si OAuth non configuré', async () => {
      const result = await service.skip();
      expect(result).toMatch(/OAuth.*non configuré/);
    });

    it('appelle l\'API Spotify avec le token configuré', async () => {
      service.setAccessToken('test-token');
      const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({ ok: true } as any);
      await service.pause();
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.spotify.com/v1/me/player/pause',
        expect.objectContaining({
          method: 'PUT',
          headers: { Authorization: 'Bearer test-token' },
        })
      );
      fetchSpy.mockRestore();
    });
  });
});
