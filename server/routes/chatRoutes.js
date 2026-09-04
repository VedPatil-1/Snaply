const express = require('express');
const {
  getConversations,
  createConversation,
  getConversationMessages,
  createMessage,
  updateMessageStatus,
} = require('../controllers/chatController');

const router = express.Router();

router.get('/conversations', getConversations);
router.post('/conversations', createConversation);
router.get('/conversations/:id/messages', getConversationMessages);
router.post('/messages', createMessage);
router.patch('/messages/:messageId/status', updateMessageStatus);

module.exports = router;
