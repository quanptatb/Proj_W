export type SourceType = 'pinterest' | 'facebook' | 'generic' | 'upload';

export interface ExtractedImage {
  id: string;
  url: string;
  thumbnailUrl: string;
  source: SourceType;
  title?: string;
  width?: number;
  height?: number;
  resolutionLabel: string; // e.g. "Original 4K", "1080p HD", "High Res"
  qualityScore: number;    // Higher is better (used for sorting)
  fileSizeBytes?: number;
  format?: string;        // 'jpg', 'png', 'webp'
  isOriginalCandidate?: boolean;
  fallbackUrl?: string;
}

export interface ExtractionResult {
  success: boolean;
  source: SourceType;
  pageTitle?: string;
  pageUrl?: string;
  images: ExtractedImage[];
  error?: string;
  executionTimeMs?: number;
}

export interface EnhancementOptions {
  engine: 'client' | 'cloud';
  scale: 1 | 2 | 4;
  sharpness: number;     // 0 - 100
  denoise: number;       // 0 - 100
  contrast: number;      // 0 - 100
  brightness: number;    // -50 - 50
  clarity: number;       // 0 - 100
  cloudProvider?: 'replicate' | 'huggingface';
  cloudApiKey?: string;
  faceEnhance?: boolean;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  source: SourceType;
  url?: string;
  thumbnailUrl: string;
  imageCount: number;
  title?: string;
}
