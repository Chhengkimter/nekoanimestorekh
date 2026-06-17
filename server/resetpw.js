const bcrypt = require('bcrypt');

bcrypt.hash('240407', 10).then(hash => {
  console.log(hash);
});