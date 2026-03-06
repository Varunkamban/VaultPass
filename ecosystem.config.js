// pm2 process manager config — run with: pm2 start ecosystem.config.js
// Install pm2 globally once: npm install -g pm2
// Useful commands:
//   pm2 start ecosystem.config.js   → start VaultPass
//   pm2 status                       → check running processes
//   pm2 logs vaultpass               → live logs
//   pm2 restart vaultpass            → restart after code change
//   pm2 stop vaultpass               → stop the server
//   pm2 save && pm2 startup          → auto-start on system reboot

module.exports = {
  apps: [
    {
      name: 'vaultpass',
      script: './backend/dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
      // Restart on crash, up to 10 times in 60 seconds
      max_restarts: 10,
      min_uptime: '10s',
      // Log files
      out_file: './logs/vaultpass-out.log',
      error_file: './logs/vaultpass-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
