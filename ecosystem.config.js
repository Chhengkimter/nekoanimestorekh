module.exports = {
  apps: [
    {
      name:         'ecommerce-server',
      script:       'server.js',
      watch:        false,
      instances:    1,
      autorestart:  true,
      env: {
        NODE_ENV: 'production',
        PORT:     3000
      }
    }
  ]
};