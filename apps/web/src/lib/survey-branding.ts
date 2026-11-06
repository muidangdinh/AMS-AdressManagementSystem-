import { createHash } from 'crypto';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function getSurveyBranding() {
  try {
    const response = await fetch(`${API_URL.replace(/\/$/, '')}/api/app-config`, {
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`App config returned ${response.status}`);

    const config = (await response.json()) as { appLogoUrl?: string | null };
    const logoUrl =
      typeof config.appLogoUrl === 'string' && config.appLogoUrl.startsWith('/uploads/branding/')
        ? config.appLogoUrl
        : null;

    return {
      logoUrl,
      version: logoUrl
        ? createHash('sha1').update(logoUrl).digest('hex').slice(0, 12)
        : 'default',
    };
  } catch (error) {
    console.error('Unable to load survey app logo configuration', error);
    return { logoUrl: null, version: 'default' };
  }
}
