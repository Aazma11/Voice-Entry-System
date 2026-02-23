// backend/studentController.js
const Student = require('./studentModel');
const Attendance = require('./attendanceModel');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set in .env — server will not start safely.');
  process.exit(1);
}

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const student = await Student.findById(decoded.id).select('-password');
    
    if (!student) {
      return res.status(401).json({ error: 'Student not found' });
    }

    req.student = student;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Student Register
const register = async (req, res) => {
  try {
    const { name, email, password, rollNumber, year } = req.body;

    if (!name || !email || !password || !rollNumber || !year) {
      return res.status(400).json({ error: 'All fields are required: name, email, password, rollNumber, year' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await Student.findOne({ $or: [{ email }, { rollNumber }] });
    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      return res.status(400).json({ error: 'This roll number is already registered' });
    }

    // Auto-generate a unique studentId from rollNumber
    const studentId = 'STU-' + rollNumber.replace(/\s+/g, '').toUpperCase();

    const student = new Student({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      studentId,
      rollNumber: rollNumber.trim().toUpperCase(),
      course: 'N/A',
      year: year.trim()
    });

    await student.save();

    const token = jwt.sign(
      { id: student._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber,
        year: student.year
      }
    });
  } catch (error) {
    console.error('Student register error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Student Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const student = await Student.findOne({ email });
    if (!student) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await student.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: student._id, role: 'student' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      student: {
        id: student._id,
        name: student.name,
        email: student.email,
        studentId: student.studentId,
        rollNumber: student.rollNumber,
        course: student.course,
        year: student.year
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Get Student Profile
const getProfile = async (req, res) => {
  try {
    res.json({
      student: {
        id: req.student._id,
        name: req.student.name,
        email: req.student.email,
        studentId: req.student.studentId,
        rollNumber: req.student.rollNumber,
        course: req.student.course,
        year: req.student.year,
        hasFaceImage: !!(req.student.faceEmbedding || req.student.faceDescriptor),
        hasFaceDescriptor: !!(req.student.faceDescriptor && req.student.faceDescriptor.length === 128)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Update Student Profile (face descriptor from face-api.js)
const updateProfile = async (req, res) => {
  try {
    const { faceDescriptor } = req.body;

    if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
      return res.status(400).json({ error: 'A valid 128-number face descriptor is required.' });
    }

    // Use findByIdAndUpdate to avoid stale-document issues with large arrays
    const updated = await Student.findByIdAndUpdate(
      req.student._id,
      { $set: { faceDescriptor: faceDescriptor } },
      { new: true, runValidators: false }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.json({
      message: 'Face verification image saved successfully',
      hasFaceImage: true,
      hasFaceDescriptor: true
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// backend/studentController.js
// ... existing authenticate, login, getProfile functions ...

// Mark Attendance
const markAttendance = async (req, res) => {
    try {
      const { faceData, faceDescriptor, location } = req.body;
      const studentId = req.student._id;
  
      // 1) Basic location presence
      if (!location || !location.latitude || !location.longitude) {
        return res.status(400).json({ error: 'Location is required' });
      }
  
      // 2) Campus radius check FIRST
      const isLocationValid = validateLocation(location);
      if (!isLocationValid) {
        return res.status(400).json({ 
          error: 'Invalid location. You must be inside college campus to mark attendance.' 
        });
      }
  
      // 3) Decide which slot (morning / evening) based on current time
      const now = new Date();
      const slot = getAttendanceSlot(now); // 'morning' | 'evening' | null
  
      if (!slot) {
        return res.status(400).json({
          error: 'Attendance can only be marked between 8:00 AM – 12:00 PM (morning) or 12:01 PM – 11:59 PM (evening).'
        });
      }
  
      // 4) Get student and face check
      const student = await Student.findById(studentId);
  
      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }
  
      // Require profile face descriptor to be set before marking attendance
      const hasDescriptor = student.faceDescriptor && student.faceDescriptor.length === 128;
      if (!hasDescriptor) {
        return res.status(400).json({
          error: 'Please set your face verification image in your Profile before marking attendance.'
        });
      }

      // Verify using face-api.js descriptor (Euclidean distance)
      if (!faceDescriptor || !Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
        return res.status(400).json({ error: 'Valid face descriptor is required to mark attendance.' });
      }

      const distance = euclideanDistance(faceDescriptor, student.faceDescriptor);
      console.log(`Face descriptor distance: ${distance.toFixed(4)} (threshold: 0.55)`);

      // face-api.js: distance < 0.6 = same person; we use 0.55 for stricter match
      if (distance > 0.55) {
        return res.status(401).json({
          error: 'Face not recognized. Please ensure good lighting and look directly at the camera.'
        });
      }
  
      // 5) Check if this slot already marked today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
  
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
  
      const existingAttendance = await Attendance.findOne({
        studentId,
        slot,
        date: { $gte: startOfDay, $lte: endOfDay }
      });
  
      if (existingAttendance) {
        return res.status(400).json({ 
          error: `Attendance already marked for today (${slot} session).` 
        });
      }
  
      // 6) Save attendance
      const attendance = new Attendance({
        studentId,
        date: now,
        status: 'Present',
        slot,   // morning / evening
        location: {
          latitude: location.latitude,
          longitude: location.longitude,
          address: location.address || `${location.latitude?.toFixed(5)}, ${location.longitude?.toFixed(5)}`
        },
        faceVerified: true
      });
  
      await attendance.save();
  
      res.json({ 
        message: `Attendance marked successfully for ${slot} session`,
        attendance: {
          date: attendance.date,
          status: attendance.status,
          slot: attendance.slot,
          location: attendance.location
        }
      });
    } catch (error) {
      console.error('Mark attendance error:', error);
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  };
 // Get Student Attendance Records
const getAttendance = async (req, res) => {
    try {
      const studentId = req.student._id;
      const { startDate, endDate } = req.query;
  
      let query = { studentId };
  
      // Optional date range filter
      if (startDate || endDate) {
        query.date = {};
        if (startDate) {
          query.date.$gte = new Date(startDate);
        }
        if (endDate) {
          query.date.$lte = new Date(endDate);
        }
      }
  
      const attendanceRecords = await Attendance.find(query)
        .sort({ date: -1 })
        .limit(100);
  
      const totalDays = attendanceRecords.length;
      const presentDays = attendanceRecords.filter(a => a.status === 'Present').length;
      const attendancePercentage = totalDays > 0
        ? ((presentDays / totalDays) * 100).toFixed(2)
        : 0;
  
      res.json({
        records: attendanceRecords,
        statistics: {
          totalDays,
          presentDays,
          absentDays: totalDays - presentDays,
          attendancePercentage: parseFloat(attendancePercentage)
        }
      });
    } catch (error) {
      console.error('Get attendance error:', error);
      res.status(500).json({ error: 'Server error' });
    }
  }; 
  
  // Euclidean distance between two 128-number face-api.js descriptors.
  // Same person: distance < 0.6. Strangers: distance > 0.6.
  function euclideanDistance(desc1, desc2) {
    let sum = 0;
    for (let i = 0; i < 128; i++) {
      const diff = (desc1[i] || 0) - (desc2[i] || 0);
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }
  
  // Helper function to validate location
  function validateLocation(location) {
    // VIGNAN'S INSTITUTE OF MANAGEMENT AND TECHNOLOGY FOR WOMEN
    // Ghatkesar, Kondapur, Telangana 501301
    const CAMPUS_LAT =17.409954;
    const CAMPUS_LON = 78.603195;
    const RADIUS_KM = 2; // 500 meters
  
    if (!location || !location.latitude || !location.longitude) {
      console.log('Location validation failed: Missing coordinates');
      return false;
    }
  
    const distance = calculateDistance(
      location.latitude,
      location.longitude,
      CAMPUS_LAT,
      CAMPUS_LON
    );
  
    console.log(`Location check: Distance from campus: ${distance.toFixed(3)} km (Max allowed: ${RADIUS_KM} km)`);
    console.log(`Campus: ${CAMPUS_LAT}, ${CAMPUS_LON}`);
    console.log(`User: ${location.latitude}, ${location.longitude}`);
    
    const isValid = distance <= RADIUS_KM;
    console.log(`Location validation result: ${isValid}`);
    
    return isValid;
  }
  
  // Calculate distance between two coordinates (Haversine formula)
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
  // Decide which attendance slot based on time
  function getAttendanceSlot(now) {
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Convert to minutes from midnight
    const totalMinutes = hours * 60 + minutes;

    // Morning window: 08:30 - 9 : 30
    const MORNING_START = 8 * 60 + 30;       // 08:30
    const MORNING_END   = 9 * 60 + 30;      // 9:30

    // Evening window: 2 : 30 - 3 : 00
    const EVENING_START = 14 * 60 + 30;  // 2 : 30
    const EVENING_END   = 15 * 60 ; // 3 : 00

    if (totalMinutes >= MORNING_START && totalMinutes <= MORNING_END) {
      return 'morning';
    }
    if (totalMinutes >= EVENING_START && totalMinutes <= EVENING_END) {
      return 'evening';
    }
    return null;
  }
  module.exports = {
    authenticate,
    register,
    login,
    getProfile,
    updateProfile,
    markAttendance,
    getAttendance
  };