const Account = require('../models/Account.model');
const Company = require('../models/Company.model')

const { encryption, decryption } = require('../configurations/Encryption')

const AWS = require('aws-sdk');
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require('multer');
const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });
module.exports.uploadDocumentsCheck = multer({
    storage,
    limits: { fileSize: 2000000 },
});

module.exports.uploadKYBFiles = async (req, res) => {
    try {
        const { account_id, business_type, file_names } = req.body;
        console.log(req.body, req.files);
        console.log(req.files.length, file_names.length, "length");

        console.log(account_id, business_type, file_names);
        if (!business_type || !file_names || !account_id) {
            let error = await encryption({
                status: false,
                message: "Required field is missing!"
            });
            return res.status(400).send(error);
        }

        const user = await Account.findOne({ _id: account_id, active: true }).populate('company');
        if (!user) {
            let error = await encryption({
                status: false,
                message: "User not found!"
            });
            return res.status(500).send(error);
        }

        if (req.files.length !== file_names.length) {
            let error = await encryption({
                status: false,
                message: "Number of document names does not match the number of files uploaded!"
            });
            return res.status(400).send(error);
        }

        const bucketName = process.env.AWS_BUCKET_NAME;
        const s3 = new AWS.S3();

        const uploadPromises = req.files.map(async (file, index) => {
            const params = {
                Bucket: bucketName,
                Key: `KYB-docs/${user.company.company_name}/${file.originalname}`,
                Body: file.buffer
            };

            const uploadResult = await s3.upload(params).promise();

            if (uploadResult?.Key) {
                return {
                    document_type: file.mimetype.split("/")[0],
                    key: uploadResult.Key,
                    file_link: uploadResult.Location,
                    ETag: uploadResult.ETag,
                    document_name: file_names[index],
                    status: "uploaded"
                };
            }
            return null;
        });

        const uploadedFiles = await Promise.all(uploadPromises);

        if (uploadedFiles.some(file => file === null)) {
            let error = await encryption({
                status: false,
                message: "Some files failed to upload!"
            });
            return res.status(500).send(error);
        }

        user.company.kyb_files.push(...uploadedFiles);
        user.company.business_verification_type = business_type;
        user.company.kyb_status = "needs-review";
        await user.company.save();

        let ciphertext = await encryption({
            status: true,
            message: "KYB files uploaded successfully."
        });
        res.status(200).send(ciphertext);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        res.status(500).send(error);
    }
};

module.exports.updateKYBFilesStatus = async (req, res) => {
    try {
        const account_id = req.params.account_id
        let data = await decryption(req.body.data)
        const { filesStatus } = data;
        console.log(filesStatus)

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
                Company.findOne({ account: account_id }).then(async (company) => {
                    if (!company) {
                        let error = await encryption({
                            status: false,
                            message: "company not found!",
                        });
                        res.status(400).send(error);
                    } else {
                        filesStatus.forEach(async (update) => {
                            const { file_id, status } = update;
                            const fileToUpdate = company?.kyb_files.find(file => file._id.equals(file_id))

                            if (fileToUpdate) {
                                fileToUpdate.status = status;
                            }
                        })

                        company.save().then(async (savedCompany) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "File statuses updated successfully",
                                savedCompany
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            console.log(err)
                            let error = await encryption({
                                status: false,
                                message: "Error saving updated file statuses",
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
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding the account!",
            });
            res.status(400).send(error);
        })


    }
    catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.kybAdditionalFilesAdmin = async (req, res) => {
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
                Company.findOne({ account: account_id }).then(async (company) => {
                    if (!company) {
                        let error = await encryption({
                            status: false,
                            message: "Company not found!",
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
                        company.kyb_additional_file = [...company.kyb_additional_file, ...additionalFiles];

                        company.save()
                            .then(async (savedCompany) => {
                                let ciphertext = await encryption({
                                    status: true,
                                    message: "Additional required files updated",
                                    savedCompany
                                });
                                res.status(200).send(ciphertext);
                            })
                            .catch(async (err) => {
                                let error = await encryption({
                                    status: false,
                                    message: "Error saving additional files.",
                                    savedCompany
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
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error.",
        });
        res.status(500).send(error);
    }
}

module.exports.updateKYBAddtnlFilesStatus = async (req, res) => {
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
                Company.findOne({ account: account_id }).then(async (company) => {
                    if (!company) {
                        let error = await encryption({
                            status: false,
                            message: "company not found!",
                        });
                        res.status(400).send(error);
                    } else {
                        filesStatus.forEach(async (update) => {
                            const { file_id, status } = update;
                            const fileToUpdate = company?.kyb_additional_file.find(file => file._id.equals(file_id))

                            if (fileToUpdate) {
                                fileToUpdate.status = status;
                            }
                        })

                        company.save().then(async (savedCompany) => {
                            let ciphertext = await encryption({
                                status: true,
                                message: "File statuses updated successfully",
                                savedCompany
                            });
                            res.status(200).send(ciphertext);
                        }).catch(async (err) => {
                            let error = await encryption({
                                status: false,
                                message: "Error saving updated file statuses",
                                savedCompany
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

module.exports.uploadAdditionalFileKYB = async (req, res) => {
    try {
        const account_id = req.params.account_id;
        const file_id = req.body.file_id
        const file_type = req.body.file_type

        if (!account_id || !file_id || !file_type) {
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
            Key: `requested_files-kyb/${account_id}/${data.originalname}`,
            Body: data.buffer
        };

        Company.findOne({ account: account_id }).then(async (company) => {
            if (!company) {
                let error = await encryption({
                    status: false,
                    message: "Company not found!",
                });
                res.status(400).send(error);
            } else {
                let existingFile;
                for (const file of company.kyb_additional_file) {
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
                                Company.updateOne({ "kyb_additional_file._id": file_id },
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
                                Company.updateOne({ "kyb_additional_file._id": file_id },
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
                message: "Something went wrong while getting company details!",
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

module.exports.getKYCAdditionalFilesKYB = async (req, res) => {
    try {
        const account_id = req.params.account_id
        if (!account_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }
        Company.findOne({ account: account_id }).then(async (company) => {
            if (!company) {
                let error = await encryption({
                    status: false,
                    message: "company not found!",
                });
                return res.status(400).send(error);
            } else {
                let kybAdditionalFiles = company.kyb_additional_file || [];

                let ciphertext = await encryption({
                    status: true,
                    message: "Kyc additional filess.",
                    kybAdditionalFiles
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

module.exports.deleteFileRequestKYB = async (req, res) => {
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

        Company.findOne({ account: account_id }).then(async (company) => {
            if (!company) {
                let error = await encryption({
                    status: false,
                    message: "Company not found!",
                });
                res.status(400).send(error);
            } else {
                const targetFileIndex = company.kyb_additional_file.findIndex(file => file._id.equals(file_id))

                if (targetFileIndex !== -1) {
                    company.kyb_additional_file.splice(targetFileIndex, 1)
                    // console.log(company.kyb_additional_file.splice(targetFileIndex, 1), targetFileIndex)
                    company.save().then(async (savedCompany) => {
                        let ciphertext = await encryption({
                            status: true,
                            message: "File request deleted successfully",
                            additionalFiles: savedCompany.kyb_additional_file
                        });
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Error saving company after deleting file request",
                            savedCompany
                        });
                        res.status(500).send(error);
                    });
                }
                else {
                    let error = await encryption({
                        status: false,
                        message: "File not found in the company's additional files",
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
        let error = await encryption({
            status: false,
            message: "Internal Server Error"
        })
        return res.status(500).send(error)
    }
}

module.exports.businessRegisterationAdmin = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        const { company_id, status } = data;

        if (!company_id || !status) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",

            })
            return res.status(400).send(error)
        }

        Company.findByIdAndUpdate(company_id, { kyb_status: status }, { new: true }).then(async (company) => {
            if (company) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Company status updated!",
                    company
                })
                return res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "Company not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting the company details!"
            })
            res.status(500).send(error)
        })

    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal Server Error"
        })
        return res.status(500).send(error)
    }
}