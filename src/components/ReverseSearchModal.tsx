'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Download,
  ExternalLink,
  Copy,
  Check,
  Wand2,
  Sparkles,
  RefreshCw,
  Globe,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Key,
  ShieldCheck,
  Layers,
  ArrowUpRight,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { ExtractedImage, ReverseSearchResultItem, ReverseSearchResponse } from '@/types';
import { formatBytes, formatDimensions, getProxiedDownloadUrl, getProxiedImageUrl, sanitizeFilename } from '@/lib/utils';

interface ReverseSearchModalProps {
  image: ExtractedImage | null;
  onClose: () => void;
  onSelectForEnhance: (image: ExtractedImage) => void;
}

export function ReverseSearchModal({ image, onClose, onSelectForEnhance }: ReverseSearchModalProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [searchResponse, setSearchResponse] = useState<ReverseSearchResponse | null>(null);
  const [filterHigherOnly, setFilterHigherOnly] = useState(true);
  const [sortBy, setSortBy] = useState<'resolution' | 'size'>('resolution');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiProvider, setApiProvider] = useState<'auto' | 'bing' | 'serpapi'>('auto');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Trigger search when modal opens
  useEffect(() => {
    if (!image) {
      setSearchResponse(null);
      setErrorMessage(null);
      return;
    }

    startReverseSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const startReverseSearch = async () => {
    if (!image) return;
    setIsSearching(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/reverse-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: image.url,
          currentWidth: image.width,
          currentHeight: image.height,
          apiKey: apiKey.trim() || undefined,
          provider: apiProvider,
        }),
      });

      const data: ReverseSearchResponse = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Không tìm thấy thông tin ảnh tương đồng');
      }

      setSearchResponse(data);
    } catch (err: any) {
      setErrorMessage(err.message || 'Lỗi kết nối khi quét mạng tìm ảnh độ phân giải cao.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      alert('Đã copy: ' + url);
    }
  };

  const handleSelectCandidate = (item: ReverseSearchResultItem) => {
    const upgradedImage: ExtractedImage = {
      id: `rev-${item.id}`,
      url: item.url,
      thumbnailUrl: item.thumbnailUrl || item.url,
      source: 'generic',
      title: item.title || `${item.domain} (${item.resolutionLabel})`,
      width: item.width,
      height: item.height,
      resolutionLabel: item.resolutionLabel,
      qualityScore: Math.min(100, Math.floor((item.width * item.height) / 10000)),
      fileSizeBytes: item.fileSizeBytes,
      format: item.format,
      isOriginalCandidate: true,
    };
    onSelectForEnhance(upgradedImage);
    onClose();
  };

  if (!image) return null;

  const currentArea = (image.width || 0) * (image.height || 0);

  // Filter and sort items
  let displayItems = (searchResponse?.results || []).filter((item) => {
    if (filterHigherOnly) {
      return item.isHigherRes;
    }
    return true;
  });

  if (sortBy === 'resolution') {
    displayItems.sort((a, b) => b.width * b.height - a.width * a.height);
  } else {
    displayItems.sort((a, b) => (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0));
  }

  // Find best candidate
  const bestCandidate = searchResponse?.results?.find((r) => r.isHigherRes);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-6xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Tìm Bản Phân Giải Cao Hơn Trên Web (Reverse Image Search)
                <span className="text-[11px] font-normal px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Fast Header Probing
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Tự động quét đa nguồn (Google Lens, Bing Visual) và bóc tách header để tìm bản master nét nhất không bị nén.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Comparison Hero Bar (Current Image vs Best Web Master) */}
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            {/* Current Image */}
            <div className="md:col-span-5 flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-slate-800 flex items-center justify-center">
                <img
                  src={getProxiedImageUrl(image.thumbnailUrl || image.url, image.fallbackUrl)}
                  alt="Current"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-0.5">
                  Ảnh hiện tại của bạn
                </span>
                <p className="text-sm font-semibold text-white truncate">{image.title || 'Ảnh gốc'}</p>
                <div className="flex items-center gap-2 text-xs text-slate-300 mt-0.5">
                  <span className="font-mono">{formatDimensions(image.width, image.height)}</span>
                  {image.fileSizeBytes && (
                    <>
                      <span>•</span>
                      <span>{formatBytes(image.fileSizeBytes)}</span>
                    </>
                  )}
                  <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-400">
                    {image.resolutionLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Middle Badge / Indicator */}
            <div className="md:col-span-2 flex flex-col items-center justify-center text-center">
              {bestCandidate ? (
                <div className="inline-flex flex-col items-center">
                  <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1 shadow-md shadow-emerald-500/10">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    <span>+{Math.round(((bestCandidate.multiplier || 1) - 1) * 100)}% nét hơn</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1">Đã tìm thấy bản HD!</span>
                </div>
              ) : isSearching ? (
                <div className="flex flex-col items-center">
                  <RefreshCw className="w-5 h-5 text-indigo-400 animate-spin mb-1" />
                  <span className="text-[11px] text-indigo-300">Đang quét mạng...</span>
                </div>
              ) : (
                <span className="text-xs text-slate-500">So sánh độ nét</span>
              )}
            </div>

            {/* Best Found Image on Web */}
            <div className="md:col-span-5">
              {bestCandidate ? (
                <div className="flex items-center justify-between gap-3 bg-gradient-to-r from-emerald-950/30 to-slate-900 p-3 rounded-2xl border border-emerald-500/30">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-950 flex-shrink-0 border border-emerald-500/40 flex items-center justify-center">
                      <img
                        src={getProxiedImageUrl(bestCandidate.thumbnailUrl || bestCandidate.url)}
                        alt="Best found"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1 mb-0.5">
                        <Sparkles className="w-3 h-3" />
                        Bản nét nhất tìm thấy
                      </span>
                      <p className="text-sm font-semibold text-white truncate">
                        {bestCandidate.domain}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-emerald-300 font-mono mt-0.5">
                        <span>{bestCandidate.width} × {bestCandidate.height}</span>
                        {bestCandidate.fileSizeBytes && (
                          <>
                            <span>•</span>
                            <span>{formatBytes(bestCandidate.fileSizeBytes)}</span>
                          </>
                        )}
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/20 text-emerald-200">
                          {bestCandidate.resolutionLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSelectCandidate(bestCandidate)}
                    className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-1.5"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Dùng Ngay</span>
                  </button>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-slate-900/40 border border-slate-800 text-center text-xs text-slate-400">
                  {isSearching
                    ? 'Đang đo đạc kích thước ảnh bằng Fast Header Probing...'
                    : 'Chưa tìm thấy bản nét hơn trên các trang web khác'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setFilterHigherOnly(!filterHigherOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                filterHigherOnly
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Chỉ hiện bản nét hơn ({searchResponse?.higherResCount || 0})</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
              <span className="text-slate-400 text-[11px]">Sắp xếp:</span>
              <button
                type="button"
                onClick={() => setSortBy('resolution')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  sortBy === 'resolution'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Độ phân giải
              </button>
              <button
                type="button"
                onClick={() => setSortBy('size')}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  sortBy === 'size'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Dung lượng
              </button>
            </div>

            <button
              onClick={startReverseSearch}
              disabled={isSearching}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSearching ? 'animate-spin' : ''}`} />
              <span>Quét lại</span>
            </button>
          </div>

          {/* Expandable API Settings */}
          <div>
            <button
              onClick={() => setShowApiSettings(!showApiSettings)}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-300 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Tùy chọn API Key (Google Lens / Bing)</span>
              {showApiSettings ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible API Key Drawer */}
        {showApiSettings && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Công cụ Reverse Search</label>
              <select
                value={apiProvider}
                onChange={(e) => setApiProvider(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              >
                <option value="auto">Tự động (Miễn phí đa nguồn: Bing & Google)</option>
                <option value="serpapi">Google Lens qua SerpApi</option>
                <option value="bing">Bing Visual Search API</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                API Key (Không bắt buộc, để trống để dùng tìm kiếm miễn phí)
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="Nhập SerpApi key hoặc Azure Bing key nếu có..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={startReverseSearch}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs"
                >
                  Áp dụng
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 animate-ping" />
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                  <RefreshCw className="w-6 h-6 animate-spin" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Đang tìm kiếm ảnh phân giải cao trên Web</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Hệ thống đang truy vấn Google Lens & Bing Visual Search và đọc nhanh header ảnh (Range probing) để xác minh độ nét thực tế...
                </p>
              </div>
            </div>
          ) : errorMessage ? (
            <div className="p-6 rounded-2xl bg-red-950/20 border border-red-800/40 text-center max-w-lg mx-auto space-y-3">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto" />
              <p className="text-sm font-semibold text-red-200">{errorMessage}</p>
              <button
                type="button"
                onClick={startReverseSearch}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Thử lại
              </button>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-400">
                <ImageIcon className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">
                  {filterHigherOnly
                    ? 'Không tìm thấy bản nét hơn trên web'
                    : 'Không tìm thấy kết quả tương đồng'}
                </h4>
                <p className="text-xs text-slate-400 mt-1">
                  {filterHigherOnly
                    ? 'Ảnh hiện tại có thể đã là bản master nét nhất trên mạng. Bạn có thể đưa vào Studio AI để nâng cấp độ nét lên 2K / 4K.'
                    : 'Thử kiểm tra lại ảnh hoặc nhập API key để mở rộng phạm vi tìm kiếm.'}
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                {filterHigherOnly && (searchResponse?.results?.length || 0) > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterHigherOnly(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Xem tất cả ({searchResponse?.results?.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onSelectForEnhance(image);
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20"
                >
                  <Wand2 className="w-3.5 h-3.5 inline mr-1" />
                  Làm Nét Bằng AI Studio
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {displayItems.map((item) => {
                const ext = item.format
                  ? item.format.toLowerCase() === 'jpeg'
                    ? 'jpg'
                    : item.format.toLowerCase()
                  : 'jpg';
                const filename = `${sanitizeFilename(item.title || item.domain)}_${item.width}x${item.height}.${ext}`;
                const downloadUrl = getProxiedDownloadUrl(item.url, filename);
                const isCopied = copiedId === item.id;

                return (
                  <div
                    key={item.id}
                    className={`group bg-slate-900/70 border rounded-2xl overflow-hidden flex flex-col transition-all hover:shadow-xl ${
                      item.isHigherRes
                        ? 'border-emerald-500/40 hover:border-emerald-500/80 hover:shadow-emerald-500/10'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {/* Thumbnail view */}
                    <div className="relative aspect-[4/3] bg-slate-950 flex items-center justify-center overflow-hidden">
                      <img
                        src={getProxiedImageUrl(item.thumbnailUrl || item.url)}
                        alt={item.title || item.domain}
                        loading="lazy"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                      />

                      {/* Top Badges */}
                      <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full backdrop-blur-md border ${
                            item.isHigherRes
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                              : 'bg-slate-900/80 text-slate-300 border-slate-700'
                          }`}
                        >
                          {item.resolutionLabel}
                        </span>

                        {item.multiplier && item.multiplier > 1 && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            +{Math.round((item.multiplier - 1) * 100)}% Nét Hơn
                          </span>
                        )}
                      </div>

                      {/* Source Engine Badge */}
                      <span className="absolute top-2 right-2 text-[9px] font-semibold px-2 py-0.5 rounded-full bg-black/70 text-slate-300 border border-white/10 uppercase">
                        {item.sourceEngine}
                      </span>
                    </div>

                    {/* Metadata & Actions */}
                    <div className="p-4 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-400 font-semibold mb-1 truncate">
                          <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{item.domain}</span>
                        </div>

                        <p
                          className="text-xs text-slate-200 line-clamp-1 mb-2 font-medium"
                          title={item.title || item.domain}
                        >
                          {item.title || item.domain}
                        </p>

                        <div className="flex items-center gap-2.5 text-xs text-slate-400 mb-3 font-mono">
                          <span className="text-white font-semibold">
                            {item.width} × {item.height}
                          </span>
                          {item.fileSizeBytes && (
                            <>
                              <span>•</span>
                              <span>{formatBytes(item.fileSizeBytes)}</span>
                            </>
                          )}
                          {item.format && (
                            <span className="uppercase text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400">
                              {item.format}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2 pt-2 border-t border-slate-800">
                        {/* Switch to AI Studio */}
                        <button
                          onClick={() => handleSelectCandidate(item)}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all active:scale-95"
                        >
                          <Wand2 className="w-3.5 h-3.5" />
                          <span>Chuyển sang AI Studio</span>
                        </button>

                        <div className="grid grid-cols-2 gap-2">
                          <a
                            href={downloadUrl}
                            download={filename}
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all text-center"
                          >
                            <Download className="w-3 h-3" />
                            <span>Tải Về HD</span>
                          </a>

                          <a
                            href={item.pageUrl || item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all text-center"
                          >
                            <ArrowUpRight className="w-3 h-3" />
                            <span>Mở Nguồn</span>
                          </a>
                        </div>

                        {/* Copy URL */}
                        <button
                          onClick={() => handleCopy(item.url, item.id)}
                          className="w-full flex items-center justify-center gap-1 py-1 text-[11px] text-slate-400 hover:text-indigo-300 transition-colors"
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Đã sao chép URL!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Sao chép liên kết ảnh</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
