/**
 * Hook WebSocket typé et robuste pour React
 * Remplace la logique inline dans page.tsx
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { showNotification, shouldNotify } from '@/lib/notification';
import type { 
  WsMessage, 
  DiscordUserInfo, 
  ToastMessage, 
  NotificationMessage,
  ErrorMessage,
  StatusMessage 
} from '@/lib/websocket/types';

export type ConnectionStatus = 
  | 'disconnected' 
  | 'connecting' 
  | 'connected' 
  | 'discord_connected';

export interface LogEntry {
  id: string;
  text: string;
  isDeleting?: boolean;
  type: 'info' | 'success' | 'warning' | 'error' | 'spy' | 'core';
  timestamp: Date;
}

export interface UseWebSocketOptions {
  url: string;
  onDiscordReady?: (user: DiscordUserInfo) => void;
  onError?: (message: string) => void;
  onMessage?: (data: any) => void;
  onSetupProgress?: (data: { step: string; message: string; token?: string; authorizeUrl?: string; error?: string }) => void;
}

export interface UseWebSocketReturn {
  // Connection
  status: ConnectionStatus;
  isConnected: boolean;
  isDiscordConnected: boolean;
  
  // User
  user: DiscordUserInfo | null;
  
  // Logs
  logs: LogEntry[];
  addLog: (text: string, type?: LogEntry['type']) => void;
  removeLog: (id: string) => void;
  clearLogs: () => void;
  
  // Actions
  connect: (token: string, appToken?: string) => void;
  disconnect: () => void;
  send: (message: Omit<WsMessage, 'timestamp'>) => boolean;
  authenticateWs: () => Promise<void>;

  // WebSocket ref
  ws: React.MutableRefObject<WebSocket | null>;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [user, setUser] = useState<DiscordUserInfo | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // Reconnection state
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 10;
  const reconnectDelay = 3000; // Base delay in ms
  
  // Log ID generator
  const logIdRef = useRef(0);
  const generateLogId = () => `log_${Date.now()}_${++logIdRef.current}`;

  // Add log helper
  const addLog = useCallback((text: string, type: LogEntry['type'] = 'info') => {
    const entry: LogEntry = {
      id: generateLogId(),
      text,
      type,
      timestamp: new Date()
    };
    
    setLogs(prev => [entry, ...prev].slice(0, 100));
  }, []);

  // Remove log with animation
  const removeLog = useCallback((id: string) => {
    setLogs(prev => prev.map(l => 
      l.id === id ? { ...l, isDeleting: true } : l
    ));
    
    setTimeout(() => {
      setLogs(prev => prev.filter(l => l.id !== id));
    }, 300);
  }, []);

  // Clear all logs
  const clearLogs = useCallback(() => {
    setLogs(prev => prev.map(l => ({ ...l, isDeleting: true })));
    setTimeout(() => setLogs([]), 300);
  }, []);

  // Send message
  const send = useCallback((message: Omit<WsMessage, 'timestamp'>): boolean => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      addLog('WebSocket non connecté', 'error');
      return false;
    }

    try {
      ws.current.send(JSON.stringify(message));
      return true;
    } catch (err) {
      addLog(`Erreur envoi: ${err}`, 'error');
      return false;
    }
  }, [addLog]);

  // Connect to Discord (after WS is ready)
  const connect = useCallback((token: string, appToken?: string) => {
    if (!token) {
      toast.error('Token utilisateur requis');
      return;
    }

    if (ws.current?.readyState !== WebSocket.OPEN) {
      toast.error('Core non connecté');
      return;
    }

    setStatus('connecting');
    addLog(appToken ? 'Connexion à Discord...' : 'Connexion à Discord (sans Slash Commands)...', 'info');

    send({
      type: 'init',
      token,
      appToken: appToken || undefined
    } as any);
  }, [send, addLog]);

  // v0.4.0: authentifier la connexion WS avec le secret Tauri
  const authenticateWs = useCallback(async () => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const secret = await invoke<string | null>('get_ws_secret');
      if (secret) {
        ws.current.send(JSON.stringify({ type: 'auth', secret }));
        addLog('Authentification WS...', 'info');
      }
    } catch (err) {
      // En mode dev (hors Tauri), pas de secret = pas d'auth = OK
      addLog(`Auth WS ignorée (mode dev): ${err}`, 'info');
    }
  }, [addLog]);

  // Disconnect
  const disconnect = useCallback(() => {
    ws.current?.close();
    setStatus('disconnected');
    setUser(null);
  }, []);

  // Message handlers
  const handleDiscordReady = useCallback((data: { user: DiscordUserInfo }) => {
    setUser(data.user);
    setStatus('discord_connected');
    addLog(`Connecté: ${data.user.tag}`, 'success');
    // Pas de toast ici : le toast est delégué à options.onDiscordReady
    // pour éviter le double-toast (hook + callback) que l'utilisateur a signale.
    options.onDiscordReady?.(data.user);
  }, [addLog, options]);

  const handleToast = useCallback((data: ToastMessage) => {
    addLog(`${data.title}: ${data.content || ''}`, 'info');
    
    // Determine toast type based on title
    const title = data.title.toLowerCase();
    if (title.includes('ajouté') || title.includes('réussie') || title.includes('succès')) {
      toast.success(data.title, { description: data.content, position: 'bottom-right' });
    } else if (title.includes('retiré') || title.includes('supprimé') || title.includes('erreur')) {
      toast.error(data.title, { description: data.content, position: 'bottom-right' });
    } else {
      toast.info(data.title, { description: data.content, position: 'bottom-right' });
    }
  }, [addLog]);

  const handleNotification = useCallback((data: NotificationMessage) => {
    const isAlert = data.action.includes('removed') || data.action.includes('ghost');
    const isSpy = data.action.includes('spy') || data.action.includes('ghost');
    
    const type: LogEntry['type'] = isAlert ? 'error' : isSpy ? 'spy' : 'info';
    addLog(data.title ? `[${data.title}] ${data.content}` : data.content, type);

    if (data.title) {
      toast.info(data.title, { 
        description: data.content, 
        position: 'bottom-right' 
      });
    }

    // Notification système si l'app est en arrière-plan
    if (shouldNotify()) {
      showNotification(data);
    }
  }, [addLog]);

  const handleStatus = useCallback((data: StatusMessage) => {
    addLog(`[Status] ${data.message}`, 'info');
  }, [addLog]);

  const handleError = useCallback((data: ErrorMessage) => {
    addLog(`[Erreur] ${data.message}`, 'error');
    // Pas de toast ici : le toast est delégué à options.onError
    // pour éviter le double-toast (hook + callback) que l'utilisateur a signale.
    setStatus('connected'); // Reset to connected but not discord_connected
    options.onError?.(data.message);
  }, [addLog, options]);

  // Setup WebSocket with reconnection
  useEffect(() => {
    let isActive = true;

    const connect = () => {
      if (!isActive) return;
      
      try {
        const socket = new WebSocket(options.url);
        ws.current = socket;

        socket.onopen = () => {
          if (!isActive) {
            socket.close();
            return;
          }
          reconnectAttempts.current = 0;
          setStatus('connected');
          addLog('Connecté au Core local', 'success');
          // v0.4.0: authentifier la connexion WS avec le secret Tauri
          authenticateWs();
        };

        socket.onclose = () => {
          if (!isActive) return;
          
          setStatus('disconnected');
          setUser(null);
          addLog('Déconnecté du Core', 'warning');
          
          // Attempt reconnection with exponential backoff
          if (reconnectAttempts.current < maxReconnectAttempts) {
            const delay = Math.min(reconnectDelay * Math.pow(1.5, reconnectAttempts.current), 30000);
            reconnectAttempts.current++;
            addLog(`Tentative de reconnexion ${reconnectAttempts.current}/${maxReconnectAttempts}...`, 'warning');
            
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isActive) connect();
            }, delay);
          } else {
            addLog('Nombre maximum de tentatives de reconnexion atteint', 'error');
          }
        };

        socket.onerror = (err) => {
          // WebSocket errors don't provide useful details in the event object
          // The actual error handling happens in onclose
          if (reconnectAttempts.current === 0) {
            addLog('Erreur WebSocket - tentative de connexion...', 'warning');
          }
        };

        socket.onmessage = (event) => {
          if (!isActive) return;
          
          try {
            const data = JSON.parse(event.data) as WsMessage;

            switch (data.type) {
              case 'discord_ready':
                handleDiscordReady(data as { user: DiscordUserInfo });
                break;
              case 'toast':
                handleToast(data as ToastMessage);
                break;
              case 'notification':
                handleNotification(data as NotificationMessage);
                break;
              case 'status':
                handleStatus(data as StatusMessage);
                break;
              case 'error':
                handleError(data as ErrorMessage);
                break;
              case 'backup_success':
                addLog(`[Backup] ${data.content}`, 'success');
                toast.success(data.title, { description: data.content });
                break;
              case 'core_log':
                // Logs du backend Core
                addLog(`[${data.module}] ${data.message}`, 'core');
                break;
              case 'bot_token_saved':
                if ((data as any).success) {
                  addLog('App Bot connecté! Slash Commands disponibles', 'success');
                  toast.success('Slash Commands', { description: (data as any).message });
                } else {
                  addLog(`Échec connexion App Bot: ${(data as any).message}`, 'error');
                  toast.error('Erreur', { description: (data as any).message });
                }
                break;
              case 'setup_progress':
                addLog(`[Setup] ${(data as any).message}`, (data as any).step === 'error' ? 'error' : 'info');
                options.onSetupProgress?.(data as any);
                break;
            }
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };
      } catch (err) {
        addLog(`Erreur de connexion: ${err}`, 'error');
      }
    };

    connect();

    return () => {
      isActive = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      ws.current?.close();
    };
  }, [options.url]); // Recreate only if URL changes

  return {
    status,
    isConnected: status === 'connected' || status === 'discord_connected',
    isDiscordConnected: status === 'discord_connected',
    user,
    logs,
    addLog,
    removeLog,
    clearLogs,
    connect,
    disconnect,
    send,
    authenticateWs,
    ws
  };
}
