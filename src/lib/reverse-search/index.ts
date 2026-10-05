import {
  ReverseSearchOptions,
  ReverseSearchResponse,
  ReverseSearchResultItem,
  OriginalImageInfo,
} from '@/types';
import { probeImageResolution, formatResolutionLabel } from './image-probe';
import { searchBingVisual, RawSearchCandidate } from './engines/bing';
import { searchGoogleLens } from './engines/google';

/**
 * Executes a concurrency-limited batch of asynchronous tasks
 */
async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      try {
        results[idx] = await fn(items[idx], idx);
      } catch (err: any) {
        results[idx] = null as any;
      }
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Unwraps proxied image URLs (e.g. /api/proxy-image?url=https%3A%2F%2F...)
 * so reverse search engines can access the authentic remote image.
 */
export function unwrapProxiedUrl(url: string): string {
  if (!url) return url;
  if (url.includes('/api/proxy-image') || url.includes('/api/proxy-download')) {
    try {
      const u = new URL(url, 'http://localhost');
      const target = u.searchParams.get('url');
      if (target) return target;
    } catch {
      // ignore
    }
  }
  return url;
}

/**
 * Normalizes an image URL for deduplication
 */
function normalizeUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    u.hash = '';
    return u.href.toLowerCase();
  } catch {
    return urlStr.toLowerCase();
  }
}

/**
 * Main Hybrid Reverse Image Search Engine with Fast Header Probing
 */
export async function performReverseImageSearch(
  options: ReverseSearchOptions
): Promise<ReverseSearchResponse> {
  const startTime = Date.now();
  const { imageUrl, currentWidth, currentHeight, apiKey, provider = 'auto', maxResults = 30 } = options;

  if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
    return {
      success: false,
      originalImage: { url: '' },
      results: [],
      totalFound: 0,
      higherResCount: 0,
      error: 'Image URL or payload is required for reverse search.',
    };
  }

  const cleanImageUrl = unwrapProxiedUrl(imageUrl.trim());

  // 1. Establish Baseline Resolution for the Original Image
  let origWidth = currentWidth;
  let origHeight = currentHeight;
  let origSizeBytes: number | undefined;
  let origFormat: string | undefined;

  if (!origWidth || !origHeight) {
    const origProbe = await probeImageResolution(cleanImageUrl, 4000);
    if (origProbe.width && origProbe.height) {
      origWidth = origProbe.width;
      origHeight = origProbe.height;
      origSizeBytes = origProbe.fileSizeBytes;
      origFormat = origProbe.format;
    }
  }

  const originalInfo: OriginalImageInfo = {
    url: cleanImageUrl,
    width: origWidth,
    height: origHeight,
    fileSizeBytes: origSizeBytes,
    format: origFormat,
    resolutionLabel:
      origWidth && origHeight
        ? formatResolutionLabel(origWidth, origHeight)
        : 'Unknown Resolution',
  };

  const origArea = (origWidth || 0) * (origHeight || 0);

  // 2. Query Multi-Source Reverse Search Engines
  const enginesUsed: string[] = [];
  const rawCandidates: RawSearchCandidate[] = [];

  const enginePromises: Promise<RawSearchCandidate[]>[] = [];

  if (provider === 'auto' || provider === 'bing') {
    enginesUsed.push('bing');
    enginePromises.push(
      searchBingVisual(cleanImageUrl, { apiKey: provider === 'bing' ? apiKey : undefined }).catch(
        () => []
      )
    );
  }

  if (provider === 'auto' || provider === 'google' || provider === 'serpapi') {
    enginesUsed.push(apiKey && provider === 'serpapi' ? 'serpapi' : 'google');
    enginePromises.push(
      searchGoogleLens(cleanImageUrl, {
        apiKey: provider === 'serpapi' || (provider === 'auto' && apiKey?.startsWith('serp')) ? apiKey : undefined,
      }).catch(() => [])
    );
  }

  const engineResults = await Promise.allSettled(enginePromises);
  for (const res of engineResults) {
    if (res.status === 'fulfilled' && Array.isArray(res.value)) {
      rawCandidates.push(...res.value);
    }
  }

  // 3. Deduplicate Candidate URLs and Exclude Original URL
  const normalizedOrig = normalizeUrl(cleanImageUrl);
  const seenUrls = new Set<string>();
  const uniqueCandidates: RawSearchCandidate[] = [];

  for (const cand of rawCandidates) {
    if (!cand.url || cand.url.startsWith('data:image/svg') || cand.url.startsWith('data:image/gif')) {
      continue;
    }
    const norm = normalizeUrl(cand.url);
    if (norm === normalizedOrig || seenUrls.has(norm)) {
      continue;
    }
    seenUrls.add(norm);
    uniqueCandidates.push(cand);
    if (uniqueCandidates.length >= maxResults) break;
  }

  // 4. Fast Header / Range Probing on Candidates (5 concurrent probes)
  const probedCandidates = await mapConcurrent(
    uniqueCandidates,
    5,
    async (cand, idx): Promise<ReverseSearchResultItem | null> => {
      // If width & height are already known from structured API
      let width = cand.width;
      let height = cand.height;
      let fileSizeBytes: number | undefined;
      let format: string | undefined;

      if (!width || !height) {
        const probe = await probeImageResolution(cand.url, 4000);
        if (probe.width && probe.height) {
          width = probe.width;
          height = probe.height;
          fileSizeBytes = probe.fileSizeBytes;
          format = probe.format;
        }
      }

      if (!width || !height) {
        return null; // Cannot verify dimensions
      }

      const candArea = width * height;
      const isHigherRes = origArea > 0 ? candArea > origArea : candArea >= 640 * 480;
      const multiplier =
        origArea > 0 ? parseFloat((candArea / origArea).toFixed(1)) : 1;

      return {
        id: `rev-${idx}-${Date.now()}`,
        url: cand.url,
        thumbnailUrl: cand.thumbnailUrl || cand.url,
        pageUrl: cand.pageUrl,
        domain: cand.domain || 'web',
        title: cand.title,
        width,
        height,
        fileSizeBytes,
        format,
        resolutionLabel: formatResolutionLabel(width, height),
        isHigherRes,
        multiplier,
        sourceEngine: cand.sourceEngine,
      };
    }
  );

  // 5. Filter valid items and rank
  const validItems = probedCandidates.filter(
    (item): item is ReverseSearchResultItem => item !== null
  );

  // Group into strictly higher resolution vs other matches
  const higherResItems = validItems.filter((i) => i.isHigherRes);
  const equalOrLowerItems = validItems.filter((i) => !i.isHigherRes);

  // Sort each group descending by total pixel area (width * height)
  higherResItems.sort((a, b) => b.width * b.height - a.width * a.height);
  equalOrLowerItems.sort((a, b) => b.width * b.height - a.width * a.height);

  // Combine: Higher resolution versions strictly on top!
  const sortedResults = [...higherResItems, ...equalOrLowerItems];

  const executionTimeMs = Date.now() - startTime;

  return {
    success: true,
    originalImage: originalInfo,
    results: sortedResults,
    totalFound: sortedResults.length,
    higherResCount: higherResItems.length,
    executionTimeMs,
    enginesUsed,
  };
}

export * from './image-probe';
export * from './engines/bing';
export * from './engines/google';
