const { Server } = require('socket.io');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');

const onlineUsers = new Map();

const getId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};
const isObjectId = (value) => mongoose.isValidObjectId(getId(value));
const isConversationMember = (conversation, userId) =>
  conversation.participants.some((participant) => String(participant) === String(userId));

const setupSocketIO = (server, corsOptions = { origin: '*' }) => {
  const io = new Server(server, {
    cors: corsOptions,
  });

  global.io = io;

  const emitNotification = async (recipient, sender, type, payload = {}) => {
    if (!recipient || !sender || String(recipient) === String(sender)) return null;

    const { post = null, reel = null, conversation = null, message = '' } = payload;
    const notification = await Notification.create({
      recipient,
      sender,
      type,
      post,
      reel,
      conversation,
      message,
      read: false,
    });

    const populatedNotification = await notification.populate([
      { path: 'sender', select: 'name username profilePicture' },
      { path: 'recipient', select: 'name username profilePicture' },
      { path: 'post', select: 'mediaUrl caption' },
      { path: 'reel', select: 'videoUrl caption' },
    ]);

    io.to(`user:${recipient}`).emit('notification_received', { notification: populatedNotification });
    return populatedNotification;
  };

  io.on('connection', (socket) => {
    socket.on('join_user_room', async (userId) => {
      if (!isObjectId(userId)) return;

      const normalizedUserId = String(userId);
      if (socket.data.joinedUserId === normalizedUserId) return;
      if (socket.data.joinedUserId) socket.leave(`user:${socket.data.joinedUserId}`);
      socket.data.joinedUserId = normalizedUserId;
      socket.join(`user:${normalizedUserId}`);
      onlineUsers.set(normalizedUserId, socket.id);
      io.emit('user_online', { userId: normalizedUserId });

      const pendingMessages = await Message.find({
        receiver: normalizedUserId,
        status: 'sent',
      })
        .populate('sender', 'name username profilePicture online')
        .populate('receiver', 'name username profilePicture online')
        .sort({ createdAt: 1 });

      for (const message of pendingMessages) {
        io.to(`user:${normalizedUserId}`).emit('receive_message', { message });

        // Do not regress a message that another connected client has already seen.
        const delivered = await Message.findOneAndUpdate(
          { _id: message._id, status: 'sent' },
          { $set: { status: 'delivered', deliveredAt: new Date() } },
          { new: true }
        )
          .populate('sender', 'name username profilePicture online')
          .populate('receiver', 'name username profilePicture online');
        if (!delivered) continue;

        const senderId = getId(delivered.sender);
        io.to(`user:${senderId}`).emit('message_delivered', { message: delivered });
      }
    });

    socket.on('send_message', async (payload) => {
      try {
        const { conversationId, sender, receiver, text, mediaUrl = '', messageType = 'text' } = payload || {};

        if (!conversationId || !sender || !receiver || !isObjectId(conversationId) || !isObjectId(sender) || !isObjectId(receiver)) {
          socket.emit('message_error', { message: 'conversationId, sender and receiver are required' });
          return;
        }

        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !isConversationMember(conversation, sender) || !isConversationMember(conversation, receiver)) {
          socket.emit('message_error', { message: 'Conversation not found' });
          return;
        }

        if (!['text', 'image'].includes(messageType)
          || (messageType === 'image' && (!mediaUrl || /^file:/i.test(mediaUrl)))
          || (messageType === 'text' && !String(text).trim())) {
          socket.emit('message_error', { message: 'Invalid message payload' });
          return;
        }

        const message = await Message.create({
          conversation: conversationId,
          sender,
          receiver,
          text: text || '',
          mediaUrl,
          messageType,
          status: 'sent',
        });

        conversation.lastMessage = text || 'Image';
        conversation.updatedAt = new Date();
        await conversation.save();

        const populated = await Message.findById(message._id)
          .populate('sender', 'name username profilePicture online')
          .populate('receiver', 'name username profilePicture online');

        socket.emit('message_sent', { message: populated });

        const receiverId = getId(receiver);
        const receiverRoom = `user:${receiverId}`;
        const receiverSocketId = onlineUsers.get(receiverId);

        if (receiverSocketId) {
          io.to(receiverRoom).emit('receive_message', { message: populated });

          const deliveredPopulated = await Message.findOneAndUpdate(
            { _id: populated._id, status: 'sent' },
            { $set: { status: 'delivered', deliveredAt: new Date() } },
            { new: true }
          )
            .populate('sender', 'name username profilePicture online')
            .populate('receiver', 'name username profilePicture online');
          if (deliveredPopulated) {
            socket.emit('message_delivered', { message: deliveredPopulated });
            io.to(receiverRoom).emit('message_delivered', { message: deliveredPopulated });
          }
        } else {
          await emitNotification(receiverId, getId(sender), 'message', {
            conversation: conversationId,
            message: text || 'Sent a photo',
          });
        }
      } catch (error) {
        socket.emit('message_error', { message: error.message || 'Unable to send message' });
      }
    });

    socket.on('message_seen', async (payload) => {
      try {
        const { messageId, messageIds = [], conversationId, userId } = payload || {};
        if (!isObjectId(userId) || (conversationId && !isObjectId(conversationId))) return;

        const ids = Array.isArray(messageIds) && messageIds.length ? messageIds : messageId ? [messageId] : [];
        const query = { receiver: userId, status: { $in: ['sent', 'delivered'] } };

        if (conversationId) {
          query.conversation = conversationId;
        }

        if (ids.length) {
          query._id = { $in: ids };
        } else if (!conversationId) {
          return;
        }

        const messages = await Message.find(query);
        if (!messages.length) return;

        const seenIds = [];

        for (const message of messages) {
          const seen = await Message.findOneAndUpdate(
            { _id: message._id, receiver: userId, status: { $in: ['sent', 'delivered'] } },
            { $set: { status: 'seen', seenAt: new Date() } },
            { new: true }
          );
          if (!seen) continue;
          seenIds.push(seen._id);

          io.to(`user:${getId(message.sender)}`).emit('message_seen', {
            messageId: message._id,
            userId,
            messageIds: [message._id],
            status: 'seen',
          });
        }
      } catch (error) {
        socket.emit('message_error', { message: error.message || 'Unable to mark messages as seen' });
      }
    });

    socket.on('typing_start', (payload) => {
      const { receiverId, userId } = payload || {};
      if (!receiverId || !userId) return;
      io.to(`user:${receiverId}`).emit('typing_start', { userId, receiverId });
    });

    socket.on('typing_stop', (payload) => {
      const { receiverId, userId } = payload || {};
      if (!receiverId || !userId) return;
      io.to(`user:${receiverId}`).emit('typing_stop', { userId, receiverId });
    });

    socket.on('disconnect', () => {
      const currentUserId = socket.data.joinedUserId;
      if (currentUserId) {
        // A stale connection must not mark a newer connection for this user offline.
        if (onlineUsers.get(String(currentUserId)) === socket.id) {
          onlineUsers.delete(String(currentUserId));
          io.emit('user_offline', { userId: currentUserId });
        }
      }
    });
  });

  return io;
};

module.exports = { setupSocketIO, onlineUsers };
