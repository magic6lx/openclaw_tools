module.exports = {
  apps: [
    {
      name: 'openclaw-backend',
      script: 'src/index.js',
      cwd: '/opt/openclaw_tool_server/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      watch: false,
      max_memory_restart: '500M',
      autorestart: true,
      restart_delay: 4000
    }
  ]
};
