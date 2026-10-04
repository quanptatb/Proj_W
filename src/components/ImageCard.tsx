'use client';

import React, { useState } from 'react';
import { Download, Wand2, Copy, Check, ExternalLink, Sparkles, Image as ImageIcon } from 'lucide-react';
import { ExtractedImage } from '@/types';
import { formatBytes, formatDimensions, getProxiedDownloadUrl, getProxiedImageUrl, sanitizeFilename } from '@/lib/utils';

interface ImageCardProps {
  image: ExtractedImage;
  onEnhance: (image: ExtractedImage) => void;
}

export function ImageCard({ image, onEnhance }: ImageCardProps) {
  const [copied, setCopied] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const displaySrc = imgError
    ? image.url
    : image.source === 'upload'
    ? image.url
    : getProxiedImageUrl(image.thumbnailUrl || image.url, image.fallbackUrl);

  const handleImgError = () => {
    if (!imgError && image.source !== 'upload') {
      // First try fallback to direct URL
      setImgError(true);
    } else {
      // Both proxy and direct URL failed
      setImgFailed(true);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(image.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      alert('Đã copy link: ' + image.url);
    }
  };

  const filename = `${sanitizeFilename(image.title || 'image')}_${image.id}.jpg`;
  const downloadUrl =
    image.source === 'upload'
      ? image.url
      : getProxiedDownloadUrl(image.url, filename, image.fallbackUrl);

  return (
    <div className="group relative bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 hover:shadow-xl hover:shadow-indigo-500/10 transition-all flex flex-col">
      {/* Top Media Area */}
      <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
        {imgFailed ? (
          <div className="flex flex-col items-center justify-center p-4 text-center space-y-2">
            <ImageIcon className="w-8 h-8 text-slate-600" />
            <p className="text-xs text-slate-400">Không thể tải bản xem trước</p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setImgError(false);
                  setImgFailed(false);
                }}
                className="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Thử lại
              </button>
              <a
                href={image.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-[11px] rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 transition-colors"
              >
                Mở link gốc ↗
              </a>
            </div>
          </div>
        ) : (
          <img
            src={displaySrc}
            alt={image.title || 'Extracted HD'}
            loading="lazy"
            onError={handleImgError}
            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* Resolution & Quality Badge */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          <span
            className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full backdrop-blur-md border ${
              image.isOriginalCandidate
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/80 text-slate-200 border-slate-700'
            }`}
          >
            {image.isOriginalCandidate && '✨ '}
            {image.resolutionLabel}
          </span>
          {image.source && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-black/60 text-slate-300 border border-white/10 uppercase tracking-wider w-fit">
              {image.source}
            </span>
          )}
        </div>

        {/* Quick External Link */}
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          title="Mở link ảnh gốc trên CDN"
          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-slate-300 hover:text-white hover:bg-black/80 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Body Area */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <h4
            className="text-sm font-medium text-slate-200 truncate mb-1"
            title={image.title || 'Ảnh không có tiêu đề'}
          >
            {image.title || 'Ảnh không có tiêu đề'}
          </h4>
          <div className="flex items-center gap-3 text-xs text-slate-400 mb-3">
            <span>{formatDimensions(image.width, image.height)}</span>
            {image.fileSizeBytes && (
              <>
                <span>•</span>
                <span>{formatBytes(image.fileSizeBytes)}</span>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => onEnhance(image)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Làm Nét AI
          </button>

          <a
            href={downloadUrl}
            download={filename}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all active:scale-95 text-center"
          >
            <Download className="w-3.5 h-3.5" />
            Tải Về HD
          </a>
        </div>

        {/* Copy link button */}
        <button
          onClick={handleCopy}
          className="mt-2 w-full flex items-center justify-center gap-1.5 py-1 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Đã sao chép link gốc!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Sao chép URL gốc</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
