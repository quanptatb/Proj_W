import * as cheerio from 'cheerio';
import { upgradePinterestUrl } from '../../extractors/pinterest';
import { upgradeFacebookUrl } from '../../extractors/facebook';
import { removeThumbnailQuery } from '../../extractors/generic';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface RawSearchCandidate {
  url: string;
  pageUrl?: string;
  domain: string;
  title?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  sourceEngine: 'bing' | 'google' | 'serpapi' | 'yandex';
}

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
 * Bing Visual Search Engine
 * Supports both free scraping via Bing Visual Search URL Paste and official Bing Visual Search API.
 */
export async function searchBingVisual(
  imageUrl: string,
  options: { apiKey?: string; timeoutMs?: number } = {}
): Promise<RawSearchCandidate[]> {
  const timeoutMs = options.timeoutMs || 8000;
  const candidates: RawSearchCandidate[] = [];
  const seenUrls = new Set<string>();

  // If user provided a Bing Visual Search API key
  if (options.apiKey) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const formData = new FormData();
      if (imageUrl.startsWith('data:')) {
        const commaIdx = imageUrl.indexOf(',');
        const base64Data = commaIdx >= 0 ? imageUrl.substring(commaIdx + 1) : '';
        const mimeMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const buffer = Buffer.from(base64Data, 'base64');
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('image', blob, 'image.jpg');
      } else {
        const knowledgeRequest = {
          imageInfo: {
            url: imageUrl,
          },
        };
        formData.append('knowledgeRequest', JSON.stringify(knowledgeRequest));
      }

      const apiRes = await fetch('https://api.bing.microsoft.com/v7.0/images/visualsearch', {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': options.apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (apiRes.ok) {
        const data = await apiRes.json();
        const tags = data.tags || [];
        for (const tag of tags) {
          const actions = tag.actions || [];
          for (const action of actions) {
            const values = action.data?.value || [];
            for (const item of values) {
              const rawImgUrl = item.contentUrl || item.thumbnailUrl;
              if (rawImgUrl && !seenUrls.has(rawImgUrl)) {
                seenUrls.add(rawImgUrl);
                const upgraded = cleanAndUpgradeUrl(rawImgUrl);
                candidates.push({
                  url: upgraded,
                  pageUrl: item.hostPageUrl,
                  domain: extractDomain(item.hostPageUrl || upgraded),
                  title: item.name,
                  thumbnailUrl: item.thumbnailUrl,
                  width: item.width,
                  height: item.height,
                  sourceEngine: 'bing',
                });
              }
            }
          }
        }
        if (candidates.length > 0) return candidates;
      }
    } catch {
      // If API fails, fall back to free web visual search
    }
  }

  // Free Web Visual Search via Bing Reverse Image Search
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let bingSearchUrl: string;

    if (imageUrl.startsWith('data:')) {
      // Upload binary to Bing kblob endpoint to obtain an image URL or token
      try {
        const commaIdx = imageUrl.indexOf(',');
        const base64Data = commaIdx >= 0 ? imageUrl.substring(commaIdx + 1) : '';
        const mimeMatch = imageUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
        const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
        const buffer = Buffer.from(base64Data, 'base64');

        const kblobRes = await fetch('https://www.bing.com/images/kblob', {
          method: 'POST',
          headers: {
            'Content-Type': mimeType,
            'User-Agent': BROWSER_USER_AGENT,
            'Referer': 'https://www.bing.com/',
          },
          body: buffer,
          signal: controller.signal,
        });

        if (kblobRes.ok) {
          const kblobText = await kblobRes.text();
          const blobMatch =
            kblobText.match(/"blobId"\s*:\s*"([^"]+)"/) ||
            kblobText.match(/"imgurl"\s*:\s*"([^"]+)"/);
          if (blobMatch) {
            bingSearchUrl = `https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHSC&sbisrc=ImgBlob&imgurl=${encodeURIComponent(
              blobMatch[1]
            )}`;
          } else {
            clearTimeout(timeoutId);
            return candidates;
          }
        } else {
          clearTimeout(timeoutId);
          return candidates;
        }
      } catch {
        clearTimeout(timeoutId);
        return candidates;
      }
    } else {
      bingSearchUrl = `https://www.bing.com/images/search?view=detailv2&iss=sbi&FORM=SBIHSC&sbisrc=UrlPaste&q=imgurl:${encodeURIComponent(
        imageUrl
      )}`;
    }

    const res = await fetch(bingSearchUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return candidates;
    }

    const html = await res.text();

    // 1. Extract from elements with m="..." attributes using Cheerio
    const $ = cheerio.load(html);
    $('[m]').each((_, el) => {
      const rawAttr = $(el).attr('m');
      if (!rawAttr) return;

      try {
        let jsonStr = rawAttr.trim();
        if (!jsonStr.startsWith('{')) {
          jsonStr = `{${jsonStr}}`;
        }
        const meta = JSON.parse(jsonStr);

        if (meta.murl && typeof meta.murl === 'string') {
          const directUrl = meta.murl;
          if (!seenUrls.has(directUrl)) {
            seenUrls.add(directUrl);
            const upgraded = cleanAndUpgradeUrl(directUrl);
            candidates.push({
              url: upgraded,
              pageUrl: meta.purl,
              domain: extractDomain(meta.purl || upgraded),
              title: meta.t || meta.desc,
              thumbnailUrl: meta.turl,
              sourceEngine: 'bing',
            });
          }
        }
      } catch {
        // Continue to next element
      }
    });

    // 2. Also extract direct murl instances in HTML / scripts
    const murlRegex = /(?:&quot;|["'])murl(?:&quot;|["'])\s*:\s*(?:&quot;|["'])(https?:\\?\/\\?\/[^"'<>\s]+?)(?:&quot;|["'])/gi;
    let murlMatch: RegExpExecArray | null;
    while ((murlMatch = murlRegex.exec(html)) !== null) {
      const rawUrl = murlMatch[1]
        .replace(/\\u002f/gi, '/')
        .replace(/\\\//g, '/')
        .replace(/\\u0026/g, '&')
        .replace(/&amp;/gi, '&');
      if (!seenUrls.has(rawUrl)) {
        seenUrls.add(rawUrl);
        const upgraded = cleanAndUpgradeUrl(rawUrl);
        candidates.push({
          url: upgraded,
          domain: extractDomain(upgraded),
          sourceEngine: 'bing',
        });
      }
    }
  } catch {
    // Return whatever candidates were collected
  }

  return candidates;
}
