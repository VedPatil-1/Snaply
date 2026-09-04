const getHealthStatus = (req, res) => {
  res.status(200).json({
    message: 'Snaply API is running',
  });
};

module.exports = { getHealthStatus };
