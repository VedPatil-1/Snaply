const User = require('../models/User');
const { createNotification } = require('./notificationController');

const normalizeUsername = (value = '') => String(value).trim().toLowerCase();
const DEVELOPMENT_USERNAME = 'alicia';

const getCurrentUser = async (req, res, next) => {
  try {
    const currentUser = await User.findOne({ username: 'alicia' })
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture')
      .populate('savedReels', 'videoUrl caption musicName user');

    if (!currentUser) {
      return res.status(404).json({ message: 'Current development user not found' });
    }

    return res.status(200).json(currentUser.toJSON());
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
      .populate('savedReels', 'videoUrl caption musicName user');

    return res.status(200).json(populated.toJSON());
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('followers', 'name username profilePicture')
      .populate('following', 'name username profilePicture')
      .populate('savedReels', 'videoUrl caption musicName user');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const currentUser = await User.findOne({ username: 'alicia' }).select('following').lean();
    const payload = user.toJSON();
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

    const user = await User.findById(userId);
    const Reel = require('../models/Reel');
    const reel = await Reel.findById(reelId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!reel) {
      return res.status(404).json({ message: 'Reel not found' });
    }

    const alreadySaved = user.savedReels.some((savedId) => String(savedId) === String(reelId));
    if (alreadySaved) {
      user.savedReels = user.savedReels.filter((savedId) => String(savedId) !== String(reelId));
    } else {
      user.savedReels.push(reelId);
    }

    await user.save();

    const populated = await User.findById(user._id)
      .populate('savedReels', 'videoUrl caption musicName user');

    return res.status(200).json({
      isSaved: !alreadySaved,
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

    const user = await User.findById(userId);
    const Post = require('../models/Post');
    const post = await Post.findById(postId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!Array.isArray(user.savedPosts)) {
      user.savedPosts = [];
    }

    const alreadySaved = user.savedPosts.some((savedId) => String(savedId) === String(postId));
    if (alreadySaved) {
      user.savedPosts = user.savedPosts.filter((savedId) => String(savedId) !== String(postId));
    } else {
      user.savedPosts.push(postId);
    }

    await user.save();

    const populated = await User.findById(user._id).populate('savedPosts', 'mediaUrl caption user');

    return res.status(200).json({
      isSaved: !alreadySaved,
      savedPosts: populated.savedPosts || [],
      user: populated.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.body.currentUserId || req.query.currentUserId || req.body.userId;

    if (!currentUserId) {
      return res.status(400).json({ message: 'currentUserId is required' });
    }

    if (String(targetId) === String(currentUserId)) {
      return res.status(400).json({ message: 'Users cannot follow themselves.' });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyFollowing = currentUser.following.some((userId) => String(userId) === String(targetId));

    if (alreadyFollowing) {
      return res.status(400).json({ message: 'You are already following this user.' });
    }

    currentUser.following.push(targetId);
    targetUser.followers.push(currentUserId);

    await Promise.all([currentUser.save(), targetUser.save()]);

    const notification = await createNotification({
      recipient: targetId,
      sender: currentUserId,
      type: 'follow',
      message: `${currentUser.username || 'Someone'} started following you.`,
    });

    if (notification && global.io) {
      global.io.to(`user:${targetId}`).emit('notification_received', { notification });
    }

    return res.status(200).json({
      message: 'Followed successfully',
      isFollowing: true,
      currentUser: currentUser.toJSON(),
      targetUser: targetUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const unfollowUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.body.currentUserId || req.query.currentUserId || req.body.userId;

    if (!currentUserId) {
      return res.status(400).json({ message: 'currentUserId is required' });
    }

    if (String(targetId) === String(currentUserId)) {
      return res.status(400).json({ message: 'Users cannot unfollow themselves.' });
    }

    const currentUser = await User.findById(currentUserId);
    const targetUser = await User.findById(targetId);

    if (!currentUser || !targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    currentUser.following = currentUser.following.filter((userId) => String(userId) !== String(targetId));
    targetUser.followers = targetUser.followers.filter((userId) => String(userId) !== String(currentUserId));

    await Promise.all([currentUser.save(), targetUser.save()]);

    return res.status(200).json({
      message: 'Unfollowed successfully',
      isFollowing: false,
      currentUser: currentUser.toJSON(),
      targetUser: targetUser.toJSON(),
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
