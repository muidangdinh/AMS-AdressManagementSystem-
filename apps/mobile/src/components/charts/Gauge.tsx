import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Cung tròn từ góc `a0` đến `a1` (độ, tăng dần = theo chiều kim đồng hồ; 180° = điểm bên trái). */
function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const s = { x: cx + r * Math.cos(toRad(a0)), y: cy + r * Math.sin(toRad(a0)) };
  const e = { x: cx + r * Math.cos(toRad(a1)), y: cy + r * Math.sin(toRad(a1)) };
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
}

/**
 * Đồng hồ bán nguyệt cho 1 chỉ số phần trăm (tiến độ gắn biển, hoàn tất khảo sát, phương án
 * đã duyệt) — bắt chước `GaugeChart` của web: phần còn lại xám `#e2e8f0`, `{pct}%` + nhãn ở tâm.
 */
export function Gauge({
  value,
  label,
  color,
  width = 170,
}: {
  value: number;
  label: string;
  color: string;
  width?: number;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const stroke = 16;
  const r = width / 2 - stroke / 2 - 2;
  const cx = width / 2;
  const cy = r + stroke / 2 + 2;
  const height = cy + stroke / 2 + 26; // chừa chỗ cho chữ dưới tâm cung

  return (
    <View style={styles.wrap}>
      <Svg width={width} height={height}>
        <Path
          d={arc(cx, cy, r, 180, 360)}
          stroke="#e2e8f0"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
        />
        {pct > 0 ? (
          <Path
            d={arc(cx, cy, r, 180, 180 + pct * 1.8)}
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
        <SvgText
          x={cx}
          y={cy - 4}
          fontSize={22}
          fontWeight="bold"
          fill="#0f172a"
          textAnchor="middle"
        >
          {`${pct}%`}
        </SvgText>
        <SvgText x={cx} y={cy + 14} fontSize={11} fill="#94a3b8" textAnchor="middle">
          {label}
        </SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
});
