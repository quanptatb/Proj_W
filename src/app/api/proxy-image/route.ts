import { NextRequest, NextResponse } from 'next/server';

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function GET(req: NextRequest) {
  const targetUrl = req.nextUrl.searchParams.get('url');
  const fallbackUrl = req.nextUrl.searchParams.get('fallback');

  if (!targetUrl) {
    return new NextResponse('Missing "url" query parameter', { status: 400 });
  }

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
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
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

    // Fallback if upstream returns 403 or 404 (e.g. Facebook signed CDN or Pinterest missing /originals/)
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

    // Verify that upstream returned a genuine renderable image format
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
          return new NextResponse('Upstream asset is not a valid displayable image format.', {
            status: 415,
          });
        }
      } else {
        return new NextResponse('Upstream asset is not a valid displayable image format.', {
          status: 415,
        });
      }
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=604800, immutable',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message || 'Failed to fetch proxy image', {
      status: 500,
    });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': '*',
    },
  });
}
