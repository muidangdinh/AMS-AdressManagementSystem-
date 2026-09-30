import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CHART_COLORS, type StackedBarItem } from '@tayninh/shared';
import { useChartHit } from './ChartSection';

/**
 * Bar ngang chồng "đã có số" (xanh lá) / "chưa có số" (vàng) — tương ứng `StackedBarChart` của web
 * (dùng cho thống kê theo xã/phường, ấp). Cuối mỗi thanh hiện TỔNG số nhà vì trên cảm ứng không có
 * tooltip khi rê chuột.
 */
export function StackedBarList({
  data,
  onBarPress,
}: {
  data: StackedBarItem[];
  onBarPress?: (key: string) => void;
}) {
  const markHit = useChartHit();

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
      </View>
    );
  }

  const max = Math.max(...data.map((d) => d.approved + d.withoutNumber), 1);

  return (
    <View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: CHART_COLORS.green }]} />
          <Text style={styles.legendText}>Đã có số</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: CHART_COLORS.amber }]} />
          <Text style={styles.legendText}>Chưa có số</Text>
        </View>
      </View>

      {data.map((item) => {
        const total = item.approved + item.withoutNumber;
        return (
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
              <View style={[styles.stack, { width: `${Math.max((total / max) * 100, 2)}%` }]}>
                {item.approved > 0 ? (
                  <View
                    style={{ flex: item.approved, backgroundColor: CHART_COLORS.green }}
                  />
                ) : null}
                {item.withoutNumber > 0 ? (
                  <View
                    style={{ flex: item.withoutNumber, backgroundColor: CHART_COLORS.amber }}
                  />
                ) : null}
              </View>
            </View>
            <Text style={styles.value}>{total}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginBottom: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  legendText: { fontSize: 12, color: '#475569' },
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
  // overflow hidden để 2 đoạn màu ăn theo góc bo của cả thanh.
  stack: { height: 20, flexDirection: 'row', borderRadius: 6, overflow: 'hidden' },
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
