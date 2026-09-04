const User = require('../models/User');
const Post = require('../models/Post');

const sanitizeQuery = (value = '') => String(value).trim();

const getSearchUsers = async (req, res, next) => {
  try {
    const q = sanitizeQuery(req.query.q);

    if (!q) {
      return res.status(200).json([]);
    }

    const regex = new RegExp(q, 'i');

    const users = await User.find({
      $or: [{ username: regex }, { name: regex }],
    })
      .select('name username profilePicture bio followers following')
      .limit(12)
      .sort({ username: 1 });

    const currentUser = await User.findOne({ username: 'alicia' }).select('following').lean();
    const payload = users.map((user) => {
      const plain = user.toJSON ? user.toJSON() : user;
      return {
        ...plain,
        isFollowing: Boolean(
          currentUser?.following?.some((followedId) => String(followedId) === String(plain._id))
        ),
      };
    });

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

const getSearchPosts = async (req, res, next) => {
  try {
    const q = sanitizeQuery(req.query.q);

    if (!q) {
      return res.status(200).json([]);
    }

    const regex = new RegExp(q, 'i');

    const posts = await Post.find({
      $or: [{ caption: regex }, { location: regex }],
    })
      .populate('user', 'name username profilePicture bio followers following')
      .populate({ path: 'comments.user', select: 'name username profilePicture' })
      .sort({ createdAt: -1 })
      .limit(12);

    const payload = posts.map((post) => ({
      ...post.toObject(),
      likesCount: post.likes.length,
      commentsCount: post.comments.length,
      user: post.user,
    }));

    return res.status(200).json(payload);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSearchUsers,
  getSearchPosts,
};
