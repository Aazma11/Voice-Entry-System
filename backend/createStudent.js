// backend/createStudent.js
require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./studentModel');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/attendance_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('MongoDB Connected');
  
  // Create test student
  const student = new Student({
    name: 'John Student',
    email: 'student@example.com',
    password: 'password123', // Will be hashed automatically
    studentId: 'STU001',
    rollNumber: 'R001',
    course: 'Computer Science',
    year: '3rd Year'
  });

  try {
    await student.save();
    console.log('✅ Test student created successfully!');
    console.log('Email: student@example.com');
    console.log('Password: password123');
    process.exit(0);
  } catch (error) {
    if (error.code === 11000) {
      console.log('⚠️  Student already exists. You can use:');
      console.log('Email: student@example.com');
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