const mongoose = require('mongoose');

const payoutChannels = mongoose.Schema(
    {

        id: { type: String, required: false },
        name: { type: String, required: false },
        status: {
            type: String,
            required: false
        },
        vendors: {
            thunes_id: {
                type: String,
                required: false
            },
            swiss_remit_id: {
                type: String,
                required: false
            },
            msf_id: {
                type: String,
                required: false
            }
        },

        // mobile_money: {
        //     id: { type: String, required: false },
        //     status: {
        //         type: String,
        //         required: false
        //     },
        //     vendors: {
        //         thunes_id: {
        //             type: String,
        //             required: false
        //         },
        //         swiss_remit_id: {
        //             type: String,
        //             required: false
        //         },
        //         msf_id: {
        //             type: String,
        //             required: false
        //         }
        //     },
        // },
        // cash_pickup: {
        //     id: { type: String, required: false },
        //     status: {
        //         type: String,
        //         required: false
        //     },
        //     vendors: {
        //         thunes_id: {
        //             type: String,
        //             required: false
        //         },
        //         swiss_remit_id: {
        //             type: String,
        //             required: false
        //         },
        //         msf_id: {
        //             type: String,
        //             required: false
        //         }
        //     },
        // },
        // card_payment: {
        //     id: { type: String, required: false },
        //     status: {
        //         type: String,
        //         required: false
        //     },
        //     vendors: {
        //         thunes_id: {
        //             type: String,
        //             required: false
        //         },
        //         swiss_remit_id: {
        //             type: String,
        //             required: false
        //         },
        //         msf_id: {
        //             type: String,
        //             required: false
        //         }
        //     },
        // },
        // w2w: {
        //     id: { type: String, required: false },
        //     status: {
        //         type: String,
        //         required: false
        //     },
        //     vendors: {
        //         thunes_id: {
        //             type: String,
        //             required: false
        //         },
        //         swiss_remit_id: {
        //             type: String,
        //             required: false
        //         },
        //         msf_id: {
        //             type: String,
        //             required: false
        //         }
        //     },
        // },
        // crypto: {
        //     id: { type: String, required: false },
        //     status: {
        //         type: String,
        //         required: false
        //     },
        //     vendors: {
        //         thunes_id: {
        //             type: String,
        //             required: false
        //         },
        //         swiss_remit_id: {
        //             type: String,
        //             required: false
        //         },
        //         msf_id: {
        //             type: String,
        //             required: false
        //         }
        //     },
        // }
    }
);

module.exports = mongoose.model('payoutChannels', payoutChannels);