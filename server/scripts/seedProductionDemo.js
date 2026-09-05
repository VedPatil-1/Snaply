require('dotenv').config();

const mongoose = require('mongoose');
const User = require('../models/User');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const connectDB = require('../config/db');
const { sampleUsers, samplePosts } = require('./seed');

const CONFIRMATION = 'SNAPLY_PRODUCTION_DEMO';
const DEMO_USERNAMES = ['alicia', 'marcus', 'sofia', 'liam'];

const fail = (message) => {
  throw new Error(message);
};

const validateInputs = () => {
  if (process.env.NODE_ENV !== 'production') {
    fail('Production demo seeding requires NODE_ENV=production.');
  }

  if (process.env.SEED_CONFIRM !== CONFIRMATION) {
    fail(`Production demo seeding requires SEED_CONFIRM=${CONFIRMATION}.`);
  }

  if (!process.env.MONGODB_URI) {
    fail('MONGODB_URI is required for production demo seeding.');
  }

  const reelUrl = String(process.env.DEMO_REEL_URL || '').trim();
  if (!/^https:\/\//i.test(reelUrl)) {
    fail('DEMO_REEL_URL must be an HTTPS URL for a playable production demo reel.');
  }

  return reelUrl;
};

const seedProductionDemo = async () => {
  const demoReelUrl = validateInputs();
  await connectDB();

  const selectedDatabase = mongoose.connection.name;
  if (selectedDatabase !== 'snaply-production') {
    fail(`Refusing to seed unexpected database: ${selectedDatabase || 'unknown'}.`);
  }

  const usersByUsername = new Map();
  const demoUsers = sampleUsers.filter((user) => DEMO_USERNAMES.includes(user.username));

  for (const user of demoUsers) {
    const savedUser = await User.findOneAndUpdate(
      { username: user.username },
      { $setOnInsert: user },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    usersByUsername.set(user.username, savedUser);
  }

  const demoPosts = samplePosts.filter((post) => DEMO_USERNAMES.includes(post.user));
  for (const post of demoPosts) {
    const user = usersByUsername.get(post.user);
    if (!user) continue;

    await Post.findOneAndUpdate(
      { user: user._id, caption: post.caption, location: post.location },
      {
        $setOnInsert: {
          user: user._id,
          mediaUrl: post.mediaUrl,
          mediaType: post.mediaType,
          caption: post.caption,
          location: post.location,
          likes: [],
          comments: [],
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  const alicia = usersByUsername.get('alicia');
  await Reel.findOneAndUpdate(
    { user: alicia._id, caption: 'Snaply production demo reel' },
    {
      $setOnInsert: {
        user: alicia._id,
        videoUrl: demoReelUrl,
        caption: 'Snaply production demo reel',
        musicName: 'Original Audio',
        likes: [],
        comments: [],
        views: 0,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Production demo data ensured in ${selectedDatabase}.`);
  console.log(`Users ensured: ${demoUsers.length}; posts ensured: ${demoPosts.length}; reels ensured: 1.`);
};

seedProductionDemo()
  .catch((error) => {
    console.error('Production demo seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
