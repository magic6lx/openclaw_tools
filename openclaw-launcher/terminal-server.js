const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
module.paths.unshift(path.join(__dirname, 'node_modules'));
const WebSocket = require('ws');

const WS_PORT = parseInt(process.env.TERMINAL_WS_PORT || '18791', 10);
const SHELL = os.platform() === 'win32' ? 'powershell.exe' : '/bin/bash';
const COLS = 120;
const ROWS = 30;

const logFile = path.join(os.tmpdir(), 'openclaw_gateway.log');

function log(msg) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${msg}`;
    try {
        require('fs').appendFileSync(logFile, line + '\n');
    } catch (e) {}
}

log(`Terminal server starting on ws://127.0.0.1:${WS_PORT}`);

const wss = new WebSocket.Server({ port: WS_PORT, host: '127.0.0.1' });

const clients = new Set();
let currentProcess = null;
let usePty = false;

function startShell() {
    if (currentProcess) {
        try {
            if (usePty && currentProcess.kill) {
                currentProcess.kill();
            } else if (currentProcess.pid) {
                process.kill(currentProcess.pid, 'SIGTERM');
            }
        } catch (e) {}
    }

    try {
        const pty = require('node-pty');
        usePty = true;
        
        currentProcess = pty.spawn(SHELL, [], {
            name: 'xterm-256color',
            cols: COLS,
            rows: ROWS,
            cwd: os.homedir(),
            env: { ...process.env, TERM: 'xterm-256color' }
        });

        log(`PTY shell started, PID: ${currentProcess.pid}`);

        currentProcess.onData((data) => {
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'output', data }));
                }
            });
        });

        currentProcess.onExit(({ exitCode }) => {
            log(`PTY shell exited with code ${exitCode}`);
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'exit', code: exitCode }));
                }
            });
            currentProcess = null;
        });

    } catch (e) {
        log(`PTY not available, falling back to spawn: ${e.message}`);
        usePty = false;
        
        currentProcess = spawn(SHELL, [
            '-NoExit',
            '-NoLogo',
            '-ExecutionPolicy', 'Bypass',
            '-Command',
            `$Host.UI.RawUI.BufferSize = New-Object System.Management.Automation.Host.Size(${COLS}, 1000); $Host.UI.RawUI.WindowSize = New-Object System.Management.Automation.Host.Size(${COLS}, ${ROWS}); Write-Host ''`
        ], {
            cwd: os.homedir(),
            env: { 
                ...process.env, 
                TERM: 'xterm-256color'
            },
            shell: false,
            windowsHide: true,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        log(`Spawn shell started, PID: ${currentProcess.pid}`);

        currentProcess.stdout.on('data', (data) => {
            const output = data.toString();
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'output', data: output }));
                }
            });
        });

        currentProcess.stderr.on('data', (data) => {
            const output = data.toString();
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'output', data: output }));
                }
            });
        });

        currentProcess.on('close', (code) => {
            log(`Spawn shell exited with code ${code}`);
            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'exit', code }));
                }
            });
            currentProcess = null;
        });

        currentProcess.on('error', (err) => {
            log(`Spawn shell error: ${err.message}`);
        });
    }
}

startShell();

wss.on('connection', (ws) => {
    log('Client connected');
    clients.add(ws);

    if (currentProcess) {
        ws.send(JSON.stringify({ type: 'output', data: '\x1b[32m已连接到终端服务\x1b[0m\r\n\r\n' }));
    }

    ws.on('message', (data) => {
        if (!currentProcess) return;

        try {
            const msg = JSON.parse(data);
            if (msg.type === 'input') {
                if (usePty) {
                    currentProcess.write(msg.data);
                } else if (currentProcess.stdin && currentProcess.stdin.writable) {
                    currentProcess.stdin.write(msg.data);
                }
            } else if (msg.type === 'command') {
                const cmd = msg.data + '\r\n';
                if (usePty) {
                    currentProcess.write(cmd);
                } else if (currentProcess.stdin && currentProcess.stdin.writable) {
                    currentProcess.stdin.write(cmd);
                }
            } else if (msg.type === 'resize' && usePty) {
                currentProcess.resize(msg.cols || COLS, msg.rows || ROWS);
            }
        } catch (e) {
            if (usePty) {
                currentProcess.write(data.toString());
            } else if (currentProcess.stdin && currentProcess.stdin.writable) {
                currentProcess.stdin.write(data.toString());
            }
        }
    });

    ws.on('close', () => {
        log('Client disconnected');
        clients.delete(ws);
    });

    ws.on('error', (err) => {
        log(`WebSocket error: ${err.message}`);
        clients.delete(ws);
    });
});

wss.on('error', (err) => {
    log(`Server error: ${err.message}`);
});

log(`Terminal server ready`);
