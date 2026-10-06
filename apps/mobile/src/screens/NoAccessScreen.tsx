import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../lib/AuthContext';

/** Tài khoản không có quyền khảo sát cũng không có quyền thi công → không dùng được app. */
export default function NoAccessScreen() {
  const { user, logout } = useAuth();
  return (
    <View style={styles.container}>
      <Icon name="shield-lock-outline" size={56} color="#94a3b8" />
      <Text style={styles.title}>Tài khoản chưa được cấp quyền dùng app</Text>
      <Text style={styles.desc}>
        {user?.fullName ? `${user.fullName} chưa` : 'Tài khoản chưa'} có quyền khảo sát hoặc thi công. Vui lòng liên hệ
        quản trị viên để được cấp quyền, sau đó mở lại app.
      </Text>
      <TouchableOpacity style={styles.btn} onPress={() => logout()}>
        <Text style={styles.btnText}>Đăng xuất</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: '#f8fafc', gap: 12 },
  title: { fontSize: 17, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  desc: { fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 19 },
  btn: { marginTop: 8, backgroundColor: '#e11d48', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
