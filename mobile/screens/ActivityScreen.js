import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { apiRequest } from '../services/api';
import { socket } from '../services/socket';
import { resolveMediaUrl } from '../config';

export default function ActivityScreen({ navigation }) {
  const [userId, setUserId] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const items = await apiRequest(`/notifications?userId=${userId}`);
      setNotifications(items || []);
    } catch (loadError) {
      setError(loadError.message || 'Unable to load notifications');
      setNotifications([]);
      console.warn('Notification load error:', loadError.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await apiRequest('/users/me');
        setUserId(user?._id || null);
      } catch (loadError) {
        setError(loadError.message || 'Unable to load current user');
        console.warn('Current user load error:', loadError.message);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadNotifications();
  }, [userId, loadNotifications]);

  useEffect(() => {
    const handler = ({ notification }) => {
      if (!notification || String(notification.recipient) !== String(userId)) return;
      setNotifications((prev) => [notification, ...prev]);
    };

    socket.on('notification_received', handler);
    return () => socket.off('notification_received', handler);
  }, [userId]);

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);

  const markRead = async (notificationId) => {
    if (!userId) return;
    try {
      await apiRequest(`/notifications/${notificationId}/read`, {
        method: 'PATCH',
        body: JSON.stringify({ userId }),
      });
      setNotifications((prev) => prev.map((item) => (String(item._id) === String(notificationId) ? { ...item, read: true } : item)));
    } catch (loadError) {
      console.warn('Mark read failed:', loadError.message);
    }
  };

  const markAllAsRead = async () => {
    if (!userId) return;
    try {
      await apiRequest('/notifications/read-all', {
        method: 'PATCH',
        body: JSON.stringify({ userId }),
      });
      setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (loadError) {
      console.warn('Mark all read failed:', loadError.message);
    }
  };

  const renderItem = ({ item }) => {
    const senderName = item.sender?.username || 'Someone';
    const text = item.message || 'New activity';
    const thumbnail = item.post?.mediaUrl || item.reel?.videoUrl || item.sender?.profilePicture;

    const openActivity = () => {
          markRead(item._id);
          if (item.post?._id || item.post) {
            navigation.navigate('PostDetail', { postId: item.post?._id || item.post });
          } else if (item.reel?._id || item.reel) {
            navigation.navigate('ReelViewer', { reelId: item.reel?._id || item.reel });
          } else if (item.sender?._id) {
            navigation.navigate('UserProfile', { userId: item.sender._id });
          }
        };
    return (
      <View style={[styles.row, !item.read && styles.unreadRow]}>
        <TouchableOpacity onPress={() => item.sender?._id && (String(item.sender._id) === String(userId) ? navigation.navigate('ProfileViewer') : navigation.navigate('UserProfile', { userId: item.sender._id }))}><Image source={{ uri: resolveMediaUrl(item.sender?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }} style={styles.avatar} /></TouchableOpacity>
        <TouchableOpacity style={styles.textWrap} onPress={openActivity}>
          <Text style={styles.messageText}>{senderName} {text}</Text>
          <Text style={styles.timeText}>{new Date(item.createdAt).toLocaleDateString()}</Text>
        </TouchableOpacity>
        {thumbnail ? <Image source={{ uri: thumbnail }} style={styles.thumb} /> : null}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{error}</Text>
          <TouchableOpacity onPress={loadNotifications} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <Text style={styles.logo}>Activity</Text>
        {unreadCount ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={styles.emptyState}><Text style={styles.emptyText}>No notifications yet.</Text></View>}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logo: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  markAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#111827',
  },
  markAllText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  unreadRow: {
    backgroundColor: '#f8fafc',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    marginRight: 12,
  },
  textWrap: {
    flex: 1,
  },
  messageText: {
    color: '#111827',
    fontSize: 14,
    lineHeight: 20,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: '#e5e7eb',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
