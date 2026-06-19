'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Shield, Eye, Users, Zap, Ban, Database } from 'lucide-react';

export default function WebsitePage() {
    const [mounted, setMounted] = useState(false);
    useState(() => { setMounted(true); });

    if (!mounted) return null;

    return (
        <main className="min-h-screen bg-[#070709] text-[#e8e6e3] selection:bg-[#e69a00]/20">
            {/* Hero */}
            <section className="relative flex flex-col items-center justify-center min-h-[80vh] px-6 pt-20 pb-16 text-center">
                <motion.div
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="max-w-2xl mx-auto"
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-8 rounded-full bg-white/[0.03] border border-white/[0.06] text-xs text-[#b9b5ae]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#2d9e8a]" />
                        v0.1.0 Beta
                    </div>

                    <Image
                        src="/wordmark.png"
                        alt="Eclipse"
                        width={480}
                        height={125}
                        priority
                        className="w-[28rem] max-w-full h-auto mb-6"
                    />
                    <p className="text-lg text-[#7a7671] mb-8 max-w-md mx-auto leading-relaxed">
                        Le toolkit Discord avancé. Rich Presence, animations, automatisation, le tout avec une âme.
                    </p>

                    <div className="flex items-center justify-center gap-3">
                        <a href="eclipse://open" className="px-5 py-2.5 rounded-lg bg-[#e69a00] text-[#070709] font-medium text-sm hover:bg-amber-400 transition-colors">
                            Télécharger
                        </a>
                        <a href="#features" className="px-5 py-2.5 rounded-lg bg-[#1e1e22] border border-white/[0.06] text-[#b9b5ae] font-medium text-sm hover:bg-[#252528] transition-colors">
                            En savoir plus
                        </a>
                    </div>
                </motion.div>

                {/* Dashboard preview */}
                <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                    className="mt-16 w-full max-w-3xl mx-auto"
                >
                    <div className="rounded-xl border border-white/[0.06] bg-[#0c0c0f] overflow-hidden">
                        <div className="h-8 bg-[#0a0a0d] border-b border-white/[0.04] flex items-center px-4 gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#d4656b]/60" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#e69a00]/60" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#2d9e8a]/60" />
                            <span className="ml-3 text-[10px] text-[#5c5c66] uppercase tracking-wider">Eclipse Dashboard</span>
                        </div>
                        <div className="p-8 flex items-center justify-center">
                            <div className="text-center text-[#5c5c66]">
                                <Database className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p className="text-sm">Dashboard Preview</p>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* Features */}
            <section id="features" className="py-20 px-6 max-w-5xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                    className="text-center mb-14"
                >
                    <h2 className="text-3xl font-bold mb-3">Tout ce dont vous avez besoin</h2>
                    <p className="text-[#7a7671] max-w-md mx-auto">Un toolkit complet pour aller plus loin avec Discord.</p>
                </motion.div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                        { icon: Shield, title: 'Furtif', desc: 'Réponses éphémères, mode invisible, aucune trace.', color: '#e69a00' },
                        { icon: Eye, title: 'Espionnage', desc: 'Surveillez les membres, recevez des alertes en temps réel.', color: '#8b9dc3' },
                        { icon: Users, title: 'Modération', desc: 'Kick, ban, lock — toutes les commandes à portée de main.', color: '#8b9dc3' },
                        { icon: Zap, title: 'Anti-Raid', desc: 'Hackban préventif, détection de raid automatique.', color: '#d4656b' },
                        { icon: Ban, title: 'Censure', desc: 'Reactroll, deletesend, autoreply — le contrôle total.', color: '#e69a00' },
                        { icon: Database, title: 'Local-First', desc: 'Base SQLite locale, cache hors-ligne, backups JSON.', color: '#2d9e8a' },
                    ].map(({ icon: Icon, title, desc, color }, i) => (
                        <motion.div
                            key={title}
                            initial={{ opacity: 0, y: 16 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: i * 0.05 }}
                            className="p-5 rounded-xl bg-[#0c0c0f] border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                        >
                            <div className="w-9 h-9 rounded-lg bg-[#1e1e22] border border-white/[0.04] flex items-center justify-center mb-3">
                                <Icon className="w-4 h-4" style={{ color }} />
                            </div>
                            <h3 className="font-semibold text-sm mb-1">{title}</h3>
                            <p className="text-xs text-[#7a7671] leading-relaxed">{desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-white/[0.05] bg-[#0a0a0d] py-8 px-6">
                <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-[#e69a00]/20 flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-[#070709] border border-[#e69a00]/20" />
                        </div>
                        <span className="text-sm font-semibold">Eclipse</span>
                    </div>
                    <p className="text-xs text-[#5c5c66]">
                        &copy; 2026 Antigravity Labs
                    </p>
                </div>
            </footer>
        </main>
    );
}
