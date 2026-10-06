import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp, ParamListBase } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { NOTIFICATION_TYPE_LABELS, NotificationEntity, NotificationType } from '@tayninh/shared';
import type { AppNotification } from '@tayninh/shared';
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../lib/notificationsApi';
import { useUnread } from '../lib/UnreadContext';
import { useAuth } from '../lib/AuthContext';

const TYPE_ICON: Record<NotificationType, { name: string; color: string }> = {
  [NotificationType.ASSIGNED]: { name: 'account-arrow-right-outline', color: '#2563eb' },
  [NotificationType.STATUS_CHANGED]: { name: 'swap-horizontal', color: '#64748b' },
  [NotificationType.DUE_SOON]: { name: 'clock-alert-outline', color: '#d97706' },
  [NotificationType.OVERDUE]: { name: 'alert-circle-outline', color: '#dc2626' },
  [NotificationType.REMINDER]: { name: 'bell-ring-outline', color: '#d97706' },
  [NotificationType.ISSUE_REPORTED]: { name: 'flag-outline', color: '#dc2626' },
};

function timeAgo(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'Vừa xong';
  if (min < 60) return `${min} phút trước`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} giờ trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

/** Danh sách thông báo (Phase 11). Bấm một thông báo: đánh dấu đã đọc rồi mở màn hình liên quan. */
export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { count, setCount, refresh } = useUnread();
  const { availableModes } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await fetchNotifications());
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không tải được thông báo');
    }
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load().finally(() => setLoading(false));
    }, [load]),
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handlePress(n: AppNotification) {
    if (!n.readAt) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      setCount((c) => Math.max(0, c - 1));
      markNotificationRead(n.id).catch(() => refresh());
    }
    // Chỉ nhiệm vụ khảo sát có màn hình trên mobile; hồ sơ hành chính/công việc xem ở web.
    // Tab đích chỉ tồn tại khi tài khoản có quyền tương ứng (đủ 2 quyền thì có cả hai).
    if (n.entityType === NotificationEntity.INSTALL_ASSIGNMENT) {
      if (availableModes.includes('install')) navigation.navigate('Main', { screen: 'Install' });
      return;
    }
    if (n.entityType === NotificationEntity.SURVEY_ASSIGNMENT) {
      if (availableModes.includes('survey')) navigation.navigate('Main', { screen: 'Assignments' });
    }
  }

  async function handleReadAll() {
    try {
      await markAllNotificationsRead();
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? now })));
      setCount(0);
    } catch {
      refresh();
    }
  }

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <Text style={styles.toolbarText}>{count > 0 ? `${count} chưa đọc` : 'Đã đọc hết'}</Text>
        <TouchableOpacity onPress={handleReadAll} disabled={count === 0}>
          <Text style={[styles.readAll, count === 0 && styles.readAllDisabled]}>Đánh dấu đã đọc tất cả</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>Chưa có thông báo nào</Text>}
        renderItem={({ item }) => {
          const icon = TYPE_ICON[item.type];
          return (
            <TouchableOpacity
              onPress={() => handlePress(item)}
              style={[styles.row, !item.readAt && styles.rowUnread]}
            >
              <Icon name={icon.name} size={24} color={icon.color} style={styles.rowIcon} />
              <View style={styles.rowBody}>
                <Text style={[styles.title, !item.readAt && styles.titleUnread]}>{item.title}</Text>
                {!!item.body && <Text style={styles.body}>{item.body}</Text>}
                <Text style={styles.meta}>
                  {NOTIFICATION_TYPE_LABELS[item.type]}
                  {item.actor ? ` • ${item.actor.fullName}` : ''} • {timeAgo(item.createdAt)}
                </Text>
              </View>
              {!item.readAt && <View style={styles.dot} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  toolbarText: { fontSize: 13, color: '#475569', fontWeight: '600' },
  readAll: { fontSize: 13, color: '#2563eb', fontWeight: '700' },
  readAllDisabled: { color: '#cbd5e1' },
  error: { color: '#dc2626', padding: 12, fontSize: 13 },
  empty: { textAlign: 'center', color: '#94a3b8', marginTop: 48, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowUnread: { backgroundColor: '#eff6ff' },
  rowIcon: { marginRight: 12, marginTop: 2 },
  rowBody: { flex: 1 },
  title: { fontSize: 14, color: '#475569' },
  titleUnread: { color: '#0f172a', fontWeight: '700' },
  body: { fontSize: 13, color: '#64748b', marginTop: 2 },
  meta: { fontSize: 11, color: '#94a3b8', marginTop: 4 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2563eb', marginTop: 6, marginLeft: 8 },
});
