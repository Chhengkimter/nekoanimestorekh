require('dotenv').config();
console.log('DB_URL loaded:', process.env.DB_URL ? 'YES' : 'NO - CHECK YOUR .env FILE');

const app = require('./app');
const { PORT } = require('./src/config/env');

const port = PORT || 3000;

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});