import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useChartHit } from './ChartSection';

export interface BarItem {
  key: string;
  name: string;
  value: number;
}

/**
 * Bar ngang cho các mục xếp hạng (tuyến đường, số nhà trùng…) — tương ứng `BarChartH` của web:
 * thanh bo góc, tên cắt bớt, SỐ ở cuối thanh, mỗi hàng bấm được.
 */
export function BarList({
  data,
  onBarPress,
  color = '#3b82f6',
  emptyText = 'Chưa có dữ liệu',
}: {
  data: BarItem[];
  onBarPress?: (key: string) => void;
  color?: string;
  emptyText?: string;
}) {
  const markHit = useChartHit();

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <View>
      {data.map((item) => (
        <Pressable
          key={item.key}
          disabled={!onBarPress}
          onPress={() => {
            markHit();
            onBarPress?.(item.key);
          }}
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.track}>
            <View
              style={[
                styles.bar,
                { width: `${Math.max((item.value / max) * 100, 2)}%`, backgroundColor: color },
              ]}
            />
          </View>
          <Text style={styles.value}>{item.value}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  rowPressed: { backgroundColor: '#f1f5f9' },
  name: { width: '34%', fontSize: 12, color: '#475569', paddingRight: 8 },
  track: { flex: 1, height: 20, justifyContent: 'center' },
  bar: { height: 20, borderRadius: 6 },
  value: {
    minWidth: 28,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginLeft: 6,
  },
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#94a3b8' },
});
