import { NextRequest, NextResponse } from 'next/server';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');
  const fallbackUrl = req.nextUrl.searchParams.get('fallback');
  let filename = req.nextUrl.searchParams.get('filename') || 'image_hd.jpg';

  if (!targetUrl) {
    return new NextResponse('Missing "url" parameter', { status: 400 });
  }

  // Format RFC 5987 / RFC 6266 compliant Content-Disposition
  // ASCII fallback for older clients + UTF-8 encoded filename for modern browsers
  const asciiFallback = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\r\n\/\\]/g, '_');
  const utf8Encoded = encodeURIComponent(filename.replace(/[\r\n\/\\]/g, '_'));
  const contentDisposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`;

  const fetchAsset = async (fetchUrl: string) => {
    const parsed = new URL(fetchUrl);
    let referer = `${parsed.protocol}//${parsed.hostname}/`;

    if (parsed.hostname.includes('pinimg.com')) {
      referer = 'https://www.pinterest.com/';
    } else if (parsed.hostname.includes('fbcdn.net') || parsed.hostname.includes('fbsbx.com')) {
      referer = 'https://www.facebook.com/';
    }

    return fetch(fetchUrl, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        'Referer': referer,
        'Accept': 'image/*,*/*;q=0.8',
      },
    });
  };

  try {
    let response: Response;
    try {
      response = await fetchAsset(targetUrl);
    } catch {
      if (fallbackUrl) {
        response = await fetchAsset(fallbackUrl);
      } else {
        throw new Error('Failed to reach upstream server.');
      }
    }

    // If upstream returns 403 or 404 and we have a fallback URL (e.g. Facebook HMAC signature or Pinterest originals)
    if (!response.ok && fallbackUrl && fallbackUrl !== targetUrl) {
      const fallbackResponse = await fetchAsset(fallbackUrl);
      if (fallbackResponse.ok) {
        response = fallbackResponse;
      }
    }

    if (!response.ok) {
      return new NextResponse(`Upstream returned ${response.status}`, {
        status: response.status,
      });
    }

    let contentType = response.headers.get('content-type') || 'image/jpeg';

    // Verify valid image format
    if (!contentType.startsWith('image/') || contentType.includes('keyframes')) {
      if (fallbackUrl && fallbackUrl !== targetUrl) {
        const fallbackResponse = await fetchAsset(fallbackUrl);
        const fbContentType = fallbackResponse.headers.get('content-type') || '';
        if (
          fallbackResponse.ok &&
          fbContentType.startsWith('image/') &&
          !fbContentType.includes('keyframes')
        ) {
          response = fallbackResponse;
          contentType = fbContentType;
        } else {
          return new NextResponse('Asset is not a valid downloadable image.', { status: 415 });
        }
      } else {
        return new NextResponse('Asset is not a valid downloadable image.', { status: 415 });
      }
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || 'Failed to proxy download', {
      status: 500,
    });
  }
}
