const Admin = require('../models/Admin.model')
const jwt = require('jsonwebtoken');
const CryptoJS = require("crypto-js");
const axios = require('axios');
const countryIso3 = require('../utils/countries_iso2.json')
const fs = require('fs');
const { promisify } = require('util');
const QrCode = require('qrcode-reader');
const Jimp = require('jimp');
const path = require('path');
const jsQR = require('jsqr');
const readFileAsync = promisify(fs.readFile);
// const sharp = require('sharp');
const { createCanvas, loadImage, registerFont } = require('canvas');
const qr = require('qrcode');
const AWS = require('aws-sdk');
const util = require('util');
const writeFileAsync = util.promisify(fs.writeFile);
const cron = require('node-cron');
const moment = require('moment-timezone');
const moment_time = require('moment');

const InstaChatbot = require('../models/InstaChatbot.model');

const multer = require('multer');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const topupTransactionDataTokenKey = "bac6723rd@#dn#aFw%%Y%VSV";
const jwtKey = process.env.jwtKey;


const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
        cb(null, true);
    } else {
        cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'File must be an image or video.'), false);
    }
};
module.exports.uploadCheck = multer({ storage: storage });
module.exports.uploadDocumentsCheck = multer({
    storage,
    limits: { fileSize: 25000000 },
    fileFilter: fileFilter
});

const generateRandomString = () => {
    return CryptoJS.lib.WordArray.random(16).toString(CryptoJS.enc.Hex);
};

async function create(dataForQRcode, center_image, width, cwidth) {
    const canvas = createCanvas(width, width);
    qr.toCanvas(
        canvas,
        dataForQRcode,
        {
            errorCorrectionLevel: "H",
            margin: 1,
            color: {
                dark: "#000000",
                light: "#ffffff",
            },
        }
    );

    const ctx = canvas.getContext("2d");
    const img = await loadImage(center_image);
    const center = (width - cwidth) / 2;
    ctx.drawImage(img, center, center, cwidth, cwidth);
    return canvas.toDataURL("image/png");
}

registerFont('./utils/fonts/Manrope-ExtraBold.ttf', { family: 'Manrope' });

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

const { addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');

const Schedule = require('../models/Schedule.model');
const Payment = require('../models/Payment.model');
const RequestPayment = require('../models/Request-Payment.model');
const Account = require('../models/Account.model');
const User = require('../models/User.model');
const Company = require('../models/Company.model');
const Wallet = require('../models/Wallet.model');
const AccountLevel = require('../models/Account-Level.model');
const Transaction = require('../models/Transaction.model');
const Fee = require('../models/Fee.model');
const Markup = require('../models/Markup.model');

const { encryption, decryption } = require('../configurations/Encryption');
const base64LogoImageData = require('../utils/logoBase64Data');
const { sendNotifications, sendMailsExport } = require('../utils/sendEmail');
const { quickReply, sendTemplate } = require('./InstaChatbot.controller');
const { limitCheck, walletToWalletTransactionHelper, sendSMSTemplate, sendMailsHelper, getTemplateId, calculateExchangeAndFees, getGeocodeData, logError, accountBalanceUsed, subscribePaymentW2WHelper, schedulePaymentW2WHelper, sendWhatsAppMessage, getActiveWallet, whatsappMessageHelper } = require('../utils/helpers');
const QuotationModel = require('../models/Quotation.model');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const { searchUsersAndWallets, getDistinctObjects, sendVideoImage } = require('../utils/instaChatbotUtils');
const { validateFiles } = require('../utils/multer');
const { subscribePaymentW2W, formattedAmount } = require('../utils/InstaChatbotHelpers');
const UserPaymentPreferenceModel = require('../models/User-Payment-Preference.model');
const { sendPhoto, sendButtons } = require('../utils/telegramBotUtils');
const TelegramBotModel = require('../models/TelegramBot.model');


module.exports.getUserWallet = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        Wallet.find({ $and: [{ account: account_id }] }).then(async (wallets) => {
            let walletList = [];
            await wallets.map((wl, i) => { let obj = { ...wl }; console.log(obj._doc); obj._doc['limit'] = 10000; walletList.push(obj._doc) })
            if (walletList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Wallet list!",
                    walletList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No wallet found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet list!"
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

module.exports.getUserInstaWallet = async (req, res) => {
    try {


        let account_id = req.params.account_id;
        Wallet.find({ $and: [{ account: account_id }, { wallet_type: 'insta' }] }).then(async (wallets) => {
            let walletList = [];
            await wallets.map((wl, i) => { let obj = { ...wl }; console.log(obj._doc); obj._doc['limit'] = 10000; walletList.push(obj._doc) })
            if (walletList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Wallet list!",
                    walletList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No wallet found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet list!"
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

module.exports.getUserCryptoWallet = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        Wallet.find({ $and: [{ account: account_id }, { wallet_type: 'crypto' }] }).then(async (wallets) => {
            let walletList = [];
            await wallets.map((wl, i) => { let obj = { ...wl }; console.log(obj._doc); obj._doc['limit'] = 10000; walletList.push(obj._doc) })
            if (walletList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Wallet list!",
                    walletList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No wallet found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet list!"
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

module.exports.getWalletByWalletId = async (req, res) => {
    try {
        let wallet_id = req.params.wallet_id;
        Wallet.findOne({ $and: [{ wallet_id: wallet_id }, { status: 'active' }] }, { balance: false }).populate([{
            path: 'account',
            select: 'user',
            populate: ([{ path: 'user', select: 'first_name last_name' }])
        }]).then(async (walletInfo) => {
            let walletDetails = JSON.parse(JSON.stringify(walletInfo));
            walletDetails['first_name'] = walletInfo.account.user?.first_name
            walletDetails['last_name'] = walletInfo.account.user?.last_name
            await delete walletDetails['account'];
            if (walletDetails) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Wallet Details!",
                    walletDetails
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet details!"
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

module.exports.getWalletDetails = async (req, res) => {
    try {
        let wallet_id = req.params.wallet_id;
        Wallet.findOne({ $and: [{ _id: wallet_id }, { status: 'active' }] }).then(async (walletDetails) => {
            if (walletDetails) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Wallet Details!",
                    walletDetails
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet details!"
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

module.exports.getWalletDetailsPublic = async (req, res) => {
    try {
        const data = await decryption(req.body.data)

        // const data = req.body
        const { wallet_id, recipientId } = data

        const accountDetails = await Account.findOne({ $or: [{ 'telegram_id': recipientId }, { 'insta_subscriber_id': recipientId }] })

        if (!accountDetails) {
            let error = await encryption({
                status: false,
                message: "Account not found!"
            })
            return res.status(404).send(error)
        }

        const walletDetails = await getActiveWallet(wallet_id);

        if (!walletDetails) {
            let error = await encryption({
                status: false,
                message: "Wallet not found!"
            })
            return res.status(404).send(error)
        }

        // validation to check if selected wallet is user's own as user can not send money to himself
        if (walletDetails.account._id.toString() === accountDetails._id.toString()) {
            let error = await encryption({
                status: false,
                message: "You can not send money to your own wallet!"
            })
            return res.status(400).send(error)
        }

        const response = {
            wallet_id: walletDetails.wallet_id,
            name: `${walletDetails.account?.first_name} ${walletDetails.account?.last_name}`,
            country: walletDetails.account?.country_name,
            profilePicture: walletDetails.account?.profileImage?.url || "",
            coverPicture: walletDetails.account?.coverImage?.url || "",
            username: walletDetails.account?.username,
            currency: {
                code: walletDetails.currency.code,
                symbol: walletDetails.currency.symbol
            }
        }

        const token = jwt.sign({ wallet_id }, process.env.jwtKey, { expiresIn: "10m" })

        response.token = token

        let ciphertext = await encryption({
            status: true,
            message: "Wallet details found successfully!",
            walletDetails: response
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

module.exports.activateWallet = async (req, res) => {
    try {
        let wallet_id = req.params.id;
        Wallet.findOne({ _id: wallet_id }).then(async (walletDetails) => {
            if (walletDetails) {
                if (walletDetails.status == 'active') {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already active!",
                        walletDetails
                    })
                    res.status(200).send(ciphertext)
                } else {
                    Wallet.findByIdAndUpdate({ _id: wallet_id }, { status: 'active' }, { new: true }).then(async (walletUpdatedDetails) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet Activated successfully.",
                            walletDetails: walletUpdatedDetails
                        })
                        res.status(200).send(ciphertext)
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating wallet status!"
                        })
                        res.status(400).send(error)
                    })
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
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

module.exports.deactivateWallet = async (req, res) => {
    try {
        let wallet_id = req.params.id;
        Wallet.findOne({ _id: wallet_id }).then(async (walletDetails) => {
            if (walletDetails) {
                if (walletDetails.status == 'inactive') {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already Inactive!",
                        walletDetails
                    })
                    res.status(200).send(ciphertext)
                } else {
                    Wallet.findByIdAndUpdate({ _id: wallet_id }, { status: 'inactive' }, { new: true }).then(async (walletUpdatedDetails) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet deactivated successfully.",
                            walletDetails: walletUpdatedDetails
                        })
                        res.status(200).send(ciphertext)
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating wallet status!"
                        })
                        res.status(400).send(error)
                    })
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
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

async function handleDefaultWallet(account_id, blockedWalletId) {
    try {
        console.log({ account_id, blockedWalletId })
        const activeWallets = await Wallet.find({
            account: account_id,
            wallet_type: "insta",
            _id: { $ne: blockedWalletId },
            $or: [{ blocked: false }, { blocked: { $exists: false } }],
            $or: [{ admin_blocked: false }, { admin_blocked: { $exists: false } }]
        })

        if (activeWallets.length > 0) {
            await Wallet.findByIdAndUpdate(activeWallets[0]._id, { default: true })
            await Wallet.findByIdAndUpdate(blockedWalletId, { default: false }, { new: true })
            return true
        } else {
            return false
        }
    } catch (err) {
        console.error("Error while setting new default wallet:", err);
        return false;
    }
}

module.exports.blockWalletByAdmin = async (req, res) => {
    try {
        let wallet_id = req.params.id;
        Wallet.findOne({ _id: wallet_id, wallet_type: "insta" }).then(async (walletDetails) => {
            if (walletDetails) {
                if (walletDetails.admin_blocked) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already blocked!",
                        walletDetails
                    })
                    res.status(400).send(ciphertext)
                } else {
                    Wallet.findByIdAndUpdate({ _id: wallet_id }, { admin_blocked: true }, { new: true }).then(async (walletUpdatedDetails) => {
                        console.log(walletUpdatedDetails)
                        // if wallet is default, then remove the current wallet from default, and find any other wallet to be set to default
                        if (walletDetails?.default) {
                            await handleDefaultWallet(walletUpdatedDetails.account._id, wallet_id)
                        }
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet blocked successfully.",
                            walletDetails: walletUpdatedDetails
                        })
                        res.status(200).send(ciphertext)
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating wallet status!"
                        })
                        res.status(400).send(error)
                    })
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
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

module.exports.unblockWalletByAdmin = async (req, res) => {
    try {
        let wallet_id = req.params.id;
        Wallet.findById(wallet_id).then(async (walletDetails) => {
            if (walletDetails) {
                if (!walletDetails.blocked) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already unblocked!",
                        walletDetails
                    });
                    res.status(200).send(ciphertext);
                } else {
                    Wallet.findByIdAndUpdate({ _id: wallet_id }, { blocked: false }, { new: true }).then(async (walletUpdatedDetails) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet unblocked successfully.",
                            walletDetails: walletUpdatedDetails
                        });
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating wallet status!"
                        });
                        res.status(400).send(error);
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
            });
            res.status(400).send(error);
        });
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.blockWalletByUser = async (req, res) => {
    try {
        let wallet_id = req.params.id;
        Wallet.findById(wallet_id).then(async (walletDetails) => {
            if (walletDetails) {
                if (walletDetails.blocked) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already blocked!",
                        walletDetails
                    });
                    res.status(200).send(ciphertext);
                } else {
                    Wallet.findByIdAndUpdate({ _id: wallet_id }, { blocked: true }, { new: true }).then(async (walletUpdatedDetails) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet blocked successfully.",
                            walletDetails: walletUpdatedDetails
                        });
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating wallet status!"
                        });
                        res.status(400).send(error);
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
            });
            res.status(400).send(error);
        });
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.unblockWalletByUser = async (req, res) => {
    try {
        let wallet_id = req.params.id;
        Wallet.findById(wallet_id).then(async (walletDetails) => {
            if (walletDetails) {
                if (!walletDetails.blocked) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already unblocked!",
                        walletDetails
                    });
                    res.status(200).send(ciphertext);
                } else if (walletDetails.admin_blocked) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Cannot unblock. Wallet is blocked by admin!",
                        walletDetails
                    });
                    res.status(400).send(ciphertext);
                } else {
                    Wallet.findByIdAndUpdate({ _id: wallet_id }, { blocked: false }, { new: true }).then(async (walletUpdatedDetails) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet unblocked successfully.",
                            walletDetails: walletUpdatedDetails
                        });
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while updating wallet status!"
                        });
                        res.status(400).send(error);
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
            });
            res.status(400).send(error);
        });
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.getExchangeRates = async (req, res) => {
    try {
        // let additional = 2;
        let fee = 0;
        let from = req.query.from;
        let to = req.query.to;
        let type = req.query.type;
        let level_id = req.query.level_id;
        let amount = req.query.amount;
        let payment_type = req.query.payment_type;
        let account_id = req.query.account_id;
        let receiver_wallet_id = req.query.receiver_wallet_id;

        if (!to || !from || !type || !level_id || !amount || !account_id || !receiver_wallet_id) {
            let error = await encryption({
                status: false,
                message: "Required field are missing!"
            })
            return res.status(404).send(error)
        }

        const account = await Account.findById(account_id).populate('level')
        const receiver = await Wallet.findById(receiver_wallet_id).populate({
            path: 'account',
            populate: { path: 'level' }
        });


        let daily_sending_limit_used = account.used_limits.daily_sending_limit || 0
        let monthly_sending_limit_used = account.used_limits.monthly_sending_limit || 0
        let yearly_sending_limit_used = account.used_limits.yearly_sending_limit || 0

        let daily_receiving_limit_used = account.used_limits.daily_receiving_limit || 0
        let monthly_receiving_limit_used = account.used_limits.monthly_receiving_limit || 0
        let yearly_receiving_limit_used = account.used_limits.yearly_receiving_limit || 0

        let daily_sending_limit = account.level.daily_sending_limit;
        let monthly_sending_limit = account.level.monthly_sending_limit;
        let yearly_sending_limit = account.level.yearly_sending_limit;

        let daily_receiving_limit = account.level.daily_receiving_limit;
        let monthly_receiving_limit = account.level.monthly_receiving_limit;
        let yearly_receiving_limit = account.level.yearly_receiving_limit;

        if (account.is_external_limit) {
            daily_sending_limit = account.external_limits.daily_sending_limit;
            monthly_sending_limit = account.external_limits.monthly_sending_limit;
            yearly_sending_limit = account.external_limits.yearly_sending_limit;

            daily_receiving_limit = account.external_limits.daily_receiving_limit;
            monthly_receiving_limit = account.external_limits.monthly_receiving_limit;
            yearly_receiving_limit = account.external_limits.yearly_receiving_limit;
        }

        let exchange_rate;

        if (payment_type !== "conversion") {
            exchange_rate = await getExchangeRatesToUSD('USD', from, 1)

        } else {
            exchange_rate = await getExchangeRatesToUSD('USD', to, 1)

        }

        daily_sending_limit_used = exchange_rate * daily_sending_limit_used
        monthly_sending_limit_used = exchange_rate * monthly_sending_limit_used
        yearly_sending_limit_used = exchange_rate * yearly_sending_limit_used

        daily_receiving_limit_used = exchange_rate * daily_receiving_limit_used
        monthly_receiving_limit_used = exchange_rate * monthly_receiving_limit_used
        yearly_receiving_limit_used = exchange_rate * yearly_receiving_limit_used

        daily_sending_limit = exchange_rate * daily_sending_limit
        monthly_sending_limit = exchange_rate * monthly_sending_limit
        yearly_sending_limit = exchange_rate * yearly_sending_limit

        daily_receiving_limit = exchange_rate * daily_receiving_limit
        monthly_receiving_limit = exchange_rate * monthly_receiving_limit
        yearly_receiving_limit = exchange_rate * yearly_receiving_limit

        // console.log(req.query);
        Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] }).then(async (feeDetails) => {
            if (feeDetails) {
                if (payment_type !== "conversion") {
                    axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
                        if (exchangeRate.data.success) {
                            console.log(from, to, amount, exchangeRate.data, feeDetails)
                            let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'

                            let feeExchange;
                            if (feeDetails.fee_type === 'flat') {
                                fee = feeDetails.flat_fee
                                // if (payment_type === 'conversion') {
                                //     feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee);
                                // } else {
                                feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee);
                                // }
                            }
                            else {
                                feeExchange = amount * (feeDetails.percentage_fee / 100)
                                console.log(feeExchange, "feeExchange")
                            }

                            let newRate = formatDecimalNumbersWithLimit(exchangeRate.data.info.rate, 6) //+ (exchangeRate.data.info.rate * (additional / 100))
                            console.log(newRate, exchangeRate.data.info.rate)

                            let rateAfterFee = formatDecimalNumbersWithLimit(amount - feeExchange)

                            let exchange_rate

                            if (from !== to) {
                                exchange_rate = formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6)
                            } else {
                                exchange_rate = newRate
                            }

                            let newExchangeAmount = rateAfterFee * exchange_rate
                            console.log(exchange_rate, "markup", feeDetails.percentage_markup, newExchangeAmount, rateAfterFee, fee, feeExchange);

                            const exchangedAmountSender = await getExchangeRatesToUSD(from, 'USD', amount)
                            const excahngedAmountRecipient = await getExchangeRatesToUSD(to, 'USD', formatDecimalNumbersWithLimit(newExchangeAmount, 3))

                            // limits checking
                            let limitCheck1 = limitCheck(parseFloat(exchangedAmountSender), account.level, account, 'sending');
                            let limitCheck2 = limitCheck(parseFloat(excahngedAmountRecipient), receiver.account.level, receiver.account, 'receiving');

                            console.log(limitCheck1, "limit check")

                            if (!limitCheck1.status) {
                                let error = await encryption({
                                    status: false,
                                    code: limitCheck1.code,

                                })
                                return res.status(400).send(error)
                            }

                            if (!limitCheck2.status) {
                                let error = await encryption({
                                    status: false,
                                    message: limitCheck2.code
                                })
                                return res.status(400).send(error)
                            }

                            let data = {
                                exchanged_rate: {
                                    value: exchange_rate,
                                    currency: to
                                },
                                fee: {
                                    value: formatDecimalNumbersWithLimit(feeExchange, 2),
                                    currency: from
                                },
                                recipient: {
                                    value: formatDecimalNumbersWithLimit(newExchangeAmount, 3),
                                    currency: to
                                },
                                total: {
                                    value: formatDecimalNumbersWithLimit(amount, 2),
                                    currency: from
                                },
                                limits_used: {
                                    daily_sending_limit_used,
                                    monthly_sending_limit_used,
                                    yearly_sending_limit_used,
                                    daily_receiving_limit_used,
                                    monthly_receiving_limit_used,
                                    yearly_receiving_limit_used
                                },
                                limits: {
                                    daily_sending_limit,
                                    monthly_sending_limit,
                                    yearly_sending_limit,
                                    daily_receiving_limit,
                                    monthly_receiving_limit,
                                    yearly_receiving_limit
                                }
                            }

                            let ciphertext = await encryption({
                                status: true,
                                message: "Exchange Rates!",
                                data
                            })
                            res.status(200).send(ciphertext)
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Exchange Rates not found!"
                            })
                            res.status(404).send(error)
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while getting Exchange Rates!"
                        })
                        res.status(400).send(error)
                    })
                } else {
                    axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
                        if (exchangeRate.data.success) {
                            console.log(from, to, amount, exchangeRate.data, feeDetails)
                            let fee_currency = feeDetails.fee_currency || 'USD'
                            let newRate = formatDecimalNumbersWithLimit(exchangeRate.data.info.rate, 6) //+ (exchangeRate.data.info.rate * (additional / 100))
                            console.log(newRate, exchangeRate.data.info.rate)

                            let feeExchange;
                            let exchange_rate

                            if (from !== to) {
                                exchange_rate = formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6)
                            } else {
                                exchange_rate = newRate
                            }

                            if (feeDetails.fee_type === 'flat') {
                                fee = feeDetails.flat_fee
                                // if (payment_type === 'conversion') {
                                //     feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee);
                                // } else {
                                feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee);
                                // }
                            }
                            else {
                                feeExchange = amount * (feeDetails.percentage_fee / 100)
                                console.log(feeExchange, "feeExchange")
                            }



                            let rateAfterFee = formatDecimalNumbersWithLimit((amount - feeExchange), 2)

                            let new_amount = amount / exchange_rate
                            new_amount = new_amount + feeExchange

                            let newExchangeAmount = rateAfterFee * exchange_rate
                            console.log(exchange_rate, "markup", feeDetails.percentage_markup, newExchangeAmount, rateAfterFee, fee, feeExchange, new_amount);

                            const exchangedAmountSender = await getExchangeRatesToUSD(from, 'USD', formatDecimalNumbersWithLimit(new_amount, 3))
                            const excahngedAmountRecipient = await getExchangeRatesToUSD(to, 'USD', amount)

                            // limits checking
                            let limitCheck1 = limitCheck(parseFloat(exchangedAmountSender), account.level, account, 'sending');
                            let limitCheck2 = limitCheck(parseFloat(excahngedAmountRecipient), receiver.account.level, receiver.account, 'receiving');

                            if (!limitCheck1.status) {
                                let error = await encryption({
                                    status: false,
                                    code: limitCheck1.code,

                                })
                                return res.status(400).send(error)
                            }

                            if (!limitCheck2.status) {
                                let error = await encryption({
                                    status: false,
                                    message: limitCheck2.code
                                })
                                return res.status(400).send(error)
                            }

                            let data = {
                                exchanged_rate: {
                                    value: exchange_rate,
                                    currency: to
                                },
                                fee: {
                                    value: formatDecimalNumbersWithLimit(feeExchange, 2),
                                    currency: from
                                },
                                recipient: {
                                    value: amount,
                                    currency: to
                                },
                                total: {
                                    value: formatDecimalNumbersWithLimit(new_amount, 3),
                                    currency: from
                                },
                                limits_used: {
                                    daily_sending_limit_used,
                                    monthly_sending_limit_used,
                                    yearly_sending_limit_used,
                                    daily_receiving_limit_used,
                                    monthly_receiving_limit_used,
                                    yearly_receiving_limit_used
                                },
                                limits: {
                                    daily_sending_limit,
                                    monthly_sending_limit,
                                    yearly_sending_limit,
                                    daily_receiving_limit,
                                    monthly_receiving_limit,
                                    yearly_receiving_limit
                                }
                            }

                            let ciphertext = await encryption({
                                status: true,
                                message: "Exchange Rates!",
                                data
                            })
                            res.status(200).send(ciphertext)
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Exchange Rates not found!"
                            })
                            res.status(404).send(error)
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while getting Exchange Rates!"
                        })
                        res.status(400).send(error)
                    })
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Fee details not found!"
                })
                res.status(400).send(error)
            }

        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting Exchange Rates!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.getPlainExchangeRates = async (req, res) => {
    try {
        let from = req.query.from;
        let to = req.query.to;
        let amount = req.query.amount;
        // make sure amount is cleared with the comas
        amount = +String(amount)?.replaceAll(",", "")


        if (!to || !from || !amount) {
            return res.status(400).json({ status: false, message: "Required fields are missing!" });
        }

        axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            .then(async (exchangeRate) => {
                if (exchangeRate.data.success) {
                    console.log(exchangeRate.data)
                    let newRate = exchangeRate.data.info.rate;
                    let exchangedAmount = newRate * amount;
                    exchangeRate.data['new_rate'] = newRate;
                    exchangeRate.data['exchanged_amount'] = exchangedAmount;

                    let ciphertext = await encryption({
                        status: true,
                        message: "Exchange Rate!",
                        exchangeRate: exchangeRate.data
                    });

                    res.status(200).send(ciphertext);
                } else {
                    res.status(404).json({ status: false, message: "Exchange Rate not found!" });
                }
            })
            .catch(async (err) => {
                console.log(err?.response?.data?.error || err);
                res.status(400).json({ status: false, message: "Something went wrong while getting Exchange Rate!" });
            });
    } catch (err) {
        console.log(err);
        res.status(500).json({ status: false, message: "Internal server error!" });
    }
};


module.exports.getExchangeRatesNew = async (req, res) => {
    try {
        let { from, to, type, level_id, amount, payment_type, account_id, receiver_wallet_id, sender_wallet_id, payment_method } = req.query;
        amount = parseFloat(amount);
        console.log({ from, to, type, level_id, amount, payment_type, account_id, receiver_wallet_id, sender_wallet_id, payment_method })

        if (!to || !from || !type || !level_id || !amount || !account_id || !receiver_wallet_id || !sender_wallet_id) {
            let error = await encryption({ status: false, message: "Required fields are missing!" });
            return res.status(404).send(error);
        }

        const account = await Account.findById(account_id).populate('level');
        const receiver = await Wallet.findById(receiver_wallet_id).populate({
            path: 'account',
            populate: { path: 'level' }
        });
        const senderWallet = await Wallet.findById(sender_wallet_id).populate({
            path: 'account',
            populate: { path: 'level' }
        })

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount, paypal, markup, feeType, original_rate, topupFee, feeToSendingRate } = await calculateExchangeAndFees(from, to, amount, type, level_id, payment_type, senderWallet, payment_method);

        let daily_sending_limit_used = account.used_limits.daily_sending_limit || 0;
        let monthly_sending_limit_used = account.used_limits.monthly_sending_limit || 0;
        let yearly_sending_limit_used = account.used_limits.yearly_sending_limit || 0;

        let daily_receiving_limit_used = receiver.account.used_limits.daily_receiving_limit || 0;
        let monthly_receiving_limit_used = receiver.account.used_limits.monthly_receiving_limit || 0;
        let yearly_receiving_limit_used = receiver.account.used_limits.yearly_receiving_limit || 0;

        let daily_sending_limit = account.level.daily_sending_limit;
        let monthly_sending_limit = account.level.monthly_sending_limit;
        let yearly_sending_limit = account.level.yearly_sending_limit;

        let daily_receiving_limit = receiver.account.level.daily_receiving_limit;
        let monthly_receiving_limit = receiver.account.level.monthly_receiving_limit;
        let yearly_receiving_limit = receiver.account.level.yearly_receiving_limit;

        if (account.is_external_limit) {
            daily_sending_limit = account.external_limits.daily_sending_limit;
            monthly_sending_limit = account.external_limits.monthly_sending_limit;
            yearly_sending_limit = account.external_limits.yearly_sending_limit;
        }

        // RATE TO FIND THE LIMITS
        exchange_rate_in_usd = await getExchangeRatesToUSD('USD', from, 1)

        daily_sending_limit_used = exchange_rate_in_usd * daily_sending_limit_used;
        monthly_sending_limit_used = exchange_rate_in_usd * monthly_sending_limit_used;
        yearly_sending_limit_used = exchange_rate_in_usd * yearly_sending_limit_used;

        daily_receiving_limit_used = exchange_rate_in_usd * daily_receiving_limit_used;
        monthly_receiving_limit_used = exchange_rate_in_usd * monthly_receiving_limit_used;
        yearly_receiving_limit_used = exchange_rate_in_usd * yearly_receiving_limit_used;

        daily_sending_limit = exchange_rate_in_usd * daily_sending_limit;
        monthly_sending_limit = exchange_rate_in_usd * monthly_sending_limit;
        yearly_sending_limit = exchange_rate_in_usd * yearly_sending_limit;

        daily_receiving_limit = exchange_rate_in_usd * daily_receiving_limit;
        monthly_receiving_limit = exchange_rate_in_usd * monthly_receiving_limit;
        yearly_receiving_limit = exchange_rate_in_usd * yearly_receiving_limit;

        const convertedSendingAmountInUSD = await getExchangeRatesToUSD(from, 'USD', totalAmountWithFee);
        const convertedReceivingAmountInUSD = await getExchangeRatesToUSD(to, 'USD', recipient_amount);

        console.log({ convertedSendingAmountInUSD, convertedReceivingAmountInUSD });

        if (type !== "conversion") {
            let limitCheck1 = limitCheck(parseFloat(convertedSendingAmountInUSD), account.level, account, 'sending');
            let limitCheck2 = limitCheck(parseFloat(convertedReceivingAmountInUSD), receiver.account.level, receiver.account, 'receiving');

            if (!limitCheck1.status || !limitCheck2.status) {
                let error = await encryption({
                    status: false,
                    code: limitCheck1.status ? limitCheck2.code : limitCheck1.code,
                });
                return res.status(400).send(error);
            }
        }

        const payload = {
            exchanged_rate: {
                value: exchange_rate,
                currency: to
            },
            fee: {
                value: fee,
                currency: from
            },
            recipient: {
                value: recipient_amount,
                currency: to
            },
            total: {
                value: totalAmountWithFee,
                currency: from
            },
            sending: {
                value: totalAmountWithFee - fee,
                currency: from
            },
            type,
            ...payment_type === "paypal" && {
                paypal
            },
            extras: {
                exchange_rate, fee, totalAmountWithFee, recipient_amount, feeType, markup, original_rate, topupFee, feeToSendingRate
            }
        };

        let token
        if (payment_type === "paypal" || payment_type === "card") {
            token = jwt.sign(payload, jwtKey, { expiresIn: "10m" });
        }

        let data = {
            ...payload,
            ...payment_type === "paypal" && { paypal, token },
            ...payment_type === "card" && { token },
            limits_used: {
                daily_sending_limit_used,
                monthly_sending_limit_used,
                yearly_sending_limit_used,
                daily_receiving_limit_used,
                monthly_receiving_limit_used,
                yearly_receiving_limit_used
            },
            limits: {
                daily_sending_limit,
                monthly_sending_limit,
                yearly_sending_limit,
                daily_receiving_limit,
                monthly_receiving_limit,
                yearly_receiving_limit
            }
        };

        console.log({ data })

        let ciphertext = await encryption({
            status: true,
            message: "Exchange Rates and Limits!",
            data
        });
        res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({ status: false, message: "Internal server error!" });
        res.status(500).send(error);
    }
};

module.exports.w2wRates = async (req, res) => {
    try {
        let { from, to, type, level_id, amount, payment_type, sender_wallet_id, payment_method, fromOrTo } = req.query;
        amount = parseFloat(amount);

        if (!to || !from || !type || !level_id || !amount || !sender_wallet_id || !fromOrTo) {
            let error = await encryption({ status: false, message: "Required fields are missing!" });
            return res.status(404).send(error);
        }

        // const account = await Account.findById(account_id).populate('level');
        // const receiver = await Wallet.findById(receiver_wallet_id).populate({
        //     path: 'account',
        //     populate: { path: 'level' }
        // });
        const senderWallet = await Wallet.findById(sender_wallet_id).populate({
            path: 'account',
            populate: { path: 'level' }
        });

        let calculatedAmount, recipientAmount;
        if (fromOrTo === "from") {
            calculatedAmount = amount;
            recipientAmount = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(from, to, amount));
        } else if (fromOrTo === "to") {
            recipientAmount = amount;
            calculatedAmount = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(to, from, amount));
        } else {
            let error = await encryption({ status: false, message: "Invalid fromOrTo value. It must be 'from' or 'to'." });
            return res.status(400).send(error);
        }

        const { exchange_rate, fee, totalAmountWithFee, recipient_amount } = await calculateExchangeAndFees(
            from, to, calculatedAmount, type, level_id, payment_type, senderWallet, payment_method
        );

        const payload = {
            exchanged_rate: {
                value: exchange_rate,
                currency: to
            },
            fee: {
                value: fee,
                currency: from
            },
            recipient: {
                value: recipient_amount,
                currency: to
            },
            total: {
                value: totalAmountWithFee,
                currency: from
            },
            sending: {
                value: calculatedAmount,
                currency: from
            },
            // type,
            // extras: {
            //     exchange_rate, fee, totalAmountWithFee
            // }
        };

        // let token;
        // if (payment_type === "paypal" || payment_type === "card") {
        //     token = jwt.sign(payload, jwtKey, { expiresIn: "10m" });
        // }

        const data = {
            ...payload,
            // ...payment_type === "paypal" && { token },
            // ...payment_type === "card" && { token },
        };

        let ciphertext = await encryption({
            status: true,
            message: "Exchange Rates and Limits!",
            data
        });
        res.status(200).send(ciphertext);

    } catch (err) {
        console.error(err);
        let error = await encryption({ status: false, message: "Internal server error!" });
        res.status(500).send(error);
    }
};


module.exports.instaWalletToWalletTransfer = async (req, res) => {

    try {
        // let data = await decryption(req.body.data);
        let data = req.body;
        data['amount'] = parseFloat(data['amount']);
        console.log(data, "instaWalletToWalletTransfer", req?.files);

        if (req?.files?.length) {

            const filesValidate = validateFiles(req?.files)
            console.log(filesValidate, "filesValidate")

            if (!filesValidate.status) {
                return res.status(400).send(await encryption({ status: false, message: filesValidate.message }))
            }
        }

        let transaction_type;

        if (data?.payment_type === 'qr_pay' || data?.payment_type === 'payment_address') {
            transaction_type = 'request'
        } else {
            transaction_type = 'instant'
        }

        data['payment_type'] = data.payment_type ? data.payment_type : 'wallet_to_wallet';
        data['transaction_type'] = transaction_type;
        files = req?.files;

        console.log(data, "data")

        const response = await walletToWalletTransactionHelper(data, req, files)
        res.status(response.status ? 200 : 400).send(await encryption(response));
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
    // try {
    //     // let data = req.body
    //     let data = await decryption(req.body.data)
    //     var { receiver_wallet_id, sender_wallet_id, purpose, amount, type, payment_type } = data

    //     let senderWallet = await Wallet.findOne({
    //         $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
    //             $or: [
    //                 { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
    //                 { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
    //                 { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
    //                 { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
    //             ]
    //         }]
    //     }).populate([
    //         {
    //             path: 'account',
    //             populate: [
    //                 { path: 'user' },
    //                 { path: 'company' },
    //                 { path: 'level' },
    //                 { path: 'insta_recipient_id' }
    //             ]
    //         },

    //     ]);
    //     let receiverWallet = await Wallet.findOne({
    //         $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
    //             $or: [
    //                 { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
    //                 { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
    //                 { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
    //                 { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
    //             ]
    //         }]
    //     }).populate([
    //         {
    //             path: 'account',
    //             populate: [
    //                 { path: 'user' },
    //                 { path: 'company' },
    //                 { path: 'level' },
    //                 { path: 'insta_recipient_id' }

    //             ]
    //         },

    //     ]);
    //     // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
    //     if (!senderWallet) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Invalid Sender!"
    //         })
    //         return res.status(400).send(error);
    //     }
    //     if (!receiverWallet) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Invalid Receiver!"
    //         })
    //         return res.status(400).send(error);
    //     }
    //     if (senderWallet.account._id.toString() != req.user._id.toString() || !senderWallet.account.active) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Invalid Sender!"
    //         })
    //         return res.status(400).send(error);
    //     }
    //     if (!receiverWallet.account.active) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Invalid Receiver!"
    //         })
    //         return res.status(400).send(error);
    //     }
    //     let senderLimit = senderWallet.account.level.transaction_amount_limit;
    //     let receiverLimit = receiverWallet.account.level.receiving_limit;
    //     if (senderWallet.account.is_external_limit) {
    //         senderLimit = senderWallet.account.transaction_amount_limit
    //     }
    //     if (receiverWallet.account.is_external_limit) {
    //         receiverLimit = senderWallet.account.receiving_limit
    //     }

    //     let limitCheck1 = limitCheck(data.amount, senderWallet.account.level, 'sending');
    //     let limitCheck2 = limitCheck(data.amount, receiverWallet.account.level, 'receiving');

    //     console.log(limitCheck1, limitCheck2)

    //     if (!limitCheck1.status) {
    //         console.log("i ranasdas")
    //         let error = await encryption({
    //             status: false,
    //             message: limitCheck1.code
    //         })
    //         return res.status(400).send(error);
    //     }
    //     if (!limitCheck2.status) {
    //         let error = await encryption({
    //             status: false,
    //             message: limitCheck2.code
    //         })
    //         return res.status(400).send(error);
    //     }
    //     let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet')
    //     // console.log(excRate);
    //     let totalAmount = amount + excRate.fee.exchange_fee;

    //     if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Insufficient balance!"
    //         })
    //         return res.status(400).send(error);
    //     }
    //     if (senderLimit < totalAmount) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Sending limit exceeded!"
    //         })
    //         return res.status(400).send(error);
    //     }
    //     if (receiverLimit < excRate.exchanged_amount) {
    //         let error = await encryption({
    //             status: false,
    //             message: "Receiver account receiving limit exceeded!"
    //         })
    //         return res.status(400).send(error);
    //     }

    //     let senderBalance = senderWallet.balance.available - (amount + excRate.fee.exchange_fee)
    //     let receiverBalance = receiverWallet.balance.available + excRate.exchanged_amount
    //     let ref = 'tr_' + Date.now().toString();
    //     let senderTransactionObj = {
    //         reference_id: ref,
    //         type: 'transfer',
    //         transaction_type: 'debit',
    //         service_type: 'wallet_to_wallet',
    //         payment_type,
    //         status: 'completed',
    //         purpose: purpose,
    //         description: 'Wallet to wallet transfer',
    //         currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
    //         amount: amount,
    //         fee: excRate.fee.exchange_fee,
    //         total: amount + excRate.fee.exchange_fee,
    //         wallet_id: senderWallet.wallet_id,
    //         wallet: senderWallet._id,
    //         account: senderWallet.account._id,
    //         sender: senderWallet.account._id,
    //         receiver: receiverWallet.account._id,
    //         current_balance: senderWallet.balance.available
    //     }
    //     let receiverTransactionObj = {
    //         reference_id: ref,
    //         type: 'transfer',
    //         transaction_type: 'credit',
    //         service_type: 'wallet_to_wallet',
    //         payment_type,
    //         status: 'completed',
    //         purpose: purpose,
    //         description: 'Wallet to wallet transfer',
    //         currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
    //         amount: excRate.exchanged_amount,
    //         fee: 0,
    //         total: excRate.exchanged_amount,
    //         wallet_id: receiverWallet.wallet_id,
    //         wallet: receiverWallet._id,
    //         account: receiverWallet.account._id,
    //         sender: senderWallet.account._id,
    //         receiver: receiverWallet.account._id,
    //         current_balance: receiverWallet.balance.available
    //     }
    //     Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
    //         if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
    //             let supdt = await Transaction.create(senderTransactionObj)
    //             if (supdt) {
    //                 Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
    //                     if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
    //                         let rupdt = await Transaction.create(receiverTransactionObj)
    //                         if (rupdt) {
    //                             // let updtr = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'completed' } })

    //                             // system notification
    //                             const notificationObj = {
    //                                 title: 'Wallet to Wallet transaction',
    //                                 desc: 'You have received a transaction!',
    //                                 type: 'wallet_to_wallet',
    //                                 status: 'unread',
    //                                 from: senderWallet.account,
    //                                 to: receiverWallet.account,
    //                                 link_id: rupdt._id,
    //                             }

    //                             const sender_name = senderWallet?.account?.user ?
    //                                 senderWallet?.account?.user?.first_name + senderWallet?.account?.user?.first_name :
    //                                 senderWallet?.account?.company?.company_name
    //                             const receiver_name = receiverWallet?.account.user ?
    //                                 receiverWallet?.account?.user?.first_name + receiverWallet?.account?.user?.first_name :
    //                                 receiverWallet?.account?.company?.company_name

    //                             // system notification
    //                             addNotification(notificationObj)

    //                             // socket 
    //                             sendPrivateMessage(receiverWallet?.account?._id, "You have received a transaction.")

    //                             const senderOptions = {
    //                                 toEmail: senderWallet?.account?.email ?? "",
    //                                 phoneNumber: senderWallet?.account?.phone ?? "",
    //                                 instaUsername: senderWallet?.account?.insta_username ?? "",
    //                                 message: `You have sent a transaction of ${formattedAmount(amount)} ${senderWallet?.currency?.code} to ${receiver_name}`,
    //                                 subject: "You have sent a transaction in your Instapay Account!",
    //                                 templateId: "d-2d5f929ed89847d693ab15621b95890f",
    //                                 phoneMessage: `Transaction sent of ${formattedAmount(amount)} ${senderWallet?.currency?.code} to ${receiver_name}`
    //                             }
    //                             const receiverOptions = {
    //                                 toEmail: receiverWallet?.account?.email ?? "",
    //                                 phoneNumber: receiverWallet?.account?.phone ?? "",
    //                                 instaUsername: receiverWallet?.account?.insta_username ?? "",
    //                                 message: `You have recieved a transaction of ${excRate.exchanged_amount}${receiverWallet?.currency?.code} from ${sender_name}`,
    //                                 subject: "You have received a transaction in your Instapay Account!",
    //                                 templateId: "d-2d5f929ed89847d693ab15621b95890f",
    //                                 phoneMessage: `Transaction recieved of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}`
    //                             }

    //                             // email, phone and push notifications
    //                             sendNotifications(senderWallet.account, 'payments', senderOptions)
    //                             sendNotifications(receiverWallet.account, 'payments', receiverOptions)

    //                             // insta chatbot notification for sender
    //                             if (senderWallet.account?.insta_bot && senderWallet.account?.insta_recipient_id) {
    //                                 console.log(senderWallet.account?.insta_bot)
    //                                 const transactionInfo = `
    //                             Reference ID: ${ref}
    //                             Currency:  ${senderWallet.currency.code}
    //                             Amount: ${senderWallet.currency.symbol}${amount}
    //                             Fee: ${excRate.fee.exchange_fee}
    //                             Receiver: ${receiver_name}
    //                                                             `
    //                                 const message = `
    //                             You have sent the amount of ${formattedAmount(amount)} to ${receiver_name}.

    //                             ${transactionInfo}
    //                                 `
    //                                 const data = {
    //                                     sender: { id: senderWallet.account?.insta_recipient_id?.recipient },
    //                                 }
    //                                 const quickReplies = [
    //                                     { content_type: "text", title: "Return to Main Menu", payload: "main_menu" },
    //                                 ]
    //                                 // await quickReply(data, message, quickReplies);
    //                             }

    //                             // insta chatbot notification for receiver
    //                             if (receiverWallet.account?.insta_bot && receiverWallet.account?.insta_recipient_id) {
    //                                 console.log(receiverWallet.account?.insta_bot)
    //                                 const transactionInfo = `
    //                             Reference ID: ${ref}
    //                             Currency:  ${receiverWallet.currency.code}
    //                             Amount: ${receiverWallet?.currency?.symbol}${excRate.exchanged_amount} 
    //                             Fee: ${excRate.fee.exchange_fee}
    //                             Sender: ${sender_name}
    //                                                             `
    //                                 const message = `
    //                             You have received the amount of ${excRate.exchanged_amount} ${receiverWallet?.currency?.code} from ${sender_name}.

    //                             ${transactionInfo}
    //                                 `
    //                                 const data = {
    //                                     sender: { id: receiverWallet.account?.insta_recipient_id?.recipient },
    //                                 }
    //                                 const quickReplies = [
    //                                     { content_type: "text", title: "Return to Main Menu", payload: "main_menu" },
    //                                 ]
    //                                 // await quickReply(data, message, quickReplies);
    //                             }

    //                             let error = await encryption({
    //                                 status: true,
    //                                 message: "Transaction successfull.",
    //                                 data: supdt
    //                             })
    //                             res.status(200).send(error);

    //                         } else {
    //                             let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
    //                             let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
    //                             let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
    //                             let error = await encryption({
    //                                 status: false,
    //                                 message: "Transaction Failed."
    //                             })
    //                             res.status(400).send(error);
    //                         }
    //                     } else {
    //                         let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
    //                         let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
    //                         let error = await encryption({
    //                             status: false,
    //                             message: "Transaction Failed."
    //                         })
    //                         res.status(400).send(error);
    //                     }
    //                 }).catch(async (err) => {
    //                     let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
    //                     let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
    //                     let error = await encryption({
    //                         status: false,
    //                         message: "Transaction Failed."
    //                     })
    //                     res.status(400).send(error);
    //                 })
    //             } else {
    //                 let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
    //                 let error = await encryption({
    //                     status: false,
    //                     message: "Transaction Failed."
    //                 })
    //                 res.status(400).send(error);
    //             }
    //         } else {
    //             // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
    //             let error = await encryption({
    //                 status: false,
    //                 message: "Transaction Failed."
    //             })
    //             res.status(200).send(error);
    //         }
    //     }).catch(async (err) => {
    //         // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
    //         let error = await encryption({
    //             status: false,
    //             message: "Transaction Failed."
    //         })
    //         res.status(400).send(error);
    //     })

    // } catch (err) {
    //     console.log(err);
    //     let error = await encryption({
    //         status: false,
    //         message: "Internal server error!"
    //     })
    //     res.status(500).send(error)
    // }
}

async function getExchangeRatesOfUSD(from, to, amount) {
    if (from == 'USD') {
        return amount;
    }
    axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
        if (exchangeRate.data.success) {
            return exchangeRate.data.result;
        } else {
            return null;
        }
    }).catch(async (err) => {
        return null;
    })
}

async function getExchangeRatesToUSD(from, to, amount) {
    try {
        if (to != from) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let rate = exchangeRate.data.result;
                // console.log(rate);
                return rate;
            } else {
                return null;
            }
        } else {
            return amount;
        }
    } catch (err) {
        // console.log(err);
        return amount;
    }
}

async function exchangeRateApi(from, to, amount, level_id, type) {
    try {
        let fee = 0;
        // let from = req.query.from;
        // let to = req.query.to;
        // let type = req.query.type;
        // let level_id = req.query.level_id;
        // let amount = req.query.amount;
        if (!to || !from || !type || !level_id || !amount) {
            return null;
        }
        console.log(from, to, amount, level_id, type);
        let feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
        if (feeDetails) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                let exchangedAmount = newRate * amount;
                exchangeRate.data['new_rate'] = newRate;
                exchangeRate.data['exchanged_amount'] = exchangedAmount;
                let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                if (feeDetails) {
                    if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                    else { fee = amount * (feeDetails.percentage_fee / 100) }
                }
                let feeExchange = await getExchangeRatesToUSD(fee_currency, from, fee)
                // console.log(feeDetails);
                exchangeRate.data['fee'] = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    fee: fee,
                    currency: from
                }
                return exchangeRate.data;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } catch (err) {
        console.log(err);
        return null;
    }
}

module.exports.instaWalletToWalletConversion = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        // data.amount = parseInt(data.amount)
        // data = await encryption(data)
        // console.log(data);
        var { receiver_wallet_id, sender_wallet_id, amount } = data

        let receiverWallet = await Wallet.findOne({
            $and: [{ _id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])

        let dataObj = {
            sender_wallet_id: sender_wallet_id,
            receiver_wallet_id: receiverWallet?.wallet_id,
            amount,
            purpose: "N/A",
            service_type: 'wallet_to_wallet',
            payment_type: 'conversion',
            link_id: "N/A",
            description: "N/A",
        }

        const files = []

        const response = await walletToWalletTransactionHelper(dataObj, req, files)
        return res.status(response.status ? 200 : 400).send(await encryption(response));

        let senderWallet = await Wallet.findOne({
            $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate([{ path: 'account', populate: (['level']) }])



        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!senderWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Sending Wallet!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiving Wallet!"
            })
            return res.status(400).send(error);
        }

        if (senderWallet.account._id.toString() != req.user._id.toString() || receiverWallet.account._id.toString() != req.user._id.toString() || !req.user.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Account!"
            })
            return res.status(400).send(error);
        }

        let excRate = await exchangeRateApi(senderWallet.currency.code, receiverWallet.currency.code, amount, senderWallet.account.level._id, 'conversion')
        // console.log(excRate);

        if (senderWallet.balance.available < (amount + excRate.fee.exchange_fee)) {
            let error = await encryption({
                status: false,
                message: "Insufficient balance!"
            })
            return res.status(400).send(error);
        }

        let senderBalance = senderWallet.balance.available - (amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + excRate.exchanged_amount
        // console.log(senderBalance);
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'debit',
            service_type: 'conversion',
            status: 'completed',
            description: 'Wallet to wallet transfer',
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            fee: excRate.fee.exchange_fee,
            total: amount + excRate.fee.exchange_fee,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available
        }
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'credit',
            service_type: 'conversion',
            status: 'completed',
            description: 'Wallet to wallet transfer',
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: excRate.exchanged_amount,
            fee: 0,
            total: excRate.exchanged_amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available
        }
        Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
            if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
                let supdt = await Transaction.create(senderTransactionObj)
                if (supdt) {
                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                            let rupdt = await Transaction.create(receiverTransactionObj)
                            if (rupdt) {
                                // let updtr = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'completed' } })
                                let error = await encryption({
                                    status: true,
                                    message: "Transaction successfull.",
                                    data: supdt
                                })
                                res.status(200).send(error);
                            } else {
                                let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                                let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                                let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
                                let error = await encryption({
                                    status: false,
                                    message: "Transaction Failed."
                                })
                                res.status(400).send(error);
                            }
                        } else {
                            let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                            let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                            let error = await encryption({
                                status: false,
                                message: "Transaction Failed."
                            })
                            res.status(400).send(error);
                        }

                    }).catch(async (err) => {
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                        let error = await encryption({
                            status: false,
                            message: "Transaction Failed."
                        })
                        res.status(400).send(error);
                    })
                } else {
                    let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                    let error = await encryption({
                        status: false,
                        message: "Transaction Failed."
                    })
                    res.status(400).send(error);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Transaction Failed."
                })
                res.status(200).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Transaction Failed."
            })
            res.status(400).send(error);
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

module.exports.instaWalletWithdrawByAdmin = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data);
        var { wallet_id, reason, amount } = data;

        let walletDetails = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])

        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!walletDetails) {
            let error = await encryption({
                status: false,
                message: "Wallet not found."
            })
            return res.status(400).send(error);
        }

        if (!walletDetails.account.active) {
            let error = await encryption({
                status: false,
                message: "Inactive Account."
            })
            return res.status(400).send(error);
        }



        if (walletDetails.balance.available < amount) {
            let error = await encryption({
                status: false,
                message: "Insufficient balance!"
            })
            return res.status(400).send(error);
        }

        let senderBalance = walletDetails.balance.available - amount

        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'debit',
            service_type: 'withdraw_by_admin',
            reason: reason,
            status: 'completed',
            description: "Withdraw by Admin",
            currency: { code: walletDetails.currency.code, symbol: walletDetails.currency.symbol },
            amount: amount,
            fee: 0,
            total: amount,
            wallet_id: walletDetails.wallet_id,
            wallet: walletDetails._id,
            account: walletDetails.account._id,
            sender: walletDetails.account._id,
            current_balance: walletDetails.balance.available
        }

        Wallet.updateOne({ _id: walletDetails._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
            if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
                let supdt = await Transaction.create(senderTransactionObj)
                if (supdt) {
                    let error = await encryption({
                        status: true,
                        message: "Transaction successfull.",
                        data: supdt
                    })
                    res.status(200).send(error);
                } else {
                    let wupdt = await Wallet.updateOne({ _id: walletDetails._id }, { $set: { "balance.available": walletDetails.balance.available } })
                    let error = await encryption({
                        status: false,
                        message: "Transaction Failed."
                    })
                    res.status(400).send(error);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Transaction Failed."
                })
                res.status(200).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Transaction Failed."
            })
            res.status(400).send(error);
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

module.exports.instaWalletDepositByAdmin = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        let { wallet_id, reason, amount } = data;

        amount = Number(amount);
        if (isNaN(amount) || amount <= 0) {
            return res.status(400).send(await encryption({ status: false, message: "Invalid amount." }));
        }

        let walletDetails = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])

        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!walletDetails) {
            let error = await encryption({
                status: false,
                message: "Wallet not found."
            })
            return res.status(400).send(error);
        }

        if (!walletDetails.account.active) {
            let error = await encryption({
                status: false,
                message: "Inactive Account."
            })
            return res.status(400).send(error);
        }


        let senderBalance = walletDetails.balance.available + amount

        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'transfer',
            transaction_type: 'credit',
            service_type: 'deposite_by_admin',
            reason: reason,
            status: 'completed',
            description: "Deposite by Admin",
            currency: { code: walletDetails.currency.code, symbol: walletDetails.currency.symbol },
            amount: amount,
            fee: 0,
            total: amount,
            wallet_id: walletDetails.wallet_id,
            wallet: walletDetails._id,
            account: walletDetails.account._id,
            sender: walletDetails.account._id,
            current_balance: walletDetails.balance.available,
            new_balance: senderBalance
        };

        // Update wallet balance and get the updated document
        let updatedWallet = await Wallet.findOneAndUpdate(
            { _id: walletDetails._id },
            { $set: { "balance.available": senderBalance } },
            { new: true }
        );

        if (!updatedWallet) {
            return res.status(400).send(await encryption({ status: false, message: "Transaction Failed." }));
        }

        let supdt = await Transaction.create(senderTransactionObj);
        if (supdt) {
            let error = await encryption({
                status: true,
                message: "Transaction successfull.",
                data: supdt
            })
            res.status(200).send(error);
        } else {
            // Rollback balance update if transaction creation fails
            await Wallet.updateOne({ _id: walletDetails._id }, { $set: { "balance.available": walletDetails.balance.available } });
            return res.status(400).send(await encryption({ status: false, message: "Transaction Failed." }));
        }
    } catch (err) {
        console.log(err);
        return res.status(500).send(await encryption({ status: false, message: "Internal server error!" }));
    }
};


module.exports.instaConversionLimitCheck = async (req, res) => {
    try {
        let data = req.body.data
        // let data = await decryption(req.body.data)

        let { from, to, amount, level_id } = data
        let fee_currency = 'USD'
        console.log(from, to, amount, level_id)
        const accountLevel = await AccountLevel.findById(level_id)
        let limit = accountLevel?.wallet_limit_conversion
        console.log(accountLevel, "accountLevel")

        const excgRates = await getExchangeRatesToUSD(from, to = 'USD', amount)

        if (excgRates < limit) {
            let error = await encryption({
                status: false,
                message: "Amount is less than the limit",
                limit_value: accountLevel?.wallet_limit_conversion
            })
            res.status(400).send(error)
        } else {
            let ciphertext = await encryption({
                status: true,
                rates: {
                    excgRates,
                    limit: accountLevel?.wallet_limit_conversion
                }
            })
            res.status(200).send(ciphertext)
        }
    }
    catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.requestPaymentW2W = async (req, res) => {
    try {

        const { amount, wallet_id, purpose, sender, receiver, description, lat, long } = req.body;

        console.log(req.body, "req.body", amount, wallet_id, purpose, sender, receiver, description)

        if (!amount || !wallet_id || !sender || !receiver || !purpose || !lat || !long) {
            let error = await encryption({
                status: false,
                message: "All fields are required!"
            })
            return res.status(400).send(error)
        }

        if (sender === receiver) {
            let error = await encryption({
                status: false,
                message: "Sender and Receiver cannot be same!"
            })
            return res.status(400).send(error)
        }

        // finding geo location
        const geoData = await getGeocodeData(lat, long)

        console.log(geoData, "geoData")

        if (!geoData.status) {
            let error = await encryption({
                status: false,
                message: "Location not found or not valid!"
            })

            return res.status(400).send(error)
        }

        if (req?.files.length) {

            const filesValidate = validateFiles(req?.files)

            if (!filesValidate.status) {
                return res.status(400).send(await encryption({ status: false, message: filesValidate.message }))
            }
        }

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company', 'insta_recipient_id'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company', 'insta_recipient_id'])
        if (!senderWallet) {
            let error = await encryption({
                status: "false",
                message: "Sender Wallet not valid!"
            })
            return res.status(400).send(error);
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);
            let error = await encryption({
                status: "false",
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }

        if (!receiverDetails) {
            let error = await encryption({
                status: "false",
                message: "Receiver not found!"
            })
            return res.status(404).send(error);
        }
        let ref = 'rq_' + Date.now().toString();

        let objReq = {
            reference_id: ref,
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id,
            lat: geoData.data.lat,
            long: geoData.data.lon,
            display_name: geoData.data.display_name,
            address: geoData.data?.address || undefined,
        }

        const newPaymentRequest = new RequestPayment(objReq)

        const bucketName = process.env.AWS_BUCKET_NAME;

        for (const file of req.files) {
            if (file.mimetype.split("/")[0] === "image") {
                const params = {
                    Bucket: bucketName,
                    Key: `payment_request/${senderWallet.account._id}/${file.originalname}`,
                    Body: file.buffer
                };

                const uploadResult = await s3.upload(params).promise();

                if (uploadResult?.key) {
                    newPaymentRequest.attachments.push({
                        key: uploadResult.Key,
                        url: uploadResult.Location,
                        ETag: uploadResult.ETag
                    });
                }
            }
            else {
                let error = await encryption({
                    status: false,
                    message: "Please provide image files",

                });
                return res.status(400).send(error);
            }
        }

        newPaymentRequest.save().then(async (request) => {
            const receiver_name = receiverDetails.user ?
                receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name :
                receiverDetails?.company?.company_name;

            const senderName = senderDetails.user ?
                senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                senderDetails?.company?.company_name;

            const subtitleMsg = `
Request ID: ${request?.reference_id}
Sender Name: ${senderName}
Amount: ${formattedAmount(amount)} ${senderWallet?.currency.code}
Country: ${senderDetails.country_name}
`
            if (receiverDetails?.insta_bot && receiverDetails?.insta_recipient_id) {
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `You've received a Payment Request from ${senderDetails.username}`,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                            subtitle: subtitleMsg,

                            buttons: [
                                {
                                    type: "postback",
                                    title: 'Accept',
                                    payload: `accept_req_pay-${request?._id}`,
                                },
                                {
                                    type: "postback",
                                    title: 'Decline',
                                    payload: `decline_req_pay-${request?._id}`,
                                },
                                {
                                    type: "web_url",
                                    title: "View profile",
                                    url: `https://my.insta-pay.ch/profile/${senderDetails?.username}`,
                                    webview_height_ratio: "full"
                                },

                            ],
                        },
                    ]
                };
                const data = {
                    sender: { id: receiverDetails?.insta_recipient_id?.recipient },
                }
                await sendTemplate(data, receiverDetails?.insta_recipient_id?.recipient, templatePayload, "4")
            }
            if (senderDetails?.insta_bot && senderDetails?.insta_recipient_id) {
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `You have sent a payment request to ${receiver_name}`,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                            subtitle: subtitleMsg,

                            buttons: [
                                {
                                    type: "postback",
                                    title: 'Main Menu',
                                    payload: "main_menu",
                                },

                            ],
                        },
                    ]
                };
                const data = {
                    sender: { id: senderDetails?.insta_recipient_id?.recipient },
                }
                await sendTemplate(data, senderDetails?.insta_recipient_id?.recipient, templatePayload, "4")
            }

            const notificationObj = {
                title: 'Payment Request',
                desc: 'You have received a payment request!',
                type: 'payment_request',
                status: 'unread',
                from: senderWallet.account,
                to: receiverDetails._id,
                link_id: request._id,
            }

            addNotification(notificationObj)
            // socket
            sendPrivateMessage(receiverDetails._id, "You have received a payment request")


            const sender_name = senderDetails?.user ?
                senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                senderDetails?.company?.company_name

            const quotationSendLanguage = 'english';
            const quotationSendtemplateName = 'Request Money(Standard Payment Request) - Sent';

            const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

            const date = new Date();
            const formattedDate = moment(date).format('YYYY-MM-DD');

            const dynamicDataSending = {
                request_id: request?.reference_id,
                sender_name: sender_name,
                date_requested: `${formattedDate}`,
                amount: `${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code}`,
                purpose_of_payment: purpose,
                sender_profile_link: `https://my.insta-pay.ch/profile/${senderWallet.account.username}`,
                sender_country: senderWallet?.account?.country_name,

            }

            console.log(dynamicDataSending)

            const senderTemplateDetails = {
                toEmail: receiverDetails?.email,
                templateId: templateIdSending,
                phoneNumber: receiverDetails?.phone,
                phoneMessage: `You have received a payment request for ${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code} from ${sender_name}`,
                dynamicData: dynamicDataSending
            }
            // email, phone and push notifications
            await sendNotifications(senderWallet.account, 'payments', senderTemplateDetails)

            // whatsapp notification
            await whatsappMessageHelper(
                receiverDetails?.phone,
                'payment_request3',
                'en',
                [
                    { parameter_name: 'username', text: senderDetails?.username },
                    { parameter_name: 'reqid', text: ref },
                    { parameter_name: 'name', text: sender_name },
                    { parameter_name: 'amount', text: formattedAmount(amount) },
                    { parameter_name: 'currency', text: senderWallet?.currency?.code },
                    { parameter_name: 'country', text: senderDetails?.country_name },
                    { parameter_name: 'address', text: geoData?.data?.display_name || "N/A" }
                ]
            );
            let ciphertext = await encryption({
                status: true,
                message: "Payment request created successfully",
                request,
            });
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Internal server error!"
            });
            res.status(500).send(error);
        })

        //         RequestPayment.create(objReq).then(async (requestDetails) => {

        //             const subtitleMsg = `
        // Amount: ${requestDetails?.currency.symbol}${requestDetails?.amount}
        // Request ID: ${requestDetails?.reference_id}
        //                         `
        //             if (receiverDetails?.insta_bot && receiverDetails?.insta_recipient_id) {
        //                 const templatePayload = {
        //                     template_type: "generic",
        //                     elements: [
        //                         {
        //                             title: `You have received a payment request from ${receiverDetails.username}`,
        //                             image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
        //                             subtitle: subtitleMsg,

        //                             buttons: [
        //                                 {
        //                                     type: "postback",
        //                                     title: 'Accept',
        //                                     payload: `accept_req_pay-${requestDetails?._id}`,
        //                                 },
        //                                 {
        //                                     type: "postback",
        //                                     title: 'Decline',
        //                                     payload: `decline_req_pay-${requestDetails?._id}`,
        //                                 },
        //                                 {
        //                                     type: "postback",
        //                                     title: 'Main Menu',
        //                                     payload: "main_menu",
        //                                 },

        //                             ],
        //                         },
        //                     ]
        //                 };
        //                 const data = {
        //                     sender: { id: receiverDetails?.insta_recipient_id?.recipient },
        //                 }
        //                 await sendTemplate(data, receiverDetails?.insta_recipient_id?.recipient, templatePayload, "4")
        //             }
        //             if (senderDetails?.insta_bot && senderDetails?.insta_recipient_id) {
        //                 const templatePayload = {
        //                     template_type: "generic",
        //                     elements: [
        //                         {
        //                             title: `You have sent a payment request to ${receiverDetails.username}`,
        //                             image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
        //                             subtitle: subtitleMsg,

        //                             buttons: [
        //                                 {
        //                                     type: "postback",
        //                                     title: 'Main Menu',
        //                                     payload: "main_menu",
        //                                 },

        //                             ],
        //                         },
        //                     ]
        //                 };
        //                 const data = {
        //                     sender: { id: senderDetails?.insta_recipient_id?.recipient },
        //                 }
        //                 await sendTemplate(data, senderDetails?.insta_recipient_id?.recipient, templatePayload, "4")
        //             }
        //             // console.log(requestDetails)
        //             // if (receiverDetails.insta_bot && receiverDetails.insta_subscriber_id) {
        //             //     console.log(senderDetails);
        //             //     let senderName = '';
        //             //     if (senderDetails.account_type == 'individual') { senderName = senderDetails.user.first_name + ' ' + senderDetails.user.last_name }
        //             //     if (senderDetails.account_type == 'business') { senderName = senderDetails.company.company_name }
        //             //     let bodyObj = {
        //             //         "subscriber_id": receiverDetails.insta_subscriber_id,
        //             //         "fields": [
        //             //             {
        //             //                 "field_id": 9786303,
        //             //                 "field_value": `${senderName} have requested a payment of ${formattedAmount(amount)} ${senderWallet.currency.code}. Please tap below to Accept or Decline.\n\nReviews:\n\n🔹️ Good to work with.\n\n🔹 All went ok.\n\n🔹 A trustworthy person.\n\n👉 View more reviews ( instapay.com/username)`
        //             //             },
        //             //             {
        //             //                 "field_id": 9786332,
        //             //                 "field_value": objReq.reference_id
        //             //             }
        //             //         ]
        //             //     }
        //             //     let flow = "content20230909122607_148625";
        //             //     manyChatMessage(receiverDetails.insta_subscriber_id, bodyObj, flow, 1)
        //             // }
        //             if (requestDetails) {

        //                 // notification
        //                 const notificationObj = {
        //                     title: 'Payment Request Notification',
        //                     desc: 'You have received a Payment Request.',
        //                     type: 'payment_request',
        //                     status: 'unread',
        //                     from: senderWallet.account._id,
        //                     to: receiverDetails._id,
        //                     link_id: requestDetails._id,
        //                 }

        //                 addNotification(notificationObj)
        //                 // socket message
        //                 sendPrivateMessage(receiverDetails._id, "You have received a Payment Request.")
        //                 console.log(senderDetails.user)
        //                 console.log(receiverDetails.user)

        //                 if (senderDetails.user && receiverDetails.user) {

        //                     const sender_name = senderDetails?.user ?
        //                         senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
        //                         senderDetails?.company?.company_name
        //                     const receiver_name = receiverDetails.user ?
        //                         receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
        //                         receiverDetails?.company?.company_name

        //                     const sendingCurrency = senderWallet?.currency?.code;

        //                     const receiverCurrency = senderWallet?.currency?.code;

        //                     const senderOptions = {
        //                         toEmail: senderDetails?.email ?? "",
        //                         phoneNumber: senderDetails?.phone ?? "",
        //                         instaUsername: senderDetails?.insta_username ?? "",
        //                         message: `Hi, you have sent a payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
        //                         subject: "You have sent a payment request!",
        //                         templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //                         phoneMessage: `You have sent a payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
        //                     }
        //                     const receiverOptions = {
        //                         toEmail: receiverDetails?.email ?? "",
        //                         phoneNumber: receiverDetails?.phone ?? "",
        //                         instaUsername: receiverDetails?.insta_username ?? "",
        //                         message: `You have received a payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`,
        //                         subject: "You have received a payment request",
        //                         templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //                         phoneMessage: `You have received a payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`
        //                     }

        //                     // email, phone and push notifications

        //                     console.log("optionstest", senderOptions, receiverOptions)

        //                     sendNotifications(senderWallet?.account?._id, 'payment_requests', senderOptions)
        //                     sendNotifications(receiverDetails?._id, 'payment_requests', receiverOptions)
        //                 }

        //                 let resp = await encryption({
        //                     status: "true",
        //                     message: "Request details.",
        //                     requestDetails
        //                 })
        //                 res.status(200).send(resp);

        //             } else {
        //                 let error = await encryption({
        //                     status: "false",
        //                     message: "No account found."
        //                 })
        //                 res.status(404).send(error);
        //             }
        //         }).catch(async (err) => {
        //             console.log(err)
        //             let error = await encryption({
        //                 status: "false",
        //                 message: "Something went wrong while getting account details"
        //             })
        //             res.status(400).send(error);
        //         })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: "false",
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getExchangeRatesForRequest = async (req, res) => {
    try {
        // let additional = 2;
        let fee = 0;
        let data = await decryption(req.body.data);
        // let data = req.body
        var { request_id, currency } = data;
        if (!request_id || !currency) {
            let error = await encryption({
                status: "false",
                message: "Required field are missing!"
            })
            return res.status(404).send(error);
        }
        let requestDetails = await RequestPayment.findOne({ reference_id: request_id })
        if (!requestDetails) {
            let error = await encryption({
                status: "false",
                message: "Request not found!"
            })
            return res.status(404).send(error);
        }
        // if (!to || !from || !type || !level_id || !amount || !wallet_id) {
        //     return res.status(404).send({
        //         status: "false",
        //         message: "Required field are missing!"
        //     })
        // }
        // console.log(req.query);
        let walletDetails = await Wallet.findOne({ $and: [{ account: requestDetails.receiver }, { "currency.code": currency.toUpperCase() }, { status: 'active' }] }).populate([{ path: 'account', select: 'level', populate: (['level']) }])
        let recieverWalletDetails = await Wallet.findOne({ $and: [{ _id: requestDetails.wallet }, { status: 'active' }] })
        let to = walletDetails.currency.code;
        let from = recieverWalletDetails.currency.code;
        let amount = requestDetails.amount;
        let level_id = walletDetails.account.level._id

        Fee.findOne({ $and: [{ service_name: 'wallet_to_wallet' }, { account_level: level_id }] }).then(async (feeDetails) => {
            if (feeDetails) {
                axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`).then(async (exchangeRate) => {
                    if (exchangeRate.data.success) {
                        let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                        let exchangedAmount = newRate * amount;
                        // exchangeRate.data['new_rate'] = newRate;
                        exchangeRate.data['exchanged_amount'] = exchangedAmount;
                        let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                        if (feeDetails) {
                            if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                            else { fee = amount * (feeDetails.percentage_fee / 100) }
                        }
                        let feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee)
                        // console.log(feeExchange);
                        exchangeRate.data['fee'] = {
                            fee_type: feeDetails?.fee_type,
                            exchange_fee: feeExchange,
                            fee: fee,
                            currency: to
                        }

                        let ciphertext = await encryption({
                            status: "true",
                            message: "Exchange Rates!",
                            insufficient_balance: (feeExchange + exchangeRate.data.result) > walletDetails?.balance.available ? true : false,
                            total: feeExchange + exchangeRate.data.result,
                            exchangeRate: exchangeRate.data,
                            walletDetails
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: "false",
                            message: "Exchange Rates not found!"
                        })
                        res.status(404).send(error)
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: "false",
                        message: "Something went wrong while getting Exchange Rates!"
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: "false",
                    message: "Fee details not found!"
                })
                res.status(400).send(error)
            }

        }).catch(async (err) => {
            let error = await encryption({
                status: "false",
                message: "Something went wrong while getting Exchange Rates!"
            })
            res.status(400).send(error)
        })
    } catch (err) {
        let error = await encryption({
            status: "false",
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

async function requestExchangeRateApi(from, to, amount, level_id, type) {
    try {
        let fee = 0;
        if (!to || !from || !type || !level_id || !amount) {
            return null;
        }
        console.log(from, to, amount, level_id, type);
        let feeDetails = await Fee.findOne({ $and: [{ service_name: type }, { account_level: level_id }] })
        if (feeDetails) {
            let exchangeRate = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${from}&to=${to}&amount=${amount}&format=1`)
            if (exchangeRate.data.success) {
                let newRate = exchangeRate.data.info.rate //+ (exchangeRate.data.info.rate * (additional / 100))
                let exchangedAmount = newRate * amount;
                exchangeRate.data['new_rate'] = newRate;
                exchangeRate.data['exchanged_amount'] = exchangedAmount;
                let fee_currency = feeDetails ? feeDetails.fee_currency : 'USD'
                if (feeDetails) {
                    if (feeDetails.fee_type == 'flat') { fee = feeDetails.flat_fee }
                    else { fee = amount * (feeDetails.percentage_fee / 100) }
                }
                let feeExchange = await getExchangeRatesToUSD(fee_currency, to, fee)
                // console.log(feeDetails);
                exchangeRate.data['fee'] = {
                    fee_type: feeDetails.fee_type,
                    exchange_fee: feeExchange,
                    fee: fee,
                    currency: to
                }
                return exchangeRate.data;
            } else {
                return null;
            }
        } else {
            return null;
        }
    } catch (err) {
        console.log(err);
        return null;
    }
}

module.exports.acceptPaymentRequest = async (req, res) => {
    try {
        // let data = await decryption(req.body.data);
        let data = req.body
        var { request_id, account_id, sender_wallet_id, purpose, payment_type } = data;

        if (!request_id || !account_id || !sender_wallet_id) {
            let error = await encryption({
                status: "false",
                message: "Required field are missing!"
            })
            return res.status(404).send(error);
        }
        let requestDetails = await RequestPayment.findOne({ $and: [{ reference_id: request_id }, { status: 'pending' }] })
        if (!requestDetails) {
            let error = await encryption({
                status: "false",
                message: "Request not found!"
            })
            return res.status(404).send(error);
        }
        let receiver_wallet_id = requestDetails.wallet_id;
        let amount = requestDetails.amount;
        let type = 'payment_request';

        let senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company', 'insta_recipient_id']) }])
        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);

        let dataObj = {
            sender_wallet_id,
            receiver_wallet_id: receiver_wallet_id,
            amount,
            purpose: purpose,
            service_type: 'wallet_to_wallet',
            payment_type: 'payment_request',
            link: requestDetails._id,
            description: requestDetails.description,
            transaction_type: "request",
            payment_method: "wallet",
            address: {
                lat: requestDetails.lat,
                long: requestDetails.long,
                address: requestDetails?.address || "",
                display_name: requestDetails.display_name,
            }
        }

        console.log(dataObj, "dataObj")

        const files = requestDetails?.attachments.map(image => ({
            key: image.key,
            url: image.url,
            ETag: image.ETag,
            status: true
        }));

        const response = await walletToWalletTransactionHelper(dataObj, req, files)
        console.log(response, "response")
        if (response.status) {
            let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } })
            return res.status(200).send(await encryption(response));
        } else {
            return res.status(400).send(await encryption(response));
        }

        if (!senderWallet) {
            let error = await encryption({
                status: "false",
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet) {
            let error = await encryption({
                status: "false",
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }
        if (!senderWallet.account.active) {
            let error = await encryption({
                status: "false",
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet.account.active) {
            let error = await encryption({
                status: "false",
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }
        let senderLimit = senderWallet.account.level.sending_limit;
        let receiverLimit = receiverWallet.account.level.receiving_limit;
        if (senderWallet.account.is_external_limit) {
            senderLimit = senderWallet.account.sending_limit
        }
        if (receiverWallet.account.is_external_limit) {
            receiverLimit = senderWallet.account.receiving_limit
        }
        let excRate = await requestExchangeRateApi(receiverWallet.currency.code, senderWallet.currency.code, amount, senderWallet.account.level._id, 'wallet_to_wallet')
        // console.log(excRate);
        let totalAmount = excRate.exchanged_amount + excRate.fee.exchange_fee;

        if (senderWallet.balance.available < (excRate.exchanged_amount + excRate.fee.exchange_fee)) {
            let error = await encryption({
                status: "false",
                message: "Insufficient balance!"
            })
            return res.status(400).send(error);
        }
        if (senderLimit < totalAmount) {
            let error = await encryption({
                status: "false",
                message: "Sending limit exceeded!"
            })
            return res.status(400).send(error);
        }
        if (receiverLimit < amount) {
            let error = await encryption({
                status: "false",
                message: "Receiver account receiving limit exceeded!"
            })
            return res.status(400).send(error);
        }

        let senderBalance = senderWallet.balance.available - (excRate.exchanged_amount + excRate.fee.exchange_fee)
        let receiverBalance = receiverWallet.balance.available + amount
        let ref = 'tr_' + Date.now().toString();
        let senderTransactionObj = {
            reference_id: ref,
            type: 'payment_request',
            transaction_type: 'debit',
            service_type: 'wallet_to_wallet',
            payment_type,
            status: 'completed',
            purpose: purpose,
            description: 'Wallet to wallet transfer',
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: excRate.exchanged_amount,
            fee: excRate.fee.exchange_fee,
            total: excRate.exchanged_amount + excRate.fee.exchange_fee,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            account: senderWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: senderWallet.balance.available
        }
        let receiverTransactionObj = {
            reference_id: ref,
            type: 'payment_request',
            transaction_type: 'credit',
            service_type: 'wallet_to_wallet',
            payment_type,
            status: 'completed',
            purpose: purpose,
            description: 'Wallet to wallet transfer',
            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
            amount: amount,
            fee: 0,
            total: amount,
            wallet_id: receiverWallet.wallet_id,
            wallet: receiverWallet._id,
            account: receiverWallet.account._id,
            sender: senderWallet.account._id,
            receiver: receiverWallet.account._id,
            current_balance: receiverWallet.balance.available
        }
        Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderBalance } }).then(async (newSenderBalance) => {
            if (newSenderBalance.acknowledged && newSenderBalance.modifiedCount == 1) {
                let supdt = await Transaction.create(senderTransactionObj)
                if (supdt) {
                    Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                        if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                            let rupdt = await Transaction.create(receiverTransactionObj)
                            if (rupdt) {
                                const subtitleMsg = `
Amount: ${requestDetails?.currency.symbol}${requestDetails?.amount}
Request ID: ${requestDetails?.reference_id}
                        `
                                if (senderWallet?.account?.insta_bot && senderWallet?.account?.insta_recipient_id) {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You have accepted a requested amount sent from ${receiverWallet?.account?.username}`,
                                                // image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                                                subtitle: subtitleMsg,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: 'Main Menu',
                                                        payload: "main_menu",
                                                    },

                                                ],
                                            },
                                        ]
                                    };
                                    const data = {
                                        sender: { id: senderWallet?.account?.insta_recipient_id?.recipient },
                                    }
                                    // await sendTemplate(data, senderWallet?.account?.insta_recipient_id?.recipient, templatePayload, "4")
                                }
                                if (receiverWallet?.account?.insta_bot && receiverWallet?.account?.insta_recipient_id) {
                                    const templatePayload = {
                                        template_type: "generic",
                                        elements: [
                                            {
                                                title: `You have received a requested amount from ${senderWallet?.account?.username}`,
                                                // image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                                                subtitle: subtitleMsg,

                                                buttons: [
                                                    {
                                                        type: "postback",
                                                        title: 'Main Menu',
                                                        payload: "main_menu",
                                                    },

                                                ],
                                            },
                                        ]
                                    };
                                    // const data = {
                                    //     sender: { id: senderDetails?.insta_recipient_id?.recipient },
                                    // }
                                    // await sendTemplate(data, senderDetails?.insta_recipient_id?.recipient, templatePayload, "4")
                                }
                                // if (receiverWallet.account.insta_subscriber_id && receiverWallet.account.insta_bot) {
                                //     let senderName = '';
                                //     if (senderWallet.account.account_type == 'individual') { senderName = senderWallet.account?.user?.first_name + ' ' + senderWallet.account?.user?.last_name }
                                //     if (senderWallet.account.account_type == 'business') { senderName = senderWallet.account?.company?.company_name }
                                //     let bodyObj = {
                                //         "subscriber_id": receiverWallet.account.insta_subscriber_id,
                                //         "fields": [
                                //             {
                                //                 "field_id": 9786304,
                                //                 "field_value": `Your payment request of ${formattedAmount(amount)} ${receiverWallet.currency.code} had been accepted by "${senderName}"`
                                //             }
                                //         ]
                                //     }
                                //     let flow = "content20230909123103_666911";
                                //     manyChatMessage(receiverWallet.account.insta_subscriber_id, bodyObj, flow, 1)
                                // }
                                let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } })

                                // notification
                                const notificationObj = {
                                    title: 'Payment Request Notification',
                                    desc: 'Payment Request accepted.',
                                    type: 'payment_request',
                                    status: 'unread',
                                    from: senderWallet.account._id,
                                    to: receiverWallet.account._id,
                                    link_id: requestDetails._id,
                                }

                                addNotification(notificationObj)
                                // socket message
                                sendPrivateMessage(receiverWallet.account._id, "Payment Request accepted.")

                                const sender_name = senderWallet?.account.user ?
                                    senderWallet?.account.user.first_name + senderWallet?.account.user.first_name :
                                    senderWallet?.account.company.company_name
                                const receiver_name = receiverWallet?.account?.user ?
                                    receiverWallet?.account?.user?.first_name + receiverWallet?.account?.user?.first_name :
                                    receiverWallet?.account?.company?.company_name

                                const senderOptions = {
                                    toEmail: senderWallet?.account?.email ?? "",
                                    phoneNumber: senderWallet?.account?.phone ?? "",
                                    instaUsername: senderWallet?.account?.insta_username ?? "",
                                    message: `You have accepted transaction of ${formattedAmount(amount)} ${senderWallet?.currency?.code} to ${receiver_name}`,
                                    subject: "You have accepted transaction in your Instapay Account!",
                                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                    phoneMessage: `Requested transaction sent of ${formattedAmount(amount)} ${senderWallet?.currency?.code} to ${receiver_name}`
                                }
                                const receiverOptions = {
                                    toEmail: receiverWallet.account?.email ?? "",
                                    phoneNumber: receiverWallet.account?.phone ?? "",
                                    instaUsername: receiverWallet.account?.insta_username ?? "",
                                    message: `You have received a requested transaction amount of ${excRate.exchanged_amount} ${receiverWallet.currency.code} from ${sender_name}`,
                                    subject: "You have received a requested transaction amount in your Instapay Account!",
                                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                                    phoneMessage: `Requested transaction recieved of ${excRate.exchanged_amount} ${receiverWallet.currency.code} from ${sender_name}`
                                }

                                // email, phone and push notifications
                                sendNotifications(senderWallet.account, 'payments', senderOptions)
                                sendNotifications(receiverWallet.account, 'payments', receiverOptions)

                                let ciphertext = await encryption({
                                    status: "true",
                                    message: "Transaction successfull.",
                                    data: supdt
                                })
                                res.status(200).send(ciphertext);

                            } else {
                                console.log("condition failed 1")
                                let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                                let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                                let wrupdt = await Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverWallet.balance.available } })
                                let error = await encryption({
                                    status: "false",
                                    message: "Transaction Failed."
                                })
                                res.status(400).send(error);
                            }
                        } else {
                            console.log("condition failed 2")
                            let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                            let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                            let error = await encryption({
                                status: "false",
                                message: "Transaction Failed."
                            })
                            res.status(400).send(error);
                        }
                    }).catch(async (err) => {
                        console.log("condition failed 3", err)
                        let srmv = await Transaction.findByIdAndRemove({ _id: supdt._id })
                        let wsupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                        let error = await encryption({
                            status: "false",
                            message: "Transaction Failed."
                        })
                        res.status(400).send(error);
                    })
                } else {
                    console.log("condition failed 4")
                    let wupdt = await Wallet.updateOne({ _id: senderWallet._id }, { $set: { "balance.available": senderWallet.balance.available } })
                    let error = await encryption({
                        status: "false",
                        message: "Transaction Failed."
                    })
                    res.status(400).send(error);
                }
            } else {
                console.log("condition failed 5")
                // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
                let error = await encryption({
                    status: "false",
                    message: "Transaction Failed."
                })
                res.status(200).send(error);
            }
        }).catch(async (err) => {
            console.log("condition failed 6", err)
            // let updt = Transaction.updateOne({ _id: supdt._id }, { $set: { status: 'failed' } })
            let error = await encryption({
                status: "false",
                message: "Transaction Failed."
            })
            res.status(400).send(error);
        })


    } catch (err) {

        let error = await encryption({
            status: "false",
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.declinePaymentRequest = async (req, res) => {
    try {
        let request_id = req.params.request_id;
        let requestDetails = await RequestPayment.findOne({ $and: [{ reference_id: request_id }, { status: 'pending' }] })
            .populate([
                { path: 'receiver', populate: (['user', 'company', 'insta_recipient_id']) },
                { path: 'sender', populate: (['user', 'company', 'insta_recipient_id']) },
                { path: 'wallet' }
            ]);
        if (!requestDetails) {
            let error = await encryption({
                status: "false",
                message: "Request not found!"
            })
            return res.status(404).send(error);
        }
        let newSenderBalance = await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'cancelled' } })

        if (requestDetails.sender.insta_subscriber_id && requestDetails.sender.insta_bot) {
            let senderName = '';
            if (requestDetails.receiver.account_type == 'individual') { senderName = requestDetails.receiver?.user?.first_name + ' ' + requestDetails.receiver?.user?.last_name }
            if (requestDetails.receiver.account_type == 'business') { senderName = requestDetails.receiver?.company?.company_name }
            // let bodyObj = {
            //     "subscriber_id": requestDetails.sender.insta_subscriber_id,
            //     "fields": [
            //         {
            //             "field_id": 9786305,
            //             "field_value": `Your payment request of ${requestDetails.amount} ${requestDetails.currency.code} had been declined by "${senderName}"`
            //         }
            //     ]
            // }
            // let flow = "content20230909123149_783385";
            // manyChatMessage(requestDetails.sender.insta_subscriber_id, bodyObj, flow, 1)
        }

        // notification
        const notificationObj = {
            title: 'Payment Request Notification',
            desc: 'Payment Request declined.',
            type: 'payment_request',
            status: 'unread',
            from: requestDetails.sender,
            to: requestDetails.receiver,
            link_id: requestDetails._id,
        }
        const notificationObjReceiver = {
            title: 'Payment Request Notification',
            desc: 'Payment Request declined.',
            type: 'payment_request',
            status: 'unread',
            from: requestDetails.receiver,
            to: requestDetails.sender,
            link_id: requestDetails._id,
        }
        addNotification(notificationObj)
        addNotification(notificationObjReceiver)

        // socket message
        sendPrivateMessage(requestDetails.receiver, "Payment Request declined.")

        if (requestDetails.sender?.user && requestDetails.receiver?.user) {

            const sender_name = requestDetails.sender?.user ?
                requestDetails.sender?.user?.first_name + " " + requestDetails.sender?.user?.last_name :
                requestDetails.sender?.company?.company_name
            const receiver_name = requestDetails.receiver?.user ?
                requestDetails.receiver?.user?.first_name + " " + requestDetails.receiver?.user?.last_name :
                requestDetails.receiver?.company?.company_name

            const sendingCurrency = requestDetails.wallet?.currency.code;

            const receiverCurrency = requestDetails.wallet?.currency.code;

            const senderOptions = {
                toEmail: requestDetails.sender?.email ?? "",
                phoneNumber: requestDetails.sender?.phone ?? "",
                instaUsername: requestDetails.sender?.insta_username ?? "",
                message: `Hi, you have declined payment request of ${requestDetails.amount} ${receiverCurrency} to ${receiver_name}`,
                subject: "You have declined a payment request!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `You have declined payment request of ${requestDetails.amount} ${receiverCurrency} to ${receiver_name}`
            }
            const receiverOptions = {
                toEmail: requestDetails.receiver?.email ?? "",
                phoneNumber: requestDetails.receiver?.phone ?? "",
                instaUsername: requestDetails.receiver?.insta_username ?? "",
                message: `Your payment request of ${requestDetails.amount} ${sendingCurrency} has been declined from ${sender_name}`,
                subject: "Your payment request has been declined!",
                templateId: "d-2d5f929ed89847d693ab15621b95890f",
                phoneMessage: `Your payment request of ${requestDetails.amount} ${sendingCurrency} has been declined from ${sender_name}`
            }

            console.log("optionstest", senderOptions, receiverOptions)

            // email, phone and push notifications

            sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
            sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
        }

        const subtitleMsg = `
Amount: ${sendingCurrency}${requestDetails?.amount}
Request ID: ${requestDetails?.reference_id}
                        `
        if (requestDetails.sender?.insta_bot && requestDetails.sender?.insta_recipient_id) {
            const templatePayload = {
                template_type: "generic",
                elements: [
                    {
                        title: `You have declined a requested payment sent from ${receiver_name}`,
                        // image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                        subtitle: subtitleMsg,

                        buttons: [
                            {
                                type: "postback",
                                title: 'Main Menu',
                                payload: "main_menu",
                            },

                        ],
                    },
                ]
            };
            const data = {
                sender: { id: requestDetails.sender?.insta_recipient_id?.recipient },
            }
            // await sendTemplate(data, requestDetails.sender?.insta_recipient_id?.recipient, templatePayload, "4")
        }
        if (requestDetails.receiver?.insta_bot && requestDetails.receiver?.insta_recipient_id) {
            const templatePayload = {
                template_type: "generic",
                elements: [
                    {
                        title: `You have received a requested amount from ${sender_name}`,
                        // image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Send%20Money.png",
                        subtitle: subtitleMsg,

                        buttons: [
                            {
                                type: "postback",
                                title: 'Main Menu',
                                payload: "main_menu",
                            },

                        ],
                    },
                ]
            };
            const data = {
                sender: { id: requestDetails.sender?.insta_recipient_id?.recipient },
            }
            // await sendTemplate(data, requestDetails.sender?.insta_recipient_id?.recipient, templatePayload, "4")
        }

        let ciphertext = await encryption({
            status: "true",
            message: "Payment request declined."
        })
        res.status(200).send(ciphertext);


    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: "false",
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.subscribeRequestPaymentW2W = async (req, res) => {
    try {

        var { amount, wallet_id, purpose, sender, receiver, date, cycles, description, timezone, lat, long } = req.body;

        if (!amount || !wallet_id || !purpose || !sender || !receiver || !date || !cycles || !lat || !long) {
            let error = await encryption({
                status: false,
                message: "All fields are required!"
            })
            return res.status(400).send(error)
        }

        if (sender === receiver) {
            let error = await encryption({
                status: false,
                message: "Sender and Receiver cannot be same!"
            })
            return res.status(400).send(error)
        }

        // finding geo location
        const geoData = await getGeocodeData(lat, long)

        if (!geoData.status) {
            let error = await encryption({
                status: false,
                message: "Location not found or not valid!"
            })

            return res.status(400).send(error)
        }

        if (req.files.length > 5) {
            let error = await encryption({
                status: false,
                message: "Your images limit is exceeded!"
            })
            return res.status(400).send(error)
        }

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])
        if (!senderWallet) {
            let error = await encryption({
                status: "false",
                message: "Sender Wallet not valid!"
            })
            return res.status(400).send(error);
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);
            let error = await encryption({
                status: "false",
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }

        if (!receiverDetails) {
            let error = await encryption({
                status: "false",
                message: "Receiver not found!"
            })
            return res.status(404).send(error);
        }

        let objReq = {
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id
        }

        // RequestPayment.create(objReq).then(async (requestDetails) => {
        //     if (requestDetails) {

        let objSch = {
            date: date,
            cycles: cycles === "unlimited" ? 12 : cycles,
            next_date: date,
            nextCycles: cycles === "unlimited" ? 12 : cycles,
            type: 'request',
            active: true,
            status: 'processing',
            recursive: true,
            account: senderWallet.account._id,
            request_payment: objReq,
            timezone,
            lat: geoData.data.lat,
            long: geoData.data.lon,
            display_name: geoData.data.display_name,
            address: geoData.data?.address || undefined,
        }

        const newSchedule = new Schedule(objSch);

        const bucketName = process.env.AWS_BUCKET_NAME;

        for (const file of req.files) {
            if (file.mimetype.split("/")[0] === "image") {
                const params = {
                    Bucket: bucketName,
                    Key: `payment_request/${senderWallet.account._id}/${file.originalname}`,
                    Body: file.buffer
                };

                const uploadResult = await s3.upload(params).promise();

                if (uploadResult?.key) {
                    newSchedule.attachments.push({
                        key: uploadResult.Key,
                        url: uploadResult.Location,
                        ETag: uploadResult.ETag
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Please provide image files",
                });
                return res.status(400).send(error);
            }
        }

        newSchedule.save().then(async (subscribtionDetails) => {
            // notification
            const notificationObj = {
                title: 'Payment Request Notification',
                desc: 'You have received a Subscribed Payment Request.',
                type: 'payment_request',
                status: 'unread',
                from: senderWallet.account._id,
                to: receiverDetails._id,
                link_id: subscribtionDetails._id,
            }

            addNotification(notificationObj)
            // socket message
            sendPrivateMessage(receiverDetails._id, "You have received a Subscribed Payment Request.")

            console.log(senderDetails.user, receiverDetails.user)

            if (senderDetails?.user && receiverDetails?.user) {

                const sender_name = senderDetails?.user ?
                    senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                    senderDetails?.company?.company_name
                const receiver_name = receiverDetails.user ?
                    receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
                    receiverDetails.company?.company_name

                const sendingCurrency = senderWallet?.currency?.code;

                const receiverCurrency = senderWallet?.currency?.code;

                const senderOptions = {
                    toEmail: senderDetails?.email ?? "",
                    phoneNumber: senderDetails?.phone ?? "",
                    instaUsername: senderDetails?.insta_username ?? "",
                    message: `Hi, you have sent a subscribed payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
                    subject: "You have sent a payment request!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have sent a subscribed payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
                }
                const receiverOptions = {
                    toEmail: receiverDetails?.email ?? "",
                    phoneNumber: receiverDetails?.phone ?? "",
                    instaUsername: receiverDetails?.insta_username ?? "",
                    message: `You have received subscribed payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`,
                    subject: "You have received a payment request!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have received subscribed payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`
                }

                console.log("optionstest", senderOptions, receiverOptions)

                // email, phone and push notifications

                sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
                // sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
            }

            let resp = await encryption({
                status: "true",
                message: "Request details.",
                subscribtionDetails
            })
            res.status(200).send(resp);

        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Internal server error!",
            })
            return res.status(500).send(error);
        })



        // Schedule.create(objSch).then(async (subscribtionDetails) => {

        //     // notification
        //     const notificationObj = {
        //         title: 'Payment Request Notification',
        //         desc: 'You have received a Subscribed Payment Request.',
        //         type: 'payment_request',
        //         status: 'unread',
        //         from: senderWallet.account._id,
        //         to: receiverDetails._id,
        //         link_id: subscribtionDetails._id,
        //     }

        //     addNotification(notificationObj)
        //     // socket message
        //     sendPrivateMessage(receiverDetails._id, "You have received a Subscribed Payment Request.")

        //     console.log(senderDetails.user, receiverDetails.user)

        //     if (senderDetails?.user && receiverDetails?.user) {

        //         const sender_name = senderDetails?.user ?
        //             senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
        //             senderDetails?.company?.company_name
        //         const receiver_name = receiverDetails.user ?
        //             receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
        //             receiverDetails.company?.company_name

        //         const sendingCurrency = senderWallet?.currency?.code;

        //         const receiverCurrency = senderWallet?.currency?.code;

        //         const senderOptions = {
        //             toEmail: senderDetails?.email ?? "",
        //             phoneNumber: senderDetails?.phone ?? "",
        //             instaUsername: senderDetails?.insta_username ?? "",
        //             message: `Hi, you have sent a subscribed payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
        //             subject: "You have sent a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have sent a subscribed payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
        //         }
        //         const receiverOptions = {
        //             toEmail: receiverDetails?.email ?? "",
        //             phoneNumber: receiverDetails?.phone ?? "",
        //             instaUsername: receiverDetails?.insta_username ?? "",
        //             message: `You have sent a subscribed payment request ${formattedAmount(amount)} ${sendingCurrency} to ${sender_name}`,
        //             subject: "You have received a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have sent a subscribed payment request ${formattedAmount(amount)} ${sendingCurrency} to ${sender_name}`
        //         }

        //         console.log("optionstest", senderOptions, receiverOptions)

        //         // email, phone and push notifications

        //         sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
        //         sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
        //     }

        //     let resp = await encryption({
        //         status: "true",
        //         message: "Request details.",
        //         subscribtionDetails
        //     })
        //     res.status(200).send(resp);
        // }).catch(async (err) => {
        //     let error = await encryption({
        //         status: "false",
        //         message: "Something went wrong while getting account details"
        //     })
        //     res.status(400).send(error);
        // })

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: "false",
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.scheduleRequestPaymentW2W = async (req, res) => {
    try {

        var { amount, wallet_id, purpose, sender, receiver, date, description, time, timezone, lat, long } = req.body;

        if (!amount || !wallet_id || !purpose || !sender || !receiver || !date || !time || !timezone || !lat || !long) {
            let error = await encryption({
                status: false,
                message: "All fields are required!"
            })
            return res.status(400).send(error)
        }

        if (sender === receiver) {
            let error = await encryption({
                status: false,
                message: "Sender and Receiver cannot be same!"
            })
            return res.status(400).send(error)
        }

        // finding geo location
        const geoData = await getGeocodeData(lat, long)

        if (!geoData.status) {
            let error = await encryption({
                status: false,
                message: "Location not found or not valid!"
            })

            return res.status(400).send(error)
        }


        if (req.files.length > 5) {
            let error = await encryption({
                status: false,
                message: "Your images limit is exceeded!"
            })
            return res.status(400).send(error)
        }

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])
        if (!senderWallet) {
            let error = await encryption({
                status: "false",
                message: "Sender Wallet not valid!"
            })
            return res.status(400).send(error);
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);
            let error = await encryption({
                status: "false",
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }

        if (!receiverDetails) {
            let error = await encryption({
                status: "false",
                message: "Receiver not found!"
            })
            return res.status(404).send(error);
        }

        let objReq = {
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id
        }

        let objSch = {
            date: date,
            time: time,
            cycles: 0,
            type: 'request',
            active: true,
            status: 'processing',
            recursive: false,
            account: senderWallet.account._id,
            request_payment: objReq,
            timezone,
            lat: geoData.data.lat,
            long: geoData.data.lon,
            display_name: geoData.data.display_name,
            address: geoData.data?.address || undefined,
        }

        const newSchedule = new Schedule(objSch);

        const bucketName = process.env.AWS_BUCKET_NAME;

        for (const file of req.files) {
            if (file.mimetype.split("/")[0] === "image") {
                const params = {
                    Bucket: bucketName,
                    Key: `payment_request/${senderWallet.account._id}/${file.originalname}`,
                    Body: file.buffer
                };

                const uploadResult = await s3.upload(params).promise();

                if (uploadResult?.key) {
                    newSchedule.attachments.push({
                        key: uploadResult.Key,
                        url: uploadResult.Location,
                        ETag: uploadResult.ETag
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Please provide image files",
                });
                return res.status(400).send(error);
            }
        }

        newSchedule.save().then(async (subscribtionDetails) => {

            // notification
            const notificationObj = {
                title: 'Payment Request Notification',
                desc: 'You have received a Scheduled Payment Request.',
                type: 'payment_request',
                status: 'unread',
                from: senderWallet.account._id,
                to: receiverDetails._id,
                link_id: subscribtionDetails._id,
            }

            addNotification(notificationObj)
            // socket message
            sendPrivateMessage(receiverDetails._id, "You have received a Scheduled Payment Request.")

            console.log(senderDetails.user, receiverDetails.user)


            if (senderDetails?.user && receiverDetails?.user) {

                const sender_name = senderDetails?.user ?
                    senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                    senderDetails?.company?.company_name
                const receiver_name = receiverDetails?.user ?
                    receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name :
                    receiverDetails?.company?.company_name

                const sendingCurrency = senderWallet?.currency?.code;

                const receiverCurrency = senderWallet?.currency?.code;

                const senderOptions = {
                    toEmail: senderDetails?.email ?? "",
                    phoneNumber: senderDetails?.phone ?? "",
                    instaUsername: senderDetails?.insta_username ?? "",
                    message: `Hi, you have sent a scheduled payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
                    subject: "You have sent a payment request!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have sent a scheduled payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
                }
                const receiverOptions = {
                    toEmail: receiverDetails?.email ?? "",
                    phoneNumber: receiverDetails?.phone ?? "",
                    instaUsername: receiverDetails?.insta_username ?? "",
                    message: `You have received a scheduled payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`,
                    subject: "You have received a payment request!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have received a scheduled payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`
                }

                console.log("optionstest", senderOptions, receiverOptions)

                // email, phone and push notifications

                sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
                // sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
            }

            let resp = await encryption({
                status: true,
                message: "Request details.",
                subscribtionDetails
            })
            res.status(200).send(resp);
        }).catch(async (err) => {
            let error = await encryption({
                status: "false",
                message: "Something went wrong while setting the schedule"
            })
            res.status(400).send(error);
        });

        // Schedule.create(objSch).then(async (subscribtionDetails) => {
        //     let resp = await encryption({
        //         status: "true",
        //         message: "Request details.",
        //         subscribtionDetails
        //     })
        //     res.status(200).send(resp);
        //     // notification
        //     const notificationObj = {
        //         title: 'Payment Request Notification',
        //         desc: 'You have received a Scheduled Payment Request.',
        //         type: 'payment_request',
        //         status: 'unread',
        //         from: senderWallet.account._id,
        //         to: receiverDetails._id,
        //         link_id: subscribtionDetails._id,
        //     }

        //     addNotification(notificationObj)
        //     // socket message
        //     sendPrivateMessage(receiverDetails._id, "You have received a Scheduled Payment Request.")

        //     console.log(senderDetails.user, receiverDetails.user)


        //     if (senderDetails?.user && receiverDetails?.user) {

        //         const sender_name = senderDetails?.user ?
        //             senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
        //             senderDetails?.company?.company_name
        //         const receiver_name = receiverDetails?.user ?
        //             receiverDetails?.user?.first_name + " " + receiverDetails?.user?.last_name :
        //             receiverDetails?.company?.company_name

        //         const sendingCurrency = senderWallet?.currency?.code;

        //         const receiverCurrency = senderWallet?.currency?.code;

        //         const senderOptions = {
        //             toEmail: senderDetails?.email ?? "",
        //             phoneNumber: senderDetails?.phone ?? "",
        //             instaUsername: senderDetails?.insta_username ?? "",
        //             message: `Hi, you have sent a scheduled payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
        //             subject: "You have sent a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have sent a scheduled payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
        //         }
        //         const receiverOptions = {
        //             toEmail: receiverDetails?.email ?? "",
        //             phoneNumber: receiverDetails?.phone ?? "",
        //             instaUsername: receiverDetails?.insta_username ?? "",
        //             message: `You have received a scheduled payment request ${formattedAmount(amount)} ${sendingCurrency} to ${sender_name}`,
        //             subject: "You have received a payment request!",
        //             templateId: "d-2d5f929ed89847d693ab15621b95890f",
        //             phoneMessage: `You have received a scheduled payment request ${formattedAmount(amount)} ${sendingCurrency} to ${sender_name}`
        //         }

        //         console.log("optionstest", senderOptions, receiverOptions)

        //         // email, phone and push notifications

        //         sendNotifications(senderWallet.account._id, 'payment_requests', senderOptions)
        //         sendNotifications(receiverDetails._id, 'payment_requests', receiverOptions)
        //     }

        // }).catch(async (err) => {
        //     let error = await encryption({
        //         status: "false",
        //         message: "Something went wrong while getting account details"
        //     })
        //     res.status(400).send(error);
        // })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: "false",
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

async function requestPayment(data) {
    try {

        let { amount, wallet_id, purpose, sender, receiver } = data;
        console.log(amount, wallet_id, purpose, sender, receiver)

        let senderWallet = await Wallet.findOne({ $and: [{ _id: wallet_id.toString() }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverDetails = await Account.findOne({ $and: [{ _id: receiver }, { active: true }] }).populate(['user', 'company'])
        let senderDetails = await Account.findOne({ $and: [{ _id: sender }, { active: true }] }).populate(['user', 'company'])

        console.log(senderWallet, "senderWallet")
        console.log(receiverDetails, "receiverDetails")
        console.log(senderDetails, "senderDetails")
        if (!senderWallet) {
            return { status: false, message: 'Request failed' };
        }
        if (!senderWallet?.account?.active || !senderDetails) {
            console.log(senderWallet.account.active, senderDetails);

            return { status: false, message: 'Request failed' };
        }

        if (!receiverDetails) {
            return { status: false, message: "Receiver not found!" };
        }
        let ref = 'rq_' + Date.now().toString();

        let objReq = {
            reference_id: ref,
            type: 'payment_request',
            service_type: 'wallet_to_wallet',
            status: 'pending',
            purpose: purpose,
            description: 'Wallet to wallet payment request.',
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount,
            wallet_id: senderWallet.wallet_id,
            wallet: senderWallet._id,
            sender: senderWallet.account._id,
            receiver: receiverDetails._id
        }

        const requestDetails = await RequestPayment.create(objReq);
        if (requestDetails) {
            const notificationObj = {
                title: 'Payment Request Notification',
                desc: 'You have received a Payment Request.',
                type: 'payment_request',
                status: 'unread',
                from: senderWallet.account._id,
                to: receiverDetails._id,
                link_id: requestDetails._id,
            }
            addNotification(notificationObj)
            // socket message
            sendPrivateMessage(receiverDetails._id, "You have received a Payment Request.")
            console.log(senderDetails.user)
            console.log(receiverDetails.user)

            if (senderDetails.user && receiverDetails.user) {

                const sender_name = senderDetails?.user ?
                    senderDetails?.user?.first_name + " " + senderDetails?.user?.last_name :
                    senderDetails?.company?.company_name
                const receiver_name = receiverDetails.user ?
                    receiverDetails.user?.first_name + " " + receiverDetails.user?.last_name :
                    receiverDetails?.company?.company_name

                const sendingCurrency = senderWallet?.currency?.code;

                const receiverCurrency = senderWallet?.currency?.code;

                const senderOptions = {
                    toEmail: senderDetails?.email ?? "",
                    phoneNumber: senderDetails?.phone ?? "",
                    instaUsername: senderDetails?.insta_username ?? "",
                    message: `Hi, you have sent a payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`,
                    subject: "You have sent a payment request!",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have sent a payment request ${formattedAmount(amount)} ${receiverCurrency} to ${receiver_name}`
                }
                const receiverOptions = {
                    toEmail: receiverDetails?.email ?? "",
                    phoneNumber: receiverDetails?.phone ?? "",
                    instaUsername: receiverDetails?.insta_username ?? "",
                    message: `You have received a payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`,
                    subject: "You have received a payment request",
                    templateId: "d-2d5f929ed89847d693ab15621b95890f",
                    phoneMessage: `You have received a payment request of ${formattedAmount(amount)} ${sendingCurrency} from ${sender_name}`
                }

                // email, phone and push notifications

                console.log("optionstest", senderOptions, receiverOptions)

                sendNotifications(senderWallet?.account?._id, 'payment_requests', senderOptions)
                sendNotifications(receiverDetails?._id, 'payment_requests', receiverOptions)

                return { status: true, message: 'success', requestDetails };
            } else {
                return { status: false, message: 'Request failed' };
            }

        }
    } catch (err) {
        console.log(err);
        return { status: false, message: 'Request failed' };

    }
}

// Function to check and execute scheduled tasks
async function checkAndExecuteScheduledTasks() {
    try {
        // const currentDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).split('/').join('-');const currentDate = moment().format('DD-MM-YYYY');
        const currentTime = moment();
        const currentDate = moment().format('DD-MM-YYYY');
        console.log(currentTime, "current time")

        const scheduledTasks = await Schedule.find({
            active: true,
            $and: [
                { status: 'wlo' },
                { date: { $lte: currentDate } }
            ]
        });
        // console.log("currentDate", currentDate)
        // const scheduledTasks = await Schedule.find({
        //     active: true,
        //     $and: [
        //         { status: 'pn' },
        //         {
        //             date: { $lte: currentDate },
        //             time: { $lte: new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }) }
        //         }
        //     ]
        // });

        // console.log('Scheduled tasks:', scheduledTasks);
        // console.log(new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[1].slice(0, 5), new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' }));
        // console.log(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).slice(0, 8), "date",)
        // console.log(scheduledTasks[0]?.date, "date", scheduledTasks[0]?.time, "time");

        const taskTime = moment.tz(`16-04-2024 11:45 AM`, 'DD-MM-YYYY hh:mm A', 'Asia/Karachi');
        console.log(taskTime, "taskTime for auckland");

        scheduledTasks.forEach(async (task) => {
            try {
                console.log(task, "task", task.timezone);
                console.log(task.date, "date", task.time, "time", task.timezone, "timezone");
                const taskTime = moment.tz(`${task.date} ${task.time}`, 'DD-MM-YYYY hh:mm A', task.timezone);
                console.log(taskTime, "taskTime");
                // Check if current time is after or equal to the scheduled time in the task's timezone
                if (currentTime.isSameOrAfter(taskTime)) {
                    console.log('Executing payment request:', task);

                    const request = task.request_payment;
                    const data = {
                        amount: request.amount,
                        wallet_id: request.wallet,
                        purpose: request.purpose ?? "",
                        sender: request.sender,
                        receiver: request.receiver
                    };

                    // const paymentRequestDetails = await requestPayment(data)
                    // if (paymentRequestDetails.status) {
                    console.log("schedule executed", task)
                    task.status = 'pn';
                    await task.save();
                    // } else {
                    //     console.log('payment request couldn\'t be sent!');
                    // }
                }
            } catch (error) {
                console.error('Error executing scheduled task:', error);
            }
        });
        // scheduledTasks.forEach(async (task) => {
        //     try {
        //         console.log('Executing payment request:', task);
        //         const request = task.request_payment;
        //         const data = {
        //             amount: request.amount,
        //             wallet_id: request.wallet,
        //             purpose: request.purpose ?? "",
        //             sender: request.sender,
        //             receiver: request.receiver
        //         }
        //         // const paymentRequestDetails = await requestPayment(data)
        //         // if (paymentRequestDetails.status) {
        //         task.status = 'wlo';
        //         await task.save();

        //         // } else {
        //         //     console.log('payment reqst couldnt be sent!')
        //         // }

        //     } catch (error) {
        //         console.error('Error executing scheduled task:', error);
        //     }
        // });
    } catch (error) {
        console.error('Error fetching and processing scheduled tasks:', error);
    }
}

async function runScheduledTasksByDate() {
    try {
        const currentDate = moment().format('DD-MM-YYYY');
        console.log(currentDate, "current date")

        const scheduledTasks = await Schedule.find({
            active: true,
            recursive: true,
            status: 'pending',
            date: currentDate,
            cycles: { $gt: 0 }
        });

        scheduledTasks.forEach(async (task) => {
            try {
                console.log('Executing payment request:', task);

                const request = task.request_payment;
                const data = {
                    amount: request.amount,
                    wallet_id: request.wallet,
                    purpose: request.purpose ?? "",
                    sender: request.sender,
                    receiver: request.receiver
                };

                // const paymentRequestDetails = await requestPayment(data)
                // if (paymentRequestDetails.status) {
                // task.status = 'wlo';
                // await task.save();

                if (task.cycles > 0) {
                    task.cycles -= 1;
                    task.cyclesDone += 1;
                    await task.save();
                }

                // Calculate next execution date
                const nextDate = moment_time(task.date, 'DD-MM-YYYY').add(1, 'months');
                const maxDaysInNextMonth = moment_time(nextDate).daysInMonth();
                const newDay = Math.min(maxDaysInNextMonth, moment_time(nextDate).date());
                const newDate = moment_time(nextDate).date(newDay).format('DD-MM-YYYY');

                console.log('Next date:', newDate);

                task.date = newDate;
                await task.save();

                // } else {
                //     console.log('payment request couldn\'t be sent!');
                // }
            } catch (error) {
                console.error('Error executing scheduled task:', error);
            }
        });
    } catch (error) {
        console.error('Error fetching and processing scheduled tasks:', error);
    }
}




// cron.schedule('*/30 * * * * *', () => {
// checkAndExecuteScheduledTasks();
// runScheduledTasksByDate()
// });


module.exports.subscribePaymentW2W = async (req, res) => {
    try {
        let data = req.body
        // let data = await decryption(req.body.data)
        console.log(data, "data")
        var { receiver_wallet_id, sender_wallet_id, purpose, amount, date, cycles, description, timezone } = data

        if (!receiver_wallet_id || !sender_wallet_id || !purpose || !amount || !date || !cycles) {
            let error = await encryption({
                status: false,
                message: "All fields are required!"
            })
            return res.status(400).send(error)
        }

        if (req.files.length > 5) {
            let error = await encryption({
                status: false,
                message: "Your images limit is exceeded!"
            })
            return res.status(400).send(error)
        }

        let senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        let receiverWallet = await Wallet.findOne({ $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])
        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!senderWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }
        if (!senderWallet.account.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet.account.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }

        // check balance
        if (senderWallet.balance.available < amount) {
            let error = await encryption({
                status: false,
                message: "Insufficient balance available to reserve."
            })
            return res.status(400).send(error);
        }

        let payObj = {
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            sender_wallet_id: senderWallet.wallet_id,
            sender_wallet: senderWallet._id,
            sender: senderWallet.account._id,
            reciever_wallet_id: receiverWallet.wallet_id,
            reciever_wallet: receiverWallet._id,
            receiver: receiverWallet.account._id,
            account: senderWallet.account._id
        }

        let objSch = {
            date: date,
            cycles: cycles === "unlimited" ? 12 : cycles,
            next_date: date,
            nextCycles: cycles === "unlimited" ? 12 : cycles,
            type: 'payment',
            active: true,
            status: 'processing',
            recursive: true,
            account: senderWallet.account._id,
            payment: payObj,
            timezone,
            reserved: true,
        }

        const newSchedule = new Schedule(objSch);

        const bucketName = process.env.AWS_BUCKET_NAME;

        for (const file of req.files) {
            if (file.mimetype.split("/")[0] === "image") {
                const params = {
                    Bucket: bucketName,
                    Key: `transaction_images/${senderWallet.account._id}/${file.originalname}`,
                    Body: file.buffer
                };

                const uploadResult = await s3.upload(params).promise();

                if (uploadResult?.key) {
                    newSchedule.attachments.push({
                        key: uploadResult.Key,
                        url: uploadResult.Location,
                        ETag: uploadResult.ETag
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Please provide image files",
                });
                return res.status(400).send(error);
            }
        }

        newSchedule.save().then(async (subscribtionDetails) => {

            // reserving the amount
            senderWallet.balance.reserved = senderWallet.balance?.reserved || 0;
            senderWallet.balance.reserved += amount
            senderWallet.balance.available -= amount
            await senderWallet.save()


            // notification
            const notificationObj = {
                title: 'Wallet to Wallet transaction',
                desc: 'You have received a subscribed transaction!',
                type: 'wallet_to_wallet',
                status: 'unread',
                from: senderWallet.account,
                to: receiverWallet.account,
                link_id: subscribtionDetails._id,
            }

            addNotification(notificationObj)
            // socket
            sendPrivateMessage(receiverWallet.account._id, "You have received a subscribed transaction.")

            const sender_name = senderWallet.account?.user ?
                senderWallet.account?.user?.first_name + " " + senderWallet.account?.user?.last_name :
                senderWallet.account?.company?.company_name
            const receiver_name = receiverWallet?.account?.user ?
                receiverWallet?.account?.user?.first_name + " " + receiverWallet?.account?.user?.last_name :
                receiverWallet?.account?.company?.company_name

            const quotationSendLanguage = 'english';
            const quotationSendtemplateName = 'Wallet to Wallet Transfer (Subscription Transfer)';

            const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

            const dynamicDataSending = {
                transaction_id: "N/A",
                reciever_name: sender_name,
                start_date: `${date}`,
                end_date: `${date}`,
                frequency: `${cycles} months`,
                amount: `${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code}`,
                purpose_of_payment: purpose,
            }

            const senderDetails = {
                toEmail: senderWallet?.account?.email,
                templateId: templateIdSending,
                phoneNumber: senderWallet?.account?.phone,
                phoneMessage: `You have subscribed a payment of ${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code} on ${date} for ${cycles} months.`,
                dynamicData: dynamicDataSending
            }
            // email, phone and push notifications
            await sendNotifications(senderWallet.account, 'payments', senderDetails)

            let resp = await encryption({
                status: "true",
                message: "Payment details.",
                subscribtionDetails
            })
            res.status(200).send(resp);

        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: "false",
                message: "Something went wrong while getting account details"
            })
            res.status(400).send(error);
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

module.exports.schedulePaymentW2W = async (req, res) => {
    try {
        let data = req.body
        // let data = await decryption(req.body.data)
        var { receiver_wallet_id, sender_wallet_id, purpose, amount, date, time, description, timezone } = data

        if (!receiver_wallet_id || !sender_wallet_id || !purpose || !amount || !date || !time) {
            let error = await encryption({
                status: false,
                message: "All fields are required!"
            })
            return res.status(400).send(error)
        }

        if (req.files.length > 5) {
            let error = await encryption({
                status: false,
                message: "Your images limit is exceeded!"
            })
            return res.status(400).send(error)
        }

        let senderWallet = await Wallet.findOne({ $and: [{ _id: sender_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        let receiverWallet = await Wallet.findOne({ $and: [{ wallet_id: receiver_wallet_id }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        // console.log(senderWallet.account._id, req.user._id, senderWallet.account.active);
        if (!senderWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }
        if (!senderWallet.account.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Sender!"
            })
            return res.status(400).send(error);
        }
        if (!receiverWallet.account.active) {
            let error = await encryption({
                status: false,
                message: "Invalid Receiver!"
            })
            return res.status(400).send(error);
        }

        // check balance
        if (senderWallet.balance.available < amount) {
            let error = await encryption({
                status: false,
                message: "Insufficient balance available to reserve."
            })
            return res.status(400).send(error);
        }

        let payObj = {
            purpose: purpose,
            description,
            currency: { code: senderWallet.currency.code, symbol: senderWallet.currency.symbol },
            amount: amount,
            sender_wallet_id: senderWallet.wallet_id,
            sender_wallet: senderWallet._id,
            sender: senderWallet.account._id,
            reciever_wallet_id: receiverWallet.wallet_id,
            reciever_wallet: receiverWallet._id,
            receiver: receiverWallet.account._id,
            account: senderWallet.account._id
        }

        let objSch = {
            date: date,
            time: time,
            type: 'payment',
            active: true,
            status: 'processing',
            recursive: false,
            account: senderWallet.account._id,
            payment: payObj,
            timezone,
            reserved: true
        }

        const newSchedule = new Schedule(objSch);

        const bucketName = process.env.AWS_BUCKET_NAME;

        for (const file of req.files) {
            if (file.mimetype.split("/")[0] === "image") {
                const params = {
                    Bucket: bucketName,
                    Key: `transaction_images/${senderWallet.account._id}/${file.originalname}`,
                    Body: file.buffer
                };

                const uploadResult = await s3.upload(params).promise();

                if (uploadResult?.key) {
                    newSchedule.attachments.push({
                        key: uploadResult.Key,
                        url: uploadResult.Location,
                        ETag: uploadResult.ETag
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Please provide image files",
                });
                return res.status(400).send(error);
            }
        }

        newSchedule.save().then(async (subscribtionDetails) => {

            senderWallet.balance.reserved = senderWallet.balance?.reserved || 0;
            senderWallet.balance.reserved += amount
            senderWallet.balance.available -= amount
            await senderWallet.save()

            // notification
            const notificationObj = {
                title: 'Wallet to Wallet transaction',
                desc: 'You have received a scheduled transaction!',
                type: 'wallet_to_wallet',
                status: 'unread',
                from: senderWallet.account,
                to: receiverWallet.account,
                link_id: subscribtionDetails._id,
            }

            addNotification(notificationObj)
            // socket
            sendPrivateMessage(receiverWallet.account._id, "You have received a scheduled transaction.")


            const sender_name = senderWallet.account?.user ?
                senderWallet.account?.user?.first_name + " " + senderWallet.account?.user?.last_name :
                senderWallet.account?.company?.company_name
            const receiver_name = receiverWallet?.account?.user ?
                receiverWallet?.account?.user?.first_name + " " + receiverWallet?.account?.user?.last_name :
                receiverWallet?.account?.company?.company_name

            const quotationSendLanguage = 'english';
            const quotationSendtemplateName = 'Wallet to Wallet Transfer (Scheduled Payment) Sender';

            const templateIdSending = getTemplateId(quotationSendLanguage, quotationSendtemplateName);

            const dynamicDataSending = {
                transaction_id: "N/A",
                reciever_name: sender_name,
                scheduled_date: `${date} ${time}`,
                amount: `${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code}`,
                purpose_of_payment: purpose,
            }

            // const formattedDate = new Date(time);
            // const options = { hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: true }
            // const newTime = formattedDate.toLocaleTimeString('en-US', options);

            const senderDetails = {
                toEmail: senderWallet?.account?.email,
                templateId: templateIdSending,
                phoneNumber: senderWallet?.account?.phone,
                phoneMessage: `You have scheduled a transfer of ${formattedAmount(formatDecimalNumbersWithLimit(amount))} ${senderWallet?.currency?.code} on ${date} ${time}.`,
                dynamicData: dynamicDataSending
            }
            // email, phone and push notifications
            await sendNotifications(senderWallet.account, 'payments', senderDetails)

            let resp = await encryption({
                status: "true",
                message: "Payment details.",
                subscribtionDetails
            })
            res.status(200).send(resp);


        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: "false",
                message: "Something went wrong while getting account details"
            })
            res.status(400).send(error);
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

module.exports.getSubscribeRequestW2W = async (req, res) => {
    let account_id = req.params.account_id
    try {
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                Schedule.find({ $and: [{ account: account_id }, { recursive: true, type: 'request' }] }).populate(["request_payment.sender", "request_payment.receiver"]).then(async (data) => {
                    if (data.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet to wallet schedule payments.",
                            data
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No record found."
                        })
                        res.status(400).send(error)
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding records."
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
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

module.exports.getScheduleRequestW2W = async (req, res) => {
    let account_id = req.params.account_id
    try {
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                Schedule.find({ $and: [{ account: account_id }, { recursive: false, type: 'request' }] }).populate(["request_payment.sender", "request_payment.receiver"]).then(async (data) => {
                    if (data.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet to wallet schedule payments.",
                            data
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No record found."
                        })
                        res.status(400).send(error)
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding records."
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
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

module.exports.getSubscribePaymentW2W = async (req, res) => {
    let account_id = req.params.account_id
    try {
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                Schedule.find({ $and: [{ account: account_id }, { recursive: true, type: 'payment' }] }).populate(["payment.sender", "payment.receiver"]).then(async (data) => {
                    if (data.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet to wallet schedule payments.",
                            data
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No record found."
                        })
                        res.status(400).send(error)
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding records."
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
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

module.exports.getSchedulePaymentW2W = async (req, res) => {
    let account_id = req.params.account_id
    try {
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                Schedule.find({ $and: [{ account: account_id }, { recursive: false, type: 'payment' }] }).populate(["payment.sender", "payment.receiver"]).then(async (data) => {
                    if (data.length) {
                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet to wallet schedule payments.",
                            data
                        })
                        res.status(200).send(ciphertext)
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "No record found."
                        })
                        res.status(400).send(error)
                    }
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding records."
                    })
                    res.status(400).send(error)
                })
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
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


// module.exports.getWalletQRCode = async (req, res) => {
//     try {
//         let wallet_id = req.params.wallet_id;
//         let { title, description, status } = req.body.data;
//         Wallet.findOne({ $and: [{ wallet_id: wallet_id }, { status: 'active' }] }, { balance: false }).then(async (walletInfo) => {

//             if (walletInfo) {
//                 if (walletInfo?.qrCode?.key) {
//                     let ciphertext = await encryption({
//                         status: true,
//                         message: "Wallet Qrcode already exists!",

//                     });
//                     return res.status(400).send(ciphertext);
//                 }
//                 const randomString = generateRandomString(wallet_id);
//                 const uniqueString = crypto.SHA256(randomString).toString(crypto.enc.Hex);
//                 const walletUrl = `https://wa-one.com/currencies/${uniqueString}`;

//                 let qrCodeUrl;
//                 qr.toDataURL(walletUrl, async (err, qrCode) => {
//                     if (err) {
//                         console.log(err);
//                     } else {
//                         qrCodeUrl = qrCode;
//                         try {
//                             const result = await uploadFileToS3(qrCodeUrl, `qrcodes/${wallet_id}/${wallet_id}.png`);
//                             if (result?.key) {
//                                 walletInfo.qrCode = {
//                                     key: result.key,
//                                     url: result.Location,
//                                     ETag: result.ETag
//                                 };
//                                 await walletInfo.save()

//                                 let ciphertext = await encryption({
//                                     status: true,
//                                     message: "Wallet Qrcode added!",
//                                     walletUrl: `https://wa-one.com/currencies/${uniqueString}`,
//                                     walletInfo,
//                                 });
//                                 res.status(200).send(ciphertext);
//                             }
//                             else {
//                                 let error = await encryption({
//                                     status: false,
//                                     message: "Something went wrong while generating QR Code"
//                                 });
//                                 res.status(404).send(error);
//                             }
//                         } catch (err) {
//                             console.log(err);
//                         }
//                     }
//                 });
//             } else {
//                 let error = await encryption({
//                     status: false,
//                     message: "Wallet not found!"
//                 });
//                 res.status(404).send(error);
//             }
//         }).catch(async (err) => {
//             console.log(err);
//             let error = await encryption({
//                 status: false,
//                 message: "Something went wrong while getting the wallet"
//             });
//             res.status(400).send(error);
//         });
//     } catch (err) {
//         console.log(err);
//         let error = await encryption({
//             status: false,
//             message: "Internal server error!"
//         });
//         res.status(500).send(error);
//     }
// }

module.exports.getWalletQRCode = async (req, res) => {
    try {
        let data = req.body
        // let data = await decryption(req.body.data)
        let wallet_id = req.params.wallet_id;
        let { title, description, status } = data;
        // console.log(data)

        // const encryptedWalletID = await CryptoJS.AES.encrypt(wallet_id, "QRCodeEncryption").toString()

        // var bytes = await CryptoJS.AES.decrypt(encryptedWalletID, "QRCodeEncryption");
        // var pass = bytes.toString(CryptoJS.enc.Utf8);
        // console.log(pass, encryptedWalletID, "passs")
        Wallet.findOne({ $and: [{ wallet_id: wallet_id }, { status: 'active' }] }, { balance: false }).then(async (walletInfo) => {
            let createObj = {}
            if (walletInfo) {
                const account = await Account.findById(walletInfo.account);
                if (walletInfo?.qrCode?.key && walletInfo?.qrCode?.url) {
                    createObj['title'] = title;
                    createObj['description'] = description
                    createObj['status'] = status
                    createObj['ETag'] = walletInfo.qrCode.ETag;
                    createObj['url'] = walletInfo.qrCode.url
                    createObj['key'] = walletInfo.qrCode.key
                    console.log("if block ran", createObj, walletInfo._id)

                    Wallet.findByIdAndUpdate(walletInfo._id, { qrCode: createObj }, { new: true }).then(async (updated) => {

                        let ciphertext = await encryption({
                            status: true,
                            message: "Wallet info updated!",
                            updated,
                        });
                        res.status(200).send(ciphertext);
                    }
                    ).catch(async (err) => {
                        console.log("err top", err)
                        let ciphertext = await encryption({
                            status: true,
                            message: "Something went wrong while updating wallet",
                        });
                        res.status(500).send(ciphertext);
                    })
                } else {

                    const encryptedWalletID = await CryptoJS.AES.encrypt(wallet_id, "QRCodeEncryption").toString()

                    const walletUrl = `https://my.insta-pay.ch//currencies/qrpay/${encryptedWalletID}`;
                    let qrCodeUrl;
                    let inputImagePath;

                    const createImageFile = async () => {
                        return new Promise((resolve, reject) => {
                            qr.toDataURL(walletUrl, async (err, qrCode) => {
                                if (err) {
                                    console.log(err);
                                    reject(err);
                                } else {
                                    try {
                                        const randomUniqueStr = generateRandomString();
                                        inputImagePath = `./utils/qrcodes/${randomUniqueStr}.png`;

                                        const qrCodeWithIcon = await create(
                                            walletUrl,
                                            base64LogoImageData,
                                            200,
                                            65
                                        );
                                        // Convert the Data URL to a Buffer
                                        const buffer = Buffer.from(qrCodeWithIcon.split(',')[1], 'base64');

                                        // Use Sharp to convert the image to a supported format (e.g., PNG)
                                        // const convertedBuffer = await sharp(buffer)
                                        //     .toFormat('png')
                                        //     .toBuffer();


                                        await writeFileAsync(inputImagePath, convertedBuffer);
                                        console.log("File is created");
                                        resolve();
                                    } catch (writeErr) {
                                        console.log(writeErr);
                                        reject(writeErr);
                                    }
                                }
                            });
                        });
                    };
                    // let m = qrCode.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                    // let b = Buffer.from(m[2], 'base64');
                    // fs.writeFile('image.png', b, function (err) {
                    //     if (!err) {
                    //         console.log("file is created")
                    //     }
                    // });

                    await createImageFile();

                    const outputImagePath = 'output.png';
                    const textToAdd = `${wallet_id}`;
                    const maxAdditionalTextLength = 11;
                    let additionalText = account?.username ?? "NO USERNAME";

                    if (additionalText.length < maxAdditionalTextLength) {
                        additionalText = additionalText.padStart(maxAdditionalTextLength, ' ');
                    } else if (additionalText.length > maxAdditionalTextLength) {
                        additionalText = additionalText.slice(0, maxAdditionalTextLength - 3) + '...';
                    }

                    const editedImageWithQr = await editImageWithText(inputImagePath, textToAdd, additionalText.toUpperCase(), outputImagePath)

                    try {
                        const result = await uploadFileToS3(editedImageWithQr, `qrcodes/${wallet_id}/${wallet_id}.png`);
                        if (result?.key) {
                            createObj['title'] = title;
                            createObj['description'] = description
                            createObj['status'] = status
                            createObj['ETag'] = result.ETag;
                            createObj['url'] = result.Location
                            createObj['key'] = result.key
                            Wallet.findByIdAndUpdate(walletInfo._id, { qrCode: createObj }, { new: true }).then(async (updated) => {
                                console.log(updated)
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Wallet info updated!",
                                    updated,
                                });
                                res.status(200).send(ciphertext);
                                await util.promisify(fs.unlink)(inputImagePath);
                            }
                            ).catch(async (err) => {
                                console.log(err)
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Something went wrong while updating wallet!",
                                });
                                res.status(500).send(ciphertext);
                            })
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while updating wallet info"
                            });
                            return res.status(404).send(error);
                        }
                    } catch (err) {
                        let error = await encryption({
                            status: false,
                            message: err
                        });
                        return res.status(404).send(error);
                    }

                }
                // console.log(createObj)
                // // await walletInfo.save();

                // let ciphertext = await encryption({
                //     status: true,
                //     message: "Wallet info updated!",
                //     walletInfo,
                // });
                // res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting the wallet"
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

const getWalletsQRCode = async (wallet_id, title, description, status) => {
    try {
        console.log("i have ran")
        const walletInfo = await Wallet.findOne({ $and: [{ _id: wallet_id }, { status: 'active' }] });
        let createObj = {};
        if (walletInfo) {
            const account = await Account.findById(walletInfo.account);
            if (walletInfo?.qrCode?.key && walletInfo?.qrCode?.url) {
                createObj['title'] = walletInfo?.wallet_id;
                createObj['description'] = walletInfo?.currency?.code;
                createObj['status'] = status;
                createObj['ETag'] = walletInfo.qrCode.ETag;
                createObj['url'] = walletInfo.qrCode.url;
                createObj['key'] = walletInfo.qrCode.key;
                console.log("if block ran", createObj, walletInfo._id);

                await Wallet.findByIdAndUpdate(walletInfo._id, { qrCode: createObj }, { new: true });
                console.log("Wallet info updated!");
            } else {
                const encryptedWalletID = await CryptoJS.AES.encrypt(wallet_id.toString(), "QRCodeEncryption").toString();
                const walletUrl = `https://my.insta-pay.ch/wallets/qrpay/${encryptedWalletID}`;
                const inputImagePath = `./utils/qrcodes/${wallet_id}.png`;

                const createImageFile = async () => {
                    return new Promise((resolve, reject) => {
                        qr.toFile(inputImagePath, walletUrl, { width: 300 }, (err) => {
                            if (err) {
                                console.log(err);
                                reject(err);
                            } else {
                                console.log("File is created");
                                resolve();
                            }
                        });
                    });
                };

                await createImageFile();
                const outputDirectory = './output'; // Local directory for output images
                const outputImagePath = path.join(outputDirectory, `${walletInfo?.wallet_id}.png`);
                const textToAdd = `${walletInfo.wallet_id}`;
                const maxAdditionalTextLength = 11;
                let additionalText = account?.username ?? "NO USERNAME";

                if (additionalText.length < maxAdditionalTextLength) {
                    additionalText = additionalText.padStart(maxAdditionalTextLength, ' ');
                } else if (additionalText.length > maxAdditionalTextLength) {
                    additionalText = additionalText.slice(0, maxAdditionalTextLength - 3) + '...';
                }

                await editImageWithText(inputImagePath, textToAdd, additionalText.toUpperCase(), outputImagePath);

                // For testing purposes, save the local path to the database or perform further operations
                console.log("Local output image path:", outputImagePath);

                // Optionally, clean up the input image if no longer needed
                // await fs.unlink(inputImagePath);
            }
        } else {
            console.log("Wallet not found!");
        }
    } catch (err) {
        console.log("Internal server error!", err);
    }
};

module.exports.updateWalletQRCode = async (req, res) => {
    try {
        const data = await decryption(req.body.data)
        // const data = req.body
        const { wallet_id, status, description, title } = data

        if (!wallet_id || !status || !description || !title) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            res.status(400).send(error);
        }

        const wallet = await Wallet.findOne({ wallet_id });

        if (!wallet) {
            let error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        wallet.qrCode.title = title
        wallet.qrCode.description = description
        wallet.qrCode.status = status

        wallet.save().then(async (walletDetails) => {
            let ciphertext = await encryption({
                status: true,
                message: "Wallet updated successfully!",
                walletDetails
            });
            return res.status(200).send(ciphertext);
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while updating the wallet"
            });
            res.status(400).send(error);
        });

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

const initWalletProcessing = async () => {
    try {
        const wallets = await Wallet.find({ wallet_id: 'PMYS8FDP', status: 'active' });
        console.log(wallets, "wallets")
        for (const wallet of wallets) {
            await getWalletsQRCode(wallet._id, wallet.title, wallet.description, wallet.status);
        }
        console.log("All insta wallets processed for QR codes.");
    } catch (err) {
        console.error("Error initializing wallet processing:", err);
    }
};

async function editImageWithText(inputImagePath, outputImagePath, username, wallet_id) {
    const padding = 15;
    const textAreaHeight = 120;
    const purpleBackgroundHeight = 60;

    console.log('inputImagePath', inputImagePath);

    try {
        const qrImage = await loadImage(inputImagePath);
        const qrWidth = qrImage.width;
        const qrHeight = qrImage.height;
        const paddedWidth = qrWidth + 2 * padding;
        const paddedHeight = qrHeight + 2 * padding;

        const canvas = createCanvas(paddedWidth, paddedHeight + textAreaHeight);
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, paddedWidth, paddedHeight + textAreaHeight);
        ctx.drawImage(qrImage, padding, padding);

        ctx.fillStyle = '#5926F0';
        ctx.fillRect(0, paddedHeight, paddedWidth, purpleBackgroundHeight);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 25px sans-serif';
        const wallet_idWidth = ctx.measureText(wallet_id).width;
        const wallet_idX = (paddedWidth - wallet_idWidth) / 2;
        const wallet_idY = paddedHeight + purpleBackgroundHeight / 2 + 10;
        ctx.fillText(wallet_id, wallet_idX, wallet_idY);

        const whiteBackgroundY = paddedHeight + purpleBackgroundHeight + 10;
        const whiteBackgroundHeight = textAreaHeight - purpleBackgroundHeight - 10;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, whiteBackgroundY, paddedWidth, whiteBackgroundHeight);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 25px sans-serif';
        const usernameWidth = ctx.measureText(username).width;
        const usernameX = (paddedWidth - usernameWidth) / 2;
        const usernameY = whiteBackgroundY + whiteBackgroundHeight / 2 + 5;
        ctx.fillText(username, usernameX, usernameY);

        const radius = 20;
        const roundedCanvas = createCanvas(paddedWidth, paddedHeight + textAreaHeight);
        const roundedCtx = roundedCanvas.getContext('2d');

        roundedCtx.beginPath();
        roundedCtx.moveTo(radius, 0);
        roundedCtx.lineTo(paddedWidth - radius, 0);
        roundedCtx.quadraticCurveTo(paddedWidth, 0, paddedWidth, radius);
        roundedCtx.lineTo(paddedWidth, paddedHeight + textAreaHeight - radius);
        roundedCtx.quadraticCurveTo(paddedWidth, paddedHeight + textAreaHeight, paddedWidth - radius, paddedHeight + textAreaHeight);
        roundedCtx.lineTo(radius, paddedHeight + textAreaHeight);
        roundedCtx.quadraticCurveTo(0, paddedHeight + textAreaHeight, 0, paddedHeight + textAreaHeight - radius);
        roundedCtx.lineTo(0, radius);
        roundedCtx.quadraticCurveTo(0, 0, radius, 0);
        roundedCtx.closePath();

        roundedCtx.clip();
        roundedCtx.drawImage(canvas, 0, 0);

        const buffer = roundedCanvas.toBuffer('image/png');

        // Ensure outputImagePath has only one .png extension
        const finalOutputPath = outputImagePath.endsWith('.png') ? outputImagePath : `${outputImagePath}.png`;

        fs.writeFileSync(finalOutputPath, buffer);
        console.log(`Image saved to ${finalOutputPath}`);
    } catch (err) {
        console.log(err);
        throw new Error('Unsupported image type');
    }
}

module.exports.setToDefaultWallet = async (req, res) => {
    try {
        let wallet_id = req.params.id;

        Wallet.findOne({ wallet_id: wallet_id }).then(async (walletDetails) => {

            if (walletDetails) {
                if (walletDetails.default == true) {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Already set to default!",
                        walletDetails
                    });
                    res.status(200).send(ciphertext);
                } else {
                    Wallet.find({ account: walletDetails.account }).then(async (otherWallets) => {
                        const currentDefaultWallet = otherWallets.find(wallet => wallet.default === true);

                        if (currentDefaultWallet) {
                            await Wallet.findByIdAndUpdate(currentDefaultWallet._id, { default: false });
                            await Wallet.findByIdAndUpdate(walletDetails._id, { default: true });

                            let ciphertext = await encryption({
                                status: true,
                                message: "Wallet set to default successfully.",
                                walletDetails: walletDetails,
                                otherWallets: otherWallets
                            });
                            res.status(200).send(ciphertext);
                        } else {
                            await Wallet.findByIdAndUpdate(walletDetails._id, { default: true });

                            let ciphertext = await encryption({
                                status: true,
                                message: "Wallet set to default successfully (no other default wallet found).",
                                walletDetails: walletDetails,
                                otherWallets: otherWallets
                            });
                            res.status(200).send(ciphertext);
                        }
                    }).catch(async (err) => {

                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while finding other wallets!"
                        });
                        res.status(400).send(error);
                    });
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Wallet not found!"
                });
                res.status(404).send(error);
            }
        }).catch(async (err) => {

            let error = await encryption({
                status: false,
                message: "Something went wrong while getting wallet status!"
            });
            res.status(400).send(error);
        });
    } catch (err) {

        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.getQRWalletDetails = async (req, res) => {
    try {
        if (!req.file || req.file.size <= 0) {
            let error = await encryption({
                status: false,
                message: "Please provide an image."
            });
            return res.status(400).send(error);
        }

        if (req.file.mimetype.split("/")[0] === "image") {
            Jimp.read(req.file.buffer, async (err, image) => {
                if (err) {
                    let error = await encryption({
                        status: false,
                        message: "Error reading the image."
                    });
                    return res.status(500).send(error);
                }

                const { data, width, height } = image.bitmap;
                const qrCode = jsQR(data, width, height);

                if (!qrCode) {
                    let error = await encryption({
                        status: false,
                        message: "Error decoding QR code."
                    });
                    return res.status(500).send(error);
                }

                const index = qrCode.data.indexOf("q/");
                console.log(index, qrCode.data);
                if (index === -1) {
                    let error = await encryption({
                        status: false,
                        message: "Not a valid instapay qrcode"
                    });
                    return res.status(500).send(error);
                }

                // const token = qrCode.data.substring(index + "qrpay/".length);
                // const bytes = CryptoJS.AES.decrypt(token, "QRCodeEncryption");
                // const pass = bytes.toString(CryptoJS.enc.Utf8);

                const walletID = qrCode.data.split("q/")[1]
                console.log(walletID, "walletID")

                if (walletID !== "") {
                    try {
                        const walletDetails = await Wallet.findOne({ $and: [{ wallet_id: walletID }, { status: 'active' }] });

                        if (walletDetails) {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Wallet Details!",
                                walletDetails
                            });
                            res.status(200).send(ciphertext);
                        } else {
                            let error = await encryption({
                                status: false,
                                message: "Wallet not found!"
                            });
                            res.status(404).send(error);
                        }
                    } catch (err) {
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while getting wallet details!"
                        });
                        res.status(400).send(error);
                    }
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Not a valid instapay qrcode"
                    });
                    res.status(500).send(error);
                }
            });
        } else {
            let error = await encryption({
                status: false,
                message: "Please provide an image file"
            });
            res.status(400).send(error);
        }
    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.sendOtp = async (req, res) => {
    try {
        // let data = req.body;

        let data = await decryption(req.body.data)
        console.log(data, "data in sendOtp")
        const otpTokenKey = 'thisisforotponly';
        if (data.type === "sms") {
            const templateName = req?.emailTemplateName

            console.log(data, "data")

            let userDetails = req.user;

            const accountDetails = await Account.findOne({ _id: userDetails._id }).populate(['company', 'user']);

            let userName = accountDetails?.user ?
                accountDetails?.user?.first_name + " " + accountDetails?.user?.last_name :
                accountDetails?.company?.company_name;

            const phoneCheck = accountDetails.sms_verification;
            const emailCheck = accountDetails.email_verification;

            let createObj = { data: data.data };

            const otp = `${Math.floor(100000 + Math.random() * 900000)}`;

            let emailSend = 'failed';
            let phoneSend = 'failed';

            if (emailCheck) {
                // const templateId = 'd-3fbe31e844f14a1e836da5cd10db68a6';
                const language = 'english'
                const templateId = getTemplateId(language, templateName);
                console.log(templateId, 'templateId')
                const dynamicData = {
                    otp,
                };

                const check = await sendMailsExport(accountDetails.email, `Hi ${userName},\n\nThis is your instapay transaction OTP: ${otp}`, "Transaction Verification", templateId || "d-20c36c3f17104844ac7e697d65d1f0cc", dynamicData)

                // const check = await sendMailsHelper(accountDetails.email, 'Test message', 'Transaction OTP', templateId, dynamicData);

                // const check = await sendMailsHelper(accountDetails.email, `Hi ${userName},\n\nThis is your instapay transaction OTP: ${otp}`, "Transaction Verification");
                if (check) { emailSend = 'success'; } else { emailSend = 'failed'; }
            }
            if (phoneCheck) {
                let check;
                if (accountDetails?.country_iso_code === "ARE") {
                    check = await sendWhatsAppMessage(accountDetails.phone, otp);
                } else {
                    check = await sendSMSTemplate(accountDetails.phone, `Your OTP for instapay: ${otp}`);
                }
                if (check) { phoneSend = 'success'; } else { phoneSend = 'failed'; }
            }

            if (emailSend === "failed" && phoneSend === "failed") {
                const data = await encryption({
                    status: false,
                    message: "Failed to send OTP via email and SMS!",
                });
                return res.status(400).send(data);
            }

            if (emailSend === "success" || phoneSend === "success") {
                createObj['otp'] = otp;
                // createObj['type'] = "sms";
                console.log(createObj, "createObj")
                const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '120s' });
                const ciphertext = await encryption({
                    status: true,
                    message: "OTP sent successfully!",
                    token: JWTToken
                });
                return res.status(200).send(ciphertext);
            }
        }  // else token will be sent for Authenticator
        else {
            const user = req?.user

            if (!user?.tfa) {
                let error = await encryption({
                    status: false,
                    message: "Authentication not enabled!"
                })

                return res.status(400).send(error)
            }

            let createObj = {
                data: data.data,
                // type: 'authenticator' 
            };
            const JWTToken = jwt.sign(createObj, otpTokenKey, { expiresIn: '120s' });
            const ciphertext = await encryption({
                status: true,
                message: "OTP sent successfully!",
                token: JWTToken
            });
            return res.status(200).send(ciphertext);
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

module.exports.getSearchedWallets = async (req, res) => {
    try {
        const query = req.params.query;

        if (!query) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const accountsWithWallets = await searchUsersAndWallets(query);

        const uniqueResults = await getDistinctObjects(accountsWithWallets);

        let ciphertext = await encryption({
            status: true,
            message: "Users and wallets found successfully!",
            users: uniqueResults
        });

        res.status(200).send(ciphertext);
    } catch (err) {
        console.error("Error:", err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};



module.exports.formatW2WData = async (req, res) => {
    const token = req.token
    const transactionId = req.transaction_id

    console.log(token, transactionId, "formatW2WData")

    const transactionDetails = await Transaction.findById(transactionId).populate("receiver")

    try {
        let decoded;
        try {
            decoded = jwt.verify(token, topupTransactionDataTokenKey);
        } catch (jwtError) {

            console.log(jwtError)
            if (jwtError instanceof jwt.TokenExpiredError) {
                console.log('Token has expired');
                await logError(
                    "Token expired (w2w)",
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            } else {
                await logError(
                    "Token invalid (w2w)",
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                console.error('JWT Verification Error:', jwtError);

                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }
        }

        const data = decoded

        console.log({ decoded })

        if (decoded.type === 'quotation') {
            const quotation = await QuotationModel.findOne({ _id: data.body.quotation_id, status: { $in: ['sent', 'revise', 'bargain-accepted'] } }).populate({
                path: 'sender',
                populate: {
                    path: 'insta_recipient_id'
                }
            });
            if (!quotation) {
                await logError(
                    "Quotation not found",
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }

            const amount = quotation?.revised_amount || quotation.amount;
            const receiver_Wallet = await Wallet.findById(quotation.amount_reciever_currency);

            let dataObj = {
                sender_wallet_id: data.body.receiver_wallet_id,
                receiver_wallet_id: receiver_Wallet?.wallet_id,
                amount: amount - transactionDetails?.fee,
                purpose: quotation.purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link_id: quotation._id,
                description: quotation.desc,
                payment_method: "card",
                token: data.token
            }

            console.log({ dataObj })

            const files = quotation?.images.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            const response = await walletToWalletTransactionHelper(dataObj, req, files)

            if (response.status) {
                await QuotationModel.findByIdAndUpdate(data.body.quotation_id, { $set: { status: 'accepted' } });
                // transactionDetails['hidden'] = false
                // await transactionDetails.save();
                // return res.status(200).send(await encryption(response));
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/success/${transactionDetails?.receiver?.username}`);
            } else {
                await QuotationModel.findByIdAndUpdate(data.body.quotation_id, { $set: { status: 'failed' } });
                await logError(
                    `${response?.message} (w2w)`,
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }

        } else if (decoded.type === "payment_request") {
            const { request_id, account_id, sender_wallet_id, purpose } = data.body;
            if (!request_id || !account_id || !sender_wallet_id) {
                await logError(
                    "Required fields are missing (w2w)",
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                    { request_id, account_id, sender_wallet_id }
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }
            const requestDetails = await RequestPayment.findOne({ reference_id: request_id, status: 'pending' });
            if (!requestDetails) {
                await logError(
                    "Request not found (w2w)",
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }

            const dataObj = {
                sender_wallet_id,
                receiver_wallet_id: requestDetails.wallet_id,
                amount: requestDetails.amount - transactionDetails.fee,
                purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link: requestDetails._id,
                description: requestDetails.description,
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            };

            console.log({ dataObj })

            const files = requestDetails?.attachments.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            const response = await walletToWalletTransactionHelper(dataObj, req, files);
            if (response.status) {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } });
                // transactionDetails['hidden'] = false
                // await transactionDetails.save();
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/success/${transactionDetails?.receiver?.username}`);;
            } else {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'failed' } });
                await logError(
                    `${response?.message} (w2w)`,
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }
        } else {
            let dataObj = data;
            const files = decoded.attachments;

            const {
                body: {
                    receiver_wallet_id,
                    sender_wallet_id,
                    amount,
                    purpose,
                    description,
                    payment_type
                }
            } = dataObj;

            dataObj.receiver_wallet_id = receiver_wallet_id;
            dataObj.sender_wallet_id = sender_wallet_id;
            dataObj.amount = amount;
            dataObj.purpose = purpose;
            dataObj.description = description;

            console.log(dataObj)
            dataObj['payment_type'] = payment_type || 'wallet_to_wallet';
            dataObj['transaction_type'] = payment_type === "qr_pay" || payment_type === "payment_address" ? 'request' : 'instant';
            dataObj['payment_method'] = 'card';
            console.log({ dataObj })

            const response = await walletToWalletTransactionHelper(dataObj, req, files);

            console.log({ response })

            if (response.status) {
                // transactionDetails['hidden'] = false
                // await transactionDetails.save();
                // return res.status(200).send(await encryption(response));
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/success/${transactionDetails?.receiver?.username}`);
            } else {
                await logError(
                    `${response?.message} (w2w)`,
                    "w2w using card",
                    transactionDetails.receiver._id,
                    transactionDetails._id,
                );
                return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
            }
        }
    } catch (err) {
        console.error(err);
        await logError(
            `${err} (catch: formatw2w)`,
            "w2w using card",
            transactionDetails?.receiver?._id || null,
            transactionDetails?._id || null,
        );
        return res.redirect(`https://my.insta-pay.ch/payment-status/wallet_to_wallet/error/null?add_funds=true`);
    }
};

module.exports.formatW2WDataChatbot = async (req, res) => {
    console.log(req.botId, req.token, "req.botId, req.token")
    const botId = req.botId

    const chatbotData = {
        sender: { id: botId },
    }
    try {
        const token = req.token

        let decoded;
        try {
            decoded = jwt.verify(token, topupTransactionDataTokenKey);
        } catch (jwtError) {

            console.log(jwtError)
            if (jwtError instanceof jwt.TokenExpiredError) {
                console.log('Token has expired');

                await sendBotTemplate(chatbotData, "Error: Transaction expired.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");


                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            } else {
                console.error('JWT Verification Error:', jwtError);

                await sendBotTemplate(chatbotData, "Error: Transaction expired.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");


                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }

        const data = decoded

        console.log(decoded)

        if (decoded.payment_type === "subscription") {
            const subscription_data = {
                receiver_wallet_id: decoded.receiver_wallet_id,
                sender_wallet_id: decoded.sender_wallet_id,
                purpose: decoded.purpose,
                amount: decoded.amount,
                date: decoded.date,
                next_date: decoded.next_date,
                nextCycles: decoded.nextCycles,
                cycles: decoded.cycles,
                untilIStop: decoded.untilIStop,
                timezone: decoded.timezone,
                attachments: decoded.attachments,
                description: decoded.description,
                reserved: true,
            }

            const subscriptionDetails = await subscribePaymentW2WHelper(subscription_data)

            if (subscriptionDetails.status) {

                const receiverWalletDetails = await Wallet.findOne({ wallet_id: decoded.receiver_wallet_id }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                        ]
                    }
                ]);
                const senderWalletDetails = await Wallet.findById(decoded.sender_wallet_id)
                console.log(subscriptionDetails, "subscriptionDetails")

                // reserving the amount - checking balance
                // if (senderWalletDetails.balance.available < decoded.amount) {
                //     const schedule = await Schedule.findById(subscriptionDetails?.subscribtionDetails?._id)
                //     schedule.status = "declined"
                //     schedule.reserved = false
                //     await schedule.save()

                //     await sendBotTemplate(chatbotData, "Your subscription payment could not be processed due to insufficient funds. Please top up your wallet and try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                //     return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                // }

                // // if enough balance available then reserving the amount
                // senderWalletDetails.balance.reserved = senderWalletDetails.balance.reserved || 0;
                // senderWalletDetails.balance.reserved += decoded.amount
                // senderWalletDetails.balance.available -= decoded.amount
                // await senderWalletDetails.save()

                const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name
                const subtitle = `
Recipient: ${userName}
From: ${decoded.date}
${decoded?.cycles ? `For: ${decoded?.cycles} months` : decoded.next_date ? `To: ${decoded.next_date}` : 'To: Until Cancelled'}
Wallet ID: ${receiverWalletDetails.wallet_id}
Status: Pending`

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `Your subscription payment of ${formattedAmount(formatDecimalNumbersWithLimit(decoded.amount))} ${senderWalletDetails?.currency?.code} is all set up.`,
                            subtitle,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",

                            buttons: [
                                {
                                    type: "postback",
                                    title: "Main Menu",
                                    payload: "main_menu",
                                },
                            ],
                        },
                    ]
                };
                await sendTemplate(chatbotData, botId, templatePayload, "4")
            } else {
                await sendBotTemplate(chatbotData, "Something went wrong while setting up your subscribed payment. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else if (decoded.payment_type === "schedule") {
            const scheduleData = {
                receiver_wallet_id: decoded.receiver_wallet_id,
                sender_wallet_id: decoded.sender_wallet_id,
                purpose: decoded.purpose,
                amount: decoded.amount,
                date: decoded.date,
                time: decoded.time,
                timezone: decoded.timezone,
                attachments: decoded.attachments,
                description: decoded.description,
                reserved: true
            }

            console.log(scheduleData, "scheduleDatainsched2")

            const scheduleDetails = await schedulePaymentW2WHelper(scheduleData)

            if (scheduleDetails.status) {
                const receiverWalletDetails = await Wallet.findOne({ wallet_id: decoded.receiver_wallet_id }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                        ]
                    }
                ]);
                const senderWalletDetails = await Wallet.findById(decoded.sender_wallet_id);

                // Reserving the amount - checking balance
                // if (senderWalletDetails.balance.available < decoded.amount) {
                //     const schedule = await Schedule.findById(scheduleDetails?.scheduleDetails?._id);
                //     schedule.status = "declined";
                //     schedule.reserved = false
                //     await schedule.save();

                //     await sendBotTemplate(chatbotData, "Your scheduled payment could not be processed due to insufficient funds. Please top up your wallet and try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                //     return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                // }

                // // If enough balance available, reserving the amount
                // senderWalletDetails.balance.reserved = senderWalletDetails.balance.reserved || 0;
                // senderWalletDetails.balance.reserved += decoded.amount;
                // senderWalletDetails.balance.available -= decoded.amount;
                // await senderWalletDetails.save();

                const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name;
                const subtitle = `
Recipient: ${userName}
Schedule: ${decoded.time}, ${decoded.date}
Timezone: ${decoded.timezone}
Wallet ID: ${receiverWalletDetails.wallet_id}
Status: Pending`;

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `Your scheduled payment of ${formattedAmount(formatDecimalNumbersWithLimit(decoded.amount))} ${senderWalletDetails?.currency?.code} is all set up.`,
                            subtitle,
                            image_url: "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png",
                            buttons: [
                                {
                                    type: "postback",
                                    title: "Main Menu",
                                    payload: "main_menu",
                                },
                            ],
                        },
                    ]
                };
                await sendTemplate(chatbotData, botId, templatePayload, "4");
            } else {
                await sendBotTemplate(chatbotData, "Something went wrong while setting up your scheduled payment. Please try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else if (decoded.payment_type === 'quotation') {
            const quotation = await QuotationModel.findOne({ _id: data.link, status: { $in: ['sent', 'revise', 'bargain-accepted'] } }).populate({
                path: 'sender',
                populate: {
                    path: 'insta_recipient_id'
                }
            }).populate('amount_reciever_currency');
            if (!quotation) {

                await sendBotTemplate(chatbotData, "Accepting quotation not found!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }


            let dataObj = {
                sender_wallet_id: data.sender_wallet_id,
                receiver_wallet_id: data.receiver_wallet_id,
                amount: data.amount,
                purpose: data.purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link_id: data.link,
                description: data.description,
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            }

            const files = quotation?.images.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            const response = await walletToWalletTransactionHelper(dataObj, req, files)

            if (response.status) {
                await QuotationModel.findByIdAndUpdate(data.quotation_id, { $set: { status: 'accepted' } });

                const subtitle = `
Quotation ID: ${quotation.reference_id}
${lang[selectedLanguage].AMOUNT}: ${data.amount} ${quotation?.amount_reciever_currency?.currency.code}
Username: ${quotation?.sender?.username}
${lang[selectedLanguage].TITLE}: ${quotation?.title}
`

                await sendBotTemplate(chatbotData, "You've accepted the quote. The payment will be processed per the agreed terms.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Quote%20Accepted.png", subtitle);

                // return res.status(200).send(await encryption(response));
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success/0`);
            } else {
                await QuotationModel.findByIdAndUpdate(data.quotation_id, { $set: { status: 'failed' } });

                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");


                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }

        }
        else if (decoded.payment_type === "payment_request") {
            const { request_id, sender_wallet_id, purpose } = data;
            if (!request_id || !sender_wallet_id) {
                console.log("all fields are required")
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");


                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            const requestDetails = await RequestPayment.findOne({ _id: request_id, status: 'pending' });
            if (!requestDetails) {
                await sendBotTemplate(chatbotData, "Error: Accepting request not found!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");


                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }

            const dataObj = {
                sender_wallet_id,
                receiver_wallet_id: requestDetails.wallet_id,
                amount: requestDetails.amount,
                purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link: requestDetails._id,
                description: requestDetails.description,
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            };

            const files = requestDetails?.attachments.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            const response = await walletToWalletTransactionHelper(dataObj, req, files);
            if (response.status) {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } });
                await sendBotTemplate(chatbotData, "Transaction Successfull!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success`);;
            } else {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'failed' } });
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else if (decoded.payment_type === "qr_pay") {

            const dataObj = {
                sender_wallet_id: data.sender_wallet_id,
                receiver_wallet_id: data.receiver_wallet_id,
                amount: data.amount,
                purpose: data.purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'qr_pay',
                description: "",
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            };

            const response = await walletToWalletTransactionHelper(dataObj, req, files);
            if (response.status) {
                const receiverWalletDetails = await Wallet.findOne({ wallet_id: data.receiver_wallet_id }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                        ]
                    }
                ]);
                const receiverName = receiverWalletDetails.account.account_type === "individual" ? receiverWalletDetails.account.user.first_name + " " + receiverWalletDetails.account.user.last_name :
                    receiverWalletDetails?.account?.company?.company_name
                const subtitle = `
${lang[selectedLanguage].TRANSACTION_ID} ${response?.data?.reference_id}
${lang[selectedLanguage].STATUS}: Completed`
                await sendBotTemplate(chatbotData, `You have succesfully sent ${response?.data?.recipient_received_amount} ${response?.data?.recipient_received_currency} to ${receiverName} `, "https://my.insta-pay.ch/static/media/chips_in_left.3898cd344de2a6cfda6c.png", subtitle);

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success`);;
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else {
            let dataObj = data;
            const files = decoded.attachments;

            console.log(dataObj)
            dataObj['payment_type'] = dataObj?.payment_type || 'wallet_to_wallet';
            dataObj['payment_method'] = 'card';
            dataObj['transaction_type'] = 'instant';

            const response = await walletToWalletTransactionHelper(dataObj, req, files);

            if (response.status) {
                await sendBotTemplate(chatbotData, "Transaction Successfull!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Confirmed.png");

                // return res.status(200).send(await encryption(response));
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success`);
            } else {
                await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");


                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
    } catch (err) {
        console.error(err);


        await sendBotTemplate(chatbotData, "Error: Transaction failed!", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Failed.png");

        return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
    }
};
module.exports.formatW2WDataChatbotTelegram = async (req, res) => {
    console.log(req.botId, req.token, "req.botId, req.token")
    const botId = req.botId

    try {
        const token = req.token

        let decoded;
        try {
            decoded = jwt.verify(token, topupTransactionDataTokenKey);
        } catch (jwtError) {
            const imageUrl = "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png";
            console.log(jwtError)
            if (jwtError instanceof jwt.TokenExpiredError) {
                console.log('Token has expired');
                await sendPhoto(botId, imageUrl, "Error: Transaction expired.");
            } else {
                console.error('JWT Verification Error:', jwtError);
                await sendPhoto(botId, imageUrl, "Error: Transaction expired.");
            }
            return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
        }

        const data = decoded

        console.log(decoded)

        if (decoded.payment_type === "subscription") {
            const subscription_data = {
                receiver_wallet_id: decoded.receiver_wallet_id,
                sender_wallet_id: decoded.sender_wallet_id,
                purpose: decoded.purpose,
                amount: decoded.amount,
                date: decoded.date,
                next_date: decoded.next_date,
                nextCycles: decoded.nextCycles,
                cycles: decoded.cycles,
                untilIStop: decoded.untilIStop,
                timezone: decoded.timezone,
                attachments: decoded.attachments,
                description: decoded.description,
                reserved: true,
            }

            const subscriptionDetails = await subscribePaymentW2WHelper(subscription_data)

            if (subscriptionDetails.status) {

                const receiverWalletDetails = await Wallet.findOne({ wallet_id: decoded.receiver_wallet_id }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                        ]
                    }
                ]);
                const senderWalletDetails = await Wallet.findById(decoded.sender_wallet_id)
                console.log(subscriptionDetails, "subscriptionDetails")

                // reserving the amount - checking balance
                // if (senderWalletDetails.balance.available < decoded.amount) {
                //     const schedule = await Schedule.findById(subscriptionDetails?.subscribtionDetails?._id)
                //     schedule.status = "declined"
                //     schedule.reserved = false
                //     await schedule.save()

                //     await sendBotTemplate(chatbotData, "Your subscription payment could not be processed due to insufficient funds. Please top up your wallet and try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                //     return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                // }

                // // if enough balance available then reserving the amount
                // senderWalletDetails.balance.reserved = senderWalletDetails.balance.reserved || 0;
                // senderWalletDetails.balance.reserved += decoded.amount
                // senderWalletDetails.balance.available -= decoded.amount
                // await senderWalletDetails.save()

                const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name
                const subtitle = `
Recipient: ${userName}
From: ${decoded.date}
${decoded?.cycles ? `For: ${decoded?.cycles} months` : decoded.next_date ? `To: ${decoded.next_date}` : 'To: Until Cancelled'}
Wallet ID: ${receiverWalletDetails.wallet_id}
Status: Pending`

                const messageText = `Your subscription payment of ${formattedAmount(formatDecimalNumbersWithLimit(decoded.amount))} ${senderWalletDetails?.currency?.code} is all set up.\n\n${subtitle}`

                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", messageText, "4")
            } else {
                const imageUrl = "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png";
                await sendPhoto(botId, imageUrl, "Something went wrong while setting up your subscribed payment. Please try again.");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else if (decoded.payment_type === "schedule") {
            const scheduleData = {
                receiver_wallet_id: decoded.receiver_wallet_id,
                sender_wallet_id: decoded.sender_wallet_id,
                purpose: decoded.purpose,
                amount: decoded.amount,
                date: decoded.date,
                time: decoded.time,
                timezone: decoded.timezone,
                attachments: decoded.attachments,
                description: decoded.description,
                reserved: true
            }

            console.log(scheduleData, "scheduleDatainsched2")

            const scheduleDetails = await schedulePaymentW2WHelper(scheduleData)

            if (scheduleDetails.status) {
                const receiverWalletDetails = await Wallet.findOne({ wallet_id: decoded.receiver_wallet_id }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                        ]
                    }
                ]);
                const senderWalletDetails = await Wallet.findById(decoded.sender_wallet_id);

                // Reserving the amount - checking balance
                // if (senderWalletDetails.balance.available < decoded.amount) {
                //     const schedule = await Schedule.findById(scheduleDetails?.scheduleDetails?._id);
                //     schedule.status = "declined";
                //     schedule.reserved = false
                //     await schedule.save();

                //     await sendBotTemplate(chatbotData, "Your scheduled payment could not be processed due to insufficient funds. Please top up your wallet and try again.", "https://nodejs-checking-bucket.s3.eu-west-3.amazonaws.com/chatbot_images/Payment%20Declined.png");
                //     return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
                // }

                // // If enough balance available, reserving the amount
                // senderWalletDetails.balance.reserved = senderWalletDetails.balance.reserved || 0;
                // senderWalletDetails.balance.reserved += decoded.amount;
                // senderWalletDetails.balance.available -= decoded.amount;
                // await senderWalletDetails.save();

                const userName = receiverWalletDetails?.account?.account_type === "individual" ? receiverWalletDetails?.account?.user?.first_name + " " + receiverWalletDetails?.account?.user?.last_name : receiverWalletDetails?.account?.company?.company_name;
                const subtitle = `
Recipient: ${userName}
Schedule: ${decoded.time}, ${decoded.date}
Timezone: ${decoded.timezone}
Wallet ID: ${receiverWalletDetails.wallet_id}
Status: Pending`;

                const messageText = `Your scheduled payment of ${formattedAmount(formatDecimalNumbersWithLimit(decoded.amount))} ${senderWalletDetails?.currency?.code} is all set up.\n\n${subtitle}`

                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", messageText, "4")

            } else {
                const imageUrl = "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png";
                await sendPhoto(botId, imageUrl, "Something went wrong while setting up your scheduled payment. Please try again.");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else if (decoded.payment_type === 'quotation') {
            const quotation = await QuotationModel.findOne({ _id: data.link, status: { $in: ['sent', 'revise', 'bargain-accepted'] } }).populate({
                path: 'sender',
                populate: {
                    path: 'insta_recipient_id'
                }
            }).populate('amount_reciever_currency');
            if (!quotation) {

                const imageUrl = "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png";
                await sendPhoto(botId, imageUrl, "Accepting quotation not found!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }


            let dataObj = {
                sender_wallet_id: data.sender_wallet_id,
                receiver_wallet_id: data.receiver_wallet_id,
                amount: data.amount,
                purpose: data.purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'quotation',
                link_id: data.link,
                description: data.description,
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            }

            const files = quotation?.images.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            const response = await walletToWalletTransactionHelper(dataObj, req, files)

            if (response.status) {
                await QuotationModel.findByIdAndUpdate(data.quotation_id, { $set: { status: 'accepted' } });

                const subtitle = `Quotation ID: ${quotation.reference_id}\n${lang[selectedLanguage].AMOUNT}: ${data.amount} ${quotation?.amount_reciever_currency?.currency.code}\nUsername: ${quotation?.sender?.username}\n${lang[selectedLanguage].TITLE}: ${quotation?.title}`;
                const caption = `You've accepted the quote. The payment will be processed per the agreed terms.\n${subtitle}`;
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", caption);
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success/0`);
            } else {
                await QuotationModel.findByIdAndUpdate(data.quotation_id, { $set: { status: 'failed' } });

                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }

        }
        else if (decoded.payment_type === "payment_request") {
            const { request_id, sender_wallet_id, purpose } = data;
            if (!request_id || !sender_wallet_id) {
                console.log("all fields are required")
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
            const requestDetails = await RequestPayment.findOne({ _id: request_id, status: 'pending' });
            if (!requestDetails) {
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Accepting request not found!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }

            const dataObj = {
                sender_wallet_id,
                receiver_wallet_id: requestDetails.wallet_id,
                amount: requestDetails.amount,
                purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'payment_request',
                link: requestDetails._id,
                description: requestDetails.description,
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            };

            const files = requestDetails?.attachments.map(image => ({
                key: image.key,
                url: image.url,
                ETag: image.ETag,
                status: true
            }));

            const response = await walletToWalletTransactionHelper(dataObj, req, files);
            if (response.status) {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'completed' } });
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", "Transaction Successfull!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success`);
            } else {
                await RequestPayment.updateOne({ _id: requestDetails._id }, { $set: { "status": 'failed' } });
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else if (decoded.payment_type === "qr_pay") {

            const dataObj = {
                sender_wallet_id: data.sender_wallet_id,
                receiver_wallet_id: data.receiver_wallet_id,
                amount: data.amount,
                purpose: data.purpose,
                service_type: 'wallet_to_wallet',
                payment_type: 'qr_pay',
                description: "",
                transaction_type: "request",
                payment_method: "card",
                token: data.token
            };

            const response = await walletToWalletTransactionHelper(dataObj, req, files);
            if (response.status) {
                const receiverWalletDetails = await Wallet.findOne({ wallet_id: data.receiver_wallet_id }).populate([
                    {
                        path: 'account',
                        populate: [
                            { path: 'user' },
                            { path: 'company' },
                        ]
                    }
                ]);
                const receiverName = receiverWalletDetails.account.account_type === "individual" ? receiverWalletDetails.account.user.first_name + " " + receiverWalletDetails.account.user.last_name :
                    receiverWalletDetails?.account?.company?.company_name
                const subtitle = `${lang[selectedLanguage].TRANSACTION_ID} ${response?.data?.reference_id}\n${lang[selectedLanguage].STATUS}: Completed`;
                const caption = `You have successfully sent ${response?.data?.recipient_received_amount} ${response?.data?.recipient_received_currency} to ${receiverName}\n${subtitle}`;
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", caption);
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success`);
            } else {
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
        else {
            let dataObj = data;
            const files = decoded.attachments;

            console.log(dataObj)
            dataObj['payment_type'] = dataObj?.payment_type || 'wallet_to_wallet';
            dataObj['payment_method'] = 'card';
            dataObj['transaction_type'] = 'instant';

            const response = await walletToWalletTransactionHelper(dataObj, req, files);

            if (response.status) {
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/Success.png", "Transaction Successfull!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/success`);
            } else {
                await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed!");
                return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
            }
        }
    } catch (err) {
        console.error(err);
        await sendPhoto(botId, "https://nodejs-checking-bucket.s3.amazonaws.com/telegram_bot_images/cancelled.png", "Error: Transaction failed!");
        return res.redirect(`https://my.insta-pay.ch/chatbot/pan-transaction/error/null`);
    }
};

async function sendBotTemplate(chatbotData, title, imageUrl, subtitle) {
    const templateElement = {
        title: title,
        image_url: imageUrl,
        buttons: [{ type: "postback", title: "Main Menu", payload: "main_menu" }]
    };

    if (subtitle) {
        templateElement.subtitle = subtitle;
    }

    const templatePayload = {
        template_type: "generic",
        elements: [templateElement]
    };

    await sendTemplate(chatbotData, chatbotData?.sender?.id, templatePayload, "4");
}

async function removeQrCodeFromAllRecords() {
    try {
        await Wallet.updateMany(
            {},                    // Empty filter to target all records
            { $unset: { qrCode: 1 } }  // $unset removes the qrCode field
        );
        console.log("qrCode field removed from all records.");
    } catch (error) {
        console.error("Error removing qrCode field:", error);
    }
}

// Call the function
// removeQrCodeFromAllRecords();

module.exports.uploadWalletQRCode = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const wallet = await Wallet.findOne({ wallet_id: req.body.wallet_id })
            .populate({ path: "account", populate: { path: "insta_recipient_id" } });

        if (!wallet) {
            return res.status(400).send(await encryption({ status: false, message: "Wallet not found!" }));
        }

        if (wallet?.qrCode?.url) {
            return res.status(400).send(await encryption({ status: false, message: "QR code already generated!" }));
        }

        const qrCodePath = req.file.path;
        const outputImagePath = `./utils/temp/${req.file.filename}.png`;

        console.log(req.file, "qrCodePath");

        await editImageWithText(qrCodePath, outputImagePath, wallet?.account?.username?.toUpperCase(), req.body.wallet_id);

        // Upload the image to S3
        const fileContent = fs.readFileSync(outputImagePath);
        const params = {
            Key: `qrStcikers/${wallet?.account?.username}/${wallet.wallet_id}.png`,
            Body: fileContent,
            Bucket: process.env.AWS_BUCKET_NAME,
        };

        const data = await s3.upload(params).promise();
        // Clean up the temp files
        fs.unlinkSync(qrCodePath);
        fs.unlinkSync(outputImagePath);
        console.log(`File uploaded successfully. ${data.Location}`);

        wallet.qrCode = {
            key: data.key,
            url: data.Location,
            ETag: data.ETag,
            title: wallet.wallet_id,
            description: wallet.wallet_id,
            new: true,
            status: "active"
        };
        await wallet.save()

        // if qr code has been requested from chatbot, then send a template message
        if (req.body?.chatbot) {
            if (req.body.platform === "telegram") {
                const chatId = wallet?.account?.telegram_id;
                if (chatId) {
                    await sendPhoto(chatId, data.Location, `Your QR Code for ${wallet.currency.code} has been activated!`);
                    await sendButtons(chatId, "What would you like to do next?", [
                        { text: "Main Menu", callback_data: "main_menu" }
                    ]);
                }
            } else {
                const templateData = {
                    sender: { id: wallet?.account?.insta_recipient_id?.recipient },
                }
                await sendVideoImage(data.Location, templateData.sender.id, 'image');

                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `Your QR Code for ${wallet.currency.code} has been activated!`,
                            buttons: [
                                { type: "postback", title: "Main Menu", payload: "main_menu" },
                            ]
                        }
                    ]
                };
                await sendTemplate(templateData, templateData.sender.id, templatePayload, "4");
            }
        }

        return res.status(200).send(await encryption({
            status: true,
            message: `QR uploaded successfully. ${data}`,
        }));
    } catch (err) {
        console.log(err);
        return res.status(500).send({ status: false, message: "Internal server error" });
    }
};

module.exports.getAllWallets = async (req, res) => {
    try {
        const wallets = await Wallet.find();

        return res.status(200).json(wallets)
    } catch (err) {
        console.log(err);
        const error = {
            status: false,
            message: "Internal server error"
        };
        return res.status(500).send(error);
    }
}

module.exports.getAccountLimits = async (req, res) => {
    try {
        const { wallet_id } = req.params

        const walletDetails = await Wallet.findById(wallet_id).populate({ path: "account", populate: { path: 'level' } })

        let daily_sending_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.daily_sending_limit || 0);
        let monthly_sending_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.monthly_sending_limit || 0);
        let yearly_sending_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.yearly_sending_limit || 0);

        let daily_receiving_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.daily_receiving_limit || 0);
        let monthly_receiving_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.monthly_receiving_limit || 0);
        let yearly_receiving_limit_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.yearly_receiving_limit || 0);

        let daily_sending_limit = walletDetails.account.level.daily_sending_limit;
        let monthly_sending_limit = walletDetails.account.level.monthly_sending_limit;
        let yearly_sending_limit = walletDetails.account.level.yearly_sending_limit;

        let daily_receiving_limit = walletDetails.account.level.daily_receiving_limit;
        let monthly_receiving_limit = walletDetails.account.level.monthly_receiving_limit;
        let yearly_receiving_limit = walletDetails.account.level.yearly_receiving_limit;

        let account_balance_limit = walletDetails.account.level.account_balance_limit

        let daily_transaction_count = walletDetails.account.level.daily_transaction_count;
        let monthly_transaction_count = walletDetails.account.level.monthly_transaction_count;
        let yearly_transaction_count = walletDetails.account.level.yearly_transaction_count;

        let daily_transaction_count_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.daily_transaction_count || 0);
        let monthly_transaction_count_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.monthly_transaction_count || 0);
        let yearly_transaction_count_used = formatDecimalNumbersWithLimit(walletDetails.account.used_limits.yearly_transaction_count || 0);

        let account_balance_limit_used = formatDecimalNumbersWithLimit(await accountBalanceUsed(walletDetails.account._id), 2)

        let transaction_amount_limit = walletDetails.account.level.transaction_amount_limit
        let topup_min_amount = walletDetails.account.level.topup_min_amount
        let topup_max_amount = walletDetails.account.level.topup_max_amount

        if (walletDetails.account.is_external_limit) {
            daily_sending_limit = walletDetails.account.external_limits.daily_sending_limit;
            monthly_sending_limit = walletDetails.account.external_limits.monthly_sending_limit;
            yearly_sending_limit = walletDetails.account.external_limits.yearly_sending_limit;

            daily_receiving_limit = walletDetails.account.external_limits.daily_receiving_limit;
            monthly_receiving_limit = walletDetails.account.external_limits.monthly_receiving_limit;
            yearly_receiving_limit = walletDetails.account.external_limits.yearly_receiving_limit;

            account_balance_limit = walletDetails.account.external_limits.account_balance_limit

            daily_transaction_count = walletDetails.account.external_limits.daily_transaction_count;
            monthly_transaction_count = walletDetails.account.external_limits.monthly_transaction_count;
            yearly_transaction_count = walletDetails.account.external_limits.yearly_transaction_count;

            transaction_amount_limit = walletDetails.account.external_limits.transaction_amount_limit
            topup_min_amount = formatDecimalNumbersWithLimit(walletDetails.account.external_limits.topup_min_amount)
            topup_max_amount = formatDecimalNumbersWithLimit(walletDetails.account.external_limits.topup_max_amount)

        }

        // RATE TO FIND THE LIMITS
        exchange_rate_in_usd = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD('USD', walletDetails.currency.code, 1), 6)

        daily_sending_limit_used = exchange_rate_in_usd * daily_sending_limit_used;
        monthly_sending_limit_used = exchange_rate_in_usd * monthly_sending_limit_used;
        yearly_sending_limit_used = exchange_rate_in_usd * yearly_sending_limit_used;

        daily_receiving_limit_used = exchange_rate_in_usd * daily_receiving_limit_used;
        monthly_receiving_limit_used = exchange_rate_in_usd * monthly_receiving_limit_used;
        yearly_receiving_limit_used = exchange_rate_in_usd * yearly_receiving_limit_used;

        account_balance_limit_used = exchange_rate_in_usd * account_balance_limit_used

        daily_sending_limit = exchange_rate_in_usd * daily_sending_limit;
        monthly_sending_limit = exchange_rate_in_usd * monthly_sending_limit;
        yearly_sending_limit = exchange_rate_in_usd * yearly_sending_limit;

        daily_receiving_limit = exchange_rate_in_usd * daily_receiving_limit;
        monthly_receiving_limit = exchange_rate_in_usd * monthly_receiving_limit;
        yearly_receiving_limit = exchange_rate_in_usd * yearly_receiving_limit;

        account_balance_limit = exchange_rate_in_usd * account_balance_limit
        topup_min_amount = exchange_rate_in_usd * topup_min_amount
        topup_max_amount = exchange_rate_in_usd * topup_max_amount

        transaction_amount_limit = exchange_rate_in_usd * transaction_amount_limit

        const response = {
            limits_used: {
                daily_sending_limit_used: parseFloat(formatDecimalNumbersWithLimit(daily_sending_limit_used, 2)?.toFixed(2)) || 0,
                monthly_sending_limit_used: parseFloat(formatDecimalNumbersWithLimit(monthly_sending_limit_used, 2)?.toFixed(2)) || 0,
                yearly_sending_limit_used: parseFloat(formatDecimalNumbersWithLimit(yearly_sending_limit_used, 2)?.toFixed(2)) || 0,
                daily_receiving_limit_used: parseFloat(formatDecimalNumbersWithLimit(daily_receiving_limit_used, 2)?.toFixed(2)) || 0,
                monthly_receiving_limit_used: parseFloat(formatDecimalNumbersWithLimit(monthly_receiving_limit_used, 2)?.toFixed(2)) || 0,
                yearly_receiving_limit_used: parseFloat(formatDecimalNumbersWithLimit(yearly_receiving_limit_used, 2)?.toFixed(2)) || 0,
                account_balance_limit_used: parseFloat(formatDecimalNumbersWithLimit(account_balance_limit_used, 2)?.toFixed(2)) || 0,
                daily_transaction_count_used: parseFloat(formatDecimalNumbersWithLimit(daily_transaction_count_used, 2)?.toFixed(2)) || 0,
                monthly_transaction_count_used: parseFloat(formatDecimalNumbersWithLimit(monthly_transaction_count_used, 2)?.toFixed(2)) || 0,
                yearly_transaction_count_used: parseFloat(formatDecimalNumbersWithLimit(yearly_transaction_count_used, 2)?.toFixed(2)) || 0,
            },
            limits: {
                daily_sending_limit: parseFloat(formatDecimalNumbersWithLimit(daily_sending_limit, 2)?.toFixed(2)) || 0,
                monthly_sending_limit: parseFloat(formatDecimalNumbersWithLimit(monthly_sending_limit, 2)?.toFixed(2)) || 0,
                yearly_sending_limit: parseFloat(formatDecimalNumbersWithLimit(yearly_sending_limit, 2)?.toFixed(2)) || 0,
                daily_receiving_limit: parseFloat(formatDecimalNumbersWithLimit(daily_receiving_limit, 2)?.toFixed(2)) || 0,
                monthly_receiving_limit: parseFloat(formatDecimalNumbersWithLimit(monthly_receiving_limit, 2)?.toFixed(2)) || 0,
                yearly_receiving_limit: parseFloat(formatDecimalNumbersWithLimit(yearly_receiving_limit, 2)?.toFixed(2)) || 0,
                account_balance_limit: parseFloat(formatDecimalNumbersWithLimit(account_balance_limit, 2)?.toFixed(2)) || 0,
                transaction_amount_limit: parseFloat(formatDecimalNumbersWithLimit(transaction_amount_limit, 2)?.toFixed(2)) || 0,
                daily_transaction_count: parseFloat(formatDecimalNumbersWithLimit(daily_transaction_count, 2)?.toFixed(2)) || 0,
                monthly_transaction_count: parseFloat(formatDecimalNumbersWithLimit(monthly_transaction_count, 2)?.toFixed(2)) || 0,
                yearly_transaction_count: parseFloat(formatDecimalNumbersWithLimit(yearly_transaction_count, 2)?.toFixed(2)) || 0,
            },
            topup_values: {
                topup_min_amount: parseFloat(formatDecimalNumbersWithLimit(topup_min_amount, 2)?.toFixed(2)) || 0,
                topup_max_amount: parseFloat(formatDecimalNumbersWithLimit(topup_max_amount, 2)?.toFixed(2)) || 0,
            },
        }

        const ciphertext = await encryption({
            status: true,
            message: "Limits fetched",
            data: response
        })

        res.status(200).send(ciphertext)

    } catch (err) {
        console.log(err);
        const error = {
            status: false,
            message: "Internal server error"
        };
        return res.status(500).send(error);
    }
}

const checkGeoFencingRestrictions = (geoFencingData, accountOriginCountry, accountLiveCountry) => {

    const allChecks = geoFencingData.checks || [];
    // chexk restrictions for both live and origin countries
    const restrictedForOrigin = allChecks.find(
        (check) =>
            check.isoCode === accountOriginCountry &&
            check.reason.includes("payment_request_origin")
    );

    const restrictedForLive = allChecks.find(
        (check) =>
            check.isoCode === accountLiveCountry &&
            check.reason.includes("payment_request_live")
    );

    console.log({
        restrictedForOrigin, restrictedForLive
    })

    return restrictedForOrigin || restrictedForLive;
};
module.exports.selectLocationForRequestPaymentBot = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data)
        const { lat, long, recipientId, accept } = data;

        if (!recipientId) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(400).send(error);
        }

        const chatbotDetails = await InstaChatbot.findOne({ recipient: recipientId });

        if (!chatbotDetails) {
            let error = await encryption({
                status: false,
                message: "Chatbot not found!"
            });
            return res.status(400).send(error);
        }

        if (chatbotDetails?.payment_request?.lat && chatbotDetails?.payment_request?.long || (chatbotDetails?.last_message !== "location_selection")) {
            let error = await encryption({
                status: false,
                message: "Location already selected for this request!"
            });
            return res.status(400).send(error);
        }

        if (!accept) {
            // User did not allow location
            const rejectPayload = {
                template_type: "generic",
                elements: [
                    {
                        title: "It seems like you declined to share your location. Please share the location to be able to send a payment request, this adds credibility to your payment request.",
                        buttons: [
                            {
                                type: "web_url",
                                title: "Share Location",
                                url: `https://my.insta-pay.ch/chatbot/get-location?recipient_id=${recipientId}`,
                                webview_height_ratio: "full"
                            },
                            {
                                type: "postback",
                                title: 'Cancel',
                                payload: "main_menu",
                            },
                        ],
                    },
                ],
            };
            const rejectData = {
                sender: { id: recipientId },
            };
            await sendTemplate(rejectData, recipientId, rejectPayload, "location_selection");

            let ciphertext = await encryption({
                status: false,
                message: "Location permission not granted by the user."
            });
            return res.status(200).send(ciphertext);
        }

        // Finding geo location
        const geoData = await getGeocodeData(lat, long);

        console.log(geoData, "geoData");

        if (!geoData.status) {
            let error = await encryption({
                status: false,
                message: "Location not found or not valid!"
            });
            return res.status(400).send(error);
        }

        // request receiver details
        const recipientAccount = await Account.findById(chatbotDetails?.request_details?.beneficiary);
        if (!recipientAccount) {
            let error = await encryption({
                status: false,
                message: "Recipient details not found!"
            });
            return res.status(400).send(error);
        }

        const senderAccount = await Account.findOne({ insta_subscriber_id: recipientId })

        const data1 = {
            sender: { id: recipientId },
        };

        const accountOriginCountry = senderAccount?.country_iso_code;
        const accountLiveCountry = Object.keys(countryIso3).find(key => countryIso3[key].toLowerCase() === geoData?.data?.address?.country_code?.toLowerCase())

        const geoFencingData = await UserPaymentPreferenceModel.findOne({ account: recipientAccount._id });


        if (geoFencingData) {
            // Geofencing check
            const isRestricted = checkGeoFencingRestrictions(geoFencingData, accountOriginCountry, accountLiveCountry);

            if (isRestricted) {
                const templatePayload = {
                    template_type: "generic",
                    elements: [
                        {
                            title: `Unsupported Recipient!`,
                            subtitle: `It looks like ${recipientAccount?.first_name} ${recipientAccount?.last_name} only accepts payments from specific countries or locations, and your account’s country or location isn’t on the list. Please check with ${recipientAccount?.first_name} ${recipientAccount?.last_name} for further assistance.`,
                            buttons: [
                                {
                                    type: "postback",
                                    title: 'Main Menu',
                                    payload: "main_menu",
                                },
                            ],
                        },
                    ],
                };
                await sendTemplate(data1, recipientId, templatePayload, "4");
                const ciphertext = await encryption({
                    status: true,
                    message: "Location not supported by recipient!"
                });
                return res.status(200).send(ciphertext);
            }
        }

        // Save location details
        chatbotDetails.payment_request.lat = lat;
        chatbotDetails.payment_request.long = long;

        await chatbotDetails.save();

        // Location selection template message
        const templatePayload = {
            template_type: "generic",
            elements: [
                {
                    title: `Thank you for verifying your location. Please proceed.`,
                    buttons: [
                        {
                            type: "postback",
                            title: 'Proceed',
                            payload: "proceed_request_location",
                        },
                        {
                            type: "postback",
                            title: 'Main Menu',
                            payload: "main_menu",
                        },
                    ],
                },
            ],
        };

        await sendTemplate(data1, recipientId, templatePayload, "location_selection");

        const ciphertext = await encryption({
            status: true,
            message: "Location selected!"
        });
        return res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error"
        });
        return res.status(500).send(error);
    }
};
module.exports.selectLocationForRequestPaymentTelegram = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data)
        const { lat, long, recipientId, accept } = data;

        if (!recipientId) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(400).send(error);
        }

        const chatbotDetails = await TelegramBotModel.findOne({ recipient: recipientId });

        if (!chatbotDetails) {
            let error = await encryption({
                status: false,
                message: "Chatbot not found!"
            });
            return res.status(400).send(error);
        }

        if (chatbotDetails?.request?.lat && chatbotDetails?.request?.long || (chatbotDetails?.last_message !== "req_pay_location_selection")) {
            let error = await encryption({
                status: false,
                message: "Location already selected for this request!"
            });
            return res.status(400).send(error);
        }

        if (!accept) {
            await sendButtons(recipientId, "It seems like you declined to share your location. Please share the location to be able to send a payment request, this adds credibility to your payment request.", [
                [{ text: "📍 Share Location", url: `https://my.insta-pay.ch/chatbot/get-location?recipient_id=${recipientId}&platform=telegram` }],
                [{ text: "❌ Cancel", callback_data: "main_menu" }]
            ]);

            return res.status(200).send(await encryption({
                status: false,
                message: "Location permission not granted by the user."
            }));
        }

        // Finding geo location
        const geoData = await getGeocodeData(lat, long);

        console.log(geoData, "geoData");

        if (!geoData.status) {
            let error = await encryption({
                status: false,
                message: "Location not found or not valid!"
            });
            return res.status(400).send(error);
        }

        // request receiver details
        const recipientAccount = await Account.findById(chatbotDetails?.request?.beneficiary);
        if (!recipientAccount) {
            let error = await encryption({
                status: false,
                message: "Recipient details not found!"
            });
            return res.status(400).send(error);
        }

        const senderAccount = await Account.findOne({ insta_subscriber_id: recipientId });
        const accountOriginCountry = senderAccount?.country_iso_code;
        const accountLiveCountry = Object.keys(countryIso3).find(key => countryIso3[key].toLowerCase() === geoData?.data?.address?.country_code?.toLowerCase());

        const geoFencingData = await UserPaymentPreferenceModel.findOne({ account: recipientAccount._id });
        if (geoFencingData) {
            const isRestricted = checkGeoFencingRestrictions(geoFencingData, accountOriginCountry, accountLiveCountry);
            if (isRestricted) {
                await sendButtons(recipientId, `❌ Unsupported Recipient!\n\nIt looks like ${recipientAccount?.first_name} ${recipientAccount?.last_name} only accepts payments from specific countries or locations, and your account’s country or location isn’t on the list. Please check with them for further assistance.`, [
                    [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
                ]);

                return res.status(200).send(await encryption({
                    status: true,
                    message: "Location not supported by recipient!"
                }));
            }
        }

        // Save location details
        chatbotDetails.request.lat = lat;
        chatbotDetails.request.long = long;

        await chatbotDetails.save();

        // Location selection template message
        await sendButtons(recipientId, "✅ Thank you for verifying your location. Please proceed.", [
            [{ text: "➡️ Proceed", callback_data: "req_pay_location_proceed" }],
            [{ text: "🏠 Main Menu", callback_data: "main_menu" }]
        ]);

        const ciphertext = await encryption({
            status: true,
            message: "Location selected!"
        });
        return res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        const error = await encryption({
            status: false,
            message: "Internal server error"
        });
        return res.status(500).send(error);
    }
};


