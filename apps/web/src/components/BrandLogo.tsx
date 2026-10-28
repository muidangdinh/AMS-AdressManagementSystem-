'use client';

import { useEffect, useState } from 'react';
import { useAppConfig } from '@/lib/app-config';
import { getApiUrl } from '@/lib/api';

/** Logo header web: dùng logo admin tải lên, tự quay về /logo.png khi lỗi. */
export default function BrandLogo({ className = '' }: { className?: string }) {
  const { config } = useAppConfig();
  const customSrc = config.webLogoUrl
    ? `${getApiUrl().replace(/\/$/, '')}${config.webLogoUrl}`
    : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [customSrc]);

  const src = customSrc && !failed ? customSrc : '/logo.png';

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
      className={`block w-auto max-w-[140px] object-contain invert dark:invert-0 ${className}`}
    />
  );
}
