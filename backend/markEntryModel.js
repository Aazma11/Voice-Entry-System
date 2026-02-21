// backend/markEntryModel.js
const mongoose = require('mongoose');

const markEntrySchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  entries: [
    {
      studentName: { type: String, required: true, trim: true },
      mark: { type: Number, required: true, min: 0, max: 100 }
    }
  ],
  totalStudents: { type: Number, default: 0 },
  averageMark:   { type: Number, default: 0 },
  highestMark:   { type: Number, default: 0 },
  lowestMark:    { type: Number, default: 0 },
  savedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Auto-compute stats before saving
markEntrySchema.pre('save', function (next) {
  if (this.entries && this.entries.length > 0) {
    const marks = this.entries.map(e => e.mark);
    this.totalStudents = this.entries.length;
    this.averageMark   = parseFloat((marks.reduce((a, b) => a + b, 0) / marks.length).toFixed(2));
    this.highestMark   = Math.max(...marks);
    this.lowestMark    = Math.min(...marks);
  }
  next();
});

module.exports = mongoose.model('MarkEntry', markEntrySchema);
