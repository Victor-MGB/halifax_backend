const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
  fullName:  { type: String, required: true, trim: true },
  email:     { type: String, required: true, trim: true, lowercase: true },
  priority:  { type: String, enum: ['low', 'medium', 'high', 'urgent'], required: true },
  subject:   {
    type: String,
    enum: [
      'Account Inquiry',
      'Withdrawal Issue',
      'Transaction Dispute',
      'Account Frozen',
      'KYC / Verification',
      'Technical Support',
      'Fraud Report',
      'General Question',
      'Other',
    ],
    required: true,
  },
  message:   { type: String, required: true, trim: true, minlength: 10 },
  status:    { type: String, enum: ['open', 'in_review', 'resolved', 'closed'], default: 'open' },
  adminNote: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Contact', contactSchema);
