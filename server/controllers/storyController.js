const User = require('../models/User');
const Post = require('../models/Post');

const getStories = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name username profilePicture bio')
      .limit(10)
      .lean();

    const storyUsers = await Promise.all(
      users.map(async (user) => {
        const latestPost = await Post.findOne({ user: user._id })
          .sort({ createdAt: -1 })
          .select('mediaUrl caption createdAt')
          .lean();

        return {
          id: user._id.toString(),
          label: user.username,
          name: user.name,
          avatar: user.profilePicture,
          bio: user.bio || '',
          mediaUrl: latestPost?.mediaUrl || user.profilePicture,
          caption: latestPost?.caption || user.bio || 'Recent update',
          createdAt: latestPost?.createdAt || new Date().toISOString(),
        };
      })
    );

    return res.status(200).json(storyUsers);
  } catch (error) {
    next(error);
  }
};

module.exports = { getStories };
