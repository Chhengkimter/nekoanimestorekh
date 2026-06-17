require('dotenv').config();

module.exports = {
  PORT:                 process.env.PORT,
  DB_URL:               process.env.DB_URL,
  JWT_SECRET:           process.env.JWT_SECRET,
  JWT_EXPIRES_IN:       process.env.JWT_EXPIRES_IN,
  R2_ACCOUNT_ID:        process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID:     process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_BUCKET_NAME:       process.env.R2_BUCKET_NAME,
  R2_PUBLIC_URL:        process.env.R2_PUBLIC_URL,
};