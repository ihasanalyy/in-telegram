const mongoose = require('mongoose');

const pan = mongoose.Schema(
  {
    panData: { type: String, required: true },
    last4: { type: String, required: true },
    status: { type: Boolean, required: false },
    account: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "account",
      required: true,
    },
    createdAt: { type: Date, default: Date.now }
  }
);

module.exports = mongoose.model('pan', pan);