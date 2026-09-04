import React, { useCallback, useEffect, useState } from 'react';
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
import { connectSocket } from '../services/socket';
import { resolveMediaUrl } from '../config';
import { socket } from '../services/socket';
import { useFocusEffect } from '@react-navigation/native';
import { openProfileImageViewer } from '../services/profileImageViewer';

export default function InboxScreen({ navigation }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  const refreshConversations = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const response = await apiRequest(`/conversations?userId=${currentUserId}`);
      const unique = new Map((Array.isArray(response) ? response : []).map((conversation) => [String(conversation._id), conversation]));
      setConversations([...unique.values()]);
    } catch (error) {
      console.warn('Inbox load error:', error.message);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await apiRequest('/users/me');
        setCurrentUserId(user?._id || null);
        if (user?._id) connectSocket(user._id);
      } catch (error) {
        console.warn('Current user load error:', error.message);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    refreshConversations();
  }, [currentUserId, refreshConversations]);

  useFocusEffect(useCallback(() => { refreshConversations(); }, [refreshConversations]));

  useEffect(() => {
    if (!currentUserId) return;
    const refreshForMessage = ({ message }) => {
      if (!message?.conversation) return;
      refreshConversations();
    };
    socket.on('receive_message', refreshForMessage);
    socket.on('message_sent', refreshForMessage);
    return () => {
      socket.off('receive_message', refreshForMessage);
      socket.off('message_sent', refreshForMessage);
    };
  }, [currentUserId, refreshConversations]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#111827" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.logo}>Inbox</Text>
        <View style={{ width: 48 }} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const otherUser = item.otherUser || item.participants?.find((user) => String(user._id) !== String(currentUserId));
          const displayName = otherUser?.username || 'User';
          const image = resolveMediaUrl(otherUser?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80';
          const isOnline = Boolean(otherUser?.online);

          return (
            <View style={styles.chatRow}>
              <TouchableOpacity style={styles.avatarWrap} onPress={() => openProfileImageViewer(navigation, otherUser)}>
                <Image source={{ uri: image }} style={styles.avatar} />
                {isOnline ? <View style={styles.onlineDot} /> : null}
              </TouchableOpacity>

              <TouchableOpacity style={styles.textWrap} onPress={() => navigation.navigate('ChatThread', { conversationId: item._id, userId: currentUserId, otherUser })}>
                <View style={styles.nameRow}>
                  <Text style={styles.username}>{displayName}</Text>
                  {item.unreadCount ? <View style={styles.badge}><Text style={styles.badgeText}>{item.unreadCount}</Text></View> : null}
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>{item.latestMessage?.messageType === 'image' ? '📷 Photo' : item.latestMessage?.text || item.lastMessage || ''}</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logo: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  backText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
  },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  onlineDot: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#22c55e',
  },
  textWrap: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  lastMessage: {
    fontSize: 13,
    color: '#6b7280',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111827',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});
