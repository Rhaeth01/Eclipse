'use client';

import { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { X, Minus, Square } from 'lucide-react';
import Image from 'next/image';

export function TitleBar() {
    const [appWindow, setAppWindow] = useState<any>(null);

    useEffect(() => {
        if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
            setAppWindow(getCurrentWindow());
        }
    }, []);

    return (
        <div
            data-tauri-drag-region
            className="h-8 select-none flex justify-between items-center bg-[#0c0c0f] border-b border-white/[0.04] sticky top-0 z-50"
            style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        >
            <div data-tauri-drag-region className="flex items-center gap-2 pl-3 h-full cursor-default w-full">
                <Image
                    src="/icon.png"
                    alt="Eclipse"
                    width={16}
                    height={16}
                    className="w-4 h-4"
                />
                <span data-tauri-drag-region className="text-[11px] font-medium text-[#7a7671] tracking-wider uppercase mt-[1px]">
                    Eclipse
                </span>
            </div>

            <div className="flex h-full items-center pr-3 gap-1.5">
                <button
                    className="flex justify-center items-center w-7 h-5 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer text-[#5c5c66] hover:text-[#b9b5ae]"
                    onClick={() => appWindow?.minimize()}
                >
                    <Minus className="w-3 h-3" />
                </button>
                <button
                    className="flex justify-center items-center w-7 h-5 rounded-full hover:bg-white/[0.06] transition-colors cursor-pointer text-[#5c5c66] hover:text-[#b9b5ae]"
                    onClick={() => appWindow?.toggleMaximize()}
                >
                    <Square className="w-2.5 h-2.5" />
                </button>
                <button
                    className="flex justify-center items-center w-7 h-5 rounded-full hover:bg-[#d4656b]/30 transition-colors cursor-pointer text-[#5c5c66] hover:text-[#e8e6e3]"
                    onClick={() => appWindow?.close()}
                >
                    <X className="w-3 h-3" />
                </button>
            </div>
        </div>
    );
}
