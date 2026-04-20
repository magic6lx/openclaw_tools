const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const logFile = path.join(process.env.TEMP || '/tmp', 'openclaw_gateway.log');
const openclawBin = path.join(process.env.APPDATA || '', 'npm', 'openclaw.cmd');

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    fs.appendFileSync(logFile, line + '\n');
}

log('正在启动 OpenClaw Gateway...');

const child = spawn('cmd', ['/C', `"${openclawBin}" gateway start`], {
    cwd: process.env.USERPROFILE || process.env.HOME,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false
});

let stdout = '';
let stderr = '';

child.stdout.on('data', (data) => { stdout += data.toString(); });
child.stderr.on('data', (data) => { stderr += data.toString(); });

const timer = setTimeout(() => {
    child.kill();
    log('启动超时，已终止');
    process.exit(1);
}, 30000);

child.on('close', (code) => {
    clearTimeout(timer);
    if (code === 0) {
        log(`Gateway 启动成功: ${stdout.trim()}`);
    } else {
        if (stdout.trim()) log(stdout.trim());
        if (stderr.trim()) log(`错误: ${stderr.trim()}`);
        if (!stdout.trim() && !stderr.trim()) log(`启动失败，退出码: ${code}`);
    }
});

child.on('error', (err) => {
    clearTimeout(timer);
    log(`启动异常: ${err.message}`);
});
