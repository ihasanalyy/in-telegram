const mongoose = require('mongoose');

const user = mongoose.Schema(
    {
        first_name: { type: String, required: false },
        last_name: { type: String, required: false },
        nationality: { type: String, required: false },
        address: { type: String, required: false },
        dob: { type: String, required: false },
        extras: {
            idNumber: String,
            documentType: String,
            dateOfIssue: String,
            dateOfExpiry: String
        },
        kyc_status: { type: String, required: false },
        kyc_ids: {
            application_id: { type: String, required: false },
        },
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
        kyc_additional_file: [
            {
                document_type: { type: String, required: false },
                desc: { type: String, required: false },
                file_type: { type: String, required: false },
                file_link: { type: String, required: false },
                status: { type: String, required: false },
                key: { type: String, required: false },
            }
        ],
        kyc_documents: [
            {
                document_type: { type: String, required: false },
                kind: { type: String, required: false },
                mediaType: { type: String, required: false },
                url: { type: String, required: false },
                issuingCountry: { type: String, required: false }
            }
        ],
        desc: { type: String, required: false },
        occupation: { type: String, required: false },
        source_of_funds: { type: String, required: false },
        // parentId: {
        //     type: mongoose.Schema.Types.ObjectId,
        //     ref: 'user',
        //     required: false
        // },
        question1: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "securityQuestion",
            required: false,
        },
        answer1: { type: String, required: false },
        question2: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "securityQuestion",
            required: false,
        },
        answer2: { type: String, required: false },
        question3: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "securityQuestion",
            required: false,
        },
        answer3: { type: String, required: false },

        account: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "account",
            required: true,
        },
        createdAt: { type: Date, default: Date.now }
    }
);

module.exports = mongoose.model('user', user);