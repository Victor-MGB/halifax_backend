const mongoose = require('mongoose');

const STAGES = [
  { number: 1,  name: 'Identity Verification',         description: 'Verifying your government-issued ID and personal details.' },
  { number: 2,  name: 'Account Ownership Confirmation', description: 'Confirming ownership of the originating bank account.' },
  { number: 3,  name: 'KYC Documentation Review',       description: 'Know Your Customer documents are under review.' },
  { number: 4,  name: 'AML Compliance Screening',       description: 'Anti-Money Laundering compliance check in progress.' },
  { number: 5,  name: 'Source of Funds Verification',   description: 'Validating the origin and legitimacy of funds.' },
  { number: 6,  name: 'Transaction Risk Assessment',    description: 'Assessing transaction risk level and exposure.' },
  { number: 7,  name: 'Fraud Detection Scan',           description: 'Automated fraud pattern detection is running.' },
  { number: 8,  name: 'Beneficiary Verification',       description: 'Verifying the beneficiary account and details.' },
  { number: 9,  name: 'Regulatory Compliance Check',    description: 'Ensuring compliance with regional financial regulations.' },
  { number: 10, name: 'Tax Withholding Review',         description: 'Reviewing applicable tax obligations on this withdrawal.' },
  { number: 11, name: 'Multi-Jurisdiction Clearance',   description: 'Obtaining clearance across relevant jurisdictions.' },
  { number: 12, name: 'Credit Bureau Cross-Reference',  description: 'Cross-referencing with credit bureau records.' },
  { number: 13, name: 'Sanctions List Screening',       description: 'Checking against international sanctions databases.' },
  { number: 14, name: 'Enhanced Due Diligence',         description: 'Performing enhanced due diligence on this transaction.' },
  { number: 15, name: 'Correspondent Bank Authorization', description: 'Awaiting authorization from the correspondent bank.' },
  { number: 16, name: 'Liquidity Reserve Validation',   description: 'Validating sufficient liquidity reserves are maintained.' },
  { number: 17, name: 'Internal Audit Flag Review',     description: 'Internal audit team reviewing any flagged items.' },
  { number: 18, name: 'Currency Exchange Compliance',   description: 'Ensuring foreign exchange compliance if applicable.' },
  { number: 19, name: 'Final AML Officer Sign-Off',     description: 'Senior AML officer final review and sign-off.' },
  { number: 20, name: 'Board-Level Authorization',      description: 'Board authorization required for transactions of this size.' },
  { number: 21, name: 'Clearing House Submission',      description: 'Submitting to the clearing house for final processing.' },
  { number: 22, name: 'Final Release Authorization',    description: 'Final authorization to release funds to your account.' },
];

const stageEntrySchema = new mongoose.Schema({
  stageNumber:  { type: Number, required: true },
  stageName:    { type: String, required: true },
  stageDesc:    { type: String },
  status:       { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  triggeredAt:  { type: Date, default: Date.now },
  resolvedAt:   { type: Date },
  adminNote:    { type: String, default: '' },
});

const withdrawalRequestSchema = new mongoose.Schema({
  user:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  account:       { type: mongoose.Schema.Types.ObjectId, ref: 'Account', required: true },
  amount:        { type: Number, required: true },
  currency:      { type: String, default: 'USD' },
  destination:   { type: String, default: '' },
  currentStage:  { type: Number, default: 1 },
  stages:        [stageEntrySchema],
  status:        { type: String, enum: ['in_progress', 'completed', 'rejected'], default: 'in_progress' },
  createdAt:     { type: Date, default: Date.now },
  updatedAt:     { type: Date, default: Date.now },
});

withdrawalRequestSchema.statics.STAGES = STAGES;

module.exports = mongoose.model('WithdrawalRequest', withdrawalRequestSchema);
