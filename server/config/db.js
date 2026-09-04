const mongoose = require('mongoose');

const connectDB = async () => {
  const isProduction = process.env.NODE_ENV === 'production';
  const databaseName = isProduction ? 'snaply-production' : 'test';

  if (!process.env.MONGODB_URI) {
    if (isProduction) {
      throw new Error('MONGODB_URI is required in production.');
    }

    console.warn('MongoDB URI not set. Running without a database connection in development mode.');
    return false;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: databaseName,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`MongoDB connected: ${conn.connection.host}/${databaseName}`);
  } catch (error) {
    throw new Error(`MongoDB connection failed for ${databaseName}.`);
  }
};

module.exports = connectDB;
