export const APP_DOMAIN = (import.meta.env.VITE_APP_DOMAIN || '').replace(/\/$/, '');

function getBrowserOrigin(): string {
  return typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : '';
}

export function isLocalDevelopmentOrigin(origin = getBrowserOrigin()): boolean {
  if (!origin) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
  } catch {
    return false;
  }
}

export function getOAuthRedirectOrigin(
  origin = getBrowserOrigin(),
  configuredAppDomain = APP_DOMAIN,
): string {
  if (origin && isLocalDevelopmentOrigin(origin)) {
    return origin;
  }
  return configuredAppDomain?.replace(/\/$/, '') || origin;
}

export function isMarketingDomain(): boolean {
  return (
    window.location.hostname === 'usegrantedai.com' ||
    window.location.hostname === 'www.usegrantedai.com'
  );
}

export function getAuthUrl(): string {
  return isMarketingDomain() ? `${APP_DOMAIN}/auth` : '/auth';
}
