const getNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

module.exports = {
  DEV_CHAT_SIMULATION: String(process.env.DEV_CHAT_SIMULATION || 'true').toLowerCase() !== 'false',
  DEV_SIMULATED_USERS: ['ethan', 'sofia'],
  DEV_OFFLINE_USERS: ['liam', 'marcus'],
  DEV_REPLY_DELAY_MS: getNumber(process.env.DEV_REPLY_DELAY_MS, 1500),
  DEV_TYPING_DELAY_MS: getNumber(process.env.DEV_TYPING_DELAY_MS, 900),
  DEV_SEEN_DELAY_MS: getNumber(process.env.DEV_SEEN_DELAY_MS, 1800),
};
