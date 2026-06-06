// pm2 process config for Zonic (NestJS).
// Usage on server:  pm2 start ecosystem.config.js --env production
module.exports = {
  apps: [
    {
      name: 'zonic-nest',
      script: 'dist/main.js',
      instances: 1, // WebSocket (Socket.IO) — keep single instance unless you add a Redis adapter
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      // Env values are read from the .env file in the project root (ConfigModule),
      // so you do NOT need to duplicate DB/JWT secrets here.
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
    },
  ],
};
