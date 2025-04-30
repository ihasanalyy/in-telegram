const Withdrawal = require('../models/User-Withdrawal.model');
const Account = require('../models/Account.model');
const Wallet = require('../models/Wallet.model');
const WithdrawalChannels = require('../models/AllowedWithdrawal-Channels.model');
const axios = require('axios');
const shortid = require('shortid');
const moment = require('moment');
const jwt = require('jsonwebtoken');

const { encryption, decryption } = require('../configurations/Encryption');
const Transaction = require('../models/Transaction.model');
// const Thunes_KEY = process.env.APIKEY;
// const Thunes_SECRET = process.env.APISECRET;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const secretKey = process.env.jwtKey;

module.exports.addWithdrawal = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // let data = req.body;

        var {
            first_name,
            last_name,
            company_name,
            email,
            phone,
            address,
            wallet,
            city,
            country,
            relation,
            account_type,
            account_details,
            withdrawal_type,
            account,
            isUsaBank,
            bank_details,
            mobile_wallet,
            crypto,
            cash_pickup,
            iso_code,
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

        console.log(data, "data inside withdrawal")

        let withdrawals = await Withdrawal.find({ account });

        console.log(withdrawals, "withdrawals")

        // if user has added same withdrwal for same country
        // if (withdrawals.some(withdrawal => withdrawal.country.toString() === country)) {
        //     let error = await encryption({
        //         status: false,
        //         message: "You have already added a withdrawal for this country!"
        //     });
        //     return res.status(400).send(error);
        // }

        if (withdrawals.length >= 3) {
            let error = await encryption({
                status: false,
                message: "You can only request a maximum of 3 withdrawals!"
            });
            return res.status(400).send(error);
        }

        account_type = account_type.filter(atl => atl && atl != null);
        if ((withdrawal_type == 'individual' && (!first_name || !last_name)) ||
            (withdrawal_type == 'business' && !company_name) || !phone || !city || !country ||
            !account || !withdrawal_type || !iso_code) {
            console.log("withdrawal_type", withdrawal_type)
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        let withdrawalCreateObj = {
            phone,
            address,
            city,
            country,
            relation,
            account_type,
            account_details,
            account,
            withdrawal_type,
            iso_code,
            extras
        }

        if (email) {
            withdrawalCreateObj['email'] = email
        }
        if (withdrawal_type == 'individual') {
            withdrawalCreateObj['first_name'] = first_name;
            withdrawalCreateObj['last_name'] = last_name;
        } else if (withdrawal_type == 'business') {
            withdrawalCreateObj['company_name'] = company_name;
        }

        // Function to set default if only one channel is being added
        function setDefaultIfSingleChannel(type, details) {
            console.log("details", details, "details.length", details.length, "account_type", account_type, "account_type.length", account_type.length, "type", type)
            if (!withdrawals.length && account_type.length === 1 && details && details.length === 1) {
                details[0].default = true;
            }
            withdrawalCreateObj[type] = details;
        }


        if (account_type.find(at => at.toLowerCase() == 'bank')) {
            if (!bank_details.length || bank_details.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Cannot add bank details!"
                })
                return res.status(400).send(error)
            } else {
                withdrawalCreateObj['isUsaBank'] = isUsaBank;
                setDefaultIfSingleChannel('bank_details', bank_details);
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
                });
                return res.status(400).send(error);
            } else {
                setDefaultIfSingleChannel('mobile_wallet', mobile_wallet);
                // beneficiaryCreateObj['mobile_money_provider'] = mobile_money_provider;
                // beneficiaryCreateObj['mobile_wallet_name'] = mobile_wallet_name;
                // beneficiaryCreateObj['mobile_wallet_account_number'] = mobile_wallet_account_number;
            }
        }
        if (account_type.find(at => at.toLowerCase() == 'crypto')) {
            console.log("crypto ran")
            if (!crypto.length || crypto.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Required fields are missing!"
                })
                return res.status(400).send(error)
            } else {
                setDefaultIfSingleChannel('crypto', crypto);
            }
        }
        if (account_type.find(at => at.toLowerCase() == 'card')) {
            console.log("card ran")
            if (!card.length || card.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Required fields are missing!"
                })
                return res.status(400).send(error)
            } else {
                setDefaultIfSingleChannel('card', card);
            }
        }
        if (account_type.find(at => at.toLowerCase() == 'wallet')) {
            console.log("wallet ran")

            if (!wallet?.length) {
                let error = await encryption({
                    status: false,
                    message: "Required field are missing!"
                })
                return res.status(400).send(error);
            } else {
                wallet = wallet.filter(wl => wl && wl != null)
                var walletList = await Wallet.find({ $and: [{ _id: { $in: wallet } }] }, { _id: 1, account: 1 });
                const result = await allEqual(walletList)
                setDefaultIfSingleChannel('wallet', wallet);
            }
        }
        if (account_type.find(at => at.toLowerCase() == 'cash')) {
            console.log("cash ran")

            if (!cash_pickup.length || cash_pickup.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Required field are missing!"
                })
                return res.status(400).send(error);
            } else {
                setDefaultIfSingleChannel('cash_pickup', cash_pickup);
            }
        }

        Withdrawal.create(withdrawalCreateObj).then(async (beneficiaryData) => {
            var ciphertext = await encryption({
                status: true,
                message: "Withdrawal added successfully!",
                beneficiaryData
            })
            res.status(200).send(ciphertext);
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Withdrawal not created!"
            })
            res.status(400).send(error);
        });
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

module.exports.getUserWithdrawals = async (req, res) => {
    try {
        let user_id = req.params.id
        Withdrawal.find({ account: user_id }).populate([{
            path: 'wallet',
            match: { status: 'active' },
            select: 'currency wallet_id wallet_type status'
        }]).then(async (withdrawalList) => {
            if (withdrawalList.length) {
                var ciphertext = await encryption({
                    status: true,
                    message: "Withdrawal list!",
                    withdrawalList
                })
                res.status(200).send(ciphertext)
            } else {
                var ciphertext = await encryption({
                    status: false,
                    message: "No withdrawal found for this user!",
                    withdrawalList: []
                })
                res.status(404).send(ciphertext)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting withdrawal list!"
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

module.exports.getWithdrawalDetails = async (req, res) => {
    try {
        let withdrawal_id = req.params.id
        Withdrawal.findOne({ _id: withdrawal_id }).then(async (withdrawalData) => {
            if (withdrawalData) {
                var ciphertext = await encryption({
                    status: true,
                    message: "Withdrawal Details!",
                    withdrawalData
                })
                res.status(200).send(ciphertext)
            } else {
                var ciphertext = await encryption({
                    status: false,
                    message: "No Withdrawal found for provided ID!",
                    withdrawalData: []
                })
                res.status(404).send(ciphertext)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting withdrawal details!"
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

module.exports.updateWithdrawal = async (req, res) => {
    try {
        let withdrawal_id = req.params.withdrawal_id
        let data = await decryption(req.body.data)
        // let data = req.body

        var {
            first_name,
            last_name,
            company_name,
            address,
            wallet,
            city,
            country,
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
            card,
        } = data;
        account_type = account_type?.filter(atl => atl && atl != null)
        let withdrawalDetails = await Withdrawal.findOne({ _id: withdrawal_id, account: account });
        if (!withdrawalDetails) {
            let error = await encryption({
                status: false,
                message: "Withdrawal not found!"
            });
            return res.status(404).send(error);
        }

        let withdrawal_type = withdrawalDetails.withdrawal_type;

        // Validate required fields based on withdrawal type
        if (
            (withdrawal_type == 'individual' && (!first_name || !last_name)) ||
            (withdrawal_type == 'business' && !company_name) ||
            !phone || !city || !country || !account || !withdrawal_type
        ) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        // Retrieve existing withdrawals for the account
        let withdrawals = await Withdrawal.find({ account });

        let withdrawalUpdateObj = {
            address,
            city,
            phone,
            country,
            relation,
            account_type,
            account_details,
            account,
            withdrawal_type
        }

        if (email) {
            withdrawalUpdateObj['email'] = email;
        }
        if (withdrawal_type == 'individual') {
            withdrawalUpdateObj['first_name'] = first_name;
            withdrawalUpdateObj['last_name'] = last_name;
        } else if (withdrawal_type == 'business') {
            withdrawalUpdateObj['company_name'] = company_name;
        }

        // Function to set default if only one channel is being updated
        function setDefaultIfSingleChannel(type, details) {
            if (withdrawals.length === 1 && account_type.length === 1 && details && details.length === 1) {
                details[0].default = true;
            }
            withdrawalUpdateObj[type] = details;
        }

        // Update bank details with default setting if needed
        if (account_type.find(at => at.toLowerCase() === 'bank')) {
            if (!bank_details.length || bank_details.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Cannot add bank details!"
                });
                return res.status(400).send(error);
            } else {
                withdrawalUpdateObj['isUsaBank'] = isUsaBank;
                setDefaultIfSingleChannel('bank_details', bank_details);
            }
        }

        // Update mobile wallet with default setting if needed
        if (account_type.find(at => at.toLowerCase() === 'mobile')) {
            if (!mobile_wallet.length || mobile_wallet.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Cannot add mobile wallet!"
                });
                return res.status(400).send(error);
            } else {
                setDefaultIfSingleChannel('mobile_wallet', mobile_wallet);
            }
        }

        // Update crypto details with default setting if needed
        if (account_type.find(at => at.toLowerCase() === 'crypto')) {
            if (!crypto.length || crypto.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Cannot add crypto details!"
                });
                return res.status(400).send(error);
            } else {
                setDefaultIfSingleChannel('crypto', crypto);
            }
        }

        // Update card details with default setting if needed
        if (account_type.find(at => at.toLowerCase() === 'card')) {
            if (!card.length || card.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Cannot add card details!"
                });
                return res.status(400).send(error);
            } else {
                setDefaultIfSingleChannel('card', card);
            }
        }

        // Update wallet details with default setting if needed
        if (account_type.find(at => at.toLowerCase() === 'wallet')) {
            if (!wallet?.length) {
                let error = await encryption({
                    status: false,
                    message: "Required fields are missing!"
                });
                return res.status(400).send(error);
            } else {
                wallet = wallet.filter(wl => wl && wl != null);
                let walletList = await Wallet.find({ _id: { $in: wallet } }, { _id: 1, account: 1 });
                const allEqual = walletList.every(w => w.account === account);
                if (!allEqual) {
                    let error = await encryption({
                        status: false,
                        message: "Invalid wallet data!"
                    });
                    return res.status(400).send(error);
                }
                setDefaultIfSingleChannel('wallet', wallet);
            }
        }

        // Update cash pickup details with default setting if needed
        if (account_type.find(at => at.toLowerCase() === 'cash')) {
            if (!cash_pickup.length || cash_pickup.length > 3) {
                let error = await encryption({
                    status: false,
                    message: "Required fields are missing!"
                });
                return res.status(400).send(error);
            } else {
                setDefaultIfSingleChannel('cash_pickup', cash_pickup);
            }
        }

        // Perform the update operation
        await Withdrawal.updateOne({ _id: withdrawal_id }, withdrawalUpdateObj);
        let success = await encryption({
            status: true,
            message: "Withdrawal updated successfully!"
        });
        res.status(200).send(success);

    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Something went wrong!"
        });
        res.status(500).send(error);
    }
};


module.exports.deleteWithdrawal = async (req, res) => {
    try {
        const withdrawal_id = req.params.withdrawal_id;

        if (!withdrawal_id) {
            console.error("Error: Withdrawal ID is missing!");
            let error = await encryption({
                status: false,
                message: "Something is missing!"
            });
            return res.status(400).send(error);
        }

        const withdrawal = await Withdrawal.findById(withdrawal_id);

        if (!withdrawal) {
            console.error(`Error: Withdrawal not found for ID: ${withdrawal_id}`);
            let error = await encryption({
                status: false,
                message: "Withdrawal not found!"
            });
            return res.status(404).send(error);
        }

        // Check if the withdrawal has any default channels
        let hasDefaultChannel = false;
        const accountTypeMapping = {
            bank_details: 'bank',
            mobile_wallet: 'mobile',
            cash_pickup: 'cash',
            card: 'card',
            crypto: 'crypto'
        };

        for (const type in accountTypeMapping) {
            if (withdrawal[type]) {
                const defaultChannel = withdrawal[type].find(channel => channel.default);
                if (defaultChannel) {
                    hasDefaultChannel = true;
                    break;
                }
            }
        }

        if (hasDefaultChannel) {

            const userAccountId = req?.user?._id

            // Find other withdrawals with the same account but excluding the current one
            const otherWithdrawals = await Withdrawal.find({
                account: userAccountId,
                _id: { $ne: withdrawal_id }
            });

            let newDefaultSet = false;

            for (const otherWithdrawal of otherWithdrawals) {
                for (const type in accountTypeMapping) {
                    if (otherWithdrawal[type] && otherWithdrawal[type].length > 0) {
                        const randomChannelIndex = Math.floor(Math.random() * otherWithdrawal[type].length);
                        otherWithdrawal[type][randomChannelIndex].default = true;
                        await otherWithdrawal.save();
                        newDefaultSet = true;
                        break;
                    }
                }
                if (newDefaultSet) break;
            }

            if (!newDefaultSet) {
                console.log("Error: No other channel found to set as default!");
            }
        }

        await Withdrawal.findByIdAndDelete(withdrawal_id);

        let success = await encryption({
            status: true,
            message: "Successfully deleted!"
        });
        return res.status(200).send(success);

    } catch (err) {
        console.error("Internal server error:", err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};


module.exports.setDefaultChannel = async (req, res) => {
    try {
        let data = await decryption(req.body.data);
        const { userId, channelType, channelId, withdrawalId } = data

        console.log(userId, channelType, channelId, withdrawalId)

        if (!userId || !channelType || !channelId || !withdrawalId) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error)
        }

        const existingWithdrawals = await Withdrawal.find({ account: userId });

        console.log(existingWithdrawals, "existingWithdrawals")

        const currentDefault = existingWithdrawals.find(withdrawal =>
        (withdrawal.bank_details.some(detail => detail.default) ||
            withdrawal.mobile_wallet.some(detail => detail.default) ||
            withdrawal.cash_pickup.some(detail => detail.default) ||
            withdrawal.card.some(detail => detail.default) ||
            withdrawal.crypto.some(detail => detail.default))
        );

        console.log(currentDefault, "currentDefault")

        if (currentDefault) {
            // Update the current default channel to not default
            const defaultChannelTypes = ['bank_details', 'mobile_wallet', 'cash_pickup', 'card', 'crypto'];
            for (const type of defaultChannelTypes) {
                if (currentDefault[type].some(detail => detail.default)) {
                    console.log(currentDefault[type].find(detail => detail.default)._id, "currentDefault[type].find(detail => detail.default)._id")
                    const currentDefaultId = currentDefault[type].find(detail => detail.default)._id;
                    await Withdrawal.updateOne(
                        { account: userId, [`${type}._id`]: currentDefaultId },
                        { $set: { [`${type}.$.default`]: false } }
                    );
                    break;
                }
            }
        }

        const updateChannel = { [`${channelType}.$.default`]: true };
        const query = { _id: withdrawalId, [`${channelType}._id`]: channelId };

        const result = await Withdrawal.updateOne(query, { $set: updateChannel });

        if (result.nModified === 0) {
            let error = await encryption({
                status: false,
                message: "Something went wrong while updating channel!"
            });
            return res.status(400).send(error)
        }

        const ciphertext = await encryption({
            status: true,
            message: "Successfully set to default.."
        });
        return res.status(200).send(ciphertext)

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error)
    }
}

module.exports.deleteChannelFromWithdrawal = async (req, res) => {
    try {
        // let data = req.body;
        let data = await decryption(req.body.data);
        const { withdrawalId, channelType, channelId } = data;

        if (!withdrawalId || !channelType || !channelId) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!"
            });
            return res.status(400).send(error);
        }

        const withdrawal = await Withdrawal.findById(withdrawalId);

        if (!withdrawal) {
            let error = await encryption({
                status: false,
                message: "Withdrawal not found!"
            });
            return res.status(404).send(error);
        }

        const accountTypeMapping = {
            bank_details: 'bank',
            mobile_wallet: 'mobile',
            cash_pickup: 'cash',
            card: 'card',
            crypto: 'crypto'
        };

        // Findng the channel to delete
        const channelIndex = withdrawal[channelType].findIndex(channel => channel._id.toString() === channelId);

        if (channelIndex === -1) {
            let error = await encryption({
                status: false,
                message: "Channel not found!"
            });
            return res.status(404).send(error);
        }

        // checking if the current channel is default
        const isDefault = withdrawal[channelType][channelIndex].default;

        withdrawal[channelType].splice(channelIndex, 1);

        // Remove the account type if no channels are left
        if (withdrawal[channelType].length === 0) {
            withdrawal.account_type = withdrawal.account_type.filter(type => type !== accountTypeMapping[channelType]);
        }

        if (isDefault) {
            let newDefaultSet = false;

            // check other channel types for an available channel to set as default
            for (const type in accountTypeMapping) {
                if (type !== channelType && withdrawal[type] && withdrawal[type].length > 0) {
                    withdrawal[type][0].default = true;
                    newDefaultSet = true;
                    break;
                }
            }

            if (!newDefaultSet) {
                // If no other channel is found in the same withdrawal, search across other withdrawals
                const otherWithdrawals = await Withdrawal.find({
                    account: req?.user?._id,
                    _id: { $ne: withdrawalId }
                });

                for (const otherWithdrawal of otherWithdrawals) {
                    for (const type in accountTypeMapping) {
                        if (otherWithdrawal[type] && otherWithdrawal[type].length > 0) {
                            otherWithdrawal[type][0].default = true;
                            await otherWithdrawal.save();
                            newDefaultSet = true;
                            break;
                        }
                    }
                    if (newDefaultSet) break;
                }

                if (!newDefaultSet) {
                    console.log("Error: No other channel found to set as default!");
                }
            }
        }

        await withdrawal.save();

        let success = await encryption({
            status: true,
            message: "Channel deleted successfully!"
        });

        return res.status(200).send(success);

    } catch (err) {
        console.error("Internal server error:", err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};





//withdrawal channel apis

module.exports.addWithdrawalChannelsInCountry = async (req, res) => {
    try {
        const { countryName } = await decryption(req.body.data);
        if (!countryName) {
            let error = await encryption({
                status: false,
                message: "Something is missing!"
            });
            return res.status(400).send(error)
        } else {
            WithdrawalChannels.create({ country_name: countryName }).then(async (result) => {
                if (result) {
                    let error = await encryption({
                        status: true,
                        message: "Created successfully!"
                    });
                    return res.status(200).send(error)
                } else {
                    let error = await encryption({
                        status: true,
                        message: "Something went wrong while creating !"
                    });
                    return res.status(200).send(error)
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Internal server error!"
                });
                return res.status(400).send(error)
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error)
    }
}

module.exports.updateWithdrawalChannelsInCountry = async (req, res) => {
    try {
        const { countryId, inindividual_bank_account, inindividual_mobile_money, inindividual_cash_pickup, inindividual_card_payment, inindividual_crypto_wallet, business_bank_account, business_mobile_money, business_cash_pickup, business_card_payment, business_crypto_wallet } = await decryption(req.body.data);
        if (!countryId || !JSON.stringify(inindividual_bank_account) || !JSON.stringify(inindividual_mobile_money) || !JSON.stringify(inindividual_cash_pickup) || !JSON.stringify(inindividual_card_payment) || !JSON.stringify(inindividual_crypto_wallet) || !JSON.stringify(business_bank_account) || !JSON.stringify(business_mobile_money) || !JSON.stringify(business_cash_pickup) || !JSON.stringify(business_card_payment) || !JSON.stringify(business_crypto_wallet)) {
            let error = await encryption({
                status: false,
                message: "Something is missing!"
            });
            return res.status(400).send(error);
        } else {
            WithdrawalChannels.findById(countryId).then(async (countryFound) => {
                if (!countryFound) {
                    let error = await encryption({
                        status: false,
                        message: "Country not found!"
                    });
                    return res.status(404).send(error);
                } else {
                    let updateCreateObj = {
                        user_type: {
                            inindividual: {
                                bank_account: JSON.parse(inindividual_bank_account),
                                mobile_money: JSON.parse(inindividual_mobile_money),
                                cash_pickup: JSON.parse(inindividual_cash_pickup),
                                card_payment: JSON.parse(inindividual_card_payment),
                                crypto_wallet: JSON.parse(inindividual_crypto_wallet)
                            },
                            business: {
                                bank_account: JSON.parse(business_bank_account),
                                mobile_money: JSON.parse(business_mobile_money),
                                cash_pickup: JSON.parse(business_cash_pickup),
                                card_payment: JSON.parse(business_card_payment),
                                crypto_wallet: JSON.parse(business_crypto_wallet)
                            }
                        }
                    };
                    WithdrawalChannels.findByIdAndUpdate(countryFound._id, updateCreateObj, { new: true }).then(async (withdrawalUpdate) => {
                        if (!withdrawalUpdate) {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong updating country!"
                            });
                            return res.status(400).send(error);
                        } else {
                            let error = await encryption({
                                status: true,
                                message: "Updated successfully!",
                                withdrawalUpdate
                            });
                            return res.status(200).send(error);
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong updating country!"
                        });
                        return res.status(400).send(error);
                    });
                }
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong finding country!"
                });
                return res.status(400).send(error);
            });
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
}

module.exports.getAllCountryChannel = async (req, res) => {
    try {
        WithdrawalChannels.find({}, { country_name: 1, _id: 1 }).then(async (result) => {
            if (!result || result.length <= 0) {
                let error = await encryption({
                    message: "Your system don't have withdrawal channel countries!",
                    status: "404"
                });
                res.status(404).send(error);
            } else {
                let data = await encryption({
                    message: "These are withdrawal channels countries",
                    status: true,
                    withdrawalChannelsCountries: result
                });
                res.status(200).send(data)
            }
        }).catch(async (err) => {
            console.log(err);
            let error = await encryption({
                message: "Something went wrong while finding white list countries!",
                status: "500",
                err
            });
            res.status(400).send(error);
        });
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
}

module.exports.getSpecificWithdrawalChannelCountry = async (req, res) => {
    try {
        const countryName = req.query.countryName || null;
        const countryId = req.query.countryId || null;
        const user_type = req.query.user_type;
        if (!user_type) {
            let error = await encryption({
                message: "Something is missing!",
                status: false
            });
            return res.status(404).send(error);
        } else {
            if (countryName) {
                WithdrawalChannels.findOne({ country_name: countryName }).then(async (country) => {
                    if (!country) {
                        let error = await encryption({
                            message: "Country not found!",
                            status: false
                        });
                        return res.status(404).send(error);
                    } else {
                        // console.log(country)
                        let data = {}
                        if (user_type === "individual") {
                            console.log(country?.user_type?.inindividual)
                            data = country?.user_type?.inindividual;
                        } else if (user_type === "business") {
                            console.log(country?.user_type?.business)
                            data = country?.user_type?.business;
                        }
                        // country?.user_type.filter(options => { options == user_type })
                        const trueValues = {};
                        for (const key in data) {
                            if (data[key] === true && !key.startsWith("$")) {
                                trueValues[key] = true;
                            }
                        }
                        // console.log(trueValues)
                        let sendData = await encryption({
                            message: "Only this options are allow in this country!",
                            status: true,
                            data: trueValues
                        });
                        res.status(200).send(sendData);
                    }
                }).catch(async (err) => {
                    console.log(err)
                    let error = await encryption({
                        message: "Something went wrong while finding country!",
                        status: false
                    });
                    res.status(400).send(error);
                });
            } else if (countryId) {
                WithdrawalChannels.findById(countryId).then(async (country) => {
                    if (!country) {
                        let error = await encryption({
                            message: "Country not found!",
                            status: false
                        });
                        return res.status(404).send(error);
                    } else {
                        let data = {}
                        if (user_type === "individual") {
                            console.log(country?.user_type?.inindividual)
                            data = country?.user_type?.inindividual;
                        } else if (user_type === "business") {
                            console.log(country?.user_type?.business)
                            data = country?.user_type?.business;
                        }
                        let sendData = await encryption({
                            message: "Country details!",
                            status: true,
                            data: data
                        });
                        res.status(200).send(sendData);
                    }
                }).catch(async (err) => {
                    console.log(err)
                    let error = await encryption({
                        message: "Something went wrong while finding country!",
                        status: false
                    });
                    res.status(400).send(error);
                });
            } else {
                let error = await encryption({
                    message: "Something is missing!",
                    status: false
                });
                res.status(400).send(error);
            }
        }
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
}

module.exports.getWithDrawalChannels = async (req, res) => {
    try {
        const requestedCountry = req.params.country_iso_code;

        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/services`;
        const perPage = 100;

        const config = {
            headers: {
                'Authorization': `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`,
            },
            params: {
                per_page: perPage,
                country_iso_code: requestedCountry
            },
        };

        const response = await axios.get(API_URL, config);
        const services = response.data;

        const output = await encryption(services)
        res.json(output);
    } catch (err) {
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error);
    }
}

module.exports.createWithdrawalTransaction = async (req, res, next) => {
    try {

        const quotation_id = req.params.quotation_id;
        // const decryptedData = req.body
        const data = req.body.data;
        const decryptedData = await decryption(data);
        const {
            wallet_id,
            additional_information,
            purpose_of_remittance,
            account_id,
            service_id,
            payer_id,
            transaction_type,
            token,
            withdrawal_id,
            type
        } = decryptedData;

        // const withdrawalDetails = await Withdrawal.findOne({ account: account_id });
        const withdrawalDetails = await Withdrawal.findById(withdrawal_id)
        const accountDetails = await Account.findById(account_id).populate(["user", "company", "level"])

        if (accountDetails?.level?.level_no === 1) {
            const error = await encryption({
                status: false,
                message: "Withdrawal not allowed for this level account"
            })
            return res.status(400).send(error)
        }

        console.log(withdrawalDetails)

        let credit_party_identifier = {
        };
        let document_type = "";
        let document_number = "";

        if (service_id === 1) {
            // credit_party_identifier.bank_account_number = withdrawalDetails.bank_details[0].account_number//"0123456789"
            // credit_party_identifier.swift_bic_code = withdrawalDetails.bank_details[0].swift_code//"ABCDEFGH"
            credit_party_identifier.msisdn = withdrawalDetails.mobile_wallet[0]?.wallet_account_number// "272715638100" //beneficiary.mobile_wallet_account_number
            credit_party_identifier.account_number = withdrawalDetails.mobile_wallet[0]?.extras?.account_number //|| "0123456789"
            credit_party_identifier.iban = withdrawalDetails.mobile_wallet[0]?.extras?.iban //|| "AT351111111111111100"
            credit_party_identifier.email = accountDetails?.email
            credit_party_identifier.bank_account_number = withdrawalDetails.mobile_wallet[0]?.extras?.account_number //|| "0123456789"
            credit_party_identifier.account_type = withdrawalDetails.mobile_wallet[0]?.extras?.account_type //|| "SAVINGS"
            // console.log(credit_party_identifier.msisdn, "credit_party_identifier.msisdn")
        } else if (service_id === 2) {
            credit_party_identifier.bank_account_number = withdrawalDetails.bank_details[0]?.account_number// bank_details?.account_number //"272715638100" //beneficiary.bank_details.account_number
            credit_party_identifier.account_number = withdrawalDetails.bank_details[0]?.account_number //"272715638100" //beneficiary.bank_details.account_number

            credit_party_identifier.iban = withdrawalDetails.bank_details[0]?.iban//"PK73BAHL1116180400568001"// bank_details?.iban //"AT351111111111111100"; //beneficiary.bank_swift_code

            credit_party_identifier.cbu = withdrawalDetails.bank_details[0]?.extras?.cbu
            credit_party_identifier.account_type = withdrawalDetails.bank_details[0]?.extras?.account_type
            credit_party_identifier.bsb_number = withdrawalDetails.bank_details[0]?.extras?.bsb_number
            credit_party_identifier.branch_number = withdrawalDetails.bank_details[0]?.extras?.branch_number
            credit_party_identifier.swift_bic_code = withdrawalDetails.bank_details[0]?.extras?.swift_bic_code
            credit_party_identifier.routing_code = withdrawalDetails.bank_details[0]?.extras?.routing_code
            credit_party_identifier.entity_tt_id = withdrawalDetails.bank_details[0]?.extras?.entity_tt_id
            credit_party_identifier.ifs_code = withdrawalDetails.bank_details[0]?.extras?.ifs_code
            credit_party_identifier.clabe = withdrawalDetails.bank_details[0]?.extras?.clabe
            credit_party_identifier.msisdn = accountDetails?.phone
            credit_party_identifier.sort_code = withdrawalDetails.bank_details[0]?.extras?.sort_code
        } else if (service_id === 3) {
            credit_party_identifier.msisdn = withdrawalDetails?.cash_pickup[0].document_number//beneficiary.phone// "272715638100" //beneficiary.mobile_wallet_account_number
            document_type = withdrawalDetails?.cash_pickup[0].document_type//beneficiary.cash_pickup[0].document_type
            document_number = withdrawalDetails?.cash_pickup[0].document_number//beneficiary.cash_pickup[0].document_number
        } else if (service_id === 4) {
            credit_party_identifier.card_number = withdrawalDetails?.card[0].card_number//'4111254101010100'
        }

        const API_URL = `${process.env.THUNES_PROD_URL}/v2/money-transfer/quotations/ext-${quotation_id}/transactions`;
        let t_id = `instapay_t_id_${Date.now()}`
        const transactionExternalID = t_id;

        first_type = transaction_type[0] // to see if the sender is individual or business
        second_type = transaction_type[2] // to see if the reciever is individual or business
        let requestData
        let sender_obj_individual, sending_business, receiving_business;
        console.log(accountDetails?.user?.extras, "accountDetails?.user?.extras")
        let documentType = accountDetails?.user?.extras?.documentType === "id-card" ?
            "NATIONAL_ID" : accountDetails?.user?.extras?.documentType === "passport" ?
                "PASSPORT" : accountDetails?.user?.extras?.documentType === "driving-license" ?
                    "DRIVING_LICENSE" : "RESIDENT_CARD"
        if (transaction_type === 'C2C') {
            sender_obj_individual = {
                firstname: accountDetails?.user?.first_name || '',
                lastname: accountDetails?.user?.last_name || '',
                nationality: accountDetails?.user_nationaility || '',
                address: accountDetails?.address || '',
                id_expiration_date: accountDetails?.user?.extras?.dateOfExpiry || '',
                country_of_birth_iso_code: accountDetails?.user_nationaility || "",
                source_of_funds: accountDetails?.user?.source_of_funds || "",
                date_of_birth: accountDetails?.dob?.split("-")?.reverse()?.join("-") || "",
                country_iso_code: accountDetails?.country_iso_code || "",
                beneficiary_relationship: "SELF",
                nativename: "",
                id_country_iso_code: accountDetails?.user_nationaility || '',
                email: accountDetails?.email || '',
                city: accountDetails?.city || '',
                postal_code: accountDetails?.postal_code || '',
                id_type: documentType,
                id_number: accountDetails?.user?.extras?.idNumber || "",
                gender: accountDetails?.gender === "male" ? "MALE" : "FEMALE",
                code: accountDetails?.user?.extras?.idNumber || Math.floor(10000 + Math.random() * 90000),
                id_delivery_date: accountDetails?.user?.extras?.dateOfIssue || "",
                // middlename: "",
                occupation: accountDetails?.user?.occupation || "",
                province_state: accountDetails?.country_iso_code || "",
                msisdn: accountDetails?.phone || "",
                nationality_country_iso_code: accountDetails?.user_nationaility || "",
            }
        } else {
            sending_business = {
                registered_name: withdrawalDetails?.first_name || '',
                trading_name: withdrawalDetails?.first_name || '',
                address: withdrawalDetails?.address || '',
                postal_code: "123",
                city: withdrawalDetails?.city || "my_city",
                country_iso_code: "FRA",
                registration_number: "123"
            }
            receiving_business = {
                registered_name: withdrawalDetails?.first_name || 'first_name',
                trading_name: withdrawalDetails?.first_name || 'first_name',
                address: withdrawalDetails?.address || 'my_address',
                postal_code: "12345",
                city: withdrawalDetails?.city || "my_city",
                country_iso_code: "SGP",
                tax_id: 1234567,
                date_of_incorporation: "",
                representative_lastname: withdrawalDetails?.last_name || 'last_name',
                representative_firstname: withdrawalDetails?.first_name || 'first_name',
                representative_id_type: "",
                representative_id_country_iso_code: ""
            }
        }

        if (transaction_type === 'C2C') {
            const formatAddress = (bankDetails) => {
                if (!bankDetails) return '';

                const addressParts = [
                    bankDetails?.name,
                    bankDetails?.branch_name,
                    bankDetails?.branch_street,
                    bankDetails?.city,
                    bankDetails?.province
                ].filter(Boolean);

                return addressParts.join(', ');
            };
            const beneficiary_obj = {
                ...sender_obj_individual,
                bank_account_holder_name: withdrawalDetails?.bank_details[0]?.account_holder_name || accountDetails?.first_name + " " + accountDetails?.last_name || "",
                address: service_id === 2 ? formatAddress(withdrawalDetails?.bank_details[0]) : '',
                id_country_iso_code: accountDetails?.user_nationaility || '',
                postal_code: service_id === 2 ? (withdrawalDetails?.bank_details[0]?.postal_code || '') || '' : '',
                city: service_id === 2 ? (withdrawalDetails?.bank_details[0]?.city || '') || '' : '',
                nationality: accountDetails?.user_nationaility,
                country_iso_code: withdrawalDetails?.iso_code,
                id_type: documentType,
                id_number: accountDetails?.user?.extras?.idNumber,
                id_expiration_date: accountDetails?.user?.extras?.dateOfExpiry,
                id_delivery_date: accountDetails?.user?.extras?.dateOfIssue,
                code: accountDetails?.user?.extras?.idNumber || Math.floor(10000 + Math.random() * 90000),
                province_state: service_id === 2 ? (withdrawalDetails?.bank_details[0]?.province || '' || '') || '' : '',
            };
            requestData = {
                additional_information_1: additional_information,
                purpose_of_remittance: "FAMILY_SUPPORT",
                credit_party_identifier: credit_party_identifier,
                external_id: transactionExternalID,
                sender: sender_obj_individual,
                beneficiary: beneficiary_obj,
            };
        } else {
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: "FAMILY_SUPPORT",
                retail_fee_currency: "",
                credit_party_identifier: credit_party_identifier,
                retail_fee: "",
                external_id: transactionExternalID,
                sending_business: sending_business,
                receiving_business: receiving_business,
                document_reference_number: 123,
            };
        }

        const authHeader = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
        const config = {
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/json'
            }
        };

        requestData['callback_url'] = 'https://fontawesomev23.com/api/webhook/thunes-transaction-status?type=withdrawal';
        requestData['external_code'] = accountDetails._id;


        console.log(requestData, "requestDatainwithdr", API_URL, config)
        const response = await axios.post(API_URL, requestData, config);
        const transactionResult = response.data;

        console.log(transactionResult);

        // converting the times into human readbale 
        const humanReadableCreationDate = moment(transactionResult.creation_date).format('MMMM Do YYYY, h:mm a');
        const humanReadableExpirationDate = moment(transactionResult.expiration_date).format('MMMM Do YYYY, h:mm a');

        // filtering and keeping the fields which need to be shown
        const outputData = {
            TransactionID: transactionExternalID,
            additional_information_1: transactionResult.additional_information_1,
            sender: {
                ...transactionResult.sender,
            },
            beneficiary: {
                ...transactionResult.beneficiary,
            },
            creation_date: humanReadableCreationDate,
            credit_party_identifier: {
                ...transactionResult.credit_party_identifier,
            },
            destination: {
                ...transactionResult.destination,
            },
            expiration_date: humanReadableExpirationDate,
            payer: {
                ...transactionResult.payer,
            },
            purpose_of_remittance: transactionResult.purpose_of_remittance,
            sent_amount: {
                ...transactionResult.sent_amount,
            },
            source: {
                ...transactionResult.source,
            },
            status_message: transactionResult.status_message,
            transaction_type: transactionResult.transaction_type,
            wholesale_fx_rate: transactionResult.wholesale_fx_rate,
        };


        const decodedToken = jwt.verify(token, secretKey);
        console.log(decodedToken, "tokencheck")

        const transactionDetails = {
            calculations: decodedToken.result,
            extras: decodedToken.extras,
            purpose: "FAMILY_SUPPORT",
            description: additional_information,
            service_id,
            credit_party_identifier
        }

        const payload = {
            data: {
                TransactionID: transactionExternalID,
                wallet_id: wallet_id,
                status_message: transactionResult.status_message,
                user_id: accountDetails._id,
                withdrawal: true,
                transactionDetails
            },
            type,
        };

        console.log(payload, "payload")

        const encryptedData = await encryption(payload);

        console.log(encryptedData, "encryptedData")

        req.body = encryptedData;

        next();

        // console.log(payload, "payload")

        // const options = {
        //     expiresIn: '1h',
        // };

        // const new_token = jwt.sign(payload, secretKey);

        // const output = await encryption({ Message: "Transaction Created", token: new_token });
        // res.json(output);



    } catch (err) {
        console.log(err?.response?.data?.errors || err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error);
    }
}

module.exports.getAllWithdrawals = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }

        Transaction.find({ service_type: "withdrawal" }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Withdrawal transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })

    }
    catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error);
    }
}

module.exports.getAllUserWithdrawals = async (req, res) => {
    try {
        let limit = req.params.limit;
        let skip = req.params.skip;
        let account_id = req.params.account_id
        if (skip < 1) { skip = 1 }
        skip = (skip - 1) * 50
        if (limit > 100) {
            limit = 100;
        }

        Transaction.find({ account: account_id, service_type: "withdrawal" }).sort({ createdAt: -1 }).skip(skip).limit(limit).populate([
            {
                path: 'account',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'sender',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }, {
                path: 'receiver',
                select: 'user company',
                populate: ([
                    { path: 'user', select: 'first_name last_name' },
                    { path: 'company', select: 'company_name' }
                ])
            }
        ]).then(async (transactionList) => {
            if (transactionList.length) {
                let ciphertext = await encryption({
                    status: true,
                    message: "Withdrawal transactions!",
                    transactionList
                })
                res.status(200).send(ciphertext)
            } else {
                let error = await encryption({
                    status: false,
                    message: "No transaction found!"
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting transactions!"
            })
            res.status(400).send(error)
        })

    }
    catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        return res.status(500).send(error);
    }
}