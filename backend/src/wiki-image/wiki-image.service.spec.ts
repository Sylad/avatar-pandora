import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';

vi.mock('axios');
const axiosMock = axios as unknown as { get: ReturnType<typeof vi.fn> };

describe('WikiImageService', () => {
  beforeEach(() => {
    axiosMock.get = vi.fn();
  });

  it('resolves the original image URL for a known title', async () => {
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
  });

  it('returns null when wikipedia has no original image', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { pages: { '-1': { missing: true } } } },
    });
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('NotARealThing12345');
    expect(url).toBeNull();
  });

  it('encodes the query in the wikipedia API call', async () => {
    axiosMock.get.mockResolvedValueOnce({
      data: { query: { pages: {} } },
    });
    const svc = new WikiImageService();
    await svc.resolveImageUrl("Avatar : la voie de l'eau");
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('Avatar%20%3A%20la%20voie%20de%20l%27eau'),
      expect.any(Object),
    );
  });
});
