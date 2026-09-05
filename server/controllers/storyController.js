const User = require('../models/User');
const Story = require('../models/Story');
const fs = require('fs');
const path = require('path');

const getStories = async (req, res, next) => {
  try {
    const currentUserId = req.query.userId;
    const currentUser = currentUserId ? await User.findById(currentUserId).select('viewedStories').lean() : null;
    const viewedStories = new Set((currentUser?.viewedStories || []).map((id) => String(id)));
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .populate('user', 'name username profilePicture bio')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const groupedStories = new Map();
    for (const story of stories) {
      const userId = String(story.user?._id || '');
      if (!userId) continue;
      if (!groupedStories.has(userId)) groupedStories.set(userId, []);
      groupedStories.get(userId).push({
        id: story._id.toString(),
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        caption: story.caption || '',
        createdAt: story.createdAt,
        viewed: viewedStories.has(String(story._id)),
      });
    }

    const storyUsers = [...groupedStories.entries()]
      .filter(([userId]) => userId !== String(currentUserId || ''))
      .map(([userId, userStories]) => {
        const story = stories.find((entry) => String(entry.user?._id) === userId);
        return {
          id: userStories[0].id,
          label: story.user?.username || 'Story',
          name: story.user?.name || 'Story',
          avatar: story.user?.profilePicture,
          bio: story.user?.bio || '',
          mediaUrl: story.mediaUrl,
          mediaType: story.mediaType,
          caption: story.caption || '',
          createdAt: story.createdAt,
          viewed: userStories.every((entry) => entry.viewed),
          userId: story.user?._id,
          isCurrentUser: false,
          stories: userStories,
        };
      });

    if (currentUserId) {
      const currentUserProfile = await User.findById(currentUserId).select('name username profilePicture bio').lean();
      const ownStories = groupedStories.get(String(currentUserId)) || [];
      if (currentUserProfile) {
        storyUsers.unshift({
          id: ownStories[0]?.id || `create-${currentUserProfile._id}`,
          label: 'your story',
          name: currentUserProfile.name || 'Your story',
          avatar: currentUserProfile.profilePicture,
          mediaUrl: ownStories[0]?.mediaUrl || currentUserProfile.profilePicture,
          mediaType: ownStories[0]?.mediaType || null,
          caption: ownStories[0]?.caption || 'Add to your story',
          viewed: ownStories.length > 0 && ownStories.every((entry) => entry.viewed),
          userId: currentUserProfile._id,
          isCurrentUser: true,
          isCreateEntry: ownStories.length === 0,
          stories: ownStories,
        });
      }
    }

    return res.status(200).json(storyUsers);
  } catch (error) {
    next(error);
  }
};

const createStory = async (req, res, next) => {
  try {
    const { userId, mediaUrl, mediaType, caption = '', durationMs = 0 } = req.body || {};
    if (!userId || !mediaUrl || !['image', 'video'].includes(mediaType)) {
      return res.status(400).json({ message: 'userId, mediaUrl, and mediaType are required' });
    }
    if (mediaType === 'video' && Number(durationMs) > 30000) {
      return res.status(400).json({ message: 'Story videos cannot exceed 30 seconds.' });
    }

    const story = await Story.create({ user: userId, mediaUrl, mediaType, caption });
    const populated = await story.populate('user', 'name username profilePicture bio');
    return res.status(201).json(populated.toJSON());
  } catch (error) {
    next(error);
  }
};

const deleteStory = async (req, res, next) => {
  try {
    const currentUserId = req.body?.userId || req.query?.userId;
    const currentUser = await User.findOne({ username: 'alicia' }).select('_id').lean();
    if (!currentUserId || !currentUser || String(currentUser._id) !== String(currentUserId)) {
      return res.status(403).json({ message: 'Only the current development user can delete stories.' });
    }

    const story = await Story.findOne({ _id: req.params.storyId, user: currentUser._id }).lean();
    if (!story) return res.status(404).json({ message: 'Story not found or not owned by current user' });

    await Story.deleteOne({ _id: story._id });
    if (/^\/uploads\//i.test(story.mediaUrl)) {
      const mediaPath = path.join(__dirname, '..', story.mediaUrl.replace(/^\//, ''));
      await fs.promises.rm(mediaPath, { force: true }).catch(() => null);
    }

    return res.status(200).json({ message: 'Story deleted successfully', storyId: story._id });
  } catch (error) {
    next(error);
  }
};

const markStoryViewed = async (req, res, next) => {
  try {
    const storyId = req.params?.storyId || req.params?.id;
    const viewerId = req.body?.userId || req.query?.userId;

    if (!storyId) {
      return res.status(400).json({ message: 'storyId is required' });
    }

    if (!viewerId) {
      return res.status(400).json({ message: 'userId is required' });
    }

    const story = await Story.findById(storyId).select('_id user').lean();
    if (!story) {
      return res.status(404).json({ message: 'Story not found' });
    }
    const storyUserId = story.user;

    const viewer = await User.findById(viewerId).select('_id viewedStories').lean();
    if (!viewer) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (String(viewerId) === String(storyUserId)) {
      return res.status(200).json({ viewed: true, storyId, viewerId });
    }

    const updatedUser = await User.findByIdAndUpdate(
      viewerId,
      { $addToSet: { viewedStories: storyId } },
      { new: true }
    ).select('_id viewedStories');

    return res.status(200).json({
      viewed: true,
      storyId,
      viewerId,
      viewedStoryIds: updatedUser?.viewedStories || [],
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getStories, createStory, deleteStory, markStoryViewed };
