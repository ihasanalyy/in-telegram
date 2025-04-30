const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const NotificationSchema = Schema({
    title: { type: String, required: false },
    desc: { type: String, required: false },
    type: { type: String, required: false },
    status: { type: String, required: false },
    fromDetails: { type: Object, require: false },
    toDetails: { type: Object, require: false },
    // link: { type: String, require: false },
    link_id: { type: String, require: false },
    from: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: false,
    },
    to: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "account",
        required: false,
    },
    createdAt: { type: Date, default: Date.now }

})

module.exports = mongoose.model("notification", NotificationSchema)

