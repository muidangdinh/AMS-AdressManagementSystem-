/**
 * Tây Ninh GIS — Ứng Dụng Khảo Sát Số Nhà Thực Địa
 * (Phase 4 — VI. Ứng dụng khảo sát hiện trường)
 *
 * @format
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/lib/AuthContext';
import { UnreadProvider } from './src/lib/UnreadContext';
import RootNavigator from './src/navigation/RootNavigator';
import Geolocation from '@react-native-community/geolocation';

// Dùng Google Fused Location (kết hợp GPS + Wi-Fi + trạm di động) thay cho chip GPS thô của
// LocationManager — mặc định thư viện gọi thẳng provider `gps`, trong nhà gần như luôn timeout.
// Máy không có Play Services thì thư viện tự rơi về LocationManager. Quyền vị trí app tự xin
// qua PermissionsAndroid ở từng màn hình nên bỏ qua bước xin quyền của thư viện.
Geolocation.setRNConfiguration({ skipPermissionRequests: true, locationProvider: 'playServices' });

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <AuthProvider>
          <UnreadProvider>
            <RootNavigator />
          </UnreadProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
