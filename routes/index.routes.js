const express = require('express');
const routes = express.Router();

const accountRoute = require('./Account.routes')
const accountSettingsRoute = require('./Account-Settings.routes')
const adminRoute = require('./Admin.routes')
const userRoute = require('./Users.routes')
const webhookRoute = require('./Webhook.routes')
const beneficiaryRoute = require('./Beneficiary.routes')
const walletRoute = require('./Wallet.routes')
const dtRoute = require('./DT.routes')
const dt_utilitiesRoute = require('./DT-Utilities.routes')
const transactionRoute = require('./Transaction.routes')
const trustPaymentRoute = require('./Trust-Payment.routes')
const thunesRoute = require('./Thunes.routes')
const instabotRoute = require('./Instabot.routes')
const invitationRoute = require('./Invitation.routes')
const countryRoutes = require('./Country.routes');
const LoginHistoryControllerRoutes = require('./LoginHistory.routes');
const WithdrawalControlllerRoutes = require('./Withdrawal.routes');
const UserkeyRoutes = require('./Userkey.routes')
const NomineeRoutes = require('./Nominee.routes')
const ReportRoutes = require('./Report.routes')
const PaymentAddressRoutes = require('./PaymentAddress.routes')
const CompanyRoutes = require('./Company.routes')
const QuotationRoutes = require('./Quotation.routes')
const NotificationRoutes = require('./Notification.routes')
const CurrencyRoutes = require('./Available-Currency.routes')
const CollectionRoutes = require('./Collection.routes')
const WhitelevelRoutes = require('./Whitelevel.routes')
const WaitlistRoutes = require('./Waitlist.routes')
const NotificationStatusRoutes = require('./NotificationsStatus.routes')
const TransactionNotesRoutes = require('./Transaction-Notes.route')
const PaypalRoutes = require('./Paypal.routes')
const GuestPayRoutes = require('./Guest-Pay.routes')
const userPaymentPreferences = require('./User-Payment-Preference.routes')
const VirtualCardRoutes = require('./Virtual-Card.routes')

routes.use('/thunes', thunesRoute);
routes.use('/dt', dtRoute);
routes.use('/dt-utilities', dt_utilitiesRoute);
routes.use('/transaction', transactionRoute);
routes.use('/trust-payment', trustPaymentRoute);
routes.use('/account', accountRoute);
routes.use('/account-settings', accountSettingsRoute);
routes.use('/admin', adminRoute);
routes.use('/user', userRoute);
routes.use('/webhook', webhookRoute);
routes.use('/beneficiary', beneficiaryRoute);
routes.use('/wallet', walletRoute);
routes.use('/instagram', instabotRoute);
routes.use('/invitation', invitationRoute);
routes.use('/country', countryRoutes);
routes.use('/login', LoginHistoryControllerRoutes);
routes.use('/withdrawal', WithdrawalControlllerRoutes)
routes.use('/userkey', UserkeyRoutes)
routes.use('/nominee', NomineeRoutes)
routes.use('/report', ReportRoutes)
routes.use('/payment-address', PaymentAddressRoutes)
routes.use('/company', CompanyRoutes)
routes.use('/quotation', QuotationRoutes)
routes.use('/notification', NotificationRoutes)
routes.use('/currency', CurrencyRoutes)
routes.use('/collection', CollectionRoutes)
routes.use('/whitelevel', WhitelevelRoutes)
routes.use('/waitlist', WaitlistRoutes)
routes.use('/notifications-status', NotificationStatusRoutes)
routes.use('/transaction-notes', TransactionNotesRoutes)
routes.use('/paypal', PaypalRoutes)
routes.use("/guest-pay", GuestPayRoutes)
routes.use("/user-preferences", userPaymentPreferences)
routes.use("/mastercard", VirtualCardRoutes)

module.exports = routes;