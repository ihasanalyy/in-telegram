const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../utils/temp')); // Ensure the path is correct
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname); // Get the file extension
        cb(null, file.fieldname + '-' + Date.now() + ext); // Save with original extension
    }
});

const upload = multer({ storage: storage });

function validateFiles(attachments) {
    let images = 0;
    let videos = 0;

    for (const attachment of attachments) {
        if (attachment.mimetype.split("/")[0] === "image") {
            images++;
        } else if (attachment.mimetype.split("/")[0] === "video") {
            videos++;
        }
    }

    const totalAttachments = attachments.length;
    const validCount = images <= 4 && videos <= 1 && totalAttachments <= 5;
    const allImagesAndVideos = attachments.every(att =>
        att.mimetype.split("/")[0] === "image" || att.mimetype.split("/")[0] === "video"
    );

    if (validCount && allImagesAndVideos) {
        return {
            status: true,
            message: "Files are valid"
        };
    } else if (!allImagesAndVideos) {
        return {
            status: false,
            message: "Only images and videos are allowed"
        };
    } else if (totalAttachments > 5) {
        return {
            status: false,
            message: "Only 5 attachments are allowed"
        };
    } else if (images > 4) {
        return {
            status: false,
            message: "Only 4 images are allowed"
        };
    } else if (videos > 1) {
        return {
            status: false,
            message: "Only 1 video is allowed"
        };
    }
}


module.exports = { upload, validateFiles };
