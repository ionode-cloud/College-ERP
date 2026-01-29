const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const authMiddleware = require('../middleware/auth');
const bcrypt = require('bcryptjs');

// ✅ ADMIN LOGIN (Hardcoded for simplicity)
router.post('/admin-login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Default admin credentials
        if (email === 'admin@collegeerp.com' && password === 'admin123') {
            const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '24h' });
            res.json({ 
                success: true,
                token, 
                user: { email, role: 'admin', name: 'Administrator' } 
            });
        } else {
            res.status(401).json({ success: false, message: '❌ Invalid admin credentials' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ STUDENT/TEACHER LOGIN
router.post('/login', async (req, res) => {
    try {
        const { gmail, password, role } = req.body;
        
        let user;
        if (role === 'student') {
            user = await Student.findOne({ gmail });
        } else if (role === 'teacher') {
            user = await Teacher.findOne({ gmail });
        }
        
        if (!user) {
            return res.status(401).json({ success: false, message: '❌ User not found' });
        }
        
        // Check tempPassword (plain text for simplicity)
        if (user.tempPassword !== password) {
            return res.status(401).json({ success: false, message: '❌ Invalid password' });
        }
        
        // Create JWT token
        const token = jwt.sign(
            { id: user._id, role, gmail: user.gmail }, 
            process.env.JWT_SECRET, 
            { expiresIn: '24h' }
        );
        
        res.json({ 
            success: true,
            token, 
            user: {
                id: user._id,
                name: user.name,
                gmail: user.gmail,
                rollNo: user.rollNo,
                branch: user.branch,
                role
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
