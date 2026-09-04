const Notification = require('../models/Notification');
const User = require('../models/User');

const populateNotification = async (notification) => {
  const populated = await notification.populate([
    { path: 'sender', select: 'name username profilePicture' },
    { path: 'recipient', select: 'name username profilePicture' },
    { path: 'post', select: 'mediaUrl caption' },
    { path: 'reel', select: 'videoUrl caption' },
  ]);

  return populated.toObject ? populated.toObject() : populated;
};

const createNotification = async ({ recipient, sender, type, post = null, reel = null, conversation = null, message = '' }) => {
  if (!recipient || !sender || String(recipient) === String(sender)) {
    return null;
  }

  if (type === 'message' && conversation) {
    const existing = await Notification.findOne({
      recipient,
      sender,
      type,
      conversation,
      read: false,
    }).sort({ createdAt: -1 });

    if (existing) {
      if (message && existing.message !== message) {
        existing.message = message;
        await existing.save();
      }
      return existing;
    }
  }

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

  return notification;
};

const getNotifications = async (req, res, next) => {
  try {
    const userId = req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const notifications = await Notification.find({ recipient: userId })
      .populate('sender', 'name username profilePicture')
      .populate('post', 'mediaUrl caption')
      .populate('reel', 'videoUrl caption')
      .sort({ createdAt: -1 });

    return res.status(200).json(notifications.map((notification) => ({
      ...notification.toObject(),
      sender: notification.sender,
      post: notification.post,
      reel: notification.reel,
    })));
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const notification = await Notification.findOne({ _id: id, recipient: userId });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.read = true;
    await notification.save();

    return res.status(200).json(notification);
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const userId = req.body.userId || req.query.userId;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const result = await Notification.updateMany({ recipient: userId, read: false }, { $set: { read: true } });

    return res.status(200).json({
      message: 'All notifications marked as read',
      modifiedCount: result.modifiedCount || 0,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createNotification,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  populateNotification,
};
