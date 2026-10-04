import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { SourceType } from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes?: number, decimals = 1): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatDimensions(w?: number, h?: number): string {
  if (w && h) return `${w} × ${h}`;
  if (w) return `${w}px width`;
  if (h) return `${h}px height`;
  return 'HD / Original';
}

export function sanitizeFilename(name: string, fallback = 'image'): string {
  if (!name) return fallback;
  const sanitized = name
    .replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1EA0-\u1EF9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .trim();
  return sanitized.length > 0 ? sanitized.substring(0, 80) : fallback;
}

export function detectSource(url: string): SourceType {
  const lower = url.toLowerCase().trim();
  if (
    lower.includes('pinterest.com') ||
    lower.includes('pin.it') ||
    lower.includes('pinimg.com')
  ) {
    return 'pinterest';
  }
  if (
    lower.includes('facebook.com') ||
    lower.includes('fb.com') ||
    lower.includes('fb.watch') ||
    lower.includes('fbcdn.net') ||
    lower.includes('m.facebook.com')
  ) {
    return 'facebook';
  }
  return 'generic';
}

export function getProxiedImageUrl(originalUrl: string, fallbackUrl?: string): string {
  if (!originalUrl) return '';
  // If it's already a local data URI, blob URL, or already proxied, don't proxy again
  if (
    originalUrl.startsWith('data:') ||
    originalUrl.startsWith('blob:') ||
    originalUrl.startsWith('/api/proxy')
  ) {
    return originalUrl;
  }
  const fallbackParam = fallbackUrl ? `&fallback=${encodeURIComponent(fallbackUrl)}` : '';
  return `/api/proxy-image?url=${encodeURIComponent(originalUrl)}${fallbackParam}`;
}

export function getProxiedDownloadUrl(
  originalUrl: string,
  filename?: string,
  fallbackUrl?: string
): string {
  if (!originalUrl) return '';
  if (
    originalUrl.startsWith('data:') ||
    originalUrl.startsWith('blob:') ||
    originalUrl.startsWith('/api/proxy')
  ) {
    return originalUrl;
  }
  const cleanName = filename ? encodeURIComponent(filename) : 'download_hd.jpg';
  const fallbackParam = fallbackUrl ? `&fallback=${encodeURIComponent(fallbackUrl)}` : '';
  return `/api/proxy-download?url=${encodeURIComponent(originalUrl)}&filename=${cleanName}${fallbackParam}`;
}
