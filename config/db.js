const mongoose = require('mongoose');

const MONGO_URI = 'mongodb://localhost:27017/RoxilerDB';

const connectDB = async () => {
    try {
        await mongoose.connect(MONGO_URI, {
        });
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed", error);
        process.exit(1);
    }
};

module.exports = connectDB;
