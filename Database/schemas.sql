-- paste this into your neko_database.sql first

CREATE TABLE users (
  user_id       SERIAL PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone         VARCHAR(20),
  created_at    TIMESTAMP DEFAULT NOW(),
  last_login    TIMESTAMP
);

CREATE TABLE admins (
  admin_id      SERIAL PRIMARY KEY,
  first_name    VARCHAR(100) NOT NULL,
  last_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  admin_role    VARCHAR(20) DEFAULT 'staff'
                CHECK (admin_role IN ('superadmin', 'staff')),
  created_at    TIMESTAMP DEFAULT NOW(),
  last_login    TIMESTAMP
);

CREATE TABLE addresses (
  address_id    SERIAL PRIMARY KEY,
  user_id       INT NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city          VARCHAR(100) NOT NULL,
  state         VARCHAR(100),
  postal_code   VARCHAR(20),
  country       VARCHAR(100) NOT NULL,
  is_default    BOOLEAN DEFAULT FALSE,

  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);