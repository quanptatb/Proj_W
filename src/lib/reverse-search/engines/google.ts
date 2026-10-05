import { RawSearchCandidate } from './bing';
import { upgradePinterestUrl } from '../../extractors/pinterest';
import { upgradeFacebookUrl } from '../../extractors/facebook';
import { removeThumbnailQuery } from '../../extractors/generic';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function cleanAndUpgradeUrl(rawUrl: string): string {
  let url = rawUrl
    .trim()
    .replace(/\\\//g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/&amp;/gi, '&');
  if (url.includes('pinimg.com')) {
    url = upgradePinterestUrl(url);
  } else if (url.includes('fbcdn.net')) {
    url = upgradeFacebookUrl(url);
  } else {
    url = removeThumbnailQuery(url);
  }
  return url;
}

function extractDomain(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

/**
 * Google Lens / Google Reverse Image Search Engine
 * Supports SerpApi (if user provides API key) and free Google Lens endpoint.
 */
export async function searchGoogleLens(
  imageUrl: string,
  options: { apiKey?: string; timeoutMs?: number } = {}
): Promise<RawSearchCandidate[]> {
  const timeoutMs = options.timeoutMs || 8000;
  const candidates: RawSearchCandidate[] = [];
  const seenUrls = new Set<string>();

  // 1. SerpApi Google Lens Integration (if API key provided)
  if (options.apiKey && !imageUrl.startsWith('data:')) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const serpUrl = `https://serpapi.com/search.json?engine=google_lens&url=${encodeURIComponent(
        imageUrl
      )}&api_key=${encodeURIComponent(options.apiKey)}`;

      const res = await fetch(serpUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const matches = [
          ...(data.visual_matches || []),
          ...(data.exact_matches || []),
          ...(data.images_results || []),
        ];

        for (const item of matches) {
          const directUrl = item.original_image || item.thumbnail || item.link;
          if (directUrl && !seenUrls.has(directUrl)) {
            seenUrls.add(directUrl);
            const upgraded = cleanAndUpgradeUrl(directUrl);
            candidates.push({
              url: upgraded,
              pageUrl: item.link,
              domain: extractDomain(item.link || item.source || upgraded),
              title: item.title,
              thumbnailUrl: item.thumbnail,
              sourceEngine: 'serpapi',
            });
          }
        }

        if (candidates.length > 0) return candidates;
      }
    } catch {
      // Fall through to free endpoint
    }
  }

  // 2. Free Google Lens Endpoint
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let res: Response;

    if (imageUrl.startsWith('data:')) {
      try {
        const commaIdx = imageUrl.indexOf(',');
        const base64Data = commaIdx >= 0 ? imageUrl.substring(commaIdx + 1) : '';
        const mimeMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: mimeType });

        const formData = new FormData();
        formData.append('encoded_image', blob, 'image.jpg');

        res = await fetch('https://lens.google.com/v3/upload', {
          method: 'POST',
          headers: {
            'User-Agent': BROWSER_USER_AGENT,
          },
          body: formData,
          signal: controller.signal,
        });
      } catch {
        clearTimeout(timeoutId);
        return candidates;
      }
    } else {
      const lensUrl = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
      res = await fetch(lensUrl, {
        headers: {
          'User-Agent': BROWSER_USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (res.ok) {
      const html = await res.text();

      // Look for candidate image URLs in Google Lens AF_initDataCallback or JSON payload
      // Handles both unescaped and JSON escaped slashes (\/ and \u0026)
      const urlRegex = /(?:["']|\\")(https?:[\\/]+[^"'<>\s]+?\.(?:jpe?g|png|webp|avif|gif)(?:\?[^"'<>\s]*)?)(?:["']|\\")/gi;
      let m: RegExpExecArray | null;

      while ((m = urlRegex.exec(html)) !== null) {
        const foundUrl = m[1]
          .replace(/\\\//g, '/')
          .replace(/\\u0026/g, '&')
          .replace(/\\u002f/gi, '/')
          .replace(/&amp;/gi, '&');

        // Filter out Google internal static icons
        if (
          !foundUrl.includes('gstatic.com/images/branding') &&
          !foundUrl.includes('google.com/images') &&
          !foundUrl.includes('googleusercontent.com/gadgets') &&
          !seenUrls.has(foundUrl)
        ) {
          seenUrls.add(foundUrl);
          const upgraded = cleanAndUpgradeUrl(foundUrl);
          candidates.push({
            url: upgraded,
            domain: extractDomain(upgraded),
            sourceEngine: 'google',
          });
        }
      }
    }
  } catch {
    // Return collected candidates
  }

  return candidates;
}
