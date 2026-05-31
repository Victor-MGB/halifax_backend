const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/auth');

router.use(protect, adminOnly);

const notify = async (userId, title, message, type = 'info') => {
  try { await Notification.create({ user: userId, title, message, type }); } catch {}
};

router.get('/analytics', async (req, res) => {
  try {
    const totalUsers       = await User.countDocuments({ role: 'user' });
    const activeUsers      = await User.countDocuments({ role: 'user', isActive: true });
    const frozenAccounts   = await Account.countDocuments({ isFrozen: true });
    const totalAccounts    = await Account.countDocuments();
    const totalTransactions = await Transaction.countDocuments();
    const pendingWithdrawals = await WithdrawalRequest.countDocuments({ status: 'in_progress' });

    const balAgg = await Account.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
    const totalBalance = balAgg[0]?.total || 0;

    const sixMo = new Date(); sixMo.setMonth(sixMo.getMonth() - 6);
    const monthlyVolume = await Transaction.aggregate([
      { $match: { createdAt: { $gte: sixMo } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 }, volume: { $sum: '$amount' } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } }
    ]);
    const byCategory = await Transaction.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 }, total: { $sum: '$amount' } } },
      { $sort: { total: -1 } }
    ]);

    res.json({ success: true, stats: { totalUsers, activeUsers, frozenAccounts, totalAccounts, totalTransactions, totalBalance, pendingWithdrawals }, monthlyVolume, byCategory });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.post('/fund', async (req, res) => {
  try {
    const { userId, accountId, amount, currency, description } = req.body;
    if (!userId || !accountId || !amount) return res.status(400).json({ success: false, message: 'userId, accountId, amount required' });

    const account = await Account.findOne({ _id: accountId, user: userId });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (account.isFrozen) return res.status(403).json({ success: false, message: 'Account is frozen' });

    // Update currency if different
    if (currency && currency !== account.currency) account.currency = currency;
    account.balance += Number(amount);
    await account.save();

    await Transaction.create({
      toAccount: accountId,
      user: userId,
      type: 'admin_fund',
      amount: Number(amount),
      currency: currency || account.currency,
      description: description || ('Admin funding — ' + (currency || account.currency) + ' ' + amount),
      category: 'Income',
      status: 'completed',
    });

    const user = await User.findById(userId);
    await notify(userId, '💰 Funds Received!', `${currency || account.currency} ${Number(amount).toLocaleString()} has been credited to your ${account.accountType} account by admin.${description ? ' Note: ' + description : ''}`, 'funding');

    res.json({ success: true, account, message: `Funded ${currency} ${amount} to ${user?.firstName}'s ${account.accountType} account` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/users', async (req, res) => {
  try {
    const { search = '' } = req.query;
    const filter = { role: 'user' };
    if (search) filter.$or = [
      { firstName: { $regex: search, $options: 'i' } },
      { lastName:  { $regex: search, $options: 'i' } },
      { email:     { $regex: search, $options: 'i' } },
    ];
    const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
    const enriched = await Promise.all(users.map(async u => {
      const accounts = await Account.find({ user: u._id });
      const pendingWithdrawal = await WithdrawalRequest.findOne({ user: u._id, status: 'in_progress' })
        .populate('account', 'accountType accountNumber');
      return { ...u.toJSON(), accounts, pendingWithdrawal };
    }));
    res.json({ success: true, users: enriched });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/users/:id/toggle-active', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role === 'admin') return res.status(404).json({ success: false, message: 'User not found' });
    user.isActive = !user.isActive;
    await user.save();
    await notify(user._id, user.isActive ? 'Account Reactivated' : 'Account Suspended', user.isActive ? 'Your account has been reactivated.' : 'Your account has been suspended. Contact support.', user.isActive ? 'success' : 'warning');
    res.json({ success: true, isActive: user.isActive });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/accounts/:id/toggle-freeze', async (req, res) => {
  try {
    const account = await Account.findById(req.params.id).populate('user', 'firstName');
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    account.isFrozen = !account.isFrozen;
    await account.save();
    await notify(account.user._id, account.isFrozen ? '❄️ Account Frozen' : '✅ Account Unfrozen', `Your ${account.accountType} account has been ${account.isFrozen ? 'frozen' : 'unfrozen'} by admin.`, account.isFrozen ? 'warning' : 'success');
    res.json({ success: true, isFrozen: account.isFrozen });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/withdrawals', async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find()
      .populate('user', 'firstName lastName email')
      .populate('account', 'accountType accountNumber currency balance')
      .sort({ updatedAt: -1 });
    res.json({ success: true, requests });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/withdrawals/:requestId/stage/:stageIndex/approve', async (req, res) => {
  try {
    const { requestId, stageIndex } = req.params;
    const { adminNote } = req.body;
    const request = await WithdrawalRequest.findById(requestId).populate('user', 'firstName lastName email');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const idx = parseInt(stageIndex);
    if (!request.stages[idx]) return res.status(400).json({ success: false, message: 'Stage not found' });

    request.stages[idx].status = 'approved';
    request.stages[idx].resolvedAt = new Date();
    request.stages[idx].adminNote = adminNote || '';
    request.updatedAt = new Date();
    await request.save();

    const stage = request.stages[idx];
    await notify(request.user._id,
      `✅ Stage ${stage.stageNumber} Approved`,
      `Stage ${stage.stageNumber}: ${stage.stageName} has been approved. ${stage.stageNumber < 22 ? 'Click Withdraw again to proceed to the next stage.' : 'All stages complete — your withdrawal is being processed!'}`,
      'success'
    );

    // Notify admin too
    await notify(req.user._id, `Stage ${stage.stageNumber} Approved`, `You approved Stage ${stage.stageNumber} for ${request.user.firstName} ${request.user.lastName}'s withdrawal of ${request.currency} ${request.amount}.`, 'info');

    res.json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/withdrawals/:requestId/stage/:stageIndex/reject', async (req, res) => {
  try {
    const { requestId, stageIndex } = req.params;
    const { adminNote } = req.body;
    const request = await WithdrawalRequest.findById(requestId).populate('user', 'firstName lastName email');
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });

    const idx = parseInt(stageIndex);
    request.stages[idx].status = 'rejected';
    request.stages[idx].resolvedAt = new Date();
    request.stages[idx].adminNote = adminNote || 'Rejected by admin';
    request.status = 'rejected';
    request.updatedAt = new Date();
    await request.save();

    const stage = request.stages[idx];
    await notify(request.user._id,
      `❌ Stage ${stage.stageNumber} Rejected`,
      `Stage ${stage.stageNumber}: ${stage.stageName} was rejected. ${adminNote ? 'Reason: ' + adminNote : 'Please contact support.'}`,
      'error'
    );

    res.json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const { page = 1, limit = 30 } = req.query;
    const transactions = await Transaction.find()
      .populate('user', 'firstName lastName email')
      .populate('fromAccount', 'accountType accountNumber')
      .populate('toAccount',   'accountType accountNumber')
      .sort({ createdAt: -1 }).limit(limit * 1).skip((page - 1) * limit);
    const total = await Transaction.countDocuments();
    res.json({ success: true, transactions, total, pages: Math.ceil(total / limit) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Prevent deleting admin accounts
    if (user.role === 'admin') {
      return res.status(403).json({ success: false, message: 'Cannot delete admin users' });
    }
    
    // Delete all associated data
    await Account.deleteMany({ user: userId });           // Delete all user accounts
    await Transaction.deleteMany({ user: userId });       // Delete all user transactions
    await WithdrawalRequest.deleteMany({ user: userId }); // Delete all withdrawal requests
    await Notification.deleteMany({ user: userId });      // Delete all user notifications
    await User.findByIdAndDelete(userId);                 // Delete the user
    
    // Log the action (optional)
    console.log(`Admin ${req.user._id} deleted user ${userId} (${user.email})`);
    
    res.json({ 
      success: true, 
      message: `User ${user.firstName} ${user.lastName} and all associated data deleted successfully` 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
