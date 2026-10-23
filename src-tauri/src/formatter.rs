//! Format an unsaved, allowlisted C buffer without reading project configuration.
use crate::workspace::SOURCE_LIMIT;
use std::{
    io::{Read, Write},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

fn validate(name: &str, content: &str) -> Result<(), String> {
    if !crate::workspace::editable_c_source(name) {
        return Err("Formatting is available for editable C sources and headers only".into());
    }
    if content.len() > SOURCE_LIMIT || content.contains('\0') {
        return Err("Invalid source contents or file exceeds 256 KiB".into());
    }
    Ok(())
}

pub fn format(name: &str, content: &str) -> Result<String, String> {
    validate(name, content)?;
    let program = std::env::var_os("EIDOLON_CLANG_FORMAT").unwrap_or_else(|| "clang-format".into());
    let mut child = Command::new(program)
        .args(["--style={BasedOnStyle: LLVM, IndentWidth: 2}", &format!("--assume-filename={name}")])
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped())
        .spawn().map_err(|e| format!("Cannot launch clang-format: {e}. Install clang-format or set EIDOLON_CLANG_FORMAT to its executable path."))?;
    let mut stdin = child.stdin.take().ok_or("Formatter stdin unavailable")?;
    let stdout = child.stdout.take().ok_or("Formatter stdout unavailable")?;
    let stderr = child.stderr.take().ok_or("Formatter stderr unavailable")?;
    let input = content.as_bytes().to_vec();
    let writer = thread::spawn(move || stdin.write_all(&input));
    let output = thread::spawn(move || {
        let mut data = Vec::new();
        stdout
            .take((SOURCE_LIMIT + 1) as u64)
            .read_to_end(&mut data)
            .map(|_| data)
    });
    let errors = thread::spawn(move || {
        let mut data = Vec::new();
        stderr.take(8192).read_to_end(&mut data).map(|_| data)
    });
    let start = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if start.elapsed() < Duration::from_secs(10) => {
                thread::sleep(Duration::from_millis(20))
            }
            result => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(match result {
                    Err(e) => e.to_string(),
                    _ => "clang-format timed out".into(),
                });
            }
        }
    };
    let written = writer.join().map_err(|_| "Formatter input thread failed")?;
    let output = output
        .join()
        .map_err(|_| "Formatter output thread failed")?
        .map_err(|e| e.to_string())?;
    let errors = errors
        .join()
        .map_err(|_| "Formatter error thread failed")?
        .map_err(|e| e.to_string())?;
    if !status?.success() {
        return Err(format!(
            "clang-format failed: {}",
            String::from_utf8_lossy(&errors)
        ));
    }
    written.map_err(|e| e.to_string())?;
    if output.len() > SOURCE_LIMIT {
        return Err("Formatted source exceeds 256 KiB".into());
    }
    String::from_utf8(output).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_paths_readonly_files_and_invalid_buffers() {
        for name in [
            "../main.c",
            "platform_config.h",
            "plan.json",
            "startup.S",
            "linker.ld",
        ] {
            assert!(validate(name, "int x;").is_err());
        }
        assert!(validate("main.c", "a\0b").is_err());
        assert!(validate("main.c", &"x".repeat(SOURCE_LIMIT + 1)).is_err());
        for name in ["main.c", "pl031.c", "pl061.c", "rtc.h", "gpio.h"] {
            assert!(validate(name, "int x;").is_ok());
        }
    }
    #[test]
    #[ignore = "requires clang-format"]
    fn formats_real_c_and_is_idempotent() {
        let source = "int main(){int x=1;return x;}";
        for name in ["main.c", "pl031.c", "pl061.c", "rtc.h", "gpio.h"] {
            let result = format(name, source).unwrap();
            assert!(result.contains("int x = 1;"));
            assert_eq!(format(name, &result).unwrap(), result);
        }
    }
}
