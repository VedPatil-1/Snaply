require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Post = require('../models/Post');

const removeDevelopmentUserPostComments = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('This development-only cleanup cannot run in production.');
  }

  await connectDB();
  const user = await User.findOne({ username: 'alicia' }).select('_id').lean();
  if (!user) throw new Error('Development user alicia was not found.');

  const posts = await Post.find({ 'comments.user': user._id }).select('_id comments');
  let removedCount = 0;

  for (const post of posts) {
    const originalCount = post.comments.length;
    post.comments = post.comments.filter((comment) => String(comment.user) !== String(user._id));
    removedCount += originalCount - post.comments.length;
    if (post.comments.length !== originalCount) await post.save();
  }

  console.log(`[Snaply] removed Alicia test comments: ${removedCount}`);
};

removeDevelopmentUserPostComments()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[Snaply] comment cleanup failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
