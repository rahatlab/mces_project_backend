const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');
const User = require('../models/User');
const dbHelper = require('../models/modelHelper');
const { sendEmail } = require('../config/email');

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const existing = await dbHelper.findOne(User, 'users', { email });
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await dbHelper.create(User, 'users', {
      name,
      email,
      password: hashedPassword,
      role: 'user',
      isEmailVerified: false,
      verificationToken,
      verificationTokenExpiry
    });

    // Send verification email
    const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: 'MCES - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0d9488;">MCES International</h2>
          <p>আপনার অ্যাকাউন্ট তৈরি করা হয়েছে।</p>
          <p>নিচের বাটনে ক্লিক করে আপনার ইমেইল ভেরিফাই করুন:</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">ইমেইল ভেরিফাই করুন</a>
          <p style="color: #666; font-size: 12px;">এই লিংক ২৪ ঘণ্টার জন্য বৈধ।</p>
          <p style="color: #666; font-size: 12px;">আপনি এই ইমেইলটি অনুরোধ না করে থাকলে এটি উপেক্ষা করুন।</p>
        </div>
      `
    });

    const token = jwt.sign({ id: user._id || user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: false
      },
      message: 'Verification email sent. Please check your inbox.'
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const user = await dbHelper.findOne(User, 'users', { email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Password verification (no bypass - dynamic password)
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check email verification for non-admin users
    if (user.role !== 'admin' && !user.isEmailVerified) {
      return res.status(403).json({ error: 'Email not verified. Please check your inbox.' });
    }

    const token = jwt.sign({ id: user._id || user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: {
        id: user._id || user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await dbHelper.findById(User, 'users', decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      id: user._id || user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// POST /api/auth/send-verification
router.post('/send-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await dbHelper.findOne(User, 'users', { email });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    user.verificationToken = verificationToken;
    user.verificationTokenExpiry = verificationTokenExpiry;
    await user.save();

    const verifyUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    await sendEmail({
      to: email,
      subject: 'MCES - Email Verification',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0d9488;">MCES International</h2>
          <p>নিচের বাটনে ক্লিক করে আপনার ইমেইল ভেরিফাই করুন:</p>
          <a href="${verifyUrl}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">ইমেইল ভেরিফাই করুন</a>
          <p style="color: #666; font-size: 12px;">এই লিংক ২৪ ঘণ্টার জন্য বৈধ।</p>
        </div>
      `
    });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    console.error('Send verification error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/verify-email/:token
router.get('/verify-email/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const user = await dbHelper.findOne(User, 'users', { verificationToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    if (user.verificationTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'Verification token expired' });
    }

    user.isEmailVerified = true;
    user.verificationToken = null;
    user.verificationTokenExpiry = null;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    const user = await dbHelper.findOne(User, 'users', { email });
    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If the email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hour

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const resetUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: email,
      subject: 'MCES - Password Reset Request',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #0d9488;">MCES International</h2>
          <p>আপনি পাসওয়ার্ড রিসেট অনুরোধ করেছেন।</p>
          <p>নিচের বাটনে ক্লিক করে নতুন পাসওয়ার্ড সেট করুন:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0d9488; color: white; text-decoration: none; border-radius: 8px; margin: 16px 0;">পাসওয়ার্ড রিসেট করুন</a>
          <p style="color: #666; font-size: 12px;">এই লিংক ১ ঘণ্টার জন্য বৈধ।</p>
          <p style="color: #666; font-size: 12px;">আপনি এই অনুরোধ না করে থাকলে এটি উপেক্ষা করুন।</p>
        </div>
      `
    });

    res.json({ message: 'If the email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }

  try {
    const user = await dbHelper.findOne(User, 'users', { resetToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    if (user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: 'Reset token expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/change-password (logged in user)
router.post('/change-password', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: 'Old password and new password are required' });
  }

  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'New password must be at least 4 characters' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await dbHelper.findById(User, 'users', decoded.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Old password is incorrect' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/promote-admin (one-time use, protected by secret key)
router.post('/promote-admin', async (req, res) => {
  const { email, secretKey } = req.body;

  if (secretKey !== 'mces_admin_promote_2026') {
    return res.status(403).json({ error: 'Invalid secret key' });
  }

  try {
    const user = await dbHelper.findOne(User, 'users', { email });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Register first.' });
    }

    user.role = 'admin';
    user.isEmailVerified = true;
    await user.save();

    res.json({ message: `${email} is now admin!`, role: user.role });
  } catch (error) {
    console.error('Promote admin error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router };
