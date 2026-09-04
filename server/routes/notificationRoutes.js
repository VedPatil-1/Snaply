const express = require('express');
const {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notificationController');

const router = express.Router();

router.get('/', getNotifications);
router.patch('/:id/read', markNotificationRead);
router.patch('/read-all', markAllNotificationsRead);

module.exports = router;
