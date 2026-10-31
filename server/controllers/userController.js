const User = require('../models/User');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const mongoose = require('mongoose');
const { createNotification } = require('./notificationController');

const normalizeUsername = (value = '') => String(value).trim().toLowerCase();
const DEVELOPMENT_USERNAME = 'alicia';

const getOwnedContentCount = async (userId) => {
  const [postsCount, reelsCount] = await Promise.all([
    Post.countDocuments({ user: userId }),
    Reel.countDocuments({ user: userId }),
  ]);
  return postsCount + reelsCount;
};

const getCurrentUser = async (req, res, next) => {
  try {
    const currentUser = await User.findOne({ username: 'alicia' })
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture')
      .populate('savedReels', 'videoUrl thumbnailUrl caption musicName user likes comments views createdAt')
      .populate('savedPosts', 'mediaUrl mediaType caption user');

    if (!currentUser) {
      return res.status(404).json({ message: 'Current development user not found' });
    }

    const payload = currentUser.toJSON();
    payload.postsCount = await getOwnedContentCount(currentUser._id);
    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const updateCurrentUser = async (req, res, next) => {
  try {
    const currentUser = await User.findOne({ username: DEVELOPMENT_USERNAME });

    if (!currentUser) {
      return res.status(404).json({ message: 'Current development user not found' });
    }

    const { name, username, bio, profilePicture } = req.body || {};

    if (username !== undefined && normalizeUsername(username) !== DEVELOPMENT_USERNAME) {
      return res.status(400).json({ message: 'The development username cannot be changed.' });
    }

    if (name !== undefined) currentUser.name = String(name).trim() || currentUser.name;
    if (bio !== undefined) currentUser.bio = String(bio).trim();
    if (profilePicture !== undefined) currentUser.profilePicture = String(profilePicture).trim() || currentUser.profilePicture;

    await currentUser.save();

    const populated = await User.findById(currentUser._id)
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture')
      .populate('savedReels', 'videoUrl thumbnailUrl caption musicName user likes comments views createdAt')
      .populate('savedPosts', 'mediaUrl mediaType caption user');

    const payload = populated.toJSON();
    payload.postsCount = await getOwnedContentCount(currentUser._id);
    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture')
      .populate('savedReels', 'videoUrl thumbnailUrl caption musicName user likes comments views createdAt');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findOne({ username: 'alicia' }).select('following').lean();
    const payload = user.toJSON();
    payload.postsCount = await getOwnedContentCount(user._id);
    payload.isFollowing = Boolean(
      currentUser?.following?.some((followedId) => String(followedId) === String(user._id))
    );

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const getRelationshipUsers = (field) => async (req, res, next) => {
  try {
    const [targetUser, currentUser] = await Promise.all([
      User.findById(req.params.id).populate(field, 'name username profilePicture bio'),
      User.findOne({ username: 'alicia' }).select('following').lean(),
    ]);
    if (!targetUser) return res.status(404).json({ message: 'User not found' });
    const currentFollowing = currentUser?.following || [];
    const users = (targetUser[field] || []).map((user) => ({
      ...(user.toObject ? user.toObject() : user),
      isFollowing: currentFollowing.some((id) => String(id) === String(user._id)),
    }));
    return res.status(200).json(users);
  } catch (error) {
    next(error);
  }
};

const getFollowers = getRelationshipUsers('followers');
const getFollowing = getRelationshipUsers('following');

const toggleSavedReel = async (req, res, next) => {
  try {
    const userId = req.params.id || req.body.userId;
    const reelId = req.params.reelId || req.body.reelId;

    if (!userId || !reelId) {
      return res.status(400).json({ message: 'userId and reelId are required' });
    }

    const user = await User.findById(userId).select('_id savedReels');
    const Reel = require('../models/Reel');
    const reel = await Reel.findById(reelId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const alreadySaved = (user.savedReels || []).some((savedId) => String(savedId) === String(reelId));
    const shouldSave = req.method === 'POST' ? true : req.method === 'DELETE' ? false : !alreadySaved;
    const update = shouldSave
      ? { $addToSet: { savedReels: reelId } }
      : { $pull: { savedReels: reelId } };
    const populated = await User.findByIdAndUpdate(userId, update, { new: true })
      .populate('savedReels', 'videoUrl thumbnailUrl caption musicName user likes comments views createdAt');

    if (!populated) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      isSaved: shouldSave,
      savedReels: populated.savedReels || [],
      user: populated.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const toggleSavedPost = async (req, res, next) => {
  try {
    const userId = req.params.id || req.body.userId;
    const postId = req.params.postId || req.body.postId;

    if (!userId || !postId) {
      return res.status(400).json({ message: 'userId and postId are required' });
    }

    if (!mongoose.isValidObjectId(userId) || !mongoose.isValidObjectId(postId)) {
      return res.status(400).json({ message: 'Invalid userId or postId' });
    }

    const [user, post] = await Promise.all([
      User.findById(userId).select('savedPosts').lean(),
      Post.findById(postId).select('_id').lean(),
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const savedPosts = Array.isArray(user.savedPosts) ? user.savedPosts : [];
    const alreadySaved = savedPosts.some((savedId) => String(savedId) === String(postId));
    const shouldSave = req.method === 'POST' ? true : req.method === 'DELETE' ? false : !alreadySaved;

    const update = shouldSave
      ? { $addToSet: { savedPosts: postId } }
      : { $pull: { savedPosts: postId } };
    const updatedUser = await User.findByIdAndUpdate(userId, update, { new: true })
      .populate('savedPosts', 'mediaUrl caption user');

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      isSaved: shouldSave,
      savedPosts: updatedUser.savedPosts || [],
      user: updatedUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.body.currentUserId || req.query.currentUserId || req.body.userId;

    if (!currentUserId || !mongoose.isValidObjectId(currentUserId) || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: 'currentUserId is required' });
    }

    if (String(targetId) === String(currentUserId)) {
      return res.status(400).json({ message: 'Users cannot follow themselves.' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select('name username following followers'),
      User.findById(targetId).select('name username following followers'),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyFollowing = (currentUser.following || []).some((userId) => String(userId) === String(targetId));
    const [updatedCurrentUser, updatedTargetUser] = await Promise.all([
      User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetId } }, { new: true }),
      User.findByIdAndUpdate(targetId, { $addToSet: { followers: currentUserId } }, { new: true }),
    ]);

    const notification = alreadyFollowing
      ? null
      : await createNotification({
        recipient: targetId,
        sender: currentUserId,
        type: 'follow',
        message: `${updatedCurrentUser.username || 'Someone'} started following you.`,
      });

    if (notification && global.io) {
      global.io.to(`user:${targetId}`).emit('notification_received', { notification });
    }

    return res.status(200).json({
      success: true,
      message: 'Followed successfully',
      isFollowing: true,
      currentUser: updatedCurrentUser.toJSON(),
      targetUser: updatedTargetUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.body.currentUserId || req.query.currentUserId || req.body.userId;

    if (!currentUserId || !mongoose.isValidObjectId(currentUserId) || !mongoose.isValidObjectId(targetId)) {
      return res.status(400).json({ message: 'currentUserId is required' });
    }

    if (String(targetId) === String(currentUserId)) {
      return res.status(400).json({ message: 'Users cannot unfollow themselves.' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select('_id'),
      User.findById(targetId).select('_id'),
    ]);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const [updatedCurrentUser, updatedTargetUser] = await Promise.all([
      User.findByIdAndUpdate(currentUserId, { $pull: { following: targetId } }, { new: true }),
      User.findByIdAndUpdate(targetId, { $pull: { followers: currentUserId } }, { new: true }),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Unfollowed successfully',
      isFollowing: false,
      currentUser: updatedCurrentUser.toJSON(),
      targetUser: updatedTargetUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCurrentUser,
  updateCurrentUser,
  getUserById,
  getFollowers,
  getFollowing,
  toggleSavedReel,
  toggleSavedPost,
  followUser,
  unfollowUser,
};
