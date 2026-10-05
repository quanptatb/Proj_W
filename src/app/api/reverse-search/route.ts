import { NextRequest, NextResponse } from 'next/server';
import { performReverseImageSearch } from '@/lib/reverse-search';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl, currentWidth, currentHeight, apiKey, provider, maxResults } = body;

    if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Please provide a valid "imageUrl" parameter to search for higher resolution images.',
        },
        { status: 400 }
      );
    }

    const result = await performReverseImageSearch({
      imageUrl: imageUrl.trim(),
      currentWidth: typeof currentWidth === 'number' ? currentWidth : undefined,
      currentHeight: typeof currentHeight === 'number' ? currentHeight : undefined,
      apiKey: typeof apiKey === 'string' ? apiKey.trim() : undefined,
      provider: provider || 'auto',
      maxResults: typeof maxResults === 'number' ? maxResults : 30,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'An unexpected error occurred during reverse search.',
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const imageUrl = req.nextUrl.searchParams.get('imageUrl') || req.nextUrl.searchParams.get('url');
    const widthParam = req.nextUrl.searchParams.get('width');
    const heightParam = req.nextUrl.searchParams.get('height');
    const apiKey = req.nextUrl.searchParams.get('apiKey');
    const provider = req.nextUrl.searchParams.get('provider') as any;

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'Missing "imageUrl" query parameter.' },
        { status: 400 }
      );
    }

    const currentWidth = widthParam ? parseInt(widthParam, 10) : undefined;
    const currentHeight = heightParam ? parseInt(heightParam, 10) : undefined;

    const result = await performReverseImageSearch({
      imageUrl: imageUrl.trim(),
      currentWidth: !isNaN(currentWidth as number) ? currentWidth : undefined,
      currentHeight: !isNaN(currentHeight as number) ? currentHeight : undefined,
      apiKey: apiKey?.trim(),
      provider: provider || 'auto',
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'An unexpected error occurred during reverse search.',
      },
      { status: 500 }
    );
  }
}
