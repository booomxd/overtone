//! Overtone's launcher: starts the installed Spotify with a local DevTools
//! port, injects `runtime/overtone.js` into its UI, and keeps it injected
//! across reloads until Spotify exits.

#![windows_subsystem = "windows"]

use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::Command;
use std::time::{Duration, Instant};

use serde_json::{Value, json};
use tungstenite::Message;

/// The DevTools port. Fixed, so a second launch finds a Spotify that is
/// already running under Overtone instead of restarting it. Chromium binds it
/// to 127.0.0.1 and rejects WebSocket connections from web pages.
const PORT: u16 = 47391;
const RUNTIME: &str = include_str!("../runtime/overtone.js");

fn main() {
    if let Err(e) = run() {
        log(&format!("error: {e}"));
        message_box(&format!("{e}\n\nDetails are in {}", log_path().display()));
    }
}

fn run() -> Result<(), String> {
    let exe = spotify_exe()?;
    let page = match page_socket() {
        // Already running under Overtone (e.g. launched twice): attach.
        Some(url) => url,
        None => {
            if spotify_running() {
                log("restarting Spotify with the DevTools port");
                let _ = Command::new("taskkill").args(["/IM", "Spotify.exe", "/F"]).output();
                std::thread::sleep(Duration::from_millis(1500));
            }
            Command::new(&exe)
                .arg(format!("--remote-debugging-port={PORT}"))
                .spawn()
                .map_err(|e| format!("Could not start Spotify ({}): {e}", exe.display()))?;
            wait_for_page(Duration::from_secs(45))?
        }
    };
    inject(&page)
}

/// The classic installer's Spotify. The Microsoft Store build is sandboxed
/// and can't be started with extra flags.
fn spotify_exe() -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA is not set")?;
    let exe = PathBuf::from(appdata).join("Spotify").join("Spotify.exe");
    if exe.exists() {
        Ok(exe)
    } else {
        Err("Spotify isn't installed in %APPDATA%\\Spotify.\n\nInstall it from spotify.com/download. \
             The Microsoft Store version can't be modded."
            .into())
    }
}

fn spotify_running() -> bool {
    Command::new("tasklist")
        .args(["/FI", "IMAGENAME eq Spotify.exe", "/NH"])
        .output()
        .is_ok_and(|o| String::from_utf8_lossy(&o.stdout).contains("Spotify.exe"))
}

/// GET over plain HTTP from the local DevTools server.
fn http_get(path: &str) -> Option<String> {
    let mut s = TcpStream::connect_timeout(&([127, 0, 0, 1], PORT).into(), Duration::from_millis(500)).ok()?;
    s.set_read_timeout(Some(Duration::from_secs(3))).ok()?;
    write!(s, "GET {path} HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\n\r\n").ok()?;
    // Chromium keeps the connection open, so read exactly Content-Length.
    let mut data = Vec::new();
    let mut chunk = [0u8; 16384];
    loop {
        let n = s.read(&mut chunk).ok()?;
        if n == 0 {
            return None;
        }
        data.extend_from_slice(&chunk[..n]);
        let text = String::from_utf8_lossy(&data);
        if let Some((head, body)) = text.split_once("\r\n\r\n") {
            let length: usize = head
                .lines()
                .find_map(|l| l.to_ascii_lowercase().strip_prefix("content-length:").map(|v| v.trim().to_string()))?
                .parse()
                .ok()?;
            if body.len() >= length {
                return Some(body[..length].to_string());
            }
        }
    }
}

/// The WebSocket URL of Spotify's UI page, if Spotify is serving DevTools.
fn page_socket() -> Option<String> {
    let targets: Value = serde_json::from_str(&http_get("/json/list")?).ok()?;
    targets.as_array()?.iter().find_map(|t| {
        let is_ui = t["type"] == "page" && t["url"].as_str().is_some_and(|u| u.contains("xpui"));
        is_ui.then(|| t["webSocketDebuggerUrl"].as_str().map(String::from)).flatten()
    })
}

fn wait_for_page(timeout: Duration) -> Result<String, String> {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if let Some(url) = page_socket() {
            return Ok(url);
        }
        std::thread::sleep(Duration::from_millis(300));
    }
    Err("Spotify started, but its window never became ready for Overtone.".into())
}

/// Injects the runtime now and on every reload, then waits until Spotify
/// closes the page; the injection only lasts as long as this connection.
fn inject(url: &str) -> Result<(), String> {
    let (mut socket, _) = tungstenite::connect(url).map_err(|e| format!("Could not connect to Spotify: {e}"))?;
    let calls = [
        json!({"id": 1, "method": "Page.enable"}),
        json!({"id": 2, "method": "Page.addScriptToEvaluateOnNewDocument", "params": {"source": RUNTIME}}),
        json!({"id": 3, "method": "Runtime.evaluate", "params": {"expression": RUNTIME}}),
    ];
    for call in calls {
        socket.send(Message::text(call.to_string())).map_err(|e| e.to_string())?;
    }
    log("injected");
    loop {
        match socket.read() {
            Ok(Message::Text(text)) => {
                let v: Value = serde_json::from_str(&text).unwrap_or_default();
                if v.get("error").is_some() || v["result"]["exceptionDetails"].is_object() {
                    log(&format!("devtools: {text}"));
                }
            }
            Ok(Message::Close(_)) | Err(_) => break,
            Ok(_) => {}
        }
    }
    log("Spotify closed");
    Ok(())
}

fn log_path() -> PathBuf {
    let dir = PathBuf::from(std::env::var("APPDATA").unwrap_or_default()).join("Overtone");
    let _ = std::fs::create_dir_all(&dir);
    dir.join("launcher.log")
}

fn log(line: &str) {
    let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_secs());
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(log_path()) {
        let _ = writeln!(f, "[{secs}] {line}");
    }
}

#[link(name = "user32")]
unsafe extern "system" {
    fn MessageBoxW(window: *mut std::ffi::c_void, text: *const u16, caption: *const u16, kind: u32) -> i32;
}

/// A blocking error dialog; the launcher has no console window.
fn message_box(text: &str) {
    let wide = |s: &str| s.encode_utf16().chain([0]).collect::<Vec<u16>>();
    const MB_ICONERROR: u32 = 0x10;
    // SAFETY: both strings are NUL-terminated and outlive the call.
    unsafe { MessageBoxW(std::ptr::null_mut(), wide(text).as_ptr(), wide("Overtone").as_ptr(), MB_ICONERROR) };
}
