import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ChartSlice } from '@tayninh/shared';
import { useChartHit } from './ChartSection';

/**
 * Chú giải "● Tên — số lượng". Mỗi dòng cũng bấm được: vùng chạm to hơn hẳn lát donut nhỏ,
 * tránh bấm hụt bằng ngón tay (bản web dùng chuột nên không cần).
 */
export function Legend({
  items,
  onPress,
}: {
  items: ChartSlice[];
  onPress?: (key: string) => void;
}) {
  const markHit = useChartHit();
  return (
    <View style={styles.wrap}>
      {items.map((item) => (
        <Pressable
          key={item.key}
          disabled={!onPress}
          onPress={() => {
            markHit();
            onPress?.(item.key);
          }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <View style={[styles.dot, { backgroundColor: item.color }]} />
          <Text style={styles.name} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={styles.value}>{item.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 8,
  },
  rowPressed: { backgroundColor: '#f1f5f9' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  name: { flex: 1, fontSize: 12, color: '#475569' },
  value: { fontSize: 13, fontWeight: '700', color: '#0f172a', marginLeft: 8 },
});
