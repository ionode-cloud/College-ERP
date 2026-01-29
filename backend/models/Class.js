const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
  branch: String,
  startTime: Date,
  name: String
});
module.exports = mongoose.model('Class', schema);
