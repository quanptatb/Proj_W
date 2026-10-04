import { ExtractionResult } from '@/types';
import { detectSource } from '../utils';
import { extractPinterestImages } from './pinterest';
import { extractFacebookImages } from './facebook';
import { extractGenericWebImages } from './generic';

export async function extractImagesFromUrl(url: string): Promise<ExtractionResult> {
  const startTime = Date.now();
  const source = detectSource(url);

  let result: ExtractionResult;

  if (source === 'pinterest') {
    result = await extractPinterestImages(url);
  } else if (source === 'facebook') {
    result = await extractFacebookImages(url);
  } else {
    result = await extractGenericWebImages(url);
  }

  // If specialized extractor failed to find images, attempt generic extractor as graceful fallback
  if (!result.success && source !== 'generic') {
    const fallbackResult = await extractGenericWebImages(url);
    if (fallbackResult.success && fallbackResult.images.length > 0) {
      result = {
        ...fallbackResult,
        source, // preserve original source category
      };
    }
  }

  result.executionTimeMs = Date.now() - startTime;
  return result;
}

export * from './pinterest';
export * from './facebook';
export * from './generic';
