require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const makeAdmin = async (email) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      process.exit(1);
    }
    
    user.role = 'admin';
    user.isEmailVerified = true;
    await user.save();
    
    console.log('SUCCESS! User is now admin:', email);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
};

// Change this email to your email
const email = process.argv[2];
if (!email) {
  console.log('Usage: node make-admin.js your@email.com');
  process.exit(1);
}

makeAdmin(email);
