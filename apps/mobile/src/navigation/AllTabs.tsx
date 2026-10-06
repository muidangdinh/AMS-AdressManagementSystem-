import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DashboardScreen from '../screens/DashboardScreen';
import MapScreen from '../screens/MapScreen';
import AssignmentsScreen from '../screens/AssignmentsScreen';
import SurveyScreen from '../screens/SurveyScreen';
import PlatesScreen from '../screens/PlatesScreen';
import InstallScreen from '../screens/InstallScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { tabScreenOptions } from './tabHeader';
import type { MainTabsParamList } from './MainTabs';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/** Người có cả quyền khảo sát lẫn thi công (admin, kiêm nhiệm): đủ 7 tab. */
export default function AllTabs() {
  return (
    <Tab.Navigator
      screenOptions={tabScreenOptions('all')}
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
        name="Install"
        component={InstallScreen}
        options={{
          title: 'Thi Công',
          tabBarLabel: 'Thi Công',
          tabBarIcon: ({ color, size }) => <Icon name="hammer-wrench" color={color} size={size} />,
        }}
      />
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
