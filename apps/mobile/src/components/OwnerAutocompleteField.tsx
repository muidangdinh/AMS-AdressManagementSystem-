import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { OwnerSearchResult } from '@tayninh/shared';
import { HOUSE_STATUS_LABELS } from '@tayninh/shared';
import { searchOwners } from '../lib/surveysApi';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 400;
const MAX_SUGGESTIONS = 6;

/** Che bớt CCCD để không lộ đủ số trên màn hình gợi ý (vd 0123•••789). */
function maskId(id: string | null): string {
  if (!id) return '';
  return id.length <= 7 ? id : `${id.slice(0, 4)}•••${id.slice(-3)}`;
}

/** Bỏ dấu từng ký tự (độ dài giữ nguyên) để so khớp từ khoá không dấu mà vẫn tô đậm đúng vị trí trong chuỗi gốc. */
function foldChar(c: string): string {
  if (c === 'đ') return 'd';
  if (c === 'Đ') return 'D';
  const f = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
  return f.length === 1 ? f : c;
}

/** Tách tên thành các đoạn, đoạn trùng từ khoá được tô đậm (không phân biệt hoa/thường và dấu). */
function highlight(name: string, query: string): { text: string; bold: boolean }[] {
  const q = query.trim();
  if (!q) return [{ text: name, bold: false }];
  const fold = (s: string) => [...s].map(foldChar).join('').toLowerCase();
  const hay = fold(name);
  const idx = hay.indexOf(fold(q));
  if (idx < 0 || hay.length !== name.length) return [{ text: name, bold: false }];
  const end = idx + q.length;
  return [
    { text: name.slice(0, idx), bold: false },
    { text: name.slice(idx, end), bold: true },
    { text: name.slice(end), bold: false },
  ].filter((p) => p.text);
}

/**
 * Ô nhập có gợi ý chủ hộ đã có trong hệ thống (khảo sát mobile). Gõ tên hoặc SĐT → dropdown ngay dưới ô
 * kèm thông tin chi tiết (SĐT, CCCD che bớt, khu vực, số nhà); chạm 1 dòng → `onPick` để màn hình tự điền
 * form. Vẫn nhập tay bình thường; mất mạng thì im lặng không hiện gợi ý.
 */
export default function OwnerAutocompleteField({
  label,
  value,
  onChangeText,
  onPick,
  enabled = true,
  style,
  ...inputProps
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onPick: (owner: OwnerSearchResult) => void;
  /** Tắt gợi ý (vd đang sửa lại nhà có sẵn). */
  enabled?: boolean;
  style?: object;
} & Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChangeText' | 'style'>) {
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<OwnerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = value.trim();

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
    // Chỉ gợi ý khi người dùng đang gõ trong ô (điền tự động từ gợi ý khác không kích hoạt tìm lại).
    if (!enabled || !focused || query.length < MIN_CHARS) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await searchOwners(query, controller.signal);
        if (controller.signal.aborted) return;
        setResults(res.slice(0, MAX_SUGGESTIONS));
        setSearched(true);
      } catch {
        // Mất mạng/lỗi — im lặng, nhập tay vẫn dùng được.
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(false);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, focused, enabled]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const showDropdown = enabled && focused && query.length >= MIN_CHARS && (results.length > 0 || (searched && !loading));

  return (
    <View style={style}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          {...inputProps}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          // Trễ 1 nhịp khi mất focus để cú chạm vào dòng gợi ý kịp được xử lý.
          onBlur={() => setTimeout(() => setFocused(false), 200)}
        />
        {loading && <ActivityIndicator size="small" color="#2563eb" style={styles.spinner} />}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {results.length === 0 ? (
            <Text style={styles.noResult}>Không có chủ hộ trùng — tiếp tục nhập mới</Text>
          ) : (
            results.map((o, i) => (
              <TouchableOpacity
                key={`${o.ownerName}|${o.ownerPhone}|${o.ownerIdNumber}`}
                style={[styles.row, i > 0 && styles.rowBorder]}
                onPress={() => {
                  setFocused(false);
                  onPick(o);
                }}
              >
                <Text style={styles.name}>
                  {highlight(o.ownerName, query).map((p, k) => (
                    <Text key={k} style={p.bold ? styles.nameBold : undefined}>
                      {p.text}
                    </Text>
                  ))}
                </Text>
                <Text style={styles.meta}>
                  {[o.ownerPhone, o.ownerIdNumber ? `CCCD ${maskId(o.ownerIdNumber)}` : null].filter(Boolean).join(' • ') ||
                    'Chưa có SĐT/CCCD'}
                </Text>
                <Text style={styles.meta}>
                  {[o.latest?.hamletName, o.latest?.ward].filter(Boolean).join(', ') || 'Chưa rõ khu vực'} • {o.houseCount} nhà
                </Text>
                {o.houses.slice(0, 2).map((h) => (
                  <Text key={h.id} style={styles.house} numberOfLines={1}>
                    Số {h.houseNumber} {h.street} • {HOUSE_STATUS_LABELS[h.status]}
                  </Text>
                ))}
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // Cùng kiểu với nhãn của ô `Field` trong SurveyScreen để các ô chủ hộ đồng bộ với phần còn lại của form.
  label: { fontSize: 11, fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    marginTop: 4,
    backgroundColor: '#f8fafc',
  },
  spinner: { position: 'absolute', right: 10, top: 14 },
  dropdown: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  row: { paddingHorizontal: 12, paddingVertical: 9, gap: 1 },
  rowBorder: { borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  name: { fontSize: 14, color: '#0f172a' },
  nameBold: { fontWeight: '800', color: '#1d4ed8' },
  meta: { fontSize: 11, color: '#475569' },
  house: { fontSize: 11, color: '#64748b' },
  noResult: { padding: 12, fontSize: 12, color: '#94a3b8' },
});
