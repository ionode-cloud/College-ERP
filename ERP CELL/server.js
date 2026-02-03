const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/erp')
  .then(() => console.log(' MongoDB Connected'))
  .catch(err => console.error(' MongoDB Error:', err));

const app = express();

//  MIDDLEWARE ORDER (CRITICAL)
app.use(cors({
  origin: [
    'http://localhost:5522',
    'https://college-erp-jhzi.onrender.com'
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

//  CRITICAL FIX: Proper mongoose.Types import
const mongooseTypes = mongoose.Types;

//  STATIC FILE SERVING (FIRST - BEST PRACTICE)
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/css', express.static(path.join(__dirname, 'frontend/css')));
app.use('/js', express.static(path.join(__dirname, 'frontend/js')));

// Serve login page for root, login, login.html
app.get(['/', '/login', '/login.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

//  CLASS MODEL - NEW! (CRITICAL FOR TEACHER CLASSES)
const classSchema = new mongoose.Schema({
  name: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  studentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});
const ClassModel = mongoose.model('Class', classSchema);

//  NEW: SUBJECT CONFIGURATION MODEL
const subjectSchema = new mongoose.Schema({
  branch: String,
  semester: String,
  subjects: [String],
  createdAt: { type: Date, default: Date.now }
});
const SubjectConfig = mongoose.model('SubjectConfig', subjectSchema);

//  SINGLE USER MODEL (Admin/Teacher/Student) - UPDATED WITH SUBJECTS
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'teacher', 'student'], required: true },
  name: { type: String, default: '' },
  rollNo: { type: String, default: '' },
  branch: { type: String, default: '' },
  semester: { type: String, default: '' },
  subjects: { type: [String], default: [] },
  salary: { type: Number, default: 0 }
});
const User = mongoose.model('User', userSchema);

//  ATTENDANCE & MARKS MODELS
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

//  AUTO-CREATE ADMIN + SUBJECT CONFIG
(async () => {
  try {
    // Admin
    let admin = await User.findOne({ email: 'admin@collegeerp.com' });
    if (!admin) {
      const hashed = await bcrypt.hash('admin123', 10);
      admin = new User({
        email: 'admin@collegeerp.com',
        password: hashed,
        role: 'admin',
        name: 'Super Admin'
      });
      await admin.save();
      console.log(' DEFAULT ADMIN CREATED: admin@collegeerp.com / admin123');
    }

    //  SUBJECT CONFIG - MCA, BCA, CSE
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
  } catch (err) {
    console.log('Setup error:', err.message);
  }
})();

//  NEW: GET ALL BRANCHES API (PUBLIC - NO AUTH)
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await SubjectConfig.distinct('branch');
    const sortedBranches = branches.sort();
    
    res.json({
      success: true,
      branches: sortedBranches,
      total: sortedBranches.length,
      message: `Found ${sortedBranches.length} branches`
    });
  } catch (err) {
    console.error('Branches error:', err);
    res.status(500).json({ error: 'Failed to fetch branches' });
  }
});

//  FIXED AUTH MIDDLEWARE (Cookie + Header)
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

//  ROLE MIDDLEWARE
const role = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

//  PROTECTED HTML ROUTES
app.get('/admin', auth, role('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'admin.html'));
});

app.get('/teacher', auth, role('teacher'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'teacher.html'));
});

app.get('/student', auth, role('student'), (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'student.html'));
});

//  PERFECT LOGIN ROUTE - NO AUTH REQUIRED
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log(' LOGIN ATTEMPT:', email); // Debug log
    
    const user = await User.findOne({ email });
    if (!user || !await bcrypt.compare(password, user.password)) {
      console.log(' LOGIN FAILED: Invalid credentials');
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ 
      userId: user._id, 
      role: user.role 
    }, process.env.JWT_SECRET || 'secretkey-collegeerp-2026', { 
      expiresIn: '24h' 
    });
    
    //  SEND TOKEN IN RESPONSE + COOKIE
    res.cookie('jwt', token, { 
      httpOnly: true,
      secure: false,  // Set true for production HTTPS
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 
    });
    
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      rollNo: user.rollNo || null,
      branch: user.branch || null,
      semester: user.semester || null,
      subjects: user.subjects || [],
      salary: user.salary || 0
    };
    
    console.log(' LOGIN SUCCESS:', user.role, user.name);
    
    res.json({ 
      token,
      role: user.role, 
      user: userData,
      redirect: `/${user.role}`
    });
  } catch (err) {
    console.error(' LOGIN ERROR:', err);
    res.status(500).json({ error: 'Login server error' });
  }
});

//  NEW: ADD SUBJECTS API - AUTO UPDATE TEACHERS/STUDENTS
app.post('/api/admin/subjects', auth, role('admin'), async (req, res) => {
  try {
    const { branch, semester, subjects } = req.body;
    
    if (!branch || !semester || !Array.isArray(subjects) || subjects.length === 0) {
      return res.status(400).json({ error: 'Branch, semester, and subjects array required' });
    }
    
    const validSubjects = subjects.map(s => s.trim()).filter(s => s.length > 0);
    if (validSubjects.length === 0) {
      return res.status(400).json({ error: 'At least one valid subject required' });
    }
    
    //  UPSERT SUBJECT CONFIG
    const config = await SubjectConfig.findOneAndUpdate(
      { branch, semester },
      { 
        branch, 
        semester, 
        subjects: validSubjects,
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );
    
    //  AUTO-UPDATE ALL TEACHERS & STUDENTS IN THIS BRANCH
    const updateResult = await User.updateMany(
      { 
        branch: branch, 
        role: { $in: ['teacher', 'student'] } 
      },
      { 
        $set: { 
          subjects: validSubjects,
          semester: semester 
        }
      }
    );
    
    console.log(` AUTO-UPDATED: ${updateResult.modifiedCount} users in ${branch} ${semester}`);
    
    res.json({
      success: true,
      message: ` ${validSubjects.length} subjects added/updated for ${branch} ${semester}`,
      config: {
        branch: config.branch,
        semester: config.semester,
        subjects: config.subjects,
        count: config.subjects.length,
        updatedUsers: updateResult.modifiedCount
      }
    });
  } catch (err) {
    console.error('Add subjects error:', err);
    res.status(500).json({ error: 'Failed to save subjects: ' + err.message });
  }
});

//  FIXED: SUBJECTS ROUTES - PUBLIC ACCESS 
app.get('/api/subjects/all', async (req, res) => {
  try {
    const { branch, semester } = req.query;
    
    let query = {};
    if (branch) query.branch = branch;
    if (semester) query.semester = semester;
    
    const allSubjects = await SubjectConfig.find(query)
      .sort({ branch: 1, semester: 1 })
      .select('branch semester subjects createdAt');
    
    res.json({
      success: true,
      total: allSubjects.length,
      data: allSubjects
    });
  } catch (err) {
    console.error('Subjects fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/subjects/:branch/:semester', auth, role('admin'), async (req, res) => {
  try {
    const { branch, semester } = req.params;
    const config = await SubjectConfig.findOne({ branch, semester });
    res.json(config?.subjects || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//  OTHER ADMIN ROUTES (unchanged)
app.get('/api/admin/profile', auth, role('admin'), async (req, res) => {
  const admin = await User.findById(req.user.userId).select('-password');
  res.json(admin);
});

app.post('/api/admin/create-student', auth, role('admin'), async (req, res) => {
  try {
    const { name, email, password, rollNo, branch, semester = '1st' } = req.body;
    
    if (!name || !email || !password || !rollNo || !branch) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    //  AUTO-ASSIGN SUBJECTS BY BRANCH/SEMESTER
    const subjectConfig = await SubjectConfig.findOne({ branch, semester });
    const subjects = subjectConfig ? subjectConfig.subjects : ['General'];
    
    const hashed = await bcrypt.hash(password, 10);
    const student = new User({ 
      name, 
      email, 
      password: hashed, 
      role: 'student', 
      rollNo, 
      branch,
      semester,
      subjects
    });
    await student.save();
    
    res.json({ 
      success: true, 
      credentials: { email, password },
      subjects: subjects
    });
  } catch (err) {
    console.error('Create student error:', err);
    if (err.code === 11000) {
      res.status(400).json({ error: 'Email already in use' });
    } else {
      res.status(500).json({ error: 'Server error' });
    }
  }
});

app.post('/api/admin/create-teacher', auth, role('admin'), async (req, res) => {
  try {
    const { name, email, password, branch, salary } = req.body;
    
    //  AUTO-ASSIGN SUBJECTS FOR TEACHER BASED ON BRANCH
    const subjectConfig = await SubjectConfig.findOne({ branch });
    const subjects = subjectConfig ? subjectConfig.subjects : ['General Subjects'];
    
    const hashed = await bcrypt.hash(password, 10);
    const teacher = new User({ 
      name, 
      email, 
      password: hashed, 
      role: 'teacher', 
      branch, 
      subjects,
      salary 
    });
    await teacher.save();
    
    res.json({ 
      success: true, 
      credentials: { email, password },
      subjects: subjects
    });
  } catch (err) {
    if (err.code === 11000) {
      res.status(400).json({ error: 'Email already exists' });
    } else {
      res.status(500).json({ error: err.message });
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

app.put('/api/admin/update/:id', auth, role('admin'), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-password');
  res.json(user);
});

app.delete('/api/admin/delete/:id', auth, role('admin'), async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

//  TEACHER & STUDENT ROUTES (unchanged - all working)
app.get('/api/teacher/profile', auth, role('teacher'), async (req, res) => {
  const teacher = await User.findById(req.user.userId).select('-password');
  res.json(teacher);
});

app.get('/api/teacher/classes', auth, role('teacher'), async (req, res) => {
  const classes = await ClassModel.find({ teacherId: req.user.userId })
    .sort({ createdAt: -1 })
    .select('name _id createdAt studentCount');
  res.json(classes);
});

app.post('/api/teacher/classes', auth, role('teacher'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Class name must be at least 2 characters' });
    }
    
    const newClass = new ClassModel({
      name: name.trim(),
      teacherId: req.user.userId
    });
    await newClass.save();
    
    res.json({ 
      success: true, 
      _id: newClass._id,
      name: newClass.name 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/teacher/students', auth, role('teacher'), async (req, res) => {
  const teacher = await User.findById(req.user.userId);
  const students = await User.find({ 
    role: 'student', 
    branch: teacher.branch 
  }).select('-password');
  res.json(students);
});

app.post('/api/teacher/attendance', auth, role('teacher'), async (req, res) => {
  const { classId, attendances } = req.body;
  
  try {
    if (!mongooseTypes.ObjectId.isValid(classId)) {
      return res.status(400).json({ error: 'Invalid class ID format' });
    }
    
    let savedCount = 0;
    for (let att of attendances) {
      if (!mongooseTypes.ObjectId.isValid(att.studentId)) {
        console.warn('Skipping invalid studentId:', att.studentId);
        continue;
      }
      
      await Attendance.findOneAndUpdate(
        { 
          classId: new mongooseTypes.ObjectId(classId),
          studentId: new mongooseTypes.ObjectId(att.studentId)
        },
        { 
          status: att.status, 
          date: new Date() 
        },
        { upsert: true }
      );
      savedCount++;
    }
    
    res.json({ success: true, message: `${savedCount} attendance records saved` });
  } catch (err) {
    console.error('Attendance error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/teacher/marks', auth, role('teacher'), async (req, res) => {
  const { classId, marksData } = req.body;
  
  try {
    if (!mongooseTypes.ObjectId.isValid(classId)) {
      return res.status(400).json({ error: 'Invalid class ID format' });
    }
    
    let savedCount = 0;
    for (let mark of marksData) {
      if (!mongooseTypes.ObjectId.isValid(mark.studentId)) {
        console.warn('Skipping invalid studentId:', mark.studentId);
        continue;
      }
      
      await Marks.findOneAndUpdate(
        { 
          classId: new mongooseTypes.ObjectId(classId),
          studentId: new mongooseTypes.ObjectId(mark.studentId),
          subject: mark.subject 
        },
        { marks: mark.marks },
        { upsert: true }
      );
      savedCount++;
    }
    
    res.json({ success: true, message: `${savedCount} marks saved` });
  } catch (err) {
    console.error('Marks error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student/profile', auth, role('student'), async (req, res) => {
  const student = await User.findById(req.user.userId).select('-password');
  res.json(student);
});

app.get('/api/student/attendance', auth, role('student'), async (req, res) => {
  const atts = await Attendance.find({ studentId: req.user.userId })
    .populate('classId', 'name')
    .sort({ date: -1 });
  res.json(atts);
});

app.get('/api/student/marks', auth, role('student'), async (req, res) => {
  const marks = await Marks.find({ studentId: req.user.userId })
    .populate('classId', 'name')
    .sort({ marks: -1 });
  res.json(marks);
});

const PORT = process.env.PORT || 5522;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Default Admin: admin@collegeerp.com / admin123');
  
});
