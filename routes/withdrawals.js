const express = require('express');
const router = express.Router();
const WithdrawalRequest = require('../models/WithdrawalRequest');
const Account = require('../models/Account');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const STAGES = WithdrawalRequest.schema.statics.STAGES || require('../models/WithdrawalRequest').STAGES;

// Helper to create a notification
const notify = async (userId, title, message, type = 'stage') => {
  try { await Notification.create({ user: userId, title, message, type }); } catch {}
};

// @POST /api/withdrawals/initiate — user triggers next stage
router.post('/initiate', protect, async (req, res) => {
  try {
    const { accountId, amount, currency, destination } = req.body;
    if (!accountId || !amount) return res.status(400).json({ success: false, message: 'accountId and amount required' });

    const account = await Account.findOne({ _id: accountId, user: req.user._id });
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
    if (account.isFrozen) return res.status(403).json({ success: false, message: 'Account is frozen' });
    if (account.balance < amount) return res.status(400).json({ success: false, message: 'Insufficient funds' });

    // Find existing in-progress request for this user+account+amount
    let request = await WithdrawalRequest.findOne({
      user: req.user._id,
      account: accountId,
      status: 'in_progress',
    });

    if (!request) {
      // Brand new withdrawal request — add stage 1
      const stage = WithdrawalRequest.STAGES[0];
      request = await WithdrawalRequest.create({
        user: req.user._id,
        account: accountId,
        amount: Number(amount),
        currency: currency || account.currency || 'USD',
        destination: destination || '',
        currentStage: 1,
        stages: [{
          stageNumber: stage.number,
          stageName: stage.name,
          stageDesc: stage.description,
          status: 'pending',
        }],
      });
      await notify(req.user._id, `Withdrawal Stage 1 Initiated`, `Your withdrawal request has entered Stage 1: ${stage.name}. Awaiting admin approval.`, 'stage');
      return res.status(201).json({ success: true, request, stageTriggered: stage, message: 'Stage 1 initiated. Awaiting admin approval.' });
    }

    // Existing request — check last stage status
    const lastStage = request.stages[request.stages.length - 1];

    if (lastStage.status === 'pending') {
      return res.status(400).json({ success: false, message: `Stage ${lastStage.stageNumber} is still pending admin approval. Please wait.`, currentStage: lastStage });
    }

    if (lastStage.status === 'rejected') {
      return res.status(400).json({ success: false, message: `Stage ${lastStage.stageNumber} was rejected. Contact support.`, currentStage: lastStage });
    }

    // Last stage approved — trigger next
    const nextStageNum = lastStage.stageNumber + 1;

    if (nextStageNum > 22) {
      // All 22 stages done — mark complete
      request.status = 'completed';
      request.updatedAt = new Date();
      await request.save();
      await notify(req.user._id, '🎉 Withdrawal Approved!', `All 22 verification stages completed. Your withdrawal of ${currency || 'USD'} ${amount} is now being processed.`, 'success');
      return res.json({ success: true, completed: true, message: 'All stages complete! Your withdrawal is being processed.' });
    }

    const nextStageInfo = WithdrawalRequest.STAGES[nextStageNum - 1];
    request.stages.push({
      stageNumber: nextStageNum,
      stageName: nextStageInfo.name,
      stageDesc: nextStageInfo.description,
      status: 'pending',
    });
    request.currentStage = nextStageNum;
    request.updatedAt = new Date();
    await request.save();

    await notify(req.user._id, `Stage ${nextStageNum} Initiated`, `Your withdrawal has progressed to Stage ${nextStageNum}: ${nextStageInfo.name}. Awaiting admin approval.`, 'stage');

    return res.json({ success: true, request, stageTriggered: nextStageInfo, message: `Stage ${nextStageNum} initiated.` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// @GET /api/withdrawals/my — get user's withdrawal requests
router.get('/my', protect, async (req, res) => {
  try {
    const requests = await WithdrawalRequest.find({ user: req.user._id })
      .populate('account', 'accountType accountNumber currency balance')
      .sort({ updatedAt: -1 });
    res.json({ success: true, requests });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;

// Attach STAGES to model for use in this file
WithdrawalRequest.STAGES = [
  { number: 1,  name: 'Identity Verification',          description: 'Verifying your government-issued ID and personal details.' },
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
