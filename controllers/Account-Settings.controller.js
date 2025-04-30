const Account = require('../models/Account.model');
const AccountLevel = require('../models/Account-Level.model');
const Fee = require('../models/Fee.model');
const Markup = require('../models/Markup.model');
const Country = require('../models/Country.model');
const ReceiverFee = require('../models/ReceiverFee.model');
const Category = require('../models/Category.model');
const levelData = require('../utils/JSON_DATA/level.json')

const { encryption, decryption } = require('../configurations/Encryption');


const countryFee = [
    {
        "service_name": "bank_account",
        "flat_fee": 1,
        "percentage_fee": 0.5,
        "fee_type": "flat",
        "fee_currency": "USD",
        "flat_markup": 0,
        "percentage_markup": 0.5,
        "markup_type": "percentage",
        "markup_currency": "USD",
    },
    {
        "service_name": "mobile_money",
        "flat_fee": 1,
        "percentage_fee": 0.5,
        "fee_type": "flat",
        "fee_currency": "USD",
        "flat_markup": 0,
        "percentage_markup": 0.5,
        "markup_type": "percentage",
        "markup_currency": "USD",
    },
    {
        "service_name": "card_payment",
        "flat_fee": 1,
        "percentage_fee": 0.5,
        "fee_type": "flat",
        "fee_currency": "USD",
        "flat_markup": 0,
        "percentage_markup": 0.5,
        "markup_type": "percentage",
        "markup_currency": "USD",
    },
    {
        "service_name": "cash_pickup",
        "flat_fee": 1,
        "percentage_fee": 0.5,
        "fee_type": "flat",
        "fee_currency": "USD",
        "flat_markup": 0,
        "percentage_markup": 0.5,
        "markup_type": "percentage",
        "markup_currency": "USD",
    }
]

const countryIntitalData = {

    "individual_registration_active": true,
    "business_registration_active": true,
    "receivingActive": true,
    "status": "inactive",
    "kyc_fee:": 3.99,
    "kyb_fee": 3.99,

    "bank_transfer": {
        "thunes": 1,
        "swiss_remit": 2,
        "mfs_africa": 3
    },
    "card_payment": {
        "thunes": 1,
        "swiss_remit": 2,
        "mfs_africa": 3
    },
    "cash_pickup": {
        "thunes": 1,
        "swiss_remit": 2,
        "mfs_africa": 3
    },
    "mobile_wallet": {
        "thunes": 1,
        "swiss_remit": 2,
        "mfs_africa": 3
    },
    "business_receiving_channels": {
        "bank_account": true,
        "mobile_money": true,
        "card_payment": true,
        "paypal": true,
        "cash_pickup": true
    },
    "individual_receiving_channels": {
        "bank_account": true,
        "mobile_money": true,
        "card_payment": true,
        "paypal": true,
        "cash_pickup": true
    },

    "mfs_africa": true,
    "swiss_remit": true,
    "thunes": true
}

module.exports.addLevel = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // let data = req.body;
        var { country, country_iso_code } = data;
        levelList = [];
        let addObj = {}

        // console.log(levelList);
        // let levelFound1 = await AccountLevel.updateMany({ account_type: { $in: ['business', 'individual'] } }, { $set: { country: 'Morocco', country_iso_code: 'MAR' } })

        let levelFound = await AccountLevel.find({ country_iso_code: country_iso_code.toUpperCase() })
        let categoryList = await Category.find()
        let countryFound = await Country.findOne({ country_iso_code: country_iso_code.toUpperCase() })
        if (!levelFound?.length && !countryFound) {
            let cd = countryIntitalData;
            cd['country_name'] = country
            cd['country_iso_code'] = country_iso_code
            Country.create(cd).then(async (result) => {
                if (result) {
                    let feeList = [];
                    await countryFee.map(cfl => {
                        let obj = { ...cfl }
                        obj.country = result._id
                        feeList.push(obj)
                    })
                    let rf = await ReceiverFee.insertMany(feeList)
                    // categoryList.map(cl => {
                    //     for (let i = 0; i < 4; ++i) {
                    //         addObj.level_no = i + 1;
                    //         addObj.account_type = cl.account_type;
                    //         addObj.country = result._id;
                    //         addObj.category = cl._id
                    //         let obj = { ...addObj }
                    //         levelList.push(obj)
                    //     }
                    // })
                    categoryList.map(ctgl => {
                        for (let i = 1; i <= 4; ++i) {
                            let d = {};
                            if (i == 1) {
                                d = { ...levelData["intital_level"].data }
                            } else {
                                d = { ...levelData[ctgl.name].data }
                            }
                            d.level_no = i;
                            d.account_type = ctgl.account_type;
                            d.country = result._id;
                            d.country_iso_code = result.country_iso_code;
                            d.country_name = result.country_name;
                            d.category = ctgl._id
                            levelList.push(d)
                        }
                    })

                    AccountLevel.insertMany(levelList).then(async (levelDetails) => {
                        // console.log(levelDetails);
                        if (levelDetails) {
                            let arrayOfPromises = [];
                            levelDetails.map(async (al) => {
                                arrayOfPromises.push(addFeeFor(al._id, al.level_no, al.country, al.category, al.account_type))
                            })
                            let response = await Promise.all(arrayOfPromises)

                            let data = await encryption({
                                message: "Successfully added to country list",
                                status: true,
                                levelDetails,
                                countryDetails: result
                            })
                            res.status(200).send(data)
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Failed to add level!"
                            })
                            res.status(400).send(error)
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while adding level!"
                        })
                        res.status(400).send(error)
                    })
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Failed to add country!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                let error = await encryption({
                    message: "Something went wrong while adding this country!",
                    status: false,
                    err
                });
                res.status(400).send(error);
            });
        } else if (!levelFound?.length && countryFound) {

            // categoryList.map(cl => {
            //     for (let i = 0; i < 4; ++i) {
            //         addObj.level_no = i + 1;
            //         addObj.account_type = cl.account_type;
            //         addObj.country = result._id;
            //         addObj.category = cl._id
            //         let obj = { ...addObj }
            //         levelList.push(obj)
            //     }
            // })
            categoryList.map(ctgl => {
                for (let i = 1; i <= 4; ++i) {
                    let d = {};
                    if (i == 1) {
                        d = { ...levelData["intital_level"].data }
                    } else {
                        d = { ...levelData[ctgl.name].data }
                    }
                    d.level_no = i;
                    d.account_type = ctgl.account_type;
                    d.country = countryFound._id;
                    d.country_iso_code = countryFound.country_iso_code;
                    d.country_name = countryFound.country_name;
                    d.category = ctgl._id
                    levelList.push(d)
                }
            })
            AccountLevel.insertMany(levelList).then(async (levelDetails) => {
                if (levelDetails) {
                    let arrayOfPromises = [];
                    levelDetails.map(async (al) => {
                        arrayOfPromises.push(addFeeFor(al._id, al.level_no, al.country, al.category, al.account_type))
                    })
                    let response = await Promise.all(arrayOfPromises)

                    let data = await encryption({
                        message: "Successfully added to country list",
                        status: true,
                        levelDetails,
                        countryDetails: countryFound
                    })
                    res.status(200).send(data)
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Failed to add level!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while adding level!"
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Level already exist for this country!",
            })
            res.status(400).send(error)
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }

}

module.exports.getLevelDetails = async (req, res) => {
    try {
        let level_id = req.params.level_id
        AccountLevel.findOne({ _id: level_id }).then(async (levelDetails) => {
            if (levelDetails) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Level details!",
                    levelDetails
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No level found for provided level ID!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting level details!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getAllLevels = async (req, res) => {
    try {
        AccountLevel.find().then(async (levelList) => {
            if (levelList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Level list!",
                    levelList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No level found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting level list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getIndividualLevels = async (req, res) => {
    try {
        AccountLevel.find({ account_type: 'individual' }).then(async (levelList) => {
            if (levelList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Levels for Individual accounts!",
                    levelList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No level found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting level list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getBusinessLevels = async (req, res) => {
    try {
        AccountLevel.find({ account_type: 'business' }).then(async (levelList) => {
            if (levelList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Levels for business accounts!",
                    levelList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No level found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting level list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updateLevel = async (req, res) => {
    // Country.updateMany({}, { $unset: { crypto_wallet: "" } }).then(cd => { console.log(cd); })
    // Country.find().then(cl => {
    //     cl.map(async (cd) => {
    //         let feeList = [];
    //         await countryFee.map(cfl => {
    //             let obj = { ...cfl }
    //             obj.country = cd._id
    //             feeList.push(obj)
    //         })
    //         let rf = await ReceiverFee.insertMany(feeList)
    //         console.log(rf);
    //     })
    // })

    try {
        let reqBody = await decryption(req.body.data)
        // let data = req.body
        let level_id = req.params.level_id;
        var {
            airtime,
            bundle,
            cash_card,
            account_balance_limit,
            daily_receiving_limit,
            daily_sending_limit,
            daily_transaction_count,
            data,
            entertainment,
            international_transfer,
            internet,
            monthly_receiving_limit,
            monthly_sending_limit,
            monthly_transaction_count,
            payment_address,
            payment_request,
            topup_min_amount,
            topup_max_amount,
            qr_pay,
            quotation,
            retail,
            send_crypto_to_other_wallet,
            television,
            topup_channel,
            transaction_amount_limit,
            travel_and_transport,
            voip,
            wallet_to_wallet,
            withdrawal_channel,
            yearly_receiving_limit,
            yearly_sending_limit,
            yearly_transaction_count
        } = reqBody;

        let updtObj = {
            account_balance_limit,
            daily_sending_limit,
            monthly_sending_limit,
            yearly_sending_limit,
            daily_receiving_limit,
            monthly_receiving_limit,
            yearly_receiving_limit,
            daily_transaction_count,
            monthly_transaction_count,
            yearly_transaction_count,
            transaction_amount_limit,
            topup_min_amount,
            topup_max_amount,
            payment_request,
            payment_address,
            international_transfer,
            qr_pay,
            quotation,
            wallet_to_wallet,
            withdrawal_channel,
            topup_channel,
            send_crypto_to_other_wallet,
            airtime,
            bundle,
            data,
            internet,
            television,
            voip,
            retail,
            cash_card,
            entertainment,
            travel_and_transport,
        }
        // console.log(req.body);
        AccountLevel.findByIdAndUpdate({ _id: level_id }, updtObj, { new: true }).then(async (levelDetails) => {
            if (levelDetails) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Level updated successfully!",
                    levelDetails
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Failed to update level details!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while updating level details!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getFeeList = async (req, res) => {
    try {
        let level_id = req.params.level_id
        Fee.find({ account_level: level_id }).then(async (feeList) => {
            if (feeList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Fee list!",
                    feeList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No fee found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting fee list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getReceiverFeeList = async (req, res) => {
    try {
        let country_id = req.params.country_id
        ReceiverFee.find({ country: country_id }).then(async (feeList) => {
            if (feeList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Fee list!",
                    feeList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No fee found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting fee list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updateFee = async (req, res) => {

    try {
        let level_id = req.params.level_id
        let data = await decryption(req.body.data)
        // let data = req.body
        let arrayOfPromises = [];
        data.map(async (al) => {
            if (al.account_level == level_id) {
                let feeObj = {
                    _id: al._id,
                    flat_fee: al.flat_fee,
                    percentage_fee: al.percentage_fee,
                    fee_type: al.fee_type,
                    flat_markup: al.flat_markup,
                    percentage_markup: al.percentage_markup,
                    // markup_type: al.markup_type
                }
                arrayOfPromises.push(updateSingleFee(feeObj, level_id))
            }
        })
        let response = await Promise.all(arrayOfPromises)

        let ciphertext = await encryption({
            status: true,
            message: "Fee updated successfully!",
            response
        })
        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }

}

async function updateSingleFee(feeObj, level_id) {
    console.log(feeObj, level_id);
    try {
        let updt = await Fee.findByIdAndUpdate({ _id: feeObj._id }, feeObj, { new: true })
        return updt;
    } catch (error) {
        return error;
    }
}

module.exports.updateReceiverFee = async (req, res) => {

    try {
        let country_id = req.params.country_id
        let data = await decryption(req.body.data)
        // let data = req.body
        let arrayOfPromises = [];
        data.map(async (al) => {
            if (al.country == country_id) {
                let feeObj = {
                    _id: al._id,
                    flat_fee: al.flat_fee,
                    percentage_fee: al.percentage_fee,
                    fee_type: al.fee_type,
                    flat_markup: al.flat_markup,
                    percentage_markup: al.percentage_markup,
                    // markup_type: al.markup_type
                }
                arrayOfPromises.push(updateSingleReceiverFee(feeObj))
            }
        })
        let response = await Promise.all(arrayOfPromises)

        let ciphertext = await encryption({
            status: true,
            message: "Fee updated successfully!",
            response
        })
        res.status(200).send(ciphertext)
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }

}

async function updateSingleReceiverFee(feeObj) {
    // console.log(feeObj, level_id);
    try {
        let updt = await ReceiverFee.findByIdAndUpdate({ _id: feeObj._id }, feeObj, { new: true })
        return updt;
    } catch (error) {
        return error;
    }
}

module.exports.addCountry = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        let data = req.body
        var { country_name, country_iso_code } = data;
        levelList = [];
        let addObj = {
            status: true,
            thunes: false,
            country_name,
            country_iso_code: country_iso_code.toUpperCase()
        }
        let countryFound = await AccountLevel.find({ country_iso_code: country_iso_code.toUpperCase() })
        if (!countryFound?.length) {
            AccountLevel.insertMany(levelList).then(async (levelDetails) => {
                if (levelDetails) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Level added successfully!",
                        levelDetails
                    })
                    res.status(200).send(ciphertext)
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Failed to add level!"
                    })
                    res.status(400).send(error)
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while adding level!"
                })
                res.status(400).send(error)
            })
        } else {
            let error = await encryption({
                status: false,
                message: "Level already exist for this country!"
            })
            res.status(400).send(error)
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

async function addFeeFor(level_id, level_no, country_id, category, account_type) {
    try {
        let arrCreate = []
        let arr = [
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 4, service_name: 'wallet_to_wallet' },
            { flat_fee: 0, percentage_fee: 1, fee_type: 'percentage', percentage_markup: 2, service_name: 'qr_pay' },
            { flat_fee: 2, percentage_fee: 0, fee_type: 'flat', percentage_markup: 2, service_name: 'payment_request' },
            { flat_fee: 0, percentage_fee: 1.75, fee_type: 'percentage', percentage_markup: 2, service_name: 'payment_address' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'payment_gateway' },
            { flat_fee: 0, percentage_fee: 0.5, fee_type: 'percentage', percentage_markup: 2, service_name: 'conversion' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 4, service_name: 'quotation' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'crypto_wallet_to_wallet' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'crypto_send_to_other_wallet' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'crypto_to_fiat' },

            { flat_fee: 0.5, percentage_fee: 0, fee_type: 'flat', percentage_markup: 6, service_name: 'international_bank_transfer' },
            { flat_fee: 0.5, percentage_fee: 0, fee_type: 'flat', percentage_markup: 6, service_name: 'international_mobile_wallet' },
            { flat_fee: 0.5, percentage_fee: 0, fee_type: 'flat', percentage_markup: 6, service_name: 'international_cash_pickup' },
            { flat_fee: 0.5, percentage_fee: 0, fee_type: 'flat', percentage_markup: 6, service_name: 'international_card_payment' },

            { flat_fee: 0, percentage_fee: 2, fee_type: 'percentage', percentage_markup: 5, service_name: 'withdrawal_bank_transfer' },
            { flat_fee: 0, percentage_fee: 2, fee_type: 'percentage', percentage_markup: 5, service_name: 'withdrawal_mobile_wallet' },
            { flat_fee: 0, percentage_fee: 2, fee_type: 'percentage', percentage_markup: 5, service_name: 'withdrawal_cash_pickup' },
            { flat_fee: 0, percentage_fee: 2, fee_type: 'percentage', percentage_markup: 5, service_name: 'withdrawal_card_payment' },

            { flat_fee: 0, percentage_fee: 1.25, fee_type: 'percentage', percentage_markup: 3, service_name: 'topup_bank' },
            { flat_fee: 0, percentage_fee: 1.25, fee_type: 'percentage', percentage_markup: 3, service_name: 'topup_mobile_wallet' },
            { flat_fee: 0, percentage_fee: 1.25, fee_type: 'percentage', percentage_markup: 2, service_name: 'topup_card_payment' },
            { flat_fee: 0, percentage_fee: 1.25, fee_type: 'percentage', percentage_markup: 2, service_name: 'topup_paypal' },

            { flat_fee: 0.95, percentage_fee: 0, fee_type: 'flat', percentage_markup: 2, service_name: 'airtime' },
            { flat_fee: 0.95, percentage_fee: 0, fee_type: 'flat', percentage_markup: 2, service_name: 'bundle' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'data' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'internet' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'television' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'voip' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'retail' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'cash_card' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'entertainment' },
            { flat_fee: 0, percentage_fee: 0, fee_type: 'flat', percentage_markup: 0, service_name: 'travel_and_transport' },
        ]

        // let arr = [
        //     'wallet_to_wallet',
        //     'international_transfer',
        //     'qr_payment',
        //     'payment_address',
        //     'conversion',
        //     'crypto_send',
        //     'crypto_withdraw',
        //     'bank',
        //     'mobile_wallet',
        //     'card',
        //     'topup_bank',
        //     'topup_mobile_wallet',
        //     'topup_card',
        //     'airtime',
        //     'bundle',
        //     'data',
        //     'internet',
        //     'television',
        //     'voip',
        //     'retail',
        //     'cash_card',
        //     'entertainment',
        //     'travel_and_transport',
        // ]

        arr.map(al => {
            let updtObj = {
                service_name: al.service_name,
                flat_fee: al.flat_fee,
                percentage_fee: al.percentage_fee,
                fee_type: al.fee_type,
                fee_currency: 'USD',
                flat_markup: 0,
                percentage_markup: al.percentage_markup,
                markup_type: 'percentage',
                markup_currency: 'USD',
                account_type,
                level_no,
                account_level: level_id,
                country: country_id,
                category: category
            }
            arrCreate.push(updtObj)
        })

        console.log(arrCreate);
        let levelDetails = await Fee.insertMany(arrCreate)
        return levelDetails
    } catch (error) {
        return error
    }
}

module.exports.getBusinessCategories = async (req, res) => {
    try {
        Category.find({ account_type: "business" }, { name: true }).then(async (categoryList) => {
            if (categoryList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Category list!",
                    categoryList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No category found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting category list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getAllCategories = async (req, res) => {
    try {
        Category.find().then(async (categoryList) => {
            if (categoryList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Category list!",
                    categoryList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No category found!"
                })
                res.status(400).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting category list!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updateCategory = async (req, res) => {
    try {
        let category_id = req.params.category_id
        let data = await decryption(req.body.data)
        // let data = req.body;
        if (data?.business_type || data?.account_type || data?.name || data?.name == '' || data?.business_type == '' || data?.account_type == '') {
            let error = await encryption({
                message: "Cannot update Category!",
                status: false
            });
            return res.status(400).send(error);
        } else {
            Category.findById(category_id).then(async (category) => {
                if (!category) {
                    let error = await encryption({
                        message: "Category not found!",
                        status: false
                    });
                    return res.status(404).send(error);
                } else {
                    Category.findByIdAndUpdate(category._id, data, { new: true }).then(async (result) => {
                        let data = await encryption({
                            message: "Updated successfully!",
                            status: true,
                            categoryDetails: result
                        });
                        res.status(200).send(data);
                    }).catch(async (err) => {
                        let error = await encryption({
                            message: "Something went wrong while updating category!",
                            status: false,
                            err
                        });
                        res.status(500).send(error);
                    });
                }
            }).catch(async (err) => {
                let error = await encryption({
                    message: "Something went wrong while finding category!",
                    status: false
                });
                res.status(500).send(error);
            });
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }

}

async function addAllFee(body) {
    try {
        let levels = await AccountLevel.find()
        let arrCreate = []
        let arr = [
            // 'wallet_to_wallet',
            // 'qr_pay',
            // 'payment_request',
            // 'payment_address',
            // 'payment_gateway',
            // 'conversion',
            // 'quotation',
            // 'crypto_wallet_to_wallet',
            // 'crypto_send_to_other_wallet',
            // 'crypto_to_fiat',

            // 'international_bank_transfer',
            // 'international_mobile_wallet',
            // 'international_cash_pickup',
            // 'international_card_payment',

            // 'withdrawal_bank_transfer',
            // 'withdrawal_mobile_wallet',
            // 'withdrawal_cash_pickup',
            // 'withdrawal_card_payment',

            // 'topup_bank',
            // 'topup_mobile_wallet',
            // 'topup_card_payment',
            // 'topup_paypal',

            // 'airtime',
            // 'bundle',
            // 'data',
            // 'internet',
            // 'television',
            // 'voip',
            // 'retail',
            // 'cash_card',
            // 'entertainment',
            // 'travel_and_transport',

            // 'vcc_standard_virtual',
            // 'vcc_premium_virtual',
            // 'vcc_standard_physical',
            // 'vcc_premium_physical',
            // 'vcc_premium_plus_virtual',
            // 'vcc_premium_plus_physical',

            // 'topup_bank_vcc_premium_virtual',
            // 'topup_mobile_wallet_vcc_premium_virtual',
            // 'topup_card_payment_vcc_premium_virtual',
            // 'topup_paypal_vcc_premium_virtual',
            // 'topup_ip_wallet_vcc_premium_virtual',
            // 'topup_bank_vcc_premium_physical',
            // 'topup_mobile_wallet_vcc_premium_physical',
            // 'topup_card_payment_vcc_premium_physical',
            // 'topup_paypal_vcc_premium_physical',
            // 'topup_ip_wallet_vcc_premium_physical',

            // 'topup_bank_vcc_standard_virtual',
            // 'topup_mobile_wallet_vcc_standard_virtual',
            // 'topup_card_payment_vcc_standard_virtual',
            // 'topup_paypal_vcc_standard_virtual',
            // 'topup_ip_wallet_vcc_standard_virtual',
            // 'topup_bank_vcc_standard_physical',
            // 'topup_mobile_wallet_vcc_standard_physical',
            // 'topup_card_payment_vcc_standard_physical',
            // 'topup_paypal_vcc_standard_physical',
            // 'topup_ip_wallet_vcc_standard_physical',

            // 'card_trx_standard_virtual',
            // 'card_trx_premium_virtual',
            // 'card_trx_standard_physical',
            // 'card_trx_premium_physical',
            // 'card_trx_premium_plus_virtual',
            // 'card_trx_premium_plus_physical',

            // 'standard_card_to_card',
            // 'premium_card_to_card',
            // 'premium_plus_card_to_card',
        ]

        levels.map(ll => {
            arr.map(al => {
                let updtObj = {
                    service_name: al,
                    flat_fee: 1,
                    percentage_fee: 0.5,
                    fee_type: 'flat',
                    fee_currency: 'USD',
                    flat_markup: 0,
                    percentage_markup: 0.5,
                    markup_type: 'percentage',
                    markup_currency: 'USD',
                    account_type: ll.account_type,
                    level_no: ll.level_no,
                    account_level: ll._id,
                    country: ll.country,
                    category: ll.category
                }
                arrCreate.push(updtObj)
            })
        })

        console.log(arrCreate.length);
        // let levelDetails = await Fee.insertMany(arrCreate)
        // console.log(levelDetails);
    } catch (error) {
        return error
    }
}

// (async () => {
//     await addAllFee()
// })()