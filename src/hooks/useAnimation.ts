/**
 * Hook pour gérer les animations de statut
 */

import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { AnimationFrame } from '@/lib/websocket/types';

export interface UseAnimationOptions {
  wsHook: ReturnType<typeof useWebSocket>;
}

export interface UseAnimationReturn {
  frames: AnimationFrame[];
  isAnimating: boolean;
  delay: number;
  addFrame: (frame: AnimationFrame) => void;
  removeFrame: (index: number) => void;
  updateDelay: (delay: number) => void;
  start: () => void;
  stop: () => void;
  clear: () => void;
}

export function useAnimation({ wsHook }: UseAnimationOptions): UseAnimationReturn {
  const { send, isDiscordConnected } = wsHook;
  
  const [frames, setFrames] = useState<AnimationFrame[]>([
    { text: 'Eclipse', emoji: '🌑' },
    { text: 'By Antigravity', emoji: '🤖' }
  ]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [delay, setDelay] = useState(3000);

  const addFrame = useCallback((frame: AnimationFrame) => {
    setFrames(prev => [...prev, frame]);
  }, []);

  const removeFrame = useCallback((index: number) => {
    setFrames(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateDelay = useCallback((newDelay: number) => {
    setDelay(newDelay);
  }, []);

  const start = useCallback(() => {
    if (!isDiscordConnected) {
      return;
    }
    
    if (frames.length === 0) {
      return;
    }

    const success = send({
      type: 'start_animation',
      frames,
      delay
    } as any);

    if (success) {
      setIsAnimating(true);
    }
  }, [send, frames, delay, isDiscordConnected]);

  const stop = useCallback(() => {
    const success = send({ type: 'stop_animation' });
    if (success) {
      setIsAnimating(false);
    }
  }, [send]);

  const clear = useCallback(() => {
    stop();
    setFrames([]);
  }, [stop]);

  return {
    frames,
    isAnimating,
    delay,
    addFrame,
    removeFrame,
    updateDelay,
    start,
    stop,
    clear
  };
}
