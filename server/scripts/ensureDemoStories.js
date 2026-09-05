const dotenv = require('dotenv');
const User = require('../models/User');
const Story = require('../models/Story');
const connectDB = require('../config/db');

dotenv.config();

const demoStories = [
  {
    username: 'marcus',
    mediaUrl: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=85',
    caption: 'A quiet morning on the road.',
  },
  {
    username: 'sofia',
    mediaUrl: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=900&q=85',
    caption: 'Little details from today.',
  },
  {
    username: 'liam',
    mediaUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=900&q=85',
    caption: 'Found the perfect view.',
  },
  {
    username: 'priya',
    mediaUrl: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=900&q=85',
    caption: 'Color everywhere today.',
  },
  {
    username: 'maya',
    mediaUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=900&q=85',
    caption: 'A slow Sunday morning.',
  },
];

const ensureDemoStories = async () => {
  await connectDB();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  for (const demoStory of demoStories) {
    const user = await User.findOne({ username: demoStory.username }).select('_id').lean();
    if (!user) continue;

    await Story.updateOne(
      { user: user._id, caption: demoStory.caption },
      {
        $set: {
          mediaUrl: demoStory.mediaUrl,
          mediaType: 'image',
          expiresAt,
        },
        $setOnInsert: { user: user._id, caption: demoStory.caption },
      },
      { upsert: true }
    );
  }

  console.log(`Ensured ${demoStories.length} deterministic demo stories.`);
  process.exit(0);
};

ensureDemoStories().catch((error) => {
  console.error('Demo story restore failed:', error);
  process.exit(1);
});
