'use client';

import React, { useRef, useState } from 'react';
import { UploadCloud, Image as ImageIcon, Sparkles } from 'lucide-react';
import { ExtractedImage } from '@/types';
import { formatBytes } from '@/lib/utils';

interface ImageDropzoneProps {
  onImageSelected: (image: ExtractedImage) => void;
}

export function ImageDropzone({ onImageSelected }: ImageDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn một tệp hình ảnh hợp lệ (JPG, PNG, WebP, v.v.)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const customImage: ExtractedImage = {
          id: `upload-${Date.now()}`,
          url: dataUrl,
          thumbnailUrl: dataUrl,
          source: 'upload',
          title: file.name,
          width: img.width,
          height: img.height,
          resolutionLabel: `${img.width} × ${img.height} (Tải lên từ thiết bị)`,
          qualityScore: 100,
          fileSizeBytes: file.size,
          format: file.type.split('/')[1] || 'png',
          isOriginalCandidate: true,
        };
        onImageSelected(customImage);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => fileInputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-6 sm:p-10 text-center transition-all cursor-pointer select-none ${
        isDragOver
          ? 'border-indigo-400 bg-indigo-950/30 scale-[1.01]'
          : 'border-slate-700/80 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-slate-900/60'
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
          }
        }}
      />
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
        <UploadCloud className="w-7 h-7" />
      </div>
      <h3 className="text-base sm:text-lg font-semibold text-slate-200 mb-1">
        Kéo thả hoặc nhấn để tải ảnh từ máy tính / điện thoại
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-4">
        Hỗ trợ ảnh bị mờ, vỡ nét, ảnh nén chụp màn hình để AI tự động tái tạo chi tiết và khử nhiễu.
      </p>
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        Hỗ trợ PNG, JPG, WebP, AVIF lên đến 50MB
      </div>
    </div>
  );
}
