const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  date: { type: Date, default: Date.now },
  branch: String,
  students: [{
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    rollNo: String,
    present: Boolean
  }]
});
module.exports = mongoose.model('Attendance', schema);
