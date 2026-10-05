'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Download,
  Sliders,
  Layers,
  Cpu,
  Cloud,
  Check,
  RefreshCw,
  Key,
  HelpCircle,
  Eye,
  Search,
} from 'lucide-react';
import { ExtractedImage, EnhancementOptions } from '@/types';
import { enhanceImageOnCanvas } from '@/lib/enhancer/canvas-upscaler';
import { ComparisonSlider } from './ComparisonSlider';
import { getProxiedImageUrl, sanitizeFilename } from '@/lib/utils';

interface EnhancerModalProps {
  image: ExtractedImage | null;
  onClose: () => void;
  onReverseSearch?: (image: ExtractedImage) => void;
}

export function EnhancerModal({ image, onClose, onReverseSearch }: EnhancerModalProps) {
  const [options, setOptions] = useState<EnhancementOptions>({
    engine: 'client',
    scale: 2,
    sharpness: 50,
    denoise: 35,
    contrast: 15,
    brightness: 0,
    clarity: 40,
    cloudProvider: 'replicate',
    cloudApiKey: '',
    faceEnhance: true,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [enhancedResult, setEnhancedResult] = useState<{
    dataUrl: string;
    width: number;
    height: number;
    blob?: Blob;
  } | null>(null);
  const [originalLoadedImg, setOriginalLoadedImg] = useState<HTMLImageElement | null>(null);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load image element when modal opens with new image
  useEffect(() => {
    if (!image) {
      setEnhancedResult(null);
      setOriginalLoadedImg(null);
      setLoadError(null);
      return;
    }

    setLoadError(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const sourceUrl =
      image.source === 'upload'
        ? image.url
        : getProxiedImageUrl(image.url, image.fallbackUrl);

    img.src = sourceUrl;
    img.onload = () => {
      setOriginalLoadedImg(img);
      triggerEnhance(img, options);
    };
    img.onerror = () => {
      // If proxied fails, try raw
      const rawImg = new Image();
      rawImg.crossOrigin = 'anonymous';
      rawImg.src = image.url;
      rawImg.onload = () => {
        setOriginalLoadedImg(rawImg);
        triggerEnhance(rawImg, options);
      };
      rawImg.onerror = () => {
        setIsProcessing(false);
        setLoadError('Không thể tải tệp ảnh từ máy chủ CDN. Vui lòng tải ảnh từ thiết bị lên để xử lý AI.');
      };
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const getImagePayloadForCloud = (img: HTMLImageElement): string => {
    if (!image) return img.src;
    // If original URL is public http/https, send it
    if (image.url.startsWith('http://') || image.url.startsWith('https://')) {
      return image.url;
    }
    // If it's a data URI
    if (image.url.startsWith('data:')) {
      return image.url;
    }
    // Convert loaded img to canvas data URI
    try {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        return c.toDataURL('image/png');
      }
    } catch {
      // ignore
    }
    return image.url;
  };

  const triggerEnhance = async (
    img: HTMLImageElement,
    currentOpts: EnhancementOptions
  ) => {
    if (!img) return;
    setIsProcessing(true);
    setProgressMsg('Đang chuẩn bị xử lý ảnh...');

    try {
      if (currentOpts.engine === 'client') {
        const result = await enhanceImageOnCanvas(
          img,
          currentOpts,
          (_, stage) => {
            setProgressMsg(stage);
          }
        );
        setEnhancedResult({
          dataUrl: result.dataUrl,
          width: result.width,
          height: result.height,
          blob: result.blob,
        });
      } else {
        // Cloud AI processing
        setProgressMsg(
          `Đang gửi yêu cầu lên Cloud AI (${
            currentOpts.cloudProvider === 'huggingface' ? 'Hugging Face' : 'Replicate'
          })...`
        );
        const imagePayload = getImagePayloadForCloud(img);
        const res = await fetch('/api/upscale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: imagePayload,
            options: currentOpts,
          }),
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.error || 'Cloud AI failed');
        }

        setProgressMsg('Đang tải kết quả xử lý từ Cloud AI...');
        const cloudImg = new Image();
        cloudImg.crossOrigin = 'anonymous';
        cloudImg.src = data.outputUrl;

        await new Promise((resolve, reject) => {
          cloudImg.onload = resolve;
          cloudImg.onerror = () =>
            reject(new Error('Không thể tải hoặc hiển thị kết quả từ Cloud AI.'));
        });

        setEnhancedResult({
          dataUrl: data.outputUrl,
          width: cloudImg.width,
          height: cloudImg.height,
        });
      }
    } catch (err: any) {
      alert(`Lỗi xử lý: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgressMsg('');
    }
  };

  const handleApplyChanges = () => {
    if (originalLoadedImg) {
      triggerEnhance(originalLoadedImg, options);
    }
  };

  const handleDownload = () => {
    if (!enhancedResult) return;

    const name = sanitizeFilename(image?.title || 'upscaled_image');
    const filename = `${name}_${enhancedResult.width}x${enhancedResult.height}.${exportFormat}`;

    const triggerBlobDownload = (blob: Blob) => {
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
    };

    if (exportFormat === 'png' && enhancedResult.blob) {
      triggerBlobDownload(enhancedResult.blob);
      return;
    }

    // Convert to chosen format via canvas
    const tempImg = new Image();
    tempImg.crossOrigin = 'anonymous';
    tempImg.onload = () => {
      const c = document.createElement('canvas');
      c.width = enhancedResult.width;
      c.height = enhancedResult.height;
      const ctx = c.getContext('2d');
      if (ctx) {
        ctx.drawImage(tempImg, 0, 0);
        c.toBlob(
          (blob) => {
            if (blob) {
              triggerBlobDownload(blob);
            } else {
              const link = document.createElement('a');
              link.href = c.toDataURL(`image/${exportFormat}`, 0.95);
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          },
          `image/${exportFormat}`,
          0.95
        );
      }
    };
    tempImg.src = enhancedResult.dataUrl;
  };

  if (!image) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Studio AI Làm Nét & Khôi Phục Ảnh Gốc
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  {options.engine === 'client'
                    ? 'Client WebGL/Canvas Engine'
                    : `Cloud AI (${options.cloudProvider === 'huggingface' ? 'Hugging Face' : 'Replicate'})`}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Kéo thanh trượt để so sánh ảnh trước và sau khi làm nét phục hồi.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onReverseSearch && (
              <button
                type="button"
                onClick={() => onReverseSearch(image)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 border border-cyan-500/30 text-xs font-semibold transition-all active:scale-95"
                title="Tìm xem trên web có bản phân giải cao hơn của ảnh này không"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span className="hidden sm:inline">🔍 Tìm bản HD hơn trên Web</span>
                <span className="sm:hidden">Tìm HD Web</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Split View (Preview on left, Controls on right) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 p-6">
          {/* Left: Comparison View */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center">
            {enhancedResult && originalLoadedImg ? (
              <div className="w-full">
                <ComparisonSlider
                  beforeSrc={originalLoadedImg.src}
                  afterSrc={enhancedResult.dataUrl}
                  beforeLabel={`Trước: ${originalLoadedImg.naturalWidth || originalLoadedImg.width}×${originalLoadedImg.naturalHeight || originalLoadedImg.height}`}
                  afterLabel={`Sau AI: ${enhancedResult.width}×${enhancedResult.height} (${options.scale}x)`}
                />
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 px-2">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Dùng chuột hoặc ngón tay kéo thanh phân cách ở giữa</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">
                    Độ nét đã được tối ưu hóa
                  </span>
                </div>
              </div>
            ) : loadError ? (
              <div className="w-full aspect-video rounded-2xl bg-red-950/20 border border-red-800/40 flex flex-col items-center justify-center text-red-300 p-6 text-center space-y-3">
                <p className="text-sm font-semibold">{loadError}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <div className="w-full aspect-video rounded-2xl bg-slate-950 border border-slate-800 flex flex-col items-center justify-center text-slate-400 p-6">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-3" />
                <p className="text-sm font-medium text-slate-300">Đang tải và chuẩn bị ảnh...</p>
                {progressMsg && <p className="text-xs text-slate-400 mt-1">{progressMsg}</p>}
              </div>
            )}
          </div>

          {/* Right: Enhancement Controls */}
          <div className="lg:col-span-5 flex flex-col gap-5 bg-slate-950/50 p-5 rounded-2xl border border-slate-800/80">
            {onReverseSearch && (
              <button
                type="button"
                onClick={() => onReverseSearch(image)}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-cyan-600/10 hover:bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition-all shadow-sm active:scale-98"
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span>🔍 Tìm bản HD hơn trên Web (Google Lens / Bing)</span>
              </button>
            )}

            {/* Engine Tabs */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Bộ Xử Lý AI (Engine)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setOptions({ ...options, engine: 'client' })}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    options.engine === 'client'
                      ? 'bg-indigo-600/20 border-indigo-500 text-indigo-200 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  Cục bộ (Miễn phí 100%)
                </button>

                <button
                  type="button"
                  onClick={() => setOptions({ ...options, engine: 'cloud' })}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold border transition-all ${
                    options.engine === 'cloud'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Cloud className="w-4 h-4 text-purple-400" />
                  Cloud AI (Replicate / HF)
                </button>
              </div>
            </div>

            {/* Cloud Provider Config (only if engine === 'cloud') */}
            {options.engine === 'cloud' && (
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider block mb-1.5">
                    Nền tảng Cloud AI
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setOptions({ ...options, cloudProvider: 'replicate' })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        options.cloudProvider === 'replicate'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Replicate (Real-ESRGAN)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOptions({ ...options, cloudProvider: 'huggingface' })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                        options.cloudProvider === 'huggingface'
                          ? 'bg-purple-600 text-white border-purple-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Hugging Face (Miễn phí)
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    {options.cloudProvider === 'replicate'
                      ? 'Replicate API Token'
                      : 'Hugging Face Token (Miễn phí)'}
                  </span>
                  <a
                    href={
                      options.cloudProvider === 'replicate'
                        ? 'https://replicate.com/account/api-tokens'
                        : 'https://huggingface.co/settings/tokens'
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:underline"
                  >
                    Lấy Token {options.cloudProvider === 'huggingface' ? 'miễn phí ' : ''}↗
                  </a>
                </div>
                <input
                  type="password"
                  placeholder={options.cloudProvider === 'replicate' ? 'r8_...' : 'hf_...'}
                  value={options.cloudApiKey || ''}
                  onChange={(e) => setOptions({ ...options, cloudApiKey: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />

                {options.cloudProvider === 'replicate' && (
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={options.faceEnhance}
                      onChange={(e) => setOptions({ ...options, faceEnhance: e.target.checked })}
                      className="rounded bg-slate-900 border-slate-700 text-purple-600 focus:ring-0"
                    />
                    <span>Tự động phục hồi nét khuôn mặt (GFPGAN)</span>
                  </label>
                )}
              </div>
            )}

            {/* Scale Multiplier */}
            <div>
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block mb-2">
                Độ Phóng Đại (Upscale Factor)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { scale: 1, label: '1x (Giữ nguyên)' },
                  { scale: 2, label: '2x (2K HD)' },
                  { scale: 4, label: '4x (4K Ultra)' },
                ].map((item) => (
                  <button
                    key={item.scale}
                    type="button"
                    onClick={() => setOptions({ ...options, scale: item.scale as 1 | 2 | 4 })}
                    className={`py-2 px-2 text-center rounded-xl text-xs font-semibold border transition-all ${
                      options.scale === item.scale
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Precision Parameter Sliders (Client mode) */}
            {options.engine === 'client' && (
              <div className="space-y-3.5 bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                {/* Sharpness */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Độ sắc nét (Sharpness)</span>
                    <span className="text-indigo-400 font-mono">{options.sharpness}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={options.sharpness}
                    onChange={(e) => setOptions({ ...options, sharpness: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Denoise */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Khử vỡ hạt / Nén JPEG</span>
                    <span className="text-indigo-400 font-mono">{options.denoise}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={options.denoise}
                    onChange={(e) => setOptions({ ...options, denoise: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Clarity */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Độ trong & Chi tiết (Clarity)</span>
                    <span className="text-indigo-400 font-mono">{options.clarity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={options.clarity}
                    onChange={(e) => setOptions({ ...options, clarity: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>

                {/* Contrast */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-300 font-medium">Tương phản (Contrast)</span>
                    <span className="text-indigo-400 font-mono">{options.contrast}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={options.contrast}
                    onChange={(e) => setOptions({ ...options, contrast: Number(e.target.value) })}
                    className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Apply & Render Button */}
            <button
              onClick={handleApplyChanges}
              disabled={isProcessing}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-indigo-600/20 active:scale-98 disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{progressMsg || 'Đang xử lý...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Áp Dụng & Tái Tạo Chi Tiết</span>
                </>
              )}
            </button>

            {/* Export Format & Download */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Định dạng tải về:</span>
                <div className="flex items-center gap-1">
                  {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setExportFormat(fmt)}
                      className={`px-2 py-0.5 rounded text-[11px] uppercase font-bold border ${
                        exportFormat === fmt
                          ? 'bg-slate-700 text-white border-indigo-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleDownload}
                disabled={!enhancedResult || isProcessing}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-600/20 transition-all active:scale-95 disabled:opacity-40"
              >
                <Download className="w-4 h-4" />
                <span>
                  {enhancedResult
                    ? `Tải Về Ảnh Nét Căng (${enhancedResult.width}×${enhancedResult.height})`
                    : 'Đang chuẩn bị ảnh...'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
