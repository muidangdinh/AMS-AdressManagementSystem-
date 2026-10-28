import { PermissionsAndroid, Platform } from 'react-native';

export async function requestCameraPermission(message: string): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
    title: 'Quyền truy cập máy ảnh',
    message,
    buttonPositive: 'Đồng ý',
    buttonNegative: 'Từ chối',
  });
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}
