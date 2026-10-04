import React from 'react';
import { Sparkles, Image as ImageIcon, Wand2, DownloadCloud, Layers } from 'lucide-react';

export function Header() {
  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                UltraPic HD
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Hybrid AI
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Trích xuất ảnh gốc chất lượng tối đa & Phục hồi độ nét
            </p>
          </div>
        </div>

        {/* Supported Sources Badges */}
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/40 border border-red-800/40 text-[11px] font-medium text-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Pinterest Originals
          </div>
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/40 border border-blue-800/40 text-[11px] font-medium text-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            Facebook High-Res
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 border border-emerald-800/40 text-[11px] font-medium text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Generic Web
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-950/40 border border-purple-800/40 text-[11px] font-medium text-purple-300">
            <Wand2 className="w-3 h-3 text-purple-400" />
            AI Upscaler 4K
          </div>
        </div>
      </div>
    </header>
  );
}
