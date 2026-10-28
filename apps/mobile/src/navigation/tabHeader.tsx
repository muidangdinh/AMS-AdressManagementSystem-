import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import BrandLogo from '../components/BrandLogo';
import NotificationBell from '../components/NotificationBell';
import UserProfileMenu from '../components/UserProfileMenu';
import { APP_MODE_COLORS, APP_MODE_LABELS } from '../lib/appMode';
import type { AppMode } from '../lib/appMode';

/** Tuỳ chọn header chung cho cả 2 bộ tab: logo AMS + chip tên phân hệ (bên trái) + chuông & hồ sơ (bên phải). */
export function tabScreenOptions(mode: AppMode): BottomTabNavigationOptions {
  const color = APP_MODE_COLORS[mode];
  return {
    tabBarActiveTintColor: color,
    headerLeft: () => (
      <View style={styles.left}>
        <BrandLogo />
        {/* Có cả 2 quyền ('all') thì không cần chip — tab nào cũng có. */}
        {mode !== 'all' && (
          <View style={[styles.chip, { backgroundColor: color }]}>
            <Text style={styles.chipText}>{APP_MODE_LABELS[mode]}</Text>
          </View>
        )}
      </View>
    ),
    headerRight: () => (
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <NotificationBell />
        <UserProfileMenu />
      </View>
    ),
  };
}

const styles = StyleSheet.create({
  left: { flexDirection: 'row', alignItems: 'center', marginLeft: 14, gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  chipText: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
