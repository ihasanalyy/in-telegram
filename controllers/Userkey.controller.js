const { encryption, decryption } = require('../configurations/Encryption');
const CryptoJS = require("crypto-js");
const Userkey = require('../models/UserKey.model')
const Account = require('../models/Account.model');
const PaymentUrl = require('../models/Payment-url.model')
const qr = require('qrcode');
const AWS = require('aws-sdk');
var Hashids = require('hashids');

AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();

function hasTimeExceeded(created_at, durationInMinutes) {
    const currentTime = new Date();
    const timeDifferenceInMilliseconds = currentTime - new Date(created_at);
    const durationInMilliseconds = durationInMinutes * 60 * 1000;

    return timeDifferenceInMilliseconds > durationInMilliseconds;
}

function createCode(account_id) {
    try {
        let hashids = new Hashids(account_id.toString(), 8, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890');
        let id = hashids.encode(1, 2, 3);
        return (id.toString())

    } catch (err) {
        console.log(err);
    }
}

function uploadFileToS3(base64Image, fileKey) {
    const base64Data = base64Image?.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');
    // const fileStream = fs.createReadStream(fileName);
    console.log(imageBuffer)
    const bucketName = process.env.AWS_BUCKET_NAME;
    const params = {
        Bucket: bucketName,
        Key: fileKey,
        Body: imageBuffer
    };
    return new Promise((resolve, reject) => {
        s3.upload(params, (err, data) => {
            if (err) {
                console.error('Error uploading file:', err);
                reject(err);
            } else {
                console.log('File uploaded successfully. File URL:', data);
                resolve(data);
            }
        });
    });
}

module.exports.addUserKeyData = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { webhook_url, account } = data;

        if (!webhook_url || !account) {
            let error = await encryption({
                status: false,
                message: "Required fields are empty."
            });
            return res.status(400).send(error);
        }

        const uniqueApiKey = `${account}_${Date.now()}`;
        const encryptedApiKey = CryptoJS.AES.encrypt(uniqueApiKey, "user_api_key").toString();

        let userKeyObj = { webhook_url, account, api_key: encryptedApiKey };

        Account.findOne({ $and: [{ _id: account }, { account_type: "business" }] })
            .then(async (account) => {
                if (account) {
                    Userkey.findOne({ account: account._id })
                        .then(async (userKey) => {
                            if (userKey && userKey.status === "enabled") {
                                // Proceed only if the userKey status is "enabled"
                                Userkey.findOneAndUpdate(
                                    { account: account._id },
                                    userKeyObj,
                                    { upsert: true, new: true }
                                )
                                    .then(async (userKeyCreated) => {
                                        let ciphertext = await encryption({
                                            status: true,
                                            message: "User API Key created or updated successfully.",
                                            userKey: userKeyCreated
                                        });
                                        res.status(200).send(ciphertext);
                                    })
                                    .catch(async (err) => {
                                        console.log(err);
                                        let error = await encryption({
                                            status: false,
                                            message: "Something went wrong while adding or updating the webhook."
                                        });
                                        res.status(400).send(error);
                                    });
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "User key is not enabled."
                                });
                                res.status(400).send(error);
                            }
                        })
                        .catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while checking user key status."
                            });
                            res.status(400).send(error);
                        });
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Account not found!"
                    });
                    res.status(404).send(error);
                }
            })
            .catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting account details."
                });
                res.status(400).send(error);
            });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.getUserKey = async (req, res) => {
    try {
        let account_id = req.params.account_id

        Account.findOne({ $and: [{ _id: account_id }, { account_type: "business" }] }).then((async (account) => {
            if (account) {
                const userKey = await Userkey.findOne({ account: account._id });
                if (userKey) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "API key found.",
                        userKey: userKey
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let ciphertext = await encryption({
                        status: false,
                        message: "API key not found.",
                    });
                    res.status(400).send(ciphertext);
                }
            }
            else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            }
        })).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.createOnlinePayment = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { product_name, amount, description, address, currency, account, api_key } = data;

        if (!product_name || !amount || !description || !address || !currency || !account || !api_key) {
            let error = encryption({
                status: false,
                message: "Required fields are missing",
            });
            return res.status(400).send(error);
        }
        const created_at = new Date();
        let qrCodeUrl;
        let apiKeyObj = {};
        const shortCode = createCode(api_key)

        Account.findOne({ $and: [{ _id: account }, { account_type: "business" }] }).then(async (account) => {
            if (account) {
                Userkey.findOne({ $and: [{ account: account }, { api_key: api_key }] }).then(async (userkey) => {
                    if (userkey) {
                        apiKeyObj['short_code'] = shortCode;
                        apiKeyObj['api_key'] = userkey._id;
                        apiKeyObj['account'] = account._id;
                        apiKeyObj['created_at'] = created_at;
                        apiKeyObj['product_name'] = product_name;
                        apiKeyObj['amount'] = amount;
                        apiKeyObj['description'] = description;
                        apiKeyObj['currency'] = currency;
                        apiKeyObj['address'] = address;
                        PaymentUrl.create(apiKeyObj).then(async created => {
                            if (!created) {

                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while creating payment url!"
                                });
                                return res.status(400).send(error);
                            } else {
                                apiKeyObj = {}
                                let encryptedData = await encryption(created._id);
                                let urlSafeEncryptedData = encodeURIComponent(encryptedData.data);
                                let encryptedURL = `https://www.instapay.com/online-payment/${urlSafeEncryptedData}`;
                                qr.toDataURL(encryptedURL, async (err, qrCode) => {
                                    if (err) {
                                        let error = await encryption({
                                            status: false,
                                            message: err
                                        });
                                        return res.status(400).send(error);
                                    } else {
                                        qrCodeUrl = qrCode;
                                        try {
                                            const result = await uploadFileToS3(qrCodeUrl, `qrcodes/online-payments/${api_key}.png`)
                                            if (result?.key) {
                                                apiKeyObj['url'] = encryptedURL;
                                                apiKeyObj['ETag'] = result.ETag;
                                                apiKeyObj['qr_url'] = result.Location;
                                                apiKeyObj['key'] = result.key;
                                                PaymentUrl.findByIdAndUpdate(created._id, apiKeyObj, { new: true }).then(async (updatedPaymentURL) => {
                                                    if (updatedPaymentURL) {
                                                        let ciphertext = await encryption({
                                                            status: true,
                                                            message: "Payment URL data added successfully.",
                                                            paymentUrl: updatedPaymentURL
                                                        });
                                                        res.status(200).send(ciphertext);
                                                    } else {
                                                        let ciphertext = await encryption({
                                                            status: true,
                                                            message: "Something went wrong while updating Payment URL",
                                                        });
                                                        res.status(500).send(ciphertext);
                                                    }
                                                }).catch(async (err) => {
                                                    console.log(err);
                                                    let error = await encryption({
                                                        status: false,
                                                        message: "Something went wrong while adding Payment URL data."
                                                    });
                                                    res.status(400).send(error);
                                                });

                                            } else {
                                                let error = await encryption({
                                                    status: false,
                                                    message: "Something went wrong while creating qrcode"
                                                });
                                                res.status(404).send(error);
                                            }
                                        } catch (err) {
                                            let error = await encryption({
                                                status: false,
                                                message: err
                                            });
                                            res.status(404).send(error);
                                        }
                                    }
                                })

                            }
                        }).catch(async createdError => {
                            let error = await encryption({
                                status: false,
                                message: createdError
                            });
                            return res.status(500).send(error);
                        })
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "API Key not authorized!"
                        });
                        res.status(400).send(error);
                    }

                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting userkey details."
                    });
                    res.status(400).send(error);
                });
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
}

module.exports.getOnlinePaymentData = async (req, res) => {
    try {
        const payment_url_id = req.params.payment_url_id;
        if (!payment_url_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return res.status(400).send(error);
        }
        PaymentUrl.findById(payment_url_id).then(async (paymentUrl) => {
            if (paymentUrl) {
                const createdAt = new Date(paymentUrl.created_at)
                const hasExceeded = hasTimeExceeded(createdAt, 4);
                if (hasExceeded) {
                    await PaymentUrl.findByIdAndDelete(payment_url_id);
                    let error = await encryption({
                        status: false,
                        message: "URL has been expired!"
                    });
                    return res.status(400).send(error);
                } else {

                }
                let ciphertext = await encryption({
                    status: true,
                    message: "Payment URL found",
                    paymentUrl

                });
                return res.status(200).send(ciphertext);


            } else {
                let error = await encryption({
                    status: false,
                    message: "Payment URL not found!"
                });
                res.status(400).send(error);

            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting payment url details."
            });
            res.status(400).send(error);
        });


    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!",
        });
        res.status(500).send(error);
    }
}

module.exports.updateUserkeyStatus = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { status, account } = data;

        if (!status || !account) {
            let error = await encryption({
                status: false,
                message: "Required fields are empty."
            });
            return res.status(400).send(error);
        }

        Account.findOne({ $and: [{ _id: account }, { account_type: "business" }] })
            .then(async (account) => {
                if (account) {
                    const userKeyUpdated = await Userkey.findOneAndUpdate(
                        { account: account._id },
                        { status: status },
                        { new: true }
                    );

                    let ciphertext = await encryption({
                        status: true,
                        message: "User API Key status updated.",
                        userKey: userKeyUpdated
                    });
                    res.status(200).send(ciphertext);
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Account not found!"
                    });
                    res.status(404).send(error);
                }
            })
            .catch(async (err) => {
                console.log(err)
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting account details."
                });
                res.status(400).send(error);
            });

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.requestUserkey = async (req, res) => {
    try {
        const { account_id } = req.params;

        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are empty."
            });
            return res.status(400).send(error);
        }

        const accountObj = await Account.findOne({ $and: [{ _id: account_id }, { account_type: "business" }] });

        if (!accountObj) {
            let error = await encryption({
                status: false,
                message: "Account not found!"
            });
            return res.status(404).send(error);
        }

        const existingUserKey = await Userkey.findOne({ account: account_id });

        if (existingUserKey) {
            let error = await encryption({
                status: false,
                message: "User API Key already requested for this account."
            });
            return res.status(400).send(error);
        } else {
            const newUserKey = new Userkey({
                account: accountObj._id,
                status: "requested",
            });

            const userKeyCreated = await newUserKey.save();

            let ciphertext = await encryption({
                status: true,
                message: "User API Key requested.",
                userKey: userKeyCreated,
            });
            res.status(201).send(ciphertext);
        }


    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getAccountsUserkey = async (req, res) => {
    try {
        const account_id = req.params.account_id
        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(404).send(error);
        }

        Account.findOne({ $and: [{ _id: account_id }, { account_type: "business" }] }).then(async (account) => {
            if (account) {
                Userkey.findOne({ account: account_id }).then(async (userkey) => {
                    if (userkey) {
                        let error = await encryption({
                            status: true,
                            message: "Userkey found",
                            userkey
                        })
                        res.status(200).send(error)
                    }
                    else {
                        let error = await encryption({
                            status: false,
                            message: "No userkey found!"
                        })
                        res.status(400).send(error)
                    }
                })
            }
            else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Internal server error!"
            });
            res.status(500).send(error);
        })
    }
    catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}