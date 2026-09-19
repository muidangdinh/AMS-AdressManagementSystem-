import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DashboardScreen from '../screens/DashboardScreen';
import MapScreen from '../screens/MapScreen';
import AssignmentsScreen from '../screens/AssignmentsScreen';
import SurveyScreen from '../screens/SurveyScreen';
import PlatesScreen from '../screens/PlatesScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { useAuth } from '../lib/AuthContext';

export type MainTabsParamList = {
  Dashboard: undefined;
  /** `focusId`/`lat`/`lng` — bay thẳng tới 1 vị trí khi được điều hướng từ Dashboard. */
  Map: { focusId: string; lat: number; lng: number } | undefined;
  Assignments: undefined;
  Survey: undefined;
  Plates: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<MainTabsParamList>();

function LogoutButton() {
  const { logout } = useAuth();
  return (
    <TouchableOpacity onPress={logout} style={{ marginRight: 16 }}>
      <Text style={{ color: '#2563eb', fontWeight: '700', fontSize: 13 }}>Đăng xuất</Text>
    </TouchableOpacity>
  );
}

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerRight: () => <LogoutButton />,
        tabBarActiveTintColor: '#2563eb',
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Tổng Quan',
          tabBarLabel: 'Tổng Quan',
          tabBarIcon: ({ color, size }) => <Icon name="view-dashboard-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Map"
        component={MapScreen}
        options={{
          title: 'Bản Đồ',
          tabBarLabel: 'Bản Đồ',
          tabBarIcon: ({ color, size }) => <Icon name="map-search" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Assignments"
        component={AssignmentsScreen}
        options={{
          title: 'Nhiệm Vụ',
          tabBarLabel: 'Nhiệm Vụ',
          tabBarIcon: ({ color, size }) => <Icon name="clipboard-list-outline" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Survey"
        component={SurveyScreen}
        options={{
          title: 'Khảo Sát',
          tabBarLabel: 'Khảo Sát',
          tabBarIcon: ({ color, size }) => <Icon name="map-marker-radius" color={color} size={size} />,
        }}
      />
      {/* TN-19 — góp ý khách hàng 11/09/2026: đổi tên hiển thị thành "Tra Cứu" (thêm thanh tra
          cứu ở PlatesScreen.tsx). Giữ nguyên route name "Plates" — không đổi để khỏi phải sửa
          điều hướng ở nơi khác (vd DashboardScreen điều hướng theo tên route, không theo nhãn). */}
      <Tab.Screen
        name="Plates"
        component={PlatesScreen}
        options={{
          title: 'Tra Cứu',
          tabBarLabel: 'Tra Cứu',
          tabBarIcon: ({ color, size }) => <Icon name="magnify" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'Đã Lưu',
          tabBarLabel: 'Đã Lưu',
          tabBarIcon: ({ color, size }) => <Icon name="folder-multiple-image" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
