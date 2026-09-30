import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import type { ChartSlice } from '@tayninh/shared';
import { useChartHit } from './ChartSection';
import { Legend } from './Legend';

/** Thông số bắt chước bản Chart.js trên web: cutout 68%, viền trắng giữa lát, bo góc nhẹ. */
const CUTOUT = 0.68;
const CORNER = 3; // bán kính bo góc lát (px)
const GAP_PX = 2; // khe trắng giữa các lát (px) — tương đương borderWidth 2 của web

const toRad = (deg: number) => (deg * Math.PI) / 180;
const point = (cx: number, cy: number, r: number, deg: number) => ({
  x: cx + r * Math.cos(toRad(deg)),
  y: cy + r * Math.sin(toRad(deg)),
});

/**
 * Lát donut dạng hình vành khuyên. Bo góc bằng mẹo kinh điển: vẽ hình đã THU VÀO `CORNER` px
 * rồi thêm `stroke` cùng màu, dày 2×CORNER, nối góc `round` → 4 góc tròn bán kính CORNER.
 */
function sectorPath(cx: number, cy: number, ro: number, ri: number, a0: number, a1: number) {
  const o0 = point(cx, cy, ro, a0);
  const o1 = point(cx, cy, ro, a1);
  const i1 = point(cx, cy, ri, a1);
  const i0 = point(cx, cy, ri, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return (
    `M ${o0.x} ${o0.y} A ${ro} ${ro} 0 ${large} 1 ${o1.x} ${o1.y} ` +
    `L ${i1.x} ${i1.y} A ${ri} ${ri} 0 ${large} 0 ${i0.x} ${i0.y} Z`
  );
}

/**
 * Donut + chú giải bên phải (giống web). Chạm lát HOẶC dòng chú giải → `onSlicePress(key)`.
 * Số tổng + nhãn nằm ở tâm vòng tròn.
 */
export function Donut({
  data,
  centerLabel,
  centerValue,
  onSlicePress,
  size = 150,
}: {
  data: ChartSlice[];
  centerLabel: string;
  centerValue: number;
  onSlicePress?: (key: string) => void;
  size?: number;
}) {
  const markHit = useChartHit();
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
      </View>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const ro = size / 2 - 4;
  const ri = ro * CUTOUT;
  const rMid = (ro + ri) / 2;
  const thickness = ro - ri;
  const gapDeg = (GAP_PX / rMid) * (180 / Math.PI);
  // Góc bị "ăn" ở mỗi mép lát do phần thu vào CORNER px + nửa khe trắng.
  const insetDeg = ((CORNER / rMid) * (180 / Math.PI)) + gapDeg / 2;

  const visible = data.filter((d) => d.value > 0);
  let cursor = -90; // bắt đầu từ đỉnh, đi theo chiều kim đồng hồ

  const handle = (key: string) => {
    markHit();
    onSlicePress?.(key);
  };

  const slices = visible.map((slice) => {
    const sweep = (slice.value / total) * 360;
    const start = cursor;
    cursor += sweep;

    // Lát chiếm trọn 360° (chỉ có 1 lát khác 0): hình vành khuyên khép kín → vẽ bằng vòng tròn viền dày.
    if (visible.length === 1) {
      return (
        <Circle
          key={slice.key}
          cx={cx}
          cy={cy}
          r={rMid}
          stroke={slice.color}
          strokeWidth={thickness}
          fill="none"
          onPress={() => handle(slice.key)}
        />
      );
    }

    const a0 = start + insetDeg;
    const a1 = start + sweep - insetDeg;
    // Lát quá mỏng, sau khi thu vào không còn góc → vẽ thẳng, không bo.
    const d =
      a1 - a0 > 0.5
        ? sectorPath(cx, cy, ro - CORNER, ri + CORNER, a0, a1)
        : sectorPath(cx, cy, ro, ri, start + gapDeg / 2, start + sweep - gapDeg / 2);
    const rounded = a1 - a0 > 0.5;

    return (
      <Path
        key={slice.key}
        d={d}
        fill={slice.color}
        stroke={rounded ? slice.color : 'none'}
        strokeWidth={rounded ? CORNER * 2 : 0}
        strokeLinejoin="round"
        onPress={() => handle(slice.key)}
      />
    );
  });

  return (
    <View style={styles.row}>
      <Svg width={size} height={size}>
        {slices}
        <SvgText
          x={cx}
          y={cy - 2}
          fontSize={24}
          fontWeight="bold"
          fill="#0f172a"
          textAnchor="middle"
        >
          {String(centerValue)}
        </SvgText>
        <SvgText x={cx} y={cy + 16} fontSize={11} fill="#94a3b8" textAnchor="middle">
          {centerLabel}
        </SvgText>
      </Svg>
      <Legend items={data} onPress={onSlicePress} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  empty: { paddingVertical: 28, alignItems: 'center' },
  emptyText: { fontSize: 13, color: '#94a3b8' },
});
