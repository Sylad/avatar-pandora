import { describe, it, expect } from 'vitest';
import { loadAppEnv } from './env.schema';

describe('loadAppEnv', () => {
  it('defaults port to 3003 when PORT is missing', () => {
    expect(loadAppEnv({}).port).toBe(3003);
  });

  it('parses a valid PORT', () => {
    expect(loadAppEnv({ PORT: '4000' }).port).toBe(4000);
  });

  it('falls back to 3003 when PORT is "0"', () => {
    expect(loadAppEnv({ PORT: '0' }).port).toBe(3003);
  });

  it('throws on garbage PORT', () => {
    expect(() => loadAppEnv({ PORT: 'abc' })).toThrow();
  });

  it('uses CORS_ORIGIN when present', () => {
    expect(loadAppEnv({ CORS_ORIGIN: 'https://eywa.example.com' }).corsOrigin).toBe(
      'https://eywa.example.com',
    );
  });

  it('returns true (allow all) when CORS_ORIGIN is missing', () => {
    expect(loadAppEnv({}).corsOrigin).toBe(true);
  });

  it('returns true when CORS_ORIGIN is empty string', () => {
    expect(loadAppEnv({ CORS_ORIGIN: '' }).corsOrigin).toBe(true);
  });
});
