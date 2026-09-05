const Reel = require('../models/Reel');
const User = require('../models/User');
const fs = require('fs');
const path = require('path');
const { createNotification } = require('./notificationController');

const isInvalidVideoUrl = (value) => {
  const url = String(value || '').trim();
  if (/^https?:\/\//i.test(url)) return false;
  if (!/^\/uploads\/reels\/[^/]+\.mp4$/i.test(url)) return true;
  const filePath = path.join(__dirname, '..', url.replace(/^\//, ''));
  return !fs.existsSync(filePath) || fs.statSync(filePath).size === 0;
};

const getCurrentUserId = async () => {
  const user = await User.findOne({ username: 'alicia' }).lean();
  return user ? user._id : null;
};

const getFallbackThumbnailUrl = (videoUrl) => {
  const value = String(videoUrl || '').trim();
  if (!value) return null;
  if (/cloudinary\.com/i.test(value)) {
    return value.replace(/\.mp4(\?.*)?$/i, '.jpg');
  }
  return null;
};

const serializeReel = (reel, currentUserId = null, currentUserData = null) => {
  const plain = reel.toObject ? reel.toObject() : reel;
  const user = plain.user && typeof plain.user === 'object' ? plain.user : null;
  const fallbackThumbnailUrl = plain.thumbnailUrl || plain.posterUrl || getFallbackThumbnailUrl(plain.videoUrl || plain.mediaUrl);

  return {
    ...plain,
    thumbnailUrl: plain.thumbnailUrl || fallbackThumbnailUrl,
    posterUrl: plain.posterUrl || fallbackThumbnailUrl,
    likesCount: Array.isArray(plain.likes) ? plain.likes.length : 0,
    commentsCount: Array.isArray(plain.comments) ? plain.comments.length : 0,
    isLiked: currentUserId
      ? Array.isArray(plain.likes) && plain.likes.some((userId) => String(userId) === String(currentUserId))
      : false,
    isSaved: currentUserData && plain._id
      ? Array.isArray(currentUserData.savedReels) && currentUserData.savedReels.some((savedId) => String(savedId) === String(plain._id))
      : false,
    user: user
      ? {
          ...user,
          followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
          followingCount: Array.isArray(user.following) ? user.following.length : 0,
          isFollowing: currentUserData && user._id
            ? Array.isArray(currentUserData.following) && currentUserData.following.some((followedId) => String(followedId) === String(user._id))
            : false,
        }
      : user,
  };
};

const getReels = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId || (await getCurrentUserId());
    const currentUserData = currentUserId ? await User.findById(currentUserId).lean() : null;
    const reels = await Reel.find()
      .populate('user', 'name username profilePicture bio followers following')
      .populate({ path: 'comments.user', select: 'name username profilePicture' })
      .sort({ createdAt: -1 });

    console.log('[Snaply] reels count:', reels.length);
    const response = reels
      .filter((reel) => !isInvalidVideoUrl(reel.videoUrl || reel.mediaUrl))
      .map((reel) => {
        console.log('[Snaply] reel:', reel._id, 'videoUrl:', reel.videoUrl);
        return serializeReel(reel, currentUserId, currentUserData);
      });
    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

const getReelById = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId || (await getCurrentUserId());
    const currentUserData = currentUserId ? await User.findById(currentUserId).lean() : null;
    const reel = await Reel.findById(req.params.id)
      .populate('user', 'name username profilePicture bio followers following')
      .populate({ path: 'comments.user', select: 'name username profilePicture' });

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }
    if (isInvalidVideoUrl(reel.videoUrl || reel.mediaUrl)) {
      return res.status(410).json({ message: 'Reel media is unavailable.' });
    }

    return res.status(200).json(serializeReel(reel, currentUserId, currentUserData));
  } catch (error) {
    next(error);
  }
};

const createReel = async (req, res, next) => {
  try {
    console.log('[Snaply] reel create request received');
    const { userId, videoUrl, thumbnailUrl = null, caption = '', musicName = '' } = req.body;

    if (isInvalidVideoUrl(videoUrl)) {
      return res.status(400).json({ message: 'videoUrl must be an HTTPS URL or an existing local reel file.' });
    }

    const resolvedUserId = userId || (await getCurrentUserId());
    if (!resolvedUserId) {
      return res.status(400).json({ message: 'User is required to create a reel.' });
    }

    const currentUserData = await User.findById(resolvedUserId).lean();
    const reel = await Reel.create({
      user: resolvedUserId,
      videoUrl,
      thumbnailUrl,
      caption,
      musicName,
      likes: [],
      comments: [],
      views: 0,
    });

    const populated = await reel.populate('user', 'name username profilePicture bio followers following');
    console.log('[Snaply] reel create success:', reel._id);
    return res.status(201).json(serializeReel(populated, resolvedUserId, currentUserData));
  } catch (error) {
    next(error);
  }
};

const deleteReel = async (req, res, next) => {
  try {
    const currentUserId = req.body?.userId || req.query.userId;
    const reel = await Reel.findOne({ _id: req.params.id, user: currentUserId });
    if (!reel) return res.status(404).json({ message: 'Reel not found or not owned by current user' });
    await reel.deleteOne();
    return res.status(200).json({ message: 'Reel deleted successfully', reelId: reel._id });
  } catch (error) {
    next(error);
  }
};

const getReelsByUser = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId || (await getCurrentUserId());
    const currentUserData = currentUserId ? await User.findById(currentUserId).lean() : null;
    const reels = await Reel.find({ user: req.params.userId })
      .populate('user', 'name username profilePicture bio followers following')
      .populate({ path: 'comments.user', select: 'name username profilePicture' })
      .sort({ createdAt: -1 });

    res.status(200).json(
      reels
        .filter((reel) => !isInvalidVideoUrl(reel.videoUrl || reel.mediaUrl))
        .map((reel) => serializeReel(reel, currentUserId, currentUserData))
    );
  } catch (error) {
    next(error);
  }
};

const toggleLike = async (req, res, next) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const reel = await Reel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const alreadyLiked = reel.likes.some((likeId) => String(likeId) === String(userId));

    if (alreadyLiked) {
      reel.likes = reel.likes.filter((likeId) => String(likeId) !== String(userId));
    } else {
      reel.likes.push(userId);

      if (String(reel.user) !== String(userId)) {
        const senderUser = await User.findById(userId).select('username').lean();
        const notification = await createNotification({
          recipient: reel.user,
          sender: userId,
          type: 'like',
          reel: reel._id,
          message: `${senderUser?.username || 'Someone'} liked your reel.`,
        });

        if (notification && global.io) {
          global.io.to(`user:${reel.user}`).emit('notification_received', { notification });
        }
      }
    }

    await reel.save();

    const currentUserData = await User.findById(userId).lean();
    const populated = await Reel.findById(reel._id)
      .populate('user', 'name username profilePicture bio followers following')
      .populate({ path: 'comments.user', select: 'name username profilePicture' });

    return res.status(200).json(serializeReel(populated, userId, currentUserData));
  } catch (error) {
    next(error);
  }
};

const getComments = async (req, res, next) => {
  try {
    const reel = await Reel.findById(req.params.id).populate({
      path: 'comments.user',
      select: 'name username profilePicture',
    });

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    return res.status(200).json(reel.comments);
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { userId, text } = req.body;
    const reel = await Reel.findById(req.params.id);

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    if (!userId || !text || !text.trim()) {
      return res.status(400).json({ message: 'userId and text are required' });
    }

    reel.comments.push({ user: userId, text: text.trim() });
    await reel.save();

    if (String(reel.user) !== String(userId)) {
      const senderUser = await User.findById(userId).select('username').lean();
      const notification = await createNotification({
        recipient: reel.user,
        sender: userId,
        type: 'comment',
        reel: reel._id,
        message: `${senderUser?.username || 'Someone'} commented on your reel.`,
      });

      if (notification && global.io) {
        global.io.to(`user:${reel.user}`).emit('notification_received', { notification });
      }
    }

    const currentUserData = await User.findById(userId).lean();
    const populated = await Reel.findById(reel._id)
      .populate('user', 'name username profilePicture bio followers following')
      .populate({ path: 'comments.user', select: 'name username profilePicture' });

    return res.status(200).json(serializeReel(populated, userId, currentUserData));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReels,
  getReelById,
  getReelsByUser,
  deleteReel,
  createReel,
  toggleLike,
  getComments,
  addComment,
};
