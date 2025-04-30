const Account = require('../models/Account.model');
const axios = require('axios');
const jwt = require('jsonwebtoken');

const { encryption, decryption } = require('../configurations/Encryption');
const Partner = require('../models/Partner.model');

const apiKey = process.env.GETID_APIKEY;
const baseUrl = 'https://kemitkingdom.sb.getid.dev/api/v1/tokenized-url';

const sgMail = require('@sendgrid/mail');
sgMail.setApiKey('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');

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require('multer');
const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });

const sendEmail = async (options) => {
    const message = {
        from: 'sarfarazahmed1012@gmail.com',
        to: options.email,
        subject: options.subject,
        text: options.message,
        trackingSettings: {
            clickTracking: {
                enable: true,
                enableText: true
            },
            openTracking: {
                enable: true
            }
        },
    }
    const info = await sgMail.send(message);

    console.log('Message sent: %s', info);
};

const generateToken = (data) => {
    const expiresIn = 3600;
    return jwt.sign(data, 'partnerVerificationSecretKey', { expiresIn });
};


module.exports.addPartner = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { name, email, account_id, designation } = data
        if (!name || !email || !account_id || !designation) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (account) {
                console.log(account, "account")
                let partnerObj = { account: account_id, name, email, designation };
                Partner.create(partnerObj).then(async (createdPartner) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Partner added successfully.",
                        partner: createdPartner
                    });
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while adding a new partner"
                    });
                    res.status(400).send(error);
                })
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting account details."
            });
            res.status(400).send(error);
        });
    }
    catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.deletePartner = async (req, res) => {
    try {
        // let data = await decryption(req.body.data)
        const { partner_id, account_id } = req.params;
        if (!partner_id || !account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found."
                });
                return res.status(404).send(error);
            } else {
                Partner.findOne({ $and: [{ _id: partner_id }, { account: account_id }] }).then(async (partner) => {
                    if (!partner) {
                        let error = await encryption({
                            status: false,
                            message: "Partner not found for the specified account."
                        });
                        return res.status(404).send(error);
                    } else {
                        Partner.findByIdAndDelete(partner_id).then(async (deletedPartner) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Partner deleted successfully.",
                                partner: deletedPartner
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            console.log(err);
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while deleting the partner."
                            });
                            res.status(500).send(error);
                        });
                    }
                }).catch(async (err) => {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while getting account details."
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
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.updatePartner = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { partner_id, account_id, name, email, designation } = data;
        if (!name || !email || !account_id || !partner_id || !designation) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found."
                });
                return res.status(404).send(error);
            }

            Partner.findOne({ $and: [{ _id: partner_id }, { account: account_id }] }).then(async (partner) => {
                if (!partner) {
                    let error = await encryption({
                        status: false,
                        message: "Partner not found for the specified account."
                    });
                    return res.status(404).send(error);
                }
                partner.name = name;
                partner.email = email;
                partner.designation = designation

                partner.save().then(async (updatedPartner) => {
                    let ciphertext = await encryption({
                        status: true,
                        message: "Partner updated successfully.",
                        partner: updatedPartner
                    });
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    console.log(err);
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while updating the partner."
                    });
                    res.status(500).send(error);
                });
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting partner details."
                });
                res.status(400).send(error);
            });
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
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.getPartnersByAccountId = async (req, res) => {
    try {
        const account_id = req.params.account_id;

        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        Account.findOne({ $and: [{ _id: account_id }, { active: true }] }).then(async (account) => {
            if (!account) {
                let error = await encryption({
                    status: false,
                    message: "Account not found."
                });
                return res.status(404).send(error);
            }
            Partner.find({ account: account_id }).then(async (partners) => {
                console.log(partners, "account")

                let ciphertext = await encryption({
                    status: true,
                    message: "Partners retrieved successfully.",
                    partners: partners
                });
                res.status(200).send(ciphertext);
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting partner details."
                });
                res.status(400).send(error);
            });
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
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
}

module.exports.partnerVerification = async (req, res) => {
    try {
        // let data = req.body
        let data = await decryption(req.body.data)
        const external_id = req.params.id;
        const { partner_name, email } = data
        if (!partner_name || !email) {
            let error = await encryption({
                status: false,
                message: "Required field are missing."
            })
            res.status(400).send(error);
        } else {
            const requestData = {
                name: 'InstaPay-KYC',
                externalId: external_id,
                profile: {
                    'First name': partner_name,
                    'Last name': partner_name,
                    'Email': email,
                    // 'Last name': last_name,
                    // 'Address': address,
                    // 'Date of birth': dob,
                    // 'Nationality': nationality,
                },
                // locale: language_code,
                // ttl: '60',
            };

            const headers = {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
            };

            axios.post(`${baseUrl}?name=${requestData.name}&externalId=${requestData.externalId}`, requestData, {
                headers: headers,
            }).then(async (response) => {
                const tokenizedLink = response.data.url;
                const doubleToken = generateToken({ tokenizedLink });

                const doubleTokenizedLink = `https://my.insta-pay.ch/partners/verification/${doubleToken}`;

                const options = {
                    email: email,
                    message: doubleTokenizedLink,
                    subject: "KYB Verification Link"
                }
                sendEmail(options)
                var ciphertext = await encryption({ status: true, message: "Token sent to email succesfully!" })

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

module.exports.verifyToken = async (req, res) => {
    try {
        const token = req.params.token;

        if (!token) {
            let error = await encryption({
                status: false,
                message: "Required field are missing."
            })
            return res.status(400).send(error);
        }

        jwt.verify(token, 'partnerVerificationSecretKey', async function (err, payload) {
            if (err) {
                let error = await encryption({
                    status: false,
                    message: "Invalid token"
                })
                res.status(400).send(error)
            } else {
                let ciphertext = await encryption({
                    status: true,
                    KYBLink: payload.tokenizedLink
                })
                res.status(200).send(ciphertext)
            }
        })

    } catch (err) {
        console.error(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.partnerAdditionalFilesAdmin = async (req, res) => {
    try {
        let partner_id = req.params.partner_id;
        let account_id = req.params.account_id;
        let data = await decryption(req.body.data)
        const { documents } = data;
        if (!partner_id || !account_id || !documents || !Array.isArray(documents)) {
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
                Partner.findOne({ _id: partner_id, account: account_id }).then(async (partner) => {
                    if (!partner) {
                        let error = await encryption({
                            status: false,
                            message: "partner not found!",
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
                        partner.kyb_additional_file = [...partner.kyb_additional_file, ...additionalFiles];

                        partner.save()
                            .then(async (savedpartner) => {
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Additional required files updated",
                                    savedpartner
                                });
                                res.status(200).send(ciphertext);
                            })
                            .catch(async (err) => {
                                let error = await encryption({
                                    status: false,
                                    message: "Error saving additional files.",
                                    savedpartner
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

module.exports.partnerUpdateFilesStatus = async (req, res) => {
    try {
        let partner_id = req.params.partner_id;
        let account_id = req.params.account_id;
        let data = await decryption(req.body.data)
        const { filesStatus } = data;

        if (!partner_id || !filesStatus || !Array.isArray(filesStatus)) {
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
                Partner.findOne({ _id: partner_id, account: account_id }).then(async (partner) => {
                    if (!partner) {
                        let error = await encryption({
                            status: false,
                            message: "Partner not found!",
                        });
                        res.status(400).send(error);
                    } else {
                        filesStatus.forEach(async (update) => {
                            const { file_id, status } = update;
                            const fileToUpdate = partner?.kyb_additional_file.find(file => file._id.equals(file_id))

                            if (fileToUpdate) {
                                fileToUpdate.status = status;
                            }
                        })

                        partner.save().then(async (savedPartner) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "File statuses updated successfully",
                                savedPartner
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Error saving updated file statuses",
                                savedPartner
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

module.exports.uploadPartnerAdditionalFilePartner = async (req, res) => {
    try {
        let partner_id = req.params.partner_id;
        let account_id = req.params.account_id;
        const file_id = req.body.file_id
        const file_type = req.body.file_type

        if (!partner_id || !file_id || !account_id) {
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
            Key: `additional_files/${partner_id}/${data.originalname}`,
            Body: data.buffer
        };

        Partner.findOne({ _id: partner_id, account: account_id }).then(async (partner) => {
            if (!partner) {
                let error = await encryption({
                    status: false,
                    message: "partner not found!",
                });
                res.status(400).send(error);
            } else {
                let existingFile;
                for (const file of partner.kyb_additional_file) {
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
                                Partner.updateOne({ "kyb_additional_file._id": file_id },
                                    {
                                        $set: {
                                            "kyb_additional_file.$.file_link": s3Object.url, "kyb_additional_file.$.key": s3Object.key, "kyb_additional_file.$.file_type": file_type, "kyb_additional_file.$.status": "uploaded",
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
                                Partner.updateOne({ "kyb_additional_file._id": file_id },
                                    {
                                        $set: {
                                            "kyb_additional_file.$.file_link": s3Object.url, "kyb_additional_file.$.key": s3Object.key, "kyb_additional_file.$.file_type": file_type, "kyb_additional_file.$.status": "uploaded"
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
                message: "Something went wrong while getting partner details!",
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

module.exports.getPartnerAdditionalFiles = async (req, res) => {
    try {
        let partner_id = req.params.partner_id;
        let account_id = req.params.account_id;
        if (!account_id || !partner_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        Partner.findOne({ _id: partner_id, account: account_id }).then(async (partner) => {
            if (!partner) {
                let error = await encryption({
                    status: false,
                    message: "Partner not found!",
                });
                return res.status(400).send(error);
            } else {
                let kycAdditionalFiles = partner.kyb_additional_file || [];

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

module.exports.deletePartnerFileRequest = async (req, res) => {
    try {
        const account_id = req.params.account_id;
        const partner_id = req.params.partner_id;
        const file_id = req.params.file_id;
        if (!account_id || !file_id || !partner_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        Partner.findOne({ _id: partner_id, account: account_id }).then(async (partner) => {
            if (!partner) {
                let error = await encryption({
                    status: false,
                    message: "partner not found!",
                });
                res.status(400).send(error);
            } else {
                const targetFileIndex = partner.kyb_additional_file.findIndex(file => file._id.equals(file_id))

                if (targetFileIndex !== -1) {
                    partner.kyb_additional_file.splice(targetFileIndex, 1)
                    // console.log(user.kyb_additional_file.splice(targetFileIndex, 1), targetFileIndex)
                    partner.save().then(async (savedPartner) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "File request deleted successfully",
                            additionalFiles: savedPartner.kyb_additional_file
                        });
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Error saving partner after deleting file request",
                            savedPartner
                        });
                        res.status(500).send(error);
                    });
                }
                else {
                    let error = await encryption({
                        status: false,
                        message: "File not found in the partner's additional files",
                    });
                    return res.status(404).send(error);
                }
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding the partner!",
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



