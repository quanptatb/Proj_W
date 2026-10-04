import * as cheerio from 'cheerio';
import { ExtractedImage, ExtractionResult } from '@/types';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp|avif|tiff|bmp)(\?.*)?$/i;
const IGNORED_IMAGE_TERMS = /(avatar|icon|badge|logo|tracking|pixel|analytics|spacer|blank|emoji|spinner|1x1)/i;

/**
 * Parses srcset attribute according to W3C HTML5 spec, supporting URLs containing commas (e.g. Cloudinary, data URIs).
 * Returns the candidate URL with the highest resolution/width.
 */
export function getHighestFromSrcset(
  srcset: string,
  baseUrl: string
): { url: string; width?: number } | null {
  if (!srcset || typeof srcset !== 'string') return null;

  // Split by comma followed by whitespace and a candidate URL
  const rawEntries = srcset
    .trim()
    .split(/,\s+(?=[^\s,]+\s+[0-9.]+[wx]|https?:\/\/|\/|\.\/|\.\.\/|[a-zA-Z0-9_-]+\.[a-zA-Z]{2,})/);

  let bestUrl = '';
  let maxWeight = 0;
  let detectedWidth: number | undefined;

  for (const entry of rawEntries) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    // Find the last whitespace which separates url from descriptor (e.g. "https://site.com/pic.jpg 1200w")
    const lastSpaceIdx = trimmed.lastIndexOf(' ');
    let rawUrl = trimmed;
    let descriptor = '';

    if (lastSpaceIdx > 0) {
      const possibleDesc = trimmed.substring(lastSpaceIdx + 1);
      if (/^[0-9.]+[wx]$/i.test(possibleDesc)) {
        rawUrl = trimmed.substring(0, lastSpaceIdx).trim();
        descriptor = possibleDesc.toLowerCase();
      }
    }

    let weight = 1;
    let widthVal: number | undefined;

    if (descriptor.endsWith('w')) {
      widthVal = parseInt(descriptor.slice(0, -1), 10);
      weight = isNaN(widthVal) ? 1 : widthVal;
    } else if (descriptor.endsWith('x')) {
      const density = parseFloat(descriptor.slice(0, -1));
      weight = isNaN(density) ? 1 : density * 1000;
    }

    if (weight >= maxWeight) {
      maxWeight = weight;
      try {
        bestUrl = new URL(rawUrl, baseUrl).href;
        detectedWidth = widthVal;
      } catch {
        bestUrl = rawUrl;
      }
    }
  }

  return bestUrl ? { url: bestUrl, width: detectedWidth } : null;
}

/**
 * Removes common thumbnail resizing parameters from image URLs and upgrades major CDN platforms
 * (Twitter/X orig, Blogspot/Google s0, Shopify unconstrained, WordPress clean master).
 */
export function removeThumbnailQuery(rawUrl: string): string {
  try {
    let cleaned = rawUrl;

    // 1. Twitter/X: name=small / name=360x360 -> name=orig
    if (cleaned.includes('twimg.com')) {
      const u = new URL(cleaned);
      if (u.searchParams.has('name') && u.searchParams.get('name') !== 'orig') {
        u.searchParams.set('name', 'orig');
        return u.href;
      }
    }

    // 2. Google / Blogger / Blogspot user content: /s320/ or /s640/ or /s1600-w400/ -> /s0/ (full resolution)
    if (cleaned.includes('googleusercontent.com') || cleaned.includes('blogspot.com')) {
      cleaned = cleaned.replace(/\/s\d+(?:-[chw]\d+)*\//, '/s0/');
    }

    // 3. Shopify image sizing suffix: _small.jpg, _medium.jpg, _large.jpg, _600x600.jpg -> .jpg
    const shopifyPattern =
      /_(?:pico|icon|thumb|small|compact|medium|large|grande|\d{2,4}x\d{2,4})(@2x)?(\.(?:jpe?g|png|webp|avif))$/i;
    if (shopifyPattern.test(cleaned)) {
      cleaned = cleaned.replace(shopifyPattern, '$2');
    }

    const parsed = new URL(cleaned);

    // Common CDN resize params: Wordpress, Cloudinary, Shopify, Imgix, etc.
    const resizeParams = [
      'w', 'width', 'h', 'height', 'resize', 'fit', 'crop', 'size',
      'max_width', 'max_height', 'thumbnail', 'thumb', 'quality', 'q'
    ];

    let modified = false;
    for (const p of resizeParams) {
      if (parsed.searchParams.has(p)) {
        parsed.searchParams.delete(p);
        modified = true;
      }
    }

    // Common WordPress regex resizing in path: photo-300x200.jpg -> photo.jpg
    const wpResize = /(-\d{2,4}x\d{2,4})(\.(?:jpe?g|png|webp|avif))$/i;
    if (wpResize.test(parsed.pathname)) {
      parsed.pathname = parsed.pathname.replace(wpResize, '$2');
      modified = true;
    }

    return modified ? parsed.href : cleaned;
  } catch {
    return rawUrl;
  }
}

export async function extractGenericWebImages(rawUrl: string): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    success: false,
    source: 'generic',
    pageUrl: rawUrl,
    images: [],
  };

  try {
    let targetUrl = rawUrl.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    // If direct image URL was provided
    if (IMAGE_EXTENSIONS.test(targetUrl)) {
      const cleaned = removeThumbnailQuery(targetUrl);
      result.images.push({
        id: `generic-direct-${Date.now()}`,
        url: cleaned,
        thumbnailUrl: targetUrl,
        fallbackUrl: targetUrl,
        source: 'generic',
        title: 'Direct Image Asset',
        resolutionLabel: 'Original Quality',
        qualityScore: 99,
        isOriginalCandidate: true,
      });
      result.success = true;
      return result;
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new Error(`Web page returned status ${res.status}: ${res.statusText}`);
    }

    const finalUrl = res.url || targetUrl;
    result.pageUrl = finalUrl;
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').text().trim() ||
      'Web Page Images';
    result.pageTitle = title;

    const seenUrls = new Set<string>();

    const addCandidate = (
      rawSrc: string,
      meta: {
        title?: string;
        width?: number;
        height?: number;
        scoreBonus?: number;
        label?: string;
      } = {}
    ) => {
      if (!rawSrc || rawSrc.startsWith('data:image/gif') || rawSrc.startsWith('data:image/svg')) return;

      let fullUrl = '';
      try {
        fullUrl = new URL(rawSrc, finalUrl).href;
      } catch {
        return;
      }

      if (IGNORED_IMAGE_TERMS.test(fullUrl) && (meta.scoreBonus || 0) < 50) {
        return;
      }

      const originalCleaned = removeThumbnailQuery(fullUrl);
      if (seenUrls.has(originalCleaned) || seenUrls.has(fullUrl)) {
        return;
      }
      seenUrls.add(originalCleaned);
      seenUrls.add(fullUrl);

      let score = 50 + (meta.scoreBonus || 0);
      if (meta.width) {
        score += Math.min(40, Math.floor(meta.width / 50));
      }

      let label = meta.label || 'Web Image';
      if (meta.width && meta.height) {
        label = `High Res (${meta.width}×${meta.height})`;
      } else if (meta.width) {
        label = `High Res (${meta.width}w)`;
      }

      result.images.push({
        id: `generic-${result.images.length}-${Date.now()}`,
        url: originalCleaned,
        thumbnailUrl: fullUrl,
        fallbackUrl: fullUrl,
        source: 'generic',
        title: meta.title || title,
        width: meta.width,
        height: meta.height,
        resolutionLabel: label,
        qualityScore: score,
        isOriginalCandidate: (meta.scoreBonus || 0) >= 30 || (meta.width || 0) >= 1000,
      });
    };

    // Strategy 1: OpenGraph & Twitter primary images
    const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[property="og:image:secure_url"]').attr('content');
    const twImage = $('meta[name="twitter:image"]').attr('content') || $('meta[name="twitter:image:src"]').attr('content');

    if (ogImage) addCandidate(ogImage, { scoreBonus: 40, label: 'Primary Hero (OG)' });
    if (twImage) addCandidate(twImage, { scoreBonus: 35, label: 'Primary (Twitter Card)' });

    // Strategy 2: JSON-LD structured images
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const text = $(elem).html();
        if (text) {
          const json = JSON.parse(text);
          const findImagesInJson = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;
            if (obj['@type'] === 'ImageObject' && obj.contentUrl) {
              addCandidate(obj.contentUrl, { scoreBonus: 35, label: 'Structured Image' });
            }
            if (typeof obj.image === 'string') {
              addCandidate(obj.image, { scoreBonus: 30, label: 'Structured Image' });
            } else if (Array.isArray(obj.image)) {
              obj.image.forEach((img: any) => {
                if (typeof img === 'string') addCandidate(img, { scoreBonus: 30 });
                else if (img?.url) addCandidate(img.url, { scoreBonus: 30 });
              });
            }
            for (const k of Object.keys(obj)) {
              findImagesInJson(obj[k]);
            }
          };
          findImagesInJson(json);
        }
      } catch {
        // ignore
      }
    });

    // Strategy 3: Hyperlinks wrapping images pointing to full resolution assets (<a href="photo.jpg"><img ...></a>)
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && IMAGE_EXTENSIONS.test(href)) {
        addCandidate(href, { scoreBonus: 30, label: 'Master Link Image' });
      }
    });

    // Strategy 4: <img> tags with srcset and high-res data attributes
    $('img').each((_, elem) => {
      const $img = $(elem);
      const srcset = $img.attr('srcset') || $img.attr('data-srcset');
      const dataSrc =
        $img.attr('data-src') ||
        $img.attr('data-original') ||
        $img.attr('data-zoom-src') ||
        $img.attr('data-high-res-src') ||
        $img.attr('data-large-file') ||
        $img.attr('data-master');
      const src = $img.attr('src');
      const imgWidth = parseInt($img.attr('width') || '0', 10);
      const imgHeight = parseInt($img.attr('height') || '0', 10);
      const alt = $img.attr('alt') || '';

      // Skip tiny icons
      if (imgWidth > 0 && imgWidth < 80 && imgHeight > 0 && imgHeight < 80) {
        return;
      }

      if (srcset) {
        const best = getHighestFromSrcset(srcset, finalUrl);
        if (best) {
          addCandidate(best.url, {
            title: alt,
            width: best.width || (imgWidth > 0 ? imgWidth : undefined),
            height: imgHeight > 0 ? imgHeight : undefined,
            scoreBonus: 25,
            label: best.width ? `Srcset (${best.width}w)` : 'Srcset High Res',
          });
        }
      }

      if (dataSrc) {
        addCandidate(dataSrc, {
          title: alt,
          width: imgWidth > 0 ? imgWidth : undefined,
          height: imgHeight > 0 ? imgHeight : undefined,
          scoreBonus: 20,
          label: 'Lazyload High Res',
        });
      }

      if (src && !src.startsWith('data:')) {
        addCandidate(src, {
          title: alt,
          width: imgWidth > 0 ? imgWidth : undefined,
          height: imgHeight > 0 ? imgHeight : undefined,
          scoreBonus: 10,
        });
      }
    });

    // Sort by quality score descending
    result.images.sort((a, b) => b.qualityScore - a.qualityScore);

    if (result.images.length > 0) {
      result.success = true;
    } else {
      result.error = 'No clear images could be found on this web page.';
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      source: 'generic',
      pageUrl: rawUrl,
      images: [],
      error: error.message || 'Failed to extract images from web page.',
    };
  }
}
