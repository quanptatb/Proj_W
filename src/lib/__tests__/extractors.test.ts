import { describe, it, expect, vi } from 'vitest';
import { upgradePinterestUrl, extractPinterestImages } from '../extractors/pinterest';
import {
  upgradeFacebookUrl,
  unescapeFacebookString,
  extractFacebookImages,
  isValidFacebookImageUrl,
  parseFacebookUrlDetails,
} from '../extractors/facebook';
import { getHighestFromSrcset, removeThumbnailQuery, extractGenericWebImages } from '../extractors/generic';
import {
  detectSource,
  formatBytes,
  formatDimensions,
  sanitizeFilename,
  getProxiedImageUrl,
  getProxiedDownloadUrl,
} from '../utils';

describe('Utility Functions', () => {
  it('detects sources correctly', () => {
    expect(detectSource('https://www.pinterest.com/pin/12345/')).toBe('pinterest');
    expect(detectSource('https://pin.it/abc1234')).toBe('pinterest');
    expect(detectSource('https://i.pinimg.com/736x/8f/3e/pic.jpg')).toBe('pinterest');

    expect(detectSource('https://www.facebook.com/photo.php?fbid=100')).toBe('facebook');
    expect(detectSource('https://m.facebook.com/story.php')).toBe('facebook');
    expect(detectSource('https://scontent.fhan14-1.fna.fbcdn.net/v/t39.30808-6/pic.jpg')).toBe('facebook');

    expect(detectSource('https://unsplash.com/photos/mountain')).toBe('generic');
    expect(detectSource('https://example.com/gallery')).toBe('generic');
  });

  it('formats bytes properly', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1048576 * 2.5)).toBe('2.5 MB');
    expect(formatBytes(0)).toBe('Unknown size');
    expect(formatBytes(-100)).toBe('Unknown size');
    expect(formatBytes(undefined)).toBe('Unknown size');
  });

  it('formats dimensions', () => {
    expect(formatDimensions(1920, 1080)).toBe('1920 × 1080');
    expect(formatDimensions(800)).toBe('800px width');
    expect(formatDimensions(undefined, 600)).toBe('600px height');
    expect(formatDimensions()).toBe('HD / Original');
  });

  it('sanitizes filenames properly', () => {
    expect(sanitizeFilename('Ảnh Đẹp 2024 / * ?')).toBe('Ảnh_Đẹp_2024');
    expect(sanitizeFilename('', 'fallback')).toBe('fallback');
    expect(sanitizeFilename('___test___name___')).toBe('test_name');
  });

  it('generates correct proxy URLs with fallback support', () => {
    const raw = 'https://i.pinimg.com/originals/ab/cd.jpg';
    const fallback = 'https://i.pinimg.com/736x/ab/cd.jpg';

    expect(getProxiedImageUrl(raw)).toBe(`/api/proxy-image?url=${encodeURIComponent(raw)}`);
    expect(getProxiedImageUrl(raw, fallback)).toBe(
      `/api/proxy-image?url=${encodeURIComponent(raw)}&fallback=${encodeURIComponent(fallback)}`
    );

    expect(getProxiedDownloadUrl(raw, 'pic.jpg', fallback)).toBe(
      `/api/proxy-download?url=${encodeURIComponent(raw)}&filename=pic.jpg&fallback=${encodeURIComponent(fallback)}`
    );

    // Data URI or blob should not be proxied
    expect(getProxiedImageUrl('data:image/png;base64,abc')).toBe('data:image/png;base64,abc');

    // Already proxied URL should not be double-encoded
    const already = '/api/proxy-image?url=https%3A%2F%2Fexample.com%2Fpic.jpg';
    expect(getProxiedImageUrl(already)).toBe(already);
  });
});

describe('Pinterest Extractor & CDN Upgrade', () => {
  it('upgrades various Pinterest CDN resolutions to originals', () => {
    expect(upgradePinterestUrl('https://i.pinimg.com/60x60/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/170x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/216x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/236x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/474x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/564x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/600x315/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/736x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
    expect(upgradePinterestUrl('https://i.pinimg.com/1200x/8f/3e/2d/test.jpg')).toBe(
      'https://i.pinimg.com/originals/8f/3e/2d/test.jpg'
    );
  });

  it('strips resizing query parameters when upgrading Pinterest URLs', () => {
    const withQuery = 'https://i.pinimg.com/736x/8f/3e/2d/test.jpg?w=500&crop=1';
    expect(upgradePinterestUrl(withQuery)).toBe('https://i.pinimg.com/originals/8f/3e/2d/test.jpg');
  });

  it('does not mutate non-pinimg urls', () => {
    const regular = 'https://example.com/236x/image.jpg';
    expect(upgradePinterestUrl(regular)).toBe(regular);
  });

  it('extracts direct Pinterest CDN URL with upgrade and sets fallbackUrl', async () => {
    const directUrl = 'https://i.pinimg.com/736x/5a/2b/3c/5a2b3c.jpg';
    const result = await extractPinterestImages(directUrl);
    expect(result.success).toBe(true);
    expect(result.source).toBe('pinterest');
    expect(result.images.length).toBeGreaterThan(0);
    expect(result.images[0].url).toBe('https://i.pinimg.com/originals/5a/2b/3c/5a2b3c.jpg');
    expect(result.images[0].fallbackUrl).toBe(directUrl);
    expect(result.images[0].isOriginalCandidate).toBe(true);
  });
});

describe('Facebook Extractor & CDN Upgrade', () => {
  it('preserves HMAC signed Facebook URLs to prevent HTTP 403 Forbidden', () => {
    // Signed URL with oh= and oe=: path MUST NOT be altered
    const signedP720 =
      'https://scontent.fhan1-1.fna.fbcdn.net/v/t39.30808-6/p720x720/123456_n.jpg?oh=xyz&oe=123';
    expect(upgradeFacebookUrl(signedP720)).toBe(signedP720);

    // Unsigned URL without oh=/oe=: downscale token can be safely stripped
    const unsignedS960 =
      'https://scontent.fhan14-1.fna.fbcdn.net/v/t39.30808-6/s960x960/abc_n.jpg';
    expect(upgradeFacebookUrl(unsignedS960)).toBe(
      'https://scontent.fhan14-1.fna.fbcdn.net/v/t39.30808-6/abc_n.jpg'
    );
  });

  it('unescapes complex unicode and json escape sequences in Facebook URLs', () => {
    const rawUrl = 'https:\\/\\/scontent.xx.fbcdn.net\\/v\\/test.jpg?a\\u003d1\\u0026b\\u003d2';
    expect(unescapeFacebookString(rawUrl)).toBe('https://scontent.xx.fbcdn.net/v/test.jpg?a=1&b=2');
    expect(upgradeFacebookUrl(rawUrl)).toBe('https://scontent.xx.fbcdn.net/v/test.jpg?a=1&b=2');
  });

  it('identifies and filters invalid formats like .kf keyframes, video, audio, and avatars', () => {
    // Meta Keyframes vector animation binary
    const kfUrl =
      'https://scontent.fsgn2-10.fna.fbcdn.net/m1/v/t6/An_KOWvmE8xXhWbKcEDamiAQ14ZKS7T_w5aOTf-M8Krv4ls-f63eecRjpMEIRfwoMQw0XjeM4Q2PKoqtUSQc0_q66s2ahAGa0OTb.kf?_nc_gid=123';
    expect(isValidFacebookImageUrl(kfUrl)).toBe(false);

    // Videos and scripts
    const videoUrl = 'https://video.fsgn2-6.fna.fbcdn.net/o1/v/t2/f2/m366/AQNSb24Eu7biTByLbg.mp4';
    expect(isValidFacebookImageUrl(videoUrl)).toBe(false);

    const scriptUrl = 'https://static.xx.fbcdn.net/rsrc.php/v4/yq/r/53qtSEs4uXL.js';
    expect(isValidFacebookImageUrl(scriptUrl)).toBe(false);

    // Tiny avatars (<= 180px or -1 profile category)
    const tinyAvatar =
      'https://scontent.fsgn2-10.fna.fbcdn.net/v/t1.30497-1/pic.jpg?stp=c379.0.1290.1290a_cp0_dst-jpg_tt6&ctp=s40x40';
    expect(isValidFacebookImageUrl(tinyAvatar)).toBe(false);

    const profileAvatar180 =
      'https://scontent.fsgn2-8.fna.fbcdn.net/v/t39.30808-1/pic.png?cstp=mx180x180&ctp=s180x180';
    expect(isValidFacebookImageUrl(profileAvatar180)).toBe(false);

    // Allows avatar when explicitly permitted (e.g. for direct URL input)
    expect(isValidFacebookImageUrl(profileAvatar180, { allowAvatars: true })).toBe(true);

    // Valid real Facebook post photo
    const validPhoto =
      'https://scontent.fsgn2-4.fna.fbcdn.net/v/t39.30808-6/825266356_1660156909489656_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x2048&ctp=s2048x2048';
    expect(isValidFacebookImageUrl(validPhoto)).toBe(true);
  });

  it('rejects direct .kf URLs in extractFacebookImages', async () => {
    const directKf = 'https://scontent.fsgn2-10.fna.fbcdn.net/m1/v/t6/reaction.kf?_nc_gid=123';
    const res = await extractFacebookImages(directKf);
    expect(res.success).toBe(false);
    expect(res.images.length).toBe(0);
    expect(res.error).toBeDefined();
  });

  it('correctly parses modern Facebook transform dimensions and photo asset IDs', () => {
    const modernCstp =
      'https://scontent.fsgn2-4.fna.fbcdn.net/v/t39.30808-6/825266356_1660156909489656_6469749096694739446_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x2048&ctp=s2048x2048';
    const parsed1 = parseFacebookUrlDetails(modernCstp);
    expect(parsed1.width).toBe(2048);
    expect(parsed1.height).toBe(2048);
    expect(parsed1.photoKey).toBe('1660156909489656');

    const legacyS960 =
      'https://scontent.fhan14-1.fna.fbcdn.net/v/t39.30808-6/s960x960/12345_9876543210_1111_n.jpg';
    const parsed2 = parseFacebookUrlDetails(legacyS960);
    expect(parsed2.width).toBe(960);
    expect(parsed2.height).toBe(960);
    expect(parsed2.photoKey).toBe('9876543210');
  });

  it('correctly handles direct signed Facebook CDN photo URLs without corrupting HMAC', async () => {
    const directPhoto =
      'https://scontent.fsgn2-4.fna.fbcdn.net/v/t39.30808-6/825266356_1660156909489656_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x2048&oh=00_AFBxyz123&oe=6AE99999';
    const res = await extractFacebookImages(directPhoto);
    expect(res.success).toBe(true);
    expect(res.images.length).toBe(1);
    expect(res.images[0].url).toBe(directPhoto);
    expect(res.images[0].width).toBe(2048);
    expect(res.images[0].height).toBe(2048);
  });

  it('correctly returns success: false and helpful error message for private group link', async () => {
    const groupPhotoUrl =
      'https://www.facebook.com/photo/?fbid=1112311237854026&set=gm.2381489735962691&idorvanity=632018264243189';
    const res = await extractFacebookImages(groupPhotoUrl);
    expect(res.success).toBe(false);
    expect(res.images.length).toBe(0);
    expect(res.error).toMatch(/nhóm riêng tư|riêng tư|đăng nhập/i);
  }, 15000);

  it('extracts real photos, deduplicates resolutions, and excludes .kf files and tiny avatars from page HTML', async () => {
    const fakeHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ảnh thiên nhiên tuyệt đẹp - Facebook</title>
          <meta property="og:title" content="Ảnh thiên nhiên tuyệt đẹp" />
          <meta property="og:image" content="https://scontent.fhan1-1.fna.fbcdn.net/v/t39.30808-6/s960x960/100_5555555555_111_n.jpg?stp=dst-jpg_s960x960&oh=sig_og&oe=123" />
          <meta property="og:image:width" content="960" />
          <meta property="og:image:height" content="960" />
        </head>
        <body>
          <!-- 9 Meta Keyframes vector animation binaries (reactions) that previously caused 9 broken cards -->
          <script>
            const reactions = [
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_like.kf?_nc_gid=1",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_love.kf?_nc_gid=2",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_care.kf?_nc_gid=3",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_haha.kf?_nc_gid=4",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_wow.kf?_nc_gid=5",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_sad.kf?_nc_gid=6",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_angry.kf?_nc_gid=7",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_yay.kf?_nc_gid=8",
              "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/m1\\/v\\/t6\\/An_pride.kf?_nc_gid=9"
            ];
            // Micro avatar that should be excluded
            const avatar = "https:\\/\\/scontent.fsgn2-10.fna.fbcdn.net\\/v\\/t1.30497-1\\/avatar.jpg?stp=c0.0.40.40a_cp0_dst-jpg&ctp=s40x40";
            // 2048x2048 high-res master photo for the same asset as the 960x960 preview
            const masterPhoto = "https:\\/\\/scontent.fhan1-1.fna.fbcdn.net\\/v\\/t39.30808-6\\/100_5555555555_111_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x2048&ctp=s2048x2048&oh=sig_master&oe=123";
          </script>
        </body>
      </html>
    `;

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('facebook.com/mock-post')) {
        return new Response(fakeHtml, {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      return originalFetch(url);
    }) as any;

    try {
      const res = await extractFacebookImages('https://www.facebook.com/mock-post/12345');
      expect(res.success).toBe(true);
      // Ensure zero .kf files
      expect(res.images.some((img) => img.url.includes('.kf'))).toBe(false);
      // Ensure zero tiny avatars
      expect(res.images.some((img) => img.url.includes('avatar.jpg'))).toBe(false);
      // Ensure deduplicated to the single high-res master candidate (2048x2048 replaced 960x960)
      expect(res.images.length).toBe(1);
      expect(res.images[0].width).toBe(2048);
      expect(res.images[0].height).toBe(2048);
      expect(res.images[0].url).toContain('cstp=mx2048x2048');
      // Ensure signature is preserved and not corrupted
      expect(res.images[0].url).toContain('oh=sig_master');
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe('Generic Web Extractor & CDN Upgrades', () => {
  it('selects highest resolution from complex srcset', () => {
    const srcset = 'thumb.jpg 300w, medium.jpg 800w, ultra.jpg 2560w, small.jpg 500w';
    const best = getHighestFromSrcset(srcset, 'https://example.com/page/');
    expect(best).not.toBeNull();
    expect(best?.url).toBe('https://example.com/page/ultra.jpg');
    expect(best?.width).toBe(2560);
  });

  it('handles commas inside Cloudinary URLs in srcset without corrupting URL', () => {
    const cloudinarySrcset =
      'https://res.cloudinary.com/demo/image/upload/w_300,h_200,c_fill/sample.jpg 300w, https://res.cloudinary.com/demo/image/upload/w_1200,h_800,c_fill/sample.jpg 1200w';
    const best = getHighestFromSrcset(cloudinarySrcset, 'https://example.com/');
    expect(best).not.toBeNull();
    expect(best?.url).toBe('https://res.cloudinary.com/demo/image/upload/w_1200,h_800,c_fill/sample.jpg');
    expect(best?.width).toBe(1200);
  });

  it('handles density descriptors in srcset (1x, 2x, 3x)', () => {
    const srcset = 'standard.jpg 1x, retina.jpg 2x, super.jpg 3x';
    const best = getHighestFromSrcset(srcset, 'https://example.com/');
    expect(best?.url).toBe('https://example.com/super.jpg');
  });

  it('handles empty or invalid srcset gracefully', () => {
    expect(getHighestFromSrcset('', 'https://example.com/')).toBeNull();
  });

  it('removes thumbnail query strings and path resizers', () => {
    const wpUrl = 'https://example.com/wp-content/uploads/2024/01/wallpaper-300x200.jpg';
    expect(removeThumbnailQuery(wpUrl)).toBe('https://example.com/wp-content/uploads/2024/01/wallpaper.jpg');

    const cdnUrl = 'https://images.example.com/photo.jpg?w=400&h=300&fit=crop&quality=60';
    expect(removeThumbnailQuery(cdnUrl)).toBe('https://images.example.com/photo.jpg');
  });

  it('upgrades Twitter/X CDN images to name=orig master asset', () => {
    const twUrl = 'https://pbs.twimg.com/media/F123abc?format=jpg&name=360x360';
    expect(removeThumbnailQuery(twUrl)).toBe('https://pbs.twimg.com/media/F123abc?format=jpg&name=orig');
  });

  it('upgrades Google / Blogspot CDN images to s0 uncompressed master asset', () => {
    const googleUrl = 'https://blogger.googleusercontent.com/img/b/R29/s320/photo.jpg';
    expect(removeThumbnailQuery(googleUrl)).toBe('https://blogger.googleusercontent.com/img/b/R29/s0/photo.jpg');
  });

  it('upgrades Shopify product images by stripping thumbnail suffixes', () => {
    const shopifyUrl = 'https://cdn.shopify.com/s/files/1/products/jacket_600x600.jpg';
    expect(removeThumbnailQuery(shopifyUrl)).toBe('https://cdn.shopify.com/s/files/1/products/jacket.jpg');
  });

  it('extracts direct generic image URL', async () => {
    const directImage = 'https://example.com/assets/photos/mountain.jpg?w=500';
    const res = await extractGenericWebImages(directImage);
    expect(res.success).toBe(true);
    expect(res.images[0].url).toBe('https://example.com/assets/photos/mountain.jpg');
  });
});
