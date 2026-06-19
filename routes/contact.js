const express = require('express');
const router = express.Router();
const Contact = require('../models/ContactModel');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/auth');


// @POST /api/contact — anyone can submit (no auth required)
router.post('/', async (req, res) => {
  try {
    const { fullName, email, priority, subject, message } = req.body;

    // Validate required fields
    if (!fullName || !email || !priority || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required: fullName, email, priority, subject, message',
      });
    }

    if (message.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Message must be at least 10 characters',
      });
    }

    const contact = await Contact.create({ fullName, email, priority, subject, message });

    // Notify all admins (find admin users)
    const User = require('../models/User');
    const admins = await User.find({ role: 'admin' }).select('_id');
    const urgencyLabel = priority === 'urgent' ? '🚨' : priority === 'high' ? '⚠️' : '📩';

    await Promise.all(admins.map(admin =>
      Notification.create({
        user: admin._id,
        title: `${urgencyLabel} New Contact — ${priority.toUpperCase()} Priority`,
        message: `${fullName} (${email}) submitted: "${subject}". Priority: ${priority}.`,
        type: priority === 'urgent' || priority === 'high' ? 'warning' : 'info',
      })
    ));

    res.status(201).json({
      success: true,
      message: 'Your message has been received. We will get back to you shortly.',
      contact: {
        id: contact._id,
        fullName: contact.fullName,
        subject: contact.subject,
        priority: contact.priority,
        status: contact.status,
        createdAt: contact.createdAt,
      },
    });
  } catch (err) {
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});


// @GET /api/contact — get all contact submissions
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority } = req.query;

    const filter = {};
    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;

    const contacts = await Contact.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Contact.countDocuments(filter);

    // Summary counts
    const summary = await Contact.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const prioritySummary = await Contact.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      contacts,
      total,
      pages: Math.ceil(total / limit),
      page: Number(page),
      summary,
      prioritySummary,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @GET /api/contact/:id — single contact detail
router.get('/:id', protect, adminOnly, async (req, res) => {
  try {
    const contact = await Contact.findById(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @PUT /api/contact/:id/status — update status + admin note
router.put('/:id/status', protect, adminOnly, async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    const validStatuses = ['open', 'in_review', 'resolved', 'closed'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const contact = await Contact.findByIdAndUpdate(
      req.params.id,
      { ...(status && { status }), ...(adminNote !== undefined && { adminNote }), updatedAt: new Date() },
      { new: true }
    );

    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });

    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// @DELETE /api/contact/:id — delete a contact submission
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndDelete(req.params.id);
    if (!contact) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
