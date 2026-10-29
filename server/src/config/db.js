
import mongoose from 'mongoose';

const connectDB = async () => {
  const uri = process.env.MONGODB_URI?.trim();

  if (!uri) {
    throw new Error('MONGODB_URI missing in .env file');
  }

  if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
    throw new Error('Invalid MongoDB connection string');
  }

  try {
    console.log('Connecting to MongoDB Atlas...');

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 20000
    });

    console.log('MongoDB Connected Successfully');

  } catch (error) {
    console.error('MongoDB Connection Failed:', error.message);

    if (error.reason?.servers) {
      for (const [host, server] of error.reason.servers) {
        console.error('Server:', host);
        console.error(
          'Actual Error:',
          server.error?.message || 'No detailed error'
        );
      }
    }

    throw error;
  }
};

export default connectDB;
