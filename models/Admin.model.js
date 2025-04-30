const mongoose = require('mongoose');

const admin = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: false },
    role: { type: Array, required: true },
    password: { type: String, required: true },
    status: { type: String, required: false },
    createdAt: { type: Date, default: Date.now }
  }
);

module.exports = mongoose.model('admin', admin);