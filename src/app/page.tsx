'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { ExtractorBar } from '@/components/ExtractorBar';
import { ImageDropzone } from '@/components/ImageDropzone';
import { ImageGallery } from '@/components/ImageGallery';
import { EnhancerModal } from '@/components/EnhancerModal';
import { ReverseSearchModal } from '@/components/ReverseSearchModal';
import { HistoryPanel } from '@/components/HistoryPanel';
import { QualityTips } from '@/components/QualityTips';
import { ExtractedImage, ExtractionResult, HistoryItem } from '@/types';
import { Sparkles, Shield, Cpu, Zap } from 'lucide-react';

const HISTORY_STORAGE_KEY = 'ultrapic_extraction_history';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'url' | 'upload'>('url');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [enhancingImage, setEnhancingImage] = useState<ExtractedImage | null>(null);
  const [reverseSearchImage, setReverseSearchImage] = useState<ExtractedImage | null>(null);
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  // Load history from localStorage on client mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (stored) {
        setHistoryItems(JSON.parse(stored));
      }
    } catch {
      // Ignore
    }
  }, []);

  const saveToHistory = (res: ExtractionResult, url?: string) => {
    if (!res.success || res.images.length === 0) return;
    try {
      const firstImg = res.images[0];
      const newItem: HistoryItem = {
        id: `hist-${Date.now()}`,
        timestamp: Date.now(),
        source: res.source,
        url: url,
        thumbnailUrl: firstImg.thumbnailUrl || firstImg.url,
        imageCount: res.images.length,
        title: res.pageTitle || 'Đã trích xuất',
      };

      const updated = [newItem, ...historyItems.filter((i) => i.url !== url)].slice(0, 10);
      setHistoryItems(updated);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  const handleExtract = async (url: string) => {
    setIsLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      const data: ExtractionResult = await res.json();
      setResult(data);

      if (data.success) {
        saveToHistory(data, url);
      }
    } catch (err: any) {
      setResult({
        success: false,
        source: 'generic',
        pageUrl: url,
        images: [],
        error: err.message || 'Lỗi kết nối khi trích xuất ảnh.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadImage = (image: ExtractedImage) => {
    const singleResult: ExtractionResult = {
      success: true,
      source: 'upload',
      pageTitle: image.title || 'Ảnh tải lên từ thiết bị',
      images: [image],
      executionTimeMs: 10,
    };
    setResult(singleResult);
    // Automatically open AI Studio for the uploaded image!
    setEnhancingImage(image);
  };

  const handleSelectHistory = (item: HistoryItem) => {
    if (item.url) {
      setActiveTab('url');
      handleExtract(item.url);
    }
  };

  const handleClearHistory = () => {
    setHistoryItems([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070b14] text-slate-100">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-4 max-w-3xl mx-auto pt-2 sm:pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 text-xs text-indigo-300 font-medium shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Tự động bóc tách link gốc CDN & Phục hồi ảnh vỡ hạt bằng AI</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Tải Ảnh Gốc Siêu Nét <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Không Lo Mờ & Vỡ Hạt
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Dán link bài viết từ <strong>Pinterest</strong>, <strong>Facebook</strong>, hoặc bất kỳ trang web nào để lấy file gốc phân giải tối đa. Hỗ trợ tải ảnh từ máy lên để AI tái tạo chi tiết và khử nhiễu nén.
          </p>
        </div>

        {/* Input Bar or Dropzone */}
        <div className="space-y-6">
          <ExtractorBar
            onExtract={handleExtract}
            isLoading={isLoading}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {activeTab === 'upload' && (
            <div className="max-w-4xl mx-auto">
              <ImageDropzone onImageSelected={handleUploadImage} />
            </div>
          )}
        </div>

        {/* Extraction Results */}
        {result && (
          <div className="pt-4">
            <ImageGallery
              result={result}
              onEnhance={(img) => setEnhancingImage(img)}
              onReverseSearch={(img) => setReverseSearchImage(img)}
              onSwitchToUpload={() => setActiveTab('upload')}
            />
          </div>
        )}

        {/* Recent History */}
        <HistoryPanel
          items={historyItems}
          onSelect={handleSelectHistory}
          onClear={handleClearHistory}
        />

        {/* Informative Tips & Explanations */}
        <QualityTips />
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 py-8 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} UltraPic HD. Giải pháp lấy ảnh gốc & AI Upscaler.</p>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Client-side WebGL / Canvas</span>
            <span>•</span>
            <span>Zero Data Stored</span>
            <span>•</span>
            <span>High Fidelity Upscaling</span>
          </div>
        </div>
      </footer>

      {/* AI Enhancer Modal */}
      {enhancingImage && (
        <EnhancerModal
          image={enhancingImage}
          onClose={() => setEnhancingImage(null)}
          onReverseSearch={(img) => setReverseSearchImage(img)}
        />
      )}

      {/* Reverse Search Modal */}
      {reverseSearchImage && (
        <ReverseSearchModal
          image={reverseSearchImage}
          onClose={() => setReverseSearchImage(null)}
          onSelectForEnhance={(img) => {
            setReverseSearchImage(null);
            setEnhancingImage(img);
          }}
        />
      )}
    </div>
  );
}
