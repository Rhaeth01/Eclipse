'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Command, ExternalLink, Copy, CheckCircle,
  ArrowRight, ArrowLeft, Key, Bot, Zap, Shield
} from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';

type WizardStep = 'welcome' | 'instructions' | 'token' | 'done';

interface SetupWizardProps {
  open: boolean;
  onClose: () => void;
  onTokenSave: (token: string) => Promise<void>;
  appTokenConfigured: boolean;
  onOpenPortal?: () => void;
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'welcome', label: 'Bienvenue' },
  { id: 'instructions', label: 'Application' },
  { id: 'token', label: 'Token' },
  { id: 'done', label: 'Terminé' },
];

export function SetupWizard({
  open,
  onClose,
  onTokenSave,
  appTokenConfigured,
  onOpenPortal
}: SetupWizardProps) {
  const [step, setStep] = useState<WizardStep>('welcome');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setStep(appTokenConfigured ? 'done' : 'welcome');
      setToken('');
      setError('');
    }
  }, [open, appTokenConfigured]);

  const handlePasteFromClipboard = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText && clipText.length >= 10 && clipText.length <= 200) {
        setToken(clipText);
        setError('');
      } else {
        setError('Aucun token valide détecté dans le presse-papier.');
      }
    } catch {
      setError('Accès au presse-papier refusé. Collez le token manuellement.');
    }
  };

  const handleSave = async () => {
    if (!token.trim() || token.trim().length < 10) {
      setError('Token invalide. Il doit contenir au moins 10 caractères.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onTokenSave(token.trim());
      setStep('done');
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la sauvegarde du token.');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenPortal = () => {
    if (onOpenPortal) {
      onOpenPortal();
    } else {
      window.open('https://discord.com/developers/applications', '_blank');
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 20 }}
          transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
          className="relative w-full max-w-lg mx-4 bg-[#0a0a0d] border border-white/[0.06] rounded-2xl shadow-[0_0_60px_-12px_rgba(230,154,0,0.08)] overflow-hidden"
        >
          {/* Progress bar */}
          <div className="flex border-b border-white/[0.05]">
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isPast = STEPS.findIndex(st => st.id === step) > i;
              return (
                <div
                  key={s.id}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-medium transition-colors duration-200
                    ${isActive ? 'text-[#e69a00] bg-white/[0.02]' : isPast ? 'text-[#7a7671]' : 'text-[#5c5c66]'}`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors duration-200
                    ${isActive ? 'bg-[#e69a00]/15 text-[#e69a00]' : isPast ? 'bg-[#2d9e8a]/15 text-[#2d9e8a]' : 'bg-[#1e1e22] text-[#5c5c66]'}`}>
                    {isPast ? <CheckCircle className="w-3 h-3" /> : i + 1}
                  </div>
                  {s.label}
                </div>
              );
            })}
          </div>

          <div className="p-8 min-h-[320px]">
            {/* Step 1: Welcome */}
            {step === 'welcome' && (
              <div className="text-center">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                  className="inline-flex mb-6"
                >
                  <div className="w-16 h-16 rounded-full bg-[#1a1a1e] border border-[#e69a00]/10 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-[#e69a00]" />
                  </div>
                </motion.div>

                <h2 className="text-xl font-bold text-[#e8e6e3] mb-3">
                  Configurer les Slash Commands
                </h2>
                <p className="text-sm text-[#7a7671] mb-8 max-w-sm mx-auto leading-relaxed">
                  Les Slash Commands vous permettent de contrôler Eclipse directement depuis Discord avec
                  des commandes comme <span className="text-[#b9b5ae] font-mono">/help</span>,{' '}
                  <span className="text-[#b9b5ae] font-mono">/ghostping</span> ou{' '}
                  <span className="text-[#b9b5ae] font-mono">/spy</span>.
                </p>

                <div className="flex flex-col gap-3">
                  <GlowButton
                    className="w-full"
                    onClick={() => setStep('instructions')}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    Configurer maintenant
                  </GlowButton>
                  <GlowButton
                    variant="secondary"
                    className="w-full"
                    onClick={onClose}
                  >
                    Plus tard
                  </GlowButton>
                </div>
              </div>
            )}

            {/* Step 2: Instructions */}
            {step === 'instructions' && (
              <div>
                <h2 className="text-lg font-semibold text-[#e8e6e3] mb-1">
                  Créer une application Discord
                </h2>
                <p className="text-sm text-[#7a7671] mb-6">
                  Vous avez besoin d&apos;un token d&apos;application Discord pour activer les Slash Commands.
                </p>

                <div className="space-y-4 mb-8">
                  {[
                    {
                      icon: ExternalLink,
                      color: '#e69a00',
                      text: 'Ouvrez le portail développeur Discord',
                      sub: (
                        <button
                          onClick={handleOpenPortal}
                          className="text-[#b9b5ae] underline underline-offset-2 hover:text-[#e69a00] transition-colors"
                        >
                          discord.com/developers/applications
                        </button>
                      )
                    },
                    {
                      icon: Bot,
                      color: '#8b9dc3',
                      text: 'Cliquez sur "New Application"',
                      sub: 'Donnez-lui un nom, par exemple "Eclipse", puis cliquez "Create".'
                    },
                    {
                      icon: Key,
                      color: '#2d9e8a',
                      text: 'Allez dans l\'onglet "Bot"',
                      sub: 'Cliquez "Add Bot" puis "Copy Token" pour copier le token.'
                    },
                  ].map(({ icon: Icon, color, text, sub }, i) => (
                    <div
                      key={i}
                      className="flex gap-4 p-3.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]"
                    >
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${color}10` }}
                      >
                        <Icon className="w-5 h-5" style={{ color }} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#e8e6e3]">{text}</p>
                        <p className="text-xs text-[#7a7671] mt-0.5">{sub}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <GlowButton
                    variant="secondary"
                    onClick={() => setStep('welcome')}
                    icon={<ArrowLeft className="w-4 h-4" />}
                    size="sm"
                  >
                    Retour
                  </GlowButton>
                  <GlowButton
                    className="flex-1"
                    onClick={() => setStep('token')}
                    icon={<ArrowRight className="w-4 h-4" />}
                  >
                    J&apos;ai mon token
                  </GlowButton>
                </div>
              </div>
            )}

            {/* Step 3: Token Input */}
            {step === 'token' && (
              <div>
                <h2 className="text-lg font-semibold text-[#e8e6e3] mb-1">
                  Entrez votre token
                </h2>
                <p className="text-sm text-[#7a7671] mb-6">
                  Collez le token copié depuis le portail développeur Discord.
                </p>

                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={token}
                      onChange={(e) => { setToken(e.target.value); setError(''); }}
                      placeholder="MTAxMjM0NTY3ODkw..."
                      className="w-full bg-[#0c0c0f] border border-white/[0.06] rounded-lg px-4 py-3 pr-12
                               text-[#e8e6e3] placeholder-[#5c5c66] font-mono text-sm
                               focus:outline-none focus:border-[#e69a00]/40 focus:ring-1 focus:ring-[#e69a00]/20
                               transition-all duration-200"
                    />
                    <button
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-12 top-1/2 -translate-y-1/2 text-[#5c5c66] hover:text-[#b9b5ae]"
                    >
                      <Shield className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handlePasteFromClipboard}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5c5c66] hover:text-[#b9b5ae]"
                      title="Coller depuis le presse-papier"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>

                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-[#d4656b] flex items-center gap-1.5"
                    >
                      <span className="w-1 h-1 rounded-full bg-[#d4656b]" />
                      {error}
                    </motion.p>
                  )}

                  <div className="p-3 rounded-lg bg-[#0c0c0f] border border-white/[0.04]">
                    <div className="flex items-start gap-2 text-xs text-[#7a7671]">
                      <Zap className="w-3.5 h-3.5 text-[#e69a00] mt-0.5 shrink-0" />
                      <p>
                        Votre token est stocké <span className="text-[#b9b5ae]">localement</span> sur votre
                        machine. Il n&apos;est jamais envoyé à un serveur externe. Assurez-vous de le garder
                        confidentiel.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <GlowButton
                    variant="secondary"
                    onClick={() => setStep('instructions')}
                    icon={<ArrowLeft className="w-4 h-4" />}
                    size="sm"
                  >
                    Retour
                  </GlowButton>
                  <GlowButton
                    className="flex-1"
                    onClick={handleSave}
                    loading={saving}
                    disabled={!token.trim() || token.trim().length < 10}
                    icon={<Key className="w-4 h-4" />}
                  >
                    {saving ? 'Validation...' : 'Enregistrer le token'}
                  </GlowButton>
                </div>
              </div>
            )}

            {/* Step 4: Done */}
            {step === 'done' && (
              <div className="text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                  className="inline-flex mb-6"
                >
                  <div className="w-16 h-16 rounded-full bg-[#2d9e8a]/10 border border-[#2d9e8a]/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-[#2d9e8a]" />
                  </div>
                </motion.div>

                <h2 className="text-xl font-bold text-[#e8e6e3] mb-3">
                  Configuration terminée !
                </h2>
                <p className="text-sm text-[#7a7671] mb-8 max-w-sm mx-auto leading-relaxed">
                  Les Slash Commands sont maintenant disponibles. Ouvrez Discord et tapez{' '}
                  <span className="text-[#b9b5ae] font-mono">/help</span> pour commencer.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-8">
                  {[
                    { icon: Zap, label: '/ghostping', color: '#e69a00' },
                    { icon: Command, label: '/spy', color: '#8b9dc3' },
                    { icon: Bot, label: '/help', color: '#2d9e8a' },
                    { icon: Sparkles, label: '44+ commandes', color: '#9b83cb' },
                  ].map(({ icon: Icon, label, color }) => (
                    <div
                      key={label}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-[#0c0c0f] border border-white/[0.04]"
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color }} />
                      <span className="text-xs font-mono text-[#b9b5ae]">{label}</span>
                    </div>
                  ))}
                </div>

                <GlowButton className="w-full" onClick={onClose}>
                  Commencer
                </GlowButton>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
