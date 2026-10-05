import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST, GET } from '@/app/api/reverse-search/route';
import * as reverseSearchLib from '@/lib/reverse-search';

describe('API Route /api/reverse-search', () => {
  it('returns 400 when POST imageUrl is missing or empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/reverse-search', {
      method: 'POST',
      body: JSON.stringify({ imageUrl: '' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/valid "imageUrl"/i);
  });

  it('handles valid POST request and calls performReverseImageSearch', async () => {
    const spy = vi
      .spyOn(reverseSearchLib, 'performReverseImageSearch')
      .mockResolvedValueOnce({
        success: true,
        originalImage: { url: 'https://example.com/test.jpg', width: 800, height: 600 },
        results: [
          {
            id: 'rev-1',
            url: 'https://example.com/hd.jpg',
            domain: 'example.com',
            width: 3840,
            height: 2160,
            resolutionLabel: '4K Ultra HD',
            isHigherRes: true,
            sourceEngine: 'bing',
          },
        ],
        totalFound: 1,
        higherResCount: 1,
      });

    const req = new NextRequest('http://localhost:3000/api/reverse-search', {
      method: 'POST',
      body: JSON.stringify({
        imageUrl: 'https://example.com/test.jpg',
        currentWidth: 800,
        currentHeight: 600,
      }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.higherResCount).toBe(1);
    expect(data.results[0].resolutionLabel).toBe('4K Ultra HD');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://example.com/test.jpg',
        currentWidth: 800,
        currentHeight: 600,
      })
    );

    spy.mockRestore();
  });

  it('returns 400 when GET request is missing imageUrl query parameter', async () => {
    const req = new NextRequest('http://localhost:3000/api/reverse-search?foo=bar', {
      method: 'GET',
    });

    const res = await GET(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toMatch(/missing "imageUrl"/i);
  });

  it('handles valid GET request with query parameters', async () => {
    const spy = vi
      .spyOn(reverseSearchLib, 'performReverseImageSearch')
      .mockResolvedValueOnce({
        success: true,
        originalImage: { url: 'https://example.com/test.jpg', width: 1280, height: 720 },
        results: [],
        totalFound: 0,
        higherResCount: 0,
      });

    const req = new NextRequest(
      'http://localhost:3000/api/reverse-search?imageUrl=https%3A%2F%2Fexample.com%2Ftest.jpg&width=1280&height=720',
      { method: 'GET' }
    );

    const res = await GET(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://example.com/test.jpg',
        currentWidth: 1280,
        currentHeight: 720,
      })
    );

    spy.mockRestore();
  });
});
