const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// 🔥 1. MODELS FIRST (Before ANY DB calls)
const mongooseTypes = mongoose.Types;

const User = mongoose.model('User', new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  name: { type: String, default: '' },
  rollNo: { type: String, default: '' },
  branch: { type: String, default: '' },
  semester: { type: String, default: '' },
  subjects: { type: [String], default: [] },
  salary: { type: Number, default: 0 }
}, { timestamps: true }));

const SubjectConfig = mongoose.model('SubjectConfig', new mongoose.Schema({
  branch: String,
  semester: String,
  subjects: [String],
  createdAt: { type: Date, default: Date.now }
}));

const ClassModel = mongoose.model('Class', new mongoose.Schema({
  name: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
}));

const Attendance = mongoose.model('Attendance', new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent'], default: 'absent' }
}));

const Marks = mongoose.model('Marks', new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  marks: Number
}, { timestamps: true }));

// 🔥 2. SEED FUNCTION (BEFORE mongoose.connect)
async function seedData() {
  try {
    // Admin
    const admin = await User.findOne({ email: 'admin@collegeerp.com' });
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      await User.create({
        email: 'admin@collegeerp.com',
        password: hashed,
        role: 'admin',
        name: 'Super Admin'
      });
      console.log('✅ Admin created: admin@collegeerp.com / admin123');
    }

    // Subjects
    const subjectConfigs = [
      { branch: 'MCA', semester: '1st', subjects: ['Math', 'Science', 'IT', 'DSA'] },
      { branch: 'BCA', semester: '1st', subjects: ['Programming', 'Database', 'Web Tech', 'Math'] },
      { branch: 'CSE', semester: '1st', subjects: ['C Programming', 'Math', 'Physics', 'DSA'] },
      { branch: 'MCA', semester: '2nd', subjects: ['Java', 'OS', 'Networks', 'Algorithms'] },
      { branch: 'BCA', semester: '2nd', subjects: ['Java', 'OOP', 'Data Structures', 'Software Eng'] }
    ];

    for (let config of subjectConfigs) {
      await SubjectConfig.findOneAndUpdate(
        { branch: config.branch, semester: config.semester },
        config,
        { upsert: true }
      );
    }
    console.log('✅ Subjects seeded: MCA/BCA/CSE');
  } catch (err) {
    console.log('⚠️ Seed skipped (data exists):', err.message);
  }
}

// 🔥 3. CREATE APP + MIDDLEWARE
const app = express();

app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL || '*' : '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));

// Serve login page
app.get(['/', '/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

// 🔥 4. MONGODB CONNECTION (seedData now exists!)
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10
}).then(async () => {
  console.log('✅ MongoDB Connected');
  await seedData();
}).catch(err => {
  console.error('❌ MongoDB Failed:', err.message);
  console.log('💡 Check MONGO_URI in Render Environment Variables');
});

// 🔥 5. AUTH + ROLE MIDDLEWARE
const auth = (req, res, next) => {
  let token = req.cookies.jwt || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secretkey-collegeerp-2026');
    next();
  } catch (err) {
    res.clearCookie('jwt');
    res.status(403).json({ error: 'Invalid token' });
  }
};

const role = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

// PROTECTED ROUTES
app.get('/admin', auth, role('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});
app.get('/teacher', auth, role('teacher'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'teacher.html'));
});
app.get('/student', auth, role('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'student.html'));
});

// API ROUTES
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await SubjectConfig.distinct('branch');
    res.json({
      success: true,
      branches: branches.sort(),
      total: branches.length
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

app.get('/api/subjects/all', async (req, res) => {
  try {
    const { branch, semester } = req.query;
    let query = {};
    if (branch) query.branch = branch;
    if (semester) query.semester = semester;
    
    const allSubjects = await SubjectConfig.find(query)
      .sort({ branch: 1, semester: 1 })
      .select('branch semester subjects createdAt');
    
    res.json({ success: true, total: allSubjects.length, data: allSubjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'secretkey-collegeerp-2026',
      { expiresIn: '24h' }
    );
    
    res.cookie('jwt', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000
    });
    
    res.json({
      token,
      role: user.role,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        rollNo: user.rollNo || null,
        branch: user.branch || null,
        semester: user.semester || null
      },
      redirect: `/${user.role}`
    });
  } catch (err) {
    res.status(500).json({ error: 'Login server error' });
  }
});

// Admin Routes
app.post('/api/admin/create-student', auth, role('admin'), async (req, res) => {
  try {
    const { name, email, password, rollNo, branch, semester = '1st' } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ error: 'Email already exists' });
    
    const subjectConfig = await SubjectConfig.findOne({ branch, semester });
    const subjects = subjectConfig ? subjectConfig.subjects : ['General'];
    
    const hashed = await bcrypt.hash(password, 10);
    const student = new User({ 
      name, email, password: hashed, role: 'student', 
      rollNo, branch, semester, subjects 
    });
    await student.save();
    
    res.json({ success: true, credentials: { email, password }, subjects });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Email already in use' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.get('/api/admin/teachers', auth, role('admin'), async (req, res) => {
  const teachers = await User.find({ role: 'teacher' }).select('-password');
  res.json(teachers);
});

app.get('/api/admin/students', auth, role('admin'), async (req, res) => {
  const students = await User.find({ role: 'student' }).select('-password');
  res.json(students);
});

// Teacher Routes
app.post('/api/teacher/classes', auth, role('teacher'), async (req, res) => {
  try {
    const { name } = req.body;
    const newClass = new ClassModel({ name: name.trim(), teacherId: req.user.userId });
    await newClass.save();
    res.json({ success: true, _id: newClass._id, name: newClass.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ Login: http://localhost:5000');
  console.log('✅ Admin: admin@collegeerp.com / admin123');
});
