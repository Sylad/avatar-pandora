import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';

vi.mock('axios');
const axiosMock = axios as unknown as { get: ReturnType<typeof vi.fn> };

const ok = (originalimage: string) => ({
  status: 200,
  data: { originalimage: { source: originalimage } },
});
const notFound = { status: 404, data: { type: 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' } };
const noImage = { status: 200, data: {} };
const searchTop = (title: string) => ({
  status: 200,
  data: { query: { search: [{ title }] } },
});
const searchEmpty = { status: 200, data: { query: { search: [] } } };

describe('WikiImageService', () => {
  beforeEach(() => {
    axiosMock.get = vi.fn();
  });

  it('resolves the original image URL for a known title (EN summary direct hit)', async () => {
    axiosMock.get.mockResolvedValueOnce(
      ok('https://upload.wikimedia.org/foo.jpg'),
    );
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Avatar (2009 film)');
    expect(url).toBe('https://upload.wikimedia.org/foo.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(1);
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('en.wikipedia.org/api/rest_v1/page/summary'),
      expect.any(Object),
    );
  });

  it('falls back to FR when EN has no image', async () => {
    axiosMock.get.mockResolvedValueOnce(noImage);
    axiosMock.get.mockResolvedValueOnce(
      ok('https://upload.wikimedia.org/fr-only.jpg'),
    );
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Truc Bien Français');
    expect(url).toBe('https://upload.wikimedia.org/fr-only.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(2);
    expect(axiosMock.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('fr.wikipedia.org'),
      expect.any(Object),
    );
  });

  it('falls back to search when both direct lookups have no image', async () => {
    axiosMock.get.mockResolvedValueOnce(noImage);          // EN summary
    axiosMock.get.mockResolvedValueOnce(noImage);          // FR summary
    axiosMock.get.mockResolvedValueOnce(searchTop('Tree of Souls')); // EN search (NOT a blacklisted franchise hub)
    axiosMock.get.mockResolvedValueOnce(
      ok('https://upload.wikimedia.org/searched.jpg'),
    );                                                     // EN summary of top result
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Hometree');
    expect(url).toBe('https://upload.wikimedia.org/searched.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(4);
  });

  it('skips franchise hub pages in search results to avoid duplicate posters', async () => {
    axiosMock.get.mockResolvedValueOnce(noImage);          // EN summary
    axiosMock.get.mockResolvedValueOnce(noImage);          // FR summary
    // Search returns a franchise page first then a specific one.
    axiosMock.get.mockResolvedValueOnce({
      status: 200,
      data: {
        query: {
          search: [
            { title: 'Avatar (2009 film)' },          // blacklisted
            { title: 'Pandora (Avatar)' },            // blacklisted
            { title: 'Specific Creature Page' },      // accept this
          ],
        },
      },
    });
    axiosMock.get.mockResolvedValueOnce(
      ok('https://upload.wikimedia.org/specific.jpg'),
    );
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Some Bestiary Item');
    expect(url).toBe('https://upload.wikimedia.org/specific.jpg');
  });

  it('returns null when EN 404, FR 404, and search empty', async () => {
    axiosMock.get.mockResolvedValueOnce(notFound);    // EN summary 404
    axiosMock.get.mockResolvedValueOnce(notFound);    // FR summary 404
    axiosMock.get.mockResolvedValueOnce(searchEmpty); // EN search empty
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('AbsolutelyNotARealPage12345');
    expect(url).toBeNull();
  });

  it('encodes the query (apostrophe → %27)', async () => {
    axiosMock.get.mockResolvedValue(noImage); // sticky
    const svc = new WikiImageService();
    await svc.resolveImageUrl("Avatar : la voie de l'eau");
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('Avatar%20%3A%20la%20voie%20de%20l%27eau'),
      expect.any(Object),
    );
  });
});
