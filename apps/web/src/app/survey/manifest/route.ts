import { getSurveyBranding } from '@/lib/survey-branding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const { logoUrl, version } = await getSurveyBranding();
  const icon = `/survey/app-icon?v=${version}`;
  const iconType = logoUrl?.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';

  return Response.json(
    {
      name: 'AMS Khảo sát thực địa',
      short_name: 'AMS Khảo sát',
      description: 'Khảo sát nhà ở và ghi nhận hiện trường',
      lang: 'vi',
      id: '/survey/',
      start_url: '/survey/assignments',
      scope: '/',
      display: 'standalone',
      prefer_related_applications: false,
      orientation: 'portrait',
      background_color: '#f4f6fa',
      theme_color: '#0891b2',
      icons: [
        { src: '/icons/survey-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icons/survey-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
        {
          src: '/icons/survey-maskable-1024.png?v=2',
          sizes: '1024x1024',
          type: 'image/png',
          purpose: 'maskable',
        },
        { src: icon, type: iconType, purpose: 'any' },
      ],
    },
    {
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
