const axios = require('axios');
const { encryption, decryption } = require('../configurations/Encryption')
const SecurityQuestion = require('../models/Security-Question.model')
const Account = require('../models/Account.model')
const User = require('../models/User.model')
const Company = require('../models/Company.model')
const Wallet = require('../models/Wallet.model');
const RequestReview = require('../models/RequestReview.model');
const Document = require('../models/Document.model');
const Schedule = require("../models/Schedule.model");
const Transaction = require('../models/Transaction.model');
const AccountLevel = require('../models/Account-Level.model');

const mongoose = require('mongoose');
const moment = require('moment-timezone');

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require('multer');
const { convertCurrency, getTemplateId } = require('../utils/helpers');
const { sendMailsExport } = require('../utils/sendEmail');
const { addNotification } = require('../utils/generateNotification');
const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });



// const apiKey = process.env.GETID_APIKEY;
const apiKey = process.env.GETID_APIKEY_LIVE;
// const baseUrl = 'https://kemitkingdom.sb.getid.dev/api/v1/tokenized-url';
const baseUrl = 'https://kemitkingdom.getid.ee/api/v1/tokenized-url';

// const uploadFile = (accountId, file) => {
//     return new Promise((resolve, reject) => {
//         const bucketName = process.env.AWS_BUCKET_NAME;
//         const params = {
//             Bucket: bucketName,
//             Key: `additional_documents/${accountId}/${file.originalname}`,
//             Body: file.buffer
//         };

//         s3.upload(params, (err, resOfS3) => {
//             if (err) {
//                 console.error('Error uploading file:', err);
//                 reject(err);
//             } else {
//                 console.log('File uploaded successfully. File URL:', resOfS3);
//                 resolve({
//                     url: resOfS3?.Location,
//                     key: resOfS3?.key
//                 });
//             }
//         });
//     });
// };

module.exports.userVerification = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        const external_id = req.params.id;
        // const external_id = "6606a50ceb4179be12023883";
        const { first_name, last_name, address, dob, nationality, language_code } = data;
        // const { first_name = "Sarfraz", last_name = "Ahmad", address = "Jam Kanda Goth Bin Qasim Town Malir, Karachi", dob = "29-08-1999", nationality = "FRA", language_code = "fr" } = data;
        if (!first_name || !last_name || !address || !nationality || !language_code) {
            let error = await encryption({
                status: false,
                message: "Required field are missing."
            })
            res.status(400).send(error);
        } else {

            const requestData = {
                name: 'instapay',
                externalId: external_id,
                profile: {
                    'First name': first_name,
                    'Last name': last_name,
                    // 'Address': address,
                    // 'Date of birth': dob,
                    // 'Nationality': nationality,
                },
                locale: language_code,
                ttl: '60',
            };

            const headers = {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
            };

            axios.post(`${baseUrl}?name=${requestData.name}&externalId=${requestData.externalId}`, requestData, {
                headers: headers,
            }).then(async (response) => {
                const tokenizedLink = response.data.url;
                // console.log(tokenizedLink);
                var ciphertext = await encryption({ status: true, tokenized_link: tokenizedLink })
                res.status(200).json(ciphertext);
            }).catch(async (err) => {
                console.error(err)
                let error = await encryption({
                    status: false,
                    message: "An error occurred while processing the request."
                })
                res.status(400).send(error);
            })
        }

    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getSecurityQuestion = async (req, res) => {
    try {
        // let arr = [
        //     { "language": "English", "code": "en" },
        //     { "language": "Chinese", "code": "zh" },
        //     { "language": "French", "code": "fr" },
        //     { "language": "German", "code": "de" },
        //     { "language": "Hindi", "code": "hi" },
        //     { "language": "Indonesian", "code": "id" },
        //     { "language": "Italian", "code": "it" },
        //     { "language": "Dutch", "code": "nl" },
        //     { "language": "Yoruba", "code": "yo" },
        //     { "language": "Urdu", "code": "ur" },
        //     { "language": "Polish", "code": "pl" },
        //     { "language": "Portuguese", "code": "pt" },
        //     { "language": "Russian", "code": "ru" },
        //     { "language": "Spanish", "code": "es" },
        //     { "language": "Turkish", "code": "tr" },
        //     { "language": "Ukrainian", "code": "uk" },
        //     { "language": "Arabic", "code": "ar" }
        // ]
        // arr.map(async (lang) => {
        //     let update = await SecurityQuestion.updateMany({ language: lang.language }, { $set: { language_code: lang.code } })
        //     console.log(lang.language, update);
        // })
        // let account_id = req.params.account_id;
        // let accountDetails = await Account.findOne({ _id: account_id })
        // let language_code = accountDetails?.language ? accountDetails?.language.toLowerCase() : "en"
        // console.log(language_code);
        SecurityQuestion.find().then(async (questionsList) => {
            if (questionsList.length) {
                var ciphertext = await encryption({
                    status: true,
                    message: "Security questions!",
                    questionsList
                })
                res.status(200).json(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "No security question found."
                })
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "An error occurred while getting security questions."
            })
            res.status(400).send(error);
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.setSecurityQuestion = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }, { account_type: true, user: true, company: true }).populate(['user', 'company']).then(async (account) => {
            if (account) {
                // let data = await decryption(req.body.data)
                let data = req.body;
                console.log(data);
                var { question1, answer1, question2, answer2, question3, answer3 } = data.data || data;
                let sq_ids = [];
                let sqObj = {};
                if (question1) { sq_ids.push(new mongoose.Types.ObjectId(question1)); sqObj['question1'] = question1; sqObj['answer1'] = answer1; }
                if (question2) { sq_ids.push(new mongoose.Types.ObjectId(question2)); sqObj['question2'] = question2; sqObj['answer2'] = answer2; }
                if (question3) { sq_ids.push(new mongoose.Types.ObjectId(question3)); sqObj['question3'] = question3; sqObj['answer3'] = answer3; }

                let checkQuestionId = await SecurityQuestion.find({ _id: { $in: sq_ids } }, { _id: true })
                if (checkQuestionId.length == sq_ids.length && sq_ids.length != 0) {
                    if (account.account_type == 'individual') {
                        User.findByIdAndUpdate({ _id: account.user._id }, sqObj, { new: true }).then(async (user) => {
                            account['user'] = user;
                            let ciphertext = await encryption({
                                status: true,
                                message: "Question updated successfully",
                                account
                            })
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "An error occurred while updating security questions."
                            })
                            res.status(400).send(error);
                        })
                    } else if (account.account_type == 'business') {
                        Company.findByIdAndUpdate({ _id: account.company._id }, sqObj, { new: true }).then(async (company) => {
                            account['company'] = company;
                            let ciphertext = await encryption({
                                status: true,
                                message: "Question updated successfully",
                                account
                            })
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "An error occurred while updating security questions."
                            })
                            res.status(400).send(error);
                        })
                    }
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Question not found."
                    })
                    res.status(404).send(error);
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Account not found."
                })
                res.status(404).send(error);
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "An error occurred while finding account."
            })
            res.status(400).send(error);
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getUserDetails = async (req, res) => {
    try {
        let username = req.params.username;

        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }

        const account = await Account.findOne({ username },
            {
                country_name: true,
                account_type: true,
                about_me: true,
                user: true,
                insta_username: true,
                address: true,
                city: true,
                _id: true,
                postal_code: true,
                country_iso_code: true,
                email: true,
                phone: true
            }
        ).populate('user', {
            "first_name": 1,
            "last_name": 1,
            "about_me": 1,
            "kyc_status": 1,
            "_id": 0
        }).populate("level")
        const { user, country_name, account_type, about_me, address, city, _id, postal_code, country_iso_code, email, phone, insta_username } = account;
        const { first_name, last_name, kyc_status } = user;
        if (account) {
            let ciphertext = await encryption({
                status: true,
                message: "User details found",
                userProfileInfo: {
                    first_name,
                    last_name,
                    address,
                    city,
                    country_name,
                    account_type,
                    about_me,
                    postal_code,
                    country_iso_code,
                    kyc_status,
                    _id,
                    insta_username,
                    email,
                    phone,
                    level: account.level
                },
            });
            return res.status(200).send(ciphertext);
        } else {

            let error = await encryption({
                status: false,
                message: "No user found with the provided username.",
            });
            res.status(404).send(error)

        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getUserProfile = async (req, res) => {
    try {
        let username = req.params.username;
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }

        const account = await Account.findOne({ username });

        if (account) {
            const { profileImage } = account;
            console.log(profileImage, "lastname")

            let ciphertext = await encryption({
                status: true,
                message: "User details found",
                profilePicture: {
                    profileImage: profileImage.url,

                },
            });
            return res.status(200).send(ciphertext);
        } else {
            let error = await encryption({
                status: false,
                message: "No user found with the provided username.",
            });
            res.status(404).send(error)

        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getUserCoverImage = async (req, res) => {
    try {
        let username = req.params.username;
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }

        const account = await Account.findOne({ username });

        if (account) {
            const { coverImage } = account;

            let ciphertext = await encryption({
                status: true,
                message: "User details found",
                coverPicture: {
                    coverImage: coverImage.url,

                },
            });
            return res.status(200).send(ciphertext);
        } else {
            let error = await encryption({
                status: false,
                message: "No user found with the provided username.",
            });
            res.status(404).send(error)

        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getUserDefaultWallet = async (req, res) => {
    try {
        let username = req.params.username;
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }

        const account = await Account.findOne({ username });


        if (account) {
            Wallet.findOne({
                account: account._id,
                default: true
            }).then(async (wallet) => {
                console.log(wallet)
                let ciphertext = await encryption({
                    status: true,
                    message: "Default wallet details",
                    defaultWallet: wallet,

                });
                return res.status(200).send(ciphertext);
            }).catch(async (err) => {
                let ciphertext = await encryption({
                    status: true,
                    message: "Something went wrong while getting wallet details",

                });
                return res.status(400).send(ciphertext);
            })

        } else {
            let error = await encryption({
                status: false,
                message: "No user found with the provided username.",
            });
            res.status(404).send(error)

        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getUserReviews = async (req, res) => {
    try {
        let { username, user_type, skip, limit } = req.params;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }
        const account = await Account.findOne({ username });
        let reviews;
        if (account) {
            let query = {};

            if (user_type === "buyer") {
                query.seller = account._id;
                query.review_type = "buyer_to_seller"
                query.delete_status = false,
                    reviews = await RequestReview.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('linked_review')
                        .populate(
                            {
                                path: 'buyer',
                                populate: [{ path: 'user' }, { path: 'company' }]
                            }
                        )

            } else if (user_type === "seller") {
                query.buyer = account._id;
                query.review_type = "seller_to_buyer";
                query.delete_status = false,
                    reviews = await RequestReview.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('linked_review')
                        .populate(
                            {
                                path: 'seller',
                                populate: [{ path: 'user' }, { path: 'company' }]
                            }
                        )

            } else {
                let error = await encryption({
                    status: false,
                    message: "Invalid user type",
                });
                return res.status(400).send(error);
            }
            const totalNumberOfReviews = await RequestReview.countDocuments(query);


            const sumOfRatings = reviews.reduce((sum, review) => sum + review.rating, 0);

            const averageRating = totalNumberOfReviews > 0 ? sumOfRatings / totalNumberOfReviews : 0;

            let ciphertext = await encryption({
                status: true,
                message: "User reviews!",
                userReviews: {
                    totalNumberOfReviews,
                    reviews,
                    averageRating: averageRating,
                },
            });
            return res.status(200).send(ciphertext)


        } else {
            let error = await encryption({
                status: false,
                message: "No user found with the provided username.",
            });
            res.status(404).send(error)

        }
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getUserDocuments = async (req, res) => {
    try {
        let { username, skip, limit } = req.params;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }
        if (!username) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }
        const account = await Account.findOne({ username });
        if (account) {
            Document.find({ account: account._id }).sort({ createdAt: -1 }).skip(skip).limit(limit).then(async (result) => {
                if (!result || result.length <= 0) {
                    let error = await encryption({
                        status: false,
                        message: "You don't have documents."
                    });
                    res.status(400).send(error);
                } else {
                    let error = await encryption({
                        status: true,
                        message: "Documents Found.",
                        result
                    });
                    res.status(200).send(error);
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while finding documents."
                });
                res.status(400).send(error);
            });
        } else {
            let error = await encryption({
                status: false,
                message: "No user found with the provided username.",
            });
            res.status(404).send(error)

        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
}

module.exports.getUserProfileCompletion = async (req, res) => {
    try {
        const account_id = req.params.account_id;

        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }

        if (!mongoose.Types.ObjectId.isValid(account_id)) {
            let error = await encryption({
                status: false,
                message: "Invalid account ID.",
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id).populate(['user', 'company']);

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found",
            });
            return res.status(404).send(error);
        }

        let completedFields = 0;
        let fields = {};
        let totalFields = 0;
        // let securityQuestionsCount = 0;

        const checkFields = (fieldName, value) => {
            totalFields++;
            if (value) {
                completedFields++;
                fields[fieldName] = true;
            } else {
                fields[fieldName] = false;
            }
        };

        // const checkSecurityQuestions = (questionNumber, answer) => {
        //     if (questionNumber && answer) {
        //         securityQuestionsCount++;
        //     }
        // };

        checkFields('phone', account.phone);
        checkFields('country', account.country);
        // checkFields('address', account.address);
        checkFields('city', account.city);
        // checkFields('postal_code', account.postal_code);
        checkFields('username', account.username);
        checkFields('country_name', account.country_name);
        // checkFields('email', account.email)
        checkFields('timezone', account.timezone);
        checkFields('dob', account.dob);

        if (account.account_type === 'individual') {
            const user = account.user;
            checkFields('first_name', user.first_name);
            checkFields('last_name', user.last_name);
            // checkSecurityQuestions(user.question1, user.answer1);
            // checkSecurityQuestions(user.question2, user.answer2);
            // checkSecurityQuestions(user.question3, user.answer3);
        } else if (account.account_type === 'business') {
            const company = account.company;
            checkFields('company_name', company.company_name);
            // checkSecurityQuestions(company.question1, company.answer1);
            // checkSecurityQuestions(company.question2, company.answer2);
            // checkSecurityQuestions(company.question3, company.answer3);
        } else {
            let error = await encryption({
                status: false,
                message: "Invalid account type",
            });
            return res.status(400).send(error);
        }

        let response = {
            completedBasicFields: completedFields,
            totalBasicFields: totalFields,
            basicFields: fields,
            kycStatus: { individualStatus: account.account_type === "individual" ? account.user.kyc_all_status : account.company.kyc_all_status, overAllStatus: account.account_type === "individual" ? account.user.kyc_status : account.company.kyc_status },
            // securityQuestionsCount,
            completedProfilePercent: (completedFields / totalFields) * 100,
        };

        let ciphertext = await encryption({
            status: true,
            fieldsInformation: response,
        });
        return res.status(200).send(ciphertext);

    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.kycAdditionalFilesAdmin = async (req, res) => {
    try {
        let account_id = req.params.account_id;
        let data = await decryption(req.body.data)
        const { documents } = data;
        if (!account_id || !documents || !Array.isArray(documents)) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return { status: 400, response: error };
        }
        Account.findById(account_id).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found!",
                });
                res.status(400).send(error);
            } else {
                User.findOne({ account: account_id }).then(async (user) => {
                    if (!user) {
                        let error = await encryption({
                            status: false,
                            message: "User not found!",
                        });
                        res.status(400).send(error);
                    } else {
                        const additionalFiles = documents.map(file => ({
                            document_type: file.filename,
                            desc: file.desc,
                            file_type: "",
                            file_link: "",
                            status: "requested",
                        }));
                        user.kyc_additional_file = [...user.kyc_additional_file, ...additionalFiles];

                        user.save()
                            .then(async (savedUser) => {
                                const notificationObj = {
                                    title: 'KYC additional files request',
                                    desc: 'Additional files have been requested by Instapay for your KYC verification.',
                                    type: 'settings',
                                    status: 'unread',
                                    to: account_id,
                                }

                                addNotification(notificationObj)
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Additional required files updated",
                                    savedUser
                                });
                                res.status(200).send(ciphertext);
                            })
                            .catch(async (err) => {
                                let error = await encryption({
                                    status: false,
                                    message: "Error saving additional files.",
                                    savedUser
                                });
                                res.status(404).send(error);
                            });
                    }
                }).catch(async (err) => {
                    console.log(err)
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding the account!",
                    });
                    res.status(400).send(error);
                })
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding the account!",
            });
            res.status(400).send(error);
        })
    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.kycUpdateFilesStatus = async (req, res) => {
    try {
        const account_id = req.params.account_id
        let data = await decryption(req.body.data)
        const { filesStatus } = data;

        if (!account_id || !filesStatus || !Array.isArray(filesStatus)) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return res.status(400).send(error);
        }

        Account.findById(account_id).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found!",
                });
                res.status(400).send(error);
            } else {
                User.findOne({ account: account_id }).then(async (user) => {
                    if (!user) {
                        let error = await encryption({
                            status: false,
                            message: "User not found!",
                        });
                        res.status(400).send(error);
                    } else {
                        filesStatus.forEach(async (update) => {
                            const { file_id, status } = update;
                            const fileToUpdate = user?.kyc_additional_file.find(file => file._id.equals(file_id))

                            if (fileToUpdate) {
                                fileToUpdate.status = status;
                            }
                        })

                        user.save().then(async (savedUser) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "File statuses updated successfully",
                                savedUser
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Error saving updated file statuses",
                                savedUser
                            });
                            res.status(404).send(error);
                        });
                    }
                }).catch(async (err) => {
                    console.log(err)
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while finding the account!",
                    });
                    res.status(400).send(error);
                })
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding the account!",
            });
            res.status(400).send(error);
        })


    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.uploadAdditionalFile = async (req, res) => {
    try {
        const account_id = req.params.account_id;
        const file_id = req.body.file_id
        const file_type = req.body.file_type

        if (!account_id || !file_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const data = req.file;
        const bucketName = process.env.AWS_BUCKET_NAME;
        const params = {
            Bucket: bucketName,
            Key: `additional_files/${account_id}/${data.originalname}`,
            Body: data.buffer
        };

        User.findOne({ account: account_id }).then(async (user) => {
            if (!user) {
                let error = await encryption({
                    status: false,
                    message: "User not found!",
                });
                res.status(400).send(error);
            } else {
                let existingFile;
                for (const file of user.kyc_additional_file) {
                    if (file._id.toString() === file_id) {
                        existingFile = file;
                        break;
                    }
                }
                if (existingFile?.key) {
                    const bucketName = process.env.AWS_BUCKET_NAME;
                    await s3.deleteObject({ Bucket: bucketName, Key: existingFile?.key }).promise();

                    s3.upload(params, async (err, resOfS3) => {
                        if (err) {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while uploading file."
                            });
                            res.status(400).send(error);
                        } else {
                            if (resOfS3?.key) {
                                const s3Object = {
                                    key: resOfS3?.key,
                                    url: resOfS3?.Location,
                                    // ETag: resOfS3?.ETag,
                                };
                                User.updateOne({ "kyc_additional_file._id": file_id },
                                    {
                                        $set: {
                                            "kyc_additional_file.$.file_link": s3Object.url, "kyc_additional_file.$.key": s3Object.key, "kyc_additional_file.$.file_type": file_type, "kyc_additional_file.$.status": "uploaded",
                                        }
                                    }
                                ).then(async (result) => {
                                    let ciphertext = await encryption({
                                        status: true,
                                        message: "File link updated successfully."
                                    });
                                    res.status(200).send(ciphertext);

                                }).catch(async (updateErr) => {
                                    console.log(updateErr);
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while updating file link."
                                    });
                                    res.status(500).send(error);
                                });
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while uploading file."
                                });
                                res.status(400).send(error);
                            }
                        }
                    });
                } else {
                    s3.upload(params, async (err, resOfS3) => {
                        if (err) {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while uploading file."
                            });
                            res.status(400).send(error);
                        } else {
                            if (resOfS3?.key) {
                                const s3Object = {
                                    key: resOfS3?.key,
                                    url: resOfS3?.Location,
                                    // ETag: resOfS3?.ETag,
                                };
                                User.updateOne({ "kyc_additional_file._id": file_id },
                                    {
                                        $set: {
                                            "kyc_additional_file.$.file_link": s3Object.url, "kyc_additional_file.$.key": s3Object.key, "kyc_additional_file.$.file_type": file_type, "kyc_additional_file.$.status": "uploaded"
                                        }
                                    }
                                ).then(async (result) => {
                                    let ciphertext = await encryption({
                                        status: true,
                                        message: "File link updated successfully."
                                    });
                                    res.status(200).send(ciphertext);

                                }).catch(async (updateErr) => {
                                    console.log(updateErr);
                                    let error = await encryption({
                                        status: false,
                                        message: "Something went wrong while updating file link."
                                    });
                                    res.status(500).send(error);
                                });
                            } else {
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while uploading file."
                                });
                                res.status(400).send(error);
                            }
                        }
                    });
                }
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting user details!",
            });
            res.status(400).send(error);
        })
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error."
        });
        res.status(500).send(error);
    }
};

module.exports.getKYCAdditionalFiles = async (req, res) => {
    try {
        const account_id = req.params.account_id
        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        User.findOne({ account: account_id }).then(async (user) => {
            if (!user) {
                let error = await encryption({
                    status: false,
                    message: "User not found!",
                });
                return res.status(400).send(error);
            } else {
                let kycAdditionalFiles = user.kyc_additional_file || [];

                let ciphertext = await encryption({
                    status: true,
                    message: "Kyc additional filess.",
                    kycAdditionalFiles
                });
                return res.status(200).send(ciphertext);
            }
        })
    }
    catch (err) {
        let error = encryption({
            status: false,
            message: "Internal Server Error"
        })
        return res.status(500).send(error)
    }
}

module.exports.deleteFileRequest = async (req, res) => {
    try {
        const account_id = req.params.account_id;
        const file_id = req.params.file_id;
        if (!account_id || !file_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        User.findOne({ account: account_id }).then(async (user) => {
            if (!user) {
                let error = await encryption({
                    status: false,
                    message: "User not found!",
                });
                res.status(400).send(error);
            } else {
                const targetFileIndex = user.kyc_additional_file.findIndex(file => file._id.equals(file_id))

                if (targetFileIndex !== -1) {
                    user.kyc_additional_file.splice(targetFileIndex, 1)
                    // console.log(user.kyc_additional_file.splice(targetFileIndex, 1), targetFileIndex)
                    user.save().then(async (savedUser) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "File request deleted successfully",
                            additionalFiles: savedUser.kyc_additional_file
                        });
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Error saving user after deleting file request",
                            savedUser
                        });
                        res.status(500).send(error);
                    });
                }
                else {
                    let error = await encryption({
                        status: false,
                        message: "File not found in the user's additional files",
                    });
                    return res.status(404).send(error);
                }
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding the user!",
            });
            res.status(400).send(error);
        });
    }
    catch (err) {
        let error = encryption({
            status: false,
            message: "Internal Server Error"
        })
        return res.status(500).send(error)
    }
}

module.exports.getAccountDetails = async (req, res) => {
    try {
        const account_id = req.params.account_id

        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required field are missing."
            })
            res.status(400).send(error);
        } else {
            Account.findById(account_id).populate(['user', 'company']).then(async (account) => {
                if (!account) {
                    let error = await encryption({
                        status: false,
                        message: "Account not found!",

                    });
                    return res.status(400).send(error);
                } else {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Account details!",
                        account
                    });
                    return res.status(400).send(ciphertext);
                }
            }).catch(async (err) => {
                let ciphertext = await encryption({
                    status: false,
                    message: "Something went wrong while getting account details",

                });
                return res.status(400).send(ciphertext);
            })
        }
    } catch (err) {
        let error = encryption({
            status: false,
            message: "Internal Server Error"
        })
        return res.status(500).send(error)
    }
}

module.exports.cancelSchedule = async (req, res) => {
    try {
        const scheduleId = req.params.scheduleId;
        console.log(scheduleId);
        const schedule = await Schedule.findById(scheduleId);

        if (!schedule) {
            let error = await encryption({
                status: false,
                message: "Required field are missing."
            })
            return res.status(400).send(error);
        }



        if (schedule.status === 'processing') {

            // deducting the reserved amount from wallet and saving into the wallet balance
            if (schedule.type === "payment") {
                console.log(schedule)
                const payment = schedule.payment.amount;
                const walletDetails = await Wallet.findById(schedule.payment.sender_wallet)

                if (walletDetails.balance.reserved < payment) {
                    let error = await encryption({
                        status: false,
                        message: "Insufficient reserved balance to reverse."
                    });
                    return res.status(400).send(error);
                }

                if (walletDetails.balance.reserved - payment < 0) {
                    let error = await encryption({
                        status: false,
                        message: "This operation would result in a negative reserved balance."
                    });
                    return res.status(400).send(error);
                }


                walletDetails.balance.reserved -= payment;
                walletDetails.balance.available += payment;
                await walletDetails.save();
            }
            schedule.status = 'declined';
            await schedule.save();

            let ciphertext = await encryption({
                status: true,
                message: "Schedule has been canceled"
            });
            return res.status(200).send(ciphertext);
        } else if (schedule.status === 'completed') {
            let ciphertext = await encryption({
                status: true,
                message: "Schedule cannot be canceled as it is already completed"
            });
            return res.status(422).send(ciphertext);
        } else if (schedule.status === 'declined') {
            let error = await encryption({
                status: false,
                message: "Schedule already declined"
            });
            return res.status(400).send(error);
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error"
        });
        return res.status(500).send(error);
    }
}

module.exports.chargeKYCAmount = async (req, res) => {
    try {
        const { account_id, wallet_id, occupation, desc, source_of_funds } = req.body;
        if (!account_id || !wallet_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        const account = await Account.findOne({ _id: account_id, active: true }).populate(['country', 'user'])

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(400).send(error);
        }

        if (account?.kyc_verification_paid) {
            let error = await encryption({
                status: false,
                message: "KYC already paid"
            });
            return res.status(400).send(error);
        }

        let walletDetails = await Wallet.findOne({
            $and: [{ _id: wallet_id }, { wallet_type: "insta" }, { status: 'active' }, {
                $or: [
                    { $and: [{ admin_blocked: false }, { blocked: false }] }, // Both admin_blocked and blocked are false
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] }, // admin_blocked doesn't exist and blocked is false
                    { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] }, // admin_blocked is false and blocked doesn't exist
                    { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] } // Both admin_blocked and blocked don't exist
                ]
            }]
        }).populate('account')

        if (!walletDetails) {
            let error = await encryption({
                status: false,
                message: "Wallet not found"
            });
            return res.status(400).send(error);
        }

        let kycVerificationCharges = account?.country?.kyc_fee;

        const exchangedAmount = await convertCurrency('USD', walletDetails.currency.code, kycVerificationCharges);

        if (exchangedAmount > walletDetails.balance.available) {
            let error = await encryption({
                status: false,
                message: "Insufficient balance"
            });
            return res.status(400).send(error);
        }

        walletDetails.balance.available = walletDetails.balance.available - exchangedAmount;
        await walletDetails.save();

        let ref = 'tr_' + Date.now().toString();

        const senderTimezone = account?.timezone || "UTC"

        const senderCurrentTime = moment().tz(senderTimezone).format();

        let transactionObj = {
            reference_id: ref,
            type: "instant",
            transaction_type: 'debit',
            service_type: 'kyc_verification',
            payment_type: "wallet",
            status: 'completed',
            purpose: "",
            description: "",
            currency: { code: walletDetails.currency.code, symbol: walletDetails.currency.symbol },
            amount: exchangedAmount,
            fee: 0,
            fee_type: "",
            markup: 0,
            markup_currency: "",
            exchange_rate: 0,
            exchange_rate_markup: 0,
            total: exchangedAmount,
            wallet_id: walletDetails.wallet_id,
            wallet: walletDetails._id,
            account: account_id,
            sender: account_id,
            receiver: null,
            current_balance: walletDetails.balance.available,
            timeline: [
                {
                    status: 'COMPLETED',
                    date: senderCurrentTime,
                }
            ]
        };

        await Transaction.create(transactionObj);

        account.kyc_verification_paid = true;
        account.user.kyc_status = 'initiated';
        account.user.desc = desc;
        account.user.occupation = occupation;
        account.user.source_of_funds = source_of_funds
        await account.user.save();
        await account.save();

        let ciphertext = await encryption({
            status: true,
            message: "KYC amount charged successfully"
        });

        return res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error"
        });
        return res.status(500).send(error);
    }
}

module.exports.updateSourceOfFunds = async (req, res) => {
    try {
        const data = await decryption(req.body.data);
        // const data = req.body
        const { account_id, source_of_funds } = data;
        if (!account_id || !source_of_funds) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findOne({ _id: account_id, active: true }).populate('user');

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(400).send(error);
        }

        account.user.source_of_funds = source_of_funds;
        await account.user.save();

        let ciphertext = await encryption({
            status: true,
            message: "Source of funds updated successfully"
        });

        return res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error"
        });
        return res.status(500).send(error);
    }
}
module.exports.updateKYCStatus = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data);
        const { account_id, status } = data;
        if (!account_id || !status) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        const account = await Account.findOne({ _id: account_id, active: true }).populate('user');

        if (!account) {
            let error = await encryption({
                status: false,
                message: "Account not found"
            });
            return res.status(400).send(error);
        }

        await handleKYCStatus(account, status);

        account.user.kyc_status = status;
        await account.user.save();
        await account.save();

        let ciphertext = await encryption({
            status: true,
            message: "KYC status updated successfully"
        });

        return res.status(200).send(ciphertext);
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal Server Error"
        });
        return res.status(500).send(error);
    }
}

async function handleKYCStatus(account, status) {
    let levelNo = 1;
    let templateId, subject, templateName;

    switch (status) {
        case "approved":
            levelNo = 2;
            templateName = "KYC Approved";
            subject = "InstaPay KYC Approved";
            break;

        case "declined":
            templateName = "KYC Declined";
            subject = "InstaPay KYC Declined";
            break;

        case "needs-review":
            templateName = "KYC Needs Review";
            subject = "InstaPay KYC Needs Review";
            break;

        default:
            console.log(`No specific action for status: ${status}`);
            return;
    }

    const level = await AccountLevel.findOne({
        level_no: levelNo,
        country: account.country,
        account_type: "individual"
    });

    if (level) {
        account.level = level._id;
    } else {
        console.warn(`Level ${levelNo} not found for country: ${account.country}`);
    }

    templateId = getTemplateId('english', templateName);
    if (templateId && status !== "needs-review") {
        await sendMailsExport(account.email, subject, subject, templateId, {});
    } else {
        console.warn(`Template ID not found for: ${templateName}`);
    }
}

// function to delete the entire user record from database
async function deleteAccount(accountId) {
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
        throw new Error("Invalid ObjectId");
    }

    try {
        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Delete the account
            const accountDeletion = await Account.findByIdAndDelete(accountId).session(session);
            if (!accountDeletion) {
                throw new Error("Account not found");
            }

            console.log(`Account with ID ${accountId} deleted successfully.`);

            // Remove all wallets associated with the account
            const walletsDeletion = await Wallet.deleteMany({ account: accountId }).session(session);
            console.log(`Deleted ${walletsDeletion.deletedCount} wallets associated with the account.`);

            // Remove the user associated with the account
            const userDeletion = await User.deleteOne({ account: accountId }).session(session);
            if (userDeletion.deletedCount > 0) {
                console.log(`User associated with account ID ${accountId} deleted.`);
            } else {
                console.log("No user found associated with the account.");
            }

            const transactionsDeletion = await Transaction.deleteMany({ account: accountId }).session(session)
            if (transactionsDeletion.deletedCount > 0) {
                console.log(`Transactions associated with account ID ${accountId} deleted.`);
            } else {
                console.log("No transactions found associated with the account.");
            }

            // Commit the transaction
            await session.commitTransaction();
            console.log("Transaction committed successfully.");
        } catch (error) {
            // Rollback in case of errors
            await session.abortTransaction();
            console.error("Transaction aborted due to error:", error.message);
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error("Error deleting account and associated data:", error.message);
        throw error;
    }
}

// (async () => {
//     await deleteAccount("677502565090134d23168456")
// })()