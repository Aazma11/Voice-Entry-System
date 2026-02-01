// backend/createTeacher.js
require('dotenv').config();
const mongoose = require('mongoose');
const Teacher = require('./teacherModel');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB Connected');
  
  // Create test teacher
  const teacher = new Teacher({
    name: 'John Doe',
    email: 'teacher@example.com',
    password: 'password123', // Will be hashed automatically
    department: 'Computer Science',
    employeeId: 'EMP001'
  });

  try {
    await teacher.save();
    console.log('✅ Test teacher created successfully!');
    console.log('Email: teacher@example.com');
    console.log('Password: password123');
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️  Teacher already exists. You can use:');
      console.log('Email: teacher@example.com');
      console.log('Password: password123');
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
})
.catch(err => {
  console.error('MongoDB Connection Error:', err);
  process.exit(1);
});