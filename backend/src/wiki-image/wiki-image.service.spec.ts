import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { WikiImageService } from './wiki-image.service';

vi.mock('axios');
const axiosMock = axios as unknown as { get: ReturnType<typeof vi.fn> };

const fandomPageOk = (originalSource: string) => ({
  status: 200,
  data: {
    query: {
      pages: {
        '42': { original: { source: originalSource } },
      },
    },
  },
});
const fandomPageMissing = {
  status: 200,
  data: { query: { pages: { '-1': { missing: true } } } },
};
const fandomSearch = (titles: string[]) => ({
  status: 200,
  data: {
    query: { search: titles.map((t) => ({ title: t })) },
  },
});
const fandomSearchEmpty = { status: 200, data: { query: { search: [] } } };
const wikipediaSummaryOk = (source: string) => ({
  status: 200,
  data: { originalimage: { source } },
});
const wikipedia404 = { status: 404, data: {} };

describe('WikiImageService', () => {
  beforeEach(() => {
    axiosMock.get = vi.fn();
  });

  it('resolves an Avatar Fandom direct hit (most common case)', async () => {
    axiosMock.get.mockResolvedValueOnce(
      fandomPageOk('https://static.wikia.nocookie.net/jamescameronsavatar/images/banshee.jpg'),
    );
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Mountain Banshee');
    expect(url).toBe('https://static.wikia.nocookie.net/jamescameronsavatar/images/banshee.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(1);
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('james-camerons-avatar.fandom.com'),
      expect.any(Object),
    );
  });

  it('falls back to Fandom search when direct page is missing', async () => {
    axiosMock.get.mockResolvedValueOnce(fandomPageMissing);              // direct miss
    axiosMock.get.mockResolvedValueOnce(fandomSearch(['Toruk Makto'])); // search
    axiosMock.get.mockResolvedValueOnce(
      fandomPageOk('https://static.wikia.nocookie.net/jamescameronsavatar/images/toruk.jpg'),
    );                                                                   // image of search result
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Toruk');
    expect(url).toBe('https://static.wikia.nocookie.net/jamescameronsavatar/images/toruk.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(3);
  });

  it('skips search results whose title does not contain the first query word', async () => {
    axiosMock.get.mockResolvedValueOnce(fandomPageMissing);                            // direct miss
    axiosMock.get.mockResolvedValueOnce(
      fandomSearch(['Random Page', 'Banshee creature', 'Other Result']),
    );                                                                                  // search returns 3
    axiosMock.get.mockResolvedValueOnce(
      fandomPageOk('https://static.wikia.nocookie.net/jamescameronsavatar/images/banshee.jpg'),
    );                                                                                  // image of "Banshee creature"
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Banshee Avatar');
    expect(url).toBe('https://static.wikia.nocookie.net/jamescameronsavatar/images/banshee.jpg');
  });

  it('falls back to Wikipedia EN for actor names that have no Fandom page', async () => {
    axiosMock.get.mockResolvedValueOnce(fandomPageMissing);  // Fandom direct miss
    axiosMock.get.mockResolvedValueOnce(fandomSearchEmpty);  // Fandom search empty
    axiosMock.get.mockResolvedValueOnce(
      wikipediaSummaryOk('https://upload.wikimedia.org/wikipedia/commons/sigourney.jpg'),
    );                                                        // EN Wikipedia summary
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Sigourney Weaver');
    expect(url).toBe('https://upload.wikimedia.org/wikipedia/commons/sigourney.jpg');
    expect(axiosMock.get).toHaveBeenCalledTimes(3);
  });

  it('falls back to Wikipedia FR when EN also has nothing', async () => {
    axiosMock.get.mockResolvedValueOnce(fandomPageMissing);
    axiosMock.get.mockResolvedValueOnce(fandomSearchEmpty);
    axiosMock.get.mockResolvedValueOnce(wikipedia404);          // EN 404
    axiosMock.get.mockResolvedValueOnce(
      wikipediaSummaryOk('https://upload.wikimedia.org/wikipedia/commons/fr-image.jpg'),
    );                                                           // FR summary
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('Quelque Chose Très Français');
    expect(url).toBe('https://upload.wikimedia.org/wikipedia/commons/fr-image.jpg');
  });

  it('returns null when every source has nothing', async () => {
    axiosMock.get.mockResolvedValue(fandomPageMissing);  // sticky for all calls
    const svc = new WikiImageService();
    const url = await svc.resolveImageUrl('AbsolutelyNotARealEntity');
    expect(url).toBeNull();
  });

  it('encodes the query (apostrophe → %27)', async () => {
    axiosMock.get.mockResolvedValue(fandomPageMissing);  // sticky
    const svc = new WikiImageService();
    await svc.resolveImageUrl("Mo'at");
    expect(axiosMock.get).toHaveBeenCalledWith(
      expect.stringContaining('Mo%27at'),
      expect.any(Object),
    );
  });
});
