import React, { Suspense, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera } from 'react-native-camera-kit';
import { requestCameraPermission } from '../lib/cameraPermission';

export default function ScanQrButton({
  onCode,
  style,
}: {
  onCode: (code: string) => Promise<void> | void;
  style?: StyleProp<ViewStyle>;
}) {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const readingRef = useRef(false);

  async function handlePress() {
    if (busy || visible) return;

    const allowed = await requestCameraPermission(
      'Ứng dụng cần máy ảnh để quét mã QR trên tem nhà.',
    );
    if (!allowed) {
      Alert.alert('Thiếu quyền', 'Cần cấp quyền máy ảnh để quét mã QR.');
      return;
    }

    readingRef.current = false;
    setVisible(true);
  }

  async function handleReadCode(event: { nativeEvent: { codeStringValue: string } }) {
    if (readingRef.current) return;
    readingRef.current = true;
    setVisible(false);
    setBusy(true);
    try {
      await onCode(event.nativeEvent.codeStringValue);
    } catch {
      Alert.alert('Lỗi', 'Không xử lý được mã QR. Kiểm tra kết nối mạng rồi thử lại.');
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setVisible(false);
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={handlePress}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Quét mã QR"
        hitSlop={8}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#2563eb" />
        ) : (
          <Icon name="qrcode-scan" size={20} color="#2563eb" />
        )}
      </TouchableOpacity>

      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={close}
        statusBarTranslucent
      >
        <View style={styles.scanner}>
          <Suspense
            fallback={
              <View style={styles.loading}>
                <ActivityIndicator size="large" color="#fff" />
              </View>
            }
          >
            <Camera
              style={StyleSheet.absoluteFill}
              scanBarcode
              showFrame
              resizeMode="cover"
              allowedBarcodeTypes={['qr']}
              barcodeFrameSize={{ width: 260, height: 260 }}
              scanThrottleDelay={1000}
              frameColor="#fff"
              onReadCode={handleReadCode}
              onError={({ nativeEvent }) => {
                close();
                Alert.alert('Lỗi máy ảnh', nativeEvent.errorMessage);
              }}
            />
          </Suspense>

          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.header}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={close}
                accessibilityRole="button"
                accessibilityLabel="Đóng quét QR"
                hitSlop={8}
              >
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.title}>Quét mã QR nhà</Text>
              <View style={styles.closeButton} />
            </View>
            <Text style={styles.hint}>Đưa mã QR vào khung để quét tự động</Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanner: {
    flex: 1,
    backgroundColor: '#000',
  },
  loading: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'space-between',
    paddingTop: 48,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  hint: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
});
