const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const { onlineUsers } = require('../services/socketService');

const getDevelopmentUser = async () => User.findOne({ username: 'alicia' }).lean();

const ensureConversation = async (userAId, userBId) => {
  const participants = [userAId, userBId].sort((a, b) => String(a).localeCompare(String(b)));

  let conversation = await Conversation.findOne({ participants: { $all: participants } });

  if (!conversation) {
    conversation = await Conversation.create({ participants, lastMessage: '' });
  }

  return conversation;
};

const getConversations = async (req, res, next) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const conversations = await Conversation.find({ participants: userId })
      .populate('participants', 'name username profilePicture online')
      .sort({ updatedAt: -1 });

    const result = await Promise.all(
      conversations.map(async (conversation) => {
        const otherUserDoc = conversation.participants.find((participant) => String(participant._id) !== String(userId));
        const otherUser = otherUserDoc
          ? {
              ...(otherUserDoc.toObject ? otherUserDoc.toObject() : otherUserDoc),
              online: otherUserDoc?._id ? onlineUsers.has(String(otherUserDoc._id)) : false,
            }
          : null;
        const latestMessage = await Message.findOne({ conversation: conversation._id })
          .sort({ createdAt: -1, _id: -1 })
          .select('text mediaUrl messageType createdAt sender receiver status')
          .lean();
        const unreadCount = await Message.countDocuments({
          conversation: conversation._id,
          receiver: userId,
          status: { $in: ['sent', 'delivered'] },
        });

        return {
          _id: conversation._id,
          participants: conversation.participants,
          otherUser,
          latestMessage,
          lastMessage: latestMessage ? (latestMessage.messageType === 'image' ? '📷 Photo' : latestMessage.text || '') : '',
          lastMessageAt: latestMessage ? latestMessage.createdAt : conversation.updatedAt,
          unreadCount,
          updatedAt: conversation.updatedAt,
        };
      })
    );

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

const createConversation = async (req, res, next) => {
  try {
    const { userAId, userBId } = req.body;
    if (!userAId || !userBId) {
      return res.status(400).json({ message: 'userAId and userBId are required' });
    }

    const conversation = await ensureConversation(userAId, userBId);
    const populated = await Conversation.findById(conversation._id).populate('participants', 'name username profilePicture online');

    return res.status(200).json(populated);
  } catch (error) {
    next(error);
  }
};

const getConversationMessages = async (req, res, next) => {
  try {
    const { id } = req.params;
    const messages = await Message.find({ conversation: id })
      .populate('sender', 'name username profilePicture')
      .populate('receiver', 'name username profilePicture')
      .sort({ createdAt: 1 });

    return res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

const createMessage = async (req, res, next) => {
  try {
    const { conversationId, sender, receiver, text = '', mediaUrl = '', messageType = 'text', status = 'sent' } = req.body;

    if (!conversationId || !sender || !receiver) {
      return res.status(400).json({ message: 'conversationId, sender and receiver are required' });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const message = await Message.create({
      conversation: conversationId,
      sender,
      receiver,
      text,
      mediaUrl,
      messageType,
      status,
      deliveredAt: status === 'delivered' ? new Date() : null,
      seenAt: status === 'seen' ? new Date() : null,
    });

    conversation.lastMessage = text || 'Image';
    conversation.updatedAt = new Date();
    await conversation.save();

    const populated = await Message.findById(message._id)
      .populate('sender', 'name username profilePicture online')
      .populate('receiver', 'name username profilePicture online');

    return res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
};

const updateMessageStatus = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    if (!messageId || !status) {
      return res.status(400).json({ message: 'messageId and status are required' });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    message.status = status;
    if (status === 'delivered') message.deliveredAt = new Date();
    if (status === 'seen') message.seenAt = new Date();

    await message.save();
    return res.status(200).json(message);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConversations,
  createConversation,
  getConversationMessages,
  createMessage,
  updateMessageStatus,
  ensureConversation,
  getDevelopmentUser,
};
