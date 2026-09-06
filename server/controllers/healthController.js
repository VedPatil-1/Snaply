const User = require('../models/User');
const { onlineUsers } = require('../services/socketService');

const getHealthStatus = async (req, res) => {
  const demoUsers = await User.find({ username: { $in: ['ethan', 'sofia'] } })
    .select('username')
    .lean();
  res.status(200).json({
    message: 'Snaply API is running',
    demoChat: demoUsers.map((user) => ({
      username: user.username,
      online: onlineUsers.has(String(user._id)),
    })),
  });
};

module.exports = { getHealthStatus };
