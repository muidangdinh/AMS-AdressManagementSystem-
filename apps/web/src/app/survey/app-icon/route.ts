import { NextRequest, NextResponse } from 'next/server';
import { getSurveyBranding } from '@/lib/survey-branding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const { logoUrl } = await getSurveyBranding();
  const fallback = () =>
    NextResponse.redirect(new URL('/icons/survey-512.png', request.url), {
      headers: { 'Cache-Control': 'no-store' },
    });

  if (!logoUrl) return fallback();

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const response = await fetch(new URL(logoUrl, apiUrl), { cache: 'no-store' });
    if (!response.ok) throw new Error(`App logo returned ${response.status}`);

    const contentType = response.headers.get('content-type');
    if (contentType !== 'image/png' && contentType !== 'image/webp') {
      throw new Error('Configured app logo has an unsupported content type');
    }

    return new NextResponse(response.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Unable to serve configured survey app logo', error);
    return fallback();
  }
}
