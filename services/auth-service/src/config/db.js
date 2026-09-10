const mongoose = require('mongoose');

mongoose.set('bufferTimeoutMS', 30000);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 30000,
    });
    console.log(`✅ [auth-service] MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`❌ [auth-service] MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;