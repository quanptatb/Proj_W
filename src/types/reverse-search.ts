export interface ReverseSearchResultItem {
  id: string;
  url: string;
  thumbnailUrl?: string;
  pageUrl?: string;
  domain: string;
  title?: string;
  width: number;
  height: number;
  fileSizeBytes?: number;
  format?: string;
  resolutionLabel: string;
  isHigherRes: boolean;
  multiplier?: number; // e.g., 2.5 means 2.5x total pixels of original
  sourceEngine: 'bing' | 'google' | 'serpapi' | 'yandex' | 'multi';
}

export interface OriginalImageInfo {
  url: string;
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  format?: string;
  resolutionLabel?: string;
}

export interface ReverseSearchResponse {
  success: boolean;
  originalImage: OriginalImageInfo;
  results: ReverseSearchResultItem[];
  totalFound: number;
  higherResCount: number;
  error?: string;
  executionTimeMs?: number;
  enginesUsed?: string[];
}

export interface ReverseSearchOptions {
  imageUrl: string;
  currentWidth?: number;
  currentHeight?: number;
  apiKey?: string;
  provider?: 'auto' | 'bing' | 'google' | 'serpapi';
  maxResults?: number;
}
