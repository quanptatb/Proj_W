'use client';

import React, { useState } from 'react';
import { DownloadCloud, Sparkles, Filter, Clock, CheckCircle2, AlertCircle, Upload } from 'lucide-react';
import { ExtractedImage, ExtractionResult } from '@/types';
import { ImageCard } from './ImageCard';
import { getProxiedDownloadUrl, sanitizeFilename } from '@/lib/utils';

interface ImageGalleryProps {
  result: ExtractionResult | null;
  onEnhance: (image: ExtractedImage) => void;
  onSwitchToUpload?: () => void;
}

export function ImageGallery({ result, onEnhance, onSwitchToUpload }: ImageGalleryProps) {
  const [filterOnlyOriginals, setFilterOnlyOriginals] = useState(false);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);

  if (!result) return null;

  if (!result.success) {
    return (
      <div className="w-full max-w-4xl mx-auto p-6 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-3">
        <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
        <h4 className="text-base font-bold text-red-200">Không thể bóc tách ảnh</h4>
        <p className="text-xs sm:text-sm text-red-300 max-w-lg mx-auto">
          {result.error || 'Vui lòng kiểm tra lại đường link hoặc thử tải ảnh trực tiếp lên.'}
        </p>
        {onSwitchToUpload && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onSwitchToUpload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Chuyển sang tab &quot;Tải Ảnh Lên&quot; (AI Enhancer Studio)</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  const displayedImages = filterOnlyOriginals
    ? result.images.filter((img) => img.isOriginalCandidate)
    : result.images;

  const handleBatchDownload = async () => {
    setIsBatchDownloading(true);
    for (let i = 0; i < displayedImages.length; i++) {
      const img = displayedImages[i];
      const link = document.createElement('a');
      const filename = `${sanitizeFilename(result.pageTitle || 'batch')}_${i + 1}.jpg`;
      link.href =
        img.source === 'upload'
          ? img.url
          : getProxiedDownloadUrl(img.url, filename, img.fallbackUrl);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      // Brief pause between downloads to avoid browser throttling
      await new Promise((r) => setTimeout(r, 600));
    }
    setIsBatchDownloading(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Result Info Header */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-white truncate max-w-xl">
              {result.pageTitle || 'Danh sách ảnh đã bóc tách'}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span className="uppercase font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              Nguồn: {result.source}
            </span>
            <span>
              Tìm thấy <strong className="text-white">{result.images.length}</strong> ảnh
            </span>
            {result.executionTimeMs && (
              <span className="flex items-center gap-1 text-slate-400">
                <Clock className="w-3 h-3" />
                {result.executionTimeMs}ms
              </span>
            )}
          </div>
        </div>

        {/* Filter & Batch Actions */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            onClick={() => setFilterOnlyOriginals(!filterOnlyOriginals)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
              filterOnlyOriginals
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Chỉ xem ảnh gốc (HD)</span>
          </button>

          <button
            onClick={handleBatchDownload}
            disabled={isBatchDownloading || displayedImages.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50"
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>
              {isBatchDownloading
                ? 'Đang tải xuống tất cả...'
                : `Tải hết (${displayedImages.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* Grid of Image Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {displayedImages.map((img) => (
          <ImageCard key={img.id} image={img} onEnhance={onEnhance} />
        ))}
      </div>
    </div>
  );
}
