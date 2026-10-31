import React, { type ReactNode, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Map, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { useAppConfig } from '../lib/AppConfigContext';
import { loadGoongStyle } from '../lib/goong';

interface GoongMapProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Toạ độ theo thứ tự (lat, lng) cho dễ dùng với dữ liệu hiện có. */
  onPress?: (latitude: number, longitude: number) => void;
  onReady?: () => void;
  onRegionDidChange?: (center: { latitude: number; longitude: number }) => void;
}

/** Nền bản đồ Goong (MapLibre) dùng chung cho các màn hình mobile. */
export default function GoongMap({ children, style, onPress, onReady, onRegionDidChange }: GoongMapProps) {
  const { config } = useAppConfig();
  const [loaded, setLoaded] = useState<{ mapStyle: string | StyleSpecification } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadGoongStyle(config.mapHidePoi).then((mapStyle) => {
      if (active) setLoaded({ mapStyle });
    });
    return () => {
      active = false;
    };
  }, [config.mapHidePoi]);

  if (!loaded) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Map
        style={styles.map}
        mapStyle={loaded.mapStyle}
        attribution={false}
        logo={false}
        compass={false}
        onPress={(event) => {
          const [lng, lat] = event.nativeEvent.lngLat;
          onPress?.(lat, lng);
        }}
        onRegionDidChange={(event) => {
          const { center } = event.nativeEvent;
          onRegionDidChange?.({ latitude: center[1], longitude: center[0] });
        }}
        onDidFinishLoadingMap={() => {
          setFailed(false);
          onReady?.();
        }}
        onDidFailLoadingMap={() => setFailed(true)}
      >
        {children}
      </Map>
      {failed && (
        <View style={styles.error}>
          <Text style={styles.errorText}>Không tải được nền bản đồ Goong — kiểm tra Maptiles Key.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#e2e8f0' },
  map: { flex: 1, alignSelf: 'stretch' },
  error: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(185,28,28,0.92)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  errorText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
