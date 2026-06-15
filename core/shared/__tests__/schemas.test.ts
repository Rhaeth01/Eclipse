import { describe, it, expect } from 'vitest';
import {
  InitMessageSchema,
  SaveBotTokenSchema,
  BotTokenSavedSchema,
  HybridSetupBotSchema,
  WsAuthSchema,
  validateWsMessage,
} from '../schemas';

describe('InitMessageSchema', () => {
  it('validates with appToken present', () => {
    const result = InitMessageSchema.safeParse({
      type: 'init',
      token: 'user_token_12345',
      appToken: 'bot_token_67890',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('user_token_12345');
      expect(result.data.appToken).toBe('bot_token_67890');
    }
  });

  it('validates with appToken absent (optional)', () => {
    const result = InitMessageSchema.safeParse({
      type: 'init',
      token: 'user_token_12345',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.token).toBe('user_token_12345');
      expect(result.data.appToken).toBeUndefined();
    }
  });

  it('rejects token shorter than 10 chars', () => {
    const result = InitMessageSchema.safeParse({
      type: 'init',
      token: 'short',
      appToken: 'valid_bot_token_long_enough',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing token entirely', () => {
    const result = InitMessageSchema.safeParse({
      type: 'init',
      appToken: 'valid_bot_token_long_enough',
    });
    expect(result.success).toBe(false);
  });
});

describe('SaveBotTokenSchema', () => {
  it('validates a valid token', () => {
    const result = SaveBotTokenSchema.safeParse({
      type: 'save_bot_token',
      appToken: 'MTAxMjM0NTY3ODkwMTIzNA.AbCdEf.ghIjKlMnOpQrStUvWxYz',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.appToken).toBe('MTAxMjM0NTY3ODkwMTIzNA.AbCdEf.ghIjKlMnOpQrStUvWxYz');
    }
  });

  it('rejects token shorter than 10 chars', () => {
    const result = SaveBotTokenSchema.safeParse({
      type: 'save_bot_token',
      appToken: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing appToken', () => {
    const result = SaveBotTokenSchema.safeParse({
      type: 'save_bot_token',
    });
    expect(result.success).toBe(false);
  });
});

describe('BotTokenSavedSchema', () => {
  it('validates success response', () => {
    const result = BotTokenSavedSchema.safeParse({
      type: 'bot_token_saved',
      success: true,
      message: 'App Bot connecté',
    });
    expect(result.success).toBe(true);
  });

  it('validates failure response', () => {
    const result = BotTokenSavedSchema.safeParse({
      type: 'bot_token_saved',
      success: false,
      message: 'Token invalide',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing success field', () => {
    const result = BotTokenSavedSchema.safeParse({
      type: 'bot_token_saved',
      message: 'missing success',
    });
    expect(result.success).toBe(false);
  });
});

describe('validateWsMessage', () => {
  it('validates init message with appToken', () => {
    const result = validateWsMessage({
      type: 'init',
      token: 'user_token_12345',
      appToken: 'bot_token_67890',
    });
    expect(result.success).toBe(true);
  });

  it('validates init message without appToken', () => {
    const result = validateWsMessage({
      type: 'init',
      token: 'user_token_12345',
    });
    expect(result.success).toBe(true);
  });

  it('rejects unknown message type', () => {
    const result = validateWsMessage({
      type: 'unknown_type',
      data: 'something',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
    }
  });
});

describe('HybridSetupBotSchema (v0.3.4)', () => {
  it('validates a valid Discord snowflake appId', () => {
    const result = HybridSetupBotSchema.safeParse({
      type: 'hybrid_setup_bot',
      appId: '123456789012345678', // 18 chiffres
    });
    expect(result.success).toBe(true);
  });

  it('rejects an appId that is not a snowflake (too short)', () => {
    const result = HybridSetupBotSchema.safeParse({
      type: 'hybrid_setup_bot',
      appId: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an appId containing non-digits', () => {
    const result = HybridSetupBotSchema.safeParse({
      type: 'hybrid_setup_bot',
      appId: 'abc123456789012345',
    });
    expect(result.success).toBe(false);
  });

  it('validateWsMessage accepts hybrid_setup_bot', () => {
    const result = validateWsMessage({
      type: 'hybrid_setup_bot',
      appId: '987654321098765432',
    });
    expect(result.success).toBe(true);
  });
});

describe('WsAuthSchema (v0.4.0 security)', () => {
  it('validates a normal auth message with a 32+ char secret', () => {
    const result = WsAuthSchema.safeParse({
      type: 'auth',
      secret: 'a'.repeat(32),
    });
    expect(result.success).toBe(true);
  });

  it('validates a base64 secret', () => {
    const result = WsAuthSchema.safeParse({
      type: 'auth',
      secret: 'k6J9bE2VnQ4mP8xR3tY7wZ0aB1cD5eF6gH7iJ8kL9mN=',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a too-short secret', () => {
    const result = WsAuthSchema.safeParse({
      type: 'auth',
      secret: 'short',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing secret', () => {
    const result = WsAuthSchema.safeParse({
      type: 'auth',
    });
    expect(result.success).toBe(false);
  });

  it('validateWsMessage accepts auth message', () => {
    const result = validateWsMessage({
      type: 'auth',
      secret: 'x'.repeat(44),
    });
    expect(result.success).toBe(true);
  });
});
