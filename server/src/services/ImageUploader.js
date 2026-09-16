const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
        R2_BUCKET_NAME, R2_PUBLIC_URL } = require('../config/env');

let r2 = null;
if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  try {
    r2 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });
  } catch (err) {
    console.error('Failed to initialize R2 client:', err.message);
  }
}

class ImageUploader {

  // Upload image → returns public URL
  async upload(file) {
    const cleanName = (file.originalname || 'upload.png').replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `products/${Date.now()}-${cleanName}`;

    if (r2 && R2_BUCKET_NAME && R2_PUBLIC_URL) {
      try {
        await r2.send(new PutObjectCommand({
          Bucket:      R2_BUCKET_NAME,
          Key:         fileName,
          Body:        file.buffer,
          ContentType: file.mimetype || 'image/png'
        }));
        return `${R2_PUBLIC_URL}/${fileName}`;
      } catch (err) {
        console.error('R2 upload failed, saving to local disk:', err.message);
      }
    }

    // Fallback: save to server/uploads
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const safeLocalName = `${Date.now()}-${cleanName}`;
    const filePath = path.join(uploadsDir, safeLocalName);
    fs.writeFileSync(filePath, file.buffer);
    return `/uploads/${safeLocalName}`;
  }

  // Delete image by its URL
  async delete(imageUrl) {
    if (!imageUrl) return;

    if (r2 && R2_BUCKET_NAME && R2_PUBLIC_URL && imageUrl.includes(R2_PUBLIC_URL)) {
      try {
        const fileName = imageUrl.replace(`${R2_PUBLIC_URL}/`, '');
        await r2.send(new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key:    fileName
        }));
        return;
      } catch (err) {
        console.error('R2 delete failed:', err.message);
      }
    }

    if (imageUrl.startsWith('/uploads/')) {
      const localPath = path.join(__dirname, '../../', imageUrl);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
      }
    }
  }
}

module.exports = new ImageUploader();