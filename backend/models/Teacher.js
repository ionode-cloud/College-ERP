const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
    name: { type: String, required: true },
    gmail: { type: String, required: true, unique: true },
    subject: { type: String, required: true },
    age: Number,
    profession: String,
    dob: Date,
    phone: String,
    tempPassword: String
}, { timestamps: true });

module.exports = mongoose.model('Teacher', teacherSchema);
