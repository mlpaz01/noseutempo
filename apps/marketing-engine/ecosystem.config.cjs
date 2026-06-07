module.exports = {
  apps: [
    {
      name: "marketing-engine",
      script: "dist/index.js",
      cwd: "/var/www/nomeutempo-marketing-engine",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3010,
      },
      env_file: "/var/www/nomeutempo-marketing-engine/.env",
      out_file: "/var/log/pm2/marketing-engine-out.log",
      error_file: "/var/log/pm2/marketing-engine-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
