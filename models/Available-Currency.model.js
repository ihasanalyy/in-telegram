const mongoose = require('mongoose');

const available_currency = mongoose.Schema(
    {
        symbol: { type: String, required: false },
        code: { type: String, required: false },
        name: { type: String, required: false },
    }
)

module.exports = mongoose.model('available_currency', available_currency);