export const APP_DOMAIN = import.meta.env.VITE_APP_DOMAIN || 'https://grantedai.app';

export function isMarketingDomain(): boolean {
  return (
    window.location.hostname === 'usegrantedai.com' ||
    window.location.hostname === 'www.usegrantedai.com'
  );
}

export function getAuthUrl(): string {
  return isMarketingDomain() ? `${APP_DOMAIN}/auth` : '/auth';
}
