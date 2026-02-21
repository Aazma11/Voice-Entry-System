// backend/server.js
// Load environment variables FIRST — before any other require()
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const teacherController = require('./teacherController');
const studentController = require('./studentController');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from frontend directory
app.use(express.static(path.join(__dirname, '../frontend')));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Teacher Routes
app.post('/api/teacher/register', teacherController.register);
app.post('/api/teacher/login', teacherController.login);
app.get('/api/teacher/profile', teacherController.authenticate, teacherController.getProfile);
app.put('/api/teacher/change-password', teacherController.authenticate, teacherController.changePassword);
app.post('/api/teacher/process-voice', teacherController.authenticate, teacherController.processVoiceInput);
app.post('/api/teacher/generate-excel', teacherController.authenticate, teacherController.generateExcel);
app.post('/api/teacher/save-entries', teacherController.authenticate, teacherController.saveMarkEntries);
app.get('/api/teacher/mark-entries', teacherController.authenticate, teacherController.getMarkEntries);
app.get('/api/teacher/mark-entries/:id', teacherController.authenticate, teacherController.getMarkEntryById);
app.delete('/api/teacher/mark-entries/:id', teacherController.authenticate, teacherController.deleteMarkEntry);
app.get('/api/teacher/attendance-list', teacherController.authenticate, teacherController.getAttendanceList);
app.get('/api/teacher/attendance-summary', teacherController.authenticate, teacherController.getAttendanceSummary);

// Student Routes
app.post('/api/student/register', studentController.register);
app.post('/api/student/login', studentController.login);
app.get('/api/student/profile', studentController.authenticate, studentController.getProfile);
app.put('/api/student/profile', studentController.authenticate, studentController.updateProfile);
app.post('/api/student/mark-attendance', studentController.authenticate, studentController.markAttendance);
app.get('/api/student/attendance', studentController.authenticate, studentController.getAttendance);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Explicit routes for HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'login.html'));
});

app.get('/studentLogin.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'studentLogin.html'));
});

app.get('/studentDashboard.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'studentDashboard.html'));
});

app.get('/studentRegister.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'studentRegister.html'));
});

app.get('/teacherRegister.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'teacherRegister.html'));
});

app.get('/teacherAttendance.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'teacherAttendance.html'));
});

app.get('/markHistory.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'markHistory.html'));
});

app.get('/teacherProfile.html', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'teacherProfile.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Frontend available at http://localhost:${PORT}`);
  console.log(`Access from phone: http://192.168.1.3:${PORT}`);
});