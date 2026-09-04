import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { apiRequest, uploadImageAsset } from '../services/api';
import { connectSocket, socket } from '../services/socket';
import { resolveMediaUrl } from '../config';

export default function ChatScreen({ navigation, route }) {
  const conversationId = route.params?.conversationId;
  const otherUser = route.params?.otherUser;
  const [currentUserId, setCurrentUserId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState(Boolean(otherUser?.online));
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await apiRequest('/users/me');
        setCurrentUserId(user?._id || null);
      } catch (error) {
        console.warn('Current user load error:', error.message);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    connectSocket(currentUserId);

    const handleReceiveMessage = ({ message }) => {
      if (!message) return;
      setMessages((prev) => {
        const exists = prev.some((item) => String(item._id) === String(message._id));
        if (exists) return prev;
        return [...prev, message];
      });

      if (String(message.sender?._id || message.sender) === String(otherUser?._id)) {
        socket.emit('message_seen', { messageId: message._id, userId: currentUserId });
      }
    };

    const handleMessageSent = ({ message }) => {
      setMessages((prev) => {
        if (!message) return prev;
        const exists = prev.some((item) => String(item._id) === String(message._id));
        if (exists) return prev;
        return [...prev, message];
      });
    };

    const handleDelivered = ({ message }) => {
      setMessages((prev) => prev.map((item) => (
        String(item._id) === String(message._id) && item.status !== 'seen'
          ? { ...item, status: 'delivered', deliveredAt: message.deliveredAt }
          : item
      )));
    };

    const handleSeen = ({ messageId, status, messageIds = [] }) => {
      const ids = messageIds.length ? messageIds : [messageId];
      setMessages((prev) => prev.map((item) => {
        const itemId = String(item._id || '');
        if (!ids.some((id) => String(id) === itemId)) return item;
        return { ...item, status };
      }));
    };

    const handleTypingStart = ({ userId }) => {
      if (String(userId) === String(otherUser?._id)) setTypingUser(otherUser.username || 'User');
    };

    const handleTypingStop = ({ userId }) => {
      if (String(userId) === String(otherUser?._id)) setTypingUser(null);
    };

    const handleUserOnline = ({ userId }) => {
      if (String(userId) === String(otherUser?._id)) setOnlineStatus(true);
    };

    const handleUserOffline = ({ userId }) => {
      if (String(userId) === String(otherUser?._id)) setOnlineStatus(false);
    };
    const handleMessageError = ({ message }) => alert(message || 'Unable to send message.');

    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_delivered', handleDelivered);
    socket.on('message_seen', handleSeen);
    socket.on('typing_start', handleTypingStart);
    socket.on('typing_stop', handleTypingStop);
    socket.on('user_online', handleUserOnline);
    socket.on('user_offline', handleUserOffline);
    socket.on('message_error', handleMessageError);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (otherUser?._id && currentUserId) socket.emit('typing_stop', { userId: currentUserId, receiverId: otherUser._id });
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_delivered', handleDelivered);
      socket.off('message_seen', handleSeen);
      socket.off('typing_start', handleTypingStart);
      socket.off('typing_stop', handleTypingStop);
      socket.off('user_online', handleUserOnline);
      socket.off('user_offline', handleUserOffline);
      socket.off('message_error', handleMessageError);
    };
  }, [currentUserId, otherUser]);

  useEffect(() => {
    const loadConversation = async () => {
      if (!conversationId) return;

      try {
        const response = await apiRequest(`/conversations/${conversationId}/messages`);
        setMessages(response);
      } catch (error) {
        console.warn('Load messages error:', error.message);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [conversationId]);

  useEffect(() => {
    if (!currentUserId || !conversationId || !otherUser?._id) return;

    const unreadIds = messages
      .filter((item) => String(item.sender?._id || item.sender) === String(otherUser._id) && String(item.receiver?._id || item.receiver) === String(currentUserId) && item.status !== 'seen')
      .map((item) => item._id)
      .filter(Boolean);

    if (unreadIds.length) {
      socket.emit('message_seen', { conversationId, userId: currentUserId, messageIds: unreadIds });
    }
  }, [messages, currentUserId, conversationId, otherUser]);

  useEffect(() => {
    if (messages.length) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim() || !conversationId || !otherUser || !currentUserId) return;

    const payload = {
      conversationId,
      sender: currentUserId,
      receiver: otherUser._id,
      text: text.trim(),
      messageType: 'text',
    };

    socket.emit('send_message', payload);
    setText('');
  };

  const chooseImage = async () => {
    try {
      if (uploadingImage || !conversationId || !otherUser?._id || !currentUserId) return;
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        alert('Allow photo access to send an image.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.uri || (asset.fileSize && asset.fileSize > 25 * 1024 * 1024)) throw new Error('Choose an image smaller than 25 MB.');
      setUploadingImage(true);
      const response = await uploadImageAsset(asset);
      const mediaUrl = response.mediaUrl;

      const payload = {
        conversationId,
        sender: currentUserId,
        receiver: otherUser._id,
        mediaUrl,
        messageType: 'image',
      };

      socket.emit('send_message', payload);
    } catch (error) {
      console.error('[CHAT] image upload failed', error?.message || error);
      alert(error?.message || 'Unable to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTyping = (value) => {
    setText(value);
    if (!otherUser?._id || !currentUserId) return;
    if (value.trim()) {
      socket.emit('typing_start', { userId: currentUserId, receiverId: otherUser._id });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_stop', { userId: currentUserId, receiverId: otherUser._id });
      }, 1200);
    } else {
      socket.emit('typing_stop', { userId: currentUserId, receiverId: otherUser._id });
    }
  };

  const statusText = useMemo(() => {
    if (typingUser) return `${typingUser} is typing...`;
    return onlineStatus ? 'Online' : 'Offline';
  }, [onlineStatus, typingUser]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <TouchableOpacity onPress={() => otherUser?._id && navigation.navigate('UserProfile', { userId: otherUser._id })}><Image source={{ uri: resolveMediaUrl(otherUser?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }} style={styles.headerAvatar} /></TouchableOpacity>
          <View>
            <Text style={styles.userName}>{otherUser?.username || 'User'}</Text>
            <Text style={styles.userStatus}>{statusText}</Text>
          </View>
        </View>

        <View style={{ width: 30 }} />
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="small" color="#111827" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => String(item._id || `${item.conversation || conversationId}-${item.createdAt || index}`)}
          contentContainerStyle={styles.chatList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isSentByMe = String(item.sender?._id || item.sender) === String(currentUserId);
            return (
              <View style={[styles.messageRow, isSentByMe && styles.sentRow]}>
                {!isSentByMe ? (
                  <TouchableOpacity onPress={() => otherUser?._id && navigation.navigate('UserProfile', { userId: otherUser._id })}><Image source={{ uri: resolveMediaUrl(otherUser?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }} style={styles.messageAvatar} /></TouchableOpacity>
                ) : null}

                <View style={[styles.bubble, isSentByMe ? styles.sentBubble : styles.receivedBubble]}>
                  {item.messageType === 'image' ? (
                    <Image source={{ uri: resolveMediaUrl(item.mediaUrl) }} style={styles.messageImage} resizeMode="cover" />
                  ) : (
                    <Text style={[styles.messageText, isSentByMe && styles.sentText]}>{item.text}</Text>
                  )}
                  <Text style={[styles.timeText, isSentByMe && styles.sentTime, isSentByMe && item.status === 'seen' && styles.seenTime]}>
                    {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isSentByMe ? ` ${item.status === 'seen' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}` : ''}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputRow}>
          <TouchableOpacity onPress={chooseImage} style={styles.iconButton} disabled={uploadingImage}>
            {uploadingImage ? <ActivityIndicator size="small" color="#111827" /> : <Text style={styles.iconText}>🖼</Text>}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={handleTyping}
            placeholder="Message"
            placeholderTextColor="#9ca3af"
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendText}>Send</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backText: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '600',
  },
  headerUser: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: 10,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  userStatus: {
    fontSize: 12,
    color: '#6b7280',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 18,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  sentRow: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  bubble: {
    maxWidth: '72%',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  receivedBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  sentBubble: {
    backgroundColor: '#111827',
    borderBottomRightRadius: 4,
  },
  messageText: {
    color: '#111827',
    fontSize: 15,
    lineHeight: 20,
  },
  sentText: {
    color: '#fff',
  },
  timeText: {
    marginTop: 4,
    fontSize: 10,
    color: '#6b7280',
  },
  sentTime: {
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'right',
  },
  seenTime: { color: '#7dd3fc' },
  messageImage: {
    width: 200,
    height: 180,
    borderRadius: 12,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconText: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  sendButton: {
    marginLeft: 8,
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sendText: {
    color: '#fff',
    fontWeight: '700',
  },
});
