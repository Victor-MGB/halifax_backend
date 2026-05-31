const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName:  { type: String, required: true, trim: true },
  lastName:   { type: String, required: true, trim: true },
  email:      { type: String, required: true, unique: true, lowercase: true },
  password:   { type: String, required: true, minlength: 6 },
  role:       { type: String, enum: ['user', 'admin'], default: 'user' },
  phone:      { type: String, default: '' },
  isActive:   { type: Boolean, default: true },
  createdAt:  { type: Date, default: Date.now },
});

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});
userSchema.methods.matchPassword = async function(p) { return bcrypt.compare(p, this.password); };
userSchema.virtual('fullName').get(function() { return `${this.firstName} ${this.lastName}`; });
userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
