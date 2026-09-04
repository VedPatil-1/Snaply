require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Reel = require('../models/Reel');

const profiles = [
  { username: 'maya', name: 'Maya Patel', bio: 'Books, bikes, and beautiful mornings.' },
  { username: 'alex', name: 'Alex Morgan', bio: 'Making ordinary days interesting.' },
  { username: 'sofia', name: 'Sofia Nguyen', bio: 'Capturing everyday magic.' },
  { username: 'emma', name: 'Emma Ross', bio: 'Minimalism, brunch, and good playlists.' },
  { username: 'noah', name: 'Noah Parker', bio: 'Just a mountain man with a camera.' },
];

const reelPlan = [
  ['maya', 'reel-01.mp4', 'A slow morning and a quiet page.'],
  ['alex', 'reel-02.mp4', 'A new angle on an ordinary day.'],
  ['sofia', 'reel-03.mp4', 'Tiny details, big feelings.'],
  ['maya', 'reel-04.mp4', 'Finding a little color outside.'],
  ['alex', 'reel-05.mp4', 'Keep moving with the light.'],
  ['sofia', 'reel-06.mp4', 'A small scene worth remembering.'],
  ['emma', 'reel-07.mp4', 'No filter needed.'],
  ['noah', 'reel-08.mp4', 'Chasing the quiet before sunrise.'],
  ['emma', 'reel-09.mp4', 'One more loop before sunset.'],
  ['noah', 'reel-10.mp4', 'A little reset in motion.'],
];

const resetDevelopmentReels = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development reel reset cannot run in production.');
  }

  await connectDB();

  const alicia = await User.findOne({ username: 'alicia' });
  if (!alicia) throw new Error('Seeded user alicia was not found.');

  const removed = await Reel.deleteMany({ user: alicia._id });
  const users = new Map([['alicia', alicia]]);

  for (const profile of profiles) {
    let user = await User.findOne({ username: profile.username });
    if (!user) user = await User.create(profile);
    users.set(profile.username, user);
  }

  for (const [username, filename, caption] of reelPlan) {
    const videoUrl = `/uploads/reels/${filename}`;
    const user = users.get(username);
    const existing = await Reel.findOne({ videoUrl });
    if (existing) {
      existing.user = user._id;
      existing.caption = caption;
      existing.musicName = 'Snaply Demo Audio';
      await existing.save();
    } else {
      await Reel.create({ user: user._id, videoUrl, caption, musicName: 'Snaply Demo Audio' });
    }
  }

  console.log(`[Snaply] removed Alicia reels: ${removed.deletedCount}`);
  console.log(`[Snaply] development reels ready: ${reelPlan.length}`);
};

resetDevelopmentReels()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[Snaply] development Reel reset failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
