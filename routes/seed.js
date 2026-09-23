const express = require('express');
const router = express.Router();

// GET /api/seed - Deprecated, admin seeding removed
router.get('/', async (req, res) => {
  res.json({ message: 'Admin seeding disabled. Create admin manually via database.' });
});

module.exports = router;
