require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Verify transporter connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter error:', error.message);
  } else {
    console.log('Email transporter ready');
  }
});

const sendEmail = async ({ to, subject, html }) => {
  try {
    console.log('Sending email to:', to);
    console.log('Email user:', process.env.EMAIL_USER);
    const info = await transporter.sendMail({
      from: `"MCES International" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch (error) {
    console.error('Email send error:', error.message);
    return false;
  }
};

module.exports = { sendEmail };
