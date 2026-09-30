import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { USER_ROLE_LABELS, UserRole } from '@tayninh/shared';
import { useAuth } from '../lib/AuthContext';
import { ApiError } from '../lib/api';

/**
 * Màn "Tài khoản" — xem thông tin người đang đăng nhập + tự đổi mật khẩu. Đồng bộ với trang
 * `/houses/account` trên web: đọc thẳng `useAuth().user` (không gọi API), đổi mật khẩu qua
 * cùng endpoint `/api/auth/me/password` (bắt buộc đúng mật khẩu hiện tại).
 */
export default function AccountScreen() {
  const { user, changePassword } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleSubmit() {
    setError(null);
    setSuccess(false);
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải từ 6 ký tự trở lên');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới nhập lại không khớp');
      return;
    }
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không đổi được mật khẩu');
    } finally {
      setSaving(false);
    }
  }

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Row label="Họ tên" value={user.fullName} />
        <Row label="Tên đăng nhập" value={user.username} />
        <Row label="Vai trò" value={USER_ROLE_LABELS[user.role as UserRole]} />
        <Row label="Đơn vị" value={user.unit ?? '—'} />
        <Row label="Chức vụ" value={user.position ?? '—'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Đổi mật khẩu</Text>

        <Text style={styles.fieldLabel}>Mật khẩu hiện tại</Text>
        <PasswordField
          value={currentPassword}
          onChangeText={setCurrentPassword}
          visible={showCurrent}
          onToggleVisible={() => setShowCurrent((v) => !v)}
        />

        <Text style={styles.fieldLabel}>Mật khẩu mới</Text>
        <PasswordField
          value={newPassword}
          onChangeText={setNewPassword}
          visible={showNew}
          onToggleVisible={() => setShowNew((v) => !v)}
          placeholder="Tối thiểu 6 ký tự"
        />

        <Text style={styles.fieldLabel}>Xác nhận mật khẩu mới</Text>
        <PasswordField
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          visible={showConfirm}
          onToggleVisible={() => setShowConfirm((v) => !v)}
        />

        {error && <Text style={styles.errorText}>{error}</Text>}
        {success && <Text style={styles.successText}>Đổi mật khẩu thành công.</Text>}

        <TouchableOpacity
          style={[styles.submitButton, saving && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={saving}
        >
          {saving && <ActivityIndicator color="#fff" size="small" />}
          <Text style={styles.submitButtonText}>Đổi mật khẩu</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/** Ô mật khẩu có icon con mắt để hiện/ẩn — đồng bộ với ô mật khẩu trên web. */
function PasswordField({
  value,
  onChangeText,
  visible,
  onToggleVisible,
  placeholder,
}: {
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={[styles.input, styles.passwordInput]}
      />
      <TouchableOpacity
        onPress={onToggleVisible}
        style={styles.eyeButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Icon name={visible ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748b" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1d4ed8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowLabel: { fontSize: 13, color: '#64748b' },
  rowValue: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#475569', marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  passwordWrap: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 40 },
  eyeButton: { position: 'absolute', right: 10 },
  errorText: { fontSize: 12, color: '#e11d48', marginTop: 10 },
  successText: { fontSize: 12, color: '#059669', marginTop: 10 },
  submitButton: {
    marginTop: 14,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
