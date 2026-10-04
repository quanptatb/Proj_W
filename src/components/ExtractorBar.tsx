'use client';

import React, { useState } from 'react';
import { Search, Link as LinkIcon, Sparkles, UploadCloud, Globe, Compass } from 'lucide-react';
import { detectSource } from '@/lib/utils';
import { SourceType } from '@/types';

interface ExtractorBarProps {
  onExtract: (url: string) => void;
  isLoading: boolean;
  activeTab: 'url' | 'upload';
  setActiveTab: (tab: 'url' | 'upload') => void;
}

export function ExtractorBar({
  onExtract,
  isLoading,
  activeTab,
  setActiveTab,
}: ExtractorBarProps) {
  const [url, setUrl] = useState('');
  const detectedSource = url.trim() ? detectSource(url) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onExtract(url.trim());
    }
  };

  const handlePasteSample = (sampleUrl: string) => {
    setUrl(sampleUrl);
    setActiveTab('url');
    onExtract(sampleUrl);
  };

  const getSourceBadge = (source: SourceType | null) => {
    if (!source) return null;
    if (source === 'pinterest') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-950/60 text-red-300 border border-red-800/60 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Pinterest detected
        </span>
      );
    }
    if (source === 'facebook') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/60 text-blue-300 border border-blue-800/60 text-xs font-medium">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          Facebook detected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 text-xs font-medium">
        <Globe className="w-3 h-3 text-emerald-400" />
        Generic Web Scraper
      </span>
    );
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Tab Switcher */}
      <div className="flex items-center justify-center gap-2 p-1 bg-slate-900/80 border border-slate-800/80 rounded-2xl w-fit mx-auto backdrop-blur-md">
        <button
          type="button"
          onClick={() => setActiveTab('url')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'url'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          Dán Link Bóc Tách (URL)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('upload')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
            activeTab === 'upload'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <UploadCloud className="w-4 h-4" />
          Tải Ảnh Lên Làm Nét (Upload)
        </button>
      </div>

      {activeTab === 'url' && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-3xl blur opacity-30 group-hover:opacity-60 transition duration-500" />
            <div className="relative flex items-center bg-slate-950 border border-slate-800 rounded-2xl p-2 shadow-2xl focus-within:border-indigo-500/80">
              <div className="pl-3 pr-2 text-slate-500">
                <Search className="w-5 h-5 text-indigo-400" />
              </div>

              <input
                type="text"
                placeholder="Dán link Pinterest, Facebook, hoặc web bất kỳ (ví dụ: https://pinterest.com/pin/...)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full bg-transparent text-sm sm:text-base text-slate-100 placeholder-slate-500 focus:outline-none px-2 py-2"
              />

              {detectedSource && (
                <div className="hidden sm:block mr-2">
                  {getSourceBadge(detectedSource)}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-xs sm:text-sm shadow-xl shadow-indigo-600/25 transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Đang bóc tách...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Lấy Ảnh Gốc</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick sample buttons for instant testing */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-slate-400">
            <span className="flex items-center gap-1 text-slate-500">
              <Compass className="w-3.5 h-3.5" />
              Link thử nhanh:
            </span>
            <button
              type="button"
              onClick={() =>
                handlePasteSample(
                  'https://i.pinimg.com/736x/2c/82/1f/2c821f579ff9a17cefe2620cbb76ec85.jpg'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-red-500/50 hover:text-red-300 transition-colors"
            >
              📌 Pinterest CDN Upgrade
            </button>
            <button
              type="button"
              onClick={() =>
                handlePasteSample(
                  'https://www.pinterest.com/pin/123456789/'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-red-500/50 hover:text-red-300 transition-colors"
            >
              📌 Pinterest Pin Post
            </button>
            <button
              type="button"
              onClick={() =>
                handlePasteSample(
                  'https://unsplash.com/photos/a-view-of-a-mountain-range-at-sunset-1526778548025-fa2f459cd5c1'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300 transition-colors"
            >
              🌐 Web Gallery (Srcset/HD)
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
