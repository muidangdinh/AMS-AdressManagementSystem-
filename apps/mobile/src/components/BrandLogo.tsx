import React, { useEffect, useState } from 'react';
import { AppState, Image, StyleSheet } from 'react-native';
import { API_URL } from '../lib/api';
import { fetchAppConfig } from '../lib/appConfig';

const DEFAULT_LOGO = require('../assets/ams-mark-blue.png');

/** Logo góc trái header app; dùng logo admin tải lên đúng màu gốc, fallback asset bundled. */
export default function BrandLogo() {
  const [customUrl, setCustomUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const load = () => {
      fetchAppConfig()
        .then((cfg) => {
          if (!active) return;
          setCustomUrl(cfg.appLogoUrl ? `${API_URL}${cfg.appLogoUrl}` : null);
          setFailed(false);
        })
        .catch(() => {
          // Giữ logo bundled khi API chưa sẵn sàng.
        });
    };

    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return (
    <Image
      source={customUrl && !failed ? { uri: customUrl } : DEFAULT_LOGO}
      style={styles.logo}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="AMS"
      onError={() => {
        if (customUrl) setFailed(true);
      }}
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: 28, height: 28 },
});
