const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");   

const UPLOAD_ROOT =
    process.env.UPLOAD_DIR ||
    path.join(process.cwd(), "uploads", "claims");

if (!fs.existsSync(UPLOAD_ROOT)) {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}
const ALLOWED_MIME_TYPES = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; 
const MAX_FILES_PER_REQUEST = 10;

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, UPLOAD_ROOT);
    },

    filename: (req, file, cb) => {

        const uniqueName =
            crypto.randomUUID() +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }

});

const fileFilter = (req, file, cb) => {

    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {

        return cb(
            new Error(`Unsupported file type: ${file.mimetype}`),
            false
        );
    }

    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: MAX_FILES_PER_REQUEST
    }
});

module.exports = {
    upload,
    UPLOAD_ROOT
};
