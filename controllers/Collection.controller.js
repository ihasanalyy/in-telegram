const Account = require('../models/Account.model');
const { encryption, decryption } = require('../configurations/Encryption');
const Collection = require('../models/Collection.model');
const momenttz = require('moment-timezone');
const axios = require('axios');
const CryptoJS = require("crypto-js");
const mongoose = require('mongoose');
const { requestExchangeRateApi } = require('../utils/conversion');
const Wallet = require('../models/Wallet.model');
const Transaction = require('../models/Transaction.model');
const { addNotification } = require('../utils/generateNotification');
const { sendPrivateMessage } = require('../utils/websocket');
const { featureCheck, getExchangeRatesToUSD, balanceLimitCheck, limitCheck, calculateTopupMarkupHelper } = require('../utils/helpers');
const { createQuotation, createTransaction } = require('../utils/thunesHelpers');
const { topUpFeeCalculation } = require('./Trust-Payment.controller');
const { createTransactions, createAirtimeTransactions } = require('../utils/dtOneHelpers');
const ThunesCollection = require('../models/Thunes-Collection.model');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const Fee = require('../models/Fee.model');

const thunesAcceptUsername = process.env.THUNES_ACCEPT_APIKEY
const thunesAcceptPassword = process.env.THUNES_ACCEPT_APISECRET
const thunesAcceptURL = "https://api-col.limonetikqualif.com/v1/payment"

const collectionHeaders = {
    Authorization: 'Basic em55bk5sVmVXYmtKOkEwNzY1RTkyQzY0NzBFNUM3RjUxNzAzRDlEQUE5MEFF',
    Host: 'api.limonetikqualif.com',
    'Content-Type': 'application/json; charset=utf-8',
    Accept: 'text/json',
    'Accept-Encoding': 'gzip,deflate,sdch',
    'Accept-Language': 'en-US,en;q=0.8',
    'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
};

const createPaymentApi = async (requestBody) => {
    const url = 'https://api.limonetikqualif.com/Rest/V40/PaymentOrder/Create';

    try {

        const response = await axios.post(url, requestBody, {
            headers: collectionHeaders
        });

        console.log(response.data)
        return response.data;
    } catch (err) {
        console.log("err in createpayment", err.response.data);
        return err.response.data;
    }

}
const paymentDetails = async (paymentOrderId) => {
    const url = `https://api.limonetikqualif.com/Rest/V40/PaymentOrder/Detail?Id=${paymentOrderId}&AddElements=MerchantUrls,PaymentMethods`;

    try {
        const response = await axios.get(url, {
            headers: collectionHeaders
        });

        console.log(response.data);
        return response.data;
    } catch (err) {
        console.log("err in createpayment", err.response.data);
        return err.response.data;
    }
};

const chargeApi = async (requestBody) => {
    const url = `https://api.limonetikqualif.com/Rest/V40/PaymentOrder/Charge`;

    try {
        const response = await axios.post(url, requestBody, {
            headers: collectionHeaders
        });

        console.log("response", response.data);
        return response.data;
    } catch (err) {
        console.log("err", err.response.data);
        return err.response.data;
    }
};

const addTransaction = async (receiving_wallet, collection, exchangeRate, receiverTransactionObj) => {

    try {
        let receiverBalance = receiving_wallet.balance.available + exchangeRate.exchanged_amount;

        await Wallet.updateOne({ _id: receiving_wallet._id }, { $set: { "balance.available": receiverBalance } });
        let supdt = await Transaction.create(receiverTransactionObj);

        if (supdt) {
            const notificationObj = {
                title: 'Funds',
                desc: `You have added ${exchangeRate.exchanged_amount} ${receiving_wallet.currency.code} fund in your wallet`,
                type: 'funds',
                status: 'unread',
                to: collection.account,
                link_id: supdt._id,
            };

            addNotification(notificationObj);
            sendPrivateMessage(collection.account, "You have received a transaction.");
            console.log("Transaction successful!");

        } else {
            console.log("Transaction failed.");
        }
    } catch (err) {
        console.log("Transaction failed.", err);
    }
};

module.exports.createOrder = async (req, res) => {
    try {
        let data = await decryption(req.body.data)
        // let data = req.body.data
        const { receiving_wallet_id, amount, sending_currency, payment_method, account_id, country_code } = data

        const account = await Account.findById(account_id)
        const receivingWallet = await Wallet.findById(receiving_wallet_id)
        console.log(data)
        console.log(account)

        if (!account || !account.active) {
            let error = await encryption({
                status: false,
                message: "Account not found or inactive."
            });
            return res.status(404).send(error);
        } else {
            if (!receivingWallet || !receivingWallet.status === "active") {
                let error = await encryption({
                    status: false,
                    message: "Receiving wallet not found or inactive."
                });
                return res.status(404).send(error);
            } else {

                const newCollection = new Collection({
                    receiving_wallet: receiving_wallet_id,
                    account: account_id,
                    amount,
                    currency: sending_currency,
                    status: "created",
                    payment_method: payment_method,
                    country_code: country_code,
                });

                const savedCollection = await newCollection.save();
                const encryptedCollectionId = await CryptoJS.AES.encrypt(savedCollection._id.toString(), "saved_Collection_Encrypted_Key").toString()


                // Encoding the encrypted value to base64 to avoid slashes
                const base64EncodedValue = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(encryptedCollectionId));
                const requestBody = {
                    PaymentOrder: {
                        MerchantId: "kemitkingdom-pk",
                        // PaymentPageId: payment_method,
                        PaymentPageId: "easypaisa",
                        Amount: amount,
                        // Currency: sending_currency,
                        Currency: "PKR",
                        MerchantUrls: {
                            ReturnUrl: `https://my.insta-pay.ch/add-funds/success/${base64EncodedValue}`,
                            AbortedUrl: `https://my.insta-pay.ch/add-funds/aborted/${base64EncodedValue}`,
                            ErrorUrl: `https://my.insta-pay.ch/add-funds/error/${base64EncodedValue}`,
                            ServerNotificationUrl: `http://ip-dev-85ba34ddc4a3.herokuapp.com/api/collection/get-collection-details/${base64EncodedValue}`
                        },
                        MerchantOrder: {
                            Id: "1257981",
                            Customer: {
                                FirstName: "John",
                                LastName: "Doe",
                                Email: "testachat@thunes.com"
                            },
                            BillingAddress: {
                                Country: country_code
                            }
                        }
                    }
                }

                responseData = await createPaymentApi(requestBody)

                if (responseData.ReturnCode !== 1000) {

                    await Collection.deleteOne({ _id: savedCollection._id });

                    let error = await encryption({
                        status: false,
                        message: responseData,
                    })
                    return res.status(500).send(error)
                }

                savedCollection.paymentOrderId = responseData.PaymentOrderId;
                const updatedCollection = await savedCollection.save();

                let ciphertext = await encryption({
                    status: true,
                    message: "Payment created Successfully!",
                    collection: updatedCollection,
                    url: responseData.PaymentPageUrl,
                })
                res.status(200).send(ciphertext)
            }
        }

    } catch (err) {
        console.log(err)
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

// webhook
module.exports.getCollectionDetails = async (req, res) => {
    try {
        const { collection_id } = req.params;

        if (!collection_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        // DECRYPTING THE COLLECTION_ID
        const base64EncodedValue = collection_id;
        const decryptionKey = "saved_Collection_Encrypted_Key";

        // Decode the base64 value
        const decryptedBytes = CryptoJS.AES.decrypt(CryptoJS.enc.Base64.parse(base64EncodedValue).toString(CryptoJS.enc.Utf8), decryptionKey);
        const originalObjectIdString = decryptedBytes.toString(CryptoJS.enc.Utf8);

        // Converting the string back to a MongoDV ObjectId
        const originalObjectId = mongoose.Types.ObjectId.createFromHexString(originalObjectIdString);

        if (!mongoose.Types.ObjectId.isValid(originalObjectId)) {
            let error = await encryption({
                status: false,
                message: "Invalid id format!",
            });
            return res.status(400).send(error);
        }

        Collection.findById(originalObjectId).then(async (collection) => {
            if (collection) {
                let receiving_wallet = await Wallet.findOne({ $and: [{ _id: collection.receiving_wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level']) }])

                const responseData = await paymentDetails(collection.paymentOrderId);

                console.log(responseData.PaymentOrder.Status, "status")

                if (responseData.PaymentOrder.Status) {
                    const ref = 'tr_' + Date.now().toString();

                    if (receiving_wallet.currency.code !== collection.currency) {
                        let exchangeRate = await requestExchangeRateApi(receiving_wallet.currency.code, collection.currency, collection.amount, receiving_wallet.account.level._id, 'wallet_to_wallet');
                        var receiverTransactionObj = {
                            reference_id: ref,
                            type: 'transfer',
                            transaction_type: 'debit',
                            service_type: 'conversion',
                            status: 'completed',
                            description: 'Top ups',
                            currency: { code: receiving_wallet.currency.code, symbol: receiving_wallet.currency.symbol },
                            amount: collection.amount,
                            fee: receiving_wallet.currency.code !== collection.currency ? exchangeRate.fee.exchange_fee : 0,
                            total: receiving_wallet.currency.code !== collection.currency ? collection.amount + exchangeRate.fee.exchange_fee : collection.amount,
                            wallet_id: receiving_wallet.wallet_id,
                            wallet: receiving_wallet._id,
                            account: receiving_wallet.account._id,
                            sender: receiving_wallet.account._id,
                            receiver: receiving_wallet.account._id,
                            current_balance: receiving_wallet.balance.available
                        };
                        await addTransaction(receiving_wallet, collection, exchangeRate, receiverTransactionObj);
                    } else {
                        await addTransaction(receiving_wallet, collection, exchangeRate, receiverTransactionObj);

                    }

                    collection.status = responseData.PaymentOrder.Status;

                    await collection.save()

                    let ciphertext = await encryption({
                        status: true,
                        message: "Collection found!",
                        collection
                    })
                    res.status(200).send(ciphertext)
                }
            } else {
                let error = await encryption({
                    status: false,
                    message: "Collection not found!"
                })
                res.status(500).send(error)
            }
        }).catch(async (err) => {
            console.log(err)
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting collection"
            })
            res.status(500).send(error)
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

module.exports.getPaymentDetails = async (req, res) => {
    try {
        const { collection_id } = req.params;
        if (!collection_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        Collection.findById(collection_id).then(async (collection) => {
            if (collection) {
                axios.get(`https://api.limonetikqualif.com/Rest/V40/PaymentOrder/Detail?Id=${collection.paymentOrderId}&AddElements=MerchantUrls,PaymentMethods`,
                    {
                        headers: collectionHeaders
                    }).then(async (collectionDetails) => {
                        if (collectionDetails.status === 200) {
                            let ciphertext = await encryption({
                                status: true,
                                message: "Collection details found!",
                                details: collectionDetails.data,
                            })
                            res.status(200).send(ciphertext)
                        } else {
                            res.status(404).send({
                                status: "false",
                                message: "Collection details not found!"
                            })
                        }
                    }).catch(async (err) => {
                        console.log(err);
                        res.status(400).send({
                            status: "false",
                            message: "Something went wrong while getting payment details!"
                        })
                    })
            } else {
                let error = await encryption({
                    status: true,
                    message: "Collection not found!",
                })
                res.status(404).send(error)
            }
        }).catch(async (err) => {
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting collection"
            })
            res.status(500).send(error)
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

module.exports.charge = async (req, res) => {
    try {
        const { collection_id } = req.params;

        if (!collection_id) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing!",
            });
            return res.status(400).send(error);
        }

        try {
            const collection = await Collection.findById(collection_id);

            if (collection) {
                const requestBody = {
                    PaymentOrderId: collection.paymentOrderId,
                    ChargeAmount: collection.amount,
                    Currency: collection.currency
                };

                const responseData = await chargeApi(requestBody);

                let ciphertext = await encryption({
                    status: true,
                    message: "Charged",
                    response: responseData
                });
                res.status(200).send(ciphertext);
            } else {
                let error = await encryption({
                    status: false,
                    message: "Collection not found!",
                });
                res.status(404).send(error);
            }
        } catch (err) {
            console.log(err);
            let error = await encryption({
                status: false,
                message: "Something went wrong while getting collection"
            });
            res.status(500).send(error);
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

module.exports.getUserFunds = async (req, res) => {
    try {
        const { account_id } = req.params;
        const account = await Account.findById(account_id)
        if (!account || !account.active) {
            let error = await encryption({
                status: false,
                message: "Account not found or inactive."
            });
            return res.status(404).send(error);
        }
        else {
            Collection.find({ account: account_id }).then(async (collections) => {
                let ciphertext = await encryption({
                    status: false,
                    message: "Funds found!",
                    collections
                });
                res.status(200).send(ciphertext);
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the funds"
                });
                res.status(404).send(error);
            })
        }
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

module.exports.getAllFunds = async (req, res) => {
    try {

        Collection.find()
            .populate([{ path: "account", select: "user account_type", populate: ([{ path: 'user company', select: 'first_name last_name company_name -_id' }]) }])
            .populate([{ path: 'receiving_wallet', select: "currency balance wallet_type wallet_id" }]).then(async (collections) => {
                let ciphertext = await encryption({
                    status: false,
                    message: "Funds found!",
                    collections
                });
                res.status(200).send(ciphertext);
            }).catch(async (err) => {
                console.log(err);
                let error = await encryption({
                    status: false,
                    message: "Something went wrong while getting the funds"
                });
                res.status(404).send(error);
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

const createPaymentOrder = async (requestBody) => {
    try {

        const url = `${thunesAcceptURL}/payment-orders`

        const response = await axios.post(url, requestBody, {
            auth: {
                username: thunesAcceptUsername,
                password: thunesAcceptPassword,
            }
        })

        return response.data
    } catch (err) {
        console.log("erros in createPaymentOrder", err?.response?.data?.errors)
        return { status: false, message: "Something went wrong while creating the payment order" }
    }
}

const charge = async (requestId = "936704320703") => {
    try {
        const url = `${thunesAcceptURL}/payment-orders/${requestId}/charge`

        const requestBody = {
            "requested": {
                "amount": 10,
                "currency": "PKR"
            },
            "external_id": "023212633638",
            "custom_data": null
        }

        const response = await axios.post(url, requestBody, {
            auth: {
                username: thunesAcceptUsername,
                password: thunesAcceptPassword
            }
        })

        return response.data
    } catch (err) {
        console.log("erros in charge", err)
        return { status: false, message: "Something went wrong while charging the payment order" }
    }
}

const cancel = async (paymentId) => {
    try {
        const url = `${thunesAcceptURL}/payment-orders/${paymentId}/cancellations`

        const response = await axios.get(url, {
            auth: { username: thunesAcceptUsername, password: thunesAcceptPassword }
        })

        return response.data
    } catch (err) {
        console.log("erros in cancel", err)
        return { status: false, message: "Something went wrong while canceling the payment order" }
    }
}

(async () => {
    const requestBody = {
        requested: {
            amount: 1,
            currency: 'PKR'
        },
        merchant_id: "kemitkingdom-pkr",
        external_id: "1727329470865A9111012",
        payment_page_id: "easypaisa",
        merchant_urls: {
            aborted_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=aborted&transaction_id`,
            error_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=error&transaction_id`,
            return_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=success&transaction_token`,
            notification_url: `https://webhook.site/9486d1b8-3af0-4495-8a06-e0ea75237e19`
        },
        merchant_order: {
            customer: {
                culture: "es-ES",
                email: "insta@pay.com",
                first_name: "Jean",
                last_name: "Dupont"
            },
            billing_address: {
                country_iso_code: "PAK"
            }
        },
        type: "C2B",
        integration_mode: "REDIRECT"
    };

    // const response = await createPaymentOrder(requestBody);

    // console.log(response);
})()

module.exports.createPayment = async (req, res) => {
    try {
        const data = await decryption(req.body.data);
        // const data = req.body

        const {
            wallet_id,
            amount,
            // payment_method,
            account_id,
            iso_code,
            payerId,
            service_id,
            channel_name,
            service_name,
            transaction_type,
            token,
            additional_information,
            purpose_of_remittance,
            beneficiary_id,
            bank_id,
            mobile_wallet_id,

        } = data;

        console.log(data, "data")

        if (!amount || !account_id || !iso_code) {
            console.log(!wallet_id, !amount, !account_id, !iso_code)
            let error = await encryption({
                status: false,
                message: "Missing required fields"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id).populate("user")
        const wallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!wallet || !account) {
            let error = await encryption({
                status: false,
                message: "Wallet or Account not found"
            });
            return res.status(404).send(error);
        }

        let feeDetails = await topUpFeeCalculation(wallet, amount, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', wallet.account.level);

        if (featureChecked && feeDetails >= 0) {

            let amountInUSD = await getExchangeRatesToUSD(wallet.currency.code, 'USD', amount);
            console.log("amountInUSD", amountInUSD)
            let balanceLimitChecked = await balanceLimitCheck(parseInt(amountInUSD), wallet.account);
            let limitChecked = limitCheck(parseInt(amountInUSD), wallet.account.level, wallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {
                const data = {
                    token, transaction_type, amount, service_name, wallet_id, channel_name, payerId, service_id, iso_code
                }
                const quotationDetails = await createQuotation(data)
                console.log("quotationDetails", quotationDetails)

                if (quotationDetails.status) {

                    const service = {
                        id: service_id,
                    }
                    const transactionData = {
                        wallet_id,
                        additional_information,
                        purpose_of_remittance,
                        user_id: account.user.id,
                        beneficiary_id,
                        service,
                        bank_id,
                        mobile_wallet_id,
                        transaction_type,
                        token: quotationDetails.quotationResult.token,
                    }
                    const createTransactionDetails = await createTransaction(quotationDetails.quotationResult.QuotationID, transactionData)
                    console.log("createTransactionDetails", createTransactionDetails)
                    if (createTransactionDetails.status) {
                        let ref = 'tr_' + Date.now().toString();

                        const requestBody = {
                            requested: {
                                amount: 1,
                                currency: 'PKR'
                            },
                            merchant_id: "kemitkingdom-pkr",
                            external_id: ref,
                            payment_page_id: "jazzcash",
                            merchant_urls: {
                                aborted_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=aborted&transaction_id=${createTransactionDetails?.id}`,
                                error_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=error&transaction_id=${createTransactionDetails?.id}`,
                                return_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=success&transaction_token=${createTransactionDetails?.token}`,
                                notification_url: `https://fontawesomev23.com/api/webhook/thunes-accept-payment?external_id=${ref}&transaction_id=${createTransactionDetails?.id}&service=international`
                            },
                            merchant_order: {
                                customer: {
                                    culture: "es-ES",
                                    email: account?.email || "insta@pay.com",
                                    first_name: account?.first_name || "Jean",
                                    last_name: account?.last_name || "Dupont"
                                },
                                billing_address: {
                                    country: account?.country_iso_code || "PAK"
                                }
                            },
                            type: "C2B",
                            integration_mode: "REDIRECT"
                        };

                        const response = await createPaymentOrder(requestBody);
                        console.log(response, "response in createPaymentOrder");

                        if (response?.status === "CREATED") {

                            const senderTimezone = wallet.account.timezone || "UTC"
                            const senderCurrentTime = momenttz().tz(senderTimezone).format();
                            const transactionObj = {
                                reference_id: ref,
                                external_reference: response.id,
                                type: 'thunes_accept',
                                transaction_type: 'credit',
                                service_type: 'topup',
                                payment_type: 'mobile_wallet',
                                status: 'INITIATED',
                                purpose: '',
                                description: 'Topup by Mobile Wallet',
                                currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                                amount: amount - feeDetails,
                                fee: feeDetails,
                                total: amount,
                                wallet_id: wallet.wallet_id,
                                wallet: wallet._id,
                                account: wallet.account._id,
                                receiver: wallet.account._id,
                                current_balance: wallet.balance.available,
                                timeline: [
                                    {
                                        status: 'INITIATED',
                                        date: senderCurrentTime,
                                    }
                                ]
                            };

                            Transaction.create(transactionObj).then(async () => {
                                let cipherText = await encryption({
                                    status: true,
                                    message: "Transaction initiated successfully.",
                                    external_link: response?.payment_url
                                });
                                return res.status(200).send(cipherText);
                            }).catch(async (err) => {
                                console.log(err);
                                let error = await encryption({
                                    status: false,
                                    message: "Something went wrong while creating transaction"
                                });
                                return res.status(500).send(error);
                            });
                        }
                        else {
                            let error = await encryption({
                                status: false,
                                message: "Something went wrong while creating thunes accept transaction"
                            });
                            return res.status(500).send(error);
                        }
                    } else {
                        let error = await encryption({
                            status: false,
                            message: "Error while creating transaction"
                        })
                        return res.status(500).send(error)
                    }
                } else {
                    console.log("quotationDetails", quotationDetails)
                    let error = await encryption({
                        status: false,
                        message: "Error while creating quotation"
                    })
                    return res.status(500).send(error)
                }
            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked);
                    return res.status(400).send(error);
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    });
                    return res.status(400).send(error);
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked);
                    return res.status(400).send(error);
                }
            }
        }
        else {
            let error = await encryption({
                status: false,
                message: "This feature is not allowed"
            });
            return res.status(400).send(error);
        }

    } catch (err) {
        console.log("Error in createPaymentOrder", err);
        const error = await encryption({
            status: false,
            message: "Internal server error"
        });
        res.status(500).send(error);
    }
};
module.exports.createPaymentAirtime = async (req, res) => {
    try {
        // const data = await decryption(req.body.data);
        const data = req.body

        const {
            wallet_id,
            amount,
            account_id,
            iso_code,
            token,
            number,
            type,
        } = data;

        console.log(data, "data")

        if (!amount || !account_id || !iso_code) {
            console.log(!wallet_id, !amount, !account_id, !iso_code)
            let error = await encryption({
                status: false,
                message: "Missing required fields"
            });
            return res.status(400).send(error);
        }

        const account = await Account.findById(account_id).populate("user")
        const wallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!wallet || !account) {
            let error = await encryption({
                status: false,
                message: "Wallet or Account not found"
            });
            return res.status(404).send(error);
        }

        const airtimeData = {
            amount,
            number,
            token,
            wallet_id
        }

        let createAirtimeDetails
        if (type !== "fixed") {
            createAirtimeDetails = await createTransactions(airtimeData);
        } else {
            createAirtimeDetails = await createAirtimeTransactions(airtimeData);
        }
        createAirtimeDetails = await createTransactions(airtimeData);

        const transactionDetails = type === "airtime" ? createAirtimeDetails?.data?.extractedDataWithAdjustedValues : type === "bundle" ? createAirtimeDetails?.data?.filteredDataWithCurrency : createAirtimeDetails?.data?.decoded;

        console.log(transactionDetails, createAirtimeDetails?.data, "createAirtimeDetails");

        if (!createAirtimeDetails?.status) {
            let error = await encryption({
                status: false,
                message: createAirtimeDetails?.message
            });
            return res.status(400).send(error);
        }

        let feeDetails = await topUpFeeCalculation(wallet, amount, 'topup_card_payment');
        let featureChecked = await featureCheck('topup_channel', 'card_payment', wallet.account.level);

        if (featureChecked && feeDetails >= 0) {

            let amountInUSD = await getExchangeRatesToUSD(wallet.currency.code, 'USD', amount);
            console.log("amountInUSD", amountInUSD)
            let balanceLimitChecked = await balanceLimitCheck(parseInt(amountInUSD), wallet.account);
            let limitChecked = limitCheck(parseInt(amountInUSD), wallet.account.level, wallet.account, 'topup');

            if (limitChecked.status && balanceLimitChecked) {

                let ref = 'tr_' + Date.now().toString();

                const requestBody = {
                    requested: {
                        amount: 1,
                        currency: 'PKR'
                    },
                    merchant_id: "kemitkingdom-pkr",
                    external_id: ref,
                    payment_page_id: "jazzcash",
                    merchant_urls: {
                        aborted_url: `https://my.instapay.ch/transfer/aborted`,
                        error_url: `https://my.instapay.ch/transfer/error`,
                        return_url: `https://my.instapay.ch/transfer/success`,
                        notification_url: `https://fontawesomev23.com/api/webhook/thunes-accept-payment?external_id=${ref}&transaction_id=1234&service=international`
                    },
                    merchant_order: {
                        customer: {
                            culture: "es-ES",
                            email: account?.email || "insta@pay.com",
                            first_name: account?.first_name || "Jean",
                            last_name: account?.last_name || "Dupont"
                        },
                        billing_address: {
                            country: account?.country_iso_code || "PAK"
                        }
                    },
                    type: "C2B",
                    integration_mode: "REDIRECT"
                };

                const response = await createPaymentOrder(requestBody);
                console.log(response, "response in createPaymentOrder");

                if (response?.status === "CREATED") {

                    const senderTimezone = wallet.account.timezone || "UTC"
                    const senderCurrentTime = momenttz().tz(senderTimezone).format();
                    const transactionObj = {
                        reference_id: ref,
                        external_reference: response.id,
                        type: 'thunes_accept',
                        transaction_type: 'credit',
                        service_type: 'topup',
                        payment_type: 'mobile_wallet',
                        status: 'INITIATED',
                        purpose: '',
                        description: 'Topup by Mobile Wallet',
                        currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
                        amount: amount - feeDetails,
                        fee: feeDetails,
                        total: amount,
                        wallet_id: wallet.wallet_id,
                        wallet: wallet._id,
                        account: wallet.account._id,
                        receiver: wallet.account._id,
                        current_balance: wallet.balance.available,
                        timeline: [
                            {
                                status: 'INITIATED',
                                date: senderCurrentTime,
                            }
                        ]
                    };

                    Transaction.create(transactionObj).then(async () => {
                        let cipherText = await encryption({
                            status: true,
                            message: "Transaction initiated successfully.",
                            external_link: response?.payment_url
                        });
                        return res.status(200).send(cipherText);
                    }).catch(async (err) => {
                        console.log(err);
                        let error = await encryption({
                            status: false,
                            message: "Something went wrong while creating transaction"
                        });
                        return res.status(500).send(error);
                    });
                }
                else {
                    let error = await encryption({
                        status: false,
                        message: "Something went wrong while creating thunes accept transaction"
                    });
                    return res.status(500).send(error);
                }

            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked);
                    return res.status(400).send(error);
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    });
                    return res.status(400).send(error);
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked);
                    return res.status(400).send(error);
                }
            }
        }
        else {
            let error = await encryption({
                status: false,
                message: "This feature is not allowed"
            });
            return res.status(400).send(error);
        }

    } catch (err) {
        console.log("Error in createPaymentOrder", err);
        const error = await encryption({
            status: false,
            message: "Internal server error"
        });
        res.status(500).send(error);
    }
};

// (async () => {
//     console.log(await cancel("1573434938"))
// }
// )()


// {
//     creation_date: '2024-08-08T13:20:01',
//     external_id: '02321263363691221',
//     id: '701543847103',
//     integration_mode: 'REDIRECT',
//     merchant_external_id: null,
//     merchant_id: null,
//     merchant_order: {
//       billing_address: null,
//       cart_items: [],
//       custom_data: {},
//       customer: {
//         account_creation_date: null,
//         company_name: null,
//         culture: 'es-ES',
//         custom_data: {},
//         date_of_birth: null,
//         email: 'sarfarazahmed1012@gmail.com',
//         first_name: 'Jean',
//         home_phone: null,
//         id: null,
//         last_name: 'Dupont',
//         mobile_phone: null,
//         title: null
//       },
//       searchable_custom_data_1: null,
//       searchable_custom_data_2: null,
//       shipping_address: null,
//       tax: null,
//       total: null
//     },
//     merchant_urls: {
//       aborted_url: 'http://www.citronrose.com/Payment_Cancelled.aspx',
//       error_url: 'http://www.citronrose.com/Payment_Error.aspx',
//       notification_url: 'https://instapay.requestcatcher.com/test',
//       return_url: 'http://www.citronrose.com/Payment_Return.aspx'
//     },
//     payment_integrator_id: null,
//     payment_methods: [],
//     payment_page_id: 'jazzcash',
//     payment_url: 'https://payment.limonetikqualif.com/SimpaisaDirect/Order/PayPage/701543847103?LmkData=bGc9ZXMtRVM=',
//     processed: { amount: 1, currency: 'PKR' },
//     quotation_id: null,
//     requested: { amount: 1, currency: 'PKR' },
//     status: 'CREATED',
//     type: 'C2B',
//     update_date: '2024-08-08T13:20:01'
//   }


module.exports.getServices = async (req, res) => {
    try {
        const { iso_code } = req.params
        const collection = await ThunesCollection.findOne({ country_code: iso_code })
        console.log(collection)

        if (collection) {
            let services = []

            if (collection.wallet.length) {
                services.push({ id: 1, name: "wallet" })
            }
            if (collection.bank.length) {
                services.push({ id: 2, name: "bank" })
            }
            if (collection.card.length) {
                services.push({ id: 3, name: "card" })
            }
            if (collection.crypto.length) {
                services.push({ id: 4, name: "crypto" })
            }


            const cipherText = await encryption({ status: true, data: { merchant_id: collection.merchant_id, services } })
            res.status(200).send(cipherText)
        } else {
            const error = await encryption({ status: false, message: "No services found" })
            res.status(404).send(error)
        }
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: "Internal server error"
        });
        res.status(500).send(error);

    }
}

module.exports.getPayers = async (req, res) => {
    try {
        const { iso_code, service } = req.params
        const collection = await ThunesCollection.findOne({ country_code: iso_code })
        console.log(collection)

        if (collection) {
            let payers = []

            if (service === "wallet" && collection.wallet.length) {
                payers = collection.wallet.filter(item => item.active).map(item => ({ name: item.name, payment_page_id: item.payment_page_id, active: item.active }));
            }
            else if (service === "bank" && collection.bank.length) {
                payers = collection.bank.map(item => ({ name: item.name, payment_page_id: item.payment_page_id, active: item.active }));
            }
            else if (service === "card" && collection.card.length) {
                payers = collection.card.map(item => ({ name: item.name, payment_page_id: item.payment_page_id, active: item.active }));
            }
            else if (service === "crypto" && collection.crypto.length) {
                payers = collection.crypto.map(item => ({ name: item.name, payment_page_id: item.payment_page_id, active: item.active }));
            }

            if (payers.length) {
                const cipherText = await encryption({ status: true, data: { merchant_id: collection.merchant_id, payers } });
                res.status(200).send(cipherText);
            } else {
                const error = await encryption({ status: false, message: "No payers found for the selected service" });
                res.status(404).send(error);
            }
        } else {
            const error = await encryption({ status: false, message: "No services found" })
            res.status(404).send(error)
        }
    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: "Internal server error"
        });
        res.status(500).send(error);

    }
}

const thunesCollectionFee = async (country_iso_code, payment_page_id, service_name) => {
    try {
        console.log({ country_iso_code, payment_page_id, service_name })
        const collection = await ThunesCollection.findOne({
            country_code: country_iso_code,
            [`${service_name}.payment_page_id`]: payment_page_id
        });

        console.log(collection, "collection")

        if (collection) {
            const serviceEntry = collection[service_name].find(service => service.payment_page_id === payment_page_id);

            if (serviceEntry && serviceEntry.fee && serviceEntry.fee.thune_fee) {
                return {
                    status: true,
                    fixed: serviceEntry.fee.thune_fee.fixed,
                    percent: serviceEntry.fee.thune_fee.percent,
                };
            }
        }
        return { status: false, message: "No matching service or fee details found" };
    } catch (error) {
        console.log(error)
        return { status: false, message: "Error finding fee details", error };
    }
};

const calculateTopupRates = async ({ amount, payment_page_id, country_iso_code, currency, wallet_id, service_name }) => {
    try {
        amount = formatDecimalNumbersWithLimit(amount, 2);

        let receiverWallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!receiverWallet) {
            throw new Error("Wallet not found!");
        }

        const allowedServices = ['wallet', 'bank', 'card', 'crypto'];

        if (!allowedServices.includes(service_name)) {
            throw new Error("Invalid service name");
        }

        // thunes fee
        const thunesFee = await thunesCollectionFee(country_iso_code, payment_page_id, service_name);
        if (!thunesFee.status) {
            throw new Error(thunesFee.message);
        }

        const { fixed: thunesFixed, percent: thunesPercent } = thunesFee;

        // convert fixed fee from USD to receiver's currency
        const fixedFeeInReceiverCurrency = await getExchangeRatesToUSD('USD', receiverWallet.currency.code, thunesFixed);

        // calculate percentage fee in the receiver's currency
        const percentFee = formatDecimalNumbersWithLimit((thunesPercent / 100) * amount, 2);

        // Total fee (Fixed + Percent)
        let totalFee = formatDecimalNumbersWithLimit(fixedFeeInReceiverCurrency + percentFee, 2);

        // System fee
        let systemFee = await topUpFeeCalculation(receiverWallet, amount, 'topup_mobile_wallet');

        // Addng system fee to total fee
        totalFee = formatDecimalNumbersWithLimit(totalFee + systemFee, 2);

        // Amount after deducting the fee
        const amountAfterFee = formatDecimalNumbersWithLimit(amount - totalFee, 2);

        console.log({ amountAfterFee, totalFee, systemFee, percentFee, fixedFeeInReceiverCurrency, thunesFixed, thunesPercent })

        if (amountAfterFee < 0) {
            throw new Error("Amount after fee deduction set to be negative!");
        }

        // Fetch exchange rate to convert amount from receiver's currency to local currency
        const exchangeRateResponse = await axios.get(`https://api.exchangeratesapi.io/v1/convert?access_key=${process.env.EXCHANGE_RATE_KEY}&from=${receiverWallet.currency.code}&to=${currency}&amount=${amountAfterFee}&format=1`);
        if (!exchangeRateResponse.data.success) {
            throw new Error("Exchange Rates not found!");
        }

        // Original exchange rate
        const originalRate = formatDecimalNumbersWithLimit(exchangeRateResponse.data.info.rate, 6);

        let topup_service_name = {
            'bank': "topup_bank",
            'wallet': "topup_mobile_wallet",
            'card': "topup_card_payment"
        }[service_name];

        const feeDetails = await Fee.findOne({ service_name: topup_service_name, account_level: receiverWallet.account.level._id });

        // Calculate exchange rate with markup
        const exchangeRateWithMarkup = calculateTopupMarkupHelper(originalRate, feeDetails.percentage_markup, receiverWallet.currency.code, currency);

        // Total amount in local currency using the exchange rate with markup
        const totalAmountInLocalCurrency = formatDecimalNumbersWithLimit(amount * exchangeRateWithMarkup, 2);

        const result = {
            exchanged_rate: { value: formatDecimalNumbersWithLimit(exchangeRateWithMarkup, 6), currency: currency },
            fee: { value: formatDecimalNumbersWithLimit(totalFee, 2), currency: receiverWallet.currency.code },
            recipient: { value: formatDecimalNumbersWithLimit(amountAfterFee, 2), currency: receiverWallet.currency.code },
            total: { value: totalAmountInLocalCurrency, currency: currency },
            sending: { value: formatDecimalNumbersWithLimit(amount, 2), currency: receiverWallet.currency.code },
            extras: {
                original_exchange_rate: formatDecimalNumbersWithLimit(originalRate, 6),
                markup_value: feeDetails.percentage_markup,
                fee_type: feeDetails.fee_type,
            }
        };

        // const data=  {
        //     original_amount: formatDecimalNumbersWithLimit(amount, 2),
        //     fee: totalFee,
        //     amount_after_fee: amountAfterFee,
        //     exchange_rate_with_markup: formatDecimalNumbersWithLimit(exchangeRateWithMarkup, 6),
        //     total_amount_in_local_currency: totalAmountInLocalCurrency,
        //     originalRate
        // }

        return result;
    } catch (error) {
        console.error("Error in calculating top-up rates:", error.message);
        throw new Error(error.message);
    }
};


module.exports.getCollectionTopupRates = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data)

        const { amount, payment_page_id, country_iso_code, currency, wallet_id, service_name } = data;

        const result = await calculateTopupRates({ amount, payment_page_id: payment_page_id.toLowerCase(), country_iso_code, currency, wallet_id, service_name });

        const ciphertext = await encryption({
            status: true,
            message: "Topup Calculations",
            data: result
        })

        console.log(ciphertext)

        return res.status(200).send(ciphertext);

    } catch (error) {
        console.log(error);
        const err = await encryption({
            status: false,
            message: error?.message || "Internal server error"
        });
        res.status(500).send(err);
    }
};



module.exports.createTopupPaymentOrder = async (req, res) => {
    try {

        const data = await decryption(req.body.data)
        // const data = req.body
        let { amount, merchant_id, payment_page_id, country_iso_code, currency, wallet_id, service_name } = data

        let receiverWallet = await Wallet.findOne({
            $and: [
                { _id: wallet_id },
                { wallet_type: "insta" },
                { status: 'active' },
                {
                    $or: [
                        { $and: [{ admin_blocked: false }, { blocked: false }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: false }] },
                        { $and: [{ admin_blocked: false }, { blocked: { $exists: false } }] },
                        { $and: [{ admin_blocked: { $exists: false } }, { blocked: { $exists: false } }] }
                    ]
                }
            ]
        }).populate([{ path: 'account', populate: (['level']) }]);

        if (!receiverWallet) {
            return res.status(404).send(await encryption({ status: false, message: "Wallet not found" }));
        }

        const result = await calculateTopupRates({ amount, payment_page_id: payment_page_id.toLowerCase(), country_iso_code, currency, wallet_id, service_name });

        console.log({ result })

        let feature;
        if (service_name === "bank") {
            feature = "bank"
        } else if (service_name === "wallet") {
            feature = "mobile_money"
        } else if (service_name === "card") {
            feature = "card_payment"
        }
        let featureChecked = await featureCheck('topup_channel', feature, receiverWallet.account.level)

        if (featureChecked) {
            let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', amount)
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup')
            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = momenttz().tz(receiverTimezone).format();
                let ref = 'tr_' + Date.now().toString() + Math.floor(Math.random() * 1000);

                const requestBody = {
                    requested: {
                        amount: formatDecimalNumbersWithLimit(result.total.value, 2),
                        currency,
                    },
                    merchant_id,
                    external_id: ref,
                    payment_page_id,
                    merchant_urls: {
                        aborted_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=aborted&transaction_id`,
                        error_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=error&transaction_id`,
                        return_url: `https://my.insta-pay.ch/payments?payment_action=send_money&send_type=international&transaction_status=success&transaction_token`,
                        notification_url: `https://fontawesomev23.com/api/webhook/thunes-accept-payment?ref=${ref}`
                    },
                    merchant_order: {
                        customer: {
                            culture: "es-ES",
                            email: receiverWallet.account.email || "insta@pay.com",
                            first_name: receiverWallet.account.first_name,
                            last_name: receiverWallet.account.last_name
                        },
                        billing_address: {
                            country_iso_code,
                        }
                    },
                    type: "C2B",
                    integration_mode: "REDIRECT"
                };

                const response = await createPaymentOrder(requestBody);

                console.log(response, "response")
                if (response.status === "CREATED") {
                    let receiverTransactionObj = {
                        reference_id: ref,
                        external_reference: response.id,
                        type: 'instant',
                        transaction_type: 'credit',
                        service_type: 'topup',
                        payment_type: 'mobile_wallet',
                        status: 'INITIATED',
                        purpose: '',
                        description: 'Topup by Mobile Wallet',
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        amount: result.recipient.value,
                        fee: result.fee.value,
                        total: result.sending.value,
                        recipient_received_amount: result.total.value,
                        recipient_received_currency: result.total.currency,
                        fee_type: result.extras.fee_type,
                        markup: result.extras?.markup_value,
                        markup_currency: receiverWallet.currency.code,
                        exchange_rate: result.extras?.original_exchange_rate,
                        exchange_rate_markup: result.exchanged_rate.value,
                        wallet_id: receiverWallet.wallet_id,
                        wallet: receiverWallet._id,
                        account: receiverWallet.account._id,
                        receiver: receiverWallet.account._id,
                        current_balance: receiverWallet.balance.available,
                        hidden: true,
                        timeline: [
                            {
                                status: 'INITIATED',
                                date: receiverCurrentTime,
                            }
                        ]
                    }

                    Transaction.create(receiverTransactionObj).then(async (transaction) => {
                        let ciphertext = await encryption({
                            status: "true",
                            message: "Transaction initiated successfully.",
                            currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                            transaction_id: transaction._id,
                            transaction_ref: transaction.reference_id,
                            external_link: response.payment_url
                        })
                        res.status(200).send(ciphertext);
                    }).catch(async (err) => {
                        // console.log(err);
                        let ciphertext = await encryption({
                            status: "false",
                            message: "Transaction failed.",
                            error: err
                        })
                        res.status(400).send(ciphertext);
                    })
                } else {
                    let error = await encryption({
                        status: false,
                        message: "Transaction failed.",
                        error: response
                    })
                    res.status(400).send(error)
                }

            } else {
                if (!limitChecked.status && balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
                if (limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption({
                        status: false,
                        code: 'ble400',
                        message: "Balance limit exceeded"
                    })
                    res.status(400).send(error)
                }
                if (!limitChecked.status && !balanceLimitChecked) {
                    let error = await encryption(limitChecked)
                    res.status(400).send(error)
                }
            }
        } else {
            let error = await encryption({
                status: false,
                message: "This service is not allowed."
            })
            res.status(400).send(error)
        }

    } catch (err) {
        console.log(err)
        const error = await encryption({
            status: false,
            message: err?.message || "Internal server error"
        });
        res.status(500).send(error);

    }
}
