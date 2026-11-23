const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

const goldShopDocumentDirectory = path.resolve(__dirname, '../../uploads/.private/gold-shop-documents');
fs.mkdirSync(goldShopDocumentDirectory, { recursive: true });

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const extensionsByMimeType = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png'
};
const imageMimeTypes = new Set(['image/jpeg', 'image/png']);

const uploadGoldShopDocuments = multer({
  storage: multer.diskStorage({
    destination: goldShopDocumentDirectory,
    filename: (req, file, callback) => {
      const extension = extensionsByMimeType[file.mimetype];
      if (!extension) return callback(new Error('Only PDF, JPG, and PNG documents are supported'));
      return callback(null, `${crypto.randomUUID()}${extension}`);
    }
  }),
  limits: { fileSize: MAX_FILE_SIZE_BYTES, files: 7, fields: 1, fieldSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!Object.hasOwn(extensionsByMimeType, file.mimetype)) {
      callback(new Error('Only PDF, JPG, and PNG documents are supported'));
      return;
    }
    if (file.fieldname === 'profilePhoto' && !imageMimeTypes.has(file.mimetype)) {
      callback(new Error('Profile photo must be a JPG or PNG image'));
      return;
    }
    callback(null, true);
  }
}).fields([
  { name: 'profilePhoto', maxCount: 1 },
  { name: 'aadhaarCard', maxCount: 1 },
  { name: 'gstCertificate', maxCount: 1 },
  { name: 'otherDocuments', maxCount: 4 }
]);

function validateGoldShopDocumentSignature(filePath, mimeType) {
  const header = Buffer.alloc(8);
  const descriptor = fs.openSync(filePath, 'r');
  try {
    const bytesRead = fs.readSync(descriptor, header, 0, header.length, 0);
    const signature = header.subarray(0, bytesRead);
    if (mimeType === 'application/pdf') {
      return signature.length >= 5 && signature.subarray(0, 5).toString() === '%PDF-';
    }
    if (mimeType === 'image/png') {
      return signature.length >= 8
        && signature.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    return mimeType === 'image/jpeg'
      && signature.length >= 3
      && signature[0] === 0xff
      && signature[1] === 0xd8
      && signature[2] === 0xff;
  } finally {
    fs.closeSync(descriptor);
  }
}

function resolveGoldShopDocumentPath(storageKey) {
  if (typeof storageKey !== 'string' || !/^[0-9a-f-]{36}\.(?:pdf|jpg|png)$/i.test(storageKey)) return null;
  const resolved = path.resolve(goldShopDocumentDirectory, storageKey);
  return path.dirname(resolved) === goldShopDocumentDirectory ? resolved : null;
}

async function removeGoldShopDocumentFiles(storageKeys) {
  for (const storageKey of storageKeys) {
    const filePath = resolveGoldShopDocumentPath(storageKey);
    if (!filePath) continue;
    try {
      await fs.promises.unlink(filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
}

function uploadedGoldShopDocumentNames(files) {
  return Object.values(files || {}).flat().map((file) => file.filename);
}

function handleGoldShopDocumentUpload(req, res, next) {
  uploadGoldShopDocuments(req, res, async (error) => {
    if (!error) return next();
    await removeGoldShopDocumentFiles(uploadedGoldShopDocumentNames(req.files)).catch((cleanupError) => {
      console.error('Failed to clean incomplete gold shop document upload:', cleanupError);
    });
    const tooLarge = error.code === 'LIMIT_FILE_SIZE' || error.code === 'LIMIT_FILE_COUNT';
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? 'Gold shop documents exceed the allowed file count or size' : error.message
    });
  });
}

module.exports = {
  MAX_FILE_SIZE_BYTES,
  goldShopDocumentDirectory,
  handleGoldShopDocumentUpload,
  removeGoldShopDocumentFiles,
  resolveGoldShopDocumentPath,
  uploadedGoldShopDocumentNames,
  validateGoldShopDocumentSignature
};
