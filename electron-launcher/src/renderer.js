let statusData = null;

async function loadStatus() {
  try {
    const result = await window.electronAPI.checkOpenClaw();
    statusData = result;

    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';

    document.getElementById('platform').textContent = result.platform || 'unknown';
    document.getElementById('username').textContent = result.username || 'unknown';

    const dirEl = document.getElementById('directory');
    if (result.directory) {
      dirEl.textContent = result.directory;
      dirEl.title = result.directory;
    } else {
      dirEl.textContent = '未找到';
    }

    const installedEl = document.getElementById('installed');
    if (result.installed) {
      installedEl.textContent = `已安装 (v${result.version})`;
      installedEl.className = 'value installed';
    } else {
      installedEl.textContent = '未安装';
      installedEl.className = 'value not-installed';
    }

    const gatewayEl = document.getElementById('gateway');
    if (result.gatewayRunning) {
      gatewayEl.textContent = `运行中 (端口 ${result.gatewayPort})`;
      gatewayEl.className = 'value running';
      document.getElementById('btnLaunch').textContent = 'OpenClaw 已在运行';
      document.getElementById('btnLaunch').disabled = true;
    } else if (result.installed) {
      gatewayEl.textContent = '未启动';
      gatewayEl.className = 'value stopped';
      document.getElementById('btnLaunch').textContent = '启动 OpenClaw';
      document.getElementById('btnLaunch').disabled = false;
    } else {
      gatewayEl.textContent = 'N/A';
      gatewayEl.className = 'value stopped';
      document.getElementById('btnLaunch').textContent = 'OpenClaw 未安装';
      document.getElementById('btnLaunch').disabled = true;
    }

  } catch (error) {
    console.error('加载状态失败:', error);
    document.getElementById('loading').innerHTML = `
      <div style="color: #f87171;">加载失败: ${error.message}</div>
    `;
  }
}

async function launchOpenClaw() {
  const btn = document.getElementById('btnLaunch');
  btn.textContent = '正在启动...';
  btn.disabled = true;

  try {
    const result = await window.electronAPI.launchOpenClaw();

    if (result.success) {
      btn.textContent = '已发送启动命令';
      setTimeout(() => {
        loadStatus();
      }, 3000);
    } else {
      btn.textContent = '启动失败: ' + result.error;
      btn.disabled = false;
    }
  } catch (error) {
    btn.textContent = '启动失败: ' + error.message;
    btn.disabled = false;
  }
}

async function refreshStatus() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('content').style.display = 'none';
  await loadStatus();
}

window.electronAPI.onProtocolCommand((data) => {
  console.log('收到协议命令:', data);

  if (data.command === 'check') {
    loadStatus();
  } else if (data.command === 'launch') {
    launchOpenClaw();
  }
});

loadStatus();
