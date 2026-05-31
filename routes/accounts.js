const express = require('express');
const router = express.Router();
const Account = require('../models/Account');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const accounts = await Account.find({ user: req.user._id });
    res.json({ success: true, accounts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
