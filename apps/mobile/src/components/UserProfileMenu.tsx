import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../lib/AuthContext';

/**
 * Icon hồ sơ người dùng trên header — bấm mở dropdown nhỏ neo góc phải trên, gồm 2 mục "Tài khoản"
 * và "Đăng xuất" (thay cho chữ "Đăng xuất" cũ), đồng bộ với dropdown hồ sơ người dùng trên web.
 */
export default function UserProfileMenu() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  function goToAccount() {
    setOpen(false);
    navigation.navigate('Account');
  }

  async function handleLogout() {
    setOpen(false);
    await logout();
  }

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.button}
        accessibilityLabel="Hồ sơ người dùng"
      >
        <Icon name="account-circle-outline" size={26} color="#2563eb" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={styles.menu}>
            <TouchableOpacity style={styles.item} onPress={goToAccount}>
              <Icon name="account-outline" size={18} color="#334155" />
              <Text style={styles.itemText}>Tài khoản</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.item} onPress={handleLogout}>
              <Icon name="logout" size={18} color="#e11d48" />
              <Text style={[styles.itemText, styles.logoutText]}>Đăng xuất</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { marginRight: 14, padding: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.15)' },
  menu: {
    position: 'absolute',
    top: 56,
    right: 14,
    width: 170,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  itemText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  logoutText: { color: '#e11d48' },
  divider: { height: 1, backgroundColor: '#f1f5f9', marginHorizontal: 8 },
});
