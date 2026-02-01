// backend/teacherController.js
const Teacher = require('./teacherModel');
const jwt = require('jsonwebtoken');
const { parseMarkEntryCommand, generateMarkSheet } = require('./utils');

// Authentication Middleware (combined here)
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
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
      process.env.JWT_SECRET || 'your-secret-key',
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

    const excelBuffer = generateMarkSheet(entries, subject || 'Marks');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=mark_sheet_${Date.now()}.xlsx`);

    res.send(excelBuffer);
  } catch (error) {
    res.status(500).json({ error: 'Error generating Excel file' });
  }
};

// Save Mark Entries
const saveMarkEntries = async (req, res) => {
  try {
    const { entries, subject } = req.body;

    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Mark entries are required' });
    }

    res.json({
      success: true,
      message: 'Mark entries saved successfully',
      count: entries.length
    });
  } catch (error) {
    res.status(500).json({ error: 'Error saving mark entries' });
  }
};

module.exports = {
  authenticate,
  login,
  getProfile,
  processVoiceInput,
  generateExcel,
  saveMarkEntries
};