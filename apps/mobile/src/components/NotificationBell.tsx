import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useUnread } from '../lib/UnreadContext';

/** Chuông thông báo trên header — badge số chưa đọc, bấm mở màn hình Thông báo. */
export default function NotificationBell() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { count } = useUnread();

  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Notifications')}
      style={styles.button}
      accessibilityLabel={count > 0 ? `Thông báo, ${count} chưa đọc` : 'Thông báo'}
    >
      <Icon name="bell-outline" size={24} color="#2563eb" />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 14, padding: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});
