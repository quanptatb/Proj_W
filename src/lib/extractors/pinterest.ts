import * as cheerio from 'cheerio';
import { ExtractedImage, ExtractionResult } from '@/types';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * Upgrades any Pinterest image URL (e.g., 60x60, 170x, 216x, 236x, 474x, 564x, 600x315, 736x, 1200x)
 * to its maximum resolution "originals" CDN URL and removes resizing queries.
 */
export function upgradePinterestUrl(url: string): string {
  if (!url || !url.includes('pinimg.com')) return url;

  // Unescape backslashes and unicode if present
  let cleaned = url.replace(/\\\//g, '/').replace(/\\u0026/g, '&');

  // Match any dimension token in path: /236x/, /474x/, /170x/, /600x315/, /736x/, /1200x/, etc.
  cleaned = cleaned.replace(/\/(?:\d+x\d*|\d*x\d+)\//g, '/originals/');

  // Clean resizing or thumbnail parameters
  try {
    const parsed = new URL(cleaned);
    const paramsToDelete = ['w', 'width', 'h', 'height', 'crop', 'fit', 'auto'];
    for (const p of paramsToDelete) {
      parsed.searchParams.delete(p);
    }
    return parsed.href;
  } catch {
    return cleaned;
  }
}

export async function extractPinterestImages(rawUrl: string): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    success: false,
    source: 'pinterest',
    pageUrl: rawUrl,
    images: [],
  };

  try {
    let targetUrl = rawUrl.trim();

    // Direct pinimg CDN URL check
    if (targetUrl.includes('i.pinimg.com')) {
      const originalUrl = upgradePinterestUrl(targetUrl);
      const isOriginal = originalUrl.includes('/originals/');
      result.images.push({
        id: `pin-direct-${Date.now()}`,
        url: originalUrl,
        thumbnailUrl: targetUrl,
        fallbackUrl: targetUrl,
        source: 'pinterest',
        title: 'Pinterest Image (Direct CDN)',
        resolutionLabel: isOriginal ? 'Original Master (Uncompressed)' : 'Pinterest High Res',
        qualityScore: 99,
        isOriginalCandidate: true,
      });
      result.success = true;
      return result;
    }

    // Follow redirects (especially for short links like pin.it)
    const initialRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!initialRes.ok) {
      throw new Error(`Pinterest returned status ${initialRes.status}: ${initialRes.statusText}`);
    }

    const finalUrl = initialRes.url || targetUrl;
    result.pageUrl = finalUrl;
    const html = await initialRes.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      'Pinterest Pin';
    result.pageTitle = title;

    const seenUrls = new Set<string>();

    const addPinImage = (
      imgUrl: string,
      originalFallback: string,
      meta: {
        title?: string;
        width?: number;
        height?: number;
        score?: number;
        label?: string;
      } = {}
    ) => {
      const upgraded = upgradePinterestUrl(imgUrl);
      if (!upgraded || seenUrls.has(upgraded)) return;
      seenUrls.add(upgraded);

      const isMaster = upgraded.includes('/originals/');
      let label = meta.label;
      if (!label) {
        if (meta.width && meta.height) {
          label = `Original Master (${meta.width}×${meta.height})`;
        } else if (isMaster) {
          label = 'Original Master (Uncompressed)';
        } else {
          label = 'Pinterest High Res';
        }
      }

      result.images.push({
        id: `pin-${result.images.length}-${Date.now()}`,
        url: upgraded,
        thumbnailUrl: originalFallback,
        fallbackUrl: originalFallback,
        source: 'pinterest',
        title: meta.title || title,
        width: meta.width,
        height: meta.height,
        resolutionLabel: label,
        qualityScore: meta.score || (isMaster ? 100 : 85),
        isOriginalCandidate: true,
      });
    };

    // Strategy 1: Check script JSON tags (__PWS_DATA__, __PWS_INITIAL_PROPS__, etc.)
    $('script[type="application/json"]').each((_, elem) => {
      try {
        const text = $(elem).html();
        if (!text || !text.includes('pinimg.com')) return;
        const json = JSON.parse(text);

        const walkJson = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;

          // Check if object has direct orig specification
          if (obj.orig && typeof obj.orig.url === 'string') {
            const thumb = obj['236x']?.url || obj['736x']?.url || obj.orig.url;
            addPinImage(obj.orig.url, thumb, {
              title: obj.title || obj.description || title,
              width: obj.orig.width,
              height: obj.orig.height,
              score: 100,
            });
          }

          // Check for images dictionary (orig, 1200x, 736x, 474x)
          if (obj.images && typeof obj.images === 'object') {
            const bestImage =
              obj.images.orig ||
              obj.images.originals ||
              obj.images['1200x'] ||
              obj.images['736x'] ||
              obj.images['474x'];
            if (bestImage?.url) {
              const thumb = obj.images['236x']?.url || bestImage.url;
              addPinImage(bestImage.url, thumb, {
                width: bestImage.width,
                height: bestImage.height,
                score: 98,
              });
            }
          }

          // Check string values with pinimg
          for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (typeof val === 'string' && val.includes('i.pinimg.com')) {
              addPinImage(val, val, { score: 90 });
            } else if (typeof val === 'object') {
              walkJson(val);
            }
          }
        };

        walkJson(json);
      } catch {
        // Continue to other scripts
      }
    });

    // Strategy 2: Check JSON-LD metadata
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const text = $(elem).html();
        if (!text) return;
        const json = JSON.parse(text);
        const candidates: string[] = [];
        if (typeof json.image === 'string') candidates.push(json.image);
        if (Array.isArray(json.image)) candidates.push(...json.image);
        if (json.contentUrl) candidates.push(json.contentUrl);

        for (const cand of candidates) {
          addPinImage(cand, cand, {
            title: json.headline || json.name || title,
            score: 95,
            label: 'Original Master (JSON-LD)',
          });
        }
      } catch {
        // Continue
      }
    });

    // Strategy 3: OpenGraph & Twitter image tags
    const ogImage =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content');
    if (ogImage) {
      addPinImage(ogImage, ogImage, {
        score: 92,
        label: 'Original Master (OpenGraph)',
      });
    }

    // Strategy 4: Fallback scan for any pinimg URLs in HTML (handling both unescaped and JSON-escaped URLs)
    const unescapedHtml = html.replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    const pinimgMatches = unescapedHtml.match(/https:\/\/i\.pinimg\.com\/[^\s"'<>]+\.(?:jpe?g|png|webp)(?:\?[^\s"'<>]*)?/gi);
    if (pinimgMatches) {
      for (const match of pinimgMatches) {
        addPinImage(match, match, { score: 80, label: 'High Res CDN Asset' });
      }
    }

    // Sort images by quality score descending
    result.images.sort((a, b) => b.qualityScore - a.qualityScore);

    if (result.images.length > 0) {
      result.success = true;
    } else {
      result.error = 'No Pinterest images found at this URL. Make sure the pin is public.';
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      source: 'pinterest',
      pageUrl: rawUrl,
      images: [],
      error: error.message || 'Failed to extract Pinterest images.',
    };
  }
}
