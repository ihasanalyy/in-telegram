const { encryption, decryption } = require('../configurations/Encryption');
const axios = require("axios");
const { encryptDataVCC, decryptDataVCC } = require('../configurations/EncryptionVCC');
const VirtualCardModel = require('../models/Virtual-Card.model');
const Account = require('../models/Account.model');
const FeeModel = require('../models/Fee.model');
const { getExchangeRatesToUSD } = require('../utils/conversion');
const { formatDecimalNumbersWithLimit } = require('../utils/payerRates');
const { getActiveWallet, featureCheck, balanceLimitCheck, limitCheck, cardCountryValidation, logError, getCardDetails, cardToCardTransactionHelper, getActiveWalletById, vccTopupFeeCalculation, walletToCardTransactionHelper, fetchLocalOrDefaultWalletConditionally, updateCardContacts } = require('../utils/helpers');
const iso2Countries = require("../utils/countries_iso2.json");
const paypalUrl = process.env.PAYPAL_URL
const baseURL = process.env.vccdaddyURL
const token = process.env.vccToken;
const moment = require('moment');
const CryptoJS = require('crypto-js');

const supportedCurrencies = require("../utils/paypalSupportedCurrencies.json");
const jwt = require("jsonwebtoken");
const { topUpFeeCalculation, generatePayload } = require('./Trust-Payment.controller');
const TransactionModel = require('../models/Transaction.model');
const PanModel = require('../models/Pan.model');
const WalletModel = require('../models/Wallet.model');
const VCCTransactionModel = require('../models/VCC-Transaction.model');
const { formattedAmount } = require('../utils/InstaChatbotHelpers');

const countries = require("../utils/countries/CitiesData.json")

// console.log(decryptDataVCC("jQ1KwU7SHYKnaTPBxNzCZCTKcJVsP6ZKYv2/99kgjA6wpuPs/iGgszts/MDo3lFJflWANyrCfQyGT+xReDOoSmJ7ECQXOzPCk6/xfECN1D0br5u3vjoE1MR9CLcXEIGgpTFHWCT68ZYoszoGv2KzvAdGNiuEyzFBuQyB3qhf/Sd0/XDE+mnszdb1swJvMxymkvod4JSvgAjm9TCPCPBRYroQ/1pIP2dNcpWXvlspuuX7g5owea8tjg98DjgqmtjS5iRZgAoNlWhW2mf+eO+SuJp7p7yl/LAHeZJibhz7lJEY6zi/OVvbeknm/DBt40Q7"))
const cipher = "jQ1KwU7SHYKnaTPBxNzCZCTKcJVsP6ZKYv2/99kgjA6wpuPs/iGgszts/MDo3lFJflWANyrCfQyGT+xReDOoSmJ7ECQXOzPCk6/xfECN1D0br5u3vjoE1MR9CLcXEIGgpTFHWCT68ZYoszoGv2KzvAdGNiuEyzFBuQyB3qhf/Sd0/XDE+mnszdb1swJvMxymkvod4JSvgAjm9TCPCPBRYroQ/1pIP2dNcpWXvlspuuX7g5owea8tjg98DjgqmtjS5iRZgAoNlWhW2mf+eO+SuJp7p7yl/LAHeZJibhz7lJEY6zi/OVvbeknm/DBt40Q7";

function validateExpiryDate(expdate) {
    const expiryDate = moment(expdate, 'YYYY-MM-DD');
    const currentDate = moment();

    if (!expiryDate.isValid()) {
        return { isValid: false, message: "Invalid expiry date format. Use YYYY-MM-DD." };
    }

    const minValidDate = currentDate.clone().add(30, 'days');
    const maxValidDate = currentDate.clone().add(2, 'years');

    // Validate date within range
    if (!expiryDate.isBetween(minValidDate, maxValidDate, null, '[]')) {
        return {
            isValid: false,
            message: "Expiry date must be more than 30 days and less than 2 years from today."
        };
    }

    return { isValid: true, message: "Expiry date is valid." };
}

const cardStatus = {
    "0": "deactivated",
    "1": "active",
    "2": "frozen",
    "3": "expired",
    "4": "locked",
    "9": "inactivated"
}

module.exports.createVirtualCardKYC = async (req, res) => {
    try {
        const { currency, expdate, account_id, wallet_id, cardType, apple_pay, google_pay } = req.body;

        if (!currency || !expdate || !account_id || !wallet_id || !cardType) {
            const ciphertext = await encryption({ status: false, message: "Missing required fields." });
            return res.status(400).send(ciphertext);
        }

        if (cardType.includes("vcc_premium_plus") && (apple_pay === undefined || google_pay === undefined)) {
            const ciphertext = await encryption({ status: false, message: "Apple Pay and Google Pay are required for premium_plus cards." });
            return res.status(400).send(ciphertext);
        }

        // Validate expiry date
        const { isValid, message } = validateExpiryDate(expdate);
        if (!isValid) {
            const ciphertext = await encryption({ status: false, message });
            return res.status(400).send(ciphertext);
        }

        const cards = await VirtualCardModel.find({ account: account_id })

        if (cards.length >= 3) {
            const ciphertext = await encryption({
                status: false,
                message: "You can only create a maximum of 3 virtual cards.",
            })

            return res.status(400).send(ciphertext)
        }

        const account = await Account.findOne({ _id: account_id, active: true, status: "active" }).populate("level")
        const walletDetails = await getActiveWallet(wallet_id);

        if (!walletDetails) {
            const ciphertext = await encryption({
                status: false,
                message: "Wallet not found.",
            })

            return res.status(404).send(ciphertext)
        }
        if (!account) {
            const ciphertext = await encryption({
                status: false,
                message: "Account not found.",
            })

            return res.status(404).send(ciphertext)
        }

        const vvcFee = await FeeModel.findOne({ service_name: cardType, account_level: account.level._id })
        if (!vvcFee) {
            const ciphertext = await encryption({
                status: false,
                message: "Fee not found.",
            })

            return res.status(404).send(ciphertext)
        }

        const convertedFee = await getExchangeRatesToUSD("USD", walletDetails.currency.code, vvcFee.flat_fee)
        console.log({ convertedFee }, vvcFee.flat_fee)

        if (convertedFee > walletDetails.balance.available) {
            const ciphertext = await encryption({
                status: false,
                message: "Insufficient balance.",
            })

            return res.status(400).send(ciphertext)
        }

        const requestData = {
            amt: '0.01',
            currency,
            expdate,
        };
        if (cardType.includes("vcc_premium_plus")) {
            requestData.productCode = "E0W00008";
        }

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${baseURL}/openapi/card/hk/multi_issue`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        })

        if (response.data.code === 1) {
            const decryptedResponse = decryptDataVCC(response.data.data);

            const subscriptionType = cardType.includes("vcc_premium_plus") ? "premium_plus" :
                cardType.includes("vcc_standard") ? "standard" : "premium";

            // const decryptedResponse = {
            //     userId: '100428',
            //     cardNo: '5257970056045340',
            //     cvv: '763',
            //     expDate: '12/26',
            //     cardBal: '123.45',
            //     curId: 'USD',
            //     cardId: 'fb036cf320250205231550',
            //     tradeNo: '1887158197930934273',
            //     sub_id: null,
            //     request_id: ''
            // }

            const virtualCard = await VirtualCardModel.create({
                account: account_id,
                card_id: decryptedResponse.cardId,
                type: subscriptionType,
                last4: `************${decryptedResponse.cardNo.slice(-4)}`,
                expiry: decryptedResponse.expDate,
                subscription_type: "virtual",
                currency: decryptedResponse.curId,
                premium_features: subscriptionType === "premium_plus" ? { apple_pay, google_pay } : undefined
            })

            // deducting the balance from wallet
            walletDetails.balance.available = formatDecimalNumbersWithLimit(walletDetails.balance.available - convertedFee)
            await walletDetails.save()

            // updating the card phone and email if the card type is apple pay
            if (cardType.includes("vcc_premium_plus")) {
                try {
                    const updateErrors = await updateCardContacts(
                        decryptedResponse.cardId,
                        account
                    );

                    console.log({ updateErrors })
                } catch (err) {
                    console.log(err)
                }
            }

            const ciphertext = await encryption({
                status: "true",
                message: "Virtual Card created successfully.",
                data: virtualCard
            })

            return res.status(201).send(ciphertext)
        } else {
            console.log(response.data)

            const ciphertext = await encryption({
                status: false,
                message: "Failed to create virtual card.",
                data: response.data
            })

            return res.status(500).send(ciphertext)
        }
    } catch (error) {
        console.log(error)
        const err = await encryption({
            status: false,
            message: "Failed to create virtual card.",
        })

        return res.status(500).send(err)
    }
}

module.exports.fetchAccountCards = async (req, res) => {
    try {
        const account_id = req.user._id

        const cards = await VirtualCardModel.find({ account: account_id })

        if (!cards) {
            const ciphertext = await encryption({
                status: false,
                message: "Cards not found.",
            })

            return res.status(404).send(ciphertext)
        }

        const ciphertext = await encryption({
            status: true,
            message: "Cards fetched successfully.",
            data: cards
        })

        return res.status(200).send(ciphertext)
    }
    catch (error) {
        console.log(error)
        const err = await encryption({
            status: false,
            message: "Failed to fetch cards.",
        })

        return res.status(500).send(err)
    }
}

module.exports.fetchSensitiveInformation = async (req, res) => {

}

module.exports.getFeeDetails = async (req, res) => {
    try {
        const { wallet_id, cardType, feeType } = req.params;

        if (!wallet_id || !feeType || !cardType) {
            const ciphertext = await encryption({
                status: false,
                message: "Required fields are missing",
            });
            return res.status(400).send(ciphertext);
        }

        const wallet = await getActiveWallet(wallet_id);

        if (!wallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        const account = await Account.findOne({
            _id: wallet.account._id,
            active: true,
            status: "active"
        }).populate("level");

        if (!account) {
            const ciphertext = await encryption({
                status: false,
                message: "Account not found.",
            });
            return res.status(404).send(ciphertext);
        }

        let feeDetails, vvcFee, convertedVVCFeeIntoSendingCurrency;

        switch (feeType) {
            case "wallet":
                vvcFee = await FeeModel.findOne({ service_name: cardType, account_level: account.level._id });

                if (!vvcFee) {
                    const error = await encryption({
                        status: false,
                        message: "VVC Wallets Fee not found."
                    });
                    return res.status(404).send(error);
                }

                const convertedVvcFee = await getExchangeRatesToUSD("USD", wallet.currency.code, vvcFee.flat_fee);

                const vvcResponse = await encryption({
                    status: true,
                    message: "VVC Wallets fee fetched successfully.",
                    data: {
                        currency: wallet.currency.code,
                        fee: formatDecimalNumbersWithLimit(convertedVvcFee)
                    }
                });

                return res.status(200).send(vvcResponse);

            case "paypal":
                vvcFee = await FeeModel.findOne({ service_name: cardType, account_level: wallet.account.level._id });

                convertedVVCFeeIntoSendingCurrency = vvcFee.flat_fee;

                if (wallet.currency.code !== "USD") {
                    convertedVVCFeeIntoSendingCurrency = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD("USD", wallet.currency.code, vvcFee.flat_fee));
                }

                feeDetails = await topUpFeeCalculation(wallet, convertedVVCFeeIntoSendingCurrency, 'topup_paypal');

                console.log(feeDetails, convertedVVCFeeIntoSendingCurrency)

                if (!feeDetails || !vvcFee) {
                    const error = await encryption({
                        status: false,
                        message: "Fee details not found."
                    });
                    return res.status(404).send(error);
                }

                let amountInUSD = formatDecimalNumbersWithLimit(convertedVVCFeeIntoSendingCurrency + feeDetails);
                let rate = 1;

                if (!supportedCurrencies.includes(wallet.currency.code)) {
                    amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, "USD", amountInUSD));
                    rate = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(wallet.currency.code, "USD", 1), 6);
                }

                console.log({ amountInUSD })

                const payload = {
                    wallet_id,
                    original_currency: wallet.currency.code,
                    converted_currency: "USD",
                    rate,
                    currency_supported: supportedCurrencies.includes(wallet.currency.code),
                    converted_fee: amountInUSD,
                    actual_fee: formatDecimalNumbersWithLimit(convertedVVCFeeIntoSendingCurrency + feeDetails),
                    topup_paypal_fee: feeDetails,
                    card_creation_fee: convertedVVCFeeIntoSendingCurrency,
                };

                const token = jwt.sign(payload, process.env.jwtKey, { expiresIn: '1h' });

                const paypalResponse = await encryption({
                    status: true,
                    message: "VVC PayPal fee fetched successfully!",
                    data: { ...payload, token }
                });

                return res.status(200).send(paypalResponse);

            case "card":
                vvcFee = await FeeModel.findOne({ service_name: cardType, account_level: wallet.account.level._id });

                if (!vvcFee) {
                    const error = await encryption({
                        status: false,
                        message: "Fee configuration not found."
                    });
                    return res.status(404).send(error);
                }

                convertedVVCFeeIntoSendingCurrency = vvcFee.flat_fee;

                if (wallet.currency.code !== "USD") {
                    convertedVVCFeeIntoSendingCurrency = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD("USD", wallet.currency.code, vvcFee.flat_fee));
                }

                feeDetails = await topUpFeeCalculation(wallet, convertedVVCFeeIntoSendingCurrency, 'topup_card_payment');

                if (!feeDetails || !vvcFee) {
                    const error = await encryption({
                        status: false,
                        message: "Fee details not found."
                    });
                    return res.status(404).send(error);
                }

                const cardPayload = {
                    wallet_id,
                    totalFee: formatDecimalNumbersWithLimit(convertedVVCFeeIntoSendingCurrency + feeDetails),
                    cardCreationFee: formatDecimalNumbersWithLimit(convertedVVCFeeIntoSendingCurrency),
                    topupCardFee: formatDecimalNumbersWithLimit(feeDetails),
                }

                const cardToken = jwt.sign(cardPayload, process.env.jwtKey, { expiresIn: '1h' });

                const cardResponse = await encryption({
                    status: true,
                    message: "VVC Card fee fetched successfully!",
                    data: { ...cardPayload, token: cardToken }
                });

                return res.status(200).send(cardResponse);

            default:
                const error = await encryption({
                    status: false,
                    message: "Invalid fee type."
                });
                return res.status(400).send(error);
        }

    } catch (error) {
        console.error(error);
        const err = await encryption({
            status: false,
            message: "Failed to fetch fee!"
        });
        return res.status(500).send(err);
    }
};


// PAYPAL
module.exports.initiatPaypalTransaction = async (req, res) => {
    try {
        const data = req.body
        // const data = await decryption(req.body.data)
        const { token, expdate, cardType, currency, apple_pay, google_pay } = data;

        if (!token || !expdate || !cardType || !currency) {
            const error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        if (cardType.includes("vcc_premium_plus") && (apple_pay === undefined || google_pay === undefined)) {
            const ciphertext = await encryption({ status: false, message: "Apple Pay and Google Pay are required for premium_plus cards." });
            return res.status(400).send(ciphertext);
        }

        let decodedToken;
        try {
            decodedToken = jwt.verify(token, process.env.jwtKey);
        } catch (err) {
            const errorMessage = await encryption({
                status: false,
                message: "Invalid or expired token!"
            });
            return res.status(400).send(errorMessage);
        }

        // Validate expiry date
        const { isValid, message } = validateExpiryDate(expdate);
        if (!isValid) {
            const ciphertext = await encryption({ status: false, message });
            return res.status(400).send(ciphertext);
        }

        const {
            wallet_id,
            original_currency,
            currency_supported,
            converted_fee,
            actual_fee,
            topup_paypal_fee,
            card_creation_fee
        } = decodedToken;

        const receiverWallet = await getActiveWallet(wallet_id);
        if (!receiverWallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found!"
            });
            return res.status(404).send(error);
        }

        // Recalculate fees to check for changes
        const vvcFee = await FeeModel.findOne({
            service_name: cardType,
            account_level: receiverWallet.account.level._id
        });
        if (!vvcFee) {
            const error = await encryption({
                status: false,
                message: "Fee configuration not found."
            });
            return res.status(404).send(error);
        }

        // Recalculate card_creation_fee (convert from USD to wallet currency if needed)
        let currentCardCreationFee = vvcFee.flat_fee;
        if (receiverWallet.currency.code !== "USD") {
            currentCardCreationFee = await getExchangeRatesToUSD(
                "USD",
                receiverWallet.currency.code,
                vvcFee.flat_fee
            );
        }
        currentCardCreationFee = formatDecimalNumbersWithLimit(currentCardCreationFee);

        // Recalculate topup_paypal_fee
        const currentTopupFee = await topUpFeeCalculation(
            receiverWallet,
            currentCardCreationFee,
            'topup_paypal'
        );
        const currentActualFee = formatDecimalNumbersWithLimit(
            currentCardCreationFee + currentTopupFee
        );

        // Recalculate converted_fee (USD equivalent)
        let currentConvertedFee;
        if (!supportedCurrencies.includes(receiverWallet.currency.code)) {
            currentConvertedFee = await getExchangeRatesToUSD(
                receiverWallet.currency.code,
                "USD",
                currentActualFee
            );
        } else {
            currentConvertedFee = currentActualFee;
        }
        currentConvertedFee = formatDecimalNumbersWithLimit(currentConvertedFee);

        console.log({ currentActualFee }, { actual_fee },
            { currentConvertedFee }, { converted_fee },
            { currentCardCreationFee }, { card_creation_fee },
            { currentTopupFee }, { topup_paypal_fee })
        // Validate against token values
        if (
            currentActualFee !== actual_fee ||
            currentConvertedFee !== converted_fee ||
            currentCardCreationFee !== card_creation_fee ||
            currentTopupFee !== topup_paypal_fee
        ) {
            const error = await encryption({
                status: false,
                message: "Fees or exchange rates have changed. Please refresh and try again."
            });
            return res.status(400).send(error);
        }

        // Rest of the logic (card limit checks, PayPal API calls, etc.)
        const cards = await VirtualCardModel.find({ account: receiverWallet.account._id });
        if (cards.length >= 3) {
            const ciphertext = await encryption({
                status: false,
                message: "You can only create a maximum of 3 virtual cards."
            });
            return res.status(400).send(ciphertext);
        }


        const featureChecked = await featureCheck('topup_channel', 'paypal', receiverWallet.account.level);
        if (!featureChecked) {
            const error = await encryption({
                status: false,
                message: "This service is not allowed."
            });
            return res.status(400).send(error);
        }

        let amountInUSD;
        if (receiverWallet.currency.code !== 'USD') {
            amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', currentActualFee);
        } else {
            amountInUSD = currentActualFee;
        }

        const balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account);
        const limitChecked = limitCheck(parseFloat(amountInUSD), receiverWallet.account.level, receiverWallet.account, 'topup');

        if (!limitChecked.status || !balanceLimitChecked) {
            const error = await encryption({
                status: false,
                message: !limitChecked.status ? limitChecked.code : "Balance limit exceeded"
            });
            return res.status(400).send(error);
        }

        const ref = 'tr_' + Date.now().toString();

        const api = `${paypalUrl}/oauth2/token`;
        const obj = {
            url: api,
            method: 'post',
            data: 'grant_type=client_credentials',
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            }
        };

        const authResponse = await axios(obj);
        const paymentApi = `${paypalUrl}/payments/payment`;
        const cnfg = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authResponse.data.access_token,
            },
        };

        const paymentObj = {
            intent: "sale",
            payer: {
                payment_method: "paypal"
            },
            transactions: [
                {
                    amount: {
                        total: formatDecimalNumbersWithLimit(converted_fee, 2).toFixed(2),
                        currency: currency_supported ? original_currency : "USD"
                    },
                    description: receiverWallet.account.username,
                    custom: receiverWallet.wallet_id,
                    item_list: {
                        shipping_address: {
                            recipient_name: `${receiverWallet.account.first_name} ${receiverWallet.account.last_name}`,
                            line1: `${receiverWallet.account.address || receiverWallet.account.country_iso_code}`,
                            city: `${receiverWallet.account.city || ""}`,
                            country_code: `${iso2Countries[receiverWallet.account.country_iso_code] || "CH"}`,
                            postal_code: `${receiverWallet.account.postal_code || ""}`,
                            phone: `${receiverWallet.account.phone || ""}`,
                        }
                    }
                }
            ],
            redirect_urls: {
                return_url: `https://my.insta-pay.ch/vcc-paypal/success?transaction_id=${ref}`,
                cancel_url: `https://my.insta-pay.ch/vcc-paypal/error?transaction_id=${ref}`
            }
        };

        const paymentResponse = await axios.post(paymentApi, paymentObj, cnfg);

        if (paymentResponse.data.state === 'created') {
            const receiverTimezone = receiverWallet.account.timezone || "UTC";
            const receiverCurrentTime = moment().tz(receiverTimezone).format();

            const token1 = jwt.sign({ currency, expdate, cardType, apple_pay, google_pay }, process.env.jwtKey, { expiresIn: "10m" });

            const receiverTransactionObj = {
                reference_id: ref,
                type: 'instant',
                transaction_type: 'credit',
                service_type: 'mastercard',
                payment_type: 'paypal',
                status: 'INITIATED',
                purpose: '',
                payment_id: paymentResponse.data.id,
                description: 'Virtual card creation',
                currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                amount: converted_fee,
                fee: topup_paypal_fee,
                total: actual_fee,
                wallet_id: receiverWallet.wallet_id,
                wallet: receiverWallet._id,
                account: receiverWallet.account._id,
                receiver: receiverWallet.account._id,
                current_balance: receiverWallet.balance.available,
                hidden: true,
                external_token: {
                    token: token1,
                    type: `vcc_creation_${cardType.includes("vcc_premium_plus") ? "premium_plus" :
                        cardType.includes("vcc_standard") ? "standard" : "premium"}`
                },
                timeline: [
                    {
                        status: 'INITIATED',
                        date: receiverCurrentTime,
                    }
                ]
            };

            const transaction = await TransactionModel.create(receiverTransactionObj);
            const link = paymentResponse.data.links.find(l => l.rel === 'approval_url');

            const ciphertext = await encryption({
                status: true,
                message: "Transaction initiated successfully.",
                currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                transaction_id: transaction._id,
                transaction_ref: transaction.reference_id,
                url: link ? link.href : ''
            });

            return res.status(200).send(ciphertext);
        } else {
            const ciphertext = await encryption({
                status: false,
                message: "Transaction failed."
            });
            return res.status(400).send(ciphertext);
        }
    } catch (err) {
        console.error(err);
        const error = await encryption({
            status: false,
            message: "Internal server error!"
        });
        return res.status(500).send(error);
    }
};

// CREDIT CARD
module.exports.initiateTrustPaymentTransaction = async (req, res) => {
    try {
        let data = req.body
        const panData = req.panData
        // let data = await decryption(req.body.data)
        const { token, expdate, cardType, currency, pan, apple_pay, google_pay } = panData;

        if (!token || !expdate || !cardType || !currency) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing"
            });
            return res.status(400).send(error);
        }

        if (cardType.includes("vcc_premium_plus") && (apple_pay === undefined || google_pay === undefined)) {
            const ciphertext = await encryption({ status: false, message: "Apple Pay and Google Pay are required for premium_plus cards." });
            return res.status(400).send(ciphertext);
        }

        // Validate expiry date
        const { isValid, message } = validateExpiryDate(expdate);
        if (!isValid) {
            return res.status(400).send(await encryption({
                status: false,
                message
            }));
        }

        let decoded;
        try {
            decoded = jwt.verify(token, process.env.jwtKey);
        } catch (err) {
            console.log(err)
            return res.status(400).send(await encryption({ status: false, message: "Invalid token or token expired!" }));
        }

        console.log({ decoded })

        const { wallet_id, totalFee, cardCreationFee, topupCardFee } = decoded

        let ref = 'tr_' + Date.now().toString();

        const receiverWallet = await getActiveWallet(wallet_id)

        if (!receiverWallet) {
            const error = await encryption({
                status: false,
                message: "Wallet not found."
            });
            return res.status(400).send(error);
        }

        let panDetails = await PanModel.findOne({ $and: [{ _id: pan }, { account: receiverWallet.account._id }] })
        if (!panDetails) {
            let error = await encryption({
                status: false,
                message: "Invalid Card Details."
            });
            return res.status(404).send(error);
        }
        let bytes = CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        const vvcFee = await FeeModel.findOne({
            service_name: cardType,
            account_level: receiverWallet.account.level._id
        });
        if (!vvcFee) {
            const error = await encryption({
                status: false,
                message: "Fee configuration not found."
            });
            return res.status(404).send(error);
        }

        let currentCardCreationFee = vvcFee.flat_fee;
        if (receiverWallet.currency.code !== "USD") {
            currentCardCreationFee = await getExchangeRatesToUSD(
                "USD",
                receiverWallet.currency.code,
                vvcFee.flat_fee
            );
        }
        currentCardCreationFee = formatDecimalNumbersWithLimit(currentCardCreationFee);
        let currentTopupFee = await topUpFeeCalculation(receiverWallet, currentCardCreationFee, 'topup_card_payment')

        // Recalculate actual fee
        const currentActualFee = formatDecimalNumbersWithLimit(
            currentCardCreationFee + currentTopupFee
        );

        console.log({
            currentActualFee, totalFee,
            currentCardCreationFee, cardCreationFee,
            currentTopupFee, topupCardFee
        })
        // Validate against token values
        if (
            currentActualFee !== totalFee ||
            currentCardCreationFee !== cardCreationFee ||
            currentTopupFee !== topupCardFee
        ) {
            return res.status(400).send(await encryption({
                status: false,
                message: "Fees/rates changed. Please refresh and try again."
            }));
        }

        // Validate card limits
        const cards = await VirtualCardModel.find({
            account: receiverWallet.account._id
        });
        if (cards.length >= 3) {
            return res.status(400).send(await encryption({
                status: false,
                message: "You can only create a maximum of 3 virtual cards."
            }));
        }

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level)
        if (featureChecked && currentTopupFee >= 0) {
            let amountInUSD = await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', currentCardCreationFee)
            let amountInUSDTotal = formatDecimalNumbersWithLimit(
                await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', currentCardCreationFee + currentTopupFee)
            );
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            if (limitChecked.status && balanceLimitChecked) {

                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'mastercard',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Virtual card creation',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: currentCardCreationFee,
                    is_card_save: false,
                    fee: currentTopupFee,
                    total: currentCardCreationFee + currentTopupFee,
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

                TransactionModel.create(receiverTransactionObj).then(async (transaction) => {
                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(currentActualFee, receiverWallet, panDataObj, transaction, iat, true, false, false);
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const trustPaymentToken = jwt.sign(payload, secretKey, { header: { "alg": "HS256", "typ": "JWT" } });
                    const vccToken = jwt.sign({ expdate, currency, cardType, apple_pay, google_pay }, process.env.jwtKey, { expiresIn: "1h" });
                    let ciphertext = await encryption({
                        status: "true",
                        message: "Transaction initiated successfully.",
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        token: vccToken,
                        trustPaymentToken
                    })
                    return res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    return res.status(400).send(ciphertext);
                })
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
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.trustPaymentVCCSavedCard = async (req, res) => {
    try {
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        console.log(req.params, "req.params")
        let transactionDetails = await TransactionModel.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails);
        if (!transactionDetails) {
            await logError(
                "Transaction not found - vcc",
                "topup_trust_payment_vcc",
                null,
                transaction_id,
                { routeParams: req.params }
            );
            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`)
        }
        // var { token, wallet_id } = data
        let receiverWallet = await WalletModel.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive - vcc",
                "topup_trust_payment_vcc",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`)
        }

        console.log({ bodyFromTrust: req.body })

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        console.log(req.body.errorcode, "req.body.errorcode")
        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode - vcc",
                "topup_trust_payment_vcc",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error - vcc",
                    "topup_trust_payment_vcc",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                console.log("jwterror", err)
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/null`);
            }
            console.log(data.payload);
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey)

                        let amount = parseInt(innerToken.payload.mainamount)

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            WalletModel.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const processedVCCRequest = await processVCCRequest(transactionDetails, receiverWallet, transaction_token)

                                        if (processedVCCRequest.success) {
                                            return res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        } else {
                                            return res.redirect("https://my.insta-pay.ch/add-funds/card/error/null")
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error - vcc",
                                            "topup_trust_payment_vcc",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed - vcc",
                                        "topup_trust_payment_vcc",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message} - vcc`,
                                    "topup_trust_payment_vcc",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error - vcc`,
                                "topup_trust_payment_vcc",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0" - vcc`,
                            "topup_trust_payment_vcc",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH' - vcc`,
                        "topup_trust_payment_vcc",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseInt(innerToken.payload.mainamount)

                        if (amount == transactionDetails.total) {
                            console.log("i have ran")
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            WalletModel.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'COMPLETED'
                                    transactionDetails['hidden'] = false
                                    await transactionDetails.save();
                                    let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        console.log("i have ran too")

                                        const processedVCCRequest = await processVCCRequest(transactionDetails, receiverWallet, transaction_token)

                                        if (processedVCCRequest.success) {
                                            return res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        } else {
                                            return res.redirect("https://my.insta-pay.ch/add-funds/card/error/null")
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2 - vcc",
                                            "topup_trust_payment_vcc",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'FAILED',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'FAILED'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2 - vcc",
                                        "topup_trust_payment_vcc",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'FAILED',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'FAILED'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message} - vcc`,
                                    "topup_trust_payment_vcc",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'FAILED',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'FAILED'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2 - vcc`,
                                "topup_trust_payment_vcc",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2 - vcc`,
                            "topup_trust_payment_vcc",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2 - vcc`,
                        "topup_trust_payment_vcc",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2 - vcc`,
                    "topup_trust_payment_vcc",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );
                let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'FAILED'
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/null`)
            }
        })
    } catch (err) {
        console.log(err)
        await logError(
            `${err} - vcc`,
            "topup_trust_payment_vcc",
            null,
            req.params?.transaction_id || null,
        );
        res.redirect(`https://my.insta-pay.ch/add-funds/card/aborted/null`)
    }
}

module.exports.initiateTrustPaymentTransactionWOSavedCard = async (req, res) => {
    try {
        // let data = await decryption(req.body.data);
        let data = req.body
        let { expdate, cardType, apple_pay, google_pay, currency, is_card_save, se_shambey, token } = data;
        let ref = 'tr_' + Date.now().toString();

        console.log(!expdate, !cardType, !currency, !se_shambey, !token)
        if (!expdate || !cardType || !currency || !se_shambey || !token) {
            let error = await encryption({
                status: false,
                message: "Required fields are missing."
            });
            return res.status(404).send(error);
        }

        if (cardType.includes("vcc_premium_plus") && (apple_pay === undefined || google_pay === undefined)) {
            const ciphertext = await encryption({ status: false, message: "Apple Pay and Google Pay are required for premium_plus cards." });
            return res.status(400).send(ciphertext);
        }

        let decoded;
        try {
            decoded = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            console.log(err)
            const error = await encryption({
                status: false,
                message: "Invalid token."
            })
            return res.status(400).send(error);
        }

        let decodedRevesredString = decoded.gurhaku;
        let originalPan = decodedRevesredString.split(":").reverse().join(":");

        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        console.log({ pan, securitycode, expiry_month, expiry_year })

        let decodedFeeToken;
        try {
            decodedFeeToken = jwt.verify(token, process.env.jwtKey);
        } catch (err) {
            console.log(err)
            return res.status(400).send(await encryption({ status: false, message: "Invalid token or token expired!" }));
        }

        const { wallet_id, totalFee, cardCreationFee, topupCardFee } = decodedFeeToken

        let receiverWallet = await getActiveWallet(wallet_id);

        if (receiverWallet.account._id.toString() != req.user._id.toString()) {
            let error = await encryption({
                status: false,
                message: "Unauthorized."
            });
            return res.status(404).send(error);
        }

        // checking card authentication
        const cardDetails = await cardCountryValidation(pan, receiverWallet.account.country_iso_code)

        if (!cardDetails.valid) {
            const error = await encryption({
                status: false,
                message: "Invalid card."
            })
            return res.status(400).send(error);
        }

        const vvcFee = await FeeModel.findOne({
            service_name: cardType,
            account_level: receiverWallet.account.level._id
        });
        if (!vvcFee) {
            const error = await encryption({
                status: false,
                message: "Fee configuration not found."
            });
            return res.status(404).send(error);
        }

        let currentCardCreationFee = vvcFee.flat_fee;
        if (receiverWallet.currency.code !== "USD") {
            currentCardCreationFee = await getExchangeRatesToUSD(
                "USD",
                receiverWallet.currency.code,
                vvcFee.flat_fee
            );
        }
        currentCardCreationFee = formatDecimalNumbersWithLimit(currentCardCreationFee);

        let currentTopupFee = await topUpFeeCalculation(receiverWallet, currentCardCreationFee, 'topup_card_payment');

        // Recalculate actual fee
        const currentActualFee = formatDecimalNumbersWithLimit(
            currentCardCreationFee + currentTopupFee
        );

        console.log({
            currentActualFee, totalFee,
            currentCardCreationFee, cardCreationFee,
            currentTopupFee, topupCardFee
        })
        // Validate against token values
        if (
            currentActualFee !== totalFee ||
            currentCardCreationFee !== cardCreationFee ||
            currentTopupFee !== topupCardFee
        ) {
            return res.status(400).send(await encryption({
                status: false,
                message: "Fees/rates changed. Please refresh and try again."
            }));
        }

        // Validate card limits
        const cards = await VirtualCardModel.find({
            account: receiverWallet.account._id
        });
        if (cards.length >= 3) {
            return res.status(400).send(await encryption({
                status: false,
                message: "You can only create a maximum of 3 virtual cards."
            }));
        }

        let featureChecked = await featureCheck('topup_channel', 'card_payment', receiverWallet.account.level);
        if (featureChecked && currentTopupFee >= 0) {
            let amountInUSD = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', currentCardCreationFee))
            let amountInUSDTotal = formatDecimalNumbersWithLimit(await getExchangeRatesToUSD(receiverWallet.currency.code, 'USD', currentCardCreationFee + currentTopupFee))
            let balanceLimitChecked = await balanceLimitCheck(parseFloat(amountInUSD), receiverWallet.account)
            let limitChecked = limitCheck(parseFloat(amountInUSDTotal), receiverWallet.account.level, receiverWallet.account, 'topup')
            if (limitChecked.status && balanceLimitChecked) {
                const receiverTimezone = receiverWallet.account?.timezone || "UTC"
                const receiverCurrentTime = moment().tz(receiverTimezone).format();

                let receiverTransactionObj = {
                    reference_id: ref,
                    type: 'instant',
                    transaction_type: 'credit',
                    service_type: 'topup',
                    payment_type: 'card',
                    status: 'INITIATED',
                    purpose: '',
                    description: 'Topup by Card',
                    currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                    amount: currentCardCreationFee,
                    is_card_save: is_card_save ? true : false,
                    fee: currentTopupFee,
                    total: currentCardCreationFee + currentTopupFee,
                    wallet_id: receiverWallet.wallet_id,
                    wallet: receiverWallet._id,
                    account: receiverWallet.account._id,
                    receiver: receiverWallet.account._id,
                    current_balance: receiverWallet.balance.available,
                    timeline: [
                        {
                            status: 'INITIATED',
                            date: receiverCurrentTime,
                        }
                    ]
                }

                TransactionModel.create(receiverTransactionObj).then(async (transaction) => {

                    let iat = Math.floor(Date.now() / 1000);
                    const payload = generatePayload(currentActualFee, receiverWallet, { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` }, transaction, iat, false, false, false);
                    const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
                    const trustPaymentToken = jwt.sign(payload, secretKey, { header: { "alg": "HS256", "typ": "JWT" } });
                    const vccToken = jwt.sign({ expdate, currency, cardType, apple_pay, google_pay }, process.env.jwtKey, { expiresIn: "1h" });

                    let response = {
                        status: "true",
                        message: "Transaction initiated successfully.",
                        currency: { code: receiverWallet.currency.code, symbol: receiverWallet.currency.symbol },
                        transaction_id: transaction._id,
                        transaction_ref: transaction.reference_id,
                        token: vccToken,
                        trustPaymentToken
                    }

                    let ciphertext = await encryption(response);
                    res.status(200).send(ciphertext);
                }).catch(async (err) => {
                    console.log(err);
                    let ciphertext = await encryption({
                        status: "false",
                        message: "Transaction failed.",
                        error: err
                    })
                    res.status(400).send(ciphertext);
                })
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
        console.log(err);
        let error = await encryption({
            status: false,
            message: "Internal server error!"
        })
        res.status(500).send(error)
    }
}

module.exports.trustPaymentVCCWOSavedCard = async (req, res) => {
    try {
        // console.log(req.body);
        let transaction_id = req.params.transaction_id;
        let transaction_token = req.params.token;
        let transactionDetails = await TransactionModel.findOne({ $and: [{ _id: transaction_id }, { payment_type: 'card' }, { status: 'INITIATED' }] });
        // console.log(transactionDetails, "transactionDetails");
        if (!transactionDetails) {
            await logError(
                "Transaction not found",
                "topup_trust_payment_vcc_w/o_savedcard",
                null,
                transaction_id,
                { routeParams: req.params }
            )
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }
        // var { token, wallet_id } = data
        let receiverWallet = await Wallet.findOne({ $and: [{ _id: transactionDetails.wallet }, { wallet_type: "insta" }, { status: 'active' }] }).populate([{ path: 'account', populate: (['level', 'user', 'company']) }])
        // console.log(receiverWallet, "receiverWallet");
        if (!receiverWallet) {
            await logError(
                "Receiver wallet not found or inactive",
                "topup_trust_payment_vcc_w/o_savedcard",
                receiverWallet?.account?._id,
                transaction_id,
            );
            return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null')
        }

        const receiverTimezone = receiverWallet.account?.timezone || "UTC"
        const receiverCurrentTime = moment().tz(receiverTimezone).format();

        if (req.body.errorcode !== "0") {
            await logError(
                "Transaction failed with errorcode",
                "topup_trust_payment_vcc_w/o_savedcard",
                receiverWallet?.account?._id,
                transaction_id,
                { errorCode: req.body.errorcode }
            );
            transactionDetails.timeline.push({
                status: 'FAILED',
                date: receiverCurrentTime,
            })
            transactionDetails['status'] = 'FAILED'
            await transactionDetails.save();

            return res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${req.body.errorcode}`);
        }

        const secretKey = `${process.env.TRUST_PAYMENT_SECRET}`;
        let token = req.body.jwt
        jwt.verify(token, secretKey, async function (err, data) {
            if (err) {
                await logError(
                    "JWT verification error",
                    "topup_trust_payment_vcc_w/o_savedcard",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { jwtError: err }
                );
                console.log(err, "err in jwt");
                transactionDetails.timeline.push({
                    status: 'PENDING',
                    date: receiverCurrentTime,
                })
                transactionDetails['status'] = 'PENDING'
                await transactionDetails.save();
                return res.redirect('https://my.insta-pay.ch/add-funds/card/error/null');
            }
            console.log(data.payload, "data.payload");
            const errorCode = data.payload.response.length == 2 ? data.payload.response[1]?.errorcode : data.payload.response[0]?.errorcode
            if (data.payload.response.length == 2) {
                if (data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH') {
                    if (data.payload.response[1].errorcode == "0") {
                        let innerToken = jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await PanModel.create(panObj);
                        }

                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const processedVCCRequest = await processVCCRequest(transactionDetails, receiverWallet, transaction_token)

                                        if (processedVCCRequest.success) {
                                            return res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        } else {
                                            return res.redirect("https://my.insta-pay.ch/add-funds/card/error/null")
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error",
                                            "topup_trust_payment_vcc_w/o_savedcard",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed",
                                        "topup_trust_payment_vcc_w/o_savedcard",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance: ${err.message}`,
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error`,
                                "topup_trust_payment_vcc_w/o_savedcard",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[1].errorcode == "0"`,
                            "topup_trust_payment_vcc_w/o_savedcard",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[1].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'THREEDQUERY' && data.payload.response[1].requesttypedescription == 'AUTH'`,
                        "topup_trust_payment_vcc_w/o_savedcard",
                        receiverWallet?.account?._id,
                        transaction_id,
                        value = { value1: data.payload.response[0].requesttypedescription, value2: data.payload.response[1].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else if (data.payload.response.length == 1) {
                if (data.payload.response[0].requesttypedescription == 'AUTH') {
                    if (data.payload.response[0].errorcode == "0") {

                        let innerToken = await jwt.verify(data.payload.jwt, secretKey)
                        let obj = {
                            "securitycode": innerToken.payload.securitycode,
                            "expirydate": innerToken.payload.expirydate,
                            "pan": innerToken.payload.pan,
                            // "last4": innerToken.payload.pan.substr(innerToken.payload.pan.length - 4)
                        }
                        let panDetails = await CryptoJS.AES.encrypt(JSON.stringify(obj), process.env.PAN_ENCRYPTION_KEY).toString();
                        // var bytes = await CryptoJS.AES.decrypt(card, process.env.PAN_ENCRYPTION_KEY);
                        // var pass = bytes.toString(CryptoJS.enc.Utf8);
                        // let ref = 'tr_' + Date.now().toString();
                        let amount = parseFloat(innerToken.payload.mainamount)
                        if (transactionDetails.is_card_save) {
                            let panObj = {
                                panData: panDetails,
                                last4: innerToken.payload.pan.substr(innerToken.payload.pan.length - 4),
                                status: true,
                                account: receiverWallet.account._id
                            }
                            let panCreated = await PanModel.create(panObj);
                        }
                        if (amount == transactionDetails.total) {
                            let receiverBalance = receiverWallet.balance.available + transactionDetails.amount;
                            Wallet.updateOne({ _id: receiverWallet._id }, { $set: { "balance.available": receiverBalance } }).then(async (newReceiverBalance) => {
                                if (newReceiverBalance.acknowledged && newReceiverBalance.modifiedCount == 1) {
                                    transactionDetails.timeline.push({
                                        status: 'COMPLETED',
                                        date: receiverCurrentTime,
                                    })
                                    await transactionDetails.save();
                                    let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'COMPLETED', external_reference: req.body?.transactionreference } })
                                    // console.log(transactionUpdt);
                                    if (transactionUpdt?.modifiedCount == 1) {
                                        const processedVCCRequest = await processVCCRequest(transactionDetails, receiverWallet, transaction_token)

                                        if (processedVCCRequest.success) {
                                            return res.redirect('https://my.insta-pay.ch/add-funds/card/success')
                                        } else {
                                            return res.redirect("https://my.insta-pay.ch/add-funds/card/error/null")
                                        }
                                    } else {
                                        await logError(
                                            "transactionUpdt?.modifiedCount == 1 error 2",
                                            "topup_trust_payment_vcc_w/o_savedcard",
                                            receiverWallet?.account?._id,
                                            transaction_id,
                                            { value: transactionUpdt?.modifiedCount }
                                        );
                                        transactionDetails.timeline.push({
                                            status: 'PENDING',
                                            date: receiverCurrentTime,
                                        })
                                        transactionDetails['status'] = 'PENDING'
                                        await transactionDetails.save();
                                        res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                    }
                                } else {
                                    await logError(
                                        "Receiver balance update failed 2",
                                        "topup_trust_payment_vcc_w/o_savedcard",
                                        receiverWallet?.account?._id,
                                        transaction_id
                                    );
                                    transactionDetails.timeline.push({
                                        status: 'PENDING',
                                        date: receiverCurrentTime,
                                    })
                                    transactionDetails['status'] = 'PENDING'
                                    await transactionDetails.save();
                                    res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                                }
                            }).catch(async (err) => {
                                await logError(
                                    `Error updating receiver balance 2: ${err.message}`,
                                    "topup_trust_payment_vcc_w/o_savedcard",
                                    receiverWallet?.account?._id,
                                    transaction_id
                                );
                                transactionDetails.timeline.push({
                                    status: 'PENDING',
                                    date: receiverCurrentTime,
                                })
                                transactionDetails['status'] = 'PENDING'
                                await transactionDetails.save();
                                res.redirect(`https://my.insta-pay.ch/add-funds/card/error/${errorCode}`)
                            })
                        } else {
                            await logError(
                                `(amount == transactionDetails.total) error 2`,
                                "topup_trust_payment_vcc_w/o_savedcard",
                                receiverWallet?.account?._id,
                                transaction_id,
                                value = { amount, total: transactionDetails.total }
                            );
                            transactionDetails.timeline.push({
                                status: 'FAILED',
                                date: receiverCurrentTime,
                            })
                            transactionDetails['status'] = 'FAILED'
                            await transactionDetails.save();
                            res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                        }
                    } else {
                        await logError(
                            `data.payload.response[0].errorcode == "0" 2`,
                            "topup_trust_payment_vcc_w/o_savedcard",
                            receiverWallet?.account?._id,
                            transaction_id,
                            { value: data.payload.response[0].errorcode }
                        );
                        transactionDetails.timeline.push({
                            status: 'FAILED',
                            date: receiverCurrentTime,
                        })
                        transactionDetails['status'] = 'FAILED'
                        await transactionDetails.save();
                        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                    }
                } else {
                    await logError(
                        `data.payload.response[0].requesttypedescription == 'AUTH' 2`,
                        "topup_trust_payment_vcc_w/o_savedcard",
                        receiverWallet?.account?._id,
                        transaction_id,
                        { value: data.payload.response[0].requesttypedescription }
                    );
                    transactionDetails.timeline.push({
                        status: 'FAILED',
                        date: receiverCurrentTime,
                    })
                    transactionDetails['status'] = 'FAILED'
                    await transactionDetails.save();
                    res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
                }
            } else {
                await logError(
                    `data.payload.response.length === 1 2`,
                    "topup_trust_payment_vcc_w/o_savedcard",
                    receiverWallet?.account?._id,
                    transaction_id,
                    { value: data.payload.response.length }
                );

                let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
                transactionDetails.timeline.push({
                    status: 'FAILED',
                    date: receiverCurrentTime,
                })
                await transactionDetails.save();
                res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/${errorCode}`)
            }
        })
    } catch (err) {
        await logError(
            err,
            "topup_trust_payment_vcc_w/o_savedcard",
            null,
            req.params?.transaction_id || null,
        );
        // let transactionUpdt = await TransactionModel.updateOne({ _id: transactionDetails._id }, { $set: { status: 'FAILED', external_reference: req?.body?.transactionreference } })
        res.redirect(`https://my.insta-pay.ch/add-funds/card/failed/null}`)
    }

}

async function processVCCRequest(transactionDetails, walletDetails, vccToken) {
    const decoded = jwt.verify(vccToken, process.env.jwtKey);

    const cardType = decoded.type?.includes("special_premium") ? "special_premium" : decoded.type?.includes("vcc_standard") ? "standard" : "premium";

    // Ensure Apple Pay & Google Pay fields for special_premium cards
    if (cardType === "special_premium" && (decoded.apple_pay === undefined || decoded.google_pay === undefined)) {
        await revertBalance(walletDetails, transactionDetails);
        return { success: false, message: "Virtual Card creation failed: Missing Apple Pay or Google Pay details for special_premium cards." };
    }

    const requestData = {
        amt: '0.01',
        currency: decoded.currency,
        expdate: decoded.expdate,
    };

    if (cardType.includes("vcc_premium_plus")) {
        requestData.productCode = "E0W00008";
    }

    try {
        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${process.env.vccdaddyURL}/openapi/card/hk/multi_issue`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': process.env.vccToken,
            }
        });

        if (response.data.code === 1) {
            const decryptedResponse = decryptDataVCC(response.data.data);

            await VirtualCardModel.create({
                account: transactionDetails.account._id,
                card_id: decryptedResponse.cardId,
                type: cardType,
                last4: `************${decryptedResponse.cardNo.slice(-4)}`,
                expiry: decryptedResponse.expDate,
                subscription_type: "virtual",
                currency: decryptedResponse.curId,
                premium_features: cardType === "special_premium" ? {
                    apple_pay: decoded.apple_pay,
                    google_pay: decoded.google_pay
                } : undefined
            });

            // updating the card phone and email if the card type is apple pay
            if (cardType === "special_premium") {
                try {
                    const updateErrors = await updateCardContacts(
                        decryptedResponse.cardId,
                        transactionDetails.account
                    );

                    console.log({ updateErrors })
                    if (updateErrors.length > 0) {

                        await logError(
                            "Error while updating the card phone and email",
                            `vcc_creation`,
                            null,
                            transactionDetails._id,
                            { errors: updateErrors }
                        )
                    }
                } catch (err) {
                    console.log(err)
                }

            }

            return { success: true, message: "Virtual Card created successfully" };
        } else {
            await revertBalance(walletDetails, transactionDetails);
            return { success: false, message: "Virtual Card creation failed: Invalid response code" };
        }
    } catch (err) {
        console.error("Error during Virtual Card request:", err);

        await revertBalance(walletDetails, transactionDetails);
        await logError(
            "Virtual Card creation failed",
            `topup_paypal_vcc`,
            null,
            transactionDetails._id,
            { message: err.message }
        );

        return { success: false, message: `Virtual Card creation failed: ${err.message}` };
    }
}

async function revertBalance(walletDetails, transactionDetails) {
    walletDetails.balance.available += transactionDetails.amount;
    await walletDetails.save();
}

// GENERAL VCCDADDY FUNCTIONS
module.exports.activate = async (req, res) => {
    try {
        // const { card_id } = req.body;
        const { card_id } = await decryption(req.body.data)

        if (!card_id) {
            const ciphertext = await encryption({ status: false, message: "Required fields are missing" });
            return res.status(400).send(ciphertext);
        }

        const card = await VirtualCardModel.findById(card_id);

        if (!card) {
            const ciphertext = await encryption({ status: false, message: "Card not found" });
            return res.status(400).send(ciphertext);
        }

        const requestData = {
            cardId: card.card_id
        };

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${baseURL}/openapi/card/activate`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        })

        if (response.data.code === 1) {
            const ciphertext = await encryption({ status: true, message: "Card activated successfully" });
            return res.status(200).send(ciphertext);
        } else {
            const ciphertext = await encryption({ status: false, message: "Card activation failed" });
            return res.status(400).send(ciphertext);
        }

    } catch (error) {
        const ciphertext = await encryption({ status: false, message: "Internal server error" });
        return res.status(500).send(ciphertext);
    }
}

module.exports.freeze = async (req, res) => {
    try {
        // const { card_id } = req.body;
        const { card_id } = await decryption(req.body.data)

        if (!card_id) {
            const ciphertext = await encryption({ status: false, message: "Required fields are missing" });
            return res.status(400).send(ciphertext);
        }

        const card = await VirtualCardModel.findById(card_id);

        if (!card) {
            const ciphertext = await encryption({ status: false, message: "Card not found" });
            return res.status(400).send(ciphertext);
        }

        const requestData = {
            cardId: card.card_id
        }

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${baseURL}/openapi/card/freeze`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        })

        if (response.data.code === 1) {
            const ciphertext = await encryption({ status: true, message: "Card frozen successfully" });
            return res.status(200).send(ciphertext);
        } else {
            const ciphertext = await encryption({ status: false, message: "Card freezing failed" });
            return res.status(400).send(ciphertext);
        }

    } catch (error) {
        console.log(error)
        const ciphertext = await encryption({ status: false, message: "Internal server error" });
        return res.status(500).send(ciphertext);
    }
}

module.exports.getCardInfo = async (req, res) => {
    try {
        const card_id = req.params.card_id

        if (!card_id) {
            const ciphertext = await encryption({ status: false, message: "Required fields are missing" });
            return res.status(400).send(ciphertext);
        }

        const card = await VirtualCardModel.findById(card_id);

        if (!card) {
            const ciphertext = await encryption({ status: false, message: "Card not found" });
            return res.status(400).send(ciphertext);
        }

        const requestData = {
            cardId: card.card_id
        }

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${baseURL}/openapi/card/hk/info`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        })

        if (response.data.code === 1) {

            const decryptedResponse = decryptDataVCC(response.data.data)
            console.log({ decryptedResponse })

            const responseObj = {
                card_number: decryptedResponse.cardNo,
                exp_date: decryptedResponse.expDate,
                cvv: decryptedResponse.cvv,
                card_type: card.type,
                card_status: cardStatus[decryptedResponse.status],
                currency: decryptedResponse.curId,
                balance: decryptedResponse.cardBal,
                used_amount: decryptedResponse.usedAmt,
                total_amount: decryptedResponse.totalAmt,
                settled_amount: decryptedResponse.settleAmt,
                card_creation_date: card.createdAt
            }

            const ciphertext = await encryption({ status: true, message: "Card info fetched successfully", data: responseObj });
            return res.status(200).send(ciphertext);
        } else {
            const ciphertext = await encryption({ status: false, message: "Card info fetching failed" });
            return res.status(400).send(ciphertext);

        }
    } catch (error) {
        console.log(error)
        const ciphertext = await encryption({ status: false, message: "Internal server error" });
        return res.status(500).send(ciphertext);
    }
}

module.exports.getCardTransactions = async (req, res) => {
    const { cardId, account_id } = await decryption(req.body.data)
    // const { cardId, account_id } = req.body

    try {
        let query = {};

        if (cardId && account_id) {
            const cardDetails = await VirtualCardModel.findOne({ card_id: cardId });

            if (!cardDetails) {
                const ciphertext = await encryption({ status: false, message: "Card not found" });
                return res.status(400).send(ciphertext);
            }

            query = {
                accountId: account_id,
                $or: [
                    { cardNo: cardId },
                    { receiverCard: cardDetails._id },
                    { senderCard: cardDetails._id }
                ]
            };
        } else if (account_id && !cardId) {
            query = { accountId: account_id };
        } else {
            const ciphertext = await encryption({ status: false, message: "Invalid parameters provided" });
            return res.status(400).send(ciphertext);
        }

        const transactions = await VCCTransactionModel.find(query)
            .populate([
                {
                    path: 'senderCard',
                    select: '_id card_id',
                    populate: {
                        path: 'account',
                        select: 'first_name last_name'
                    }
                },
                {
                    path: 'receiverCard',
                    select: '_id card_id',
                    populate: {
                        path: 'account',
                        select: 'first_name last_name'
                    }
                }
            ])
            .lean();

        const ciphertext = await encryption({ status: true, message: "Card transactions fetched successfully", data: transactions });
        return res.status(200).send(ciphertext);
    } catch (error) {
        console.log(error)
        const ciphertext = await encryption({ status: false, message: "Internal server error" });
        return res.status(500).send(ciphertext);
    }
}

module.exports.createVVCHelper = async ({ currency, expdate, account_id, wallet_id, cardType, apple_pay, google_pay }) => {
    try {
        if (!currency || !expdate || !account_id || !wallet_id || !cardType) {
            return { status: false, message: "Missing required fields." };
        }

        if (cardType === "vcc_premium_plus_virtual" && (apple_pay === undefined || google_pay === undefined)) {
            return { status: false, message: "Apple Pay and Google Pay details are required for vcc_premium_plus_virtual cards." };
        }

        const { isValid, message } = validateExpiryDate(expdate);
        if (!isValid) {
            return { status: false, message };
        }

        const cards = await VirtualCardModel.find({ account: account_id });
        if (cards.length >= 3) {
            return { status: false, message: "You can only create a maximum of 3 virtual cards." };
        }

        const account = await Account.findOne({ $and: [{ _id: account_id }, { active: true }, { status: "active" }] }).populate("level");
        if (!account) {
            return { status: false, message: "Account not found." };
        }

        const walletDetails = await getActiveWallet(wallet_id);
        if (!walletDetails) {
            return { status: false, message: "Wallet not found." };
        }

        const vvcFee = await FeeModel.findOne({ $and: [{ service_name: cardType }, { account_level: account.level._id }] });
        if (!vvcFee) {
            return { status: false, message: "Fee not found." };
        }

        const convertedFee = await getExchangeRatesToUSD("USD", walletDetails.currency.code, vvcFee.flat_fee);
        if (convertedFee > walletDetails.balance.available) {
            return { status: false, message: "Insufficient balance." };
        }

        const requestData = {
            amt: '0.01',
            currency,
            expdate,
        };

        if (cardType.includes("vcc_premium_plus")) {
            requestData.productCode = "E0W00008";
        }
        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        const response = await axios.post(`${baseURL}/openapi/card/hk/multi_issue`, payload, {
            headers: {
                'Content-Type': 'application/json',
                'oaToken': token,
            }
        });

        if (response.data.code === 1) {
            const decryptedResponse = decryptDataVCC(response.data.data);

            const virtualCard = await VirtualCardModel.create({
                account: account_id,
                card_id: decryptedResponse.cardId,
                type: cardType?.includes("vcc_standard") ? "standard" : (cardType === "vcc_premium_plus_virtual" ? "premium_plus" : "premium"),
                last4: `************${decryptedResponse.cardNo.slice(-4)}`,
                expiry: decryptedResponse.expDate,
                subscription_type: "virtual",
                currency: decryptedResponse.curId,
                premium_features: cardType === "vcc_premium_plus_virtual" ? { apple_pay, google_pay } : undefined
            });

            walletDetails.balance.available = formatDecimalNumbersWithLimit(walletDetails.balance.available - convertedFee);
            await walletDetails.save();

            // updating the card phone and email if the card type is apple pay
            if (cardType === "vcc_premium_plus_virtual") {
                try {
                    const updateErrors = await updateCardContacts(
                        decryptedResponse.cardId,
                        account
                    );

                    console.log({ updateErrors })
                    if (updateErrors.length > 0) {

                        await logError(
                            "Error while updating the card phone and email",
                            `vcc_creation_bot`,
                            account._id,
                            null,
                            { errors: updateErrors }
                        )
                    }
                } catch (err) {
                    console.log(err)
                }

            }

            return { status: true, message: "Virtual Card created successfully.", data: virtualCard };
        } else {
            console.log(response.data);
            return { status: false, message: "Failed to create virtual card.", data: response.data };
        }
    } catch (error) {
        console.log(error);
        return { status: false, message: "Failed to create virtual card." };
    }
}

module.exports.cardToCardFee = async (req, res) => {
    try {
        // const data = req.body;
        const data = await decryption(req.body.data);
        const { senderCardId, receiverCardId, amount, } = data;

        if (!senderCardId || !receiverCardId || !amount) {
            const ciphertext = await encryption({ status: false, message: "Required fields are missing" });
            return res.status(400).send(ciphertext);
        }

        const cardDetails = await VirtualCardModel.findById(senderCardId).populate({
            path: "account",
            populate: "level"
        })
        const recipientCardDetails = await VirtualCardModel.findById(receiverCardId)

        if (!cardDetails || !recipientCardDetails) {
            const ciphertext = await encryption({ status: false, message: "Sender or Recipient Card not found" });
            return res.status(400).send(ciphertext);
        }

        const feeKey = `${cardDetails?.type}_card_to_card`

        // Get fee in CARD'S currency
        const feeDetails = await vccTopupFeeCalculation(
            cardDetails.currency,
            cardDetails.account.level,
            amount,
            feeKey
        );

        const from = cardDetails.currency;
        const to = recipientCardDetails.currency;

        let exchangeRate;
        if (from === to) {
            exchangeRate = 1
        } else {
            let newRate = await getExchangeRatesToUSD(from, to, 1);
            newRate = formatDecimalNumbersWithLimit(newRate, 6);
            exchangeRate = formatDecimalNumbersWithLimit(newRate - (feeDetails.percentage_markup / 100) * newRate, 6);
        }

        const recipientAmount = formatDecimalNumbersWithLimit(amount * exchangeRate, 2);
        const totalAmount = formatDecimalNumbersWithLimit(amount + feeDetails.fee, 2);

        const responseData = {
            feeDetails: {
                exchange_rate: formattedAmount(exchangeRate, 6),
                fee: formattedAmount(feeDetails.fee),
                recipient_amount: formattedAmount(recipientAmount),
                total_amount: formattedAmount(totalAmount),
                sending_currency: from,
                recipient_currency: to,
            }
        }

        const payload = {
            exchangeRate,
            feeDetails,
            recipientAmount,
            totalAmount,
            from,
            to,
        }

        const token = jwt.sign(payload, process.env.jwtKey, { expiresIn: '10m' });
        responseData.token = token;

        const ciphertext = await encryption({
            status: true,
            message: "Fee details generated successfully",
            data: responseData
        });
        res.status(200).send(ciphertext);


    } catch (error) {
        console.error(error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal Server Error. " + error?.message
        });
        return res.status(500).send(ciphertext);
    }
}
module.exports.cardToCardTransaction = async (req, res) => {
    try {
        // const decryptedData = await decryption(req.body.data);
        const decryptedData = req.body;
        const result = await cardToCardTransactionHelper(decryptedData);

        const statusCode = result.status ? 200 :
            result.message === "insufficient_funds" ? 402 :
                result.message === "Card not found" ? 404 :
                    result.message.includes("expired") ? 401 :
                        400;

        const ciphertext = await encryption(result);
        return res.status(statusCode).send(ciphertext);

    } catch (error) {
        console.error(error);
        const ciphertext = await encryption({
            status: false,
            message: "Card to Card transaction failed: " + error.message
        });
        return res.status(500).send(ciphertext);
    }
};

module.exports.getCardTopupFee = async (req, res) => {
    try {
        const data = await decryption(req.body.data);
        // const data = req.body;
        let { cardId, walletId, amount, type } = data;

        amount = formatDecimalNumbersWithLimit(amount);

        const [cardDetails, walletDetails] = await Promise.all([
            VirtualCardModel.findById(cardId),
            getActiveWalletById(walletId)
        ]);

        if (!cardDetails) {
            const ciphertext = await encryption({
                status: false,
                message: "Card not found"
            });
            return res.status(404).send(ciphertext);
        }

        console.log({ cardDetails })

        const feeKey = `topup_${type === "wallet" ? "ip_wallet" : type === "card" ? "card_payment" : "paypal"}_vcc_${cardDetails.type?.includes("premium") ? "premium" : "standard"}_${cardDetails.subscription_type}`;
        // topup_ip_wallet_vcc_standard <=== example

        // Get fee in CARD'S currency
        const feeDetails = await vccTopupFeeCalculation(
            cardDetails.currency,
            walletDetails.account.level,
            amount,
            feeKey
        );

        if (!feeDetails?.fee) {
            const ciphertext = await encryption({
                status: false,
                message: "Fee calculation failed"
            });
            return res.status(400).send(ciphertext);
        }

        if (type === "wallet") {
            if (!walletDetails) {
                const ciphertext = await encryption({
                    status: false,
                    message: "Wallet not found"
                });
                return res.status(404).send(ciphertext);
            }
            let markupExchangeRate;
            let rate = await getExchangeRatesToUSD(
                cardDetails.currency,
                walletDetails.currency.code,
                1
            );

            if (cardDetails.currency === walletDetails.currency.code) {
                markupExchangeRate = rate;
            } else {
                // Apply markup to the exchange rate
                markupExchangeRate = formatDecimalNumbersWithLimit(rate, 6);
                const percentageMarkup = (feeDetails.markup / 100) * rate;
                markupExchangeRate = formatDecimalNumbersWithLimit(rate - percentageMarkup, 6);
            }

            // Calculate total amount in wallet currency
            const totalAmount = formatDecimalNumbersWithLimit(
                markupExchangeRate * amount
            );

            const feeInLocalCurrency = formatDecimalNumbersWithLimit(feeDetails.fee * markupExchangeRate);

            const responseData = {
                feeDetails: {
                    amount: formattedAmount(amount),
                    fee: formattedAmount(feeDetails.fee),
                    amountToTopup: formattedAmount(formatDecimalNumbersWithLimit(amount - feeDetails.fee)),
                    currency: walletDetails.currency.code,
                    markup: cardDetails.currency === walletDetails.currency.code ? 0 : feeDetails.markup,
                    feeType: feeDetails.feeType,
                    exchangeRate: formattedAmount(markupExchangeRate, 6),
                    totalAmount: formattedAmount(totalAmount),
                }
            };

            const tokenPayload = {
                amount: amount,
                fee: feeDetails.fee,
                amountToTopup: formatDecimalNumbersWithLimit(amount - feeDetails.fee),
                feeInLocalCurrency,
                markup_rate: markupExchangeRate,
                markup: cardDetails.currency === walletDetails.currency.code ? 0 : feeDetails.markup,
                local_amount: totalAmount,
                fee_type: feeDetails.feeType,
                original_rate: rate,
                cardId: cardId,
            };

            responseData.token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: "10m" });

            const ciphertext = await encryption({
                status: true,
                message: "Fee details generated successfully",
                data: responseData
            });
            res.status(200).send(ciphertext);
        }
        else if (type === "card") {
            const responseData = {
                feeDetails: {
                    amount: formattedAmount(amount),
                    fee: formattedAmount(feeDetails.fee),
                    amountToTopup: formattedAmount(formatDecimalNumbersWithLimit(amount - feeDetails.fee)),
                    currency: cardDetails.currency,
                    feeType: feeDetails.feeType,
                }
            }

            const tokenPayload = {
                amount: amount,
                fee: feeDetails.fee,
                cardId: cardDetails.card_id,
                feeType: feeDetails.feeType,
                currency: cardDetails.currency,
            }

            const token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: "10m" });
            responseData.token = token

            const ciphertext = await encryption({
                status: true,
                message: "Fee details generated successfully",
                data: responseData
            });

            res.status(200).send(ciphertext);
        }
        else if (type === "paypal") {
            let amountInUSD = amount;
            let paypalRate = 1;
            let currencySupported = true;

            // Check if card's currency is supported by PayPal
            if (!supportedCurrencies.includes(cardDetails.currency)) {
                currencySupported = false;
                paypalRate = formatDecimalNumbersWithLimit(await convertCurrency(cardDetails.currency, "USD", 1), 6);
                amountInUSD = formatDecimalNumbersWithLimit(paypalRate * amount, 2);
            }

            const responseData = {
                feeDetails: {
                    amount: formattedAmount(amount),
                    fee: formattedAmount(feeDetails.fee),
                    amountToTopup: formattedAmount(formatDecimalNumbersWithLimit(amount - feeDetails.fee)),
                    currency: cardDetails.currency,
                    feeType: feeDetails.feeType,
                    converted_amount: formattedAmount(amountInUSD),
                    original_currency: cardDetails.currency,
                    currencySupported,
                    exchangeRate: formattedAmount(paypalRate, 6)
                }
            }

            const tokenPayload = {
                amount,
                fee: feeDetails.fee,
                feeType: feeDetails.feeType,
                cardId: cardDetails.card_id,
                converted_amount: amountInUSD,
                original_currency: cardDetails.currency,
                currencySupported
            };

            const token = jwt.sign(tokenPayload, process.env.jwtKey, { expiresIn: "10m" });
            responseData.token = token

            const ciphertext = await encryption({
                status: true,
                message: "Fee details generated successfully",
                data: responseData
            });

            res.status(200).send(ciphertext);
        }
        else {
            const ciphertext = await encryption({
                status: false,
                message: "Invalid Type",
            });
            res.status(400).send(ciphertext);
        }

    } catch (error) {
        console.error("Topup token generation error:", error);
        const ciphertext = await encryption({
            status: false,
            message: error.message || "Failed to generate topup details"
        });
        return res.status(500).send(ciphertext);
    }
};

// MASTERCARD TOPUP
// mastercard topup using ip wallet
module.exports.walletToCardTransaction = async (req, res) => {
    try {
        // const decryptedData = await decryption(req.body.data);
        const decryptedData = req.body;

        const result = await walletToCardTransactionHelper(decryptedData);

        const errorMapping = {
            "Invalid Sender!": 400,
            "Token Expired or Invalid Token!": 401,
            "Invalid Token!": 401,
            "Insufficient Balance!": 403,
            "Transaction failed": 502,
        };

        const statusCode = result.status ? 200 : (errorMapping[result.message] || 500);

        const ciphertext = await encryption(result);
        return res.status(statusCode).send(ciphertext);

    } catch (error) {
        console.error(error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal server error"
        });
        return res.status(500).send(ciphertext);
    }
};

// mastercard topup using paypal
module.exports.createMastercardTransactionPaypal = async (req, res) => {
    try {
        const data = req.body
        const { token, accountId } = data;

        // Decode the transaction token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.jwtKey);
        } catch (error) {
            const ciphertext = await encryption({
                status: false,
                message: "Transaction token expired or invalid"
            });
            return res.status(400).send(ciphertext);
        }

        console.log(accountId, req.user._id.toString())
        if (accountId !== req.user._id.toString()) {
            const ciphertext = await encryption({
                status: false,
                message: "Not authorized to perform this action"
            });
            return res.status(401).send(ciphertext);
        }

        const account = req.user;

        // Get PayPal access token
        const api = `${paypalUrl}/oauth2/token`;
        const tokenResponse = await axios.post(api, 'grant_type=client_credentials', {
            auth: {
                username: process.env.PAYPAL_CLIENT_ID,
                password: process.env.PAYPAL_SECRET
            }
        });

        const ref = 'tr_' + Date.now().toString();
        const paypalAmount = decoded.converted_amount;
        const paypalCurrency = decoded.currencySupported ? decoded.original_currency : "USD";

        // Create PayPal payment
        const paymentApi = `${paypalUrl}/payments/payment`;
        const paymentObj = {
            intent: "sale",
            payer: { payment_method: "paypal" },
            transactions: [{
                amount: {
                    total: paypalAmount.toFixed(2),
                    currency: paypalCurrency
                },
                description: account.username,
                custom: decoded.cardId,
                item_list: {
                    shipping_address: {
                        recipient_name: `${account.first_name} ${account.last_name}`,
                        line1: account.address || account.country_iso_code,
                        city: account.city || "",
                        country_code: iso2Countries[account.country_iso_code] || "CH",
                        postal_code: account.postal_code || "",
                        phone: account.phone || ""
                    }
                }
            }],
            redirect_urls: {
                return_url: `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`,
                cancel_url: `https://my.insta-pay.ch/add-funds/success/null?transaction_id=${ref}`
            }
        };

        const paypalResponse = await axios.post(paymentApi, paymentObj, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + tokenResponse.data.access_token
            }
        });

        if (paypalResponse.data.state !== 'created') {
            const ciphertext = await encryption({
                status: false,
                message: "Transaction failed during PayPal processing"
            });
            return res.status(400).send(ciphertext);
        }

        // Create transaction record
        const currentTime = moment().tz(account.timezone || "UTC").format();

        const vccTransaction = await VCCTransactionModel.create({
            cardNo: decoded.cardId,
            accountId: account._id,
            authCode: paypalResponse.data.id,
            transactionId: ref,
            billAmount: decoded.amount,
            txAmount: decoded.amount,
            currency: decoded.original_currency,
            fee: decoded.fee,
            status: 'INITIATED',
            merchantName: 'Card Top-Up By Paypal',
            merchantCategory: "topup_by_paypal",
            transaction_type: 'mastercard_topup',
            type: "credit",
            timeline: [
                {
                    date: currentTime,
                    status: "INITIATED",
                }
            ],
            external_token: {
                type: "mastercard_topup",
                token: token
            }
        });

        const approvalLink = paypalResponse.data.links.find(l => l.rel === 'approval_url');

        const responseData = {
            status: true,
            message: "PayPal transaction created successfully",
            data: {
                url: approvalLink.href,
                transactionId: ref,
                paypalTransactionId: paypalResponse.data.id,
                amount: paypalAmount,
                currency: paypalCurrency,
                vccTransactionId: vccTransaction._id,
                cardId: decoded.cardId
            }
        };

        const ciphertext = await encryption(responseData);
        res.status(200).send(ciphertext);

    } catch (error) {
        console.error("PayPal transaction creation error:", error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(ciphertext);
    }
};

// mastercard topup using card
module.exports.createMastercardTransactionCard = async (req, res) => {
    try {

        const data = req.body
        const { token, accountId, pan } = data;

        // Decode the transaction token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.jwtKey);
        } catch (error) {
            const ciphertext = await encryption({
                status: false,
                message: "Transaction token expired or invalid"
            });
            return res.status(400).send(ciphertext);
        }

        // Get account and PAN details

        if (accountId !== req.user._id.toString()) {
            const ciphertext = await encryption({
                status: false,
                message: "Not authorized to perform this action"
            });
            return res.status(401).send(ciphertext);
        }

        const account = req.user;
        const panDetails = await PanModel.findOne({ _id: pan, account: accountId });

        if (!panDetails) {
            const ciphertext = await encryption({
                status: false,
                message: "Card details not found"
            });
            return res.status(404).send(ciphertext);
        }

        // Decrypt PAN data
        let bytes = CryptoJS.AES.decrypt(panDetails.panData, process.env.PAN_ENCRYPTION_KEY);
        let panDataObj = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

        // Create transaction record
        const currentTime = moment().tz(account.timezone || "UTC").format();
        const transactionId = 'tr_' + Date.now().toString();

        const vccTransaction = await VCCTransactionModel.create({
            cardNo: decoded.cardId,
            accountId: account._id,
            transactionId: transactionId,
            billAmount: decoded.amount,
            txAmount: decoded.amount,
            currency: decoded.currency,
            fee: decoded.fee,
            status: 'INITIATED',
            merchantName: 'Card Top-Up By Card',
            merchantCategory: "topup_by_card",
            transaction_type: 'mastercard_topup',
            type: "credit",
            timeline: [
                {
                    date: currentTime,
                    status: "INITIATED",
                }
            ],
            external_token: {
                type: "mastercard_topup",
                token: token
            }
        });

        // Generate payment token
        const iat = Math.floor(Date.now() / 1000);
        const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id);
        const payload = generatePayload(decoded.amount, defaultWallet, panDataObj, vccTransaction, iat, true, false, false);
        const paymentToken = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

        const responseData = {
            status: true,
            message: "Card top-up transaction created successfully",
            data: {
                amount: formattedAmount(decoded.amount),
                currency: decoded.currency,
                fee: formattedAmount(decoded.fee),
                cardId: decoded.cardId,
                transaction_id: vccTransaction._id,
                transaction_ref: vccTransaction.transactionId,
                token: paymentToken,
                transactionToken: token,
            }
        };

        const ciphertext = await encryption(responseData);
        res.status(200).send(ciphertext);

    } catch (error) {
        console.error("Card top-up transaction creation error:", error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(ciphertext);
    }
};

// mastercard topup using manual card details
module.exports.createMastercardTransactionNewCard = async (req, res) => {
    try {

        const data = req.body
        const { token, accountId, is_card_save, se_shambey, } = data;

        if (!token || !accountId || !is_card_save || !se_shambey) {
            const ciphertext = await encryption({
                status: false,
                message: "Required fields are missing."
            })

            return res.status(400).send(ciphertext);
        }

        // Decode the transaction token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.jwtKey);
        } catch (error) {
            const ciphertext = await encryption({
                status: false,
                message: "Transaction token expired or invalid"
            });
            return res.status(400).send(ciphertext);
        }

        // decode the pan details
        let decodedPan;
        try {
            decodedPan = jwt.verify(se_shambey, process.env.FRONTEND_KEY);
        } catch (err) {
            console.log(err)
            const error = await encryption({
                status: false,
                message: "Invalid token."
            })
            return res.status(400).send(error);
        }

        let decodedRevesredString = decodedPan.gurhaku;
        let originalPan = decodedRevesredString.split(":").reverse().join(":");

        let [pan, securitycode, expiry_month, expiry_year] = originalPan.split(":");

        console.log({ pan, securitycode, expiry_month, expiry_year })

        if (accountId !== req.user._id.toString()) {
            const ciphertext = await encryption({
                status: false,
                message: "Not authorized to perform this action"
            });
            return res.status(401).send(ciphertext);
        }

        const account = req.user;

        // Create transaction record
        const currentTime = moment().tz(account.timezone || "UTC").format();
        const transactionId = 'tr_' + Date.now().toString();

        const vccTransaction = await VCCTransactionModel.create({
            cardNo: decoded.cardId,
            accountId: account._id,
            transactionId: transactionId,
            billAmount: decoded.amount,
            txAmount: decoded.amount,
            currency: decoded.currency,
            fee: decoded.fee,
            status: 'INITIATED',
            merchantName: 'Card Top-Up By Card',
            merchantCategory: "topup_by_card",
            transaction_type: 'mastercard_topup',
            type: "credit",
            timeline: [
                {
                    date: currentTime,
                    status: "INITIATED",
                }
            ],
            external_token: {
                type: "mastercard_topup",
                token: token
            },
            is_card_save: is_card_save,
        });

        // Generate payment token
        const iat = Math.floor(Date.now() / 1000);
        const defaultWallet = await fetchLocalOrDefaultWalletConditionally(account._id);
        const payload = generatePayload(decoded.amount, defaultWallet, { pan, securitycode, expirydate: `${expiry_month}/${expiry_year}` }, vccTransaction, iat, false, false, false);
        const paymentToken = jwt.sign(payload, process.env.TRUST_PAYMENT_SECRET, { algorithm: 'HS256' });

        const responseData = {
            status: true,
            message: "Card top-up transaction created successfully",
            data: {
                amount: formattedAmount(decoded.amount),
                currency: decoded.currency,
                fee: formattedAmount(decoded.fee),
                cardId: decoded.cardId,
                transaction_id: vccTransaction._id,
                transaction_ref: vccTransaction.transactionId,
                token: paymentToken,
                transactionToken: token,
            }
        };

        const ciphertext = await encryption(responseData);
        res.status(200).send(ciphertext);

    } catch (error) {
        console.error("Card top-up transaction creation error:", error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal server error."
        });
        return res.status(500).send(ciphertext);
    }
};

module.exports.searchCards = async (req, res) => {
    try {
        const { searchType, query } = await decryption(req.body.data);
        // const { searchType, query } = req.body;
        if (!['username', 'last4'].includes(searchType)) {
            const ciphertext = await encryption({
                status: false,
                message: "Invalid search type. Use 'username' or 'last4'"
            });
            return res.status(400).send(ciphertext);
        }

        let responseData;

        if (searchType === 'username') {
            const account = await Account.findOne({ username: query.toLowerCase() }).select('_id first_name last_name username profileImage country_name');

            if (!account) {
                const ciphertext = await encryption({
                    status: false,
                    message: "Account not found"
                });
                return res.status(404).send(ciphertext);
            }

            const cards = await VirtualCardModel.find({ account: account._id }).select('_id card_id last4 currency createdAt');

            if (cards.length === 0) {
                const ciphertext = await encryption({
                    status: false,
                    message: "No cards found for this account"
                });
                return res.status(404).send(ciphertext);
            }

            responseData = {
                user: {
                    username: account.username,
                    profileImage: account.profileImage?.url,
                    country: account.country_name,
                    fullName: `${account.first_name} ${account.last_name}`
                },
                cards: cards.map(card => ({
                    id: card._id,
                    cardId: card.card_id,
                    last4: card.last4,
                    currency: card.currency,
                    createdAt: card.createdAt
                }))
            };

        } else if (searchType === 'last4') {
            const cards = await VirtualCardModel.find({
                last4: { $regex: `${query}$` }
            });

            if (cards.length === 0) {
                const ciphertext = await encryption({
                    status: false,
                    message: "No cards found with these digits"
                });
                return res.status(404).send(ciphertext);
            }

            // Get unique accounts and their cards
            const accountMap = new Map();

            for (const card of cards) {
                const account = await Account.findById(card.account);
                if (account) {
                    if (!accountMap.has(account._id.toString())) {
                        accountMap.set(account._id.toString(), {
                            user: {
                                username: account.username,
                                profileImage: account.profileImage?.url,
                                country: account.country_name,
                                fullName: `${account.first_name} ${account.last_name}`
                            },
                            cards: []
                        });
                    }
                    accountMap.get(account._id.toString()).cards.push({
                        id: card._id,
                        last4: card.last4,
                        currency: card.currency,
                        status: card.status,
                        createdAt: card.createdAt
                    });
                }
            }

            responseData = Array.from(accountMap.values());
        }

        const ciphertext = await encryption({
            status: true,
            message: "Cards fetched successfully",
            data: responseData
        });

        return res.status(200).send(ciphertext);

    } catch (error) {
        console.error(error);
        const ciphertext = await encryption({
            status: false,
            message: "Internal server error"
        });
        return res.status(500).send(ciphertext);
    }
};

module.exports.updateCardEmail = async (req, res) => {
    try {
        const { card_id, card_email } = await decryption(req.body.data);

        if (!card_id || !card_email) {
            return res.status(400).send(await encryption({
                status: false,
                message: "Required fields are missing.",
            }));
        }

        const cardDetails = await VirtualCardModel.findById(card_id);

        if (!cardDetails) {
            return res.status(404).send(await encryption({
                status: false,
                message: "Card not found.",
            }));
        }

        if (cardDetails.account.toString() !== req.user._id.toString()) {
            return res.status(403).send(await encryption({
                status: false,
                message: "You are not authorized to update this card's email.",
            }));
        }

        const requestData = { cardId: cardDetails.card_id, card_email };

        console.log({ requestData });

        const encryptedData = encryptDataVCC(requestData);
        const payload = { data: encryptedData };

        console.log({ payload });

        const response = await axios.post(`${baseURL}/openapi/card/update_email`, payload, {
            headers: {
                "Content-Type": "application/json",
                oaToken: token,
            },
        });

        console.log(response.data);

        if (response.data.code === 1) {
            const decryptedResponse = decryptDataVCC(response.data.data);
            console.log({ decryptedResponse });

            return res.status(200).send(await encryption({
                status: true,
                message: "Card email updated successfully",
                data: decryptedResponse,
            }));
        } else {
            return res.status(400).send(await encryption({
                status: false,
                message: response.data.message || "Failed to update card email",
            }));
        }
    } catch (error) {
        console.error("Error updating card email:", error);

        return res.status(500).send(await encryption({
            status: false,
            message: "Internal server error",
            error: error.message,
        }));
    }
};