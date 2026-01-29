const express = require('express');
const router = express.Router();
const Attendance = require('../models/Attendance');
const Class = require('../models/Class');  // ✅ MISSING IMPORT
const Student = require('../models/Student'); // ✅ MISSING IMPORT
const authMiddleware = require('../middleware/auth'); // ✅ JWT MIDDLEWARE

// ✅ MARK ATTENDANCE (Teacher creates class → marks branch students)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { classId, presentStudentIds } = req.body;
        
        // ✅ Verify class exists & get branch
        const cls = await Class.findById(classId).populate('teacherId');
        if (!cls) {
            return res.status(404).json({ error: 'Class not found' });
        }

        // ✅ Get ALL students from that branch
        const students = await Student.find({ branch: cls.branch });
        if (students.length === 0) {
            return res.status(404).json({ error: 'No students in this branch' });
        }

        // ✅ Create attendance record for ALL branch students
        const attData = students.map(s => ({
            studentId: s._id,
            rollNo: s.rollNo,
            name: s.name,  // ✅ For display
            present: presentStudentIds.includes(s._id.toString())
        }));

        const att = new Attendance({ 
            classId, 
            branch: cls.branch, 
            teacherId: req.user.id,  // ✅ Logged-in teacher
            students: attData 
        });
        
        await att.save();
        res.json({ 
            success: true, 
            attendance: att,
            totalStudents: students.length,
            presentCount: attData.filter(s => s.present).length
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ GET ATTENDANCE BY CLASS ID
router.get('/class/:classId', authMiddleware, async (req, res) => {
    try {
        const atts = await Attendance.find({ classId: req.params.classId })
            .populate('students.studentId', 'name rollNo branch');
        res.json(atts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ GET TEACHER'S ALL ATTENDANCE RECORDS
router.get('/my', authMiddleware, async (req, res) => {
    try {
        const attendance = await Attendance.find({ teacherId: req.user.id })
            .populate('classId', 'name branch startTime')
            .populate('students.studentId', 'name rollNo');
        res.json(attendance);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ✅ GET ATTENDANCE SUMMARY BY BRANCH
router.get('/branch/:branch', authMiddleware, async (req, res) => {
    try {
        const summary = await Attendance.aggregate([
            { $match: { branch: req.params.branch } },
            {
                $group: {
                    _id: "$branch",
                    totalClasses: { $sum: 1 },
                    totalStudents: { $sum: { $size: "$students" } },
                    totalPresent: {
                        $sum: {
                            $size: {
                                $filter: {
                                    input: "$students",
                                    cond: "$$this.present"
                                }
                            }
                        }
                    }
                }
            }
        ]);
        res.json(summary[0] || { totalClasses: 0, totalStudents: 0, totalPresent: 0 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
