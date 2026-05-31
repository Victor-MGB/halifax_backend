const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  accountType:   { type: String, enum: ['checking', 'savings', 'investment'], required: true },
  accountNumber: { type: String, unique: true, required: true },
  balance:       { type: Number, default: 0 },
  currency:      { type: String, default: 'USD' },
  isFrozen:      { type: Boolean, default: false },
  createdAt:     { type: Date, default: Date.now },
});

accountSchema.pre('validate', function(next) {
  if (!this.accountNumber)
    this.accountNumber = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  next();
});

module.exports = mongoose.model('Account', accountSchema);
