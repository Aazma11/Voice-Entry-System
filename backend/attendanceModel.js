// backend/attendanceModel.js
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  studentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student', 
    required: true 
  },
  date: { 
    type: Date, 
    required: true,
    default: Date.now 
  },
  status: { 
    type: String, 
    enum: ['Present', 'Absent', 'Late'], 
    default: 'Present' 
  },
  slot: {
    type: String,
    enum: ['morning', 'evening'],
    required: true      // NEW: which session
  },
  location: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String }
  },
  faceVerified: { 
    type: Boolean, 
    default: false 
  },
  markedAt: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Index for efficient queries
attendanceSchema.index({ studentId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);