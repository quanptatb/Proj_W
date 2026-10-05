/**
 * Fast Header & Range Prober for Web Images
 * Inspects binary image headers (JPEG, PNG, GIF, WebP, BMP, AVIF, SVG)
 * using HTTP Range requests (bytes 0-32767) to extract exact dimensions,
 * file size, and format without downloading entire multi-megabyte files.
 */

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export interface ProbedDimensions {
  width: number;
  height: number;
  format: string;
}

export interface ImageProbeResult {
  width?: number;
  height?: number;
  fileSizeBytes?: number;
  format?: string;
  resolutionLabel?: string;
  error?: string;
}

/**
 * Parses binary buffer to extract width, height, and format.
 * Supports JPEG, PNG, GIF, WebP (VP8, VP8L, VP8X), BMP, AVIF, HEIC, SVG.
 */
export function parseImageDimensionsFromBuffer(buffer: Buffer | Uint8Array): ProbedDimensions | null {
  if (!buffer || buffer.length < 8) return null;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  // 1. PNG check: 8-byte signature: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4E &&
    buf[3] === 0x47 &&
    buf[4] === 0x0D &&
    buf[5] === 0x0A &&
    buf[6] === 0x1A &&
    buf[7] === 0x0A
  ) {
    if (buf.length >= 24) {
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width > 0 && height > 0) {
        return { width, height, format: 'png' };
      }
    }
    return null;
  }

  // 2. JPEG check: SOI marker 0xFF, 0xD8
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let offset = 2;
    while (offset < buf.length) {
      if (buf[offset] !== 0xFF) {
        offset++;
        continue;
      }
      while (offset < buf.length && buf[offset] === 0xFF) {
        offset++;
      }
      if (offset >= buf.length) break;

      const marker = buf[offset++];
      // End Of Image (0xD9) or Start Of Scan (0xDA)
      if (marker === 0xD9 || marker === 0xDA) break;
      // Restart markers (0xD0..0xD7) have no payload length
      if (marker >= 0xD0 && marker <= 0xD7) continue;

      if (offset + 2 > buf.length) break;
      const markerLength = buf.readUInt16BE(offset);
      if (markerLength < 2) break;

      // Start Of Frame markers:
      // 0xC0 (SOF0), 0xC1 (SOF1), 0xC2 (SOF2), 0xC3 (SOF3), 0xC5 (SOF5), 0xC6 (SOF6), 0xC7 (SOF7),
      // 0xC9 (SOF9), 0xCA (SOF10), 0xCB (SOF11), 0xCD (SOF13), 0xCE (SOF14), 0xCF (SOF15)
      const isSof = [
        0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
        0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF,
      ].includes(marker);

      if (isSof && offset + 7 <= buf.length) {
        const height = buf.readUInt16BE(offset + 3);
        const width = buf.readUInt16BE(offset + 5);
        if (width > 0 && height > 0) {
          return { width, height, format: 'jpg' };
        }
      }

      offset += markerLength;
    }
    return null;
  }

  // 3. GIF check: GIF87a or GIF89a
  if (
    buf[0] === 0x47 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x38 &&
    (buf[4] === 0x37 || buf[4] === 0x39) &&
    buf[5] === 0x61
  ) {
    if (buf.length >= 10) {
      const width = buf.readUInt16LE(6);
      const height = buf.readUInt16LE(8);
      if (width > 0 && height > 0) {
        return { width, height, format: 'gif' };
      }
    }
    return null;
  }

  // 4. WebP check: RIFF at 0..3 and WEBP at 8..11
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf.length >= 16 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    const chunkType = buf.toString('ascii', 12, 16);
    // Lossy VP8
    if (chunkType === 'VP8 ') {
      if (buf.length >= 30 && buf[23] === 0x9D && buf[24] === 0x01 && buf[25] === 0x2A) {
        const width = buf.readUInt16LE(26) & 0x3FFF;
        const height = buf.readUInt16LE(28) & 0x3FFF;
        if (width > 0 && height > 0) {
          return { width, height, format: 'webp' };
        }
      }
    }
    // Lossless VP8L
    else if (chunkType === 'VP8L') {
      if (buf.length >= 25 && buf[20] === 0x2F) {
        const b0 = buf[21];
        const b1 = buf[22];
        const b2 = buf[23];
        const b3 = buf[24];
        const width = 1 + (((b1 & 0x3F) << 8) | b0);
        const height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
        if (width > 0 && height > 0) {
          return { width, height, format: 'webp' };
        }
      }
    }
    // Extended VP8X
    else if (chunkType === 'VP8X') {
      if (buf.length >= 30) {
        const width = 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16));
        const height = 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16));
        if (width > 0 && height > 0) {
          return { width, height, format: 'webp' };
        }
      }
    }
    return null;
  }

  // 5. BMP check: BM (0x42, 0x4D)
  if (buf[0] === 0x42 && buf[1] === 0x4D && buf.length >= 26) {
    const headerSize = buf.readUInt32LE(14);
    if (headerSize === 12 && buf.length >= 22) {
      const width = buf.readUInt16LE(18);
      const height = buf.readUInt16LE(20);
      if (width > 0 && height > 0) {
        return { width, height, format: 'bmp' };
      }
    } else if (headerSize >= 12 && buf.length >= 26) {
      const width = Math.abs(buf.readInt32LE(18));
      const height = Math.abs(buf.readInt32LE(22));
      if (width > 0 && height > 0) {
        return { width, height, format: 'bmp' };
      }
    }
    return null;
  }

  // 6. AVIF / HEIC / ISOBMFF check
  if (buf.length >= 16) {
    const ftyp = buf.toString('ascii', 4, 8);
    if (ftyp === 'ftyp') {
      const brand = buf.toString('ascii', 8, 12);
      if (/avif|avis|mif1|msf1|heic|heix/i.test(brand)) {
        // Search for 'ispe' box (Image Spatial Extents)
        for (let i = 12; i <= buf.length - 16; i++) {
          if (
            buf[i] === 0x69 &&
            buf[i + 1] === 0x73 &&
            buf[i + 2] === 0x70 &&
            buf[i + 3] === 0x65
          ) {
            const width = buf.readUInt32BE(i + 8);
            const height = buf.readUInt32BE(i + 12);
            if (width > 0 && height > 0 && width < 100000 && height < 100000) {
              return { width, height, format: brand.toLowerCase().startsWith('heic') ? 'heic' : 'avif' };
            }
          }
        }
      }
    }
  }

  // 7. SVG check (text/xml)
  const prefix = buf.subarray(0, Math.min(buf.length, 4096)).toString('utf-8').trim();
  if (prefix.includes('<svg') || (prefix.startsWith('<?xml') && prefix.includes('<svg'))) {
    const viewBoxMatch = prefix.match(/viewBox=["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i);
    if (viewBoxMatch) {
      const width = Math.round(parseFloat(viewBoxMatch[1]));
      const height = Math.round(parseFloat(viewBoxMatch[2]));
      if (width > 0 && height > 0) {
        return { width, height, format: 'svg' };
      }
    }
    const widthMatch = prefix.match(/width=["']([\d.]+)p?x?["']/i);
    const heightMatch = prefix.match(/height=["']([\d.]+)p?x?["']/i);
    if (widthMatch && heightMatch) {
      const width = Math.round(parseFloat(widthMatch[1]));
      const height = Math.round(parseFloat(heightMatch[1]));
      if (width > 0 && height > 0) {
        return { width, height, format: 'svg' };
      }
    }
  }

  return null;
}

/**
 * Returns user-friendly resolution label based on dimensions
 */
export function formatResolutionLabel(width: number, height: number): string {
  if (!width || !height) return 'HD Original';
  const maxDim = Math.max(width, height);
  const minDim = Math.min(width, height);

  if (maxDim >= 3840 || minDim >= 2160) {
    return '4K Ultra HD';
  }
  if (maxDim >= 2560 || minDim >= 1440) {
    return '2K QHD';
  }
  if (maxDim >= 1920 || minDim >= 1080) {
    return '1080p Full HD';
  }
  if (maxDim >= 1280 || minDim >= 720) {
    return '720p HD';
  }
  if (maxDim >= 800 || minDim >= 600) {
    return 'High Res';
  }
  return `${width}×${height}`;
}

/**
 * Sends a fast Range HTTP request (bytes 0-32767) to probe image dimensions
 * and file size without downloading the entire file.
 */
export async function probeImageResolution(
  urlOrDataUri: string,
  timeoutMs = 5000
): Promise<ImageProbeResult> {
  if (!urlOrDataUri) {
    return { error: 'Empty image URL' };
  }

  // Handle data URIs locally without network call
  if (urlOrDataUri.startsWith('data:')) {
    try {
      const match = urlOrDataUri.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (!match) {
        return { error: 'Invalid data URI format' };
      }
      const rawBuf = Buffer.from(match[2], 'base64');
      const dimensions = parseImageDimensionsFromBuffer(rawBuf);
      if (!dimensions) {
        return {
          fileSizeBytes: rawBuf.length,
          format: match[1],
          error: 'Could not parse dimensions from data URI buffer',
        };
      }
      return {
        width: dimensions.width,
        height: dimensions.height,
        format: dimensions.format,
        fileSizeBytes: rawBuf.length,
        resolutionLabel: formatResolutionLabel(dimensions.width, dimensions.height),
      };
    } catch (e: any) {
      return { error: e.message || 'Failed to decode data URI' };
    }
  }

  // Fetch using Range request
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlOrDataUri);
    } catch {
      clearTimeout(timeoutId);
      return { error: 'Invalid URL' };
    }

    let referer = `${parsedUrl.protocol}//${parsedUrl.hostname}/`;
    if (parsedUrl.hostname.includes('pinimg.com')) {
      referer = 'https://www.pinterest.com/';
    } else if (parsedUrl.hostname.includes('fbcdn.net') || parsedUrl.hostname.includes('fbsbx.com')) {
      referer = 'https://www.facebook.com/';
    }

    const headers: Record<string, string> = {
      'User-Agent': BROWSER_USER_AGENT,
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Range': 'bytes=0-32767',
      'Referer': referer,
    };

    let res: Response;
    try {
      res = await fetch(urlOrDataUri, {
        headers,
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      return { error: fetchErr.name === 'AbortError' ? 'Probe timeout' : fetchErr.message };
    }

    clearTimeout(timeoutId);

    // Extract total file size from Content-Range or Content-Length
    let totalSizeBytes: number | undefined;
    const contentRange = res.headers.get('content-range');
    if (contentRange) {
      const match = contentRange.match(/\/(\d+)$/);
      if (match) {
        totalSizeBytes = parseInt(match[1], 10);
      }
    }
    if (!totalSizeBytes) {
      const cl = res.headers.get('content-length');
      if (cl) {
        totalSizeBytes = parseInt(cl, 10);
      }
    }

    // If Range request was rejected with 416 (Range Not Satisfiable), 403, 405, or 400,
    // try graceful stream GET fallback without Range header
    if (!res.ok && res.status !== 206) {
      if (res.status === 416 || res.status === 405 || res.status === 400 || res.status === 403) {
        return await probeViaStreamChunk(urlOrDataUri, referer, timeoutMs);
      }
      return { error: `HTTP ${res.status}: ${res.statusText}` };
    }

    let buffer: Buffer;

    // If server responded with 206 Partial Content, the body is already limited to 32KB
    if (res.status === 206) {
      const arrayBuf = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuf);
    } else {
      // Server returned 200 OK (ignored Range header).
      // Stream-read only the first 64KB and cancel stream immediately to avoid downloading full file.
      if (res.body) {
        const reader = res.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytesRead = 0;
        try {
          while (bytesRead < 65536) {
            const { done, value } = await reader.read();
            if (done || !value) break;
            chunks.push(value);
            bytesRead += value.length;
          }
        } finally {
          try {
            await reader.cancel();
          } catch {
            // ignore
          }
        }
        buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
      } else {
        const arrayBuf = await res.arrayBuffer();
        buffer = Buffer.from(arrayBuf);
      }
    }

    const dimensions = parseImageDimensionsFromBuffer(buffer);

    if (dimensions) {
      return {
        width: dimensions.width,
        height: dimensions.height,
        format: dimensions.format,
        fileSizeBytes: totalSizeBytes || buffer.length,
        resolutionLabel: formatResolutionLabel(dimensions.width, dimensions.height),
      };
    }

    // If dimensions could not be read within the first chunk (rare for progressive JPEG),
    // try streaming up to 128KB
    return await probeViaStreamChunk(urlOrDataUri, referer, timeoutMs, 131072);
  } catch (err: any) {
    return { error: err.message || 'Probe failed' };
  }
}

/**
 * Fallback streaming probe that reads only the first N bytes from the HTTP response stream
 * and immediately closes/cancels the stream to prevent full file download.
 */
async function probeViaStreamChunk(
  url: string,
  referer: string,
  timeoutMs = 5000,
  maxBytes = 65536
): Promise<ImageProbeResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': referer,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { error: `HTTP ${res.status}: ${res.statusText}` };
    }

    const cl = res.headers.get('content-length');
    const totalSizeBytes = cl ? parseInt(cl, 10) : undefined;

    if (!res.body) {
      const ab = await res.arrayBuffer();
      const buf = Buffer.from(ab);
      const dims = parseImageDimensionsFromBuffer(buf);
      if (!dims) return { error: 'Unknown image format or unparseable buffer' };
      return {
        width: dims.width,
        height: dims.height,
        format: dims.format,
        fileSizeBytes: totalSizeBytes || buf.length,
        resolutionLabel: formatResolutionLabel(dims.width, dims.height),
      };
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytesRead = 0;

    try {
      while (bytesRead < maxBytes) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        chunks.push(value);
        bytesRead += value.length;
      }
    } finally {
      // Abort/cancel reader to stop further network download
      try {
        await reader.cancel();
      } catch {
        // ignore
      }
    }

    const combinedBuffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    const dims = parseImageDimensionsFromBuffer(combinedBuffer);

    if (!dims) {
      return { error: 'Could not extract dimensions from image stream' };
    }

    return {
      width: dims.width,
      height: dims.height,
      format: dims.format,
      fileSizeBytes: totalSizeBytes || combinedBuffer.length,
      resolutionLabel: formatResolutionLabel(dims.width, dims.height),
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return { error: err.name === 'AbortError' ? 'Probe timeout' : err.message };
  }
}
