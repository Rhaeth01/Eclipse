'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  Shield, Zap, Activity, Eye, Lock,
  Sparkles, Moon, Settings, User,
  Play, Square, Plus, X,
  Clock, MessageSquare,
  Radio, AlertTriangle, Image, Link, Type, Gamepad2,
  Gift, Target, Bell
} from 'lucide-react';
import { Toaster, toast } from 'sonner';

// Components
import { GlassCard } from '@/components/ui/GlassCard';
import { GlowButton } from '@/components/ui/GlowButton';
import { Console, LogEntry } from '@/components/ui/Console';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';


// Hooks
import { useWebSocket, useAnimation, useRichPresence } from '@/hooks';

// Services
import { updateWindowState } from '@/lib/notification';

// Types
import { ActivityType } from '@/lib/websocket/types';

const ACTIVITY_TYPES: { value: ActivityType; label: string; icon: React.ElementType }[] = [
  { value: 'PLAYING', label: 'Joue à', icon: Gamepad2 },
  { value: 'LISTENING', label: 'Écoute', icon: Radio },
  { value: 'WATCHING', label: 'Regarde', icon: Eye },
  { value: 'COMPETING', label: 'Compète en', icon: Zap },
];

export default function Home() {
  // WebSocket hook
  const wsHook = useWebSocket({
    url: 'ws://localhost:4040',
    onDiscordReady: (u) => {
      toast.success('Connecté', { description: `Bienvenue ${u.tag}` });
    },
    onError: (msg) => {
      toast.error('Erreur', { description: msg });
    }
  });

  const { status, isDiscordConnected, user, logs, clearLogs, connect } = wsHook;

  // Animation hooks
  const animation = useAnimation({ wsHook });
  const richPresence = useRichPresence({ wsHook });

  // Form states
  const [appToken, setAppToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Settings
  const [stealthMode, setStealthMode] = useState(true);
  const [silentTyping, setSilentTyping] = useState(false);

  // Sniper Settings
  const [sniperConfig, setSniperConfig] = useState({
    nitroSniper: false,
    giveawayJoiner: false,
    blockDetection: false,
    pingDetection: false
  });

  // Tabs
  const [activeTab, setActiveTab] = useState('dashboard');

  // Load saved token
  useEffect(() => {
    const saved = localStorage.getItem('eclipse_app_token');
    if (saved) setAppToken(saved);
  }, []);

  // Window focus/visibility tracking for notifications
  useEffect(() => {
    const updateState = async () => {
      try {
        const appWindow = getCurrentWindow();
        const focused = await appWindow.isFocused();
        const visible = await appWindow.isVisible();
        updateWindowState(focused, visible);
      } catch {
        // Fallback to document visibility
        updateWindowState(document.hasFocus(), document.visibilityState === 'visible');
      }
    };

    // Update on focus/visibility changes
    const handleFocus = () => updateState();
    const handleBlur = () => updateWindowState(false, true);
    const handleVisibility = () => updateState();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('visibilitychange', handleVisibility);

    // Initial state
    updateState();

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Login handler
  const handleLogin = async () => {
    if (!appToken.trim()) {
      toast.error('Token requis', { description: 'Veuillez entrer votre Application Token' });
      return;
    }

    setIsLoggingIn(true);
    try {
      const extractedToken = await invoke<string>('get_discord_token');
      localStorage.setItem('eclipse_app_token', appToken.trim());
      connect(extractedToken, appToken.trim());
    } catch (err: any) {
      toast.error('Erreur d\'extraction', { description: err.message });
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Toggle handlers
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

  // Convert logs to Console format
  const consoleLogs: LogEntry[] = logs.map(l => ({
    id: l.id,
    type: l.type === 'core' ? 'core' :
      l.text.includes('⚠️') || l.text.includes('erreur') ? 'error' :
        l.text.includes('✅') || l.text.includes('succès') ? 'success' :
          l.text.includes('👁️') || l.text.includes('👻') ? 'spy' :
            l.text.includes('⚠️') ? 'warning' : 'info',
    title: l.text.split(' - ')[0] || l.text,
    message: l.text.split(' - ')[1],
    timestamp: l.timestamp,
    isDeleting: l.isDeleting
  }));

  // If not connected to Discord, show login screen
  if (!isDiscordConnected) {
    return (
      <main className="min-h-screen bg-[#0a0a0b] flex items-center justify-center relative overflow-hidden">
        <Toaster theme="dark" richColors position="bottom-right" />

        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px]" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[100px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px]" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full max-w-md mx-4"
        >
          <GlassCard intensity="high" className="p-8">
            {/* Logo */}
            <div className="text-center mb-8">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                className="inline-flex p-4 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 mb-4"
              >
                <Moon className="w-12 h-12 text-indigo-400" />
              </motion.div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent">
                Eclipse
              </h1>
              <p className="text-zinc-500 mt-2">Discord Toolkit Premium</p>
            </div>

            <ConnectionStatus
              state={status === 'connected' ? 'connected' : status === 'connecting' ? 'connecting' : 'disconnected'}
              className="mb-6"
            />

            {/* Token input */}
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-zinc-400 mb-2 block">
                  Application Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={appToken}
                    onChange={(e) => setAppToken(e.target.value)}
                    placeholder="Entrez votre token Discord..."
                    className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-4 py-3 pr-12
                             text-white placeholder-zinc-600
                             focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50
                             transition-all duration-200"
                  />
                  <button
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                  >
                    {showToken ? <Eye className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-zinc-600 mt-2">
                  Requis pour les Slash Commands. Stocké localement.
                </p>
              </div>

              <GlowButton
                onClick={handleLogin}
                loading={isLoggingIn}
                disabled={status === 'connecting'}
                className="w-full"
                size="lg"
              >
                {isLoggingIn ? 'Connexion...' : 'Se connecter'}
              </GlowButton>
            </div>

            {/* Features preview */}
            <div className="mt-8 pt-6 border-t border-white/[0.08]">
              <div className="grid grid-cols-3 gap-4 text-center">
                {[
                  { icon: Shield, label: 'Sécurisé' },
                  { icon: Zap, label: 'Rapide' },
                  { icon: Sparkles, label: 'Premium' }
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2">
                    <div className="p-2 rounded-lg bg-white/[0.03]">
                      <Icon className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-xs text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </main>
    );
  }

  // Main dashboard
  return (
    <main className="min-h-screen bg-[#0a0a0b] text-white overflow-hidden">
      <Toaster theme="dark" richColors position="bottom-right" />

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Sidebar */}
        <aside className="w-64 border-r border-white/[0.08] bg-black/20 backdrop-blur-xl p-4 flex flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2 mb-8">
            <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20">
              <Moon className="w-6 h-6 text-indigo-400" />
            </div>
            <span className="text-xl font-bold">Eclipse</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: Activity },
              { id: 'presence', label: 'Rich Presence', icon: Radio },
              { id: 'settings', label: 'Paramètres', icon: Settings },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                  transition-all duration-200 group
                  ${activeTab === id
                    ? 'bg-indigo-500/20 text-white border border-indigo-500/30'
                    : 'text-zinc-400 hover:text-white hover:bg-white/[0.05]'
                  }
                `}
              >
                <Icon className={`w-5 h-5 ${activeTab === id ? 'text-indigo-400' : 'group-hover:text-zinc-200'}`} />
                <span className="text-sm font-medium">{label}</span>
                {activeTab === id && (
                  <motion.div
                    layoutId="activeTab"
                    className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400"
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Connection status in sidebar */}
          <div className="mt-auto">
            <ConnectionStatus
              state="authenticated"
              user={user}
              className="w-full"
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="h-16 border-b border-white/[0.08] flex items-center justify-between px-6 bg-black/10 backdrop-blur-sm">
            <h2 className="text-lg font-semibold capitalize">
              {activeTab === 'dashboard' && 'Dashboard'}
              {activeTab === 'presence' && 'Rich Presence'}
              {activeTab === 'settings' && 'Paramètres'}
            </h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-zinc-500">{user?.tag}</span>
              <img
                src={user?.avatarURL || ''}
                alt="Avatar"
                className="w-8 h-8 rounded-full border border-white/[0.12]"
              />
            </div>
          </header>

          {/* Content area */}
          <div className="flex-1 overflow-auto p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="grid grid-cols-12 gap-6 max-w-7xl mx-auto"
                >
                  {/* Stats cards */}
                  <div className="col-span-12 grid grid-cols-4 gap-4">
                    {[
                      { label: 'Serveurs', value: user?.guildsCount || 0, icon: Shield, color: 'indigo' },
                      { label: 'Amis', value: user?.friendsCount || 0, icon: User, color: 'emerald' },
                      { label: 'Logs', value: logs.length, icon: MessageSquare, color: 'amber' },
                      { label: 'Status', value: animation.isAnimating ? 'Actif' : 'Inactif', icon: Activity, color: 'rose' },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <GlassCard key={label} intensity="low" className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${color === 'indigo' ? 'bg-indigo-500/10' : color === 'emerald' ? 'bg-emerald-500/10' : color === 'amber' ? 'bg-amber-500/10' : 'bg-rose-500/10'}`}>
                            <Icon className={`w-5 h-5 ${color === 'indigo' ? 'text-indigo-400' : color === 'emerald' ? 'text-emerald-400' : color === 'amber' ? 'text-amber-400' : 'text-rose-400'}`} />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{value}</p>
                            <p className="text-xs text-zinc-500">{label}</p>
                          </div>
                        </div>
                      </GlassCard>
                    ))}
                  </div>

                  {/* Console */}
                  <div className="col-span-8">
                    <GlassCard intensity="medium" className="h-[500px] flex flex-col">
                      <Console
                        logs={consoleLogs}
                        onClear={clearLogs}
                        maxHeight="100%"
                      />
                    </GlassCard>
                  </div>
                </motion.div>
              )}

              {activeTab === 'presence' && (
                <motion.div
                  key="presence"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="h-full flex flex-col max-w-7xl mx-auto"
                >
                  {/* Header avec preview */}
                  <div className="mb-6">
                    <GlassCard intensity="high" className="p-4">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3">
                          <div className="relative w-24 h-24 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10"
                            title={richPresence.form.largeText}>
                            {richPresence.form.largeImage ? (
                              <img
                                src={richPresence.form.largeImage.startsWith('http')
                                  ? richPresence.form.largeImage
                                  : `https://cdn.discordapp.com/app-assets/${richPresence.form.appId}/${richPresence.form.largeImage}.png`}
                                alt="Large"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <Gamepad2 className="w-8 h-8 text-indigo-400" />
                            )}

                            {richPresence.form.smallImage ? (
                              <div className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full border-2 border-[#1E1F22] bg-[#1E1F22] overflow-hidden"
                                title={richPresence.form.smallText}>
                                <img
                                  src={richPresence.form.smallImage.startsWith('http')
                                    ? richPresence.form.smallImage
                                    : `https://cdn.discordapp.com/app-assets/${richPresence.form.appId}/${richPresence.form.smallImage}.png`}
                                  alt="Small"
                                  className="w-full h-full object-cover rounded-full"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ) : null}
                          </div>

                          <div>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider">
                              {ACTIVITY_TYPES.find(t => t.value === richPresence.form.activityType)?.label || 'Joue à'}
                            </p>
                            <h3 className="text-lg font-semibold">{richPresence.form.name || 'Mon Application'}</h3>
                            <p className="text-sm text-zinc-400">{richPresence.form.details || 'Détails...'}</p>
                            <p className="text-xs text-zinc-500">{richPresence.form.state || 'État...'}</p>
                          </div>
                        </div>

                        <div className="flex-1" />

                        {/* Quick Actions */}
                        <div className="flex items-center gap-2">
                          <GlowButton
                            variant={richPresence.isActive ? 'danger' : 'primary'}
                            size="sm"
                            onClick={richPresence.togglePresence}
                            icon={richPresence.isActive ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          >
                            {richPresence.isActive ? 'Désactiver' : 'Appliquer'}
                          </GlowButton>
                          <GlowButton
                            variant="primary"
                            size="sm"
                            onClick={richPresence.addToQueue}
                            icon={<Plus className="w-4 h-4" />}
                          >
                            Ajouter à la file
                          </GlowButton>
                        </div>
                      </div>
                    </GlassCard>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 grid grid-cols-2 gap-6 min-h-0">
                    {/* Left: Builder Form */}
                    <GlassCard intensity="medium" className="p-5 overflow-y-auto">
                      <h4 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                        <Type className="w-4 h-4 text-indigo-400" />
                        Configuration
                      </h4>

                      <div className="space-y-4">
                        {/* Section: Application */}
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <h5 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Application</h5>
                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Nom</label>
                              <input
                                type="text"
                                value={richPresence.form.name}
                                onChange={(e) => richPresence.updateForm({ name: e.target.value })}
                                placeholder="Visual Studio Code"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Application ID</label>
                              <input
                                type="text"
                                value={richPresence.form.appId}
                                onChange={(e) => richPresence.updateForm({ appId: e.target.value })}
                                placeholder="383226320970055681"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section: Activity */}
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <h5 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Activité</h5>

                          {/* Type */}
                          <div className="grid grid-cols-4 gap-2 mb-3">
                            {ACTIVITY_TYPES.map(({ value, icon: Icon }) => (
                              <button
                                key={value}
                                onClick={() => richPresence.updateForm({ activityType: value })}
                                className={`
                                  flex flex-col items-center gap-1 p-2 rounded-lg text-xs
                                  transition-all duration-200 border
                                  ${richPresence.form.activityType === value
                                    ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                                    : 'bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:text-white'
                                  }
                                `}
                              >
                                <Icon className="w-4 h-4" />
                                {value[0]}
                              </button>
                            ))}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Détails</label>
                              <input
                                type="text"
                                value={richPresence.form.details}
                                onChange={(e) => richPresence.updateForm({ details: e.target.value })}
                                placeholder="Édition de settings.json"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">État</label>
                              <input
                                type="text"
                                value={richPresence.form.state}
                                onChange={(e) => richPresence.updateForm({ state: e.target.value })}
                                placeholder="Workspace: Eclipse"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section: Images */}
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <h5 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Images</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Grande image (clé)</label>
                              <input
                                type="text"
                                value={richPresence.form.largeImage}
                                onChange={(e) => richPresence.updateForm({ largeImage: e.target.value })}
                                placeholder="vscode_icon"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Texte</label>
                              <input
                                type="text"
                                value={richPresence.form.largeText}
                                onChange={(e) => richPresence.updateForm({ largeText: e.target.value })}
                                placeholder="Visual Studio Code"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Petite image (clé)</label>
                              <input
                                type="text"
                                value={richPresence.form.smallImage}
                                onChange={(e) => richPresence.updateForm({ smallImage: e.target.value })}
                                placeholder="typescript_icon"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Texte</label>
                              <input
                                type="text"
                                value={richPresence.form.smallText}
                                onChange={(e) => richPresence.updateForm({ smallText: e.target.value })}
                                placeholder="TypeScript"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Section: Button */}
                        <div className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                          <h5 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">Bouton</h5>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">Texte</label>
                              <input
                                type="text"
                                value={richPresence.form.buttonText}
                                onChange={(e) => richPresence.updateForm({ buttonText: e.target.value })}
                                placeholder="Regarder"
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-zinc-500 mb-1.5 block">URL</label>
                              <input
                                type="text"
                                value={richPresence.form.buttonUrl}
                                onChange={(e) => richPresence.updateForm({ buttonUrl: e.target.value })}
                                placeholder="https://..."
                                className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm
                                         focus:outline-none focus:border-indigo-500/50 transition-colors"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Timestamp Toggle & Custom Inputs */}
                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06] 
                                          cursor-pointer hover:bg-white/[0.04] transition-colors">
                            <Clock className="w-4 h-4 text-zinc-500" />
                            <span className="text-sm flex-1">Afficher le timer écoulé (Auto)</span>
                            <div className={`
                              relative w-10 h-5 rounded-full transition-colors
                              ${richPresence.form.showTimestamp ? 'bg-indigo-500' : 'bg-zinc-700'}
                            `}>
                              <motion.div
                                animate={{ x: richPresence.form.showTimestamp ? 20 : 2 }}
                                className="absolute top-0.5 w-4 h-4 rounded-full bg-white"
                              />
                            </div>
                            <input
                              type="checkbox"
                              checked={richPresence.form.showTimestamp}
                              onChange={(e) => richPresence.updateForm({ showTimestamp: e.target.checked })}
                              className="hidden"
                            />
                          </label>

                          <AnimatePresence>
                            {!richPresence.form.showTimestamp && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-2 gap-3 overflow-hidden"
                              >
                                <div>
                                  <label className="text-xs text-zinc-500 mb-1.5 block">Début (Timestamp)</label>
                                  <input
                                    type="text"
                                    value={richPresence.form.customStartTimestamp}
                                    onChange={(e) => richPresence.updateForm({ customStartTimestamp: e.target.value })}
                                    placeholder="ex: 1714400000"
                                    className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono
                                             focus:outline-none focus:border-indigo-500/50 transition-colors"
                                  />
                                </div>
                                <div>
                                  <label className="text-xs text-zinc-500 mb-1.5 block">Fin (Timestamp)</label>
                                  <input
                                    type="text"
                                    value={richPresence.form.customEndTimestamp}
                                    onChange={(e) => richPresence.updateForm({ customEndTimestamp: e.target.value })}
                                    placeholder="Optionnel"
                                    className="w-full bg-black/30 border border-white/[0.08] rounded-lg px-3 py-2 text-sm font-mono
                                             focus:outline-none focus:border-indigo-500/50 transition-colors"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Reset */}
                        <GlowButton
                          variant="secondary"
                          className="w-full"
                          size="sm"
                          onClick={richPresence.resetForm}
                        >
                          Réinitialiser le formulaire
                        </GlowButton>
                      </div>
                    </GlassCard>

                    {/* Right: Animation Queue */}
                    <div className="flex flex-col gap-4 min-h-0">
                      <GlassCard intensity="medium" className="flex-1 p-5 overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-400" />
                            File d&apos;animation
                          </h4>
                          <span className="text-xs text-zinc-500 bg-white/[0.05] px-2 py-1 rounded-full">
                            {richPresence.frames.length} frame(s)
                          </span>
                        </div>

                        {richPresence.frames.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
                            <Radio className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-sm">Aucune frame dans la file</p>
                            <p className="text-xs mt-1 text-zinc-700">Ajoutez des frames pour créer une animation</p>
                          </div>
                        ) : (
                          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                            {richPresence.frames.map((frame, i) => (
                              <motion.div
                                key={i}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] group"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-indigo-400 font-mono">#{i + 1}</span>
                                      <p className="font-medium text-sm truncate">{frame.name}</p>
                                    </div>
                                    {frame.details && (
                                      <p className="text-xs text-zinc-500 truncate mt-0.5">{frame.details}</p>
                                    )}
                                    {frame.state && (
                                      <p className="text-xs text-zinc-600 truncate">{frame.state}</p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => richPresence.removeFrame(i)}
                                    className="text-zinc-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 
                                             transition-opacity p-1"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </GlassCard>

                      {/* Controls */}
                      <GlassCard intensity="medium" className="p-5">
                        <h4 className="text-sm font-semibold text-zinc-300 mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          Contrôles
                        </h4>

                        <div className="space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-zinc-500">Délai</span>
                              <span className="text-zinc-300 font-mono">{richPresence.animationDelay / 1000}s</span>
                            </div>
                            <input
                              type="range"
                              min="5000"
                              max="300000"
                              step="5000"
                              value={richPresence.animationDelay}
                              onChange={(e) => richPresence.updateAnimationDelay(Number(e.target.value))}
                              className="w-full accent-indigo-500 h-1.5 bg-white/[0.1] rounded-full appearance-none cursor-pointer"
                            />
                            <div className="flex justify-between text-xs text-zinc-600 mt-1">
                              <span>5s</span>
                              <span>5min</span>
                            </div>
                          </div>

                          <GlowButton
                            variant={richPresence.isAnimating ? 'danger' : 'primary'}
                            className="w-full"
                            onClick={richPresence.isAnimating ? richPresence.stopAnimation : richPresence.startAnimation}
                            icon={richPresence.isAnimating ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
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

              {activeTab === 'settings' && (
                <motion.div
                  key="settings"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="max-w-2xl mx-auto space-y-6"
                >
                  {/* Settings cards */}
                  <GlassCard intensity="medium" className="p-6">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-indigo-400" />
                      Sécurité & Confidentialité
                    </h3>

                    <div className="space-y-4">
                      {/* Stealth mode toggle */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div>
                          <p className="font-medium">Mode furtif</p>
                          <p className="text-sm text-zinc-500">Réponses éphémères aux commandes</p>
                        </div>
                        <button
                          onClick={() => handleStealthToggle(!stealthMode)}
                          className={`
                            relative w-14 h-7 rounded-full transition-colors duration-300
                            ${stealthMode ? 'bg-indigo-500' : 'bg-zinc-700'}
                          `}
                        >
                          <motion.div
                            animate={{ x: stealthMode ? 28 : 4 }}
                            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                          />
                        </button>
                      </div>

                      {/* Silent typing toggle */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div>
                          <p className="font-medium">Silent Typing</p>
                          <p className="text-sm text-zinc-500">Masque l&apos;indicateur de frappe</p>
                        </div>
                        <button
                          onClick={() => handleSilentTypingToggle(!silentTyping)}
                          className={`
                            relative w-14 h-7 rounded-full transition-colors duration-300
                            ${silentTyping ? 'bg-emerald-500' : 'bg-zinc-700'}
                          `}
                        >
                          <motion.div
                            animate={{ x: silentTyping ? 28 : 4 }}
                            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                          />
                        </button>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Sniper Settings */}
                  <GlassCard intensity="medium" className="p-6 border-amber-500/20">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-amber-400">
                      <Target className="w-5 h-5" />
                      Sniper & Auto
                    </h3>

                    <div className="space-y-4">
                      {/* Nitro Sniper */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="flex items-center gap-3">
                          <Gift className="w-5 h-5 text-pink-400" />
                          <div>
                            <p className="font-medium">Nitro Sniper</p>
                            <p className="text-sm text-zinc-500">Détecte et claim les codes Nitro auto</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSniperToggle('nitroSniper', !sniperConfig.nitroSniper)}
                          className={`
                            relative w-14 h-7 rounded-full transition-colors duration-300
                            ${sniperConfig.nitroSniper ? 'bg-pink-500' : 'bg-zinc-700'}
                          `}
                        >
                          <motion.div
                            animate={{ x: sniperConfig.nitroSniper ? 28 : 4 }}
                            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                          />
                        </button>
                      </div>

                      {/* Giveaway Joiner */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="flex items-center gap-3">
                          <Gift className="w-5 h-5 text-purple-400" />
                          <div>
                            <p className="font-medium">Giveaway Joiner</p>
                            <p className="text-sm text-zinc-500">Rejoint automatiquement les giveaways</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSniperToggle('giveawayJoiner', !sniperConfig.giveawayJoiner)}
                          className={`
                            relative w-14 h-7 rounded-full transition-colors duration-300
                            ${sniperConfig.giveawayJoiner ? 'bg-purple-500' : 'bg-zinc-700'}
                          `}
                        >
                          <motion.div
                            animate={{ x: sniperConfig.giveawayJoiner ? 28 : 4 }}
                            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                          />
                        </button>
                      </div>

                      {/* Ping Detection */}
                      <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                        <div className="flex items-center gap-3">
                          <Bell className="w-5 h-5 text-amber-400" />
                          <div>
                            <p className="font-medium">Ping Detection</p>
                            <p className="text-sm text-zinc-500">Notifie quand quelqu&apos;un te ping</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleSniperToggle('pingDetection', !sniperConfig.pingDetection)}
                          className={`
                            relative w-14 h-7 rounded-full transition-colors duration-300
                            ${sniperConfig.pingDetection ? 'bg-amber-500' : 'bg-zinc-700'}
                          `}
                        >
                          <motion.div
                            animate={{ x: sniperConfig.pingDetection ? 28 : 4 }}
                            className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-lg"
                          />
                        </button>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Danger zone */}
                  <GlassCard intensity="medium" className="p-6 border-rose-500/20">
                    <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-rose-400">
                      <AlertTriangle className="w-5 h-5" />
                      Zone dangereuse
                    </h3>

                    <div className="space-y-3">
                      <GlowButton variant="danger" className="w-full" onClick={() => { clearLogs(); toast.success('Logs effacés'); }}>
                        Effacer tous les logs
                      </GlowButton>
                      <GlowButton variant="danger" className="w-full" onClick={() => { localStorage.removeItem('eclipse_app_token'); window.location.reload(); }}>
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
    </main>
  );
}
