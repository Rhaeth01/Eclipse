'use client';

import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, Minus, Square } from 'lucide-react';
import Image from 'next/image';

export function TitleBar() {
    const [appWindow, setAppWindow] = useState<any>(null);

    useEffect(() => {
        // Ne charger Tauri API que côté client et UNIQUEMENT si on est dans l'environnement Tauri
        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
            setAppWindow(getCurrentWindow());
        }
    }, []);

    return (
        <div
            data-tauri-drag-region
            className="h-8 select-none flex justify-between items-center bg-[#111214] border-b border-white/5 sticky top-0 z-50 transition-colors"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties} // Support mac/windows drag if needed
        >
            <div
                data-tauri-drag-region
                className="flex items-center gap-2 pl-3 h-full cursor-default w-full"
            >
                <div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                    <Image src="/icon.png" alt="Eclipse" width={16} height={16} />
                </div>
                <span data-tauri-drag-region className="text-xs font-medium text-white/50 tracking-wide uppercase mt-[1px]">Eclipse</span>
            </div>

            <div className="flex h-full items-center pr-3 gap-2">
                <button
                    className="flex justify-center items-center w-8 h-5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer text-white/60 hover:text-white"
                    onClick={() => appWindow?.minimize()}
                >
                    <Minus className="w-3 h-3" />
                </button>
                <button
                    className="flex justify-center items-center w-8 h-5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors cursor-pointer text-white/60 hover:text-white"
                    onClick={() => appWindow?.toggleMaximize()}
                >
                    <Square className="w-2.5 h-2.5" />
                </button>
                <button
                    className="flex justify-center items-center w-8 h-5 rounded-full bg-white/5 border border-white/10 hover:bg-red-500 hover:border-red-500 hover:shadow-[0_0_8px_rgba(239,68,68,0.5)] transition-colors cursor-pointer text-white/60 hover:text-white"
                    onClick={() => appWindow?.close()}
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
