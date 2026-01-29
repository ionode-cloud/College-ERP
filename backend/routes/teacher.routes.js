const express = require('express');
const router = express.Router();
const Class = require('../models/Class');
const Student = require('../models/Student');
const authMiddleware = (req, res, next) => {
  // JWT verify logic here
  next();
};

router.post('/classes', authMiddleware, async (req, res) => {
  const cls = new Class(req.body);
  await cls.save();
  res.json(cls);
});

router.get('/students/:branch', async (req, res) => {
  const students = await Student.find({ branch: req.params.branch });
  res.json(students);
});

module.exports = router;
