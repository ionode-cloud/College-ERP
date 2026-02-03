const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

const app = express();

// 🔥 1️⃣ MIDDLEWARE (FIRST)
app.use(cors({
  origin: ['http://localhost:5522', 'https://college-erp-jhzi.onrender.com'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// 🔥 2️⃣ STATIC FILES (SECOND)
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));

// 🔥 3️⃣ PUBLIC ROUTES (NO AUTH - login + dashboards)
app.get(['/', '/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});
app.get('/admin.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});
app.get('/teacher.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'teacher.html'));
});
app.get('/student.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'student.html'));
});

// 🔥 4️⃣ DATABASE (FIXED - with fallback)
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp')
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// 🔥 5️⃣ MODELS
const mongooseTypes = mongoose.Types;

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  name: String,
  rollNo: String,
  branch: String,
  semester: String,
  subjects: [String],
  salary: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

const subjectSchema = new mongoose.Schema({
  branch: String,
  semester: String,
  subjects: [String],
  createdAt: { type: Date, default: Date.now }
});
const SubjectConfig = mongoose.model('SubjectConfig', subjectSchema);

const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const ClassModel = mongoose.model('Class', classSchema);

const attendanceSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent'], default: 'absent' }
});
const Attendance = mongoose.model('Attendance', attendanceSchema);

const marksSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  subject: String,
  marks: Number
});
const Marks = mongoose.model('Marks', marksSchema);

// 🔥 6️⃣ AUTH MIDDLEWARE (BEFORE PROTECTED ROUTES!)
const auth = (req, res, next) => {
  let token = req.cookies.jwt || req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'secretkey-collegeerp-2026');
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

const role = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

// 🔥 7️⃣ PUBLIC API ROUTES
app.get('/api/branches', async (req, res) => {
  try {
    let branches = ['MCA', 'BCA', 'CSE'];
    const dbBranches = await SubjectConfig.distinct('branch').catch(() => []);
    branches = [...new Set([...branches, ...dbBranches])].filter(Boolean).sort();
    res.json({ branches });
  } catch {
    res.json({ branches: ['MCA', 'BCA', 'CSE'] });
  }
});

app.get('/api/subjects/all', async (req, res) => {
  try {
    const { branch, semester } = req.query;
    let query = {};
    if (branch) query.branch = branch;
    if (semester) query.semester = semester;
    const subjects = await SubjectConfig.find(query);
    res.json({ success: true, data: subjects });
  } catch {
    res.json({ success: false, data: [] });
  }
});

// 🔥 8️⃣ LOGIN (PUBLIC)
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log('🔐 Login:', email);
    
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ 
      userId: user._id, 
      role: user.role 
    }, process.env.JWT_SECRET || 'secretkey-collegeerp-2026', { expiresIn: '24h' });
    
    res.cookie('jwt', token, { 
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 
    });
    
    console.log('✅ Login success:', user.role);
    res.json({ 
      token, 
      role: user.role, 
      email: user.email 
    });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 🔥 9️⃣ PROTECTED ROUTES (NOW SAFE!)
app.get('/admin', auth, role('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});
app.get('/teacher', auth, role('teacher'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'teacher.html'));
});
app.get('/student', auth, role('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'student.html'));
});

// 🔥 🔟 ADMIN APIS (shortened for space)
app.post('/api/admin/create-teacher', auth, role('admin'), async (req, res) => {
  try {
    const { name, email, password, branch, salary } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const teacher = new User({ name, email, password: hashed, role: 'teacher', branch, salary });
    await teacher.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/teachers', auth, role('admin'), async (req, res) => {
  const teachers = await User.find({ role: 'teacher' }).select('-password');
  res.json(teachers);
});

app.post('/api/admin/create-student', auth, role('admin'), async (req, res) => {
  try {
    const { name, email, password, rollNo, branch, semester } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const student = new User({ name, email, password: hashed, role: 'student', rollNo, branch, semester });
    await student.save();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/admin/students', auth, role('admin'), async (req, res) => {
  const students = await User.find({ role: 'student' }).select('-password');
  res.json(students);
});

// 🔥 Teacher APIs (shortened)
app.post('/api/teacher/classes', auth, role('teacher'), async (req, res) => {
  try {
    const newClass = new ClassModel({ name: req.body.name, teacherId: req.user.userId });
    await newClass.save();
    res.json(newClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 1️⃣1️⃣ AUTO SETUP (delayed)
setTimeout(async () => {
  try {
    let admin = await User.findOne({ email: 'admin@collegeerp.com' });
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      admin = new User({ email: 'admin@collegeerp.com', password: hashed, role: 'admin', name: 'Super Admin' });
      await admin.save();
      console.log('✅ ADMIN CREATED: admin@collegeerp.com/admin123');
    }

    const configs = [
      { branch: 'MCA', semester: '1st', subjects: ['Math', 'Science', 'IT', 'DSA'] },
      { branch: 'BCA', semester: '1st', subjects: ['Programming', 'Database', 'Web Tech', 'Math'] },
      { branch: 'CSE', semester: '1st', subjects: ['C Programming', 'Math', 'Physics', 'DSA'] }
    ];
    
    for (let config of configs) {
      await SubjectConfig.findOneAndUpdate({ branch: config.branch, semester: config.semester }, config, { upsert: true });
    }
    console.log('✅ SETUP COMPLETE');
  } catch (err) {
    console.log('⚠️ Setup failed');
  }
}, 5000);

const PORT = process.env.PORT || 5522;
app.listen(PORT, () => {
  console.log(`🚀 Server: port ${PORT}`);
  console.log('✅ Login: admin@collegeerp.com/admin123');
});
