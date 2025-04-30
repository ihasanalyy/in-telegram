const Account = require('../models/Account.model');
const AdminNotification = require('../models/AdminNotification.model');
const Company = require('../models/Company.model');
const Notification = require('../models/Notification.model');
const User = require('../models/User.model');

const addNotification = async (notificationData) => {
    try {
        const { from, to, ...rest } = notificationData;

        const populateAccountInfo = async (accountId) => {
            const account = await Account.findById(accountId);
            if (!account) {
                console.log('Account not found!');
                return null;
            }

            if (account.account_type === 'individual') {
                const user = await User.findOne({ account: accountId });
                return {
                    _id: account._id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    profile_picture: account.profileImage.url,
                    account_type: account.account_type
                };
            } else if (account.account_type === 'business') {
                const company = await Company.findOne({ account: accountId });
                return {
                    _id: account._id,
                    company_name: company.company_name,
                    profile_picture: account.profileImage.url,
                    account_type: account.account_type
                };
            }

            return null;
        };

        const fromInfo = await populateAccountInfo(from);
        const toInfo = await populateAccountInfo(to);
        const newNotification = new Notification({
            fromDetails: fromInfo,
            toDetails: toInfo,
            ...rest,
            from,
            to,
        });
        const savedNotification = await newNotification.save();
        return savedNotification;
    } catch (error) {
        console.error('Error adding notification:', error.message);
        // throw error;
    }
};

const addNotificationAdmin = async (notificationData) => {
    try {
        const { from, to, ...rest } = notificationData;

        const populateAccountInfo = async (accountId) => {
            const account = await Account.findById(accountId);
            if (!account) {
                console.log('Account not found!');
                return null;
            }

            if (account.account_type === 'individual') {
                const user = await User.findOne({ account: accountId });
                return {
                    _id: account._id,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    profile_picture: account.profileImage.url,
                    account_type: account.account_type
                };
            } else if (account.account_type === 'business') {
                const company = await Company.findOne({ account: accountId });
                return {
                    _id: account._id,
                    company_name: company.company_name,
                    profile_picture: account.profileImage.url,
                    account_type: account.account_type
                };
            }

            return null;
        };

        const fromInfo = await populateAccountInfo(from);
        const toInfo = await populateAccountInfo(to);


        const newNotification = new AdminNotification({
            fromDetails: fromInfo,
            toDetails: toInfo,
            ...rest,
            from,
            to,
        });

        console.log(newNotification)

        const savedNotification = await newNotification.save();
        console.log('Notification added successfully:', savedNotification);
        return savedNotification;
    } catch (error) {
        console.error('Error adding notification:', error.message);
        // throw error;
    }
};

module.exports = { addNotification, addNotificationAdmin }
