const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    profilePicture: {
      type: String,
      default: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
    },
    bio: {
      type: String,
      default: '',
    },
    followers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    following: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    savedReels: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Reel',
    }],
    savedPosts: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Post',
    }],
  },
  {
    timestamps: {
      createdAt: true,
      updatedAt: false,
    },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('followersCount').get(function () {
  return this.followers ? this.followers.length : 0;
});

userSchema.virtual('followingCount').get(function () {
  return this.following ? this.following.length : 0;
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
