use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::process::Command;
use tauri::{Manager, Emitter, tray::{TrayIconBuilder, MouseButton, MouseButtonState, TrayIconEvent}, menu::{Menu, MenuItem}};

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

static HTTP_PORT: u16 = 18790;

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

fn check_openclaw_installed() -> (bool, Option<String>, Option<String>) {
    for dir in get_openclaw_directories() {
        if dir.exists() && dir.is_dir() {
            let version_file = dir.join("version");
            let version = if version_file.exists() {
                fs::read_to_string(&version_file).ok().map(|v| v.trim().to_string())
            } else {
                Some("unknown".to_string())
            };
            return (true, Some(dir.to_string_lossy().to_string()), version);
        }
    }
    (false, None, None)
}

fn check_port_available(port: u16) -> bool {
    TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

fn check_gateway_port() -> Option<u16> {
    for port in 18789..18796 {
        if !check_port_available(port) {
            return Some(port);
        }
    }
    None
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

    if req.starts_with("POST /api/launch") {
        #[cfg(target_os = "windows")]
        let result = Command::new("cmd").args(["/C", "start", "openclaw"]).spawn();

        #[cfg(not(target_os = "windows"))]
        let result = Command::new("openclaw").spawn();

        let launch_result = match result {
            Ok(_) => LaunchResult { success: true, error: None },
            Err(e) => LaunchResult { success: false, error: Some(e.to_string()) },
        };

        return Some(format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{}",
            serde_json::to_string(&launch_result).unwrap()
        ));
    }

    Some("HTTP/1.1 404 Not Found\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\n\r\n{\"error\":\"Not Found\"}".to_string())
}

fn start_http_server() {
    std::thread::spawn(move || {
        let listener = TcpListener::bind(format!("127.0.0.1:{}", HTTP_PORT)).expect("Failed to bind port");
        log::info!("HTTP API Server started on http://127.0.0.1:{}", HTTP_PORT);

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
fn get_system_info() -> serde_json::Value {
    serde_json::json!({
        "platform": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
    })
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
    #[cfg(target_os = "windows")]
    let result = Command::new("cmd").args(["/C", "start", "openclaw"]).spawn();

    #[cfg(not(target_os = "windows"))]
    let result = Command::new("openclaw").spawn();

    match result {
        Ok(_) => LaunchResult { success: true, error: None },
        Err(e) => LaunchResult { success: false, error: Some(e.to_string()) },
    }
}

#[tauri::command]
fn check_port(port: u16) -> bool {
    !check_port_available(port)
}

#[tauri::command]
fn get_installed() -> (bool, Option<String>, Option<String>) {
    check_openclaw_installed()
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

            let show_item = MenuItem::with_id(app, "show", "显示窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

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
            get_system_info,
            check_openclaw_status,
            launch_openclaw,
            check_port,
            get_installed
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
