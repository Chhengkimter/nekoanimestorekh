// server/src/services/ImageUploader.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME, R2_PUBLIC_URL } = require('../config/env');

// Connect to R2
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId:     R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY
  }
});

class ImageUploader {

  // Upload image → returns public URL
  async upload(file) {
    const fileName = `products/${Date.now()}-${file.originalname}`;

    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET_NAME,
      Key:         fileName,
      Body:        file.buffer,
      ContentType: file.mimetype
    }));

    // Return the public URL to save in database
    return `${R2_PUBLIC_URL}/${fileName}`;
  }

  // Delete image by its URL
  async delete(imageUrl) {
    const fileName = imageUrl.replace(`${R2_PUBLIC_URL}/`, '');

    await r2.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key:    fileName
    }));
  }
}

module.exports = new ImageUploader();