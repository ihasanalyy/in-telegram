const CountryModel = require("../models/Country.model");
const { processExchangeRates, updateUsedLimits } = require("./conversion");
const { createQuotationHelper, sendSMSTemplate, convertCurrency, logError, generateUniqueInteger, getCountryName, calculateAge } = require("./helpers");

const jwt = require('jsonwebtoken');
const shortid = require('shortid');
const axios = require('axios');
const momenttz = require('moment-timezone');
const moment = require('moment');
const { encryption, decryption } = require('../configurations/Encryption');
const UserModel = require("../models/User.model");
const BeneficiaryModel = require("../models/Beneficiary.model");
const CommissionModel = require("../models/Commission.model");
const AccountModel = require("../models/Account.model");
const TransactionModel = require("../models/Transaction.model");
const WalletModel = require("../models/Wallet.model");
const { thunesBalance } = require("./payerRates");
const { commissionCalculator } = require("../controllers/Thune.controller");
const loginHistory = require("../models/Login-History.model");
const secretKey = process.env.jwtKey;
const Thunes_KEY = process.env.API_KEY_PROD;
const Thunes_SECRET = process.env.API_SECRET_PROD;
const authHeaders = `Basic ${Buffer.from(`${Thunes_KEY}:${Thunes_SECRET}`).toString('base64')}`;
const sandboxUrl = process.env.THUNES_PROD_URL

const uploadAttachments = async (TransactionID, file, type = "invoice", name = "invoice") => {
    const config = {
        headers: {
            'Authorization': authHeaders,
            'Content-Type': 'multipart/form-data'
        }
    };

    const formData = new FormData();
    const API_ATTACHMENT_URL = `${sandboxUrl}/v2/money-transfer/transactions/ext-${TransactionID}/attachments`;

    // for (const file of reqFiles) {
    const blob = new Blob([file.buffer], { type: file.mimetype });

    formData.append('file', blob, file.originalname);
    formData.append('type', type);
    formData.append('name', name);
    // }

    try {
        const response = await axios.post(API_ATTACHMENT_URL, formData, config);
        return response.data;
    } catch (error) {
        if (error.response && error.response.data && error.response.data.errors) {
            console.error("errorinside", error.response.data.errors);
        } else {
            return { status: false, message: 'An error occurred while uploading attachments' }
        }
    }
};

const compareNestedObjects = (obj1, obj2) => {
    console.log(obj1, obj2);
    let differences = [];
    let status = true;

    const compare = (obj1, obj2, path = '') => {
        for (let key in obj1) {
            const currentPath = path ? `${path}.${key}` : key;
            if (obj1.hasOwnProperty(key)) {
                if (typeof obj1[key] === 'object' && obj1[key] !== null && !Array.isArray(obj1[key])) {
                    compare(obj1[key], obj2[key], currentPath);
                } else if (obj1[key] !== obj2[key]) {
                    differences.push(currentPath);
                    status = false;
                }
            }
        }
        for (let key in obj2) {
            const currentPath = path ? `${path}.${key}` : key;
            if (obj2.hasOwnProperty(key) && !obj1.hasOwnProperty(key)) {
                differences.push(currentPath);
                status = false;
            }
        }
    };

    compare(obj1, obj2);

    return { differences, status };
};

async function createQuotation(data) {
    try {
        const { token, transaction_type, amount, service_name, wallet_id, channel_name, payerId, service_id, iso_code } = data
        const external_id = shortid.generate()

        const country = await CountryModel.findOne({ country_iso_code: iso_code });

        const result = await processExchangeRates({
            transaction_type,
            amount,
            service_name,
            wallet_id,
            channel_name,
            payerId,
            external_id,
            service_id,
            country: country._id,
        });

        if (result.status === false) {
            const error = await encryption({
                status: false,
                message: "Something went wrong while getting exchange rates",
            });
            return { status: false, data: error };
        }

        const decoded = jwt.verify(token, secretKey);
        console.log(decoded, 'decoded')

        const obj1 = { result: decoded.result };
        const obj2 = { result: result.result };

        // const difference = compareNestedObjects(obj1, obj2);

        // if (difference.status === false) {
        //     const error = await encryption({
        //         status: false,
        //         message: "Difference in exchange rates",
        //     });
        //     return { status: false, data: error };
        // }

        const mode = 'DESTINATION_AMOUNT';
        const Thunes_Currency = 'USD';
        const Thunes_Country = 'USA';
        const external_id1 = shortid.generate()

        const requestData = {
            external_id: external_id1,
            payer_id: payerId,
            mode,
            transaction_type,
            source: {
                amount: null,
                currency: Thunes_Currency,
                country_iso_code: Thunes_Country,
            },
            destination: {
                amount: parseInt(obj2.result.recipient.value),
                currency: obj2.result.exchanged_rate.currency,
            },
        };

        const quotationResponse = await createQuotationHelper(requestData);

        const quotationResult = {
            status: true,
            message: "Quotation created successfully",
            QuotationID: external_id1,
            token,
        };

        return { status: true, quotationResult };
    } catch (error) {
        console.error('Error creating quotation:', error);
        const output = await encryption('Internal Server Error');
        return { status: false, data: output };
    }
};

async function createTransaction(Quotation_ID, transactionData) {
    try {
        console.log(transactionData, "transactionData", Quotation_ID)
        const {
            wallet_id,
            additional_information,
            purpose_of_remittance,
            user_id,
            beneficiary_id,
            service,
            bank_id,
            mobile_wallet_id,
            transaction_type,
            token,
            type
        } = transactionData;

        const user = await UserModel.findById(user_id).populate("account");
        console.log(user, "user")
        const beneficiary = await BeneficiaryModel.findById(beneficiary_id);
        const service_id = service.id;

        const credit_party_identifier = {};
        let document_type = '';
        let document_number = '';
        let bank_details;

        if (mobile_wallet_id) {
            const mobile_wallet = beneficiary.mobile_wallet.find(bl => bl._id == mobile_wallet_id);
            credit_party_identifier.msisdn = mobile_wallet?.wallet_account_number;
            credit_party_identifier.account_number = mobile_wallet?.extras?.account_number;
            credit_party_identifier.iban = mobile_wallet?.extras?.iban;
            credit_party_identifier.email = beneficiary?.email || '';
            credit_party_identifier.bank_account_number = mobile_wallet?.extras?.account_number;
            credit_party_identifier.account_type = mobile_wallet?.extras?.account_type;
        } else if (bank_id) {
            bank_details = beneficiary.bank_details.find(bl => bl._id == bank_id);
            credit_party_identifier.bank_account_number = bank_details?.account_number;
            credit_party_identifier.account_number = bank_details?.account_number;
            credit_party_identifier.iban = bank_details?.iban;
            credit_party_identifier.cbu = bank_details?.extras?.cbu;
            credit_party_identifier.account_type = bank_details?.extras?.account_type;
            credit_party_identifier.bsb_number = bank_details?.extras?.bsb_number;
            credit_party_identifier.branch_number = bank_details?.extras?.branch_number;
            credit_party_identifier.swift_bic_code = bank_details?.extras?.swift_bic_code;
            credit_party_identifier.routing_code = bank_details?.extras?.routing_code;
            credit_party_identifier.entity_tt_id = bank_details?.extras?.entity_tt_id;
            credit_party_identifier.ifs_code = bank_details?.extras?.ifs_code;
            credit_party_identifier.clabe = bank_details?.extras?.clabe;
            credit_party_identifier.msisdn = beneficiary?.phone;
            credit_party_identifier.sort_code = bank_details?.extras?.sort_code;
        } else if (service_id === 3) {
            credit_party_identifier.msisdn = beneficiary.phone;
            document_type = beneficiary.cash_pickup[0].document_type;
            document_number = beneficiary.cash_pickup[0].document_number;
        } else if (service_id === 4) {
            credit_party_identifier.card_number = '4111254101010100';
            credit_party_identifier.bank_account_number = '272715638100';
        }

        const transactionExternalID = `instapay_t_id_${Date.now()}`;

        const first_type = transaction_type[0];
        const second_type = transaction_type[2];
        let requestData;
        let sender_obj;
        const documentType = user?.extras?.documentType === "id-card" ? "NATIONAL_ID" :
            user?.extras?.documentType === "passport" ? "PASSPORT" :
                user?.extras?.documentType === "driving-license" ? "DRIVING_LICENSE" : "RESIDENT_CARD";

        if (first_type === 'C') {
            sender_obj = {
                firstname: user?.first_name || '',
                lastname: user?.last_name || '',
                nationality: user?.account?.user_nationaility || '',
                address: user?.account?.address || '',
                id_expiration_date: user?.extras?.dateOfExpiry || '',
                country_of_birth_iso_code: user?.account?.user_nationaility || "",
                source_of_funds: user?.source_of_funds || "",
                date_of_birth: user?.account?.dob?.split("-")?.reverse()?.join("-") || "",
                country_iso_code: user?.account?.country_iso_code || "",
                beneficiary_relationship: beneficiary?.relation?.toUpperCase() || "",
                nativename: "",
                id_country_iso_code: user?.account?.user_nationaility || '',
                email: user?.account?.email || '',
                city: user?.account?.city || '',
                postal_code: user?.account?.postal_code || '',
                id_type: documentType,
                id_number: user?.extras?.idNumber,
                gender: user?.account?.gender ?
                    (user?.account?.gender?.toLowerCase() === "male" ? "MALE" : "FEMALE") : "",
                code: user?.extras?.idNumber || Math.floor(10000 + Math.random() * 90000),
                id_delivery_date: user?.extras?.dateOfIssue || "",
                // middlename: user?.last_name || '',
                occupation: user?.occupation || "",
                province_state: user?.account?.country_iso_code || "",
                msisdn: user?.account?.phone || "",
                nationality_country_iso_code: user?.account?.user_nationaility || "",
            }
        }

        let beneficiary_obj;
        if (second_type === "C") {
            beneficiary_obj = {
                firstname: beneficiary?.first_name,
                // middlename: beneficiary?.extras?.middle_name || "middlename",
                lastname: beneficiary?.last_name,
                bank_account_holder_name: bank_details?.account_holder_name || beneficiary?.first_name + ' ' + beneficiary?.last_name,
                country_iso_code: bank_id
                    ? beneficiary?.extras?.country_iso_code || beneficiary?.country_iso_code
                    : beneficiary?.country_iso_code || '',
                id_country_iso_code: '',
                email: beneficiary?.email || '',
                city: beneficiary?.city || '',
                postal_code: beneficiary?.postal_code || '',
                id_type: beneficiary?.extras?.id_type || "",
                address: beneficiary?.address || '',
                id_number: beneficiary?.extras?.id_number || "",
                province_state: beneficiary?.extras?.province_state || "",
                msisdn: beneficiary?.phone || "",
                code: beneficiary?.extras?.id_number || null,
                nationality_country_iso_code: beneficiary?.extras?.nationality || "",
                occupation: beneficiary?.extras?.occupation || "",
                gender: beneficiary?.extras?.gender ?
                    (beneficiary.extras.gender.toLowerCase() === "male" ? "MALE" : "FEMALE") : "",
                date_of_birth: beneficiary?.extras?.date_of_birth || "",
            };
        }

        let sending_business;
        if (first_type === 'B') {
            sending_business = {
                registered_name: user.first_name || '',
                trading_name: user.first_name || '',
                address: "address",
                postal_code: "123",
                city: "Paris",
                country_iso_code: "FRA",
                registration_number: "123"
            };
        }

        let receiving_business;
        if (second_type === 'B') {
            receiving_business = {
                registered_name: beneficiary.first_name,
                trading_name: beneficiary.first_name,
                address: "Address",
                postal_code: "12345",
                city: "Singapore",
                country_iso_code: "SGP",
                tax_id: 1234567,
                representative_lastname: "Doe",
                representative_firstname: "John"
            };
        }

        if (first_type === 'C' && second_type === "C") {
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                credit_party_identifier: credit_party_identifier,
                external_id: transactionExternalID,
                sender: sender_obj,
                beneficiary: beneficiary_obj,
            };
        } else if (first_type === 'B' && second_type === "C") {
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                credit_party_identifier: credit_party_identifier,
                external_id: transactionExternalID,
                sending_business: sending_business,
                beneficiary: beneficiary_obj,
            };
        } else if (first_type === 'B' && second_type === "B") {
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                credit_party_identifier: credit_party_identifier,
                external_id: transactionExternalID,
                sending_business: sending_business,
                receiving_business: receiving_business,
                document_reference_number: 123,
            };
        } else if (first_type === 'C' && second_type === "B") {
            requestData = {
                retail_rate: "",
                additional_information_1: additional_information,
                purpose_of_remittance: purpose_of_remittance,
                credit_party_identifier: credit_party_identifier,
                external_id: transactionExternalID,
                sender: sender_obj,
                receiving_business: receiving_business,
            };
        }

        requestData['callback_url'] = 'https://fontawesomev23.com/api/webhook/thunes-transaction-status';
        requestData['external_code'] = user.account._id;

        const API_URL = `${sandboxUrl}/v2/money-transfer/quotations/ext-${Quotation_ID}/transactions`;
        const config = {
            headers: {
                'Authorization': authHeaders,
                'Content-Type': 'application/json'
            }
        };

        console.log(requestData, "request data")
        const response = await axios.post(API_URL, requestData, config);
        const transactionResult = response.data;

        console.log(transactionResult, "transactionResult")

        const humanReadableCreationDate = moment(transactionResult.creation_date).format('MMMM Do YYYY, h:mm a');
        const humanReadableExpirationDate = moment(transactionResult.expiration_date).format('MMMM Do YYYY, h:mm a');

        const outputData = {
            TransactionID: transactionExternalID,
            additional_information_1: transactionResult.additional_information_1,
            sender: transactionResult.sender,
            beneficiary: transactionResult.beneficiary,
            creation_date: humanReadableCreationDate,
            credit_party_identifier: transactionResult.credit_party_identifier,
            callback_url: transactionResult.callback_url,
            status: transactionResult.status,
            expiration_date: humanReadableExpirationDate,
            amount: transactionResult.amount
        };

        const decodedToken = jwt.verify(token, secretKey);
        console.log(decodedToken, "tokencheck")

        const { fee, recipient, total } = decodedToken.result;
        const { fee_type, markup_value, exchange_rate_with_markup } = decodedToken.extras;
        const filteredCreditPartyIdentifier = Object.fromEntries(
            Object.entries(credit_party_identifier).filter(([_, value]) => value)
        );

        const transactionDetails = {
            calculations: { fee, recipient, total },
            extras: { fee_type, markup_value, exchange_rate_with_markup },
            purpose: purpose_of_remittance,
            description: additional_information,
            service_id,
            beneficiary_id,
            credit_party_identifier: filteredCreditPartyIdentifier

        }

        const payload = {
            TransactionID: transactionExternalID,
            wallet_id: wallet_id,
            status_message: transactionResult.status_message,
            // user_id: user_id,
            transactionDetails
        };

        console.log(payload, "payloadincreatetransaction")

        const newToken = jwt.sign(payload, secretKey, { expiresIn: '5m' });

        return { status: true, token: newToken, id: transactionResult.id };
    } catch (error) {
        await logError(
            `error intl create transaction helper: ${error?.response?.data?.errors || error}`,
            "intl",
            null,
            null,
        );
        console.error("Error in creating transaction:", error?.response?.data?.errors || error);
        return { status: false, data: error };
    }
}

const confirmTransaction = async (decryptedData, files) => {
    try {
        const decodedToken = decryptedData;
        console.log('token', decodedToken);

        const {
            TransactionID,
            wallet_id,
            user_id,
            withdrawal,
            transactionDetails
        } = decodedToken;

        const calculations = transactionDetails.calculations;
        const extras = transactionDetails.extras;

        console.log(calculations, "calculations", extras, "extras", calculations.recipient.currency, decodedToken.transactionDetails.purpose);

        const wallet = await WalletModel.findOne({ _id: wallet_id }).populate('account');
        if (!wallet) {
            return { status: false, message: "Wallet not found" };
        }

        const account = await AccountModel.findOne({ _id: wallet.account.id }).populate("user")
        if (!account) {
            return { status: false, message: "Account not found" };
        }

        if (files?.length > 3) {
            return { status: false, message: 'Maximum 3 files allowed' };
        }

        const thunesDetails = await thunesBalance();
        console.log(thunesDetails, "thunesDetails");

        const USDBalance = thunesDetails.thunes.filter((item) => item.currency === "USD");
        console.log(USDBalance, "USDBalance");

        let exchangedTotalWithFeeToUSD = await convertCurrency(calculations.recipient.currency, 'USD', calculations.recipient.value);

        if (exchangedTotalWithFeeToUSD > USDBalance[0].balance) {
            return { status: false, message: 'Insufficient Balance in thunes' };
        }

        let attachments = [];

        if (files && files.length > 0) {
            const bucketName = process.env.AWS_BUCKET_NAME;

            for (const file of files) {
                if (file.mimetype.split("/")[0] === "image") {
                    const params = {
                        Bucket: bucketName,
                        Key: `transaction_images/${account.username}_${TransactionID}/${file.originalname}`,
                        Body: file.buffer
                    };

                    const uploadResult = await s3.upload(params).promise();

                    if (uploadResult?.Location && uploadResult?.Key && uploadResult?.ETag) {
                        attachments.push({
                            key: uploadResult.Key,
                            url: uploadResult.Location,
                            ETag: uploadResult.ETag
                        });
                    } else {
                        return { status: false, message: 'Something went wrong while uploading the image' };
                    }
                } else {
                    return { status: false, message: 'Only image files are allowed' };
                }
            }
        }

        const transactionId = decodedToken.TransactionID;
        if (attachments.length > 0) {
            for (const file of files) {
                await uploadAttachments(transactionId, file, "invoice", "invoice");
            }
        }

        const balance = wallet.balance.available;
        const total = calculations.total.value;

        if (total > balance) {
            return { status: false, message: `Insufficient Balance, your current balance in this wallet is ${balance}` };
        }

        const config = {
            headers: {
                'Authorization': authHeaders,
                'Content-Type': 'application/json'
            }
        };
        console.log({ transactionId });
        const transactionDetailsUrl = `${sandboxUrl}/v2/money-transfer/transactions/ext-${transactionId}`;
        const transactionDetailsResponse = await axios.get(transactionDetailsUrl, config);
        const transactionDetailsData = transactionDetailsResponse.data;
        console.log({ transactionDetailsData });

        const vespiaTxId = generateUniqueInteger(TransactionID);

        let paymentType;
        const serviceId = decodedToken.transactionDetails.service_id
        if (serviceId === 1) {
            paymentType = 'international_mobile_wallet';
        } else if (serviceId === 2) {
            paymentType = 'international_bank_transfer';
        } else if (serviceId === 3) {
            paymentType = 'international_cash_pickup';
        } else {
            paymentType = 'international_card_payment';
        }

        const userLoginHistory = await loginHistory.findOne({ account: account._id }).sort({ createdAt: -1 }).exec()
        console.log({ userLoginHistory })
        const vespiaRequestBody = {
            user_id: user_id,
            timestamp: new Date().toISOString().replace("T", " ").split(".")[0] + ".000",
            type: "TRANSFER",
            amount: transactionDetailsData.sent_amount.amount.toString(),
            currency: transactionDetailsData.sent_amount.currency,
            receiver_id: transactionDetails.beneficiary_id,
            tx_id: vespiaTxId.toString(),
            customer_age: calculateAge(account.dob).toString(),
            description: "International transaction",
            direction: "Outgoing",
            status: "Pending",
            document_expiration: account.user?.extras?.dateOfExpiry ?
                `${account.user.extras.dateOfExpiry} 12:00:00` : null,
            last_email_change: null,
            last_phone_change: null,
            is_instapay_member: true,
            sender_country: getCountryName(account?.country_iso_code) || "Unknown",
            receiver_country: getCountryName(transactionDetailsData.beneficiary.country_iso_code) || "Unknown",
            user_ip: userLoginHistory?.location?.IPv4 || "192.168.1.1",
            user_email: account?.email || "Unknown",
            user_passport: account.user?.extras?.idNumber || "Unknown",
            user_phone: account.phone.startsWith("+") ? account.phone : `+${account.phone}`, // Format phone
            payment_card: serviceId === 3 ? "1234-5678-9012-3456" : null,
            user_wallet_balance: balance,
            crypto_type: null,
            payment_method: serviceId === 1 ? "Mobile Wallet" : serviceId === 2 ? "Bank Account" : serviceId === 3 ? "Cash Pickup" : "Credit Card",
            industry_type: null,
            business_size: null,
            browser_name: userLoginHistory?.browser_name || "Unknown",
            platform: userLoginHistory?.platform || "Unknown",
            browser_version: userLoginHistory?.browser_version || "Unknown",
            is_mobile_user: userLoginHistory?.is_mobile_user
        };

        console.log({ vespiaRequestBody })

        const vespiaResponse = await axios.post('http://ec2-15-188-72-2.eu-west-3.compute.amazonaws.com:5000/handle_data', vespiaRequestBody, {
            headers: {
                'Authorization': `Bearer ${process.env.vespiaToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(vespiaResponse.data, "Vespia API Response");

        const senderTimezone = wallet.account.timezone || "UTC";
        const senderCurrentTime = momenttz().tz(senderTimezone).format();

        const senderTransactionObj = {
            reference_id: `tr_${Date.now()}`,
            external_reference: transactionId,
            type: 'instant',
            transaction_type: 'debit',
            service_type: `${withdrawal ? 'withdrawal' : 'international'}`,
            payment_type: paymentType,
            status: 'INITIATED',
            channel_details: transactionDetails.credit_party_identifier,
            purpose: decodedToken.transactionDetails.purpose,
            description: decodedToken.transactionDetails.description,
            currency: { code: wallet.currency.code, symbol: wallet.currency.symbol },
            amount: total - calculations.fee.value,
            recipient_received_amount: calculations?.recipient?.value,
            recipient_received_currency: calculations.recipient.currency,
            fee: calculations.fee.value,
            fee_type: extras.fee_type,
            vendor: { name: "thunes", fee: extras?.thunes_fee || 0, rate: extras?.thunes_rate },
            ip_fee: calculations.fee.value - extras.thunes_fee || 0,
            markup: extras?.markup_value,
            markup_currency: wallet.currency.code,
            exchange_rate: extras?.original_exchange_rate,
            exchange_rate_markup: extras?.exchange_rate_with_markup,
            feeToSendingRate: extras?.feeToSendingRate,
            total: total,
            wallet_id: wallet.wallet_id,
            wallet: wallet._id,
            account: wallet.account._id,
            sender: wallet.account._id,
            beneficiary: transactionDetails.beneficiary_id || null,
            receiver: null,
            current_balance: wallet.balance.available,
            new_balance: wallet.balance.available - total,
            attachments,
            timeline: [{ status: 'INITIATED', date: senderCurrentTime }],
            payment_id: vespiaTxId // Using this ID in vespia callback to track the transaction
        };

        console.log(senderTransactionObj, "senderTransactionObj");

        const senderTransaction = await TransactionModel.create(senderTransactionObj);

        // deducting the balcen from wallet
        wallet.balance.available = wallet.balance.available - total;
        await wallet.save()

        let USDTotal;
        if (wallet.currency.code !== 'USD') {
            USDTotal = await convertCurrency(wallet.currency.code, 'USD', total);
        } else {
            USDTotal = total;
        }

        await updateUsedLimits(wallet.account, null, USDTotal, null);

        const outputData = {
            TransactionID: transactionId,
            reference_id: senderTransaction.reference_id,
            beneficiary: {
                first_name: transactionDetailsData.beneficiary.firstname,
                last_name: transactionDetailsData.beneficiary.lastname,
            },
        };

        return { status: true, data: outputData };

    } catch (error) {
        console.error('Error confirming transaction:', error?.response?.data?.errors || error);
        const user = await UserModel.findById(decryptedData?.user_id).populate("account")
        await logError(
            `error intl helper: ${error?.response?.data?.errors || error}`,
            "intl",
            user ? user.account._id : decryptedData?.user_id || null,
            null,
        );
        return { status: false, message: error?.response?.data?.errors || error };
    }
};

const cancelTransaction = async (id) => {
    try {
        const API_URL = `${sandboxUrl}/v2/money-transfer/transactions/${id}/cancel`;
        const config = {
            headers: {
                'Authorization': authHeaders,
                'Content-Type': 'application/json'
            }
        };

        const response = await axios.post(API_URL, config);

        return { status: true, data: response.data };
    } catch (err) {
        console.log(err)
        return { status: false, message: err };
    }
}

module.exports = {
    confirmTransaction,
    createTransaction,
    createQuotation,
    cancelTransaction
}