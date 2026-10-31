import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { apiRequest, uploadImageAsset } from '../services/api';
import { connectSocket, socket } from '../services/socket';
import { resolveMediaUrl } from '../config';
import Ionicons from 'react-native-vector-icons/Ionicons';

function getId(value) {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
}

function getMessageKey(message) {
  if (message?.clientMessageId) return String(message.clientMessageId);
  if (message?._id) return String(message._id);
  return '';
}

function isSameMessage(left, right) {
  if (!left || !right) return false;
  if (left.clientMessageId && right.clientMessageId && String(left.clientMessageId) === String(right.clientMessageId)) {
    return true;
  }
  if (left._id && right._id && String(left._id) === String(right._id)) {
    return true;
  }
  return false;
}

function getCreatedAtMs(message) {
  const time = new Date(message?.createdAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

function isLocalMediaUri(uri) {
  return /^(content|file):/i.test(String(uri || '').trim());
}

function getRenderableImageUri(uri) {
  return isLocalMediaUri(uri) ? uri : resolveMediaUrl(uri);
}

function mergeChatMessage(existingMessages, incomingMessage) {
  if (!incomingMessage) return existingMessages;

  const next = [...existingMessages];
  const existingIndex = next.findIndex((item) => isSameMessage(item, incomingMessage));

  if (existingIndex === -1) {
    next.push(incomingMessage);
  } else {
    const current = next[existingIndex];
    next[existingIndex] = {
      ...current,
      ...incomingMessage,
      clientMessageId: incomingMessage.clientMessageId || current.clientMessageId,
      pending: incomingMessage.pending ?? false,
      failed: incomingMessage.failed ?? false,
    };
  }

  return normalizeMessages(next);
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) return [];

  const normalized = [];
  const byClientMessageId = new Map();
  const byServerId = new Map();
  messages.forEach((message) => {
    if (!message) return;
    const clientMessageId = message.clientMessageId ? String(message.clientMessageId) : '';
    const serverId = message._id ? String(message._id) : '';
    const clientIndex = clientMessageId ? byClientMessageId.get(clientMessageId) : undefined;
    const serverIndex = serverId ? byServerId.get(serverId) : undefined;
    const existingIndex = clientIndex ?? serverIndex;

    if (existingIndex === undefined) {
      const index = normalized.length;
      normalized.push(message);
      if (clientMessageId) byClientMessageId.set(clientMessageId, index);
      if (serverId) byServerId.set(serverId, index);
      return;
    }

    const existing = normalized[existingIndex];
    normalized[existingIndex] = {
      ...existing,
      ...message,
      // Keep the optimistic identity after server acknowledgement so FlatList
      // updates the existing row instead of remounting it under its server id.
      clientMessageId: clientMessageId || existing.clientMessageId,
    };
    if (clientMessageId) byClientMessageId.set(clientMessageId, existingIndex);
    if (serverId) byServerId.set(serverId, existingIndex);
  });

  return normalized.sort((left, right) => {
    const timeDiff = getCreatedAtMs(left) - getCreatedAtMs(right);
    if (timeDiff !== 0) return timeDiff;
    return String(getMessageKey(left)).localeCompare(String(getMessageKey(right)));
  });
}

function messagesLookSame(left, right) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (getMessageKey(a) !== getMessageKey(b)) return false;
    if (a._id !== b._id || a.clientMessageId !== b.clientMessageId) return false;
    if (getId(a.sender) !== getId(b.sender) || getId(a.receiver) !== getId(b.receiver)) return false;
    if (a.createdAt !== b.createdAt || a.messageType !== b.messageType) return false;
    if (a.status !== b.status || a.pending !== b.pending || a.failed !== b.failed) return false;
    if (a.text !== b.text || a.mediaUrl !== b.mediaUrl) return false;
  }
  return true;
}

const ChatMessageRow = memo(function ChatMessageRow({
  item,
  isMine,
  otherUser,
  onPressProfile,
  onRetry,
}) {
  return (
    <View style={[styles.messageRow, isMine && styles.sentRow]}>
      {!isMine ? (
        <TouchableOpacity onPress={onPressProfile}>
          <Image
            source={{ uri: resolveMediaUrl(otherUser?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }}
            style={styles.messageAvatar}
          />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => onRetry(item)}
        style={[styles.bubble, isMine ? styles.sentBubble : styles.receivedBubble]}
      >
        {item.messageType === 'image' ? (
          <Image source={{ uri: getRenderableImageUri(item.mediaUrl) }} style={styles.messageImage} resizeMode="cover" />
        ) : (
          <Text style={[styles.messageText, isMine && styles.sentText]}>{item.text}</Text>
        )}
        <Text style={[styles.timeText, isMine && styles.sentTime, isMine && item.status === 'seen' && styles.seenTime]}>
          {new Date(item.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {isMine ? ` ${item.failed ? '!' : item.pending ? '○' : item.status === 'seen' ? '✓✓' : item.status === 'delivered' ? '✓✓' : '✓'}` : ''}
        </Text>
      </TouchableOpacity>
    </View>
  );
});

export default function ChatScreen({ navigation, route }) {
  const conversationId = route.params?.conversationId;
  const otherUser = route.params?.otherUser;
  const [currentUserId, setCurrentUserId] = useState(route.params?.userId ? String(route.params.userId) : null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState(Boolean(otherUser?.online));
  const [uploadingImage, setUploadingImage] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const isNearBottomRef = useRef(true);
  const sendTimeoutsRef = useRef(new Map());

  const updateMessages = useCallback((updater) => {
    setMessages((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      const normalized = normalizeMessages(next);
      return messagesLookSame(previous, normalized) ? previous : normalized;
    });
  }, []);

  // With an inverted list, offset 0 is the newest-message position.
  // This is only used for an explicit send or a newly received message while
  // the reader is already at the latest position--never for initial history.
  const scrollToLatest = useCallback(() => {
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    });
  }, []);

  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await apiRequest('/users/me');
        if (user?._id) setCurrentUserId(String(user._id));
      } catch (error) {
        console.warn('[CHAT] Current user load error:', error.message);
      }
    };

    loadCurrentUser();
  }, []);

  useEffect(() => {
    isNearBottomRef.current = true;
    setLoading(true);
    setMessages([]);

    const loadConversation = async () => {
      if (!conversationId) {
        setLoading(false);
        return;
      }

      try {
        const response = await apiRequest(`/conversations/${conversationId}/messages`);
        const persisted = normalizeMessages(Array.isArray(response) ? response : []);
        updateMessages((previous) => {
          const pending = previous.filter((item) => item.pending || item.failed);
          return [...persisted, ...pending];
        });
      } catch (error) {
        console.warn('[CHAT] Load messages error:', error.message);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [conversationId, updateMessages]);

  useEffect(() => {
    if (!currentUserId) return;

    connectSocket(currentUserId);

    const belongsToThread = (message) => (
      message && String(message.conversation?._id || message.conversation) === String(conversationId)
    );

    const handleReceiveMessage = ({ message }) => {
      if (!belongsToThread(message)) return;
      updateMessages((prev) => mergeChatMessage(prev, message));
      if (isNearBottomRef.current) scrollToLatest();

      if (getId(message.sender) === getId(otherUser?._id)) {
        socket.emit('message_seen', { messageId: message._id, userId: currentUserId });
      }
    };

    const handleMessageSent = ({ message }) => {
      if (!belongsToThread(message)) return;
      updateMessages((prev) => mergeChatMessage(prev, { ...message, pending: false, failed: false }));
      const timeout = sendTimeoutsRef.current.get(message.clientMessageId);
      if (timeout) {
        clearTimeout(timeout);
        sendTimeoutsRef.current.delete(message.clientMessageId);
      }
    };

    const handleDelivered = ({ message }) => {
      if (!message) return;
      updateMessages((prev) => prev.map((item) => (
        isSameMessage(item, message) && item.status !== 'seen'
          ? { ...item, ...message, status: 'delivered', pending: false, failed: false }
          : item
      )));
    };

    const handleSeen = ({ messageId, status, messageIds = [] }) => {
      const ids = messageIds.length ? messageIds : [messageId];
      updateMessages((prev) => prev.map((item) => {
        const itemId = String(item._id || '');
        if (!ids.some((id) => String(id) === itemId)) return item;
        return { ...item, status: status || 'seen' };
      }));
    };

    const handleTypingStart = ({ userId }) => {
      if (getId(userId) === getId(otherUser?._id)) setTypingUser(otherUser.username || 'User');
    };

    const handleTypingStop = ({ userId }) => {
      if (getId(userId) === getId(otherUser?._id)) setTypingUser(null);
    };

    const handleUserOnline = ({ userId }) => {
      if (getId(userId) === getId(otherUser?._id)) setOnlineStatus(true);
    };

    const handleUserOffline = ({ userId }) => {
      if (getId(userId) === getId(otherUser?._id)) setOnlineStatus(false);
    };

    const handleMessageError = ({ message, clientMessageId }) => {
      updateMessages((prev) => prev.map((item) => (
        item.clientMessageId === clientMessageId ? { ...item, pending: false, failed: true } : item
      )));
      const timeout = sendTimeoutsRef.current.get(clientMessageId);
      if (timeout) {
        clearTimeout(timeout);
        sendTimeoutsRef.current.delete(clientMessageId);
      }
      console.warn('[CHAT] send failed', message);
    };

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
      sendTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      sendTimeoutsRef.current.clear();
      if (otherUser?._id && currentUserId) socket.emit('typing_stop', { userId: currentUserId, receiverId: otherUser._id });
      isTypingRef.current = false;
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
  }, [conversationId, currentUserId, otherUser, scrollToLatest, updateMessages]);

  useEffect(() => {
    if (!currentUserId || !conversationId || !otherUser?._id) return;

    const unreadIds = messages
      .filter((item) => getId(item.sender) === getId(otherUser._id) && getId(item.receiver) === String(currentUserId) && item.status !== 'seen' && item._id && !item.pending)
      .map((item) => item._id)
      .filter(Boolean);

    if (unreadIds.length) {
      socket.emit('message_seen', { conversationId, userId: currentUserId, messageIds: unreadIds });
    }
  }, [messages, currentUserId, conversationId, otherUser]);

  const emitSend = useCallback((payload) => {
    socket.emit('send_message', payload);
    const timeout = setTimeout(() => {
      updateMessages((prev) => prev.map((item) => (
        item.clientMessageId === payload.clientMessageId && item.pending
          ? { ...item, pending: false, failed: true }
          : item
      )));
      sendTimeoutsRef.current.delete(payload.clientMessageId);
    }, 10000);
    sendTimeoutsRef.current.set(payload.clientMessageId, timeout);
  }, [updateMessages]);

  const sendMessage = () => {
    const trimmed = text.trim();
    if (!trimmed || !conversationId || !otherUser || !currentUserId) return;

    const clientMessageId = `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const payload = {
      conversationId,
      sender: currentUserId,
      receiver: otherUser._id,
      text: trimmed,
      messageType: 'text',
      clientMessageId,
    };

    setText('');
    isNearBottomRef.current = true;
    updateMessages((prev) => mergeChatMessage(prev, {
      ...payload,
      createdAt: new Date().toISOString(),
      status: 'sent',
      pending: true,
      failed: false,
    }));
    scrollToLatest();
    emitSend(payload);
  };

  const chooseImage = async () => {
    let clientMessageId = '';
    try {
      if (uploadingImage || !conversationId || !otherUser?._id || !currentUserId) return;
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1 });
      if (result.didCancel) return;
      if (result.errorCode) {
        if (result.errorCode === 'permission') {
          Alert.alert('Photo permission required', 'Photo permission is required to send a picture.');
          return;
        }
        throw new Error(result.errorMessage || 'Unable to select an image.');
      }
      if (!result.assets?.[0]) return;
      const asset = result.assets[0];
      if (!asset.uri) throw new Error('The selected image does not have a readable URI.');
      if (asset.fileSize && asset.fileSize > 25 * 1024 * 1024) throw new Error('Image is too large.');
      console.log('[CHAT IMAGE] selected:', {
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType || asset.type,
        fileSize: asset.fileSize,
      });

      clientMessageId = `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic = {
        conversationId,
        sender: currentUserId,
        receiver: otherUser._id,
        mediaUrl: asset.uri,
        messageType: 'image',
        clientMessageId,
        createdAt: new Date().toISOString(),
        status: 'sent',
        pending: true,
        failed: false,
        sourceAsset: asset,
      };

      isNearBottomRef.current = true;
      updateMessages((prev) => mergeChatMessage(prev, optimistic));
      scrollToLatest();
      setUploadingImage(true);

      console.log('[CHAT IMAGE] upload started:', { uri: asset.uri });
      const response = await uploadImageAsset(asset);
      console.log('[CHAT IMAGE] upload response:', response);
      const mediaUrl = response?.mediaUrl || response?.url || response?.filePath || response?.path;
      console.log('[CHAT IMAGE] mediaUrl:', mediaUrl);
      if (!mediaUrl || isLocalMediaUri(mediaUrl)) throw new Error('Image upload did not return a server media URL.');
      updateMessages((prev) => mergeChatMessage(prev, { ...optimistic, mediaUrl }));
      const payload = {
        conversationId,
        sender: currentUserId,
        receiver: otherUser._id,
        mediaUrl,
        messageType: 'image',
        clientMessageId,
      };
      console.log('[CHAT IMAGE] sending socket image message:', { clientMessageId, mediaUrl });
      emitSend(payload);
    } catch (error) {
      console.error('[CHAT] image upload failed', error?.message || error);
      if (clientMessageId) {
        updateMessages((prev) => prev.map((item) => (
          item.clientMessageId === clientMessageId ? { ...item, pending: false, failed: true } : item
        )));
      }
      if (clientMessageId) Alert.alert('Image failed', error?.message || 'Unable to send picture.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleTyping = (value) => {
    setText(value);
    if (!otherUser?._id || !currentUserId) return;
    if (value.trim()) {
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit('typing_start', { userId: currentUserId, receiverId: otherUser._id });
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socket.emit('typing_stop', { userId: currentUserId, receiverId: otherUser._id });
      }, 1200);
    } else if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit('typing_stop', { userId: currentUserId, receiverId: otherUser._id });
    }
  };

  const retryMessage = useCallback(async (message) => {
    if (!message?.failed) return;

    if (message.messageType === 'image' && isLocalMediaUri(message.mediaUrl)) {
      if (!message.sourceAsset?.uri) {
        Alert.alert('Image failed', 'Please select the picture again to retry.');
        return;
      }

      updateMessages((prev) => prev.map((item) => (
        item.clientMessageId === message.clientMessageId ? { ...item, pending: true, failed: false } : item
      )));
      setUploadingImage(true);
      try {
        console.log('[CHAT IMAGE] upload started:', { uri: message.sourceAsset.uri, retry: true });
        const response = await uploadImageAsset(message.sourceAsset);
        console.log('[CHAT IMAGE] upload response:', response);
        const mediaUrl = response?.mediaUrl || response?.url || response?.filePath || response?.path;
        console.log('[CHAT IMAGE] mediaUrl:', mediaUrl);
        if (!mediaUrl || isLocalMediaUri(mediaUrl)) throw new Error('Image upload did not return a server media URL.');
        updateMessages((prev) => prev.map((item) => (
          item.clientMessageId === message.clientMessageId ? { ...item, mediaUrl, pending: true, failed: false } : item
        )));
        const payload = {
          conversationId,
          sender: currentUserId,
          receiver: otherUser?._id,
          mediaUrl,
          messageType: 'image',
          clientMessageId: message.clientMessageId,
        };
        console.log('[CHAT IMAGE] sending socket image message:', { clientMessageId: message.clientMessageId, mediaUrl, retry: true });
        emitSend(payload);
      } catch (error) {
        updateMessages((prev) => prev.map((item) => (
          item.clientMessageId === message.clientMessageId ? { ...item, pending: false, failed: true } : item
        )));
        Alert.alert('Image failed', error?.message || 'Unable to send picture.');
      } finally {
        setUploadingImage(false);
      }
      return;
    }

    updateMessages((prev) => prev.map((item) => (
      item.clientMessageId === message.clientMessageId ? { ...item, pending: true, failed: false } : item
    )));
    emitSend({
      conversationId: message.conversationId || conversationId,
      sender: currentUserId,
      receiver: otherUser?._id,
      text: message.text || '',
      mediaUrl: message.mediaUrl || '',
      messageType: message.messageType || 'text',
      clientMessageId: message.clientMessageId,
    });
  }, [conversationId, currentUserId, emitSend, otherUser, updateMessages]);

  const openOtherProfile = useCallback(() => {
    if (otherUser?._id) navigation.navigate('UserProfile', { userId: otherUser._id });
  }, [navigation, otherUser]);

  const renderItem = useCallback(({ item }) => {
    const senderId = String(item.sender?._id || item.sender || '');
    const isMine = senderId === String(currentUserId);
    return (
      <ChatMessageRow
        item={item}
        isMine={isMine}
        otherUser={otherUser}
        onPressProfile={openOtherProfile}
        onRetry={retryMessage}
      />
    );
  }, [currentUserId, openOtherProfile, otherUser, retryMessage]);

  const statusText = useMemo(() => {
    if (typingUser) return `${typingUser} is typing...`;
    return onlineStatus ? 'Online' : 'Offline';
  }, [onlineStatus, typingUser]);

  // State stays oldest -> newest for reconciliation. FlatList receives a
  // separate reversed copy so its inverted start position is the latest row.
  const renderMessages = useMemo(() => [...messages].reverse(), [messages]);
  const readyToRenderMessages = Boolean(currentUserId) && !loading;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.headerUser}>
          <TouchableOpacity onPress={openOtherProfile}>
            <Image source={{ uri: resolveMediaUrl(otherUser?.profilePicture) || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80' }} style={styles.headerAvatar} />
          </TouchableOpacity>
          <View>
            <Text style={styles.userName}>{otherUser?.username || 'User'}</Text>
            <Text style={styles.userStatus}>{statusText}</Text>
          </View>
        </View>

        <View style={{ width: 30 }} />
      </View>

      <View style={styles.chatBody}>
        {!readyToRenderMessages ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="small" color="#111827" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            style={styles.messageList}
            data={renderMessages}
            inverted
            extraData={currentUserId}
            keyExtractor={(item) => getMessageKey(item)}
            contentContainerStyle={styles.chatList}
            onScroll={({ nativeEvent }) => {
              isNearBottomRef.current = nativeEvent.contentOffset.y <= 80;
            }}
            scrollEventThrottle={100}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            renderItem={renderItem}
            ListEmptyComponent={(
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No messages yet</Text>
              </View>
            )}
          />
        )}
      </View>

      <View style={styles.inputRow}>
        <TouchableOpacity onPress={chooseImage} style={styles.iconButton} disabled={uploadingImage}>
          {uploadingImage ? <ActivityIndicator size="small" color="#111827" /> : <Ionicons name="image-outline" size={21} color="#6657E8" />}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleTyping}
          placeholder="Message"
          placeholderTextColor="#9ca3af"
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
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
  emptyWrap: {
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    color: '#6b7280',
    fontSize: 14,
  },
  chatBody: {
    flex: 1,
  },
  messageList: {
    flex: 1,
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
});
