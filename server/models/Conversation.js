const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

conversationSchema.index({ participants: 1, updatedAt: -1 });

module.exports = mongoose.models.Conversation || mongoose.model('Conversation', conversationSchema);
