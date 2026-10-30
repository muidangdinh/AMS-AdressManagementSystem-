import React, { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { API_URL } from '../lib/api';
import { useAppConfig } from '../lib/AppConfigContext';

const DEFAULT_LOGO = require('../assets/ams-mark-blue.png');

/** Logo góc trái header app; dùng logo admin tải lên đúng màu gốc, fallback asset bundled. */
export default function BrandLogo() {
  const { config } = useAppConfig();
  const customUrl = config.appLogoUrl ? `${API_URL}${config.appLogoUrl}` : null;
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [customUrl]);

  return (
    <Image
      source={customUrl && !failed ? { uri: customUrl } : DEFAULT_LOGO}
      style={styles.logo}
      resizeMode="contain"
      fadeDuration={0}
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
