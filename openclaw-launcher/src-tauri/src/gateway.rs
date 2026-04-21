use std::sync::Arc;
use std::io::Write;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command as TokioCommand;
use std::process::Stdio;
use std::path::PathBuf;
use std::env;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Default)]
pub struct GatewayState {
    pid: Option<u32>,
}

pub type SharedGatewayState = Arc<std::sync::Mutex<GatewayState>>;

#[derive(Clone)]
struct LogEntry {
    timestamp: u64,
    text: String,
    level: String,
}

static GATEWAY_LOGS: once_cell::sync::Lazy<Arc<std::sync::RwLock<Vec<LogEntry>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(std::sync::RwLock::new(Vec::new())));

fn get_launcher_log_path() -> Option<std::path::PathBuf> {
    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        let log_dir = PathBuf::from(local_app_data)
            .join("com.openclaw.launcher")
            .join("logs");
        if log_dir.exists() || std::fs::create_dir_all(&log_dir).is_ok() {
            return Some(log_dir.join("launcher.log"));
        }
    }
    None
}

pub fn add_gateway_log(line: &str) {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let level = classify_log_level(line);

    if let Ok(mut logs) = GATEWAY_LOGS.write() {
        logs.push(LogEntry { timestamp: timestamp as u64, text: line.to_string(), level: level.to_string() });
        if logs.len() > 1000 {
            logs.remove(0);
        }
    }

    if let Some(log_path) = get_launcher_log_path() {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "[{}] [GW] {}", timestamp, line);
        }
    }
}

pub fn get_gateway_logs(since: u64) -> Vec<String> {
    if let Ok(logs) = GATEWAY_LOGS.read() {
        logs.iter()
            .filter(|entry| entry.timestamp > since)
            .map(|entry| {
                serde_json::json!({
                    "timestamp": entry.timestamp,
                    "text": entry.text,
                    "level": entry.level
                }).to_string()
            })
            .collect()
    } else {
        vec![]
    }
}

pub fn clear_gateway_logs() {
    if let Ok(mut logs) = GATEWAY_LOGS.write() {
        logs.clear();
    }
}

pub fn resolve_openclaw_path() -> Option<String> {
    if let Ok(custom) = std::env::var("OPENCLAW_BIN") {
        if std::path::Path::new(&custom).exists() {
            return Some(custom);
        }
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("cmd")
            .args(["/C", "npm", "root", "-g"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            if output.status.success() {
                let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let openclaw_mjs = format!("{}\\openclaw\\openclaw.mjs", root);
                if std::path::Path::new(&openclaw_mjs).exists() {
                    return Some(openclaw_mjs);
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("npm")
            .args(["root", "-g"])
            .output()
        {
            if output.status.success() {
                let root = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let openclaw_mjs = format!("{}/openclaw/openclaw.mjs", root);
                if std::path::Path::new(&openclaw_mjs).exists() {
                    return Some(openclaw_mjs);
                }
            }
        }
    }

    None
}

pub fn is_gateway_running() -> bool {
    #[cfg(target_os = "windows")]
    {
        if let Ok(output) = std::process::Command::new("wmic")
            .args([
                "process", "where",
                "name='node.exe' and commandline like '%openclaw%gateway%'",
                "get", "processid"
            ])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
        {
            let output_str = String::from_utf8_lossy(&output.stdout);
            let lines: Vec<&str> = output_str.lines().filter(|l| !l.trim().is_empty()).collect();
            return lines.len() > 1;
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("pgrep")
            .args(["-f", "openclaw.*gateway"])
            .output()
        {
            return output.status.success();
        }
    }

    false
}

pub fn classify_log_level(line: &str) -> &'static str {
    let lower = line.to_lowercase();
    if lower.contains("[err]") || lower.contains("error") || lower.contains("failed") {
        "error"
    } else if lower.contains("[warn]") || lower.contains("warn") {
        "warn"
    } else if lower.contains("success") || lower.contains("started") || lower.contains("listening") {
        "success"
    } else {
        "info"
    }
}

pub fn clear_device_auth_cache() {
    let path = std::env::var("USERPROFILE")
        .map(|p| PathBuf::from(p).join(".openclaw/identity/device-auth.json"))
        .ok();

    if let Some(p) = path {
        if p.exists() {
            match std::fs::remove_file(&p) {
                Ok(_) => add_gateway_log(&format!("Cleared device auth cache: {:?}", p)),
                Err(e) => add_gateway_log(&format!("[WARN] Failed to clear device auth cache: {}", e)),
            }
        }
    }
}

#[tauri::command]
pub fn clear_device_auth() -> Result<String, String> {
    clear_device_auth_cache();
    Ok("Device auth cache cleared".to_string())
}

#[cfg(target_os = "windows")]
pub fn kill_all_gateway_processes() {
    let output = std::process::Command::new("wmic")
        .args([
            "process",
            "where",
            "name='node.exe' and commandline like '%openclaw%gateway%'",
            "call",
            "terminate"
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    if output.is_err() {
        return;
    }

    let _ = std::process::Command::new("cmd")
        .args(["/C", "del /F /Q \"%TEMP%\\openclaw_gateway_*.pid\" 2>nul"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    std::thread::sleep(std::time::Duration::from_millis(500));
}

#[cfg(not(target_os = "windows"))]
pub fn kill_all_gateway_processes() {
    let _ = std::process::Command::new("pkill")
        .args(["-f", "openclaw.*gateway"])
        .output();
    
    std::thread::sleep(std::time::Duration::from_millis(500));
}

#[tauri::command]
pub async fn start_gateway(
    state: tauri::State<'_, SharedGatewayState>,
) -> Result<String, String> {
    {
        let guard = state.lock().map_err(|e| e.to_string())?;
        if guard.pid.is_some() {
            return Err("Gateway already running".into());
        }
    }

    kill_all_gateway_processes();
    clear_gateway_logs();
    add_gateway_log("=== Starting Gateway ===");

    let openclaw_path = resolve_openclaw_path().ok_or("Cannot find openclaw")?;
    add_gateway_log(&format!("OpenClaw path: {}", openclaw_path));

    let set_auth = TokioCommand::new("openclaw")
        .args(["config", "set", "gateway.auth.mode", "none"])
        .output()
        .await;
    if let Ok(output) = set_auth {
        if output.status.success() {
            add_gateway_log("Gateway auth mode set to none");
        }
    }

    let mut cmd = TokioCommand::new("node");
    cmd.args([&openclaw_path, "gateway", "run", "--allow-unconfigured"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn().map_err(|e| {
        add_gateway_log(&format!("[ERR] Failed to start: {}", e));
        format!("Failed to start: {}", e)
    })?;

    let pid = child.id();
    add_gateway_log(&format!("Gateway started (PID: {:?})", pid));
    
    {
        let mut guard = state.lock().map_err(|e| e.to_string())?;
        guard.pid = pid;
    }

    let stdout = child.stdout.take().ok_or("No stdout")?;
    let stderr = child.stderr.take().ok_or("No stderr")?;

    tokio::spawn(async move {
        let reader = BufReader::new(stdout);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            add_gateway_log(&line);
        }
    });

    tokio::spawn(async move {
        let reader = BufReader::new(stderr);
        let mut lines = reader.lines();
        while let Ok(Some(line)) = lines.next_line().await {
            add_gateway_log(&format!("[ERR] {}", line));
        }
    });

    let state_inner = state.inner().clone();
    tokio::spawn(async move {
        let _ = child.wait().await;
        add_gateway_log("Gateway process exited");
        if let Ok(mut guard) = state_inner.lock() {
            guard.pid = None;
        }
    });

    Ok(format!("Gateway started (PID: {:?})", pid))
}

#[tauri::command]
pub async fn stop_gateway(
    state: tauri::State<'_, SharedGatewayState>,
) -> Result<String, String> {
    add_gateway_log("=== Stopping Gateway ===");

    let state_inner = state.inner().clone();
    tokio::task::spawn_blocking(move || {
        kill_all_gateway_processes();
        if let Ok(mut guard) = state_inner.lock() {
            guard.pid = None;
        }
    }).await.map_err(|e| e.to_string())?;

    add_gateway_log("Gateway stopped");

    Ok("Gateway stopped".into())
}

#[tauri::command]
pub async fn gateway_status(
    state: tauri::State<'_, SharedGatewayState>,
) -> Result<bool, String> {
    let guard = state.lock().map_err(|e| e.to_string())?;
    Ok(guard.pid.is_some())
}
