/**
 * Tests pour le fix #9 du AutoSlashService (v0.4.1).
 *
 * Bug: la même map `intervals` contenait successivement un setTimeout (avant
 * le premier bump) puis un setInterval (après). Si disableBump était appelé
 * entre les deux, on clearait le mauvais timer → zombie intervals.
 *
 * Fix: deux maps séparées (initialTimeouts et intervals).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AutoSlashService } from '../AutoSlashService';

describe('AutoSlashService v0.4.1 fix #9 (timeout/interval separation)', () => {
  let service: AutoSlashService;
  let slashExecutor: any;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new AutoSlashService();
    slashExecutor = { executeSlash: vi.fn().mockResolvedValue(undefined) };
    service.setSlashExecutor(slashExecutor);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('disableBump nettoie le timeout initial SANS qu\'un interval n\'ait été créé', () => {
    service.enableBump('guild-1', 'channel-1', 120, 0);
    // À ce stade, on a un initialTimeout mais pas encore d'interval
    service.disableBump('guild-1');

    // Avance le temps pour vérifier qu'aucun bump n'est exécuté
    vi.advanceTimersByTime(120 * 60 * 1000);
    expect(slashExecutor.executeSlash).not.toHaveBeenCalled();
  });

  it('après le premier bump, l\'interval est créé dans la bonne map', () => {
    service.enableBump('guild-2', 'channel-2', 120, 0);
    // Force le premier bump en avançant le temps
    vi.advanceTimersByTime(10_000); // > offset initial de 5s
    expect(slashExecutor.executeSlash).toHaveBeenCalledTimes(1);

    // Avance d'un cycle d'interval
    vi.advanceTimersByTime(120 * 60 * 1000);
    expect(slashExecutor.executeSlash).toHaveBeenCalledTimes(2);
  });

  it('disableBump après le premier bump arrête l\'interval (pas de zombie)', () => {
    service.enableBump('guild-3', 'channel-3', 120, 0);
    vi.advanceTimersByTime(10_000); // premier bump
    expect(slashExecutor.executeSlash).toHaveBeenCalledTimes(1);

    service.disableBump('guild-3');

    // Aucun bump supplémentaire après disable
    vi.advanceTimersByTime(120 * 60 * 1000 * 3);
    expect(slashExecutor.executeSlash).toHaveBeenCalledTimes(1);
  });

  it('enableBump sur une guild déjà active remplace le précédent (pas de zombie)', () => {
    service.enableBump('guild-4', 'channel-4', 120, 0);
    // Re-active sur la même guild
    service.enableBump('guild-4', 'channel-4', 120, 0);
    vi.advanceTimersByTime(10_000);
    expect(slashExecutor.executeSlash).toHaveBeenCalledTimes(1);

    // Pas de double-bump après le prochain cycle
    vi.advanceTimersByTime(120 * 60 * 1000);
    expect(slashExecutor.executeSlash).toHaveBeenCalledTimes(2);
  });
});
