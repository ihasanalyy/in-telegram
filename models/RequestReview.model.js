const mongoose = require('mongoose');

const request_review = mongoose.Schema({
    comment: { type: String, required: false },
    request_type: { type: String, required: false },
    review_type: { type: String, required: false },
    rating: { type: Number, required: false },
    linked_review: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "request_review",
        required: false,
    },
    buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: false,
    },
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: false,
    },
    request: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "request_payment",
        required: false,
    },
    reply: { type: String, required: false },
    delete_status: { type: Boolean, required: false, default: false }
});

module.exports = mongoose.model('request_review', request_review);