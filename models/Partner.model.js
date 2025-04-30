const mongoose = require('mongoose');

const partner = mongoose.Schema(
    {
        name: { type: String, required: false },
        email: { type: String, required: false },
        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: false,
        },
        designation: { type: String, required: false },
        kyc_status: { type: String, required: false },
        kyc_all_status: {
            faceMatching: { type: String, required: false },
            poa: { type: String, required: false },
            profileCheck: { type: String, required: false },
            livenessCheck: { type: String, required: false },
            docCheck: { type: String, required: false },
        },
        kyc_all_comments: {
            faceMatching: { type: Array, required: false },
            poa: { type: Array, required: false },
            profileCheck: { type: Array, required: false },
            livenessCheck: { type: Array, required: false },
            docCheck: { type: Array, required: false }
        },
        kyb_additional_file: [
            {
                document_type: { type: String, required: false },
                desc: { type: String, required: false },
                file_type: { type: String, required: false },
                file_link: { type: String, required: false },
                status: { type: String, required: false },
                key: { type: String, required: false },
            }
        ],

    }
);

module.exports = mongoose.model('partner', partner);