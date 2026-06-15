/**
 * Tests pour BotSetupService (v0.3.4)
 *
 * Couvre :
 * - runHybridSetup : happy path (3 appels API sur app existante)
 * - runHybridSetup : App ID invalide
 * - runHybridSetup : REST null
 * - runAutoSetup : détection captcha → bascule sur captcha_required
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BotSetupService } from '../BotSetupService';

function makeWsService() {
  const sendToClient = vi.fn();
  return {
    sendToClient,
    wsService: { sendToClient } as any,
  };
}

function makeRest(overrides: Partial<{
  createApplication: any;
  createBotForApplication: any;
  resetBotToken: any;
  authorizeApplication: any;
}> = {}) {
  return {
    createApplication: vi.fn(async (name: string) => ({ id: '111111111111111111', name })),
    createBotForApplication: vi.fn(async (appId: string) => ({ id: '222222222222222222', token: 'bot_token_xyz' })),
    resetBotToken: vi.fn(async (appId: string) => ({ token: 'fresh_token_abc' })),
    authorizeApplication: vi.fn(async (appId: string) => `https://discord.com/oauth2/authorize?client_id=${appId}`),
    ...overrides,
  };
}

describe('BotSetupService.runHybridSetup (v0.3.4)', () => {
  let service: BotSetupService;
  let ws: ReturnType<typeof makeWsService>['wsService'];
  let clientId: string;

  beforeEach(() => {
    const { wsService, sendToClient } = makeWsService();
    ws = wsService;
    clientId = 'client-1';
    service = new BotSetupService(ws);
  });

  it('runs 3 API calls on existing app and broadcasts progress', async () => {
    const rest = makeRest();
    service.setRest(rest as any);

    await service.runHybridSetup(clientId, '123456789012345678');

    expect(rest.createBotForApplication).toHaveBeenCalledWith('123456789012345678');
    expect(rest.resetBotToken).toHaveBeenCalledWith('123456789012345678');
    expect(rest.authorizeApplication).toHaveBeenCalledWith('123456789012345678');

    const steps = ws.sendToClient.mock.calls.map((c: any[]) => c[1].step);
    expect(steps).toContain('creating_bot');
    expect(steps).toContain('getting_token');
    expect(steps).toContain('authorizing');
    expect(steps).toContain('complete');

    expect(service.getCurrentAppId()).toBe('123456789012345678');
    expect(service.getCurrentToken()).toBe('fresh_token_abc');
  });

  it('rejects an invalid App ID (not a Discord snowflake)', async () => {
    const rest = makeRest();
    service.setRest(rest as any);

    await service.runHybridSetup(clientId, 'not-a-snowflake');

    expect(rest.createBotForApplication).not.toHaveBeenCalled();
    const lastCall = ws.sendToClient.mock.calls[ws.sendToClient.mock.calls.length - 1][1];
    expect(lastCall.step).toBe('error');
    expect(lastCall.error).toMatch(/App ID invalide/);
  });

  it('broadcasts error when REST client is not set', async () => {
    await service.runHybridSetup(clientId, '123456789012345678');
    const lastCall = ws.sendToClient.mock.calls[ws.sendToClient.mock.calls.length - 1][1];
    expect(lastCall.step).toBe('error');
    expect(lastCall.error).toMatch(/REST/);
  });

  it('broadcasts captcha_required when an API call returns a captcha error', async () => {
    const rest = makeRest({
      createBotForApplication: vi.fn(async () => {
        const err: any = new Error('HTTP 400: {"captcha_key":["captcha-required"],"captcha_sitekey":"x"}');
        throw err;
      }),
    });
    service.setRest(rest as any);

    await service.runHybridSetup(clientId, '123456789012345678');

    const lastCall = ws.sendToClient.mock.calls[ws.sendToClient.mock.calls.length - 1][1];
    expect(lastCall.step).toBe('captcha_required');
    expect(lastCall.error).toBe('captcha_required');
  });
});

describe('BotSetupService.runAutoSetup (v0.3.4 captcha detection)', () => {
  let service: BotSetupService;
  let ws: ReturnType<typeof makeWsService>['wsService'];
  let clientId: string;

  beforeEach(() => {
    const { wsService } = makeWsService();
    ws = wsService;
    clientId = 'client-1';
    service = new BotSetupService(ws);
  });

  it('broadcasts captcha_required when createApplication returns captcha', async () => {
    const rest = makeRest({
      createApplication: vi.fn(async () => {
        const err: any = new Error('HTTP 400: {"captcha_key":["captcha-required"],"captcha_service":"hcaptcha"}');
        throw err;
      }),
    });
    service.setRest(rest as any);

    await service.runAutoSetup(clientId, 'Eclipse');

    const lastCall = ws.sendToClient.mock.calls[ws.sendToClient.mock.calls.length - 1][1];
    expect(lastCall.step).toBe('captcha_required');
    expect(lastCall.error).toBe('captcha_required');
    expect(lastCall.message).toMatch(/captcha/i);
  });

  it('broadcasts generic error for non-captcha failures', async () => {
    const rest = makeRest({
      createApplication: vi.fn(async () => {
        throw new Error('HTTP 500: internal server error');
      }),
    });
    service.setRest(rest as any);

    await service.runAutoSetup(clientId, 'Eclipse');

    const lastCall = ws.sendToClient.mock.calls[ws.sendToClient.mock.calls.length - 1][1];
    expect(lastCall.step).toBe('error');
    expect(lastCall.error).toMatch(/HTTP 500/);
  });
});
