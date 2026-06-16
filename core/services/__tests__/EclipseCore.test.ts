/**
 * Tests pour le fix #10 du EclipseCore.start()/stop() (v0.4.1).
 *
 * Bug: logger.onLog était enregistré sans être retiré → start()+stop()+start()
 * créait des duplicates du broadcast.
 *
 * Fix: référence stockée, retirée dans stop() via logger.offLog().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EclipseCore } from '../../EclipseCore';
import { logger } from '../../services/Logger';

describe('EclipseCore v0.4.1 fix #10 (logger.onLog duplicate)', () => {
  it('start() puis stop() puis start() ne crée pas de duplicate listener', () => {
    // Mock du wsService pour éviter de bind un vrai serveur WS
    const mockBroadcast = vi.fn();
    const mockWsService: any = {
      start: vi.fn(),
      stop: vi.fn(),
      broadcast: mockBroadcast,
      on: vi.fn(),
      setExpectedSecret: vi.fn(),
    };

    // Patch du constructeur pour injecter le mock
    // (EclipseCore prend port + backupDir + wsSecret)
    const core = new (class extends EclipseCore {
      constructor() {
        super({ port: 4041, backupDir: '/tmp/test' });
        // Remplace le wsService interne
        (this as any).wsService = mockWsService;
      }
    })();

    // Spy sur logger.onLog / offLog
    const onLogSpy = vi.spyOn(logger, 'onLog');
    const offLogSpy = vi.spyOn(logger, 'offLog');

    core.start();
    const firstCallCount = onLogSpy.mock.calls.length;
    expect(firstCallCount).toBeGreaterThan(0);

    core.stop();
    expect(offLogSpy).toHaveBeenCalled();

    // Reset spy
    onLogSpy.mockClear();
    offLogSpy.mockClear();

    // Restart
    core.start();
    expect(onLogSpy).toHaveBeenCalledTimes(1); // exactement 1, pas plus

    // Cleanup
    core.stop();
    onLogSpy.mockRestore();
    offLogSpy.mockRestore();
  });
});
