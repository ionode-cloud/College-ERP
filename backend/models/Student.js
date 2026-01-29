const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    rollNo: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    branch: String,
    gmail: { type: String, required: true, unique: true },
    mobile: String,
    address: String,
    dob: Date,
    age: Number,
    photo: String,
    certificates: [String],
    feesStructure: {
        sem1: Number,
        sem2: Number,
        total: Number
    },
    tempPassword: String // Plain text for admin recovery
}, { timestamps: true });

module.exports = mongoose.model('Student', studentSchema);
