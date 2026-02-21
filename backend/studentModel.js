// backend/studentModel.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  studentId: { type: String, required: true, unique: true },
  rollNumber: { type: String, required: true, unique: true },
  course: { type: String, required: true },
  year: { type: String, required: true },
  faceEmbedding: { type: String },       // kept for backward compat (raw image)
  faceDescriptor: { type: [Number] },    // 128-number face-api.js descriptor
  createdAt: { type: Date, default: Date.now }
});

// Hash password before saving
studentSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
studentSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Student', studentSchema);