import type { Metadata, Viewport } from 'next';
import SurveyShell from '@/components/survey/SurveyShell';

export const metadata: Metadata = {
  title: 'AMS Khảo sát thực địa',
  applicationName: 'AMS Khảo sát',
  manifest: '/survey-manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AMS Khảo sát',
  },
  icons: {
    apple: [{ url: '/icons/survey-180.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#0891b2',
};

export default function SurveyLayout({ children }: { children: React.ReactNode }) {
  return <SurveyShell>{children}</SurveyShell>;
}
