use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use tauri::{Manager, Emitter, AppHandle, tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent}, menu::{Menu, MenuItem}};

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

const LAUNCHER_HTTP_PORT: u16 = 18790;
const GATEWAY_PORTS: &[u16] = &[18789, 18790, 18791, 18792, 18793, 18794, 18795];

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
}

fn get_node_version() -> Option<String> {
    let output = Command::new("node").args(["--version"]).output().ok()?;
    String::from_utf8(output.stdout).ok()?.trim().strip_prefix('v').map(|s| s.to_string())
}

fn get_npm_version() -> Option<String> {
    let output = Command::new("cmd")
        .args(["/C", "npm", "--version"])
        .output()
        .ok()?;
    String::from_utf8(output.stdout).ok()?.trim().to_string().into()
}

fn get_openclaw_npm_version() -> Option<String> {
    let output = Command::new("cmd")
        .args(["/C", "npm", "show", "openclaw-cn", "version"])
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

fn get_disk_space() -> Option<f64> {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(["/C", "for /f \"tokens=3\" %a in ('wmic logicaldisk where \"DeviceID='C:'\" get FreeSpace /value ^| find \"FreeSpace\"') do @echo %a"])
            .output()
            .ok()?;
        let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if let Ok(bytes) = text.parse::<u64>() {
            return Some(bytes as f64 / 1024.0 / 1024.0 / 1024.0);
        }
        let output2 = Command::new("powershell")
            .args(["-Command", "(Get-PSDrive C).Free / 1GB"])
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
    let (_, _, _) = check_openclaw_installed();
    let (npm_installed, npm_version) = check_openclaw_npm_installed();
    let gateway_port = check_gateway_port();

    SystemInfo {
        success: true,
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        node_version: get_node_version(),
        npm_version: get_npm_version(),
        disk_space_gb: get_disk_space(),
        openclaw_installed: npm_installed,
        openclaw_version: npm_version,
        openclaw_directory: None,
        gateway_running: gateway_port.is_some(),
        gateway_port,
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

fn install_openclaw() -> InstallResult {
    #[cfg(target_os = "windows")]
    {
        let output = Command::new("powershell")
            .args(["-Command", "iwr -useb https://clawd.org.cn/install.ps1 | iex"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    InstallResult {
                        success: true,
                        message: "OpenClaw 安装成功".to_string(),
                        error: None,
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    let stdout = String::from_utf8_lossy(&out.stdout);
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

    #[cfg(not(target_os = "windows"))]
    {
        let output = Command::new("bash")
            .args(["-c", "curl -fsSL https://clawd.org.cn/install.sh | bash"])
            .output();

        match output {
            Ok(out) => {
                if out.status.success() {
                    InstallResult {
                        success: true,
                        message: "OpenClaw 安装成功".to_string(),
                        error: None,
                    }
                } else {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    InstallResult {
                        success: false,
                        message: "".to_string(),
                        error: Some(stderr.to_string()),
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
}

fn upgrade_openclaw() -> InstallResult {
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
                InstallResult {
                    success: true,
                    message: "OpenClaw 升级成功".to_string(),
                    error: None,
                }
            } else {
                let stderr = String::from_utf8_lossy(&out.stderr);
                let stdout = String::from_utf8_lossy(&out.stdout);
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
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            format!("stdout: {}\nstderr: {}\nsuccess: {}", stdout, stderr, out.status.success())
        }
        Err(e) => format!("error: {}", e),
    }
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
    let len = json_str.len();
    let server_base = get_server_api_base();
    let host = server_base.trim_start_matches("http://");

    let request = format!(
        "POST /api/launcher-logs/upload HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
        host,
        len,
        json_str
    );

    if let Ok(mut stream) = TcpStream::connect(host) {
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
        if port != LAUNCHER_HTTP_PORT && is_port_open(port) {
            return Some(port);
        }
    }
    None
}

fn auto_upgrade_launcher() -> InstallResult {
    InstallResult {
        success: true,
        message: "请手动下载新版 Launcher".to_string(),
        error: Some("Launcher 升级需要手动下载安装".to_string()),
    }
}

fn handle_http_request(req: &str) -> Option<String> {
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
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{}",
            serde_json::to_string(&status).unwrap()
        ));
    }

    if req.starts_with("GET /api/system-info") {
        let sys_info = get_system_info();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{}",
            serde_json::to_string(&sys_info).unwrap()
        ));
    }

    if req.starts_with("POST /api/launch") {
        let fix_output = fix_openclaw_config_with_output();

        #[cfg(target_os = "windows")]
        let output = Command::new("cmd")
            .args(["/C", "openclaw", "gateway", "--port", "18789"])
            .creation_flags(CREATE_NO_WINDOW)
            .output();

        #[cfg(not(target_os = "windows"))]
        let output = Command::new("openclaw")
            .args(["gateway", "--port", "18789"])
            .output();

        let mut logs = String::new();
        logs.push_str("=== fix_openclaw_config output ===\n");
        logs.push_str(&fix_output);
        logs.push_str("\n=== launch output ===\n");

        let launch_result = match output {
            Ok(out) => {
                if !out.stdout.is_empty() {
                    logs.push_str("STDOUT:\n");
                    logs.push_str(&String::from_utf8_lossy(&out.stdout));
                }
                if !out.stderr.is_empty() {
                    logs.push_str("STDERR:\n");
                    logs.push_str(&String::from_utf8_lossy(&out.stderr));
                }
                if out.status.success() {
                    logs.push_str("\n[SUCCESS] Gateway started");
                    LaunchResult { success: true, error: None }
                } else {
                    logs.push_str(&format!("\n[FAILED] Exit code: {:?}", out.status.code()));
                    LaunchResult { success: false, error: Some(format!("Exit code: {:?}", out.status.code())) }
                }
            }
            Err(e) => {
                logs.push_str(&format!("\n[ERROR] {}\n", e));
                LaunchResult { success: false, error: Some(e.to_string()) }
            }
        };

        upload_launcher_logs(&logs);

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&launch_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/install") {
        let install_result = install_openclaw();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{}",
            serde_json::to_string(&install_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/auto-upgrade") {
        let upgrade_result = auto_upgrade_launcher();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{}",
            serde_json::to_string(&upgrade_result).unwrap()
        ));
    }

    if req.starts_with("POST /api/upgrade") {
        let upgrade_result = upgrade_openclaw();
        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n{}",
            serde_json::to_string(&upgrade_result).unwrap()
        ));
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
                    let mut buffer = [0; 4096];
                    if let Ok(size) = stream.read(&mut buffer) {
                        let request = String::from_utf8_lossy(&buffer[..size]).to_string();
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
    let fix_output = fix_openclaw_config_with_output();

    #[cfg(target_os = "windows")]
    let output = Command::new("cmd")
        .args(["/C", "openclaw", "gateway", "--port", "18789"])
        .creation_flags(CREATE_NO_WINDOW)
        .output();

    #[cfg(not(target_os = "windows"))]
    let output = Command::new("openclaw")
        .args(["gateway", "--port", "18789"])
        .output();

    let mut logs = String::new();
    logs.push_str("=== fix_openclaw_config output ===\n");
    logs.push_str(&fix_output);
    logs.push_str("\n=== launch output ===\n");

    let launch_result = match output {
        Ok(out) => {
            if !out.stdout.is_empty() {
                logs.push_str("STDOUT:\n");
                logs.push_str(&String::from_utf8_lossy(&out.stdout));
            }
            if !out.stderr.is_empty() {
                logs.push_str("STDERR:\n");
                logs.push_str(&String::from_utf8_lossy(&out.stderr));
            }
            if out.status.success() {
                logs.push_str("\n[SUCCESS] Gateway started");
                LaunchResult { success: true, error: None }
            } else {
                logs.push_str(&format!("\n[FAILED] Exit code: {:?}", out.status.code()));
                LaunchResult { success: false, error: Some(format!("Exit code: {:?}", out.status.code())) }
            }
        }
        Err(e) => {
            logs.push_str(&format!("\n[ERROR] {}\n", e));
            LaunchResult { success: false, error: Some(e.to_string()) }
        }
    };

    upload_launcher_logs(&logs);

    launch_result
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
        .setup(|app| {
            log::info!("OpenClaw Launcher started");

            #[cfg(any(test, debug_assertions))]
            {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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
            get_installed
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
