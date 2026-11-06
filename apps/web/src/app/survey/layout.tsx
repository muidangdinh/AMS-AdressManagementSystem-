import type { Metadata, Viewport } from 'next';
import SurveyShell from '@/components/survey/SurveyShell';
import { getSurveyBranding } from '@/lib/survey-branding';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const { version } = await getSurveyBranding();
  return {
    title: 'AMS Khảo sát thực địa',
    applicationName: 'AMS Khảo sát',
    manifest: '/survey/manifest',
    appleWebApp: {
      capable: true,
      statusBarStyle: 'default',
      title: 'AMS Khảo sát',
    },
    icons: {
      apple: [{ url: `/survey/app-icon?v=${version}`, sizes: '180x180' }],
    },
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0891b2',
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <SurveyShell>{children}</SurveyShell>;
}
