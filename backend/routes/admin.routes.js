const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

// ✅ MULTER CONFIG (10MB limit)
const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only images and PDFs allowed!'));
        }
    }
});

// 🔥 PING ENDPOINT (for frontend health check)
router.head('/ping', (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.status(200).end();
});

// ✅ PUBLIC: Get students (for frontend demo/offline)
router.get('/students', async (req, res) => {
    try {
        const students = await Student.find()
            .select('rollNo name branch gmail mobile photo certificates tempPassword age dob address')
            .sort({ rollNo: 1 });
        res.json(students);
    } catch (err) {
        console.error('❌ Students GET:', err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ PUBLIC: Get teachers
router.get('/teachers', async (req, res) => {
    try {
        const teachers = await Teacher.find()
            .select('gmail name subject age phone tempPassword profession dob')
            .sort({ name: 1 });
        res.json(teachers);
    } catch (err) {
        console.error('❌ Teachers GET:', err);
        res.status(500).json({ error: err.message });
    }
});

// ✅ PUBLIC: Fees structure
router.get('/fees', (req, res) => {
    res.json({
        CSE: { sem1: 55000, sem2: 55000, total: 110000 },
        ECE: { sem1: 52000, sem2: 52000, total: 104000 },
        MECH: { sem1: 48000, sem2: 48000, total: 96000 },
        CIVIL: { sem1: 45000, sem2: 45000, total: 90000 }
    });
});

// 🔥 ADMIN ONLY: Create student (Protected)
router.post('/admin/students', authMiddleware, upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'certificates', maxCount: 10 }
]), async (req, res) => {
    try {
        console.log('📥 Admin creating student:', req.body);
        
        const { rollNo, name, branch, gmail, mobile, address, dob, age } = req.body;

        if (!rollNo || !name || !branch || !gmail) {
            return res.status(400).json({ 
                error: 'Missing required: rollNo, name, branch, gmail' 
            });
        }

        // Check duplicate rollNo/gmail
        const existing = await Student.findOne({ 
            $or: [{ rollNo }, { gmail }] 
        });
        if (existing) {
            return res.status(400).json({ 
                error: `Duplicate: ${existing.rollNo ? 'RollNo' : 'Gmail'} already exists` 
            });
        }

        const feesStructure = {
            CSE: { sem1: 55000, sem2: 55000, total: 110000 },
            ECE: { sem1: 52000, sem2: 52000, total: 104000 },
            MECH: { sem1: 48000, sem2: 48000, total: 96000 },
            CIVIL: { sem1: 45000, sem2: 45000, total: 90000 }
        }[branch.toUpperCase()] || { sem1: 50000, sem2: 50000, total: 100000 };

        const studentData = {
            rollNo,
            name,
            branch: branch.toUpperCase(),
            gmail: gmail.toLowerCase(),
            mobile: mobile || '',
            address: address || '',
            age: age ? parseInt(age) : 20,
            feesStructure
        };

        if (dob) {
            const date = new Date(dob);
            if (!isNaN(date.getTime())) studentData.dob = date;
        }

        // Files
        if (req.files?.photo?.[0]) {
            studentData.photo = `/uploads/${req.files.photo[0].filename}`;
        }
        if (req.files?.certificates) {
            studentData.certificates = req.files.certificates.map(f => `/uploads/${f.filename}`);
        }

        const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
        const student = new Student({ ...studentData, tempPassword: tempPass });
        await student.save();

        console.log('✅ Student created:', student.rollNo);
        res.json({ 
            success: true, 
            student: student.toObject(),
            credentials: { 
                rollNo: student.rollNo, 
                name: student.name,
                gmail: student.gmail,
                tempPass 
            } 
        });
    } catch (err) {
        console.error('❌ Admin Student Error:', err);
        res.status(400).json({ error: err.message });
    }
});

// 🔥 ADMIN ONLY: Create teacher (Protected)
router.post('/admin/teachers', authMiddleware, async (req, res) => {
    try {
        console.log('📥 Admin creating teacher:', req.body);
        
        const { name, gmail, subject, age, profession, dob, phone } = req.body;

        if (!name || !gmail || !subject) {
            return res.status(400).json({ error: 'Missing: name, gmail, subject' });
        }

        const existing = await Teacher.findOne({ gmail });
        if (existing) {
            return res.status(400).json({ error: 'Gmail already exists' });
        }

        const tempPass = Math.random().toString(36).slice(-8).toUpperCase();
        const teacherData = {
            name,
            gmail: gmail.toLowerCase(),
            subject,
            age: age ? parseInt(age) : 0,
            profession: profession || '',
            phone: phone || '',
            tempPassword: tempPass
        };

        if (dob) {
            const date = new Date(dob);
            if (!isNaN(date.getTime())) teacherData.dob = date;
        }

        const teacher = new Teacher(teacherData);
        await teacher.save();

        console.log('✅ Teacher created:', teacher.gmail);
        res.json({ 
            success: true, 
            teacher: teacher.toObject(),
            credentials: { 
                gmail: teacher.gmail, 
                name: teacher.name,
                tempPass 
            } 
        });
    } catch (err) {
        console.error('❌ Admin Teacher Error:', err);
        res.status(400).json({ error: err.message });
    }
});

// 🔥 ADMIN ONLY: Reset Password
router.post('/admin/reset-password', authMiddleware, async (req, res) => {
    try {
        const { email, type } = req.body;
        
        if (!email || !type) {
            return res.status(400).json({ error: 'Missing email or type' });
        }

        const newPassword = Math.random().toString(36).slice(-8).toUpperCase();
        
        let result;
        if (type === 'student') {
            result = await Student.findOneAndUpdate(
                { gmail: email }, 
                { tempPassword: newPassword },
                { new: true }
            );
        } else if (type === 'teacher') {
            result = await Teacher.findOneAndUpdate(
                { gmail: email }, 
                { tempPassword: newPassword },
                { new: true }
            );
        } else {
            return res.status(400).json({ error: 'Invalid type: student or teacher' });
        }

        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`🔄 Password reset for ${type}: ${email} → ${newPassword}`);
        res.json({ 
            success: true, 
            newPassword,
            message: `${type} password reset successfully`
        });
    } catch (err) {
        console.error('❌ Reset Password Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
