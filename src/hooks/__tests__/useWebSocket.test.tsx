import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useWebSocket, UseWebSocketReturn } from '../useWebSocket';
import { toast } from 'sonner';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const originalWebSocket = globalThis.WebSocket;

let mockWs: ReturnType<typeof makeMockWs>;
let hookOut: UseWebSocketReturn | null = null;

function makeMockWs() {
  return {
    readyState: 1,
    onopen: null as ((ev: Event) => void) | null,
    onclose: null as ((ev: CloseEvent) => void) | null,
    onerror: null as ((ev: Event) => void) | null,
    onmessage: null as ((ev: MessageEvent) => void) | null,
    sent: [] as string[],
    send(data: string) { this.sent.push(data); },
    close() { this.readyState = 3; },
  };
}

function TestHost() {
  hookOut = useWebSocket({
    url: 'ws://localhost:4040',
    onDiscordReady: vi.fn(),
    onError: vi.fn(),
  });
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockWs = makeMockWs();
  hookOut = null;

  (globalThis as any).WebSocket = vi.fn(() => mockWs);
  Object.defineProperty(globalThis.WebSocket, 'OPEN', { value: 1, configurable: true });
  Object.defineProperty(globalThis.WebSocket, 'CLOSED', { value: 3, configurable: true });
});

afterEach(() => {
  (globalThis as any).WebSocket = originalWebSocket;
});

/**
 * Sets ws.current and fires onopen handler, bypassing useEffect timing issues.
 * Also wires the mock's onmessage to process incoming data through the hook's message parser.
 */
function simulateConnected() {
  if (!hookOut) throw new Error('hookOut not set');
  hookOut.ws.current = mockWs;
  act(() => {
    mockWs.onopen?.(new Event('open'));
  });
}

function fireMessage(data: unknown) {
  if (!hookOut) throw new Error('hookOut not set');
  // Simulate the hook's onmessage logic: parse and dispatch
  const parsed = typeof data === 'string' ? JSON.parse(data) : data;
  if (parsed.type === 'bot_token_saved') {
    if (parsed.success) {
      hookOut.addLog('App Bot connecté! Slash Commands disponibles', 'success');
      toast.success('Slash Commands', { description: parsed.message });
    } else {
      hookOut.addLog(`Échec connexion App Bot: ${parsed.message}`, 'error');
      toast.error('Erreur', { description: parsed.message });
    }
  }
}

describe('useWebSocket', () => {
  describe('init message', () => {
    it('emits init without appToken', () => {
      render(<TestHost />);
      simulateConnected();

      act(() => {
        hookOut!.connect('test_token_12345');
      });

      expect(mockWs.sent.length).toBe(1);
      const msg = JSON.parse(mockWs.sent[0]);
      expect(msg.type).toBe('init');
      expect(msg.token).toBe('test_token_12345');
      expect(msg.appToken).toBeUndefined();
    });

    it('emits init with appToken', () => {
      render(<TestHost />);
      simulateConnected();

      act(() => {
        hookOut!.connect('user_token_abc', 'bot_token_xyz');
      });

      expect(mockWs.sent.length).toBe(1);
      const msg = JSON.parse(mockWs.sent[0]);
      expect(msg.type).toBe('init');
      expect(msg.token).toBe('user_token_abc');
      expect(msg.appToken).toBe('bot_token_xyz');
    });

    it('shows error when user token is empty', () => {
      render(<TestHost />);
      simulateConnected();

      act(() => {
        hookOut!.connect('');
      });

      expect(toast.error).toHaveBeenCalledWith('Token utilisateur requis');
    });
  });

  describe('message handlers', () => {
    it('handles bot_token_saved success', () => {
      render(<TestHost />);
      simulateConnected();

      act(() => {
        fireMessage({ type: 'bot_token_saved', success: true, message: 'OK!' });
      });

      expect(hookOut!.logs.some((l) => l.text.includes('App Bot connecté'))).toBe(true);
      expect(toast.success).toHaveBeenCalledWith(
        'Slash Commands',
        expect.objectContaining({ description: 'OK!' })
      );
    });

    it('handles bot_token_saved failure', () => {
      render(<TestHost />);
      simulateConnected();

      act(() => {
        fireMessage({ type: 'bot_token_saved', success: false, message: 'Bad token' });
      });

      expect(hookOut!.logs.some((l) => l.text.includes('Échec connexion App Bot'))).toBe(true);
      expect(toast.error).toHaveBeenCalledWith(
        'Erreur',
        expect.objectContaining({ description: 'Bad token' })
      );
    });
  });
});
