// backend/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const teacherController = require('./teacherController');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Teacher Routes (simplified - all in one place)
app.post('/api/teacher/login', teacherController.login);
app.get('/api/teacher/profile', teacherController.authenticate, teacherController.getProfile);
app.post('/api/teacher/process-voice', teacherController.authenticate, teacherController.processVoiceInput);
app.post('/api/teacher/generate-excel', teacherController.authenticate, teacherController.generateExcel);
app.post('/api/teacher/save-entries', teacherController.authenticate, teacherController.saveMarkEntries);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});