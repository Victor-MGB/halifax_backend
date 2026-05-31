const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  fromAccount: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  toAccount:   { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:        { type: String, enum: ['transfer', 'deposit', 'withdrawal', 'admin_fund'], required: true },
  amount:      { type: Number, required: true },
  currency:    { type: String, default: 'USD' },
  description: { type: String, default: '' },
  category:    { type: String, default: 'Other' },
  status:      { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model('Transaction', transactionSchema);
