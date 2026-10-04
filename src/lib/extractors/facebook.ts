import * as cheerio from 'cheerio';
import { ExtractedImage, ExtractionResult } from '@/types';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';

/**
 * Checks if a candidate Facebook URL is an avatar or micro thumbnail.
 * Uses exact numeric dimension parsing and profile picture URL categories (-1, -19).
 */
export function isTinyOrAvatarFacebookUrl(url: string): boolean {
  if (!url) return false;
  const cleaned = url.toLowerCase();

  // Category -1 or -19 indicates Facebook profile avatar (e.g. /t39.30808-1/ or /t1.30497-1/)
  if (/\/t\d+\.\d+-(?:1|19)\//i.test(cleaned)) {
    return true;
  }

  // Check explicit transform dimensions: if width <= 180 and height <= 180, it's an avatar or icon
  const dimMatch = cleaned.match(/(?:cstp=mx|ctp=s|stp=.*?[_ps]|[sp])(\d{2,4})x(\d{2,4})/i);
  if (dimMatch) {
    const w = parseInt(dimMatch[1], 10);
    const h = parseInt(dimMatch[2], 10);
    if (w <= 180 && h <= 180) {
      return true;
    }
  }

  return false;
}

/**
 * Validates that a candidate URL is a genuine renderable Facebook image
 * and not a vector animation binary (.kf Keyframes), video, script, style, or UI avatar.
 */
export function isValidFacebookImageUrl(
  url: string,
  options: { allowAvatars?: boolean } = {}
): boolean {
  if (!url || typeof url !== 'string') return false;
  const cleaned = unescapeFacebookString(url.trim()).toLowerCase();

  // Must belong to Facebook CDN or storage
  if (!cleaned.includes('fbcdn.net') && !cleaned.includes('fbsbx.com')) {
    return false;
  }

  // Reject Meta Keyframes binary vector animations (.kf), videos, audio, scripts, styles, fonts
  if (
    cleaned.includes('.kf?') ||
    cleaned.endsWith('.kf') ||
    cleaned.includes('/m1/v/t6/') ||
    cleaned.includes('keyframes') ||
    cleaned.includes('.mp4') ||
    cleaned.includes('.webm') ||
    cleaned.includes('.m4a') ||
    cleaned.includes('.mp3') ||
    cleaned.includes('.js') ||
    cleaned.includes('.css') ||
    cleaned.includes('.woff') ||
    cleaned.includes('.ttf') ||
    cleaned.includes('/rsrc.php/') ||
    cleaned.includes('/emoji.php/') ||
    cleaned.includes('video.')
  ) {
    return false;
  }

  // Reject tiny avatars and micro icons (unless explicitly allowed, e.g. for direct URL input)
  if (!options.allowAvatars && isTinyOrAvatarFacebookUrl(cleaned)) {
    return false;
  }

  // Check valid image extensions or image transform params
  try {
    const parsed = new URL(cleaned);
    const pathname = parsed.pathname;
    const isImageExt = /\.(jpe?g|png|webp|gif|avif)$/i.test(pathname);
    const hasImageParam = /[?&](?:stp=.*dst-(?:jpg|png|webp)|format=(?:jpg|png|webp))/i.test(cleaned);
    return isImageExt || hasImageParam;
  } catch {
    return /\.(jpe?g|png|webp|gif|avif)(?:[?#]|$)/i.test(cleaned);
  }
}

/**
 * Safely prepares Facebook CDN URLs for full resolution rendering.
 * Unescapes JSON/unicode escape characters.
 * IMPORTANT: Modern Facebook CDN URLs contain cryptographic HMAC signatures (oh= / oe=)
 * that cover the entire URI path. Mutating the path of a signed URL breaks the HMAC signature
 * and causes Facebook CDN to reject requests with HTTP 403 Forbidden.
 * Therefore, path downscaling segments (/p720x720/, /s960x960/) are ONLY stripped for
 * unsigned URLs.
 */
export function upgradeFacebookUrl(url: string): string {
  if (!url || !url.includes('fbcdn.net')) return url;

  let cleaned = unescapeFacebookString(url);

  // If the URL has HMAC security tokens (oh= or oe=), mutating the path invalidates
  // the Facebook CDN signature and causes HTTP 403 Forbidden.
  const isSigned = /[?&](?:oh|oe)=/i.test(cleaned);
  if (!isSigned) {
    const dimensionPattern = /\/(?:[psc]\d+x\d+[a-z]?|c\d+\.\d+\.\d+\.\d+[a-z]?)\//i;
    if (dimensionPattern.test(cleaned)) {
      cleaned = cleaned.replace(dimensionPattern, '/');
    }
  }

  return cleaned;
}

/**
 * Cleans escaped strings frequently found in Facebook HTML & JSON script payloads.
 */
export function unescapeFacebookString(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/gi, '=')
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u002f/gi, '/')
    .replace(/\\u003a/gi, ':')
    .replace(/\\\/|\//g, '/')
    .replace(/&amp;/g, '&');
}

/**
 * Extracts width, height, and photo asset key for deduplication.
 */
export function parseFacebookUrlDetails(url: string): {
  width?: number;
  height?: number;
  photoKey: string;
} {
  let width: number | undefined;
  let height: number | undefined;

  // Modern Facebook transform params: cstp=mx2048x2048, ctp=s2048x2048, or stp=...s960x960
  const modernDim = url.match(/(?:cstp=mx|ctp=s|stp=.*?[_ps])(\d{3,4})x(\d{3,4})/i);
  if (modernDim) {
    width = parseInt(modernDim[1], 10);
    height = parseInt(modernDim[2], 10);
  } else {
    const legacyDim = url.match(/[sp](\d{3,4})x(\d{3,4})/i);
    if (legacyDim) {
      width = parseInt(legacyDim[1], 10);
      height = parseInt(legacyDim[2], 10);
    }
  }

  // Deduplication key: Facebook filename typically follows [prefix]_[fbid]_[hash]_n.[ext]
  let photoKey = url.split('?')[0];
  const fbidMatch = photoKey.match(/\d+_(\d{10,20})_\d+_n\.[a-z]+/i);
  if (fbidMatch) {
    photoKey = fbidMatch[1];
  } else {
    const filenameMatch = photoKey.match(/\/([^\/?#]+\.[a-z0-9]+)$/i);
    if (filenameMatch) {
      photoKey = filenameMatch[1];
    }
  }

  return { width, height, photoKey };
}

export async function extractFacebookImages(rawUrl: string): Promise<ExtractionResult> {
  const result: ExtractionResult = {
    success: false,
    source: 'facebook',
    pageUrl: rawUrl,
    images: [],
  };

  try {
    let targetUrl = rawUrl.trim();

    // If user passed a direct fbcdn or fbsbx image URL
    if (targetUrl.includes('fbcdn.net') || targetUrl.includes('fbsbx.com')) {
      const decodedTarget = unescapeFacebookString(targetUrl);
      if (!isValidFacebookImageUrl(decodedTarget, { allowAvatars: true })) {
        result.error =
          'Đường dẫn trực tiếp không phải là hình ảnh hợp lệ (hoặc là tệp hoạt họa vector .kf, video của Facebook).';
        return result;
      }

      const upgraded = upgradeFacebookUrl(decodedTarget);
      const { width, height } = parseFacebookUrlDetails(decodedTarget);
      const resLabel =
        width && height
          ? `Facebook HD (${width}×${height})`
          : 'Highest Available CDN Stream';

      result.images.push({
        id: `fb-direct-${Date.now()}`,
        url: upgraded,
        thumbnailUrl: decodedTarget,
        fallbackUrl: decodedTarget,
        source: 'facebook',
        title: 'Facebook Direct CDN Asset',
        width,
        height,
        resolutionLabel: resLabel,
        qualityScore: 95,
        isOriginalCandidate: true,
      });
      result.success = true;
      return result;
    }

    // Try fetching with desktop headers first, fallback to mobile if blocked
    let html = '';
    let res = await fetch(targetUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'vi,en-US;q=0.9,en;q=0.8',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
      },
      redirect: 'follow',
    });

    if (res.ok) {
      html = await res.text();
    } else {
      // Fallback with mobile user-agent
      res = await fetch(targetUrl, {
        headers: {
          'User-Agent': MOBILE_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      });
      if (res.ok) {
        html = await res.text();
      }
    }

    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const rawTitle = $('title').text().trim();
    let title = ogTitle || rawTitle || 'Facebook Post';

    // If title is generic "Facebook" or "Log in to Facebook", clean it up
    if (
      title.toLowerCase() === 'facebook' ||
      title.toLowerCase().includes('log in') ||
      title.toLowerCase().includes('đăng nhập')
    ) {
      // Try to create a better title from URL slug if available
      try {
        const parsed = new URL(targetUrl);
        const pathParts = parsed.pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && pathParts[0] !== 'photo' && pathParts[0] !== 'photo.php') {
          title = `${pathParts[0]} - Facebook`;
        } else {
          title = 'Facebook Post';
        }
      } catch {
        title = 'Facebook Post';
      }
    }
    result.pageTitle = title;

    // Deduplication map: photoKey -> ExtractedImage
    const photoMap = new Map<string, ExtractedImage>();

    const addFbImage = (
      rawCandUrl: string,
      meta: {
        width?: number;
        height?: number;
        score?: number;
        label?: string;
      } = {}
    ) => {
      const originalDecoded = unescapeFacebookString(rawCandUrl);
      if (!isValidFacebookImageUrl(originalDecoded)) return;

      const upgraded = upgradeFacebookUrl(originalDecoded);
      const parsedDetails = parseFacebookUrlDetails(originalDecoded);
      const photoKey = parsedDetails.photoKey;

      const finalWidth = meta.width || parsedDetails.width;
      const finalHeight = meta.height || parsedDetails.height;

      let resLabel = meta.label;
      let score = meta.score || 75;

      if (!resLabel) {
        if (finalWidth && finalHeight) {
          resLabel = `Facebook HD (${finalWidth}×${finalHeight})`;
          score = Math.min(99, 65 + Math.floor(Math.max(finalWidth, finalHeight) / 40));
        } else {
          resLabel = 'Facebook Full Photo';
        }
      }

      const newImage: ExtractedImage = {
        id: `fb-${photoMap.size}-${Date.now()}`,
        url: upgraded,
        thumbnailUrl: originalDecoded,
        fallbackUrl: originalDecoded,
        source: 'facebook',
        title,
        width: finalWidth,
        height: finalHeight,
        resolutionLabel: resLabel,
        qualityScore: score,
        isOriginalCandidate: true,
      };

      // If photoKey already exists, keep the one with higher resolution or score
      if (photoMap.has(photoKey)) {
        const existing = photoMap.get(photoKey)!;
        const existingDim = Math.max(existing.width || 0, existing.height || 0);
        const newDim = Math.max(finalWidth || 0, finalHeight || 0);
        if (newDim > existingDim || (score > (existing.qualityScore || 0) && newDim >= existingDim)) {
          photoMap.set(photoKey, newImage);
        }
      } else {
        photoMap.set(photoKey, newImage);
      }
    };

    // Strategy 1: OpenGraph meta tags
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogSecureImage = $('meta[property="og:image:secure_url"]').attr('content');
    const ogWidth = parseInt($('meta[property="og:image:width"]').attr('content') || '0', 10);
    const ogHeight = parseInt($('meta[property="og:image:height"]').attr('content') || '0', 10);

    const ogCandidates = [ogSecureImage, ogImage].filter(Boolean) as string[];
    for (const cand of ogCandidates) {
      addFbImage(cand, {
        width: ogWidth > 0 ? ogWidth : undefined,
        height: ogHeight > 0 ? ogHeight : undefined,
        score: 90,
        label:
          ogWidth > 0 && ogHeight > 0
            ? `High Res (${ogWidth}×${ogHeight})`
            : 'Facebook High Res (OpenGraph)',
      });
    }

    // Strategy 2: Deep JSON inspection in <script> tags (RelayModern & GraphQL store)
    $('script').each((_, elem) => {
      const scriptContent = $(elem).html();
      if (!scriptContent || !scriptContent.includes('fbcdn.net')) return;

      // Extract URI strings matching fbcdn inside script text
      const unescapedScript = unescapeFacebookString(scriptContent);
      const urlMatches = unescapedScript.match(/https:\/\/[a-z0-9\-.]*fbcdn\.net\/[^\s"'<>]+/gi);
      if (urlMatches) {
        for (const u of urlMatches) {
          addFbImage(u);
        }
      }
    });

    // Strategy 3: Global HTML regex scan for any remaining fbcdn URLs
    const globalUnescaped = unescapeFacebookString(html);
    const globalMatches = globalUnescaped.match(/https:\/\/[a-z0-9\-.]*fbcdn\.net\/[^\s"'<>]+/gi);
    if (globalMatches) {
      for (const m of globalMatches) {
        addFbImage(m);
      }
    }

    result.images = Array.from(photoMap.values()).sort(
      (a, b) => (b.qualityScore || 0) - (a.qualityScore || 0)
    );

    if (result.images.length > 0) {
      result.success = true;
    } else {
      const isRestricted =
        html.includes('login') ||
        html.includes('checkpoint') ||
        html.includes('require_login') ||
        rawTitle.toLowerCase() === 'error' ||
        rawTitle.toLowerCase().includes('đăng nhập') ||
        rawTitle.toLowerCase().includes('log in');

      result.error = isRestricted
        ? 'Không thể bóc tách ảnh từ liên kết Facebook này do bài viết thuộc nhóm riêng tư/kín hoặc yêu cầu đăng nhập. Vui lòng đảm bảo bài viết ở chế độ Công khai (Public), hoặc lưu ảnh về máy và sử dụng tính năng "Tải Ảnh Lên"!'
        : 'Không tìm thấy hình ảnh nào từ liên kết Facebook này. Vui lòng kiểm tra lại đường dẫn bài viết hoặc tải ảnh trực tiếp lên!';
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      source: 'facebook',
      pageUrl: rawUrl,
      images: [],
      error: error.message || 'Lỗi khi trích xuất hình ảnh Facebook.',
    };
  }
}
