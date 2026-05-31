const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const { protect } = require('../middleware/auth');

router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const userAccounts = await Account.find({ user: req.user._id }).select('_id');
    const ids = userAccounts.map(a => a._id);
    const filter = { $or: [{ fromAccount: { $in: ids } }, { toAccount: { $in: ids } }, { user: req.user._id }] };
    const transactions = await Transaction.find(filter)
      .populate('fromAccount', 'accountType accountNumber currency')
      .populate('toAccount',   'accountType accountNumber currency')
      .sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const total = await Transaction.countDocuments(filter);
    res.json({ success: true, transactions, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/transfer', protect, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { fromAccountId, toAccountId, amount, description } = req.body;
    if (!fromAccountId || !toAccountId || !amount)
      return res.status(400).json({ success: false, message: 'Missing fields' });
    const from = await Account.findOne({ _id: fromAccountId, user: req.user._id }).session(session);
    if (!from) return res.status(404).json({ success: false, message: 'Source account not found' });
    if (from.isFrozen) return res.status(403).json({ success: false, message: 'Source account is frozen' });
    if (from.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient funds' });
    const to = await Account.findById(toAccountId).session(session);
    if (!to) return res.status(404).json({ success: false, message: 'Destination account not found' });
    if (to.isFrozen) return res.status(403).json({ success: false, message: 'Destination account is frozen' });
    from.balance -= Number(amount);
    to.balance   += Number(amount);
    await from.save({ session });
    await to.save({ session });
    const [tx] = await Transaction.create([{
      fromAccount: fromAccountId, toAccount: toAccountId,
      user: req.user._id, type: 'transfer',
      amount: Number(amount), currency: from.currency,
      description: description || 'Transfer', category: 'Transfer', status: 'completed',
    }], { session });
    await session.commitTransaction(); session.endSession();
    res.status(201).json({ success: true, transaction: tx });
  } catch (err) {
    await session.abortTransaction(); session.endSession();
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
