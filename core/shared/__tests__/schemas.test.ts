import { describe, it, expect } from 'vitest';
import {
  InitMessageSchema,
  SaveBotTokenSchema,
  BotTokenSavedSchema,
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
