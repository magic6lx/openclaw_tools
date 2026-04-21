mod gateway;

use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::io::{Read, Write, BufRead, BufReader};
use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio, Child};
use std::sync::{Arc, RwLock, Mutex};
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::{Manager, Emitter, AppHandle, tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent}, menu::{Menu, MenuItem}};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const LAUNCHER_HTTP_PORT: u16 = 18790;
const GATEWAY_PORTS: &[u16] = &[18789, 18790, 18791, 18792, 18793, 18794, 18795];
const MAX_LOG_LINES: usize = 1000;

static CONSOLE_LOGS: once_cell::sync::Lazy<Arc<RwLock<Vec<String>>>> = once_cell::sync::Lazy::new(|| {
    Arc::new(RwLock::new(Vec::new()))
});

static GATEWAY_PROCESS: once_cell::sync::Lazy<Arc<Mutex<Option<Child>>>> = once_cell::sync::Lazy::new(|| {
    Arc::new(Mutex::new(None))
});

fn add_console_log(line: &str) {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);

    let log_entry = format!("[{}] {}", timestamp, line);

    if let Ok(mut logs) = CONSOLE_LOGS.write() {
        logs.push(log_entry.clone());
        if logs.len() > MAX_LOG_LINES {
            logs.remove(0);
        }
    }

    if let Some(log_path) = get_launcher_log_path() {
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "{}", log_entry);
        }
    }
}

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

fn get_console_logs(since: u64) -> Vec<String> {
    if let Ok(logs) = CONSOLE_LOGS.read() {
        logs.iter()
            .filter(|line| {
                if let Some(ts_str) = line.strip_prefix('[') {
                    if let Some(end) = ts_str.find(']') {
                        if let Ok(ts) = ts_str[..end].parse::<u64>() {
                            return ts > since;
                        }
                    }
                }
                true
            })
            .cloned()
            .collect()
    } else {
        vec![]
    }
}

fn get_server_api_base() -> String {
    let config_paths = if cfg!(target_os = "windows") {
        vec![
            std::env::current_exe().unwrap_or_default().parent().unwrap_or(&std::path::Path::new(".")).join("launcher.conf"),
            std::path::PathBuf::from(&std::env::var("USERPROFILE").unwrap_or_default()).join("launcher.conf"),
        ]
    } else {
        vec![
            std::env::current_exe().unwrap_or_default().parent().unwrap_or(&std::path::Path::new(".")).join("launcher.conf"),
            std::path::PathBuf::from(&std::env::var("HOME").unwrap_or_default()).join("launcher.conf"),
        ]
    };

    for config_path in config_paths {
        if let Ok(content) = std::fs::read_to_string(&config_path) {
            if let Some(line) = content.lines().find(|l| l.starts_with("SERVER_API_BASE=")) {
                return line.trim_start_matches("SERVER_API_BASE=").trim().to_string();
            }
        }
    }

    "http://134.175.18.139:3001".to_string()
}

#[derive(Debug, Serialize, Deserialize)]
struct OpenClawStatus {
    success: bool,
    installed: bool,
    directory: Option<String>,
    version: Option<String>,
    gateway_port: Option<u16>,
    gateway_running: bool,
    platform: String,
    arch: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct LaunchResult {
    success: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct InstallResult {
    success: bool,
    message: String,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct SystemInfo {
    success: bool,
    platform: String,
    arch: String,
    node_version: Option<String>,
    npm_version: Option<String>,
    disk_space_gb: Option<f64>,
    openclaw_installed: bool,
    openclaw_version: Option<String>,
    openclaw_directory: Option<String>,
    gateway_running: bool,
    gateway_port: Option<u16>,
    server_base: String,
}

fn get_node_version() -> Option<String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", "node", "--version"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("node")
        .args(["--version"])
        .output()
        .ok()?;

    String::from_utf8(output.stdout).ok()?.trim().strip_prefix('v').map(|s| s.to_string())
}

fn get_npm_version() -> Option<String> {
    let output = Command::new("cmd")
        .args(["/C", "npm", "--version"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    String::from_utf8(output.stdout).ok()?.trim().to_string().into()
}

fn get_openclaw_npm_version() -> Option<String> {
    let output = Command::new("cmd")
        .args(["/C", "npm", "show", "openclaw", "version"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    if output.status.success() {
        return String::from_utf8(output.stdout).ok()?.trim().to_string().into();
    }
    None
}

fn get_openclaw_version() -> Option<String> {
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", "openclaw", "--version"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("openclaw")
        .args(["--version"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !version.is_empty() {
                    return Some(version);
                }
            }
            None
        }
        Err(_) => None,
    }
}

fn get_openclaw_module_path() -> Option<String> {
    // 获取 npm 全局模块路径
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", "npm", "root", "-g"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("npm")
        .args(["root", "-g"])
        .output();

    let npm_global_path = match output {
        Ok(out) => {
            if out.status.success() {
                Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    };

    if let Some(global_path) = npm_global_path {
        let mjs_path = std::path::PathBuf::from(&global_path)
            .join("openclaw")
            .join("openclaw.mjs");
        
        if mjs_path.exists() {
            return Some(mjs_path.to_string_lossy().to_string());
        }

        // 尝试 openclaw/bin/openclaw.js (旧版本可能使用这种方式)
        let js_path = std::path::PathBuf::from(&global_path)
            .join("openclaw")
            .join("bin")
            .join("openclaw.js");
        
        if js_path.exists() {
            return Some(js_path.to_string_lossy().to_string());
        }
    }

    None
}

fn get_disk_space() -> Option<f64> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(["/C", "for /f \"tokens=3\" %a in ('wmic logicaldisk where \"DeviceID='C:'\" get FreeSpace /value ^| find \"FreeSpace\"') do @echo %a"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if let Ok(bytes) = text.parse::<u64>() {
            return Some(bytes as f64 / 1024.0 / 1024.0 / 1024.0);
        }
        let output2 = Command::new("powershell")
            .args(["-Command", "(Get-PSDrive C).Free / 1GB"])
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .ok()?;
        let text2 = String::from_utf8_lossy(&output2.stdout).trim().to_string();
        text2.parse::<f64>().ok()
    }
    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("df")
            .args(["-BG", "/"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout);
        text.lines()
            .nth(1)?
            .split_whitespace()
            .nth(3)?
            .strip_suffix('G')?
            .parse()
            .ok()
    }
}

fn get_system_info() -> SystemInfo {
    let (installed, directory, version) = check_openclaw_installed();
    let gateway_port = check_gateway_port();
    let server_base = get_server_api_base();

    SystemInfo {
        success: true,
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        node_version: get_node_version(),
        npm_version: None,
        disk_space_gb: get_disk_space(),
        openclaw_installed: installed,
        openclaw_version: version,
        openclaw_directory: directory,
        gateway_running: gateway_port.is_some(),
        gateway_port,
        server_base,
    }
}

fn get_openclaw_directories() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if cfg!(target_os = "windows") {
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            dirs.push(PathBuf::from(&user_profile).join(".openclaw"));
            dirs.push(PathBuf::from(&user_profile).join("AppData").join("Local").join("openclaw"));
            dirs.push(PathBuf::from(&user_profile).join("AppData").join("Roaming").join("openclaw"));
        }
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(&local_app_data).join("openclaw"));
        }
    } else if cfg!(target_os = "macos") {
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(&home).join(".openclaw"));
            dirs.push(PathBuf::from(&home).join("Library").join("Application Support").join("openclaw"));
        }
    } else {
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(&home).join(".openclaw"));
        }
    }

    dirs
}

fn read_openclaw_logs(lines: usize) -> String {
    let mut all_logs = String::new();

    for dir in get_openclaw_directories() {
        let logs_dir = dir.join("logs");
        if logs_dir.exists() && logs_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&logs_dir) {
                let mut log_files: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().extension().map(|ext| ext == "log").unwrap_or(false))
                    .collect();

                log_files.sort_by(|a, b| {
                    b.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                        .cmp(&a.metadata().and_then(|m| m.modified()).unwrap_or(std::time::SystemTime::UNIX_EPOCH))
                });

                for log_file in log_files.iter().take(1) {
                    if let Ok(content) = fs::read_to_string(log_file.path()) {
                        let log_lines: Vec<&str> = content.lines().rev().take(lines).collect();
                        all_logs.push_str(&format!("=== {} ===\n", log_file.path().display()));
                        for line in log_lines.into_iter().rev() {
                            all_logs.push_str(line);
                            all_logs.push('\n');
                        }
                        all_logs.push('\n');
                    }
                }
            }
        }
    }

    if all_logs.is_empty() {
        all_logs = "No logs found. Gateway may not be running or logs directory not found.".to_string();
    }

    all_logs
}

fn read_launcher_logs(lines: usize) -> serde_json::Value {
    if let Some(log_path) = get_launcher_log_path() {
        if let Ok(content) = fs::read_to_string(&log_path) {
            let all_lines: Vec<&str> = content.lines().collect();
            let total_lines = all_lines.len();
            let start = if total_lines > lines { total_lines - lines } else { 0 };
            let requested_lines: Vec<&str> = all_lines[start..].to_vec();

            let parsed_logs: Vec<serde_json::Value> = requested_lines
                .iter()
                .filter_map(|line| {
                    if line.trim().is_empty() {
                        return None;
                    }
                    parse_launcher_log_line(line)
                })
                .collect();

            return serde_json::json!({
                "success": true,
                "total": total_lines,
                "logs": parsed_logs,
                "source": "launcher"
            });
        }
    }

    serde_json::json!({
        "success": false,
        "total": 0,
        "logs": [],
        "source": "launcher",
        "error": "Log file not found"
    })
}

fn parse_launcher_log_line(line: &str) -> Option<serde_json::Value> {
    if let Some(ts_end) = line.find("][") {
        let ts_str = &line[1..ts_end];
        let rest = &line[ts_end + 2..];

        let level = if let Some(level_end) = rest.find("] ") {
            let lvl = rest[1..level_end].to_lowercase();
            lvl
        } else if let Some(bracket_end) = rest.find("]") {
            let lvl = rest[1..bracket_end].to_lowercase();
            lvl
        } else {
            "info".to_string()
        };

        let msg = if let Some(level_end_pos) = rest.find("] ") {
            rest[level_end_pos + 2..].to_string()
        } else if let Some(bracket_pos) = rest.find("]") {
            let after_bracket = &rest[bracket_pos + 1..];
            if after_bracket.trim().is_empty() {
                rest.to_string()
            } else {
                after_bracket.to_string()
            }
        } else {
            rest.to_string()
        };

        let invitation_code = extract_from_log(&msg, "invitation_code")
            .or_else(|| extract_from_log(&msg, "code"))
            .or_else(|| extract_from_log(&msg, "invite_code"));
        let device_id = extract_from_log(&msg, "device_id")
            .or_else(|| extract_from_log(&msg, "deviceId"))
            .or_else(|| extract_from_log(&msg, "device_id"));

        return Some(serde_json::json!({
            "timestamp": ts_str,
            "level": level,
            "message": msg,
            "invitation_code": invitation_code,
            "device_id": device_id
        }));
    }

    Some(serde_json::json!({
        "timestamp": "",
        "level": "info",
        "message": line,
        "invitation_code": null,
        "device_id": null
    }))
}

fn extract_from_log(msg: &str, key: &str) -> Option<String> {
    let patterns = [
        format!("{}=", key),
        format!("{}=\"", key),
        format!("{}=\'", key),
    ];

    for pattern in &patterns {
        if let Some(pos) = msg.find(pattern) {
            let start = pos + pattern.len();
            let remaining = &msg[start..];
            let end = remaining.find(' ')
                .or_else(|| remaining.find(','))
                .or_else(|| remaining.find(';'))
                .unwrap_or(remaining.len());
            return Some(remaining[..end].trim_matches('"').trim_matches('\'').to_string());
        }
    }
    None
}

fn urlencoding_decode(s: &str) -> Option<String> {
    let mut result = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let hex: String = chars.by_ref().take(2).collect();
            if let Ok(byte) = u8::from_str_radix(&hex, 16) {
                result.push(byte as char);
            } else {
                result.push('%');
                result.push_str(&hex);
            }
        } else if c == '+' {
            result.push(' ');
        } else {
            result.push(c);
        }
    }
    Some(result)
}

#[derive(Debug, Serialize, Deserialize)]
struct ConfigDetectResult {
    success: bool,
    found: bool,
    directory: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConfigFile {
    name: String,
    path: String,
    size: u64,
    category: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConfigFilesResult {
    success: bool,
    directory: Option<String>,
    files: Vec<ConfigFile>,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConfigReadResult {
    success: bool,
    content: Option<String>,
    error: Option<String>,
}

fn detect_openclaw_config() -> ConfigDetectResult {
    for dir in get_openclaw_directories() {
        let config_file = dir.join("openclaw.json");
        if config_file.exists() {
            return ConfigDetectResult {
                success: true,
                found: true,
                directory: Some(dir.to_string_lossy().to_string()),
                error: None,
            };
        }
    }

    ConfigDetectResult {
        success: true,
        found: false,
        directory: None,
        error: None,
    }
}

fn get_config_files() -> ConfigFilesResult {
    for dir in get_openclaw_directories() {
        let config_file = dir.join("openclaw.json");
        if config_file.exists() {
            let mut files = Vec::new();

            scan_directory_recursive(&dir, &mut files, 0);

            files.sort_by(|a, b| {
                if a.name == "openclaw.json" { return std::cmp::Ordering::Less; }
                if b.name == "openclaw.json" { return std::cmp::Ordering::Greater; }
                a.name.cmp(&b.name)
            });

            return ConfigFilesResult {
                success: true,
                directory: Some(dir.to_string_lossy().to_string()),
                files,
                error: None,
            };
        }
    }

    ConfigFilesResult {
        success: false,
        directory: None,
        files: vec![],
        error: Some("未找到OpenClaw配置目录".to_string()),
    }
}

fn scan_directory_recursive(dir: &Path, files: &mut Vec<ConfigFile>, depth: usize) {
    if depth > 3 {
        return;
    }

    let root_files = ["openclaw.json"];
    let workspace_files = ["AGENTS.md", "SOUL.md", "MEMORY.md", "IDENTITY.md", "USER.md", "TOOLS.md", "HEARTBEAT.md", "BOOTSTRAP.md"];
    let agent_files = ["auth-profiles.json", "models.json"];
    let skill_files = ["SKILL.md"];

    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let name = path.file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();

            if path.is_file() {
                let file_name_lower = name.to_lowercase();
                
                let category = if root_files.contains(&file_name_lower.as_str()) {
                    "主配置".to_string()
                } else if path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default() == "json" {
                    if name == "auth-profiles.json" || name == "models.json" {
                        "Agent配置".to_string()
                    } else {
                        "JSON配置".to_string()
                    }
                } else if file_name_lower.ends_with(".md") {
                    if name == "SKILL.md" {
                        "技能配置".to_string()
                    } else if workspace_files.contains(&file_name_lower.as_str()) {
                        "工作空间配置".to_string()
                    } else {
                        "Markdown文档".to_string()
                    }
                } else if path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default() == "yaml" || path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default() == "yml" {
                    "YAML配置".to_string()
                } else if path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_default() == "env" {
                    "环境变量".to_string()
                } else if name.ends_with(".log") || name.ends_with(".lock") || name.starts_with(".") {
                    continue;
                } else {
                    "其他".to_string()
                };

                if category == "其他" && depth > 0 {
                    continue;
                }

                let size = entry.metadata().map(|m| m.len()).unwrap_or(0);

                files.push(ConfigFile {
                    name,
                    path: path.to_string_lossy().to_string(),
                    size,
                    category,
                });
            } else if path.is_dir() {
                let dir_name = name.to_lowercase();
                if dir_name == "node_modules" || dir_name == ".git" || dir_name == "logs" || dir_name == "sessions" || dir_name == "memory" || dir_name == ".openclaw" {
                    continue;
                }
                scan_directory_recursive(&path, files, depth + 1);
            }
        }
    }
}

fn read_config_file(file_path: Option<String>) -> ConfigReadResult {
    match file_path {
        Some(path) => {
            match fs::read_to_string(&path) {
                Ok(content) => ConfigReadResult {
                    success: true,
                    content: Some(content),
                    error: None,
                },
                Err(e) => ConfigReadResult {
                    success: false,
                    content: None,
                    error: Some(format!("读取文件失败: {}", e)),
                },
            }
        }
        None => ConfigReadResult {
            success: false,
            content: None,
            error: Some("未指定文件路径".to_string()),
        },
    }
}

#[derive(Serialize)]
struct ConfigWriteResult {
    success: bool,
    message: Option<String>,
    error: Option<String>,
}

fn write_config_file(file_path: Option<&str>, content: Option<&str>) -> ConfigWriteResult {
    match (file_path, content) {
        (Some(path), Some(content)) => {
            let expanded_path = if path.starts_with("{OPENCLAW_HOME}") {
                let home = env::var("HOME")
                    .or_else(|_| env::var("USERPROFILE"))
                    .unwrap_or_else(|_| ".".to_string());
                path.replace("{OPENCLAW_HOME}", &format!("{}/.openclaw", home))
            } else {
                path.to_string()
            };
            
            let path_obj = Path::new(&expanded_path);
            
            if let Some(parent) = path_obj.parent() {
                if let Err(e) = fs::create_dir_all(parent) {
                    return ConfigWriteResult {
                        success: false,
                        message: None,
                        error: Some(format!("创建目录失败: {}", e)),
                    };
                }
            }
            
            match fs::write(&expanded_path, content) {
                Ok(_) => ConfigWriteResult {
                    success: true,
                    message: Some(format!("文件写入成功: {}", expanded_path)),
                    error: None,
                },
                Err(e) => ConfigWriteResult {
                    success: false,
                    message: None,
                    error: Some(format!("写入文件失败: {}", e)),
                },
            }
        }
        _ => ConfigWriteResult {
            success: false,
            message: None,
            error: Some("缺少文件路径或内容".to_string()),
        },
    }
}

#[derive(Serialize)]
struct BackupResult {
    success: bool,
    backup_name: Option<String>,
    backup_path: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
struct BackupInfo {
    name: String,
    path: String,
    created_at: String,
    size: u64,
}

#[derive(Serialize)]
struct BackupListResult {
    success: bool,
    backups: Vec<BackupInfo>,
    error: Option<String>,
}

fn backup_config() -> BackupResult {
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    
    let openclaw_dir = Path::new(&home).join(".openclaw");
    let backup_dir = openclaw_dir.join("backups");
    
    if !openclaw_dir.exists() {
        return BackupResult {
            success: false,
            backup_name: None,
            backup_path: None,
            error: Some("OpenClaw 配置目录不存在".to_string()),
        };
    }
    
    if let Err(e) = fs::create_dir_all(&backup_dir) {
        return BackupResult {
            success: false,
            backup_name: None,
            backup_path: None,
            error: Some(format!("创建备份目录失败: {}", e)),
        };
    }
    
    let now = chrono::Local::now();
    let backup_name = format!("backup_{}", now.format("%Y%m%d_%H%M%S"));
    let backup_path = backup_dir.join(&backup_name);
    
    let mut skipped_files = Vec::new();
    
    fn copy_dir_recursive(src: &Path, dst: &Path, skipped: &mut Vec<String>) -> std::io::Result<()> {
        if !dst.exists() {
            fs::create_dir_all(dst)?;
        }
        
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst.join(&file_name);
            
            if path.is_dir() {
                let dir_name = file_name.to_string_lossy().to_lowercase();
                if dir_name == "backups" || dir_name == "node_modules" || dir_name == ".git" || dir_name == "logs" || dir_name == "sessions" || dir_name == "memory" || dir_name == ".openclaw" {
                    continue;
                }
                if let Err(e) = copy_dir_recursive(&path, &dst_path, skipped) {
                    skipped.push(format!("{}: {}", path.display(), e));
                }
            } else {
                if let Err(e) = fs::copy(&path, &dst_path) {
                    skipped.push(format!("{}: {}", path.display(), e));
                }
            }
        }
        
        Ok(())
    }
    
    match copy_dir_recursive(&openclaw_dir, &backup_path, &mut skipped_files) {
        Ok(_) => BackupResult {
            success: true,
            backup_name: Some(backup_name),
            backup_path: Some(backup_path.to_string_lossy().to_string()),
            error: if skipped_files.is_empty() { None } else { Some(format!("跳过 {} 个文件", skipped_files.len())) },
        },
        Err(e) => BackupResult {
            success: false,
            backup_name: None,
            backup_path: None,
            error: Some(format!("备份失败: {}", e)),
        },
    }
}

fn list_backups() -> BackupListResult {
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    
    let backup_dir = Path::new(&home).join(".openclaw").join("backups");
    
    if !backup_dir.exists() {
        return BackupListResult {
            success: true,
            backups: vec![],
            error: None,
        };
    }
    
    let mut backups = Vec::new();
    
    if let Ok(entries) = fs::read_dir(&backup_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() && path.file_name().map(|n| n.to_string_lossy().starts_with("backup_")).unwrap_or(false) {
                let name = path.file_name().unwrap().to_string_lossy().to_string();
                let created_at = entry.metadata()
                    .and_then(|m| m.created())
                    .map(|t| {
                        let datetime: chrono::DateTime<chrono::Local> = t.into();
                        datetime.format("%Y-%m-%d %H:%M:%S").to_string()
                    })
                    .unwrap_or_else(|_| "未知".to_string());
                
                let size = fs_extra::dir::get_size(&path).unwrap_or(0);
                
                backups.push(BackupInfo {
                    name,
                    path: path.to_string_lossy().to_string(),
                    created_at,
                    size,
                });
            }
        }
    }
    
    backups.sort_by(|a, b| b.name.cmp(&a.name));
    
    BackupListResult {
        success: true,
        backups,
        error: None,
    }
}

#[derive(Serialize)]
struct RestoreResult {
    success: bool,
    message: Option<String>,
    error: Option<String>,
}

fn restore_config(backup_name: Option<&str>) -> RestoreResult {
    let backup_name = match backup_name {
        Some(name) => name.to_string(),
        None => return RestoreResult {
            success: false,
            message: None,
            error: Some("缺少备份名称".to_string()),
        },
    };
    
    let home = env::var("HOME")
        .or_else(|_| env::var("USERPROFILE"))
        .unwrap_or_else(|_| ".".to_string());
    
    let openclaw_dir = Path::new(&home).join(".openclaw");
    let backup_path = openclaw_dir.join("backups").join(&backup_name);
    
    if !backup_path.exists() {
        return RestoreResult {
            success: false,
            message: None,
            error: Some("备份不存在".to_string()),
        };
    }
    
    fn copy_dir_recursive(src: &Path, dst: &Path) -> std::io::Result<()> {
        if !dst.exists() {
            fs::create_dir_all(dst)?;
        }
        
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let path = entry.path();
            let file_name = entry.file_name();
            let dst_path = dst.join(&file_name);
            
            if path.is_dir() {
                copy_dir_recursive(&path, &dst_path)?;
            } else {
                fs::copy(&path, &dst_path)?;
            }
        }
        
        Ok(())
    }
    
    match copy_dir_recursive(&backup_path, &openclaw_dir) {
        Ok(_) => RestoreResult {
            success: true,
            message: Some(format!("配置已从 {} 恢复", backup_name)),
            error: None,
        },
        Err(e) => RestoreResult {
            success: false,
            message: None,
            error: Some(format!("恢复失败: {}", e)),
        },
    }
}

fn install_openclaw() -> InstallResult {
    add_console_log("=== OpenClaw Installation Started ===");

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(["-Command", "iwr -useb https://clawd.org.cn/install.ps1 | iex"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    add_console_log("OpenClaw installation completed successfully");
                    InstallResult {
                        success: true,
                        message: "OpenClaw 安装成功".to_string(),
                        error: None,
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    let stdout = String::from_utf8_lossy(&out.stdout);
                    add_console_log(&format!("OpenClaw installation failed: {} {}", stderr, stdout));
                    InstallResult {
                        success: false,
                        message: "".to_string(),
                        error: Some(format!("{} {}", stderr, stdout)),
                    }
                }
            }
            Err(e) => {
                add_console_log(&format!("OpenClaw installation error: {}", e));
                InstallResult {
                    success: false,
                    message: "".to_string(),
                    error: Some(e.to_string()),
                }
            },
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("bash")
            .args(["-c", "curl -fsSL https://clawd.org.cn/install.sh | bash"])
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    add_console_log("OpenClaw installation completed successfully");
                    InstallResult {
                        success: true,
                        message: "OpenClaw 安装成功".to_string(),
                        error: None,
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    add_console_log(&format!("OpenClaw installation failed: {}", stderr));
                    InstallResult {
                        success: false,
                        message: "".to_string(),
                        error: Some(stderr.to_string()),
                    }
                }
            }
            Err(e) => {
                add_console_log(&format!("OpenClaw installation error: {}", e));
                InstallResult {
                    success: false,
                    message: "".to_string(),
                    error: Some(e.to_string()),
                }
            },
        }
    }
}

fn upgrade_openclaw() -> InstallResult {
    add_console_log("=== OpenClaw Upgrade Started ===");

    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", "npm", "install", "-g", "openclaw@latest", "--force"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("bash")
        .args(["-c", "npm install -g openclaw@latest --force"])
        .output();

    match output {
        Ok(out) => {
            if out.status.success() {
                add_console_log("OpenClaw upgrade completed successfully");
                InstallResult {
                    success: true,
                    message: "OpenClaw 升级成功".to_string(),
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
                add_console_log(&format!("OpenClaw upgrade failed: {} {}", stderr, stdout));
                InstallResult {
                    success: false,
                    message: "".to_string(),
                    error: Some(format!("{} {}", stderr, stdout)),
                }
            }
        }
        Err(e) => InstallResult {
            success: false,
            message: "".to_string(),
            error: Some(e.to_string()),
        },
    }
}

fn check_openclaw_installed() -> (bool, Option<String>, Option<String>) {
    for dir in get_openclaw_directories() {
        let config_file = dir.join("openclaw.json");
        if config_file.exists() && dir.is_dir() {
            let version = if let Ok(content) = fs::read_to_string(&config_file) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    json.get("meta")
                        .and_then(|m| m.get("lastTouchedVersion"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                } else {
                    None
                }
            } else {
                None
            }.or(Some("unknown".to_string()));
            return (true, Some(dir.to_string_lossy().to_string()), version);
        }
    }
    (false, None, None)
}

fn check_openclaw_npm_installed() -> (bool, Option<String>) {
    let output = match Command::new("cmd")
        .args(["/C", "npm", "list", "-g", "openclaw", "--depth=0"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
    {
        Ok(out) => out,
        Err(_) => return (false, None),
    };

    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains("openclaw") {
            let version = get_openclaw_version();
            return (true, version);
        }
    }
    (false, None)
}

fn fix_openclaw_config() -> bool {
    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", "openclaw", "doctor", "--fix"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("openclaw")
        .args(["doctor", "--fix"])
        .output();

    match output {
        Ok(out) => out.status.success(),
        Err(_) => false,
    }
}

fn fix_openclaw_config_with_output() -> String {
    run_openclaw_command(&["doctor", "--fix"])
}

fn run_openclaw_command(args: &[&str]) -> String {
    let is_run = args.contains(&"run") && args.contains(&"gateway");
    let is_stop = args.contains(&"stop") && args.contains(&"gateway");

    #[cfg(target_os = "windows")]
    let output = if is_run {
        // 对于 gateway run 命令，在后台运行
        let _ = Command::new("wmic")
            .args(["process", "where", "name='node.exe' and commandline like '%openclaw%gateway%'", "call", "terminate"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();

        std::thread::sleep(std::time::Duration::from_millis(1500));

        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let devices_dir = std::path::PathBuf::from(user_profile).join(".openclaw").join("devices");
            if devices_dir.exists() {
                let _ = std::fs::remove_dir_all(&devices_dir);
            }
            let _ = std::fs::create_dir_all(&devices_dir);
            let pending_path = devices_dir.join("pending.json");
            let paired_path = devices_dir.join("paired.json");
            let _ = std::fs::write(&pending_path, "[]");
            let _ = std::fs::write(&paired_path, "[]");
        }

        let openclaw_path = get_openclaw_module_path();

        if let Some(mjs_path) = openclaw_path {
            let mut node_args: Vec<String> = vec![mjs_path.clone()];
            for arg in args {
                node_args.push(arg.to_string());
            }
            Command::new("node")
                .args(&node_args)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map(|_| String::from("Gateway started via node (hidden)"))
                .unwrap_or_else(|e| format!("error: {}", e))
        } else {
            let args_str = args.join(" ");
            Command::new("cmd")
                .args(["/C", &format!("start /B openclaw {}", args_str)])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .map(|_| String::from("Gateway started in background (hidden window)"))
                .unwrap_or_else(|e| format!("error: {}", e))
        }
    } else if is_stop {
        // 对于 gateway stop 命令，不等待完成，直接返回
        Command::new("cmd")
            .args(["/C", "start /B openclaw gateway stop"])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map(|_| String::from("Gateway stop command sent"))
            .unwrap_or_else(|e| format!("error: {}", e))
    } else {
        // 其他命令使用 timeout
        let args_str = args.join(" ");
        match Command::new("cmd")
            .args(["/C", &format!("openclaw {}", args_str)])
            .creation_flags(CREATE_NO_WINDOW)
            .output() {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                format!("stdout: {}\nstderr: {}\nsuccess: {}", stdout, stderr, out.status.success())
            }
            Err(e) => format!("error: {}", e)
        }
    };

    #[cfg(not(target_os = "windows"))]
    let output = if is_run {
        Command::new("openclaw")
            .args(args)
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map(|_| String::from("Gateway started in background"))
            .unwrap_or_else(|e| format!("error: {}", e))
    } else {
        Command::new("openclaw")
            .args(args)
            .output()
            .map(|out| {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                format!("stdout: {}\nstderr: {}\nsuccess: {}", stdout, stderr, out.status.success())
            })
            .unwrap_or_else(|e| format!("error: {}", e))
    };

    output
}

fn upload_launcher_logs(logs: &str) {
    let device_id = get_device_id();
    let timestamp = chrono_linux_timestamp();
    let log_data = serde_json::json!({
        "deviceId": device_id,
        "logs": logs,
        "timestamp": timestamp
    });

    let json_str = serde_json::to_string(&log_data).unwrap_or_default();
    let server_base = get_server_api_base();
    let addr = server_base.trim_start_matches("http://").trim_start_matches("https://");

    let request = format!(
        "POST /api/launcher-logs/upload HTTP/1.0\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
        addr,
        json_str.len(),
        json_str
    );

    if let Ok(mut stream) = TcpStream::connect(addr) {
        let _ = stream.write_all(request.as_bytes());
    }
}

fn get_device_id() -> String {
    if let Ok(user_profile) = std::env::var("USERPROFILE") {
        let key = format!("{}\\OPENCLAW_LAUNCHER", user_profile);
        if let Ok(id) = std::fs::read_to_string(&key) {
            return id;
        }
        let id = format!("device_{}", uuid_simple());
        let _ = std::fs::write(&key, &id);
        return id;
    }
    format!("device_{}", uuid_simple())
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
    format!("{:x}{:x}", now.as_secs(), now.subsec_nanos())
}

fn chrono_linux_timestamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64
}

fn is_port_open(port: u16) -> bool {
    if port == LAUNCHER_HTTP_PORT {
        return false;
    }
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

fn check_gateway_port() -> Option<u16> {
    for &port in GATEWAY_PORTS {
        if port != LAUNCHER_HTTP_PORT && is_gateway_responsive(port) {
            return Some(port);
        }
    }
    None
}

fn is_gateway_responsive(port: u16) -> bool {
    if let Ok(mut stream) = TcpStream::connect_timeout(&format!("127.0.0.1:{}", port).parse().unwrap(), std::time::Duration::from_millis(500)) {
        let _ = stream.write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n");
        let mut buf = [0u8; 100];
        let _ = stream.set_read_timeout(Some(std::time::Duration::from_millis(500)));
        if let Ok(_) = stream.read(&mut buf) {
            let response = String::from_utf8_lossy(&buf);
            return response.contains("200") || response.contains("OK") || response.contains("openclaw") || response.contains("401") || response.contains("HTTP/");
        }
    }
    false
}

fn auto_upgrade_launcher() -> InstallResult {
    InstallResult {
        success: true,
        message: "请手动下载新版Launcher".to_string(),
        error: Some("Launcher 升级需要手动下载安装".to_string()),
    }
}

fn parse_changelog(content: &str) -> Vec<serde_json::Value> {
    let mut versions = Vec::new();
    let mut current_version: Option<serde_json::Value> = None;
    let mut current_change_type = String::new();
    let mut current_items: Vec<String> = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("## v") || trimmed.starts_with("## ") {
            if let Some(mut v) = current_version.take() {
                if !current_items.is_empty() || !current_change_type.is_empty() {
                    if let Some(arr) = v.as_mut_object().and_then(|m| m.get_mut("changes").and_then(|c| c.as_array_mut())) {
                        if !current_change_type.is_empty() && !current_items.is_empty() {
                            arr.push(serde_json::json!({
                                "type": current_change_type,
                                "items": current_items.clone()
                            }));
                        }
                    }
                }
                versions.push(v);
            }

            let version_str = if trimmed.starts_with("## v") {
                trimmed.trim_start_matches("## v").split_whitespace().next().unwrap_or("")
            } else {
                trimmed.trim_start_matches("## ").split_whitespace().next().unwrap_or("")
            };

            current_version = Some(serde_json::json!({
                "version": version_str,
                "date": "",
                "changes": Vec::<serde_json::Value>::new()
            }));
            current_change_type.clear();
            current_items.clear();

        } else if trimmed.starts_with("### ") && current_version.is_some() {
            if !current_change_type.is_empty() && !current_items.is_empty() {
                if let Some(v) = current_version.as_mut() {
                    if let Some(arr) = v.as_mut_object().and_then(|m| m.get_mut("changes").and_then(|c| c.as_array_mut())) {
                        arr.push(serde_json::json!({
                            "type": current_change_type,
                            "items": current_items.clone()
                        }));
                    }
                }
            }
            current_change_type = trimmed.trim_start_matches("### ").trim().to_string();
            current_items.clear();

        } else if trimmed.starts_with("- ") && current_version.is_some() {
            current_items.push(trimmed.trim_start_matches("- ").to_string());

        } else if trimmed.starts_with("(") && trimmed.contains(")") && current_version.is_some() {
            if let Some(v) = current_version.as_mut() {
                if let Some(obj) = v.as_mut_object() {
                    if let Some(date_match) = trimmed.match_indices('(').next() {
                        let date = &trimmed[date_match.0+1..trimmed.find(')').unwrap_or(trimmed.len())];
                        obj.insert("date".to_string(), serde_json::Value::String(date.to_string()));
                    }
                }
            }
        }
    }

    if let Some(mut v) = current_version {
        if !current_change_type.is_empty() && !current_items.is_empty() {
            if let Some(arr) = v.as_mut_object().and_then(|m| m.get_mut("changes").and_then(|c| c.as_array_mut())) {
                arr.push(serde_json::json!({
                    "type": current_change_type,
                    "items": current_items
                }));
            }
        }
        versions.push(v);
    }

    versions.truncate(5);
    versions
}

fn handle_http_request(req: &str) -> Option<String> {
    let req_line = req.lines().next().unwrap_or("");
    add_console_log(&format!("[REQ] {}", req_line));

    if req.starts_with("GET /") && !req.starts_with("GET /api") {
        let path = req_line.split(' ').nth(1).unwrap_or("/");
        let file_path = if path == "/" {
            "index.html".to_string()
        } else {
            path.trim_start_matches('/').to_string()
        };

        let dist_base = if let Ok(exe_path) = std::env::current_exe() {
            exe_path.parent().map(|p| p.to_path_buf())
        } else {
            None
        };
        let final_base = dist_base.unwrap_or_else(|| std::path::PathBuf::from("src-ui/dist"));
        let final_path = final_base.join(&file_path);

        add_console_log(&format!("[DEBUG] Trying to load: {:?}", final_path));

        if let Ok(content) = std::fs::read(&final_path) {
            let content_type = if file_path.ends_with(".html") {
                "text/html; charset=utf-8"
            } else if file_path.ends_with(".js") {
                "application/javascript"
            } else if file_path.ends_with(".css") {
                "text/css"
            } else if file_path.ends_with(".svg") {
                "image/svg+xml"
            } else if file_path.ends_with(".png") {
                "image/png"
            } else if file_path.ends_with(".json") {
                "application/json"
            } else {
                "application/octet-stream"
            };

            return Some(format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\n\r\n",
                content_type,
                content.len()
            ) + unsafe { std::str::from_utf8_unchecked(&content) });
        }
    }

    if req.starts_with("GET /api/open-webapp") {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("cmd")
                .args(["/C", "start", "", "http://127.0.0.1:18790"])
                .spawn()
                .ok();
        }
        return Some("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"success\":true}".to_string());
    }

    if req.starts_with("GET /api/check") || req.starts_with("GET /api/status") {
        let (installed, directory, version) = check_openclaw_installed();
        let gateway_port = check_gateway_port();

        let status = OpenClawStatus {
            success: true,
            installed,
            directory,
            version,
            gateway_port,
            gateway_running: gateway_port.is_some(),
            platform: std::env::consts::OS.to_string(),
            arch: std::env::consts::ARCH.to_string(),
        };

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n{}",
            serde_json::to_string(&status).unwrap()
        ));
    }

    if req.starts_with("GET /api/system-info") {
        let sys_info = get_system_info();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n{}",
            serde_json::to_string(&sys_info).unwrap()
        ));
    }

    if req.starts_with("GET /api/changelog") {
        let changelog_path = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|p| p.to_path_buf()))
            .map(|p| p.join("CHANGELOG.md"))
            .unwrap_or_else(|| std::path::PathBuf::from("CHANGELOG.md"));

        let changelog_content = if changelog_path.exists() {
            std::fs::read_to_string(&changelog_path).unwrap_or_default()
        } else {
            String::new()
        };

        let versions = parse_changelog(&changelog_content);

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n{{\"success\":true,\"versions\":{}}}",
            serde_json::to_string(&versions).unwrap()
        ));
    }

    if req.starts_with("POST /api/launch") {
        add_console_log("终端服务已就绪");

        let launch_result = LaunchResult { success: true, error: None };

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&launch_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/install") {
        let install_result = install_openclaw();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n{}",
            serde_json::to_string(&install_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/auto-upgrade") {
        let upgrade_result = auto_upgrade_launcher();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n{}",
            serde_json::to_string(&upgrade_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/clear-device-auth") {
        gateway::clear_device_auth_cache();
        add_console_log("Device auth cache cleared via HTTP");
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{{\"success\":true,\"message\":\"Device auth cache cleared\"}}"
        ));
    }

    if req.starts_with("POST /api/upgrade") {
        let upgrade_result = upgrade_openclaw();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n{}",
            serde_json::to_string(&upgrade_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/stop-gateway") {
        add_console_log("=== Stopping Gateway ===");

        if let Ok(mut proc) = GATEWAY_PROCESS.lock() {
            if let Some(ref mut child) = *proc {
                let _ = child.kill();
                let _ = child.wait();
                add_console_log("Gateway process killed via stored handle");
            }
            *proc = None;
        }

        #[cfg(target_os = "windows")]
        let stop_result = Command::new("powershell")
            .args(["-Command", "netstat -ano | Select-String ':18789.*LISTENING' | ForEach-Object { ($_ -split '\\s+')[-1] } | Where-Object { $_ -ne '0' } | ForEach-Object { Stop-Process -Id [int]$_ -Force -ErrorAction SilentlyContinue }"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        #[cfg(not(target_os = "windows"))]
        let stop_result = Command::new("bash")
            .args(["-c", "pkill -f 'openclaw.*gateway' || true"])
            .output();

        let launch_result = match stop_result {
            Ok(out) => {
                let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                add_console_log(&format!("Stop output: {}", stdout));
                LaunchResult { success: true, error: None }
            }
            Err(e) => {
                add_console_log(&format!("[ERROR] {}", e));
                LaunchResult { success: false, error: Some(e.to_string()) }
            }
        };

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&launch_result).unwrap()
        ));
    }

    if req.starts_with("GET /api/logs") {
        let lines = req.split("lines=").nth(1)
            .and_then(|s| s.split('&').next())
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(100);

        let logs = read_openclaw_logs(lines);
        let logs_response = serde_json::json!({
            "success": true,
            "logs": logs
        });

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&logs_response).unwrap()
        ));
    }

    if req.starts_with("GET /api/launcher/logs") {
        let lines = req.split("lines=").nth(1)
            .and_then(|s| s.split('&').next())
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(200);

        let logs_response = read_launcher_logs(lines);
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&logs_response).unwrap()
        ));
    }

    if req.starts_with("GET /api/console/logs") {
        let since = req.split("since=").nth(1)
            .and_then(|s| s.split('&').next())
            .and_then(|s| s.parse::<usize>().ok())
            .unwrap_or(0);

        let openclaw_log_dir = std::env::temp_dir().join("openclaw");
        let mut logs: Vec<String> = Vec::new();

        if let Ok(entries) = std::fs::read_dir(&openclaw_log_dir) {
            let mut log_files: Vec<_> = entries
                .filter_map(|e| e.ok())
                .filter(|e| {
                    let name = e.file_name().to_string_lossy().to_lowercase();
                    name.starts_with("openclaw-") && name.ends_with(".log")
                })
                .collect();

            log_files.sort_by(|a, b| {
                let a_time = a.metadata().and_then(|m| m.modified()).ok();
                let b_time = b.metadata().and_then(|m| m.modified()).ok();
                b_time.cmp(&a_time)
            });

            if let Some(newest) = log_files.first() {
                if let Ok(content) = std::fs::read_to_string(newest.path()) {
                    for line in content.lines().rev().take(500) {
                        logs.insert(0, line.to_string());
                    }
                }
            }
        }

        let total = logs.len();
        let new_logs: Vec<String> = logs.into_iter().skip(since).collect();

        let logs_response = serde_json::json!({
            "success": true,
            "logs": new_logs,
            "total": total
        });

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&logs_response).unwrap()
        ));
    }

    if req.starts_with("GET /api/config/detect") {
        let result = detect_openclaw_config();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("GET /api/config/files") {
        let result = get_config_files();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("GET /api/config/read") {
        let file_path = req.split("path=").nth(1)
            .and_then(|s| s.split('&').next())
            .and_then(|s| urlencoding_decode(s));

        let result = read_config_file(file_path);
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("GET /api/openclaw-config") {
        let home = env::var("HOME")
            .or_else(|_| env::var("USERPROFILE"))
            .unwrap_or_else(|_| ".".to_string());
        let config_path = Path::new(&home).join(".openclaw").join("openclaw.json");
        
        match fs::read_to_string(&config_path) {
            Ok(content) => {
                match serde_json::from_str::<serde_json::Value>(&content) {
                    Ok(json) => {
                        let result = serde_json::json!({
                            "success": true,
                            "config": json,
                            "path": config_path.to_string_lossy().to_string()
                        });
                        return Some(format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            serde_json::to_string(&result).unwrap()
                        ));
                    }
                    Err(e) => {
                        let result = serde_json::json!({
                            "success": false,
                            "error": format!("JSON解析失败: {}", e)
                        });
                        return Some(format!(
                            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                            serde_json::to_string(&result).unwrap()
                        ));
                    }
                }
            }
            Err(e) => {
                let result = serde_json::json!({
                    "success": false,
                    "error": format!("读取配置文件失败: {}", e)
                });
                return Some(format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                    serde_json::to_string(&result).unwrap()
                ));
            }
        }
    }

    if req.starts_with("POST /api/openclaw-config") {
        let body_start = req.find("\r\n\r\n");
        if let Some(start) = body_start {
            let body = &req[start + 4..];
            
            match serde_json::from_str::<serde_json::Value>(body) {
                Ok(json) => {
                    let home = env::var("HOME")
                        .or_else(|_| env::var("USERPROFILE"))
                        .unwrap_or_else(|_| ".".to_string());
                    let config_path = Path::new(&home).join(".openclaw").join("openclaw.json");
                    
                    match serde_json::to_string_pretty(&json) {
                        Ok(content) => {
                            match fs::write(&config_path, content) {
                                Ok(_) => {
                                    let result = serde_json::json!({
                                        "success": true,
                                        "message": "配置已保存"
                                    });
                                    return Some(format!(
                                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                        serde_json::to_string(&result).unwrap()
                                    ));
                                }
                                Err(e) => {
                                    let result = serde_json::json!({
                                        "success": false,
                                        "error": format!("写入配置文件失败: {}", e)
                                    });
                                    return Some(format!(
                                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                        serde_json::to_string(&result).unwrap()
                                    ));
                                }
                            }
                        }
                        Err(e) => {
                            let result = serde_json::json!({
                                "success": false,
                                "error": format!("JSON序列化失败 {}", e)
                            });
                            return Some(format!(
                                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                                serde_json::to_string(&result).unwrap()
                            ));
                        }
                    }
                }
                Err(e) => {
                    let error_response = serde_json::json!({
                        "success": false,
                        "error": format!("Invalid JSON: {}", e)
                    });
                    return Some(format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        serde_json::to_string(&error_response).unwrap()
                    ));
                }
            }
        }
    }

    if req.starts_with("POST /api/gateway/restart") {
        std::thread::spawn(|| {
            add_console_log("=== Restarting Gateway ===");

            add_console_log("Step 1: Stopping gateway scheduled task...");
            let stop_result = run_openclaw_command(&["gateway", "stop"]);
            add_console_log(&stop_result);

            std::thread::sleep(std::time::Duration::from_millis(2000));

            add_console_log("Step 2: Killing all gateway processes...");
            let _ = Command::new("wmic")
                .args(["process", "where", "name='node.exe' and commandline like '%openclaw%gateway%'", "call", "terminate"])
                .creation_flags(CREATE_NO_WINDOW)
                .output();

            std::thread::sleep(std::time::Duration::from_millis(2000));

            add_console_log("Step 3: Resetting devices directory...");
            if let Ok(user_profile) = std::env::var("USERPROFILE") {
                let devices_dir = std::path::PathBuf::from(user_profile).join(".openclaw").join("devices");
                if devices_dir.exists() {
                    let _ = std::fs::remove_dir_all(&devices_dir);
                }
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = std::fs::create_dir_all(&devices_dir);
                let pending_path = devices_dir.join("pending.json");
                let paired_path = devices_dir.join("paired.json");
                let _ = std::fs::write(&pending_path, "[]");
                let _ = std::fs::write(&paired_path, "[]");
                add_console_log("Devices directory reset complete");
            }

            add_console_log("Step 4: Starting gateway service...");
            let set_auth_cmd = run_openclaw_command(&["config", "set", "gateway.auth.mode", "none"]);
            add_console_log(&set_auth_cmd);
            let start_result = run_openclaw_command(&["gateway", "run", "--allow-unconfigured"]);
            add_console_log(&start_result);

            std::thread::sleep(std::time::Duration::from_millis(3000));
            add_console_log("Gateway restart completed");
        });

        let result = serde_json::json!({
            "success": true,
            "message": "Gateway正在重启，请稍后..."
        });
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("POST /api/gateway/start") {
        gateway::add_gateway_log("=== Starting Gateway Service ===");

        std::thread::spawn(|| {
            gateway::kill_all_gateway_processes();
        });

        std::thread::sleep(std::time::Duration::from_millis(500));

        gateway::clear_gateway_logs();
        gateway::add_gateway_log("=== Starting Gateway ===");

        gateway::clear_device_auth_cache();

        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let devices_dir = std::path::PathBuf::from(user_profile).join(".openclaw").join("devices");

            if devices_dir.exists() {
                let _ = std::fs::remove_dir_all(&devices_dir);
            }
            std::thread::sleep(std::time::Duration::from_millis(500));
            let _ = std::fs::create_dir_all(&devices_dir);

            let pending_path = devices_dir.join("pending.json");
            let paired_path = devices_dir.join("paired.json");
            let _ = std::fs::write(&pending_path, "[]");
            let _ = std::fs::write(&paired_path, "[]");
            gateway::add_gateway_log("Devices directory reset");
        }

        if gateway::is_gateway_running() {
            gateway::add_gateway_log("Gateway is already running, skipping start");
            let result = serde_json::json!({
                "success": false,
                "error": "Gateway is already running"
            });
            return Some(format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                serde_json::to_string(&result).unwrap()
            ));
        }

        std::thread::spawn(|| {
            gateway::add_gateway_log("Starting gateway with --allow-unconfigured...");
            let openclaw_path = gateway::resolve_openclaw_path();
            if let Some(mjs_path) = openclaw_path {
                let set_auth_result = std::process::Command::new("openclaw")
                    .args(["config", "set", "gateway.auth.mode", "none"])
                    .creation_flags(CREATE_NO_WINDOW)
                    .output();
                if let Ok(output) = set_auth_result {
                    if output.status.success() {
                        gateway::add_gateway_log("Gateway auth mode set to none");
                    }
                }
                let mut cmd_args = vec![mjs_path.clone(), "gateway".to_string(), "run".to_string(), "--allow-unconfigured".to_string()];
                let output = Command::new("node")
                    .args(&cmd_args)
                    .creation_flags(CREATE_NO_WINDOW)
                    .spawn();

                match output {
                    Ok(mut child) => {
                        let pid = child.id();
                        gateway::add_gateway_log(&format!("Gateway started (PID: {})", pid));

                        std::thread::spawn(move || {
                            let _ = child.wait();
                            gateway::add_gateway_log("Gateway process exited");
                        });
                    }
                    Err(e) => {
                        gateway::add_gateway_log(&format!("[ERR] Failed to start: {}", e));
                    }
                }
            } else {
                gateway::add_gateway_log("[ERR] Cannot find openclaw");
            }
        });

        std::thread::sleep(std::time::Duration::from_millis(500));

        let result = serde_json::json!({
            "success": true,
            "message": "Gateway starting..."
        });
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("POST /api/gateway/stop") {
        gateway::add_gateway_log("=== Stopping Gateway Service ===");

        std::thread::spawn(|| {
            gateway::kill_all_gateway_processes();
        });

        let result = serde_json::json!({
            "success": true,
            "message": "Gateway服务已停止"
        });
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("GET /api/gateway/logs") {
        let since: u64 = req
            .split("since=")
            .nth(1)
            .and_then(|s| s.split_whitespace().next())
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);
        
        let logs = gateway::get_gateway_logs(since);
        let result = serde_json::json!({
            "success": true,
            "logs": logs
        });
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("POST /api/config/write") {
        let body_start = req.find("\r\n\r\n");
        if let Some(start) = body_start {
            let body = &req[start + 4..];
            
            match serde_json::from_str::<serde_json::Value>(body) {
                Ok(json) => {
                    let file_path = json["path"].as_str();
                    let content = json["content"].as_str();
                    
                    let result = write_config_file(file_path, content);
                    return Some(format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        serde_json::to_string(&result).unwrap()
                    ));
                }
                Err(e) => {
                    let error_response = serde_json::json!({
                        "success": false,
                        "error": format!("Invalid JSON: {}", e)
                    });
                    return Some(format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        serde_json::to_string(&error_response).unwrap()
                    ));
                }
            }
        }
    }

    if req.starts_with("POST /api/config/backup") {
        let result = backup_config();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("GET /api/config/backups") {
        let result = list_backups();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&result).unwrap()
        ));
    }

    if req.starts_with("POST /api/config/restore") {
        let body_start = req.find("\r\n\r\n");
        if let Some(start) = body_start {
            let body = &req[start + 4..];
            
            match serde_json::from_str::<serde_json::Value>(body) {
                Ok(json) => {
                    let backup_name = json["backupName"].as_str();
                    let result = restore_config(backup_name);
                    return Some(format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        serde_json::to_string(&result).unwrap()
                    ));
                }
                Err(e) => {
                    let error_response = serde_json::json!({
                        "success": false,
                        "error": format!("Invalid JSON: {}", e)
                    });
                    return Some(format!(
                        "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
                        serde_json::to_string(&error_response).unwrap()
                    ));
                }
            }
        }
    }

    if req.starts_with("OPTIONS") {
        return Some("HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type, Authorization\r\n\r\n".to_string());
    }

    Some("HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"error\":\"Not Found\"}".to_string())
}

fn start_http_server() {
    std::thread::spawn(move || {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", LAUNCHER_HTTP_PORT)).expect("Failed to bind port");
        log::info!("HTTP API Server started on http://127.0.0.1:{}", LAUNCHER_HTTP_PORT);

        for stream in listener.incoming() {
            match stream {
                Ok(mut stream) => {
                    let mut buffer = [0; 8192];
                    if let Ok(size) = stream.read(&mut buffer) {
                        let mut request = String::from_utf8_lossy(&buffer[..size]).to_string();
                        
                        if request.starts_with("POST") {
                            let content_length = request.lines()
                                .find(|line| line.to_lowercase().starts_with("content-length:"))
                                .and_then(|line| line.split(':').nth(1))
                                .and_then(|s| s.trim().parse::<usize>().ok())
                                .unwrap_or(0);
                            
                            if let Some(body_start) = request.find("\r\n\r\n") {
                                let body = &request[body_start + 4..];
                                let body_len = body.len();
                                
                                if body_len < content_length {
                                    let remaining = content_length - body_len;
                                    let mut extra_buf = vec![0u8; remaining];
                                    if let Ok(extra_size) = stream.read(&mut extra_buf) {
                                        request.push_str(&String::from_utf8_lossy(&extra_buf[..extra_size]));
                                    }
                                }
                            }
                        }
                        
                        if let Some(response) = handle_http_request(&request) {
                            let _ = stream.write_all(response.as_bytes());
                        }
                    }
                }
                Err(_) => {}
            }
        }
    });
}

#[tauri::command]
fn check_openclaw_status() -> OpenClawStatus {
    let (installed, directory, version) = check_openclaw_installed();
    let gateway_port = check_gateway_port();

    OpenClawStatus {
        success: true,
        installed,
        directory,
        version,
        gateway_port,
        gateway_running: gateway_port.is_some(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

#[tauri::command]
fn launch_openclaw() -> LaunchResult {
    let mut logs = String::new();

    logs.push_str("=== Step 1: Health Check (openclaw doctor) ===\n");
    let doctor_output = run_openclaw_command(&["doctor"]);
    logs.push_str(&doctor_output);

    logs.push_str("\n=== Step 2: Auto-fix Config (openclaw doctor --fix) ===\n");
    let fix_output = run_openclaw_command(&["doctor", "--fix"]);
    logs.push_str(&fix_output);

    logs.push_str("\n=== Step 3: Start Gateway (openclaw gateway run) ===\n");
    let start_result = run_openclaw_command(&["gateway", "run", "--allow-unconfigured"]);
    logs.push_str(&start_result);

    let success = doctor_output.contains("success: true") || fix_output.contains("success: true") || !start_result.is_empty();

    upload_launcher_logs(&logs);

    if success {
        LaunchResult { success: true, error: None }
    } else {
        LaunchResult { success: false, error: Some("Gateway may not have started properly".to_string()) }
    }
}

#[tauri::command]
fn check_port(port: u16) -> bool {
    is_port_open(port)
}

#[tauri::command]
fn get_installed() -> (bool, Option<String>, Option<String>) {
    check_openclaw_installed()
}

fn show_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            match event.id.as_ref() {
                "show" => show_window(app),
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                show_window(tray.app_handle());
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    start_http_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            log::info!("Single instance triggered");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(gateway::SharedGatewayState::default())
        .setup(|app| {
            let log_path = app.path().app_log_dir().expect("Failed to get log dir");
            let _ = std::fs::create_dir_all(&log_path);
            
            app.handle().plugin(
                tauri_plugin_log::Builder::new()
                    .level(log::LevelFilter::Info)
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::LogDir {
                            file_name: Some("launcher".into()),
                        }
                    ))
                    .target(tauri_plugin_log::Target::new(
                        tauri_plugin_log::TargetKind::Stdout
                    ))
                    .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                    .build(),
            )?;

            log::info!("OpenClaw Launcher started");

            setup_tray(app.handle())?;

            let window = app.get_webview_window("main").unwrap();
            let window_clone = window.clone();
            window.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window_clone.hide();
                    log::info!("Window hidden to tray");
                }
            });

            let args: Vec<String> = std::env::args().collect();
            if args.len() > 1 {
                let url = &args[1];
                if url.starts_with("openclaw://") {
                    log::info!("Protocol command on startup: {}", url);
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.emit("protocol-command", url);
                    }
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            check_openclaw_status,
            launch_openclaw,
            check_port,
            get_installed,
            gateway::start_gateway,
            gateway::stop_gateway,
            gateway::gateway_status,
            gateway::clear_device_auth
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
