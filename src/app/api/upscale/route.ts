import { NextRequest, NextResponse } from 'next/server';
import { upscaleWithCloudAI } from '@/lib/enhancer/cloud-upscaler';
import { EnhancementOptions } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { image, options } = body as {
      image: string;
      options: EnhancementOptions;
    };

    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Missing image data (URL or Base64 data URI)' },
        { status: 400 }
      );
    }

    // If image passed was a relative or local proxy URL (e.g. /api/proxy-image?url=https%3A%2F%2F...),
    // unwrap the underlying target URL so cloud upscalers can access it directly.
    if (image.startsWith('/api/proxy') || image.includes('proxy-image?url=')) {
      try {
        const dummyUrl = new URL(image, 'http://localhost');
        const unwrapped = dummyUrl.searchParams.get('url');
        if (unwrapped) {
          image = unwrapped;
        }
      } catch {
        // keep as is
      }
    }

    if (!options?.cloudApiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing Cloud AI API Key' },
        { status: 400 }
      );
    }

    const result = await upscaleWithCloudAI(image, options);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred during cloud upscaling.',
      },
      { status: 500 }
    );
  }
}
