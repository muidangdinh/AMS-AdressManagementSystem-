import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../lib/AuthContext';
import { ApiError } from '../lib/api';
import { fetchAppConfig } from '../lib/appConfig';

/** Dự phòng khi chưa tải được cấu hình (mất mạng lúc mở app lần đầu) — không chặn màn đăng nhập. */
const FALLBACK_PROVINCE_NAME = 'Tỉnh Tây Ninh';
const FALLBACK_APP_SHORT_NAME = 'AMS';

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // TN-11 — thương hiệu AMS + tên tỉnh (góp ý khách hàng 11/09/2026). KHÔNG
  // hiện tên xã ở đây — chưa đăng nhập thì chưa biết ngữ cảnh xã (xem TN-14).
  const [provinceName, setProvinceName] = useState(FALLBACK_PROVINCE_NAME);
  const [appShortName, setAppShortName] = useState(FALLBACK_APP_SHORT_NAME);

  useEffect(() => {
    fetchAppConfig()
      .then((cfg) => {
        setProvinceName(cfg.provinceName);
        setAppShortName(cfg.appShortName);
      })
      .catch(() => {
        // Mất mạng lúc mở app — giữ giá trị dự phòng, không chặn đăng nhập.
      });
  }, []);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      await login({ username, password });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Đăng nhập thất bại');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{appShortName}</Text>
          <Text style={styles.subtitle}>{provinceName}</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>Tên đăng nhập</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Đăng nhập</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9', justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  header: { backgroundColor: '#0f172a', padding: 24 },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  subtitle: { color: '#94a3b8', fontSize: 12, marginTop: 4 },
  form: { padding: 24, gap: 4 },
  errorBox: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: '#b91c1c', fontSize: 13 },
  label: { fontSize: 11, fontWeight: '700', color: '#334155', textTransform: 'uppercase', marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginTop: 6,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    marginTop: 6,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  eyeBtn: { paddingHorizontal: 10, paddingVertical: 8 },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
