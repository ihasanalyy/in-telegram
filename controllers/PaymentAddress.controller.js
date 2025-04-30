const { encryption, decryption } = require('../configurations/Encryption')
const Account = require('../models/Account.model');
const PaymentAddress = require('../models/PaymentAddress.model')
const Wallet = require('../models/Wallet.model');

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require('multer');
const { deactivateWallet } = require('./Wallet.controller');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const { getExchangeRatesToUSD } = require('../utils/helpers');
const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });

module.exports.getPaymentAddress = async (req, res) => {
    try {
        let username = req.params.username;
        if (!req.user) {
            let error = await encryption({
                status: false,
                message: "Unauthroized."
            });
            return res.status(400).send(error);
        }
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ _id: req?.user?._id });
        if (!account) {
            let error = await encryption({
                status: false,
                message: "No Account found for this username"
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(async (paymentAddress) => {
                if (paymentAddress) {
                    if (!paymentAddress.active) {

                        let ciphertext = await encryption({
                            status: true,
                            message: "Payment Address disabled from admin.",
                            // paymentAddressDetails: paymentAddress
                        });
                        return res.status(200).send(ciphertext);
                    } else {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Payment Address",
                            paymentAddressDetails: paymentAddress
                        });
                        res.status(200).send(ciphertext);
                    }
                } else {
                    let defaultWallet = await Wallet.findOne({ $and: [{ default: true }, { account: account._id }] })
                    let paObj = {
                        account: account._id,
                        status: true,
                        active: true
                    }
                    if (defaultWallet) {
                        paObj['currency'] = defaultWallet.currency.code
                    }
                    const newPaymentAddress = new PaymentAddress(paObj)
                    newPaymentAddress.save().then(async (createdPaymentAddress) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "New Payment Address with account id created successfully.",
                            paymentAddressDetails: createdPaymentAddress
                        });
                        res.status(200).send(ciphertext);
                    })
                        .catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Error creating a new Payment Address."
                            });
                            res.status(500).send(error);
                        });
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the Payment Address data"
                })
                res.status(500).send(error)
            })
        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getPaymentAddressPublic = async (req, res) => {
    try {
        let username = req.params.username;
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username }).populate("level")
        if (!account) {
            let error = await encryption({
                status: false,
                message: "No Account found for this username"
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(async (paymentAddress) => {
                if (paymentAddress) {
                    if (!paymentAddress.status || !paymentAddress.active) {
                        // let wallet;
                        let error = await encryption({
                            status: true,
                            message: "This payment address is not active",
                        });
                        res.status(404).send(error);
                    } else {
                        Wallet.find({ account: account._id }).then(async (wallets) => {
                            const selectedWallet = wallets.filter((wallet) => wallet.currency.code === paymentAddress.currency)
                            console.log({ selectedWallet }, { paymentAddress })

                            // fetching topup limits
                            let topup_min_amount;
                            let topup_max_amount;
                            if (!account?.is_external_limit) {
                                topup_min_amount = account?.level.topup_min_amount;
                                topup_max_amount = account?.level.topup_max_amount;
                            } else {
                                topup_min_amount = account?.external_limits.topup_min_amount
                                topup_max_amount = account?.external_limits.topup_max_amount
                            }

                            exchange_rate_in_usd = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', selectedWallet[0].currency.code, 1), 6)

                            topup_min_amount = formatDecimalNumbersWithLimit(exchange_rate_in_usd * topup_min_amount, 2)
                            topup_max_amount = formatDecimalNumbersWithLimit(exchange_rate_in_usd * topup_max_amount, 2)

                            let ciphertext = await encryption({
                                status: true,
                                message: "Payment Address retrieved successfully.",
                                paymentAddressDetails: paymentAddress,
                                wallet: {
                                    currency: selectedWallet[0].currency,
                                    wallet_id: selectedWallet[0].wallet_id,
                                    qrCode: selectedWallet[0]?.qrCode || null
                                },
                                limits: {
                                    topup_min_amount,
                                    topup_max_amount
                                }
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            console.log(err)
                            let error = await encryption({
                                status: true,
                                message: "Something went wrong while getting user wallet",
                            });
                            res.status(404).send(error);
                        })
                    }
                } else {
                    let error = await encryption({
                        status: true,
                        message: "Payment Address not found for this user",
                    });
                    res.status(200).send(error);
                }
            }).catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the Payment Address data"
                })
                res.status(500).send(error)
            })
        }
    }
    catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.addPaymentAddressDetails = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { title, currency, description, status } = data
        const username = req.params.username
        console.log(title, currency, description, status)

        if (!username || !title || !currency || !description || !status) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username });

        let updtObj = {
            title,
            description,
            currency,
            status
        }

        if (!account) {
            let error = await encryption({
                status: false,
                message: "No User found for this username"
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(async (paymentAddress) => {
                if (!paymentAddress) {
                    let error = await encryption({
                        status: false,
                        message: "Payment address not found for this usernanme"
                    });
                    return res.status(400).send(error);
                } else if (!paymentAddress.active) {
                    let error = await encryption({
                        status: false,
                        message: "Admin has disabled this payment address"
                    });
                    return res.status(400).send(error);
                } else {
                    PaymentAddress.findByIdAndUpdate({ _id: paymentAddress._id }, updtObj, { new: true }).then(async (updatedPaymentAddress) => {
                        let ciphertext = await encryption({
                            status: false,
                            message: "Payment address updated",
                            updatedPaymentAddress: updatedPaymentAddress
                        });
                        return res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating the payment address"
                        })
                        res.status(500).send(error)
                    })
                }
            })
                .catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting the payment address"
                    })
                    res.status(500).send(error)
                })

        }

    }
    catch (err) {

        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.addPaymentAddressProfile = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const file = req.file;
        const username = req.params.username

        if (!username || !file) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username });

        if (!account) {
            let error = await encryption({
                status: false,
                message: "No User found for this username"
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(async (paymentAddress) => {
                if (!paymentAddress) {
                    let error = await encryption({
                        status: false,
                        message: "Payment address not found for this usernanme"
                    });
                    return res.status(400).send(error);
                } else if (!paymentAddress.active) {
                    let error = await encryption({
                        status: false,
                        message: "Admin has disabled this payment address"
                    });
                    return res.status(400).send(error);
                } else {
                    let profileImage = {};
                    if (file.mimetype.split("/")[0] === "image") {
                        const bucketName = process.env.AWS_BUCKET_NAME;
                        const params = {
                            Bucket: bucketName,
                            Key: `payment_addresses/${username}/${file.originalname}`,
                            Body: file.buffer
                        };
                        s3.upload(params, async (err, file) => {
                            if (err) {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while uploading image."
                                });
                                res.status(400).send(error);
                            } else {
                                if (file?.key) {
                                    profileImage = {
                                        key: file.Key,
                                        url: file.Location,
                                        ETag: file.ETag
                                    };
                                    PaymentAddress.findByIdAndUpdate({ _id: paymentAddress._id }, { $set: { profileImage: profileImage } }, { new: true }).then(async (updatedPaymentAddress) => {
                                        let ciphertext = await encryption({
                                            status: false,
                                            message: "Payment address profile added",
                                            updatedPaymentAddress: updatedPaymentAddress
                                        });
                                        return res.status(200).send(ciphertext);
                                    }).catch(async (err) => {
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while updating the payment address"
                                        })
                                        res.status(500).send(error)
                                    })
                                }
                            }
                        })
                    }
                    else {
                        let error = await encryption({
                            status: false,
                            message: "Please provide an image!."
                        });
                        res.status(400).send(error);
                    }
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding the payment address"
                })
                res.status(500).send(error)
            })
        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.addPaymentAddressCover = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const file = req.file;
        const username = req.params.username

        if (!username || !file) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username });

        if (!account) {
            let error = await encryption({
                status: false,
                message: "No User found for this username"
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(async (paymentAddress) => {
                if (!paymentAddress) {
                    let error = await encryption({
                        status: false,
                        message: "Payment address not found for this usernanme"
                    });
                    return res.status(400).send(error);
                } else if (!paymentAddress.active) {
                    let error = await encryption({
                        status: false,
                        message: "Admin has disabled this payment address"
                    });
                    return res.status(400).send(error);
                } else {
                    let coverImage = {};
                    if (file.mimetype.split("/")[0] === "image") {
                        const bucketName = process.env.AWS_BUCKET_NAME;
                        const params = {
                            Bucket: bucketName,
                            Key: `payment_addresses/${username}/${file.originalname}`,
                            Body: file.buffer
                        };
                        s3.upload(params, async (err, file) => {
                            if (err) {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while uploading image."
                                });
                                res.status(400).send(error);
                            } else {
                                if (file?.key) {
                                    coverImage = {
                                        key: file.Key,
                                        url: file.Location,
                                        ETag: file.ETag
                                    };
                                    PaymentAddress.findByIdAndUpdate({ _id: paymentAddress._id }, { $set: { coverImage: coverImage } }, { new: true }).then(async (updatedPaymentAddress) => {
                                        let ciphertext = await encryption({
                                            status: false,
                                            message: "Payment address profile added",
                                            updatedPaymentAddress: updatedPaymentAddress
                                        });
                                        return res.status(200).send(ciphertext);
                                    }).catch(async (err) => {
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while updating the payment address"
                                        })
                                        res.status(500).send(error)
                                    })
                                }
                            }
                        })
                    }
                    else {
                        let error = await encryption({
                            status: false,
                            message: "Please provide an image!."
                        });
                        res.status(400).send(error);
                    }
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding the payment address"
                })
                res.status(500).send(error)
            })
        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.updatePaymentAddressStatusUser = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { status } = data;
        const username = req.params.username;

        if (!username || status === undefined || status === "") {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username });
        if (!account) {
            let error = await encryption({
                status: false,
                message: "No User found for this username",
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(
                async (paymentAddress) => {
                    if (!paymentAddress) {
                        let error = await encryption({
                            status: false,
                            message: "Payment address not found for this username",
                        });
                        return res.status(400).send(error);
                    } else if (!paymentAddress.active) {
                        let error = await encryption({
                            status: false,
                            message: "Admin has disabled this payment address",
                        });
                        return res.status(400).send(error);
                    } else {
                        const updatedPaymentAddress = await PaymentAddress.findByIdAndUpdate(
                            { _id: paymentAddress._id },
                            { status: status },
                            { new: true }
                        );

                        let ciphertext = await encryption({
                            status: true,
                            message: "Payment address status updated",
                            updatedPaymentAddress: updatedPaymentAddress,
                        });
                        return res.status(200).send(ciphertext);
                    }
                }
            ).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the payment address"
                })
                res.status(500).send(error)
            })
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};



module.exports.updatePaymentAddressStatus = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { status } = data
        const username = req.params.username

        if (!username || status === undefined || status === "") {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username });
        if (!account) {
            let error = await encryption({
                status: false,
                message: "No User found for this username",
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(
                async (paymentAddress) => {
                    if (!paymentAddress) {
                        let error = await encryption({
                            status: false,
                            message: "Payment address not found for this username",
                        });
                        return res.status(400).send(error);
                    } else {
                        const updatedPaymentAddress = await PaymentAddress.findByIdAndUpdate(
                            { _id: paymentAddress._id },
                            { active: status },
                            { new: true }
                        );

                        let ciphertext = await encryption({
                            status: true,
                            message: "Payment address status updated",
                            updatedPaymentAddress: updatedPaymentAddress,
                        });
                        return res.status(200).send(ciphertext);
                    }
                }
            ).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the payment address"
                })
                res.status(500).send(error)
            })
        }
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
};

module.exports.getPaymentAddressStatusAdmin = async (req, res) => {
    try {
        let username = req.params.username;
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ username: username });
        if (!account) {
            let error = await encryption({
                status: false,
                message: "No Account found for this username"
            });
            return res.status(400).send(error);
        } else {
            PaymentAddress.findOne({ account: account._id }).then(async (paymentAddress) => {
                if (paymentAddress) {

                    let ciphertext = await encryption({
                        status: true,
                        message: "Payment Address",
                        paymentAddressStatus: paymentAddress.status,
                        paymentAddressActive: paymentAddress.active
                    });
                    res.status(200).send(ciphertext);

                } else {
                    const newPaymentAddress = new PaymentAddress({
                        account: account._id
                    })
                    newPaymentAddress.save().then(async (createdPaymentAddress) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "New Payment Address with account id created successfully.",
                            paymentAddressDetails: createdPaymentAddress
                        });
                        res.status(200).send(ciphertext);
                    })
                        .catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Error creating a new Payment Address."
                            });
                            res.status(500).send(error);
                        });
                }
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the Payment Address data"
                })
                res.status(500).send(error)
            })
        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}