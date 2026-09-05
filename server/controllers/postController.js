const Post = require('../models/Post');
const User = require('../models/User');
const { createNotification } = require('./notificationController');

const getCurrentUserId = async () => {
  const user = await User.findOne({ username: 'alicia' }).lean();
  return user ? user._id : null;
};

const populatePost = (post, currentUserId, savedPostIds = []) => {
  const plainPost = post.toObject ? post.toObject() : post;

  return {
    ...plainPost,
    likes: plainPost.likes || [],
    comments: plainPost.comments || [],
    likesCount: (plainPost.likes || []).length,
    commentsCount: (plainPost.comments || []).length,
    isLiked: currentUserId
      ? (plainPost.likes || []).some((userId) => String(userId) === String(currentUserId))
      : false,
    isSaved: savedPostIds.some((id) => String(id) === String(plainPost._id)),
    user: plainPost.user && typeof plainPost.user === 'object'
      ? {
          ...plainPost.user,
          followersCount: plainPost.user.followersCount || plainPost.user.followers?.length || 0,
          followingCount: plainPost.user.followingCount || plainPost.user.following?.length || 0,
        }
      : plainPost.user,
  };
};

const withFollowState = (post, currentUser, savedPostIds = []) => {
  const serialized = populatePost(post, currentUser?._id, currentUser?.savedPosts || []);
  if (serialized.user && currentUser) {
    serialized.user.isFollowing = (currentUser.following || []).some(
      (followedId) => String(followedId) === String(serialized.user._id)
    );
  }
  return serialized;
};

const getPostsFeed = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId || (await getCurrentUserId());
    const currentUser = currentUserId ? await User.findById(currentUserId).lean() : null;
    const savedPostIds = (currentUser?.savedPosts || []).map((id) => String(id));
    const posts = await Post.find()
      .populate('user', 'name username profilePicture bio followers following')
      .populate({
        path: 'comments.user',
        select: 'name username profilePicture',
      })
      .sort({ createdAt: -1 });

    const normalizedPosts = posts.map((post) => {
      const user = post.user || null;
      const userObj = user && user.toObject ? user.toObject() : user;

      if (userObj && currentUser && userObj._id) {
        userObj.isFollowing = Array.isArray(currentUser.following)
          ? currentUser.following.some((followedId) => String(followedId) === String(userObj._id))
          : false;
      }

      const nextPost = {
        ...post.toObject(),
        user: userObj,
      };

      const serialized = populatePost(nextPost, currentUserId);
      serialized.isSaved = savedPostIds.includes(String(post._id));
      return serialized;
    });

    res.status(200).json(normalizedPosts);
  } catch (error) {
    next(error);
  }
};

const getPostById = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId || (await getCurrentUserId());
    const post = await Post.findById(req.params.id)
      .populate('user', 'name username profilePicture bio followers following')
      .populate({
        path: 'comments.user',
        select: 'name username profilePicture',
      });

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const currentUser = currentUserId ? await User.findById(currentUserId).select('following savedPosts').lean() : null;
    return res.status(200).json(withFollowState(post, currentUser, currentUser?.savedPosts || []));
  } catch (error) {
    next(error);
  }
};

const getPostsByUser = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId || (await getCurrentUserId());
    const posts = await Post.find({ user: req.params.userId })
      .populate('user', 'name username profilePicture bio followers following')
      .populate({
        path: 'comments.user',
        select: 'name username profilePicture',
      })
      .sort({ createdAt: -1 });

    const currentUser = currentUserId ? await User.findById(currentUserId).select('following savedPosts').lean() : null;
    res.status(200).json(posts.map((post) => withFollowState(post, currentUser, currentUser?.savedPosts || [])));
  } catch (error) {
    next(error);
  }
};

const createPost = async (req, res, next) => {
  try {
    const { userId, mediaUrl, mediaType = 'image', caption = '', location = '' } = req.body;

    if (!mediaUrl) {
      return res.status(400).json({ message: 'mediaUrl is required' });
    }

    const resolvedUserId = userId || (await getCurrentUserId());
    if (!resolvedUserId) {
      return res.status(400).json({ message: 'User is required to create a post.' });
    }

    const post = await Post.create({
      user: resolvedUserId,
      mediaUrl,
      mediaType,
      caption,
      location,
      likes: [],
      comments: [],
    });

    const populated = await post.populate('user', 'name username profilePicture bio');
    return res.status(201).json(populatePost(populated, resolvedUserId));
  } catch (error) {
    next(error);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const currentUserId = req.body?.userId || req.query.userId;
    const post = await Post.findOne({ _id: req.params.id, user: currentUserId });

    if (!post) {
      return res.status(404).json({ message: 'Post not found or not owned by current user' });
    }

    await post.deleteOne();
    return res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const toggleLike = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!userId) {
      return res.status(400).json({ message: 'userId is required to like a post' });
    }

    const alreadyLiked = post.likes.some((user) => String(user) === String(userId));

    if (alreadyLiked) {
      post.likes = post.likes.filter((user) => String(user) !== String(userId));
    } else {
      post.likes.push(userId);

      if (String(post.user) !== String(userId)) {
        const senderUser = await User.findById(userId).select('username').lean();
        const notification = await createNotification({
          recipient: post.user,
          sender: userId,
          type: 'like',
          post: post._id,
          message: `${senderUser?.username || 'Someone'} liked your post.`,
        });

        if (notification && global.io) {
          global.io.to(`user:${post.user}`).emit('notification_received', { notification });
        }
      }
    }

    await post.save();
    const populated = await Post.findById(post._id)
      .populate('user', 'name username profilePicture bio followers following')
      .populate({
        path: 'comments.user',
        select: 'name username profilePicture',
      });

    const currentUser = await User.findById(userId).select('following').lean();
    return res.status(200).json(withFollowState(populated, currentUser));
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const { userId, text } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!userId || !text || !text.trim()) {
      return res.status(400).json({ message: 'userId and text are required' });
    }

    post.comments.push({ user: userId, text: text.trim() });
    await post.save();

    if (String(post.user) !== String(userId)) {
      const senderUser = await User.findById(userId).select('username').lean();
      const notification = await createNotification({
        recipient: post.user,
        sender: userId,
        type: 'comment',
        post: post._id,
        message: `${senderUser?.username || 'Someone'} commented on your post.`,
      });

      if (notification && global.io) {
        global.io.to(`user:${post.user}`).emit('notification_received', { notification });
      }
    }

    const populated = await Post.findById(post._id)
      .populate('user', 'name username profilePicture bio followers following')
      .populate({
        path: 'comments.user',
        select: 'name username profilePicture',
      });

    const currentUser = await User.findById(userId).select('following').lean();
    return res.status(200).json(withFollowState(populated, currentUser));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPostsFeed,
  getPostById,
  getPostsByUser,
  createPost,
  deletePost,
  toggleLike,
  addComment,
};
