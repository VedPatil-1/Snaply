const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Post = require('../models/Post');
const Reel = require('../models/Reel');
const Story = require('../models/Story');
const connectDB = require('../config/db');

dotenv.config();

const REEL_FILENAMES = Array.from({ length: 10 }, (_, index) => `reel-${String(index + 1).padStart(2, '0')}.mp4`);
const reelUploadDir = path.join(__dirname, '..', 'uploads', 'reels');

const ensureSeedReelMedia = () => {
  const missing = REEL_FILENAMES.filter((filename) => {
    const fullPath = path.join(reelUploadDir, filename);
    return !fs.existsSync(fullPath) || fs.statSync(fullPath).size === 0;
  });
  if (missing.length) {
    throw new Error(`Seed aborted: add real MP4 files to ${reelUploadDir} before seeding. Missing: ${missing.join(', ')}`);
  }
};

const sampleUsers = [
  {
    name: 'Alicia Bloom',
    username: 'alicia',
    profilePicture: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    bio: 'Designing joy, one tiny detail at a time.',
  },
  {
    name: 'Marcus Hill',
    username: 'marcus',
    profilePicture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    bio: 'Travel, coffee, and a little chaos.',
  },
  {
    name: 'Sofia Nguyen',
    username: 'sofia',
    profilePicture: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=400&q=80',
    bio: 'Capturing everyday magic.',
  },
  {
    name: 'Liam Brooks',
    username: 'liam',
    profilePicture: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
    bio: 'Photographer and weekend explorer.',
  },
  {
    name: 'Priya Shah',
    username: 'priya',
    profilePicture: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
    bio: 'Storytelling through color and light.',
  },
  {
    name: 'Noah Parker',
    username: 'noah',
    profilePicture: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
    bio: 'Just a mountain man with a camera.',
  },
  {
    name: 'Emma Ross',
    username: 'emma',
    profilePicture: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=400&q=80',
    bio: 'Minimalism, brunch, and good playlists.',
  },
  {
    name: 'Daniel Kim',
    username: 'daniel',
    profilePicture: 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?auto=format&fit=crop&w=400&q=80',
    bio: 'Trying every new café in town.',
  },
  {
    name: 'Maya Patel',
    username: 'maya',
    profilePicture: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=400&q=80',
    bio: 'Books, bikes, and beautiful mornings.',
  },
  {
    name: 'Ethan Clark',
    username: 'ethan',
    profilePicture: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
    bio: 'Coffee first, adventure second.',
  },
];

const sampleReels = [
  {
    user: 'alicia',
    videoUrl: '/uploads/reels/reel-01.mp4',
    caption: 'Golden hour with my favorite playlist.',
    musicName: 'Sunset Dreams - Luma',
    likes: ['marcus', 'sofia', 'liam', 'priya', 'maya'],
    comments: [{ user: 'marcus', text: 'This vibe is unreal.' }, { user: 'sofia', text: 'Absolutely gorgeous.' }],
    views: 4200,
  },
  {
    user: 'marcus',
    videoUrl: '/uploads/reels/reel-02.mp4',
    caption: 'City lights and long walks.',
    musicName: 'Night Shift - Aster',
    likes: ['alicia', 'sofia', 'emma', 'daniel'],
    comments: [{ user: 'alicia', text: 'This feels cinematic.' }],
    views: 3850,
  },
  {
    user: 'sofia',
    videoUrl: '/uploads/reels/reel-03.mp4',
    caption: 'Tiny details, big feelings.',
    musicName: 'Weekends - Nova',
    likes: ['alicia', 'liam', 'maya'],
    comments: [{ user: 'liam', text: 'Love this color story.' }],
    views: 4620,
  },
  {
    user: 'liam',
    videoUrl: '/uploads/reels/reel-04.mp4',
    caption: 'Mountain air and a little reset.',
    musicName: 'Elevation - Kairo',
    likes: ['alicia', 'sofia', 'noah', 'maya'],
    comments: [{ user: 'noah', text: 'This is peak content.' }],
    views: 5100,
  },
  {
    user: 'priya',
    videoUrl: '/uploads/reels/reel-05.mp4',
    caption: 'Color therapy for the soul.',
    musicName: 'Bloom - Sora',
    likes: ['emma', 'maya', 'alicia', 'daniel'],
    comments: [{ user: 'maya', text: 'This feels like a dream.' }],
    views: 3900,
  },
  {
    user: 'noah',
    videoUrl: '/uploads/reels/reel-06.mp4',
    caption: 'Chasing the quiet before sunrise.',
    musicName: 'Trail Light - Echo',
    likes: ['liam', 'marcus', 'daniel'],
    comments: [{ user: 'daniel', text: 'This is exactly my vibe.' }],
    views: 4210,
  },
  {
    user: 'emma',
    videoUrl: '/uploads/reels/reel-07.mp4',
    caption: 'No filter needed.',
    musicName: 'Morning Glow - Talia',
    likes: ['alicia', 'priya', 'maya'],
    comments: [{ user: 'priya', text: 'Such a soft aesthetic.' }],
    views: 3400,
  },
  {
    user: 'daniel',
    videoUrl: '/uploads/reels/reel-08.mp4',
    caption: 'Road trips and open skies.',
    musicName: 'Open Roads - Juno',
    likes: ['marcus', 'ethan', 'noah'],
    comments: [{ user: 'ethan', text: 'Need this trip list.' }],
    views: 4750,
  },
  {
    user: 'maya',
    videoUrl: '/uploads/reels/reel-09.mp4',
    caption: 'A slow morning and a quiet page.',
    musicName: 'Cafe Notes - Mira',
    likes: ['alicia', 'emma', 'sofia'],
    comments: [{ user: 'alicia', text: 'This is a mood.' }],
    views: 2980,
  },
  {
    user: 'ethan',
    videoUrl: '/uploads/reels/reel-10.mp4',
    caption: 'Best part of the day is the pause.',
    musicName: 'Still Water - Oren',
    likes: ['marcus', 'daniel', 'liam'],
    comments: [{ user: 'daniel', text: 'I’m here for this energy.' }],
    views: 3120,
  },
];

const samplePosts = [
  {
    user: 'alicia',
    mediaUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Sunrise strolls and soft light.',
    location: 'Lisbon, Portugal',
    likes: ['marcus', 'sofia', 'liam', 'priya', 'maya'],
    comments: [
      { user: 'marcus', text: 'This looks unreal.' },
      { user: 'sofia', text: 'The colors are perfect.' },
    ],
  },
  {
    user: 'marcus',
    mediaUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Adventure is the best teacher.',
    location: 'Kyiv, Ukraine',
    likes: ['alicia', 'sofia', 'priya', 'maya'],
    comments: [{ user: 'alicia', text: 'I need this exact view.' }],
  },
  {
    user: 'sofia',
    mediaUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'A perfect little city escape.',
    location: 'Paris, France',
    likes: ['alicia', 'marcus', 'liam', 'emma', 'daniel'],
    comments: [{ user: 'liam', text: 'Love the mood here.' }],
  },
  {
    user: 'liam',
    mediaUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Chasing golden hour.',
    location: 'Banff, Canada',
    likes: ['alicia', 'sofia', 'ethan', 'noah'],
    comments: [{ user: 'ethan', text: 'Epic landscape.' }],
  },
  {
    user: 'priya',
    mediaUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Small moments, big energy.',
    location: 'Jaipur, India',
    likes: ['alicia', 'liam', 'maya', 'emma'],
    comments: [{ user: 'maya', text: 'The colors are gorgeous.' }],
  },
  {
    user: 'noah',
    mediaUrl: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'The quiet before the peak.',
    location: 'Aspen, USA',
    likes: ['marcus', 'liam', 'daniel', 'ethan'],
    comments: [{ user: 'daniel', text: 'This is the life.' }],
  },
  {
    user: 'emma',
    mediaUrl: 'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Brunch and a little sparkle.',
    location: 'New York, USA',
    likes: ['alicia', 'priya', 'maya', 'sofia'],
    comments: [{ user: 'priya', text: 'Looks delicious.' }],
  },
  {
    user: 'daniel',
    mediaUrl: 'https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'This road trip was worth it.',
    location: 'Big Sur, USA',
    likes: ['alicia', 'marcus', 'noah', 'ethan'],
    comments: [{ user: 'ethan', text: 'Need this exact route.' }],
  },
  {
    user: 'maya',
    mediaUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Everyday notes and warm light.',
    location: 'Bangalore, India',
    likes: ['alicia', 'emma', 'priya', 'sofia'],
    comments: [{ user: 'alicia', text: 'Cozy energy.' }],
  },
  {
    user: 'ethan',
    mediaUrl: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Café stop, no rush.',
    location: 'Seattle, USA',
    likes: ['marcus', 'daniel', 'maya', 'emma'],
    comments: [{ user: 'daniel', text: 'This is my kind of day.' }],
  },
  {
    user: 'alicia',
    mediaUrl: 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Fresh flowers, fresh thoughts.',
    location: 'Florence, Italy',
    likes: ['sofia', 'liam', 'maya', 'ethan'],
    comments: [{ user: 'sofia', text: 'The composition is so clean.' }],
  },
  {
    user: 'marcus',
    mediaUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Water, wind, and a little wonder.',
    location: 'Maldives',
    likes: ['alicia', 'priya', 'emma', 'noah'],
    comments: [{ user: 'emma', text: 'This feels like a dream.' }],
  },
  {
    user: 'sofia',
    mediaUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Late-evening city walks are underrated.',
    location: 'Seoul, South Korea',
    likes: ['alicia', 'marcus', 'daniel', 'priya'],
    comments: [{ user: 'marcus', text: 'Perfect lighting.' }],
  },
  {
    user: 'liam',
    mediaUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Everything looks better in the mountains.',
    location: 'Zermatt, Switzerland',
    likes: ['emma', 'maya', 'noah', 'alicia'],
    comments: [{ user: 'noah', text: 'Absolutely stunning.' }],
  },
  {
    user: 'priya',
    mediaUrl: 'https://images.unsplash.com/photo-1482192505345-5655af888cc4?auto=format&fit=crop&w=1200&q=80',
    mediaType: 'image',
    caption: 'Finding calm in color.',
    location: 'Marrakech, Morocco',
    likes: ['alicia', 'sofia', 'liam', 'daniel'],
    comments: [{ user: 'daniel', text: 'Love this palette.' }],
  },
];

const sampleStories = [
  {
    user: 'marcus',
    mediaUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85',
    caption: 'A quiet morning on the road.',
  },
  {
    user: 'sofia',
    mediaUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&q=85',
    caption: 'Little details from today.',
  },
  {
    user: 'liam',
    mediaUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=85',
    caption: 'Found the perfect view.',
  },
  {
    user: 'priya',
    mediaUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=85',
    caption: 'Color everywhere today.',
  },
  {
    user: 'maya',
    mediaUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=85',
    caption: 'A slow Sunday morning.',
  },
  {
    user: 'ethan',
    mediaUrl: 'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=900&q=85',
    caption: 'Coffee first, adventure second.',
  },
];

const normalizeUsers = async () => {
  const users = await User.find({});
  const userMap = new Map(users.map((user) => [user.username, user]));

  for (const user of sampleUsers) {
    if (!userMap.has(user.username)) {
      await User.create(user);
    }
  }
};

const attachRelationships = async () => {
  const allUsers = await User.find({}).lean();
  const userMap = new Map(allUsers.map((user) => [user.username, user]));

  const followPairs = [
    ['alicia', 'marcus'],
    ['alicia', 'sofia'],
    ['alicia', 'priya'],
    ['alicia', 'maya'],
    ['marcus', 'sofia'],
    ['marcus', 'liam'],
    ['sofia', 'alicia'],
    ['liam', 'noah'],
    ['priya', 'emma'],
    ['emma', 'maya'],
    ['daniel', 'ethan'],
    ['maya', 'alicia'],
  ];

  for (const [sourceUsername, targetUsername] of followPairs) {
    const source = userMap.get(sourceUsername);
    const target = userMap.get(targetUsername);

    if (!source || !target) continue;

    const sourceDoc = await User.findById(source._id);
    const targetDoc = await User.findById(target._id);

    if (!sourceDoc.following.some((id) => String(id) === String(target._id))) {
      sourceDoc.following.push(target._id);
    }

    if (!targetDoc.followers.some((id) => String(id) === String(source._id))) {
      targetDoc.followers.push(source._id);
    }

    await sourceDoc.save();
    await targetDoc.save();
  }
};

const normalizePosts = async () => {
  const allUsers = await User.find({});
  const idMap = new Map(allUsers.map((user) => [user.username, user._id]));

  for (const entry of samplePosts) {
    const userId = idMap.get(entry.user);
    if (!userId) continue;

    const existing = await Post.findOne({ user: userId, caption: entry.caption, location: entry.location });
    if (!existing) {
      const resolvedLikes = (entry.likes || []).map((username) => idMap.get(username)).filter(Boolean);
      const resolvedComments = (entry.comments || []).map((comment) => ({
        user: idMap.get(comment.user),
        text: comment.text,
      })).filter((comment) => comment.user);

      await Post.create({
        user: userId,
        mediaUrl: entry.mediaUrl,
        mediaType: entry.mediaType,
        caption: entry.caption,
        location: entry.location,
        likes: resolvedLikes,
        comments: resolvedComments,
      });
    }
  }
};

const normalizeReels = async () => {
  const allUsers = await User.find({});
  const idMap = new Map(allUsers.map((user) => [user.username, user._id]));

  for (const entry of sampleReels) {
    const userId = idMap.get(entry.user);
    if (!userId) continue;

    const existing = await Reel.findOne({ user: userId, caption: entry.caption });
    if (!existing) {
      const resolvedLikes = (entry.likes || []).map((username) => idMap.get(username)).filter(Boolean);
      const resolvedComments = (entry.comments || []).map((comment) => ({
        user: idMap.get(comment.user),
        text: comment.text,
      })).filter((comment) => comment.user);

      await Reel.create({
        user: userId,
        videoUrl: entry.videoUrl,
        caption: entry.caption,
        musicName: entry.musicName,
        likes: resolvedLikes,
        comments: resolvedComments,
        views: entry.views || 0,
      });
    }
  }
};

const normalizeStories = async () => {
  const allUsers = await User.find({});
  const idMap = new Map(allUsers.map((user) => [user.username, user._id]));

  for (const entry of sampleStories) {
    const userId = idMap.get(entry.user);
    if (!userId) continue;

    const existing = await Story.findOne({ user: userId, caption: entry.caption });
    if (!existing) {
      await Story.create({
        user: userId,
        mediaUrl: entry.mediaUrl,
        mediaType: 'image',
        caption: entry.caption,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }
  }
};

const seedDatabase = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Database seeding is disabled in production.');
    }

    // Validate media before any destructive database operation.
    ensureSeedReelMedia();
    await connectDB();
    await User.deleteMany({});
    await Post.deleteMany({});
    await Reel.deleteMany({});
    await Story.deleteMany({});

    await normalizeUsers();
    await attachRelationships();
    await normalizePosts();
    await normalizeReels();
    await normalizeStories();

    console.log('Seeded 10 users, 15 posts, 10 reels, and 5 stories successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
};

module.exports = {
  sampleUsers,
  samplePosts,
  sampleReels,
  sampleStories,
  seedDatabase,
};

if (require.main === module) {
  seedDatabase();
}
