const Account = require("../models/Account.model");
const Nominee = require("../models/Nominee.model");
const AWS = require("aws-sdk");
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3();
const multer = require("multer");
const fs = require('fs');
const path = require('path');
const storage = multer.memoryStorage();
module.exports.uploadCheck = multer({ storage: storage });

const { encryption, decryption } = require("../configurations/Encryption");
const {
  sendTemplate,
  instaCodeVerification,
} = require("./InstaChatbot.controller");
// const { sendNotifications } = require('../utils/sendEmail');

function updateLanguages(translationsFile, languagesFile) {
  // Read translations file
  const translations = JSON.parse(fs.readFileSync(translationsFile, 'utf8'));

  // Read languages file
  let languages = JSON.parse(fs.readFileSync(languagesFile, 'utf8'));

  // Iterate through translations
  for (let langCode in translations) {
    if (translations.hasOwnProperty(langCode)) {
      const translation = translations[langCode];

      // Check if the language exists in the languages file
      if (languages.hasOwnProperty(langCode)) {
        const language = languages[langCode];

        // Update language object with translations
        for (let key in translation) {
          if (translation.hasOwnProperty(key)) {
            language[key] = translation[key];
          }
        }

        // Update languages object
        languages[langCode] = language;
      } else {
        // If language doesn't exist, add it
        languages[langCode] = translation;
      }
    }
  }

  // Write updated languages back to languages file
  fs.writeFileSync(languagesFile, JSON.stringify(languages, null, 2));
}

const readFilesFromDirectory = (directoryPath) => {
  return new Promise((resolve, reject) => {
    fs.readdir(directoryPath, (err, files) => {
      if (err) {
        reject(err);
      } else {
        resolve(files);
      }
    });
  });
};

const uploadImagesToS3 = async (directoryPath) => {
  try {
    const files = await readFilesFromDirectory(directoryPath);

    const uploadPromises = files.map(async (fileName) => {
      const filePath = path.join(directoryPath, fileName);
      const fileContent = fs.readFileSync(filePath);
      const bucketName = process.env.AWS_BUCKET_NAME;

      const params = {
        Bucket: bucketName,
        Key: `telegram_bot_images/${fileName}`,
        Body: fileContent,
      };

      const uploadResult = await s3.upload(params).promise();

      if (uploadResult?.Key) {
        return {
          key: uploadResult.Key,
          file_link: uploadResult.Location,
          ETag: uploadResult.ETag,
          status: "uploaded",
        };
      }
      return null;
    });

    const uploadedImages = await Promise.all(uploadPromises);
    return uploadedImages.filter((image) => image !== null);
  } catch (error) {
    console.error("Error uploading images to S3:", error);
    throw error;
  }
};

const deleteImagesFromS3 = async (images) => {
  try {
    const bucketName = process.env.AWS_BUCKET_NAME;

    const deletePromises = images.map(async (image) => {
      const params = {
        Bucket: bucketName,
        Key: image.key, // Use the key from the uploaded images list
      };

      await s3.deleteObject(params).promise();
      console.log(`Deleted: ${image.key}`);
    });

    await Promise.all(deletePromises);
    console.log("All images have been deleted successfully.");
  } catch (error) {
    console.error("Error deleting images from S3:", error);
    throw error;
  }
};

module.exports.addNominee = async (req, res) => {
  try {
    // let data = await decryption(req.body.data)
    let account_id = req.params.account_id;
    const full_name = req.body.full_name;
    const dob = req.body.dob;
    const gender = req.body.gender;
    const address = req.body.address;
    const relationship = req.body.relationship;
    const contact = req.body.contact;
    const file = req.file;

    if (
      !full_name ||
      !dob ||
      !gender ||
      !address ||
      !relationship ||
      !contact ||
      !account_id
    ) {
      let error = await encryption({
        status: false,
        message: "Required fields are missing",
      });
      return res.status(400).send(error);
    }

    if (!req.file || req.file <= 0) {
      let error = await encryption({
        status: false,
        message: "Please provide an image.",
      });
      return res.status(400).send(error);
    }

    const existingNominee = await Nominee.findOne({ user: account_id });
    if (existingNominee) {
      let error = await encryption({
        status: false,
        message: "Nominee already exists for this account.",
      });
      return res.status(400).send(error);
    }
    // new Date('2012-12-12')
    let nomineeObj = {
      full_name,
      dob,
      gender,
      address,
      relationship,
      contact,
      user: account_id,
    };

    Account.findOne({ $and: [{ _id: account_id }, { active: true }] })
      .then(async (account) => {
        if (account) {
          Nominee.findOne({ $and: [{ user: account_id }, { full_name }] })
            .then(async (foundNominee) => {
              if (!foundNominee) {
                const data = file;
                if (data.mimetype.split("/")[0] === "image") {
                  const bucketName = process.env.AWS_BUCKET_NAME;
                  const params = {
                    Bucket: bucketName,
                    Key: `nominees/${account._id}/${data.originalname}`,
                    Body: data.buffer,
                  };
                  s3.upload(params, async (err, data) => {
                    if (err) {
                      let error = await encryption({
                        status: false,
                        message: "Something went wrong while uploading image.",
                      });
                      res.status(400).send(error);
                    } else {
                      if (data?.key) {
                        nomineeObj.picture = {
                          key: data.Key,
                          url: data.Location,
                          ETag: data.ETag,
                        };
                        Nominee.create(nomineeObj)
                          .then(async (createdNominee) => {
                            let ciphertext = await encryption({
                              status: true,
                              message: "Nominee Added successfully.",
                              nominee: createdNominee,
                            });
                            res.status(200).send(ciphertext);
                          })
                          .catch(async (err) => {
                            let error = await encryption({
                              status: false,
                              message:
                                "Something went wrong while adding a nominee.",
                            });
                            res.status(400).send(error);
                          });
                      }
                    }
                  });
                } else {
                  let error = await encryption({
                    status: false,
                    message: "Please provide a image not other type documents.",
                  });
                  res.status(400).send(error);
                }
              } else {
                let error = await encryption({
                  status: false,
                  message: "Nominee already exists.",
                });
                res.status(400).send(error);
              }
            })
            .catch(async (err) => {
              let error = await encryption({
                status: false,
                message: "Something went wrong while adding a nominee.",
              });
              res.status(400).send(error);
            });
        } else {
          let error = await encryption({
            status: false,
            message: "Account not found!",
          });
          res.status(404).send(error);
        }
      })
      .catch(async (err) => {
        let error = await encryption({
          status: false,
          message: "Something went wrong while getting account details.",
        });
        res.status(400).send(error);
      });
  } catch (err) {
    let error = await encryption({
      status: false,
      message: "Internal server error!",
    });
    res.status(500).send(error);
  }
};

module.exports.updateNominee = async (req, res) => {
  try {
    let account_id = req.params.account_id;
    const full_name = req.body.full_name;
    const dob = req.body.dob;
    const gender = req.body.gender;
    const address = req.body.address;
    const relationship = req.body.relationship;
    const contact = req.body.contact;
    const file = req.file;

    if (
      !full_name ||
      !dob ||
      !gender ||
      !address ||
      !relationship ||
      !contact ||
      !account_id
    ) {
      let error = await encryption({
        status: false,
        message: "Required fields are missing",
      });
      return res.status(400).send(error);
    }

    let nominee = await Nominee.findOne({ user: account_id });

    if (!nominee) {
      nominee = new Nominee({
        full_name,
        dob,
        gender,
        address,
        relationship,
        contact,
        user: account_id,
      });
    }

    nominee.full_name = full_name;
    nominee.dob = dob;
    nominee.gender = gender;
    nominee.address = address;
    nominee.relationship = relationship;
    nominee.contact = contact;

    if (file && file.size > 0 && file.mimetype.split("/")[0] === "image") {
      const bucketName = process.env.AWS_BUCKET_NAME;
      await s3
        .deleteObject({ Bucket: bucketName, Key: nominee.picture.key })
        .promise();

      const params = {
        Bucket: bucketName,
        Key: `nominees/${account_id}/${file.originalname}`,
        Body: file.buffer,
      };

      s3.upload(params, async (err, data) => {
        if (err) {
          console.error("Error uploading file:", err);
          let error = await encryption({
            status: false,
            message: "Something went wrong while uploading image.",
          });
          res.status(400).send(error);
        } else {
          console.log("File uploaded successfully. File URL:", data);
          nominee.picture = {
            key: data.Key,
            url: data.Location,
            ETag: data.ETag,
          };

          nominee
            .save()
            .then(async (updatedNominee) => {
              let ciphertext = await encryption({
                status: true,
                message: "Nominee updated successfully.",
                nominee: updatedNominee,
              });
              res.status(200).send(ciphertext);
            })
            .catch(async (err) => {
              let error = await encryption({
                status: false,
                message: "Something went wrong while updating the nominee.",
              });
              res.status(400).send(error);
            });
        }
      });
    } else {
      nominee
        .save()
        .then(async (updatedNominee) => {
          let ciphertext = await encryption({
            status: true,
            message: "Nominee updated successfully.",
            nominee: updatedNominee,
          });
          res.status(200).send(ciphertext);
        })
        .catch(async (err) => {
          let error = await encryption({
            status: false,
            message: "Something went wrong while updating the nominee.",
          });
          res.status(400).send(error);
        });
    }
  } catch (err) {
    console.log(err);
    let error = await encryption({
      status: false,
      message: "Internal server error!",
    });
    res.status(500).send(error);
  }
};

module.exports.deleteNominee = async (req, res) => {
  try {
    let account_id = req.params.account_id;

    if (!account_id) {
      let error = await encryption({
        status: false,
        message: "Required fields are missing!",
      });
      return res.status(404).send(error);
    }

    const account = await Account.findOne({ _id: account_id, active: true });

    if (!account) {
      let error = await encryption({
        status: false,
        message: "Account not found!",
      });
      return res.status(404).send(error);
    }

    const deletedNominee = await Nominee.findOneAndDelete({ user: account_id });

    if (deletedNominee) {
      const bucketName = process.env.AWS_BUCKET_NAME;
      await s3
        .deleteObject({ Bucket: bucketName, Key: deletedNominee.picture.key })
        .promise();
      let ciphertext = await encryption({
        status: true,
        message: "Nominee deleted successfully.",
      });
      res.status(200).send(ciphertext);
    } else {
      let error = await encryption({
        status: false,
        message: "Nominee not found for this account.",
      });
      res.status(404).send(error);
    }
  } catch (err) {
    console.log(err);
    let error = await encryption({
      status: false,
      message: "Internal server error!",
    });
    res.status(500).send(error);
  }
};

// const directoryPath = "C:/Users/sarfa/OneDrive/Desktop/New folder";
const directoryPath = "D:/New Downloads/telegram pictures bot";

// uploadImagesToS3(directoryPath)
//   .then((uploadedImages) => {
//     console.log("Uploaded images:", uploadedImages);
//   })
//   .catch((error) => {
//     console.error("Error:", error);
//   });

module.exports.getNomineeDetails = async (req, res) => {
  // const sender = {
  //     toEmail: "sarfarazahmed1012@gmail.com",
  //     phoneNumber: "923212633637",
  //     instaUsername: "insta_123",
  //     message: "Instapay - Transaction received",
  //     subject: "Hi, your have received a transaction of 10.00 USD from Sarfaraz Ahmed in your instapay account.",
  //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
  //     phoneMessage: "Transaction recieved of 4500 USD"
  // }
  // const receiver = {
  //     toEmail: "testing@gmail.com",
  //     phoneNumber: "923480288071",
  //     instaUsername: "insta_123",
  //     message: "Instapay - Transaction sent",
  //     subject: "Hi, your have sent a transaction of 10.00 USD from Sarfaraz Ahmed in your instapay account.",
  //     templateId: "d-2d5f929ed89847d693ab15621b95890f",
  //     phoneMessage: "Transaction recieved of 4500 USD"
  // }
  // sendNotifications('64d4c2dd8e363d8c47ea0bb5', 'add_funds', sender)
  // sendNotifications('64d4c2dd8e363d8c47ea0bb5', 'add_funds', receiver)
  // const data = {
  //   sender: { id: "7224755007608123" },
  //   recipient: { id: "17841464203712763" },
  //   timestamp: 1708523737230,
  //   postback: {
  //     title: "Submit code",
  //     payload: "submit_connect_code",
  //     mid: "aWdfZAG1faXRlbToxOklHTWVzc2FnZAUlEOjE3ODQxNDY0MjAzNzEyNzYzOjM0MDI4MjM2Njg0MTcxMDMwMTI0NDI1OTExMzM5MzgxODE0NTE1NDozMTUxNjcwMDEyNDU0ODE1NzAwNTc2NjEwNzA5NTYyOTgyNAZDZD",
  //   },
  // };
  // const templatePayload = {
  //   template_type: "generic",
  //   elements: [
  //     {
  //       title:
  //         "Congratulations Sarfaraz, your instagram has been connected with InstaPay",
  //       subtitle: "Step 1️⃣",
  //       image_url:
  //         "https://instapay-user.vercel.app/static/media/chips_in_left.3898cd344de2a6cfda6c.png",
  //     },
  //   ],
  // };
  // await sendTemplate(data, "17841464203712763", templatePayload)
  try {


    // updateLanguages('C:/Users/sarfa/OneDrive/Desktop/translation.json', 'E:/toil/techventure/instapay-backend/new-cloned-1/ip-dev/utils/languages/languages.json');

    const account_id = req.params.account_id;

    if (!account_id) {
      let error = await encryption({
        status: false,
        message: "Required fields are missing!",
      });
      return res.status(404).send(error);
    }

    const account = await Account.findOne({ _id: account_id, active: true });

    if (!account) {
      let error = await encryption({
        status: false,
        message: "Account not found!",
      });
      return res.status(404).send(error);
    }

    const nominee = await Nominee.findOne({ user: account_id });

    if (nominee) {
      let ciphertext = await encryption({
        status: true,
        message: "Nominee details retrieved successfully.",
        nomineeDetails: nominee,
      });
      res.status(200).send(ciphertext);
    } else {
      let error = await encryption({
        status: false,
        message: "Nominee not found for this account.",
      });
      res.status(404).send(error);
    }
  } catch (err) {
    console.log(err);
    let error = await encryption({
      status: false,
      message: "Internal server error!",
    });
    res.status(500).send(error);
  }
};
