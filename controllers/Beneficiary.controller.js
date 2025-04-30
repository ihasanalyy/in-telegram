const Beneficiary = require('../models/Beneficiary.model');
const Wallet = require('../models/Wallet.model');
const Country = require('../models/Country.model');
const { encryption, decryption } = require('../configurations/Encryption')
const axios = require("axios")
module.exports.addBeneficiary = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // let data = req.body

        var {
            first_name,
            last_name,
            company_name,
            email,
            phone,
            postal_code,
            address,
            wallet,
            city,
            country,
            country_name,
            country_iso_code,
            relation,
            account_type,
            account_details,
            beneficiary_type,
            account,
            isUsaBank,
            bank_details,
            mobile_wallet,
            crypto,
            cash_pickup,
            extras,
            // document_type,
            // document_number,
            // bank_swift_code,
            // bank_iban,
            // bank_account_number,
            // bank_name,
            // bank_branch_name,
            // bank_branch_street,
            // bank_city,
            // bank_province,
            // bank_postal_code,
            // bank_account_holder_name,
            // mobile_money_provider,
            // mobile_wallet_name,
            // mobile_wallet_account_number,
            // crypto_currency,
            // crypto_wallet_address,
            card,
        } = data;
        account_type = account_type.filter(atl => atl && atl != null)
        if ((beneficiary_type == 'individual' && (!first_name || !last_name)) || (beneficiary_type == 'business' && !company_name) || !phone || !city || !country || !account || !beneficiary_type) {
            let error = await encryption({
                status: false,
                message: "Required field are missing!"
            })
            res.status(400).send(error)
        } else {
            // let conutryDetails = await Country.findOne({ _id: country })
            let checking_query = {};
            let beneficiaryCreateObj = {
                phone,
                address,
                city,
                country,
                zip_code: postal_code,
                country_name,
                country_iso_code,
                relation,
                account_type,
                account_details,
                account,
                beneficiary_type,
                extras
            }
            // let countryDetails = Country.findOne
            if (email) {
                beneficiaryCreateObj['email'] = email
            }
            if (beneficiary_type == 'individual') {
                beneficiaryCreateObj['first_name'] = first_name;
                beneficiaryCreateObj['last_name'] = last_name;
            } else if (beneficiary_type == 'business') {
                beneficiaryCreateObj['company_name'] = company_name;
            }
            if (account_type.find(at => at.toLowerCase() == 'bank')) {
                // if ((isUsaBank && !bank_swift_code) || (!isUsaBank && !bank_iban) || !bank_account_number || !bank_name || !bank_branch_name || !bank_branch_street || !bank_city || !bank_province || !bank_postal_code || !bank_account_holder_name) {
                if (!bank_details.length || bank_details.length > 3) {
                    let error = await encryption({
                        status: false,
                        message: "Cannot add bank details!"
                    })
                    return res.status(400).send(error)
                } else {
                    checking_variable = ''
                    beneficiaryCreateObj['isUsaBank'] = isUsaBank;
                    beneficiaryCreateObj['bank_details'] = bank_details;
                    // beneficiaryCreateObj['bank_swift_code'] = bank_swift_code;
                    // beneficiaryCreateObj['bank_iban'] = bank_iban;
                    // beneficiaryCreateObj['bank_account_number'] = bank_account_number;
                    // beneficiaryCreateObj['bank_name'] = bank_name;
                    // beneficiaryCreateObj['bank_branch_name'] = bank_branch_name;
                    // beneficiaryCreateObj['bank_branch_street'] = bank_branch_street;
                    // beneficiaryCreateObj['bank_city'] = bank_city;
                    // beneficiaryCreateObj['bank_province'] = bank_province;
                    // beneficiaryCreateObj['bank_postal_code'] = bank_postal_code;
                    // beneficiaryCreateObj['bank_account_holder_name'] = bank_account_holder_name;
                }
            }
            if (account_type.find(at => at.toLowerCase() == 'mobile')) {
                if (!mobile_wallet.length || mobile_wallet.length > 3) {
                    let error = await encryption({
                        status: false,
                        message: "Cannot add mobile wallet!"
                    })
                    return res.status(400).send(error)
                } else {
                    beneficiaryCreateObj['mobile_wallet'] = mobile_wallet;
                    // beneficiaryCreateObj['mobile_money_provider'] = mobile_money_provider;
                    // beneficiaryCreateObj['mobile_wallet_name'] = mobile_wallet_name;
                    // beneficiaryCreateObj['mobile_wallet_account_number'] = mobile_wallet_account_number;
                }
            }
            if (account_type.find(at => at.toLowerCase() == 'crypto')) {
                if (!crypto.length || crypto.length > 3) {
                    let error = await encryption({
                        status: false,
                        message: "Required field are missing!"
                    })
                    return res.status(400).send(error)
                } else {
                    beneficiaryCreateObj['crypto'] = crypto;
                    // beneficiaryCreateObj['crypto_currency'] = crypto_currency;
                    // beneficiaryCreateObj['crypto_wallet_address'] = crypto_wallet_address;
                }
            }
            if (account_type.find(at => at.toLowerCase() == 'card')) {
                if (!card.length || card.length > 3) {
                    let error = await encryption({
                        status: false,
                        message: "Required field are missing!"
                    })
                    return res.status(400).send(error)
                } else {
                    beneficiaryCreateObj['card'] = card;
                }
            }
            if (account_type.find(at => at.toLowerCase() == 'wallet')) {
                if (!wallet?.length) {
                    let error = await encryption({
                        status: false,
                        message: "Required field are missing!"
                    })
                    return res.status(400).send(error)
                } else {
                    wallet = wallet.filter(wl => wl && wl != null)
                    var walletList = await Wallet.find({ $and: [{ _id: { $in: wallet } }] }, { _id: 1, account: 1 });
                    const result = await allEqual(walletList)
                    beneficiaryCreateObj['wallet'] = wallet;
                }
            }
            if (account_type.find(at => at.toLowerCase() == 'cash')) {
                if (!cash_pickup.length || cash_pickup.length > 3) {
                    let error = await encryption({
                        status: false,
                        message: "Required field are missing!"
                    })
                    return res.status(400).send(error)
                } else {
                    beneficiaryCreateObj['cash_pickup'] = cash_pickup;
                    // beneficiaryCreateObj['document_type'] = document_type;
                    // beneficiaryCreateObj['document_number'] = document_number;
                }
            }
            // res.json(beneficiaryCreateObj)
            Beneficiary.create(beneficiaryCreateObj).then(async (beneficiaryData) => {
                var ciphertext = await encryption({
                    status: true,
                    message: "Beneficiary added successfully!",
                    beneficiaryData
                })
                res.status(200).send(ciphertext)
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Beneficiary not created!"
                })
                res.status(400).send(error)
            })

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
const allEqual = arr => arr.every(val => val.account === arr[0].account);

module.exports.getUserBeneficiaries = async (req, res) => {
    try {
        let user_id = req.params.id;
        Beneficiary.find({ account: user_id, $or: [{ deleted: false }, { deleted: { $exists: false } }] }).populate([{
            path: 'wallet',
            match: { status: 'active' },
            select: 'currency wallet_id wallet_type status'
        }]).then(async (beneficiaryList) => {
            if (beneficiaryList.length) {
                var ciphertext = await encryption({
                    status: true,
                    message: "Beneficiary list!",
                    beneficiaryList
                });
                res.status(200).send(ciphertext);
            } else {
                var ciphertext = await encryption({
                    status: false,
                    message: "No Beneficiary found for this user!",
                    beneficiaryList: []
                });
                res.status(404).send(ciphertext);
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting beneficiary list!"
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


module.exports.getBeneficiaryDetails = async (req, res) => {
    try {
        let beneficiary_id = req.params.id
        Beneficiary.findOne({ _id: beneficiary_id }).then(async (beneficiaryData) => {
            if (beneficiaryData) {
                var ciphertext = await encryption({
                    status: true,
                    message: "Beneficiary Details!",
                    beneficiaryData
                })
                res.status(200).send(ciphertext)
            } else {
                var ciphertext = await encryption({
                    status: false,
                    message: "No Beneficiary found for provided ID!",
                    beneficiaryData: []
                })
                res.status(404).send(ciphertext)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting beneficiary details!"
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

module.exports.updateBeneficiary = async (req, res) => {
    try {
        let beneficiary_id = req.params.beneficiary_id
        let data = await decryption(req.body.data)
        // let data = req.body

        var {
            first_name,
            last_name,
            company_name,
            address,
            postal_code,
            wallet,
            city,
            country,
            country_name,
            country_iso_code,
            relation,
            account_type,
            account_details,
            account,
            isUsaBank,
            phone,
            email,
            bank_details,
            mobile_wallet,
            crypto,
            cash_pickup,
            extras,
            // document_type,
            // document_number,
            // bank_swift_code,
            // bank_iban,
            // bank_account_number,
            // bank_name,
            // bank_branch_name,
            // bank_branch_street,
            // bank_city,
            // bank_province,
            // bank_postal_code,
            // bank_account_holder_name,
            // mobile_money_provider,
            // mobile_wallet_name,
            // mobile_wallet_account_number,
            // crypto_currency,
            // crypto_wallet_address,
            card,
        } = data;
        account_type = account_type.filter(atl => atl && atl != null)
        Beneficiary.findOne({ $and: [{ _id: beneficiary_id }, { account: account }] }).then(async (beneficiaryDetails) => {
            if (beneficiaryDetails) {
                let beneficiary_type = beneficiaryDetails.beneficiary_type
                if ((beneficiary_type == 'individual' && (!first_name || !last_name)) || (beneficiary_type == 'business' && !company_name) || !phone || !city || !country || !account || !beneficiary_type) {
                    let error = await encryption({
                        status: false,
                        message: "Required field are missing!"
                    })
                    res.status(400).send(error)
                } else {
                    let checking_query = {};
                    let beneficiaryCreateObj = {
                        address,
                        city,
                        phone,
                        zip_code: postal_code,
                        country,
                        country_name,
                        country_iso_code,
                        relation,
                        account_type,
                        account_details,
                        account,
                        beneficiary_type,
                        extras,
                    }
                    if (email) {
                        beneficiaryCreateObj['email'] = email
                    }
                    if (beneficiary_type == 'individual') {
                        beneficiaryCreateObj['first_name'] = first_name;
                        beneficiaryCreateObj['last_name'] = last_name;
                    } else if (beneficiary_type == 'business') {
                        beneficiaryCreateObj['company_name'] = company_name;
                    }
                    if (account_type.find(at => at.toLowerCase() == 'bank')) {
                        // if ((isUsaBank && !bank_swift_code) || (!isUsaBank && !bank_iban) || !bank_account_number || !bank_name || !bank_branch_name || !bank_branch_street || !bank_city || !bank_province || !bank_postal_code || !bank_account_holder_name) {
                        if (!bank_details.length || bank_details.length > 3) {
                            let error = await encryption({
                                status: false,
                                message: "Cannot add bank details!"
                            })
                            return res.status(400).send(error)
                        } else {
                            checking_variable = ''
                            beneficiaryCreateObj['isUsaBank'] = isUsaBank;
                            beneficiaryCreateObj['bank_details'] = bank_details;
                            // beneficiaryCreateObj['bank_swift_code'] = bank_swift_code;
                            // beneficiaryCreateObj['bank_iban'] = bank_iban;
                            // beneficiaryCreateObj['bank_account_number'] = bank_account_number;
                            // beneficiaryCreateObj['bank_name'] = bank_name;
                            // beneficiaryCreateObj['bank_branch_name'] = bank_branch_name;
                            // beneficiaryCreateObj['bank_branch_street'] = bank_branch_street;
                            // beneficiaryCreateObj['bank_city'] = bank_city;
                            // beneficiaryCreateObj['bank_province'] = bank_province;
                            // beneficiaryCreateObj['bank_postal_code'] = bank_postal_code;
                            // beneficiaryCreateObj['bank_account_holder_name'] = bank_account_holder_name;
                        }
                    }
                    if (account_type.find(at => at.toLowerCase() == 'mobile')) {
                        if (!mobile_wallet.length || mobile_wallet.length > 3) {
                            let error = await encryption({
                                status: false,
                                message: "Cannot add mobile wallet!"
                            })
                            return res.status(400).send(error)
                        } else {
                            beneficiaryCreateObj['mobile_wallet'] = mobile_wallet;
                            // beneficiaryCreateObj['mobile_money_provider'] = mobile_money_provider;
                            // beneficiaryCreateObj['mobile_wallet_name'] = mobile_wallet_name;
                            // beneficiaryCreateObj['mobile_wallet_account_number'] = mobile_wallet_account_number;
                        }
                    }
                    if (account_type.find(at => at.toLowerCase() == 'crypto')) {
                        if (!crypto.length || crypto.length > 3) {
                            let error = await encryption({
                                status: false,
                                message: "Required field are missing!"
                            })
                            return res.status(400).send(error)
                        } else {
                            beneficiaryCreateObj['crypto'] = crypto;
                            // beneficiaryCreateObj['crypto_currency'] = crypto_currency;
                            // beneficiaryCreateObj['crypto_wallet_address'] = crypto_wallet_address;
                        }
                    }
                    if (account_type.find(at => at.toLowerCase() == 'card')) {
                        if (!card.length || card.length > 3) {
                            let error = await encryption({
                                status: false,
                                message: "Required field are missing!"
                            })
                            return res.status(400).send(error)
                        } else {
                            beneficiaryCreateObj['card'] = card;
                        }
                    }
                    if (account_type.find(at => at.toLowerCase() == 'wallet')) {
                        if (!wallet?.length) {
                            let error = await encryption({
                                status: false,
                                message: "Required field are missing!"
                            })
                            return res.status(400).send(error)
                        } else {
                            wallet = wallet.filter(wl => wl && wl != null)
                            var walletList = await Wallet.find({ $and: [{ _id: { $in: wallet } }] }, { _id: 1, account: 1 });
                            const result = await allEqual(walletList)
                            beneficiaryCreateObj['wallet'] = wallet;
                        }
                    }
                    if (account_type.find(at => at.toLowerCase() == 'cash')) {
                        if (!cash_pickup.length || cash_pickup.length > 3) {
                            let error = await encryption({
                                status: false,
                                message: "Required field are missing!"
                            })
                            return res.status(400).send(error)
                        } else {
                            beneficiaryCreateObj['cash_pickup'] = cash_pickup;
                            // beneficiaryCreateObj['document_type'] = document_type;
                            // beneficiaryCreateObj['document_number'] = document_number;
                        }
                    }
                    // res.json(beneficiaryCreateObj)
                    Beneficiary.findByIdAndUpdate({ _id: beneficiary_id }, beneficiaryCreateObj, { new: true }).then(async (beneficiaryData) => {
                        var ciphertext = await encryption({
                            status: true,
                            message: "Beneficiary updated successfully!",
                            beneficiaryData
                        })
                        res.status(200).send(ciphertext)
                    }).catch(async (err) => {
                        let error = await encryption({
                            status: false,
                            message: "Beneficiary not updated!"
                        })
                        res.status(400).send(error)
                    })

                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Beneficiary not found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            // console.log(err);
            let error = await encryption({
                status: false,
                message: "Error!"
            })
            res.status(500).send(error)
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

module.exports.deleteBeneficiary = async (req, res) => {
    try {
        let beneficiary_id = req.params.beneficiary_id;
        let account_id = req.params.account_id;

        console.log(beneficiary_id, account_id)

        Beneficiary.findById(beneficiary_id).then(async (beneficiary) => {
            if (!beneficiary) {
                var ciphertext = await encryption({
                    status: false,
                    message: "No Beneficiary found for provided ID!",
                    deletedBeneficiary: null
                })
                return res.status(404).send(ciphertext);
            }

            if (beneficiary.account.toString() !== account_id) {
                var ciphertext = await encryption({
                    status: false,
                    message: "Unauthorized to delete this beneficiary!",
                    deletedBeneficiary: null
                })
                return res.status(401).send(ciphertext);
            }

            beneficiary.deleted = true;

            beneficiary.save().then(async (updatedBeneficiary) => {
                var ciphertext = await encryption({
                    status: true,
                    message: "Beneficiary deleted!",
                    deletedBeneficiary: updatedBeneficiary
                })
                res.status(200).send(ciphertext);
            }).catch(async (err) => {
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while marking beneficiary as deleted!"
                })
                res.status(400).send(error);
            });

        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while finding beneficiary!"
            })
            res.status(400).send(error);
        });

    } catch (err) {
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error);
    }
}

module.exports.getCoordinates = async (req, res) => {
    const { countryIso } = req.params

    if (!countryIso) {
        return res.status(400).send(await encryption({
            status: false,
            message: "Required field are missing!"
        }))
    }

    try {
        const response = await axios.get(`https://geocode.search.hereapi.com/v1/geocode`, {
            params: {
                q: countryIso,
                apiKey: process.env.GEO_CODE_SEARCH_KEY
            }
        });

        if (response.data.items.length === 0) {
            return res.status(400).send(await encryption({
                status: false,
                message: "No coordinates found for this country"
            }))
        }

        const position = response.data.items[0].position;
        const address = response.data.items[0].address
        res.status(200).send(await encryption({
            status: true,
            message: "Coordinates found",
            position,
            country: {
                iso: address.countryCode,
                name: address.countryName
            }
        }))
    } catch (error) {
        console.log(error)
        res.status(500).send(await encryption({
            status: false,
            message: "Something went wrong while fetching details.",
        }))
    }
};

module.exports.getAutoCompleteAddress = async (req, res) => {
    const { lat, long, countryIso, countryName, query } = req.query;

    if (!lat || !long || !countryIso || !query || !countryName) {
        return res.status(400).send(await encryption({
            status: false,
            message: "Required field are missing!"
        }));
    }


    try {
        const encodedQuery = decodeURIComponent(query);
        const encodedCountryName = decodeURIComponent(countryName);

        console.log({ encodedQuery, encodedCountryName })

        const response = await axios.get(`https://autosuggest.search.hereapi.com/v1/autosuggest?at=${lat},${long}&q=${encodedQuery}&limit=10&countryCode=${countryIso}&apiKey=${process.env.GEO_CODE_SEARCH_KEY}`);

        const addressLabels = response.data.items
            .filter(item => item.address && item.address.label) // ensure address and label exist
            .map(item => item.address.label);

        const filteredAddressLabels = addressLabels.filter((label) => label.toLowerCase().includes(encodedCountryName.toLowerCase()))

        const ciphertext = await encryption({
            status: true,
            message: "Addresses",
            addresses: filteredAddressLabels
        })

        return res.status(200).send(ciphertext)
    } catch (error) {
        console.log(error)
        res.status(500).send(await encryption({
            status: false,
            message: "Something went wrong while fetching details.",
        }))
    }
}