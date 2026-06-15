'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import {
  Shield, Zap, Activity, Eye, Lock,
  Sparkles, Moon, Settings, User,
  Play, Square, Plus, X,
  Clock, MessageSquare, Download,
  Radio, AlertTriangle, Image, Link, Type, Gamepad2,
  Gift, Target, Bell, Command, Clipboard
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { Console, LogEntry } from '@/components/ui/Console';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { SetupWizard } from '@/components/SetupWizard';

import { useWebSocket, useAnimation, useRichPresence } from '@/hooks';
import { useUpdater } from '@/hooks/useUpdater';
import { updateWindowState } from '@/lib/notification';
import { ActivityType } from '@/lib/websocket/types';

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ElementType }[] = [
  { value: 'PLAYING', label: 'Joue à', icon: Gamepad2 },
  { value: 'LISTENING', label: 'Écoute', icon: Radio },
  { value: 'WATCHING', label: 'Regarde', icon: Eye },
  { value: 'COMPETING', label: 'Compète en', icon: Zap },
];

export default function Home() {
  const wsHook = useWebSocket({
    url: 'ws://localhost:4040',
    onDiscordReady: (u) => {
      toast.success('Connecté', { description: `Bienvenue ${u.tag}` });
    },
    onError: (msg) => {
      toast.error('Erreur', { description: msg });
    },
    onSetupProgress: (data) => {
      setSetupProgress(data);
    }
  });

  const { status, isDiscordConnected, user, logs, clearLogs, connect } = wsHook;
  const animation = useAnimation({ wsHook });
  const richPresence = useRichPresence({ wsHook });
  const updater = useUpdater();

  const [appToken, setAppToken] = useState('');
  const [userToken, setUserToken] = useState('');
  const [showManualToken, setShowManualToken] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [appTokenConfigured, setAppTokenConfigured] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [setupProgress, setSetupProgress] = useState<any>(null);

  const [stealthMode, setStealthMode] = useState(true);
  const [silentTyping, setSilentTyping] = useState(false);

  const [sniperConfig, setSniperConfig] = useState({
    nitroSniper: false,
    giveawayJoiner: false,
    blockDetection: false,
    pingDetection: false
  });

  const [activeTab, setActiveTab] = useState('dashboard');

  // v0.4.0: charge le bot token depuis le secure store (AES-256-GCM chiffré,
  // stocké dans %APPDATA%/Eclipse/secure.bin) au lieu de localStorage en clair.
  useEffect(() => {
    (async () => {
      try {
        const saved = await invoke<string | null>('load_bot_token');
        if (saved) {
          setAppToken(saved);
          setAppTokenConfigured(true);
        }
      } catch {
        // Pas de token stocké ou erreur de déchiffrement — comportement normal au premier lancement
      }
    })();
  }, []);

  useEffect(() => {
    if (isDiscordConnected && !appTokenConfigured && !localStorage.getItem('eclipse_onboarded')) {
      const timer = setTimeout(() => setShowSetupWizard(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [isDiscordConnected, appTokenConfigured]);

  useEffect(() => {
    const unlisten = listen<string>('bot-token-extracted', (event) => {
      const token = event.payload;
      if (token) {
        handleSaveBotToken(token);
        invoke('close_setup_webview').catch(() => {});
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>('bot-app-id-extracted', (event) => {
      const appId = event.payload;
      if (appId && /^\d{17,20}$/.test(appId)) {
        wsHook.send({ type: 'hybrid_setup_bot', appId } as any);
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [wsHook]);

  useEffect(() => {
    const unlisten = listen<string>('core-startup-error', (event) => {
      toast.error('Core introuvable', {
        description: event.payload || 'Le backend Node.js n\'a pas pu démarrer.',
        duration: Infinity
      });
    });
    return () => { unlisten.then(fn => fn()); };
  }, []);

  useEffect(() => {
    const updateState = async () => {
      try {
        const appWindow = getCurrentWindow();
        const focused = await appWindow.isFocused();
        const visible = await appWindow.isVisible();
        updateWindowState(focused, visible);
      } catch {
        updateWindowState(document.hasFocus(), document.visibilityState === 'visible');
      }
    };

    const handleFocus = () => updateState();
    const handleBlur = () => updateWindowState(false, true);
    const handleVisibility = () => updateState();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);
    updateState();

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const handleHybridSetup = async (appId: string) => {
    if (!appId || !/^\d{17,20}$/.test(appId)) {
      toast.error('App ID invalide', { description: 'L\'App ID doit être un nombre à 17-20 chiffres.' });
      return;
    }
    if (!isDiscordConnected) {
      toast.error('Connectez-vous d\'abord', { description: 'Le Core doit être connecté avant de configurer le Bot.' });
      return;
    }
    wsHook.send({ type: 'hybrid_setup_bot', appId } as any);
  };

  // v0.4.0: stocke le bot token dans le secure store (AES-256-GCM via Tauri)
  // au lieu de localStorage en clair.
  const persistBotToken = async (token: string) => {
    try {
      await invoke<string>('store_bot_token', { token: token.trim() });
    } catch (err: any) {
      toast.error('Erreur sauvegarde token', { description: err?.message || 'Impossible de stocker le token de manière sécurisée.' });
      throw err;
    }
  };

  const handleLogin = async (skipBot: boolean = false) => {
    const finalToken = skipBot ? undefined : appToken.trim() || undefined;
    setIsLoggingIn(true);
    try {
      const extractedToken = await invoke<string>('get_discord_token');
      if (finalToken) {
        await persistBotToken(finalToken);
        setAppTokenConfigured(true);
      }
      connect(extractedToken, finalToken);
    } catch (err: any) {
      if (userToken.trim()) {
        if (finalToken) {
          await persistBotToken(finalToken);
          setAppTokenConfigured(true);
        }
        connect(userToken.trim(), finalToken);
      } else {
        setShowManualToken(true);
        toast.error('Token utilisateur requis', {
          description: err?.message || 'Entrez votre token Discord manuellement.'
        });
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleSaveBotToken = async (token: string) => {
    if (!token.trim() || token.trim().length < 10) {
      toast.error('Token invalide', { description: 'Le token doit contenir au moins 10 caractères.' });
      return;
    }
    await persistBotToken(token.trim());
    setAppToken(token.trim());
    setAppTokenConfigured(true);
    wsHook.send({ type: 'save_bot_token', appToken: token.trim() } as any);
    toast.success('Token enregistré', { description: 'Slash Commands disponibles!' });
  };

  const handleStealthToggle = (newValue: boolean) => {
    setStealthMode(newValue);
    wsHook.send({ type: 'set_stealth_mode', value: newValue } as any);
    toast.success(`Mode furtif ${newValue ? 'activé' : 'désactivé'}`);
  };

  const handleSilentTypingToggle = (newValue: boolean) => {
    setSilentTyping(newValue);
    wsHook.send({ type: 'set_silent_typing', value: newValue } as any);
  };

  const handleSniperToggle = (key: keyof typeof sniperConfig, value: boolean) => {
    const newConfig = { ...sniperConfig, [key]: value };
    setSniperConfig(newConfig);
    wsHook.send({ type: 'update_sniper_config', config: { [key]: value } } as any);
    toast.success(`${key} ${value ? 'activé' : 'désactivé'}`);
  };

  const consoleLogs: LogEntry[] = logs.map(l => ({
    id: l.id,
    type: l.type === 'core' ? 'core' :
      l.text.toLowerCase().includes('erreur') ? 'error' :
        l.text.includes('✅') || l.text.toLowerCase().includes('succès') ? 'success' :
          l.text.includes('👁️') || l.text.includes('👻') ? 'spy' :
            l.text.includes('⚠️') ? 'warning' : 'info',
    title: l.text.split(' - ')[0] || l.text,
    message: l.text.split(' - ').slice(1).join(' - ') || undefined,
    timestamp: l.timestamp,
    isDeleting: l.isDeleting
  }));

  // ── Login screen ──
  if (!isDiscordConnected) {
    return (
      <main className="min-h-screen bg-[#070709] flex items-center justify-center relative overflow-hidden">
        <Toaster theme="dark" richColors position="bottom-right" />

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <GlassCard className="p-10">
            <div className="text-center mb-10">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                className="inline-flex mb-6"
              >
                <div className="w-20 h-20 rounded-full bg-[#1a1a1e] border border-white/[0.06] flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#070709] border-2 border-[#e69a00]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#e69a00]/8 to-transparent" />
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-[#e69a00]/30 rounded-full" />
                  </div>
                </div>
              </motion.div>
              <h1 className="text-[2.25rem] font-bold text-[#e8e6e3] tracking-[0.02em] leading-none">
                Eclipse
              </h1>
              <div className="flex items-center justify-center gap-3 mt-3">
                <span className="h-px w-6 bg-white/[0.08]" />
                <p className="text-[#7a7671] text-sm font-medium tracking-wider uppercase">Discord Toolkit</p>
                <span className="h-px w-6 bg-white/[0.08]" />
              </div>
            </div>

            <ConnectionStatus
              state={status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'}
              className="mb-6"
            />

            <div className="space-y-4">
              {showManualToken && (
                <div>
                  <label className="text-sm font-medium text-[#7a7671] mb-2 block">
                    Token utilisateur Discord
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={userToken}
                      onChange={(e) => setUserToken(e.target.value)}
                      placeholder="Collez votre token utilisateur..."
                      className="w-full bg-[#0c0c0f] border border-[#d4656b]/20 rounded-lg px-4 py-3
                               text-[#e8e6e3] placeholder-[#5c5c66]
                               focus:outline-none focus:border-[#d4656b]/40 focus:ring-1 focus:ring-[#d4656b]/20
                               transition-all duration-200 text-sm"
                    />
                  </div>
                  <p className="text-xs text-[#d4656b]/70 mt-2">
                    L&apos;extraction automatique a échoué. Entrez votre token Discord manuellement.
                    C&apos;est normal sous Linux.
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-[#7a7671] mb-2 block">
                  Application Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={appToken}
                    onChange={(e) => setAppToken(e.target.value)}
                    placeholder="Entrez votre token Discord..."
                    className="w-full bg-[#0c0c0f] border border-white/[0.06] rounded-lg px-4 py-3 pr-12
                             text-[#e8e6e3] placeholder-[#5c5c66]
                             focus:outline-none focus:border-[#e69a00]/40 focus:ring-1 focus:ring-[#e69a00]/20
                             transition-all duration-200 text-sm"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c5c66] hover:text-[#b9b5ae]"
                  >
                    {showToken ? <Eye className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-[#5c5c66] mt-2">
                  Optionnel. Requis uniquement pour les Slash Commands. Stocké localement.
                </p>
              </div>

              <div className="space-y-3">
                <GlowButton
                  onClick={() => handleLogin(appToken.trim() ? false : true)}
                  loading={isLoggingIn}
                  disabled={status === 'connecting'}
                  className="w-full"
                  size="lg"
                >
                  {isLoggingIn ? 'Connexion...' : appToken.trim() ? 'Se connecter' : 'Se connecter sans Slash Commands'}
                </GlowButton>
                {appToken.trim() && (
                  <GlowButton
                    variant="secondary"
                    onClick={() => handleLogin(true)}
                    disabled={status === 'connecting' || isLoggingIn}
                    className="w-full"
                    size="lg"
                  >
                    Passer (sans Slash Commands)
                  </GlowButton>
                )}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/[0.06]">
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: Shield, label: 'Sécurisé' },
                  { icon: Zap, label: 'Rapide' },
                  { icon: Sparkles, label: 'Premium' }
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <Icon className="w-4 h-4 text-[#e69a00]" />
                    </div>
                    <span className="text-xs text-[#5c5c66]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </main>
    );
  }

  // ── Main dashboard ──
  return (
    <main className="min-h-screen bg-[#070709] text-[#e8e6e3] overflow-hidden">
      <Toaster theme="dark" richColors position="bottom-right" />

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <aside className="w-56 shrink-0 border-r border-white/[0.05] bg-[#0a0a0d] flex flex-col">
          <div className="flex items-center gap-2.5 px-4 py-4">
            <div className="w-7 h-7 rounded-lg bg-[#1e1e22] border border-white/[0.05] flex items-center justify-center overflow-hidden">
              <div className="w-4 h-4 rounded-sm bg-[#070709] border border-[#e69a00]/20" />
            </div>
            <span className="text-base font-semibold tracking-tight">Eclipse</span>
          </div>

          <nav className="flex-1 px-3 space-y-0.5">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'presence', label: 'Rich Presence', icon: Radio },
              { id: 'settings', label: 'Paramètres', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 text-sm
                  ${activeTab === id
                    ? 'bg-[#1e1e22] text-[#e8e6e3] border border-white/[0.05]'
                    : 'text-[#5c5c66] hover:text-[#b9b5ae] hover:bg-white/[0.02]'
                  }`}
              >
                <Icon className={`w-4 h-4 ${activeTab === id ? 'text-[#e69a00]' : ''}`} />
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </nav>

          <div className="p-3 flex flex-col gap-3">
            <ConnectionStatus
              state="authenticated"
              user={user}
              className="w-full"
            />
            {!appTokenConfigured && (
              <div className="p-2.5 rounded-lg bg-[#1e1e22] border border-[#e69a00]/20">
                <p className="text-xs text-[#e69a00] font-medium mb-1">Slash Commands désactivés</p>
                <button
                  onClick={() => setActiveTab('settings')}
                  className="text-[10px] text-[#7a7671] hover:text-[#b9b5ae] underline underline-offset-2"
                >
                  Configurer →
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-14 shrink-0 border-b border-white/[0.05] flex items-center justify-between px-6 bg-[#0a0a0d]">
            <h2 className="text-sm font-semibold text-[#b9b5ae] capitalize">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'presence' && 'Rich Presence'}
              {activeTab === 'settings' && 'Paramètres'}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-xs text-[#5c5c66] font-mono">{user?.tag}</span>
              {user?.avatarURL ? (
                <img
                  src={user.avatarURL}
                  alt=""
                  className="w-7 h-7 rounded-full border border-white/[0.08]"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#1e1e22] border border-white/[0.08]" />
              )}
            </div>
          </header>

          <div className="flex-1 overflow-auto p-5">
            <AnimatePresence mode="wait">
              {/* ── Dashboard tab ── */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="grid grid-cols-12 gap-5 max-w-5xl mx-auto"
                >
                  <div className="col-span-12 grid grid-cols-4 gap-3">
                    {[
                      { label: 'Serveurs', value: user?.guildsCount || 0, icon: Shield },
                      { label: 'Amis', value: user?.friendsCount || 0, icon: User },
                      { label: 'Logs', value: logs.length, icon: MessageSquare },
                      { label: 'Status', value: animation.isAnimating ? 'Actif' : 'Inactif', icon: Activity },
                    ].map(({ label, value, icon: Icon }) => (
                      <GlassCard key={label} className="p-4" hover={false}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-[#1e1e22]">
                            <Icon className="w-4 h-4 text-[#b9b5ae]" />
                          </div>
                          <div>
                            <p className="text-xl font-semibold tabular-nums font-mono">{value}</p>
                            <p className="text-xs text-[#5c5c66]">{label}</p>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Console */}
                  <div className="col-span-12">
                    <Console
                      logs={consoleLogs}
                      onClear={clearLogs}
                      maxHeight="420px"
                    />
                  </div>
                </motion.div>
              )}

              {/* ── Presence tab ── */}
              {activeTab === 'presence' && (
                <motion.div
                  key="presence"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="h-full flex flex-col max-w-4xl mx-auto"
                >
                  <div className="mb-4">
                    <GlassCard className="p-4">
                      <div className="flex items-center gap-5">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-[#0c0c0f] border border-white/[0.06]"
                          title={richPresence.form.largeText}>
                          {richPresence.form.largeImage ? (
                            <img
                              src={richPresence.form.largeImage.startsWith('http')
                                ? richPresence.form.largeImage
                                : `https://cdn.discordapp.com/app-assets/${richPresence.form.appId}/${richPresence.form.largeImage}.png`}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <Gamepad2 className="w-6 h-6 text-[#e69a00] m-auto" />
                          )}
                          {richPresence.form.smallImage && (
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full border-2 border-[#111114] bg-[#111114] overflow-hidden"
                              title={richPresence.form.smallText}>
                              <img
                                src={richPresence.form.smallImage.startsWith('http')
                                  ? richPresence.form.smallImage
                                  : `https://cdn.discordapp.com/app-assets/${richPresence.form.appId}/${richPresence.form.smallImage}.png`}
                                alt=""
                                className="w-full h-full object-cover rounded-full"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            </div>
                          )}
                        </div>

                        <div>
                          <p className="text-[11px] text-[#7a7671] uppercase tracking-wider">
                            {ACTIVITY_TYPES.find(t => t.value === richPresence.form.activityType)?.label || 'Joue à'}
                          </p>
                          <h3 className="text-base font-semibold">{richPresence.form.name || 'Mon Application'}</h3>
                          <p className="text-sm text-[#7a7671]">{richPresence.form.details || 'Détails...'}</p>
                          <p className="text-xs text-[#5c5c66]">{richPresence.form.state || 'État...'}</p>
                        </div>

                        <div className="flex-1" />

                        <div className="flex items-center gap-2">
                          <GlowButton
                            variant={richPresence.isActive ? 'danger' : 'primary'}
                            size="sm"
                            onClick={richPresence.togglePresence}
                            icon={richPresence.isActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          >
                            {richPresence.isActive ? 'Désactiver' : 'Appliquer'}
                          </GlowButton>
                          <GlowButton
                            variant="secondary"
                            size="sm"
                            onClick={richPresence.addToQueue}
                            icon={<Plus className="w-3.5 h-3.5" />}
                          >
                            File
                          </GlowButton>
                        </div>
                      </div>
                    </GlassCard>
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
                    <GlassCard className="p-4 overflow-y-auto" hover={false}>
                      <h4 className="text-sm font-semibold text-[#b9b5ae] mb-4 flex items-center gap-2">
                        <Type className="w-4 h-4 text-[#e69a00]" />
                        Configuration
                      </h4>

                      <div className="space-y-4">
                        <div className="p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                          <h5 className="text-[11px] font-medium text-[#7a7671] uppercase tracking-wider mb-3">Application</h5>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-[#5c5c66] mb-1.5 block">Nom</label>
                              <input
                                type="text"
                                value={richPresence.form.name}
                                onChange={(e) => richPresence.updateForm({ name: e.target.value })}
                                placeholder="Visual Studio Code"
                                className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#5c5c66] mb-1.5 block">Application ID</label>
                              <input
                                type="text"
                                value={richPresence.form.appId}
                                onChange={(e) => richPresence.updateForm({ appId: e.target.value })}
                                placeholder="383226320970055681"
                                className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono
                                         focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                          <h5 className="text-[11px] font-medium text-[#7a7671] uppercase tracking-wider mb-3">Activité</h5>
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {ACTIVITY_TYPES.map(({ value, icon: Icon }) => (
                              <button
                                key={value}
                                onClick={() => richPresence.updateForm({ activityType: value })}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all duration-150 border
                                  ${richPresence.form.activityType === value
                                    ? 'bg-[#1e1e22] border-[#e69a00]/30 text-[#e8e6e3]'
                                    : 'bg-[#0c0c0f] border-white/[0.04] text-[#5c5c66] hover:text-[#b9b5ae]'}`}
                              >
                                <Icon className="w-4 h-4" />
                                {value[0]}
                              </button>
                            ))}
                          </div>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-[#5c5c66] mb-1.5 block">Détails</label>
                              <input
                                type="text" value={richPresence.form.details}
                                onChange={(e) => richPresence.updateForm({ details: e.target.value })}
                                placeholder="Édition de settings.json"
                                className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#5c5c66] mb-1.5 block">État</label>
                              <input
                                type="text" value={richPresence.form.state}
                                onChange={(e) => richPresence.updateForm({ state: e.target.value })}
                                placeholder="Workspace: Eclipse"
                                className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                          <h5 className="text-[11px] font-medium text-[#7a7671] uppercase tracking-wider mb-3">Images</h5>
                          <div className="grid grid-cols-2 gap-3">
                            {['largeImage', 'largeText', 'smallImage', 'smallText'].map((key, i) => (
                              <div key={key}>
                                <label className="text-xs text-[#5c5c66] mb-1.5 block">
                                  {i % 2 === 0 ? (i === 0 ? 'Grande image (clé)' : 'Petite image (clé)') : 'Texte'}
                                </label>
                                <input
                                  type="text"
                                  value={(richPresence.form as any)[key]}
                                  onChange={(e) => richPresence.updateForm({ [key]: e.target.value })}
                                  placeholder={i % 2 === 0 ? 'vscode_icon' : 'Visual Studio Code'}
                                  className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                          <h5 className="text-[11px] font-medium text-[#7a7671] uppercase tracking-wider mb-3">Bouton</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-[#5c5c66] mb-1.5 block">Texte</label>
                              <input
                                type="text" value={richPresence.form.buttonText}
                                onChange={(e) => richPresence.updateForm({ buttonText: e.target.value })}
                                placeholder="Regarder"
                                className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-[#5c5c66] mb-1.5 block">URL</label>
                              <input
                                type="text" value={richPresence.form.buttonUrl}
                                onChange={(e) => richPresence.updateForm({ buttonUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 rounded-lg bg-[#0c0c0f] border border-white/[0.04] cursor-pointer hover:bg-[#111114] transition-colors">
                            <Clock className="w-4 h-4 text-[#7a7671]" />
                            <span className="text-sm flex-1">Afficher le timer écoulé (Auto)</span>
                            <div className={`relative w-10 h-5 rounded-full transition-colors ${richPresence.form.showTimestamp ? 'bg-[#e69a00]' : 'bg-[#2a2a30]'}`}>
                              <motion.div
                                animate={{ x: richPresence.form.showTimestamp ? 20 : 2 }}
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                              />
                            </div>
                            <input type="checkbox" checked={richPresence.form.showTimestamp}
                              onChange={(e) => richPresence.updateForm({ showTimestamp: e.target.checked })}
                              className="hidden" />
                          </label>

                          <AnimatePresence>
                            {!richPresence.form.showTimestamp && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-2 gap-3 overflow-hidden"
                              >
                                {['customStartTimestamp', 'customEndTimestamp'].map((key) => (
                                  <div key={key}>
                                    <label className="text-xs text-[#5c5c66] mb-1.5 block">
                                      {key === 'customStartTimestamp' ? 'Début (Timestamp)' : 'Fin (Timestamp)'}
                                    </label>
                                    <input
                                      type="text" value={(richPresence.form as any)[key]}
                                      onChange={(e) => richPresence.updateForm({ [key]: e.target.value })}
                                      placeholder={key === 'customStartTimestamp' ? 'ex: 1714400000' : 'Optionnel'}
                                      className="w-full bg-[#0a0a0d] border border-white/[0.06] rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#e69a00]/30 transition-colors"
                                    />
                                  </div>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <GlowButton variant="secondary" className="w-full" size="sm" onClick={richPresence.resetForm}>
                          Réinitialiser le formulaire
                        </GlowButton>
                      </div>
                    </GlassCard>

                    <div className="flex flex-col gap-4 min-h-0">
                      <GlassCard className="flex-1 p-4 overflow-hidden flex flex-col" hover={false}>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-[#b9b5ae] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#e69a00]" />
                            File d&apos;animation
                          </h4>
                          <span className="text-xs text-[#5c5c66] bg-[#0c0c0f] px-2 py-1 rounded-full">
                            {richPresence.frames.length} frame(s)
                          </span>
                        </div>

                        {richPresence.frames.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-[#5c5c66]">
                            <Radio className="w-12 h-12 mb-3 opacity-20" />
                            <p className="text-sm">Aucune frame dans la file</p>
                            <p className="text-xs mt-1 text-[#5c5c66]">Ajoutez des frames pour créer une animation</p>
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                            {richPresence.frames.map((frame, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-3 rounded-lg bg-[#0c0c0f] border border-white/[0.04] group"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-[#e69a00] font-mono">#{i + 1}</span>
                                      <p className="font-medium text-sm truncate">{frame.name}</p>
                                    </div>
                                    {frame.details && <p className="text-xs text-[#7a7671] truncate mt-0.5">{frame.details}</p>}
                                    {frame.state && <p className="text-xs text-[#5c5c66] truncate">{frame.state}</p>}
                                  </div>
                                  <button
                                    onClick={() => richPresence.removeFrame(i)}
                                    className="text-[#5c5c66] hover:text-[#d4656b] opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </GlassCard>

                      <GlassCard className="p-4" hover={false}>
                        <h4 className="text-sm font-semibold text-[#b9b5ae] mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-[#2d9e8a]" />
                          Contrôles
                        </h4>
                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-[#5c5c66]">Délai</span>
                              <span className="text-[#7a7671] font-mono text-sm">{richPresence.animationDelay / 1000}s</span>
                            </div>
                            <input
                              type="range" min="5000" max="300000" step="5000"
                              value={richPresence.animationDelay}
                              onChange={(e) => richPresence.updateAnimationDelay(Number(e.target.value))}
                              className="w-full accent-[#e69a00] h-1.5 bg-white/[0.06] rounded-full appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] text-[#5c5c66] mt-1">
                              <span>5s</span><span>5min</span>
                            </div>
                          </div>
                          <GlowButton
                            variant={richPresence.isAnimating ? 'danger' : 'primary'} className="w-full"
                            onClick={richPresence.isAnimating ? richPresence.stopAnimation : richPresence.startAnimation}
                            icon={richPresence.isAnimating ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                            disabled={richPresence.frames.length === 0}
                          >
                            {richPresence.isAnimating ? 'Arrêter' : 'Démarrer l\'animation'}
                          </GlowButton>
                        </div>
                      </GlassCard>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ── Settings tab ── */}
              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="max-w-xl mx-auto space-y-5"
                >
                  <GlassCard className="p-5" hover={false}>
                    <h3 className="text-base font-semibold mb-5 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#e69a00]" />
                      Sécurité & Confidentialité
                    </h3>
                    <div className="space-y-3">
                      {[
                        { label: 'Mode furtif', desc: 'Réponses éphémères aux commandes', value: stealthMode, onChange: handleStealthToggle, color: '#e69a00' },
                        { label: 'Silent Typing', desc: 'Masque l\'indicateur de frappe', value: silentTyping, onChange: handleSilentTypingToggle, color: '#8b9dc3' },
                      ].map(({ label, desc, value, onChange, color }) => (
                        <div key={label} className="flex items-center justify-between p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                          <div>
                            <p className="font-medium text-sm">{label}</p>
                            <p className="text-xs text-[#5c5c66]">{desc}</p>
                          </div>
                          <button
                            onClick={() => onChange(!value)}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200`}
                            style={{ backgroundColor: value ? color : '#2a2a30' }}
                          >
                            <motion.div
                              animate={{ x: value ? 24 : 2 }}
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-5" hover={false}>
                    <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-[#b8860b]">
                      <Target className="w-4 h-4" />
                      Sniper & Auto
                    </h3>
                    <div className="space-y-3">
                      {[
                        { key: 'nitroSniper' as const, label: 'Nitro Sniper', desc: 'Détecte et claim les codes Nitro auto', color: '#d4656b', icon: Gift },
                        { key: 'giveawayJoiner' as const, label: 'Giveaway Joiner', desc: 'Rejoint automatiquement les giveaways', color: '#8b9dc3', icon: Gift },
                        { key: 'pingDetection' as const, label: 'Ping Detection', desc: 'Notifie quand quelqu\'un te ping', color: '#e69a00', icon: Bell },
                      ].map(({ key, label, desc, color, icon: Icon }) => (
                        <div key={key} className="flex items-center justify-between p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                          <div className="flex items-center gap-3">
                            <Icon className="w-4 h-4" style={{ color }} />
                            <div>
                              <p className="font-medium text-sm">{label}</p>
                              <p className="text-xs text-[#5c5c66]">{desc}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleSniperToggle(key, !sniperConfig[key])}
                            className={`relative w-12 h-6 rounded-full transition-colors duration-200`}
                            style={{ backgroundColor: sniperConfig[key] ? color : '#2a2a30' }}
                          >
                            <motion.div
                              animate={{ x: sniperConfig[key] ? 24 : 2 }}
                              className="absolute top-0.5 w-5 h-5 rounded-full bg-white"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-5" hover={false}>
                    <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-[#e69a00]">
                      <Command className="w-4 h-4" />
                      Slash Commands
                    </h3>
                    <div className="space-y-3">
                      {appTokenConfigured ? (
                        <>
                          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#0c0c0f] border border-[#2d9e8a]/20">
                            <div className="w-2 h-2 rounded-full bg-[#2d9e8a] animate-pulse" />
                            <p className="text-sm text-[#2d9e8a]">Token configuré — Slash Commands actifs</p>
                          </div>
                          <div className="relative">
                            <input
                              type="password"
                              value={appToken}
                              readOnly
                              className="w-full bg-[#0c0c0f] border border-white/[0.06] rounded-lg px-4 py-3 pr-12
                                       text-[#7a7671] text-sm cursor-default"
                            />
                            <button
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(appToken);
                                  toast.success('Token copié dans le presse-papier');
                                } catch {
                                  toast.error('Impossible de copier le token');
                                }
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c5c66] hover:text-[#b9b5ae]"
                            >
                              <Clipboard className="w-4 h-4" />
                            </button>
                          </div>
                          <GlowButton
                            variant="secondary"
                            className="w-full"
                            onClick={async () => {
                              try {
                                await invoke('clear_bot_token');
                              } catch (err: any) {
                                toast.error('Erreur', { description: err?.message || 'Impossible de supprimer le token.' });
                                return;
                              }
                              setAppToken('');
                              setAppTokenConfigured(false);
                              toast.info('Token retiré', { description: 'Les Slash Commands sont maintenant désactivés.' });
                            }}
                          >
                            Retirer le token
                          </GlowButton>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-[#7a7671]">
                            Pour utiliser les Slash Commands, vous devez configurer un token d&apos;application Discord.
                            Vous pouvez le faire automatiquement ou manuellement.
                          </p>
                          <div className="relative">
                            <input
                              type="password"
                              value={appToken}
                              onChange={(e) => setAppToken(e.target.value)}
                              placeholder="Collez votre token Discord..."
                              className="w-full bg-[#0c0c0f] border border-white/[0.06] rounded-lg px-4 py-3 pr-12
                                       text-[#e8e6e3] placeholder-[#5c5c66]
                                       focus:outline-none focus:border-[#e69a00]/40 focus:ring-1 focus:ring-[#e69a00]/20
                                       transition-all duration-200 text-sm"
                            />
                            <button
                              onClick={async () => {
                                try {
                                  const clipText = await navigator.clipboard.readText();
                                  if (clipText && clipText.length >= 10 && clipText.length <= 200) {
                                    setAppToken(clipText);
                                    toast.success('Token détecté dans le presse-papier!');
                                  } else {
                                    toast.info('Aucun token détecté dans le presse-papier');
                                  }
                                } catch {
                                  toast.error('Accès au presse-papier refusé');
                                }
                              }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c5c66] hover:text-[#b9b5ae]"
                              title="Coller depuis le presse-papier"
                            >
                              <Clipboard className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-2">
                            <GlowButton
                              variant="primary"
                              className="flex-1"
                              onClick={() => handleSaveBotToken(appToken)}
                              disabled={!appToken.trim()}
                            >
                              Enregistrer le token
                            </GlowButton>
                            <GlowButton
                              variant="secondary"
                              className="flex-1"
                              onClick={() => {
                                setActiveTab('dashboard');
                                setShowSetupWizard(true);
                              }}
                            >
                              Setup automatique
                            </GlowButton>
                          </div>
                          <div className="p-3 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                            <h4 className="text-sm font-medium text-[#b9b5ae] mb-2">Configuration manuelle :</h4>
                            <ol className="text-xs text-[#7a7671] space-y-1 ml-4 list-decimal">
                              <li>Aller sur <span className="text-[#b9b5ae]">discord.com/developers/applications</span></li>
                              <li>Créer une nouvelle application nommée &quot;Eclipse&quot;</li>
                              <li>Aller dans l&apos;onglet &quot;Bot&quot; et cliquer &quot;Add Bot&quot;</li>
                              <li>Cliquer &quot;Copy Token&quot; et le coller ci-dessus</li>
                            </ol>
                          </div>
                        </>
                      )}
                    </div>
                  </GlassCard>

                  <GlassCard glow="coral" className="p-5" hover={false}>
                    <h3 className="text-base font-semibold mb-5 flex items-center gap-2 text-[#d4656b]">
                      <AlertTriangle className="w-4 h-4" />
                      Zone dangereuse
                    </h3>
                    <div className="space-y-2.5">
                      <GlowButton variant="danger" className="w-full" onClick={() => { clearLogs(); toast.success('Logs effacés'); }}>
                        Effacer tous les logs
                      </GlowButton>
                      <GlowButton variant="danger" className="w-full" onClick={async () => {
                        try { await invoke('clear_bot_token'); } catch {}
                        window.location.reload();
                      }}>
                        Réinitialiser l&apos;état
                      </GlowButton>
                    </div>
                  </GlassCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <SetupWizard
        open={showSetupWizard}
        onClose={() => {
          setShowSetupWizard(false);
          setSetupProgress(null);
          localStorage.setItem('eclipse_onboarded', 'true');
        }}
        onTokenSave={async (token) => {
          await handleSaveBotToken(token);
          setSetupProgress(null);
          localStorage.setItem('eclipse_onboarded', 'true');
        }}
        onOpenPortal={() => {
          invoke('open_setup_webview').catch((err) => {
            toast.error('Erreur', { description: `Impossible d'ouvrir le portail: ${err}` });
            window.open('https://discord.com/developers/applications', '_blank');
          });
        }}
        onAutoSetup={() => {
          wsHook.send({ type: 'auto_setup_bot', appName: 'Eclipse' } as any);
        }}
        setupProgress={setupProgress}
        appTokenConfigured={appTokenConfigured}
      />

      {/* Update notification */}
      <AnimatePresence>
        {updater.updateAvailable && updater.updateInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
          >
            <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-[#111114] border border-[#e69a00]/20 shadow-[0_0_30px_-8px_rgba(230,154,0,0.1)]">
              <div>
                <p className="text-sm font-medium text-[#e8e6e3]">
                  v{updater.updateInfo.version} disponible
                </p>
                {updater.updateInfo.body && (
                  <p className="text-xs text-[#7a7671] mt-0.5 line-clamp-1">
                    {updater.updateInfo.body}
                  </p>
                )}
              </div>
              <GlowButton
                size="sm"
                onClick={updater.downloadAndInstall}
                loading={updater.downloading}
                icon={<Download className="w-3.5 h-3.5" />}
              >
                Installer
              </GlowButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
