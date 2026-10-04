'use client';

import React from 'react';
import { History, Trash2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { HistoryItem } from '@/types';

interface HistoryPanelProps {
  items: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onClear: () => void;
}

export function HistoryPanel({ items, onSelect, onClear }: HistoryPanelProps) {
  if (items.length === 0) return null;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <History className="w-4 h-4 text-indigo-400" />
          <span>Lịch sử trích xuất gần đây ({items.length})</span>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-500 hover:text-red-400 flex items-center gap-1 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Xóa</span>
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelect(item)}
            className="flex-shrink-0 w-48 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition-all hover:scale-[1.02] flex items-center gap-3 group"
          >
            <div className="w-12 h-12 rounded-lg bg-slate-900 overflow-hidden flex-shrink-0">
              <img
                src={item.thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            </div>
            <div className="overflow-hidden">
              <div className="text-xs font-semibold text-slate-200 truncate group-hover:text-indigo-300">
                {item.title || 'Đã bóc tách'}
              </div>
              <div className="text-[10px] text-slate-400">
                {item.imageCount} ảnh • <span className="uppercase">{item.source}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
