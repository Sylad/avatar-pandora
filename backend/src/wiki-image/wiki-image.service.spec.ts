import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';

vi.mock('axios');
const axiosMock = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('WikiImageService', () => {
  beforeEach(() => {
    axiosMock.get = vi.fn();
  });

  it('resolves the original image URL for a known title (EN direct hit)', async () => {
    // EN direct returns the original on first call.
    axiosMock.get.mockResolvedValueOnce({
      data: {
        query: {
          pages: {
            '42': {
              original: { source: 'https://upload.wikimedia.org/foo.jpg' },
            },
          },
        },
      },
    });
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Neytiri');
    expect(url).toBe('https://upload.wikimedia.org/foo.jpg');
    // Hit EN first, no need to fall through.
    expect(axiosMock.get).toHaveBeenCalledTimes(1);
    expect(axiosMock.get).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('en.wikipedia.org'),
      expect.any(Object),
    );
  });

  it('falls back to FR when EN has no image, then to search', async () => {
    // EN direct: page missing.
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { pages: { '-1': { missing: true } } } },
    });
    // FR direct: page missing.
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { pages: { '-1': { missing: true } } } },
    });
    // EN search: returns a top result.
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { search: [{ title: 'Avatar (2009 film)' }] } },
    });
    // EN direct on the searched title: returns image.
    axiosMock.get.mockResolvedValueOnce({
      data: {
        query: {
          pages: {
            '99': {
              original: { source: 'https://upload.wikimedia.org/poster.jpg' },
            },
          },
        },
      },
    });
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Tipani');
    expect(url).toBe('https://upload.wikimedia.org/poster.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(4);
  });

  it('returns null when every strategy fails', async () => {
    // Use the sticky mock so every call returns the empty shape.
    axiosMock.get.mockResolvedValue({
      data: { query: { pages: { '-1': { missing: true } }, search: [] } },
    });
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('AbsolutelyNotARealPage12345');
    expect(url).toBeNull();
  });

  it('encodes the query in the wikipedia API call (apostrophe → %27)', async () => {
    axiosMock.get.mockResolvedValue({
      data: { query: { pages: {}, search: [] } },
    });
    const svc = new WikiImageService();
    await svc.resolveImageUrl("Avatar : la voie de l'eau");
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('Avatar%20%3A%20la%20voie%20de%20l%27eau'),
      expect.any(Object),
    );
  });
});
