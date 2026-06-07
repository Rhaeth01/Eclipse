"use client";

import { Download, Shield, Zap, Lock, Terminal, Github, ChevronRight, Activity, Users, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Website() {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return (
        <div className="min-h-screen bg-[#09090b] text-zinc-100 overflow-x-hidden selection:bg-[#5865F2]/30 pt-8">

            {/* Navbar MOCK (Tauri app hides it, so it's only visible on real browser view if we export it) 
          But since we use the Tauri titlebar globally, it's better to keep the site clean of native navbars */}

            {/* HERO SECTION */}
            <section className="relative pt-32 pb-20 md:pt-48 md:pb-32 px-6 flex flex-col items-center justify-center text-center">
                {/* Gradients */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#5865F2]/20 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute top-1/3 left-1/4 w-[400px] h-[400px] bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-1000">
                    <div className="flex items-center gap-3 mb-6 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-sm font-medium text-zinc-300">v0.1.0 Beta Released</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/50 mb-8">
                        Dominez Discord <br className="hidden md:block" /> dans l'Ombre.
                    </h1>

                    <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mb-12">
                        Eclipse est l'ultime client utilitaire furtif, propulsé par Rust et Tauri.
                        Il s'intègre silencieusement comme un "Selfbot" ultra-sécurisé, offrant des fonctionnalités que même Discord ignore.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                        <button className="flex items-center justify-center gap-2 bg-[#5865F2] hover:bg-[#4752C4] text-white px-8 py-4 rounded-xl font-bold transition-all hover:scale-105 shadow-xl shadow-[#5865F2]/25">
                            <Download className="w-5 h-5" />
                            Télécharger Eclipse
                        </button>
                        <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-4 rounded-xl font-bold transition-all">
                            <Terminal className="w-5 h-5" />
                            Documentation API
                        </button>
                    </div>
                    <p className="mt-4 text-xs text-zinc-500">Pour Windows 10/11 (64-bit). Aucune installation requise.</p>
                </div>
            </section>

            {/* DASHBOARD PREVIEW */}
            <section className="relative w-full max-w-6xl mx-auto px-6 py-12">
                <div className="relative rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-1000 delay-300">
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none z-10" />
                    <div className="h-8 bg-[#111214] border-b border-white/5 flex items-center px-4 gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                        <div className="ml-4 text-xs font-semibold text-zinc-500 tracking-widest uppercase">Eclipse Dashboard</div>
                    </div>
                    {/* Mockup Image - We can use a generic placeholder or dynamic block. */}
                    <div className="aspect-video bg-zinc-900 flex items-center justify-center relative">
                        <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/cubes.png')] opacity-[0.03]" />
                        <Activity className="w-24 h-24 text-zinc-800 animate-pulse" />
                    </div>
                </div>
            </section>

            {/* FEATURES GRID */}
            <section className="w-full max-w-7xl mx-auto px-6 py-32">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">L'Avantage Concurrentiel</h2>
                    <p className="text-zinc-400 max-w-2xl mx-auto">Conçu par des ingénieurs pour offrir le contrôle absolu sans jamais risquer l'intégrité de votre compte.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <FeatureCard
                        icon={<EyeOff className="w-6 h-6 text-[#5865F2]" />}
                        title="Totalement Furtif"
                        desc="S'interface sans application tierce Discord. Les requêtes API n'apparaissent nulle part dans les historiques serveurs."
                    />
                    <FeatureCard
                        icon={<Activity className="w-6 h-6 text-green-400" />}
                        title="Espionnage Serveur"
                        desc="Trackez les mouvements vocaux, suppressions de messages, et suppressions d'amis silencieusement en arrière-plan."
                    />
                    <FeatureCard
                        icon={<Zap className="w-6 h-6 text-yellow-400" />}
                        title="Modération & Trolls"
                        desc="Arsenal complet : Reactroll furtif, Purge invisible (ZWSP), usurpation de Webhooks, et Fake Nitro Cards."
                    />
                    <FeatureCard
                        icon={<Shield className="w-6 h-6 text-red-400" />}
                        title="Anti-Raid / HackBan"
                        desc="Bannissez des IDs n'étant même pas encore sur votre serveur. Action préventive absolue API."
                    />
                    <FeatureCard
                        icon={<Lock className="w-6 h-6 text-indigo-400" />}
                        title="Censure Absolue"
                        desc="Retirez l'ownership des messages à n'importe quel membre (Delete + Renvoi via Webhook mimic)."
                    />
                    <FeatureCard
                        icon={<Terminal className="w-6 h-6 text-teal-400" />}
                        title="Local-First (SQLite)"
                        desc="Pas de cloud. Le tracker historique génère une base de données en local gérée par Better-SQlite3."
                    />
                </div>
            </section>

            {/* FOOTER */}
            <footer className="border-t border-white/10 bg-black pt-16 pb-8">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                            <Image src="/icon.png" alt="Eclipse" width={20} height={20} />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-white">Eclipse <span className="text-zinc-500 font-normal">Project</span></span>
                    </div>
                    <p className="text-zinc-500 text-sm">© 2026 Antigravity Labs. Tous droits réservés.</p>
                    <div className="flex gap-4">
                        <Link href="#" className="text-zinc-500 hover:text-white transition-colors"><Github className="w-5 h-5" /></Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
    return (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors group">
            <div className="w-12 h-12 rounded-xl bg-white/[0.05] flex items-center justify-center mb-6 border border-white/5 group-hover:scale-110 transition-transform">
                {icon}
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-3">{title}</h3>
            <p className="text-zinc-400 leading-relaxed">{desc}</p>
        </div>
    );
}
