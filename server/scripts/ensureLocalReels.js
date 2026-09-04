require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/User');
const Reel = require('../models/Reel');

const localReels = [
  ['reel-01.mp4', 'A little color for the day.'],
  ['reel-02.mp4', 'A quiet moment in motion.'],
  ['reel-03.mp4', 'Small scenes, good energy.'],
  ['reel-04.mp4', 'Keep moving with the light.'],
  ['reel-05.mp4', 'One more loop before sunset.'],
];

const ensureLocalReels = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Development reel setup cannot run in production.');
  }

  await connectDB();
  const user = await User.findOne({ username: 'alicia' });
  if (!user) throw new Error('Seeded user alicia was not found.');

  for (const [filename, caption] of localReels) {
    const videoUrl = `/uploads/reels/${filename}`;
    const existing = await Reel.findOne({ videoUrl });
    if (!existing) {
      await Reel.create({ user: user._id, videoUrl, caption, musicName: 'Snaply Demo Audio' });
      console.log('[Snaply] created local reel:', videoUrl);
    } else {
      console.log('[Snaply] local reel already exists:', videoUrl);
    }
  }
};

ensureLocalReels()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('[Snaply] local reel setup failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  });
