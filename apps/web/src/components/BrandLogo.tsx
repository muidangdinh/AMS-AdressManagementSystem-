'use client';

import { useEffect, useState } from 'react';
import { useAppConfig } from '@/lib/app-config';
import { getApiUrl } from '@/lib/api';
import { useTheme } from '@/lib/theme';

/** Logo header web: dùng logo admin tải lên theo theme, tự quay về logo mặc định khi lỗi. */
export default function BrandLogo({ className = '' }: { className?: string }) {
  const { config } = useAppConfig();
  const { theme } = useTheme();
  const customUrl = theme === 'dark' ? config.webLogoDarkUrl : config.webLogoLightUrl;
  const customSrc = customUrl ? `${getApiUrl().replace(/\/$/, '')}${customUrl}` : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [customSrc]);

  const src = customSrc && !failed ? customSrc : theme === 'dark' ? '/logo.png' : '/logo-light.png';

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Tây Ninh"
      width={914}
      height={397}
      onError={() => {
        if (customSrc) setFailed(true);
      }}
      className={`block w-auto max-w-[140px] object-contain ${className}`}
    />
  );
}
