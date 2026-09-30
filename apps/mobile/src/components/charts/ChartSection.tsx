import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Cho các biểu đồ con báo "vừa chạm trúng lát/thanh" để khung ngoài KHÔNG bung/thu khối chi tiết
 * trong cùng lần chạm (giống web: chạm lát → mở danh sách, chạm nền → bung chi tiết).
 */
const ChartHitContext = createContext<() => void>(() => {});
export const useChartHit = () => useContext(ChartHitContext);

/** Sau khi 1 phần tử báo trúng, khung ngoài bỏ qua lần toggle trong khoảng này (ms). */
const HIT_WINDOW_MS = 400;
/** Chờ 1 nhịp để phần tử con kịp báo trúng trước khi khung ngoài quyết định toggle (ms). */
const TOGGLE_DEFER_MS = 80;

/**
 * Khung dùng chung cho mọi mục Dashboard — đồng bộ hành vi với web (`ChartSection`):
 * mặc định chỉ hiện biểu đồ; chạm vào nền biểu đồ (hoặc nút ▾) mới bung khối số liệu chi tiết
 * (thẻ số / danh sách xếp hạng) ra bên dưới.
 */
export function ChartSection({
  title,
  subtitle,
  children,
  details,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  details: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  const hit = useRef(false);

  const markHit = useCallback(() => {
    hit.current = true;
    setTimeout(() => {
      hit.current = false;
    }, HIT_WINDOW_MS);
  }, []);

  const toggleFromBackground = useCallback(() => {
    setTimeout(() => {
      if (hit.current) {
        hit.current = false;
        return;
      }
      setExpanded((v) => !v);
    }, TOGGLE_DEFER_MS);
  }, []);

  return (
    <View style={styles.section}>
      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <Pressable
          onPress={() => {
            markHit();
            setExpanded((v) => !v);
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Thu gọn số liệu chi tiết' : 'Xem số liệu chi tiết'}
          style={styles.chevronBtn}
        >
          <Text style={styles.chevron}>{expanded ? '▴' : '▾'}</Text>
        </Pressable>
      </View>

      <Pressable onPress={toggleFromBackground} style={styles.card}>
        <ChartHitContext.Provider value={markHit}>{children}</ChartHitContext.Provider>
        <Text style={styles.hint}>
          Chạm vào lát/thanh để xem danh sách · chạm nền để {expanded ? 'thu gọn' : 'xem'} số liệu
          chi tiết
        </Text>
      </Pressable>

      {expanded ? <View style={styles.details}>{details}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8, marginHorizontal: 16 },
  titleText: { flex: 1 },
  title: { fontSize: 14, fontWeight: '700', color: '#1e293b' },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  chevronBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  chevron: { fontSize: 13, color: '#64748b', fontWeight: '700' },
  card: {
    marginHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
  },
  hint: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 10 },
  details: { marginTop: 10 },
});
