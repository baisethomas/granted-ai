import { describe, expect, it } from 'vitest';
import { getOAuthRedirectOrigin, isLocalDevelopmentOrigin } from './domains';

describe('domain helpers', () => {
  it('keeps OAuth redirects on localhost even when an app domain is configured', () => {
    expect(getOAuthRedirectOrigin('http://localhost:5000', 'https://grantedai.app')).toBe(
      'http://localhost:5000',
    );
    expect(getOAuthRedirectOrigin('http://127.0.0.1:5173', 'https://grantedai.app')).toBe(
      'http://127.0.0.1:5173',
    );
  });

  it('uses the configured app domain outside local development', () => {
    expect(getOAuthRedirectOrigin('https://usegrantedai.com', 'https://grantedai.app/')).toBe(
      'https://grantedai.app',
    );
  });

  it('detects local development origins', () => {
    expect(isLocalDevelopmentOrigin('http://localhost:5000')).toBe(true);
    expect(isLocalDevelopmentOrigin('http://127.0.0.1:5173')).toBe(true);
    expect(isLocalDevelopmentOrigin('https://grantedai.app')).toBe(false);
  });
});
