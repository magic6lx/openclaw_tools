module.exports = {
  apps: [
    {
      name: 'openclaw-server',
      script: 'src/index.js',
      cwd: '/opt/openclaw_tool_server/server',
      instances: 1,
      exec_mode: 'fork',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      merge_logs: true,
      watch: false,
      max_memory_restart: '500M',
      autorestart: true
    }
  ]
};
