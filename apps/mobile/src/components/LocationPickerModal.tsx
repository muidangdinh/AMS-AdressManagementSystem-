import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

/**
 * Chọn tọa độ bằng cách kéo thả ghim trên bản đồ — thay thế/bổ sung cho
 * "Cập nhật GPS" khi máy không bắt được tín hiệu vệ tinh (trong nhà, khu vực
 * sóng yếu) nhưng khảo sát viên biết rõ vị trí trên bản đồ. Dùng chung thư
 * viện react-native-maps đã có ở MapScreen.tsx, không kéo thêm dependency mới.
 */
export default function LocationPickerModal({
  visible,
  initialLat,
  initialLng,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialLat: number;
  initialLng: number;
  onClose: () => void;
  onConfirm: (lat: number, lng: number) => void;
}) {
  const [coord, setCoord] = useState({ latitude: initialLat, longitude: initialLng });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Chọn vị trí trên bản đồ</Text>
          <Text style={styles.hint}>Kéo thả ghim để chọn đúng vị trí căn nhà</Text>
        </View>

        <MapView
          style={styles.map}
          initialRegion={{
            latitude: initialLat,
            longitude: initialLng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Marker
            coordinate={coord}
            draggable
            onDragEnd={(e) => setCoord(e.nativeEvent.coordinate)}
          />
        </MapView>

        <View style={styles.coordRow}>
          <Text style={styles.coordText}>
            {coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnCancel]} onPress={onClose}>
            <Text style={styles.btnCancelText}>Hủy</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.btnConfirm]}
            onPress={() => onConfirm(coord.latitude, coord.longitude)}
          >
            <Text style={styles.btnConfirmText}>Xác nhận vị trí</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { padding: 16, paddingTop: 48, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
  hint: { fontSize: 12, color: '#64748b', marginTop: 4 },
  map: { flex: 1 },
  coordRow: { padding: 10, alignItems: 'center', backgroundColor: '#f8fafc' },
  coordText: { fontFamily: 'monospace', fontSize: 13, color: '#0f172a' },
  actions: { flexDirection: 'row', gap: 10, padding: 16 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnCancel: { backgroundColor: '#f1f5f9' },
  btnCancelText: { color: '#475569', fontWeight: '700' },
  btnConfirm: { backgroundColor: '#1d4ed8' },
  btnConfirmText: { color: '#fff', fontWeight: '700' },
});
