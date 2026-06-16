/**
 * Tests pour le fix #11 du RateLimiter (v0.4.1).
 *
 * Bug: `parseFloat(reset!) - Date.now() / 1000` à cause de la précédence
 * de `-` sur `/`, produisant un nombre ~1.7 milliards de fois trop petit
 * (au lieu de millisecondes, on avait des secondes normalisées).
 *
 * Fix: multiplication par 1000 explicite + parenthèses.
 */

import { describe, it, expect } from 'vitest';
import { RateLimiter } from '../RateLimiter';

describe('RateLimiter v0.4.1 fix #11 (off-by-thousands)', () => {
  it('calcule resetAt correctement quand seul reset (epoch seconds) est fourni', () => {
    const limiter = new RateLimiter();
    const now = Date.now();
    const futureEpoch = (now + 60_000) / 1000; // +60s
    const headers = {
      'x-ratelimit-limit': '5',
      'x-ratelimit-remaining': '3',
      'x-ratelimit-reset': futureEpoch.toString(),
    };
    limiter.updateFromHeaders('channels/123/messages', headers);
    const status = limiter.getStatus();
    expect(status.length).toBe(1);
    expect(status[0].resetIn).toBeGreaterThan(50_000);
    expect(status[0].resetIn).toBeLessThan(70_000);
  });

  it('calcule resetAt correctement quand seul resetAfter est fourni', () => {
    const limiter = new RateLimiter();
    const headers = {
      'x-ratelimit-limit': '5',
      'x-ratelimit-remaining': '0',
      'x-ratelimit-reset-after': '120', // 120 secondes
    };
    limiter.updateFromHeaders('guilds/123/members', headers);
    const status = limiter.getStatus();
    expect(status[0].resetIn).toBeGreaterThan(110_000);
    expect(status[0].resetIn).toBeLessThan(130_000);
  });

  it('regression: l\'ancien bug produisait un nombre ~0 pour resetIn (precedence bug)', () => {
    // Avant le fix, avec headers:
    //   reset = 1714800000 (epoch seconds)
    //   now = 1714730000000 (ms)
    // Le code faisait: parseFloat(reset) - Date.now() / 1000
    //                 = 1714800000 - 1714730000
    //                 = 70000  (en réalité des millièmes?!)
    // Avec parenthèses correctes: parseFloat(reset) * 1000 - Date.now()
    //                            = 1714800000000 - 1714730000000
    //                            = 70000000 ms (= 70000s = ~19.4h)
    const limiter = new RateLimiter();
    const now = Date.now();
    const reset = ((now + 70_000_000) / 1000).toString(); // ~19.4h
    const headers = {
      'x-ratelimit-limit': '5',
      'x-ratelimit-remaining': '4',
      'x-ratelimit-reset': reset,
    };
    limiter.updateFromHeaders('channels/456/messages', headers);
    const status = limiter.getStatus();
    // resetIn doit être ~19.4h = 70_000_000 ms
    // AVANT le fix: ~70000 ms (1.2 min) — complètement faux
    expect(status[0].resetIn).toBeGreaterThan(60_000_000);
    expect(status[0].resetIn).toBeLessThan(80_000_000);
  });
});
