const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const reelSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
      validate: {
        validator: (value) => /^(https?:\/\/|\/uploads\/)/i.test(String(value || '')) && !/^blob:/i.test(String(value || '')),
        message: 'videoUrl must be an HTTP(S) URL or a server /uploads/ path.',
      },
    },
    thumbnailUrl: {
      type: String,
      default: null,
    },
    caption: {
      type: String,
      default: '',
    },
    musicName: {
      type: String,
      default: '',
    },
    likes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    comments: [commentSchema],
    views: {
      type: Number,
      default: 0,
    },
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

reelSchema.index({ createdAt: -1 });
reelSchema.index({ user: 1, createdAt: -1 });

reelSchema.virtual('likesCount').get(function () {
  return this.likes ? this.likes.length : 0;
});

reelSchema.virtual('commentsCount').get(function () {
  return this.comments ? this.comments.length : 0;
});

module.exports = mongoose.models.Reel || mongoose.model('Reel', reelSchema);
