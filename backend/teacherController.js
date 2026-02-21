// backend/teacherController.js
const Teacher = require('./teacherModel');
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');
const MarkEntry = require('./markEntryModel');
const jwt = require('jsonwebtoken');
const { parseMarkEntryCommand, generateMarkSheet } = require('./utils');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env — server will not start safely.');
  process.exit(1);
}

// Authentication Middleware (combined here)
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const teacher = await Teacher.findById(decoded.id).select('-password');
    
    if (!teacher) {
      return res.status(401).json({ error: 'Teacher not found' });
    }

    req.teacher = teacher;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Teacher Register
const register = async (req, res) => {
  try {
    const { name, email, password, department, employeeId } = req.body;

    if (!name || !email || !password || !department || !employeeId) {
      return res.status(400).json({ error: 'All fields are required: name, email, password, department, employeeId' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await Teacher.findOne({ $or: [{ email }, { employeeId }] });
    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      return res.status(400).json({ error: 'This Employee ID is already registered' });
    }

    const teacher = new Teacher({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      department: department.trim(),
      employeeId: employeeId.trim().toUpperCase()
    });

    await teacher.save();

    const token = jwt.sign(
      { id: teacher._id, role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Teacher account created successfully',
      token,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department,
        employeeId: teacher.employeeId
      }
    });
  } catch (error) {
    console.error('Teacher register error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Teacher Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const teacher = await Teacher.findOne({ email });
    if (!teacher) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await teacher.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: teacher._id, role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      teacher: {
        id: teacher._id,
        name: teacher.name,
        email: teacher.email,
        department: teacher.department
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get Teacher Profile
const getProfile = async (req, res) => {
  try {
    res.json({
      teacher: {
        id: req.teacher._id,
        name: req.teacher.name,
        email: req.teacher.email,
        department: req.teacher.department,
        employeeId: req.teacher.employeeId
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Process Voice Input
const processVoiceInput = async (req, res) => {
  try {
    const { text, subject } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text input is required' });
    }

    const parsedData = parseMarkEntryCommand(text);
    
    res.json({
      success: true,
      data: parsedData,
      message: 'Voice input processed successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error processing voice input' });
  }
};

// Generate Excel
const generateExcel = async (req, res) => {
  try {
    const { entries, subject } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Mark entries are required' });
    }

    // Clean entries - ensure all have required fields
    const cleanedEntries = entries.map(entry => ({
      name: (entry.name || entry.studentName || 'Unknown').toString().trim(),
      mark: parseInt(entry.mark || entry.marks || 0),
      subject: entry.subject || subject || 'Marks'
    })).filter(entry => entry.name && entry.name !== 'Unknown' && entry.mark >= 0 && entry.mark <= 100);

    if (cleanedEntries.length === 0) {
      return res.status(400).json({ error: 'No valid entries to generate Excel' });
    }

    console.log(`Generating Excel for ${cleanedEntries.length} entries`);
    const excelBuffer = generateMarkSheet(cleanedEntries, subject || 'Marks');

    if (!excelBuffer || excelBuffer.length === 0) {
      return res.status(500).json({ error: 'Failed to generate Excel buffer' });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mark_sheet_${Date.now()}.xlsx`);
    res.setHeader('Content-Length', excelBuffer.length);

    res.send(excelBuffer);
  } catch (error) {
    console.error('Excel generation error:', error);
    res.status(500).json({ error: 'Error generating Excel file: ' + error.message });
  }
};

// Change Teacher Password
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const teacher = await Teacher.findById(req.teacher._id);
    const isMatch = await teacher.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    teacher.password = newPassword;
    await teacher.save(); // pre-save hook will hash it

    const token = jwt.sign(
      { id: teacher._id, role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ success: true, message: 'Password updated successfully', token });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Save Mark Entries to Database
const saveMarkEntries = async (req, res) => {
  try {
    const { entries, subject } = req.body;

    if (!entries || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'Mark entries are required' });
    }

    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject name is required before saving' });
    }

    // Clean and validate entries
    const cleanedEntries = entries
      .map(e => ({
        studentName: (e.name || e.studentName || '').toString().trim(),
        mark: parseInt(e.mark || e.marks || 0)
      }))
      .filter(e => e.studentName && e.mark >= 0 && e.mark <= 100);

    if (cleanedEntries.length === 0) {
      return res.status(400).json({ error: 'No valid entries to save' });
    }

    const record = new MarkEntry({
      teacherId: req.teacher._id,
      subject: subject.trim(),
      entries: cleanedEntries
    });

    await record.save();

    res.json({
      success: true,
      message: `${cleanedEntries.length} entries saved successfully for "${subject}"`,
      count: cleanedEntries.length,
      id: record._id,
      stats: {
        average: record.averageMark,
        highest: record.highestMark,
        lowest: record.lowestMark
      }
    });
  } catch (error) {
    console.error('Save mark entries error:', error);
    res.status(500).json({ error: 'Error saving mark entries: ' + error.message });
  }
};

// Get saved mark entries (with optional filters)
const getMarkEntries = async (req, res) => {
  try {
    const { subject, page = 1, limit = 20 } = req.query;

    const filter = { teacherId: req.teacher._id };
    if (subject) filter.subject = { $regex: subject, $options: 'i' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await MarkEntry.countDocuments(filter);

    const records = await MarkEntry.find(filter)
      .sort({ savedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-entries'); // exclude full entries list for the index view

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      records: records.map(r => ({
        id: r._id,
        subject: r.subject,
        totalStudents: r.totalStudents,
        averageMark: r.averageMark,
        highestMark: r.highestMark,
        lowestMark: r.lowestMark,
        savedAt: r.savedAt
      }))
    });
  } catch (error) {
    console.error('Get mark entries error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Get a single mark entry with full student list
const getMarkEntryById = async (req, res) => {
  try {
    const record = await MarkEntry.findOne({
      _id: req.params.id,
      teacherId: req.teacher._id   // ensure teacher can only see their own records
    });

    if (!record) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({
      success: true,
      record: {
        id: record._id,
        subject: record.subject,
        totalStudents: record.totalStudents,
        averageMark: record.averageMark,
        highestMark: record.highestMark,
        lowestMark: record.lowestMark,
        savedAt: record.savedAt,
        entries: record.entries
      }
    });
  } catch (error) {
    console.error('Get mark entry by id error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Delete a mark entry record
const deleteMarkEntry = async (req, res) => {
  try {
    const deleted = await MarkEntry.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.teacher._id
    });

    if (!deleted) {
      return res.status(404).json({ error: 'Record not found' });
    }

    res.json({ success: true, message: 'Record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Get all students' attendance list (teacher only)
// Query params: date (YYYY-MM-DD), studentName, rollNumber, status, page, limit
const getAttendanceList = async (req, res) => {
  try {
    const { date, studentName, rollNumber, status, page = 1, limit = 50 } = req.query;

    // Build attendance filter
    const filter = {};

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      filter.date = { $gte: start, $lte: end };
    }

    if (status) {
      filter.status = status;
    }

    // If filtering by student name or roll number, find matching students first
    let studentFilter = {};
    if (studentName) studentFilter.name = { $regex: studentName, $options: 'i' };
    if (rollNumber) studentFilter.rollNumber = { $regex: rollNumber, $options: 'i' };

    if (studentName || rollNumber) {
      const matchingStudents = await Student.find(studentFilter).select('_id');
      filter.studentId = { $in: matchingStudents.map(s => s._id) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Attendance.countDocuments(filter);

    const records = await Attendance.find(filter)
      .populate('studentId', 'name rollNumber year email')
      .sort({ date: -1, markedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formatted = records.map(r => ({
      id: r._id,
      studentName: r.studentId?.name || 'Unknown',
      rollNumber: r.studentId?.rollNumber || '-',
      year: r.studentId?.year || '-',
      email: r.studentId?.email || '-',
      date: r.date,
      slot: r.slot,
      status: r.status,
      location: r.location?.address || `${r.location?.latitude?.toFixed(5)}, ${r.location?.longitude?.toFixed(5)}` || 'N/A',
      faceVerified: r.faceVerified,
      markedAt: r.markedAt
    }));

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
      records: formatted
    });
  } catch (error) {
    console.error('Get attendance list error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Get summary stats for a date (present/absent counts per year)
const getAttendanceSummary = async (req, res) => {
  try {
    const { date } = req.query;
    const start = date ? new Date(date) : new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setHours(23, 59, 59, 999);

    const records = await Attendance.find({ date: { $gte: start, $lte: end } })
      .populate('studentId', 'name rollNumber year');

    const totalStudents = await Student.countDocuments();
    const presentIds = new Set(records.map(r => r.studentId?._id?.toString()));

    res.json({
      success: true,
      date: start,
      totalStudents,
      present: presentIds.size,
      absent: totalStudents - presentIds.size,
      records: records.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

module.exports = {
  authenticate,
  register,
  login,
  getProfile,
  changePassword,
  processVoiceInput,
  generateExcel,
  saveMarkEntries,
  getMarkEntries,
  getMarkEntryById,
  deleteMarkEntry,
  getAttendanceList,
  getAttendanceSummary
};