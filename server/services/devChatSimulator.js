const { io: createSocketClient } = require('socket.io-client');
const User = require('../models/User');
const { onlineUsers } = require('./socketService');
const {
  DEV_CHAT_SIMULATION,
  DEV_SIMULATED_USERS,
  DEV_REPLY_DELAY_MS,
  DEV_TYPING_DELAY_MS,
  DEV_SEEN_DELAY_MS,
} = require('../config/devChat');

const DEFAULT_SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:5000';
const NETWORK_SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || DEFAULT_SOCKET_URL;
const SOCKET_URL = (NETWORK_SOCKET_URL || DEFAULT_SOCKET_URL).replace(/\/$/, '');

const randomDelay = (base, variance = 400) => Math.max(400, base + Math.floor(Math.random() * variance));

const getConversationId = (message) => {
  if (!message) return null;
  if (message.conversation && typeof message.conversation === 'object' && message.conversation._id) {
    return message.conversation._id;
  }
  return message.conversation || null;
};

const buildReply = (text = '') => {
  const normalized = String(text || '').trim().toLowerCase();

  if (!normalized) return 'Hey! What are you up to?';
  if (normalized.includes('hey') || normalized.includes('hello')) return 'Hey! What’s up?';
  if (normalized.includes('how are you') || normalized.includes('how r u')) return 'I’m good 😄 How about you?';
  if (normalized.includes('where are you')) return 'Just chilling 😎';
  if (normalized.includes('nice') || normalized.includes('good')) return 'Yeah! What are you doing?';
  if (normalized.includes('thanks') || normalized.includes('thank you')) return 'Absolutely 😊';
  if (normalized.includes('what') && normalized.includes('doing')) return 'Just taking it easy and replying to you 😄';
  if (normalized.includes('bye') || normalized.includes('later')) return 'Catch you later!';
  return 'That sounds good 😄';
};

const startDevChatSimulator = async () => {
  if (!DEV_CHAT_SIMULATION) return null;

  const globalKey = '__snaply_dev_chat_simulator';
  if (globalThis[globalKey]) return globalThis[globalKey];

  const simulatorState = { started: true, sockets: new Map() };
  globalThis[globalKey] = simulatorState;

  const users = await User.find({ username: { $in: DEV_SIMULATED_USERS } }).lean();
  const candidateUsernames = new Set(DEV_SIMULATED_USERS);
  const onlineUsersToSpawn = users.filter((user) => candidateUsernames.has(String(user.username || '').toLowerCase()));

  for (const user of onlineUsersToSpawn) {
    const socket = createSocketClient(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: { userId: user._id },
    });

    const userId = String(user._id);
    const timers = { reply: null, typing: null, seen: null };

    socket.on('connect', () => {
      socket.emit('join_user_room', userId);
      console.log('[Snaply Dev Chat] simulated user connected:', user.username, socket.id);
    });

    socket.on('connect_error', (error) => {
      console.warn('[Snaply Dev Chat] connect_error', user.username, error?.message || error);
    });

    socket.on('disconnect', (reason) => {
      onlineUsers.delete(userId);
      console.log('[Snaply Dev Chat] simulated user disconnected:', user.username, reason);
    });

    socket.on('receive_message', ({ message }) => {
      if (!message) return;

      const senderId = String(message.sender?._id || message.sender || '');
      const receiverId = String(message.receiver?._id || message.receiver || '');
      const isMyMessage = senderId === userId;
      const isForMe = receiverId === userId;

      if (!isForMe || isMyMessage) return;

      const maybeConversationId = getConversationId(message);
      const replyText = buildReply(message.text || (message.messageType === 'image' ? 'Image' : ''));

      if (timers.typing) clearTimeout(timers.typing);
      if (timers.reply) clearTimeout(timers.reply);
      if (timers.seen) clearTimeout(timers.seen);

      timers.typing = setTimeout(() => {
        socket.emit('typing_start', {
          userId: userId,
          receiverId: senderId,
        });

        timers.reply = setTimeout(() => {
          socket.emit('typing_stop', {
            userId: userId,
            receiverId: senderId,
          });

          socket.emit('send_message', {
            conversationId: maybeConversationId,
            sender: userId,
            receiver: senderId,
            text: replyText,
            messageType: 'text',
          });
        }, randomDelay(DEV_TYPING_DELAY_MS, 700));
      }, randomDelay(DEV_REPLY_DELAY_MS, 1000));

      timers.seen = setTimeout(() => {
        if (!maybeConversationId || !message._id) return;
        socket.emit('message_seen', {
          conversationId: maybeConversationId,
          userId: userId,
          messageIds: [message._id],
        });
      }, randomDelay(DEV_SEEN_DELAY_MS, 800));
    });

    simulatorState.sockets.set(userId, socket);
  }

  return simulatorState;
};

module.exports = { startDevChatSimulator, buildReply, randomDelay };
