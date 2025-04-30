const mongoose = require('mongoose');

const securityQuestion = mongoose.Schema(
    {
        // question: { type: String, required: false },
        question_no: { type: Number, required: true },
        // language: { type: String, required: false },
        // language_code: { type: String, required: false },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('securityQuestion', securityQuestion);
