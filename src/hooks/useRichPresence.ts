/**
 * Hook pour gérer la Rich Presence Discord
 */

import { useState, useCallback } from 'react';
import { useWebSocket } from './useWebSocket';
import type { RpcFrame, ActivityType, RpcButton } from '@/lib/websocket/types';

export interface RpcFormState {
  name: string;
  appId: string;
  activityType: ActivityType;
  details: string;
  state: string;
  largeImage: string;
  largeText: string;
  smallImage: string;
  smallText: string;
  buttonText: string;
  buttonUrl: string;
  showTimestamp: boolean;
  customStartTimestamp: string;
  customEndTimestamp: string;
}

export interface UseRichPresenceOptions {
  wsHook: ReturnType<typeof useWebSocket>;
}

export interface UseRichPresenceReturn {
  form: RpcFormState;
  frames: RpcFrame[];
  isAnimating: boolean;
  animationDelay: number;
  updateForm: (updates: Partial<RpcFormState>) => void;
  setFixed: () => void;
  clearRichPresence: () => void;
  addToQueue: () => void;
  removeFrame: (index: number) => void;
  startAnimation: () => void;
  stopAnimation: () => void;
  updateAnimationDelay: (delay: number) => void;
  resetForm: () => void;
  buildFrame: () => RpcFrame;
  isActive: boolean;
  togglePresence: () => void;
}

const DEFAULT_FORM: RpcFormState = {
  name: 'Visual Studio Code',
  appId: '383226320970055681',
  activityType: 'PLAYING',
  details: '',
  state: '',
  largeImage: '',
  largeText: '',
  smallImage: '',
  smallText: '',
  buttonText: '',
  buttonUrl: '',
  showTimestamp: true,
  customStartTimestamp: '',
  customEndTimestamp: ''
};

export function useRichPresence({ wsHook }: UseRichPresenceOptions): UseRichPresenceReturn {
  const { send, isDiscordConnected } = wsHook;

  const [form, setForm] = useState<RpcFormState>(DEFAULT_FORM);
  const [frames, setFrames] = useState<RpcFrame[]>([]);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [animationDelay, setAnimationDelay] = useState(10000);

  const updateForm = useCallback((updates: Partial<RpcFormState>) => {
    setForm(prev => ({ ...prev, ...updates }));
  }, []);

  const buildFrame = useCallback((): RpcFrame => {
    const buttons: RpcButton[] = [];
    if (form.buttonText && form.buttonUrl) {
      buttons.push({ label: form.buttonText, url: form.buttonUrl });
    }

    const frame: any = {
      name: form.name || 'Custom Status',
      appId: form.appId || '383226320970055681',
      activityType: form.activityType,
      details: form.details || undefined,
      state: form.state || undefined,
      largeImage: form.largeImage || undefined,
      buttons: buttons.length > 0 ? buttons : undefined,
    };

    if (form.showTimestamp) {
      frame.startTimestamp = Date.now();
    } else {
      if (form.customStartTimestamp) {
        const start = parseInt(form.customStartTimestamp, 10);
        if (!isNaN(start)) frame.startTimestamp = start;
      }
      if (form.customEndTimestamp) {
        const end = parseInt(form.customEndTimestamp, 10);
        if (!isNaN(end)) frame.endTimestamp = end;
      }
    }

    if (form.smallImage) {
      frame.smallImage = form.smallImage;
    }

    return frame;
  }, [form]);

  const setFixed = useCallback(() => {
    if (!isDiscordConnected) return;

    const frame = buildFrame();
    send({
      type: 'set_rich_presence',
      ...frame
    } as any);
    setIsActive(true);
  }, [send, buildFrame, isDiscordConnected]);

  const clearRichPresence = useCallback(() => {
    if (!isDiscordConnected) return;
    send({ type: 'clear_rich_presence' } as any);
    setIsActive(false);
  }, [send, isDiscordConnected]);

  const togglePresence = useCallback(() => {
    if (isActive) {
      clearRichPresence();
    } else {
      setFixed();
    }
  }, [isActive, clearRichPresence, setFixed]);

  const addToQueue = useCallback(() => {
    const frame = buildFrame();
    setFrames(prev => [...prev, frame]);
  }, [buildFrame]);

  const removeFrame = useCallback((index: number) => {
    setFrames(prev => prev.filter((_, i) => i !== index));
  }, []);

  const startAnimation = useCallback(() => {
    if (!isDiscordConnected || frames.length === 0) return;

    const success = send({
      type: 'start_rpc_animation',
      frames,
      delay: animationDelay
    } as any);

    if (success) {
      setIsAnimating(true);
    }
  }, [send, frames, animationDelay, isDiscordConnected]);

  const stopAnimation = useCallback(() => {
    const success = send({ type: 'stop_rpc_animation' });
    if (success) {
      setIsAnimating(false);
    }
  }, [send]);

  const updateAnimationDelay = useCallback((delay: number) => {
    setAnimationDelay(Math.max(5000, Math.min(300000, delay)));
  }, []);

  const resetForm = useCallback(() => {
    setForm(DEFAULT_FORM);
  }, []);

  return {
    form,
    frames,
    isAnimating,
    animationDelay,
    updateForm,
    setFixed,
    clearRichPresence,
    addToQueue,
    removeFrame,
    startAnimation,
    stopAnimation,
    updateAnimationDelay,
    resetForm,
    buildFrame,
    isActive,
    togglePresence
  };
}
