import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import MapScreen from '../screens/MapScreen';
import PlatesScreen from '../screens/PlatesScreen';
import InstallScreen from '../screens/InstallScreen';
import { tabScreenOptions } from './tabHeader';
import type { MainTabsParamList } from './MainTabs';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/** Phân hệ THI CÔNG: 3 tab (Thi công, Bản đồ, Tra cứu) — tab đầu là nhiệm vụ thi công. */
export default function InstallTabs() {
  return (
    <Tab.Navigator initialRouteName="Install" screenOptions={tabScreenOptions('install')}>
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
        name="Map"
        component={MapScreen}
        options={{
          title: 'Bản Đồ',
          tabBarLabel: 'Bản Đồ',
          tabBarIcon: ({ color, size }) => <Icon name="map-search" color={color} size={size} />,
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
    </Tab.Navigator>
  );
}
