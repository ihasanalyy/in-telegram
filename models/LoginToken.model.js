const mongoose = require('mongoose');

const login_token = mongoose.Schema(
  {
    token: { type: String, required: true },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "category",
      required: true,
    },
    createdAt: { type: Date, default: Date.now }
  }
);

module.exports = mongoose.model('login_token', login_token);