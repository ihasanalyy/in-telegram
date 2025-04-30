const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail')
sgMail.setApiKey(process.env.SENDGRID_API_KEY)

const NotificationsStatus = require('../models/NotificationsStatus.model');

const accountSid = `${process.env.TWILIO_ACCOUNT_SID}`;//'ACd27647d39bbcec466a22096459a14297'
const authToken = `${process.env.TWILIO_AUTH_TOKEN}`;//'932acb397d9d66f41d076f5a2b873143'
const client = require('twilio')(accountSid, authToken);

// const sendEmail = async (options) => {

//   const message = {
//     from: `${process.env.FROM_NAME} <${process.env.FROM_EMAIL}>`,
//     to: options.email,
//     subject: options.subject,
//     text: options.message,
//   };
//   const info = await sgMail.send(message);

//   console.log('Message sent: %s', info.messageId);
// };

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

  console.log('Message sent: %s', options.email, info);
};

async function sendMailsExport(to, message, subject, templateId, dynamicData) {
  try {
    sgMail.setApiKey('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');

    const msg = {
      personalizations: [
        {
          to: [
            {
              email: to
            }
          ],
          dynamic_template_data: dynamicData,
        }
      ],
      from: {
        email: 'noreply@insta-pay.ch',
        name: 'InstaPay'
      },
      tracking_settings: {
        click_tracking: {
          enable: true,
          enable_text: true
        },
        open_tracking: {
          enable: true
        }
      },
      template_id: templateId
    }

    let send = await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(error.toString());
    return false;
  }
}

async function sendMailsHelper(to, message, subject, templateId, dynamicData) {
  try {
    sgMail.setApiKey('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');

    const msg = {
      personalizations: [
        {
          to: [
            {
              email: to
            }
          ],
          dynamic_template_data: dynamicData,
        }
      ],
      from: {
        email: 'noreply@insta-pay.ch',
        name: 'InstaPay'
      },
      tracking_settings: {
        click_tracking: {
          enable: true,
          enable_text: true
        },
        open_tracking: {
          enable: true
        }
      },
      template_id: templateId
    }

    let send = await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error(error.toString());
    return false;
  }
}

async function sendPhoneMsg(phoneData) {
  console.log(" i have ran")

  try {
    phoneData.to.replace('+', '')
    to = '+' + phoneData.to;
    let obj = {
      body: phoneData.message,
      messagingServiceSid: process.env.TWILIO_SERVICE_ID,
      to: to
    }
    // console.log(obj);
    let send = await client.messages.create(obj)
    console.log('SMS sent successfully');
    return true;
  } catch (error) {
    console.error(error.toString());
    return false;
  }
}

const sendPushMsg = async () => {

}
const sendNotifications = async (account_id, notificationType, details) => {
  try {
    const notificationStatus = await NotificationsStatus.findOne({
      account: account_id,
    });

    if (!notificationStatus || !notificationStatus[notificationType]) {
      console.log(`Notifications are not active for ${notificationType} for account ${account_id}`);
      return;
    }

    const { email, phone, push } = notificationStatus[notificationType];

    const { toEmail, message, subject, templateId, phoneNumber, phoneMessage, dynamicData } = details

    const phoneData = {
      to: phoneNumber,
      message: phoneMessage
    }

    // console.log(email, phone, push, notificationStatus, toEmail, message, subject)

    const options = {
      email: toEmail?.toLowerCase(),
      message,
      subject,
    }

    if (email) {
      // sendEmail(options);
      sendMailsHelper(toEmail, message, subject, templateId, dynamicData)
      // sendMails(toEmail, templateId, dynamic_template_data)
    }

    if (phone) {
      sendPhoneMsg(phoneData);
    }

    if (push) {
      sendPushMsg();
    }

    console.log(`Notifications sent successfully for ${notificationType} to account ${account_id}`);
  } catch (err) {
    console.error('Error', err);
  }
};

module.exports = { sendEmail, sendNotifications, sendMailsExport };
