import { NextRequest, NextResponse } from 'next/server';
import { extractImagesFromUrl } from '@/lib/extractors';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid URL to extract images from.' },
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();
    const result = await extractImagesFromUrl(trimmedUrl);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'An unexpected error occurred during extraction.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const urlParam = req.nextUrl.searchParams.get('url');
  if (!urlParam) {
    return NextResponse.json(
      { success: false, error: 'Missing "url" query parameter.' },
      { status: 400 }
    );
  }

  const result = await extractImagesFromUrl(urlParam);
  return NextResponse.json(result);
}
