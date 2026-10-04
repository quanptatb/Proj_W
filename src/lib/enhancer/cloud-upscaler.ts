import { EnhancementOptions } from '@/types';

export interface CloudUpscaleResult {
  success: boolean;
  outputUrl?: string;
  error?: string;
}

export async function upscaleWithCloudAI(
  imageDataUriOrUrl: string,
  options: EnhancementOptions
): Promise<CloudUpscaleResult> {
  const apiKey = options.cloudApiKey?.trim();
  if (!apiKey) {
    return {
      success: false,
      error: 'Please provide an API Key for Cloud AI processing (Replicate or Hugging Face).',
    };
  }

  const provider = options.cloudProvider || 'replicate';

  if (provider === 'replicate') {
    return runReplicateUpscaler(imageDataUriOrUrl, apiKey, options);
  } else if (provider === 'huggingface') {
    return runHuggingFaceUpscaler(imageDataUriOrUrl, apiKey, options);
  }

  return {
    success: false,
    error: `Unsupported cloud provider: ${provider}`,
  };
}

async function runReplicateUpscaler(
  imageUrl: string,
  apiKey: string,
  options: EnhancementOptions
): Promise<CloudUpscaleResult> {
  try {
    // Replicate Real-ESRGAN version
    const version = '42fed1c497414674d521110b5734c5aa75b94e394dda08f4d60c83874d578fa0';

    const response = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version,
        input: {
          image: imageUrl,
          scale: options.scale || 2,
          face_enhance: options.faceEnhance || false,
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        success: false,
        error: `Replicate API error (${response.status}): ${errText}`,
      };
    }

    const prediction = await response.json();
    let getUrl = prediction.urls?.get;

    if (!getUrl) {
      return {
        success: false,
        error: 'Replicate did not return a valid polling URL.',
      };
    }

    // Poll for prediction completion (Replicate predictions are asynchronous)
    const startTime = Date.now();
    while (Date.now() - startTime < 60000) {
      await new Promise((r) => setTimeout(r, 2000));
      const pollRes = await fetch(getUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!pollRes.ok) {
        throw new Error(`Failed to check prediction status: ${pollRes.statusText}`);
      }

      const pollData = await pollRes.json();
      if (pollData.status === 'succeeded') {
        const outUrl = typeof pollData.output === 'string' ? pollData.output : pollData.output?.[0];
        return {
          success: true,
          outputUrl: outUrl,
        };
      } else if (pollData.status === 'failed' || pollData.status === 'canceled') {
        return {
          success: false,
          error: pollData.error || 'Replicate AI processing failed.',
        };
      }
    }

    return {
      success: false,
      error: 'Replicate processing timed out after 60 seconds.',
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error communicating with Replicate API.',
    };
  }
}

async function runHuggingFaceUpscaler(
  imageUrl: string,
  apiKey: string,
  options: EnhancementOptions
): Promise<CloudUpscaleResult> {
  try {
    let imageBuffer: Buffer;
    let contentType = 'image/png';

    if (imageUrl.startsWith('data:')) {
      const match = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        contentType = match[1];
        imageBuffer = Buffer.from(match[2], 'base64');
      } else {
        const res = await fetch(imageUrl);
        imageBuffer = Buffer.from(await res.arrayBuffer());
      }
    } else {
      const res = await fetch(imageUrl);
      if (!res.ok) {
        throw new Error(`Could not fetch source image: ${res.statusText}`);
      }
      imageBuffer = Buffer.from(await res.arrayBuffer());
    }

    // HuggingFace model for image super-resolution
    const model = 'eugenesiow/super-image';
    const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': contentType,
      },
      body: new Uint8Array(imageBuffer),
    });

    const resContentType = response.headers.get('content-type') || '';

    if (!response.ok) {
      if (resContentType.includes('application/json')) {
        const errJson = await response.json();
        if (errJson.estimated_time) {
          return {
            success: false,
            error: `Model is currently loading on Hugging Face (estimated ${Math.round(errJson.estimated_time)}s). Please try again shortly.`,
          };
        }
        return {
          success: false,
          error: errJson.error || `Hugging Face API returned error ${response.status}`,
        };
      }
      const err = await response.text();
      return {
        success: false,
        error: `Hugging Face API returned error ${response.status}: ${err}`,
      };
    }

    if (resContentType.includes('application/json')) {
      const data = await response.json();
      if (data.error) {
        return { success: false, error: data.error };
      }
    }

    const outBuffer = Buffer.from(await response.arrayBuffer());
    const dataUrl = `data:${resContentType || 'image/png'};base64,${outBuffer.toString('base64')}`;

    return {
      success: true,
      outputUrl: dataUrl,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Error communicating with Hugging Face API.',
    };
  }
}
