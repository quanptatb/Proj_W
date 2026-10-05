import { describe, it, expect, vi } from 'vitest';
import {
  parseImageDimensionsFromBuffer,
  formatResolutionLabel,
  probeImageResolution,
} from '../reverse-search/image-probe';
import { searchBingVisual } from '../reverse-search/engines/bing';
import { searchGoogleLens } from '../reverse-search/engines/google';
import { performReverseImageSearch } from '../reverse-search/index';

// Helpers to construct minimal valid binary image headers for testing
function createPngBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(33);
  // PNG signature
  buf.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A], 0);
  // IHDR chunk length = 13
  buf.writeUInt32BE(13, 8);
  // Chunk type = IHDR
  buf.set([0x49, 0x48, 0x44, 0x52], 12);
  // Width & Height
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  // Bit depth, color type, etc.
  buf.set([8, 2, 0, 0, 0], 24);
  return buf;
}

function createJpegBuffer(width: number, height: number): Buffer {
  // SOI (2 bytes) + SOF0 marker (0xFF, 0xC0) + length (0x00, 0x11) + precision (0x08) + height (2 bytes) + width (2 bytes)
  const buf = Buffer.alloc(17);
  buf[0] = 0xFF;
  buf[1] = 0xD8; // SOI
  buf[2] = 0xFF;
  buf[3] = 0xC0; // SOF0
  buf.writeUInt16BE(11, 4); // marker length
  buf[6] = 0x08; // precision
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  buf[11] = 0x03; // 3 components (Y, Cb, Cr)
  return buf;
}

function createGifBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(13);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function createBmpBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(30);
  buf.write('BM', 0, 'ascii');
  buf.writeUInt32LE(40, 14); // BITMAPINFOHEADER size
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(height, 22);
  return buf;
}

function createWebpVP8Buffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(24, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  buf.writeUInt32LE(12, 16);
  // Keyframe tag
  buf[20] = 0x00;
  buf[21] = 0x00;
  buf[22] = 0x00;
  // Start code: 0x9D 0x01 0x2A
  buf[23] = 0x9D;
  buf[24] = 0x01;
  buf[25] = 0x2A;
  buf.writeUInt16LE(width & 0x3FFF, 26);
  buf.writeUInt16LE(height & 0x3FFF, 28);
  return buf;
}

function createWebpVP8XBuffer(width: number, height: number): Buffer {
  const buf = Buffer.alloc(32);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(24, 4);
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8X', 12, 'ascii');
  buf.writeUInt32LE(10, 16);
  // Canvas width - 1 (24-bit LE)
  const wMinusOne = width - 1;
  buf[24] = wMinusOne & 0xFF;
  buf[25] = (wMinusOne >> 8) & 0xFF;
  buf[26] = (wMinusOne >> 16) & 0xFF;
  // Canvas height - 1 (24-bit LE)
  const hMinusOne = height - 1;
  buf[27] = hMinusOne & 0xFF;
  buf[28] = (hMinusOne >> 8) & 0xFF;
  buf[29] = (hMinusOne >> 16) & 0xFF;
  return buf;
}

describe('Fast Binary Header Dimension Parser', () => {
  it('correctly parses PNG dimensions', () => {
    const png = createPngBuffer(1920, 1080);
    const parsed = parseImageDimensionsFromBuffer(png);
    expect(parsed).toEqual({ width: 1920, height: 1080, format: 'png' });
  });

  it('correctly parses JPEG SOF0 baseline dimensions', () => {
    const jpeg = createJpegBuffer(3840, 2160);
    const parsed = parseImageDimensionsFromBuffer(jpeg);
    expect(parsed).toEqual({ width: 3840, height: 2160, format: 'jpg' });
  });

  it('correctly parses progressive JPEG (SOF2 marker)', () => {
    const buf = Buffer.alloc(20);
    buf[0] = 0xFF;
    buf[1] = 0xD8; // SOI
    // APP0
    buf[2] = 0xFF;
    buf[3] = 0xE0;
    buf.writeUInt16BE(4, 4); // len = 4 (includes 2 len bytes + 2 dummy)
    // SOF2 (progressive)
    buf[8] = 0xFF;
    buf[9] = 0xC2; // SOF2
    buf.writeUInt16BE(11, 10);
    buf[12] = 0x08; // precision
    buf.writeUInt16BE(1440, 13); // height
    buf.writeUInt16BE(2560, 15); // width
    const parsed = parseImageDimensionsFromBuffer(buf);
    expect(parsed).toEqual({ width: 2560, height: 1440, format: 'jpg' });
  });

  it('correctly parses GIF89a dimensions', () => {
    const gif = createGifBuffer(800, 600);
    const parsed = parseImageDimensionsFromBuffer(gif);
    expect(parsed).toEqual({ width: 800, height: 600, format: 'gif' });
  });

  it('correctly parses BMP dimensions', () => {
    const bmp = createBmpBuffer(1024, 768);
    const parsed = parseImageDimensionsFromBuffer(bmp);
    expect(parsed).toEqual({ width: 1024, height: 768, format: 'bmp' });
  });

  it('correctly parses WebP lossy (VP8) dimensions', () => {
    const webp = createWebpVP8Buffer(1280, 720);
    const parsed = parseImageDimensionsFromBuffer(webp);
    expect(parsed).toEqual({ width: 1280, height: 720, format: 'webp' });
  });

  it('correctly parses WebP extended (VP8X) dimensions', () => {
    const webpX = createWebpVP8XBuffer(4096, 2160);
    const parsed = parseImageDimensionsFromBuffer(webpX);
    expect(parsed).toEqual({ width: 4096, height: 2160, format: 'webp' });
  });

  it('correctly parses SVG viewBox or width/height attributes', () => {
    const svgStr = '<svg viewBox="0 0 1600 900" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%"/></svg>';
    const parsed = parseImageDimensionsFromBuffer(Buffer.from(svgStr, 'utf-8'));
    expect(parsed).toEqual({ width: 1600, height: 900, format: 'svg' });
  });

  it('correctly parses SVG with comma-separated viewBox coordinates', () => {
    const svgComma = '<svg viewBox="0, 0, 1920, 1080" xmlns="http://www.w3.org/2000/svg"></svg>';
    const parsed = parseImageDimensionsFromBuffer(Buffer.from(svgComma, 'utf-8'));
    expect(parsed).toEqual({ width: 1920, height: 1080, format: 'svg' });
  });

  it('gracefully returns null for truncated or corrupted buffers', () => {
    expect(parseImageDimensionsFromBuffer(Buffer.alloc(0))).toBeNull();
    expect(parseImageDimensionsFromBuffer(Buffer.from('not an image at all'))).toBeNull();
    expect(parseImageDimensionsFromBuffer(Buffer.from([0xFF, 0xD8, 0x00]))).toBeNull();
  });

  it('terminates safely without infinite loop on corrupted JPEG buffer with zero marker length', () => {
    const corruptedBuf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00]);
    const parsed = parseImageDimensionsFromBuffer(corruptedBuf);
    expect(parsed).toBeNull();
  });
});

describe('Resolution Label Formatter', () => {
  it('formats labels according to industry standards', () => {
    expect(formatResolutionLabel(3840, 2160)).toBe('4K Ultra HD');
    expect(formatResolutionLabel(4096, 2160)).toBe('4K Ultra HD');
    expect(formatResolutionLabel(2560, 1440)).toBe('2K QHD');
    expect(formatResolutionLabel(1920, 1080)).toBe('1080p Full HD');
    expect(formatResolutionLabel(1280, 720)).toBe('720p HD');
    expect(formatResolutionLabel(800, 600)).toBe('High Res');
    expect(formatResolutionLabel(500, 300)).toBe('500×300');
    expect(formatResolutionLabel(0, 0)).toBe('HD Original');
  });
});

describe('Fast Header / Range Prober', () => {
  it('probes dimensions and size from base64 data URIs locally without network', async () => {
    const pngBuf = createPngBuffer(1920, 1080);
    const dataUri = `data:image/png;base64,${pngBuf.toString('base64')}`;

    const res = await probeImageResolution(dataUri);
    expect(res.width).toBe(1920);
    expect(res.height).toBe(1080);
    expect(res.format).toBe('png');
    expect(res.resolutionLabel).toBe('1080p Full HD');
    expect(res.fileSizeBytes).toBe(pngBuf.length);
  });

  it('probes dimensions using HTTP 206 Partial Content Range header', async () => {
    const jpegBuf = createJpegBuffer(3840, 2160);
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: any) => {
      // Check that Range header was sent
      expect(init?.headers?.Range).toBe('bytes=0-32767');

      return new Response(new Uint8Array(jpegBuf), {
        status: 206,
        statusText: 'Partial Content',
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Range': 'bytes 0-32767/5242880', // 5MB total size
        },
      });
    }) as any;

    try {
      const res = await probeImageResolution('https://cdn.example.com/wallpaper.jpg');
      expect(res.width).toBe(3840);
      expect(res.height).toBe(2160);
      expect(res.format).toBe('jpg');
      expect(res.fileSizeBytes).toBe(5242880);
      expect(res.resolutionLabel).toBe('4K Ultra HD');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles stream reading when upstream ignores Range and returns 200 OK', async () => {
    const pngBuf = createPngBuffer(2560, 1440);
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(new Uint8Array(pngBuf), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '2048000',
        },
      });
    }) as any;

    try {
      const res = await probeImageResolution('https://cdn.example.com/asset.png');
      expect(res.width).toBe(2560);
      expect(res.height).toBe(1440);
      expect(res.fileSizeBytes).toBe(2048000);
      expect(res.resolutionLabel).toBe('2K QHD');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('falls back to stream chunk probe when Range request returns 403 Forbidden', async () => {
    const pngBuf = createPngBuffer(1920, 1080);
    const originalFetch = global.fetch;

    global.fetch = vi.fn().mockImplementation(async (_url: string, init?: any) => {
      // If Range header is sent, return 403 Forbidden (simulating anti-range CDN)
      if (init?.headers?.Range) {
        return new Response('Forbidden', { status: 403, statusText: 'Forbidden' });
      }
      // Fallback clean GET without Range succeeds
      return new Response(new Uint8Array(pngBuf), {
        status: 200,
        headers: {
          'Content-Type': 'image/png',
          'Content-Length': '1048576',
        },
      });
    }) as any;

    try {
      const res = await probeImageResolution('https://cdn.example.com/protected.png');
      expect(res.width).toBe(1920);
      expect(res.height).toBe(1080);
      expect(res.fileSizeBytes).toBe(1048576);
      expect(res.resolutionLabel).toBe('1080p Full HD');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('gracefully handles network errors and 404', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response('Not Found', { status: 404, statusText: 'Not Found' });
    }) as any;

    try {
      const res = await probeImageResolution('https://cdn.example.com/missing.jpg');
      expect(res.error).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Reverse Search Engines', () => {
  it('extracts candidates from Bing Visual Search HTML and upgrades Pinterest/Facebook/Wordpress CDN URLs', async () => {
    const fakeBingHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <!-- Match 1: Pinterest 236x thumb which should upgrade to originals -->
          <a class="iusc" m="&quot;murl&quot;:&quot;https://i.pinimg.com/236x/ab/cd/ef.jpg&quot;,&quot;purl&quot;:&quot;https://pinterest.com/pin/123&quot;,&quot;t&quot;:&quot;Anime Wallpaper 4K&quot;"></a>
          <!-- Match 2: WordPress 300x200 thumb which should upgrade to clean master -->
          <div data-rel="thumb" m='{"murl":"https://hdwallpapers.net/wp-content/uploads/2024/bg-300x200.jpg","purl":"https://hdwallpapers.net/bg","t":"Nature Landscape"}'></div>
        </body>
      </html>
    `;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('bing.com')) {
        return new Response(fakeBingHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
      }
      return originalFetch(url);
    }) as any;

    try {
      const candidates = await searchBingVisual('https://example.com/seed.jpg');
      expect(candidates.length).toBe(2);

      // Verify Pinterest upgraded to originals
      expect(candidates[0].url).toBe('https://i.pinimg.com/originals/ab/cd/ef.jpg');
      expect(candidates[0].domain).toBe('pinterest.com');
      expect(candidates[0].title).toBe('Anime Wallpaper 4K');

      // Verify WordPress -300x200 stripped to master
      expect(candidates[1].url).toBe('https://hdwallpapers.net/wp-content/uploads/2024/bg.jpg');
      expect(candidates[1].domain).toBe('hdwallpapers.net');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('correctly extracts Bing candidates with query parameters containing &', async () => {
    const fakeHtmlWithQuery = `
      <html>
        <body>
          <div m='{"murl":"https://images.unsplash.com/photo-123?w=1920&q=80","purl":"https://unsplash.com","t":"Unsplash HD"}'></div>
        </body>
      </html>
    `;
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(fakeHtmlWithQuery, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }) as any;

    try {
      const candidates = await searchBingVisual('https://example.com/seed.jpg');
      expect(candidates.length).toBe(1);
      expect(candidates[0].url).toContain('https://images.unsplash.com/photo-123');
      expect(candidates[0].domain).toBe('unsplash.com');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('supports SerpApi Google Lens results when API key is provided', async () => {
    const fakeSerpApiData = {
      visual_matches: [
        {
          title: 'Master Art 4K',
          link: 'https://artstation.com/artwork/xyz',
          source: 'ArtStation',
          original_image: 'https://cdna.artstation.com/p/assets/images/master.jpg',
          thumbnail: 'https://cdna.artstation.com/p/assets/images/thumb.jpg',
        },
      ],
    };

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('serpapi.com')) {
        return new Response(JSON.stringify(fakeSerpApiData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return originalFetch(url);
    }) as any;

    try {
      const candidates = await searchGoogleLens('https://example.com/seed.jpg', {
        apiKey: 'fake_serp_key',
      });
      expect(candidates.length).toBe(1);
      expect(candidates[0].url).toBe('https://cdna.artstation.com/p/assets/images/master.jpg');
      expect(candidates[0].domain).toBe('artstation.com');
      expect(candidates[0].title).toBe('Master Art 4K');
      expect(candidates[0].sourceEngine).toBe('serpapi');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('extracts Google Lens free scraper candidates with JSON-escaped slashes and entities', async () => {
    const fakeLensHtml = `
      <html>
        <script>
          AF_initDataCallback({
            data: [
              "\"https:\\/\\/images.pexels.com\\/photos\\/123\\/nature.jpg?auto=compress&amp;cs=tinysrgb\"",
              1920,
              1080
            ]
          });
        </script>
      </html>
    `;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async () => {
      return new Response(fakeLensHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
    }) as any;

    try {
      const candidates = await searchGoogleLens('https://example.com/seed.jpg');
      expect(candidates.length).toBe(1);
      expect(candidates[0].url).toContain('https://images.pexels.com/photos/123/nature.jpg');
      expect(candidates[0].domain).toBe('images.pexels.com');
      expect(candidates[0].sourceEngine).toBe('google');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Reverse Search Orchestration & Ranking', () => {
  it('deduplicates, probes, filters lower resolution, and sorts higher res candidates first', async () => {
    const originalFetch = global.fetch;

    const fakeBingHtml = `
      <div m='{"murl":"https://hdqwalls.com/download/ultra-4k.jpg","purl":"https://hdqwalls.com/ultra","t":"4K Ultra Version"}'></div>
      <div m='{"murl":"https://example.com/medium-2k.jpg","purl":"https://example.com/2k","t":"2K QHD Version"}'></div>
      <div m='{"murl":"https://example.com/low-res.jpg","purl":"https://example.com/low","t":"Low Thumbnail"}'></div>
    `;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string') {
        if (url.includes('bing.com')) {
          return new Response(fakeBingHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
        if (url.includes('ultra-4k.jpg')) {
          const buf = createJpegBuffer(3840, 2160);
          return new Response(new Uint8Array(buf), { status: 206, headers: { 'Content-Range': 'bytes 0-16/4000000' } });
        }
        if (url.includes('medium-2k.jpg')) {
          const buf = createJpegBuffer(2560, 1440);
          return new Response(new Uint8Array(buf), { status: 206, headers: { 'Content-Range': 'bytes 0-16/2000000' } });
        }
        if (url.includes('low-res.jpg')) {
          const buf = createJpegBuffer(640, 480);
          return new Response(new Uint8Array(buf), { status: 206, headers: { 'Content-Range': 'bytes 0-16/100000' } });
        }
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    try {
      // Original image is 1920x1080 (Full HD, 2.07 Megapixels)
      const response = await performReverseImageSearch({
        imageUrl: 'https://example.com/my-original-photo.jpg',
        currentWidth: 1920,
        currentHeight: 1080,
        provider: 'bing',
      });

      expect(response.success).toBe(true);
      expect(response.originalImage.width).toBe(1920);
      expect(response.originalImage.height).toBe(1080);
      expect(response.originalImage.resolutionLabel).toBe('1080p Full HD');

      // Found 3 candidates
      expect(response.totalFound).toBe(3);
      // 2 candidates are strictly higher resolution (4K and 2K)
      expect(response.higherResCount).toBe(2);

      // Check ranking order: 4K (3840x2160) first, then 2K (2560x1440), then low-res (640x480)
      expect(response.results[0].width).toBe(3840);
      expect(response.results[0].height).toBe(2160);
      expect(response.results[0].resolutionLabel).toBe('4K Ultra HD');
      expect(response.results[0].isHigherRes).toBe(true);
      expect(response.results[0].multiplier).toBe(4); // 4x pixels of 1080p

      expect(response.results[1].width).toBe(2560);
      expect(response.results[1].height).toBe(1440);
      expect(response.results[1].resolutionLabel).toBe('2K QHD');
      expect(response.results[1].isHigherRes).toBe(true);
      expect(response.results[1].multiplier).toBe(1.8);

      expect(response.results[2].width).toBe(640);
      expect(response.results[2].height).toBe(480);
      expect(response.results[2].isHigherRes).toBe(false);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('unwraps proxied image URLs before performing reverse search', async () => {
    const originalFetch = global.fetch;
    let fetchedUrl = '';

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      fetchedUrl = url;
      return new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    }) as any;

    try {
      const proxied = '/api/proxy-image?url=https%3A%2F%2Fcdn.example.com%2Ftarget.jpg';
      await performReverseImageSearch({
        imageUrl: proxied,
        currentWidth: 800,
        currentHeight: 600,
        provider: 'bing',
      });

      // Confirm the underlying target was passed to the search engine, not the /api/proxy url
      expect(fetchedUrl).toContain('https%3A%2F%2Fcdn.example.com%2Ftarget.jpg');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('gracefully handles images with unknown baseline dimensions without hiding candidates', async () => {
    const originalFetch = global.fetch;

    const fakeBingHtml = `
      <div m='{"murl":"https://hdqwalls.com/download/hd-master.jpg","purl":"https://hdqwalls.com/hd","t":"HD Master Version"}'></div>
    `;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string') {
        if (url.includes('bing.com')) {
          return new Response(fakeBingHtml, { status: 200, headers: { 'Content-Type': 'text/html' } });
        }
        if (url.includes('hd-master.jpg')) {
          const buf = createJpegBuffer(1920, 1080);
          return new Response(new Uint8Array(buf), { status: 206, headers: { 'Content-Range': 'bytes 0-16/2000000' } });
        }
      }
      return new Response('Not found', { status: 404 });
    }) as any;

    try {
      // Original image without width/height and cannot be probed
      const res = await performReverseImageSearch({
        imageUrl: 'https://example.com/unreachable-original.jpg',
        provider: 'bing',
      });

      expect(res.success).toBe(true);
      expect(res.results.length).toBe(1);
      // Valid HD candidate is retained and marked as higher resolution candidate so it is visible to user
      expect(res.results[0].isHigherRes).toBe(true);
      expect(res.results[0].width).toBe(1920);
      expect(res.results[0].height).toBe(1080);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles empty image URL with informative error', async () => {
    const res = await performReverseImageSearch({ imageUrl: '' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/required/i);
  });
});
