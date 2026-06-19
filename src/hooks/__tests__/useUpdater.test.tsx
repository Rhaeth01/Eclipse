import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useUpdater } from '../useUpdater';

const checkMock = vi.fn();
const downloadAndInstallMock = vi.fn();
const relaunchMock = vi.fn();

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: (...args: any[]) => checkMock(...args),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: (...args: any[]) => relaunchMock(...args),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function makeUpdate() {
  return {
    version: '9.9.9',
    body: 'Notes de la mise à jour',
    date: '2026-06-19',
    downloadAndInstall: downloadAndInstallMock,
    install: vi.fn(),
  };
}

beforeEach(() => {
  checkMock.mockReset();
  downloadAndInstallMock.mockReset();
  relaunchMock.mockReset();
  checkMock.mockResolvedValue(null);
  downloadAndInstallMock.mockResolvedValue(undefined);
  relaunchMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useUpdater — détection', () => {
  it('détecte une mise à jour après 3s et expose updateAvailable', async () => {
    vi.useFakeTimers();
    const update = makeUpdate();
    checkMock.mockResolvedValueOnce(update);
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(result.current.updateAvailable).toBe(true);
    expect(result.current.updateInfo?.version).toBe('9.9.9');
    expect(result.current.updateInfo?.body).toBe('Notes de la mise à jour');
    expect(result.current.phase).toBe('idle');
  });

  it('reste silencieux si aucune mise à jour', async () => {
    vi.useFakeTimers();
    checkMock.mockResolvedValue(null);
    const { result } = renderHook(() => useUpdater());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });
    expect(result.current.updateAvailable).toBe(false);
  });
});

describe('useUpdater — downloadAndInstall', () => {
  it('passe par les phases downloading → installing et appelle downloadAndInstall', async () => {
    const update = makeUpdate();
    checkMock.mockResolvedValue(update);
    downloadAndInstallMock.mockImplementation(async (cb: any) => {
      cb({ event: 'Started', data: { contentLength: 1024 } });
      cb({ event: 'Progress', data: { chunkLength: 512 } });
      cb({ event: 'Progress', data: { chunkLength: 512 } });
      cb({ event: 'Finished' });
    });
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    expect(downloadAndInstallMock).toHaveBeenCalledTimes(1);
    expect(result.current.progress).toBe(100);
    expect(result.current.contentLength).toBe(1024);
    expect(result.current.downloaded).toBe(1024);
    expect(result.current.phase).toBe('installing');
  });

  it('calcule correctement le pourcentage de progression', async () => {
    const update = makeUpdate();
    checkMock.mockResolvedValue(update);
    downloadAndInstallMock.mockImplementation(async (cb: any) => {
      cb({ event: 'Started', data: { contentLength: 1000 } });
      cb({ event: 'Progress', data: { chunkLength: 250 } });
      cb({ event: 'Progress', data: { chunkLength: 250 } });
      cb({ event: 'Progress', data: { chunkLength: 250 } });
      cb({ event: 'Progress', data: { chunkLength: 250 } });
      cb({ event: 'Finished' });
    });
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    // 1000/1000 = 100%
    expect(result.current.progress).toBe(100);
    expect(result.current.downloaded).toBe(1000);
  });

  it('gère une erreur du téléchargement et passe en phase error', async () => {
    const update = makeUpdate();
    checkMock.mockResolvedValue(update);
    downloadAndInstallMock.mockRejectedValue(new Error('réseau coupé'));
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.downloadAndInstall();
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('réseau coupé');
  });
});

describe('useUpdater — reset', () => {
  it('reset remet la phase à idle et efface progress/error', async () => {
    const update = makeUpdate();
    checkMock.mockResolvedValue(update);
    downloadAndInstallMock.mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useUpdater());

    await act(async () => {
      await result.current.downloadAndInstall();
    });
    expect(result.current.phase).toBe('error');

    act(() => {
      result.current.reset();
    });
    expect(result.current.phase).toBe('idle');
    expect(result.current.error).toBe(null);
    expect(result.current.progress).toBe(0);
  });
});
