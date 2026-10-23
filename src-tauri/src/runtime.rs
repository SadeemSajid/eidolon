//! Validated Arm virt firmware targets; no frontend-supplied paths or commands.
use crate::platform;
use crate::workspace::{self, CleanPreview, CleanScope, ProjectFiles, SourceEdit};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{
    env,
    fs::{self, File},
    io::{BufRead, BufReader, Read, Write},
    path::{Path, PathBuf},
    process::{Child, ChildStdin, Command, Stdio},
    sync::{Mutex, mpsc},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const LOG_LIMIT: u64 = 64 * 1024;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildProgress {
    pub stage: String,
    pub message: String,
}

fn progress(report: &impl Fn(BuildProgress), stage: &str, message: impl Into<String>) {
    report(BuildProgress {
        stage: stage.into(),
        message: message.into(),
    });
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct Plan {
    #[serde(default)]
    recipe: Option<Value>,
    platform: Value,
    qemu_version: [u64; 3],
    #[serde(flatten)]
    metadata: serde_json::Map<String, Value>,
    compile_commands: Vec<Vec<String>>,
    link_args: Vec<String>,
    qemu_args: Vec<String>,
    expected_serial: String,
    sources_sha256: Value,
}

#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub state: String,
    pub board_id: Option<String>,
    pub serial: String,
    pub message: String,
    pub artifact_directory: Option<String>,
    pub hello_verified: bool,
    pub source_edited: bool,
}

#[derive(Default)]
pub struct Runtime {
    session: Option<Session>,
    snapshot: Snapshot,
    project: Option<(PathBuf, Plan)>,
    edited: bool,
    description: Option<Value>,
}

pub type RuntimeState = Mutex<Runtime>;

struct Session {
    child: Child,
    input: ChildStdin,
    messages: mpsc::Receiver<Result<Value, String>>,
    directory: PathBuf,
    expected: Option<String>,
    started: Instant,
}

impl Drop for Session {
    fn drop(&mut self) {
        // Includes failed negotiation, unexpected exits and application shutdown.
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

fn read_log(path: &Path) -> String {
    let mut contents = String::new();
    if let Ok(file) = File::open(path) {
        let _ = file.take(LOG_LIMIT).read_to_string(&mut contents);
    }
    contents
}

fn tool(variable: &str, fallback: &str) -> String {
    env::var(variable).unwrap_or_else(|_| fallback.into())
}

fn execute(program: &str, args: &[String], directory: &Path) -> Result<String, String> {
    let stdout = File::create(directory.join("tool.stdout")).map_err(|e| e.to_string())?;
    let stderr = File::create(directory.join("tool.stderr")).map_err(|e| e.to_string())?;
    let child = Command::new(program)
        .args(args)
        .current_dir(directory)
        .stdin(Stdio::null())
        .stdout(stdout)
        .stderr(stderr)
        .spawn()
        .map_err(|e| {
            format!("Cannot start {program}: {e}. See docs/BARE_METAL.md for tool setup.")
        })?;
    // Always reap on timeout or an error while waiting.
    struct Guard(Child);
    impl Drop for Guard {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    let mut guard = Guard(child);
    let deadline = Instant::now() + Duration::from_secs(60);
    loop {
        match guard.0.try_wait().map_err(|e| e.to_string())? {
            Some(status) => {
                let output = read_log(&directory.join("tool.stdout"));
                if !status.success() {
                    return Err(format!(
                        "{program} failed ({status}):\n{output}{}",
                        read_log(&directory.join("tool.stderr"))
                    ));
                }
                return Ok(output);
            }
            None if Instant::now() >= deadline => {
                return Err(format!("{program} timed out after 60 seconds"));
            }
            None => thread::sleep(Duration::from_millis(20)),
        }
    }
}

fn qemu_path() -> Result<String, String> {
    if let Ok(path) = env::var("EIDOLON_QEMU") {
        return Ok(path);
    }
    let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../build/qemu/qemu-system-aarch64");
    if path.is_file() {
        return Ok(path.to_string_lossy().into_owned());
    }
    Err("Set EIDOLON_QEMU to the pinned QEMU 11.1.2 aarch64 build. See docs/BARE_METAL.md.".into())
}

impl Session {
    fn receive(&self, predicate: impl Fn(&Value) -> bool) -> Result<Value, String> {
        let deadline = Instant::now() + Duration::from_secs(3);
        loop {
            let remaining = deadline.saturating_duration_since(Instant::now());
            let value = self
                .messages
                .recv_timeout(remaining)
                .map_err(|e| format!("QMP response unavailable: {e}"))??;
            if value.get("error").is_some() {
                return Err(format!("QMP rejected the command: {value}"));
            }
            if predicate(&value) {
                return Ok(value);
            }
        }
    }

    fn command(&mut self, name: &str) -> Result<Value, String> {
        writeln!(self.input, "{}", json!({"execute": name, "id": name}))
            .map_err(|e| e.to_string())?;
        self.input.flush().map_err(|e| e.to_string())?;
        self.receive(|value| value.get("id").and_then(Value::as_str) == Some(name))
    }

    fn stop(&mut self) -> Result<(), String> {
        self.command("quit")?;
        let deadline = Instant::now() + Duration::from_secs(3);
        while self.child.try_wait().map_err(|e| e.to_string())?.is_none() {
            if Instant::now() >= deadline {
                return Err("QEMU did not exit after QMP quit; it was terminated.".into());
            }
            thread::sleep(Duration::from_millis(20));
        }
        Ok(())
    }
}

impl Runtime {
    pub fn run(
        &mut self,
        board_id: &str,
        cache: &Path,
        report: impl Fn(BuildProgress),
    ) -> Result<Snapshot, String> {
        platform::default_description(board_id)?;
        if self.session.is_some() {
            return Err("Stop the current platform before starting another run.".into());
        }
        self.snapshot = Snapshot {
            state: "building".into(),
            board_id: Some(board_id.into()),
            artifact_directory: self
                .project
                .as_ref()
                .map(|(dir, _)| dir.to_string_lossy().into_owned()),
            source_edited: self.edited,
            ..Snapshot::default()
        };
        progress(
            &report,
            "validate",
            "Resolving the registered Arm virt firmware target.",
        );
        match self.prepare(cache, &report) {
            Ok(session) => {
                self.snapshot.artifact_directory =
                    Some(session.directory.to_string_lossy().into_owned());
                self.snapshot.state = "running".into();
                self.snapshot.message = "Waiting for hello-world serial output…".into();
                self.session = Some(session);
                progress(
                    &report,
                    "complete",
                    "Build complete. QEMU resumed; waiting for serial output.",
                );
                self.status()
            }
            Err(error) => {
                self.snapshot.state = "failed".into();
                self.snapshot.message = error.clone();
                progress(&report, "failed", error.clone());
                Err(error)
            }
        }
    }

    fn generate_project(
        &mut self,
        cache: &Path,
        report: &impl Fn(BuildProgress),
    ) -> Result<(), String> {
        let description = self
            .description
            .clone()
            .unwrap_or(platform::default_description(platform::ARM_VIRT_BOARD)?);
        self.generate_description(cache, report, &description)
    }

    fn generate_description(
        &mut self,
        cache: &Path,
        report: &impl Fn(BuildProgress),
        description: &Value,
    ) -> Result<(), String> {
        let run_id = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_nanos();
        let directory = workspace::project_root(cache)?.join(format!("arm-virt-{run_id}"));
        fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
        let python = tool("EIDOLON_PYTHON", "python3");
        progress(
            report,
            "generate",
            "Resolving platform, selecting components and generating firmware sources…",
        );
        execute(
            &python,
            &[
                "-c".into(),
                platform::GENERATOR.into(),
                "--platform-json".into(),
                serde_json::to_string(description).map_err(|e| e.to_string())?,
                "--components-json".into(),
                platform::component_assets().to_string(),
                "--output".into(),
                directory.to_string_lossy().into_owned(),
            ],
            &directory,
        )?;
        let plan: Plan = serde_json::from_slice(
            &fs::read(directory.join("plan.json")).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
        self.description = Some(plan.platform.clone());
        self.snapshot.artifact_directory = Some(directory.to_string_lossy().into_owned());
        self.snapshot.board_id = Some(platform::ARM_VIRT_BOARD.into());
        self.snapshot.source_edited = false;
        self.edited = false;
        self.project = Some((directory, plan));
        Ok(())
    }

    fn prepare(
        &mut self,
        cache: &Path,
        report: &impl Fn(BuildProgress),
    ) -> Result<Session, String> {
        if self.project.is_none() {
            self.generate_project(cache, report)?;
        } else {
            progress(
                report,
                "sources",
                "Using saved project sources; regeneration is not performed.",
            );
        }
        let (directory, mut plan) = self.project.clone().ok_or("No generated project")?;
        workspace::regular_directory(&directory)?;
        workspace::validate_outputs(&directory)?;
        let mut hashes = serde_json::Map::new();
        for name in workspace::SOURCES {
            if plan.sources_sha256.get(name).is_none() {
                continue;
            }
            let path = directory.join(name);
            workspace::regular_file(&path)?;
            let bytes = fs::read(path).map_err(|e| e.to_string())?;
            hashes.insert(name.into(), format!("{:x}", Sha256::digest(bytes)).into());
        }
        // The trusted in-memory plan owns commands; disk manifests are inspect-only.
        let actual_hashes = Value::Object(hashes);
        self.edited |= actual_hashes != plan.sources_sha256;
        self.snapshot.source_edited = self.edited;
        plan.sources_sha256 = actual_hashes;
        let clang = tool("EIDOLON_CLANG", "clang");
        let linker = tool("EIDOLON_LLD", "ld.lld");
        let qemu = qemu_path()?;
        progress(report, "tools", "Checking QEMU, Clang and LLD…");
        let version_args = vec!["--version".into()];
        let qemu_version = execute(&qemu, &version_args, &directory)?;
        // QMP also checks the exact numeric version before CPUs are started.
        let clang_version = execute(&clang, &version_args, &directory)?;
        let linker_version = execute(&linker, &version_args, &directory)?;
        progress(
            report,
            "tools",
            format!(
                "{}\n{}\n{}",
                qemu_version.trim(),
                clang_version.trim(),
                linker_version.trim()
            ),
        );
        for (index, args) in plan.compile_commands.iter().enumerate() {
            progress(
                report,
                "compile",
                format!(
                    "Compiling source {}/{}: {}",
                    index + 1,
                    plan.compile_commands.len(),
                    args.join(" ")
                ),
            );
            let output = execute(&clang, args, &directory)?;
            let warnings = read_log(&directory.join("tool.stderr"));
            if !output.is_empty() || !warnings.is_empty() {
                progress(report, "compile", format!("{output}{warnings}"));
            }
        }
        progress(report, "link", "Linking firmware.elf…");
        let output = execute(&linker, &plan.link_args, &directory)?;
        let warnings = read_log(&directory.join("tool.stderr"));
        if !output.is_empty() || !warnings.is_empty() {
            progress(report, "link", format!("{output}{warnings}"));
        }
        fs::write(directory.join("run.json"), serde_json::to_vec_pretty(&json!({
            "plan": plan, "tools": {"python": tool("EIDOLON_PYTHON", "python3"), "clang": clang, "linker": linker, "qemu": qemu},
            "versions": {"qemu": qemu_version, "clang": clang_version, "linker": linker_version},
            "sourceEdited": self.edited,
            "expectedQemuSourceCommit": "4fc49f46dc95d4a27de2509e7fceb2931e91faeb"
        })).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
        progress(
            report,
            "launch",
            "Starting QEMU paused and negotiating QMP…",
        );
        let stderr = File::create(directory.join("qemu.stderr")).map_err(|e| e.to_string())?;
        let mut child = Command::new(qemu)
            .args(&plan.qemu_args)
            .current_dir(&directory)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(stderr)
            .spawn()
            .map_err(|e| format!("Cannot start QEMU: {e}"))?;
        let input = child.stdin.take().expect("piped stdin");
        let output = child.stdout.take().expect("piped stdout");
        let (tx, messages) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(output).lines() {
                let message = line
                    .map_err(|e| e.to_string())
                    .and_then(|line| serde_json::from_str(&line).map_err(|e| e.to_string()));
                if tx.send(message).is_err() {
                    break;
                }
            }
        });
        let mut session = Session {
            child,
            input,
            messages,
            directory,
            expected: if self.edited {
                None
            } else {
                Some(plan.expected_serial)
            },
            started: Instant::now(),
        };
        let greeting = session
            .receive(|v| v.get("QMP").is_some())
            .map_err(|error| {
                format!(
                    "{error}\n{}",
                    read_log(&session.directory.join("qemu.stderr"))
                )
            })?;
        let version = &greeting["QMP"]["version"]["qemu"];
        if version["major"] != plan.qemu_version[0]
            || version["minor"] != plan.qemu_version[1]
            || version["micro"] != plan.qemu_version[2]
        {
            return Err(format!(
                "Expected QEMU {:?}, received {version}. CPUs were not started.",
                plan.qemu_version
            ));
        }
        session.command("qmp_capabilities")?;
        session.command("cont")?;
        Ok(session)
    }

    fn require_stopped(&self) -> Result<(), String> {
        if self.session.is_some() {
            return Err("Stop the platform before editing, regenerating or cleaning.".into());
        }
        Ok(())
    }

    pub fn project_files(&self) -> Result<Option<ProjectFiles>, String> {
        self.project
            .as_ref()
            .map(|(dir, _)| workspace::files(dir))
            .transpose()
    }

    pub fn format_source(&mut self, name: &str, content: &str) -> Result<String, String> {
        self.require_stopped()?;
        let (directory, _) = self.project.as_ref().ok_or("Generate a project first")?;
        let files = workspace::files(directory)?;
        if !files
            .files
            .iter()
            .any(|file| file.name == name && file.editable)
        {
            return Err("Only editable project files can be formatted".into());
        }
        crate::formatter::format(name, content)
    }

    pub fn save_sources(&mut self, edits: Vec<SourceEdit>) -> Result<Snapshot, String> {
        self.require_stopped()?;
        let (directory, _) = self.project.as_ref().ok_or("Generate a project first")?;
        workspace::save(directory, &edits)?;
        self.edited = true;
        self.snapshot.source_edited = true;
        self.snapshot.state = "ready".into();
        self.snapshot.message = "Source edits saved. Ready to rebuild.".into();
        self.snapshot.serial.clear();
        self.snapshot.hello_verified = false;
        Ok(self.snapshot.clone())
    }

    pub fn regenerate(&mut self, board_id: &str, cache: &Path) -> Result<Snapshot, String> {
        self.require_stopped()?;
        platform::default_description(board_id)?;
        self.generate_project(cache, &|_| {})?;
        self.snapshot.state = "ready".into();
        self.snapshot.message =
            "Fresh project generated. Previous project directories are retained.".into();
        self.snapshot.serial.clear();
        self.snapshot.hello_verified = false;
        Ok(self.snapshot.clone())
    }

    pub fn configure_platform(
        &mut self,
        description_json: &str,
        cache: &Path,
    ) -> Result<Snapshot, String> {
        self.require_stopped()?;
        if description_json.len() > 64 * 1024 {
            return Err("Platform description exceeds 64 KiB".into());
        }
        let description: Value = serde_json::from_str(description_json)
            .map_err(|error| format!("Invalid platform JSON: {error}"))?;
        // The embedded resolver validates capabilities before writing source files.
        // A rejected configuration leaves the active project and plan untouched.
        self.generate_description(cache, &|_| {}, &description)?;
        self.snapshot.state = "ready".into();
        self.snapshot.message = "Platform resolved; modular firmware project generated.".into();
        self.snapshot.serial.clear();
        self.snapshot.hello_verified = false;
        Ok(self.snapshot.clone())
    }

    pub fn clean_preview(&self, cache: &Path, scope: CleanScope) -> Result<CleanPreview, String> {
        self.require_stopped()?;
        let qemu = if matches!(scope, CleanScope::Full) {
            let repo = Path::new(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .ok_or("Missing repository path")?;
            workspace::local_qemu_build(repo)?
        } else {
            None
        };
        workspace::preview(
            cache,
            self.project.as_ref().map(|(dir, _)| dir.as_path()),
            scope,
            qemu,
        )
    }

    pub fn clean(
        &mut self,
        cache: &Path,
        scope: CleanScope,
        expected_targets: Vec<String>,
    ) -> Result<Snapshot, String> {
        let preview = self.clean_preview(cache, scope)?;
        if preview.targets != expected_targets {
            return Err("Cleanup targets changed. Review a new preview before deleting.".into());
        }
        workspace::delete(&preview)?;
        if !matches!(scope, CleanScope::Outputs) {
            self.project = None;
            self.edited = false;
            self.snapshot = Snapshot::default();
        }
        self.snapshot.state = if self.project.is_some() {
            "ready"
        } else {
            "idle"
        }
        .into();
        self.snapshot.serial.clear();
        self.snapshot.hello_verified = false;
        self.snapshot.message = "Selected build files deleted.".into();
        Ok(self.snapshot.clone())
    }

    pub fn status(&mut self) -> Result<Snapshot, String> {
        let Some(session) = self.session.as_mut() else {
            if self.snapshot.state.is_empty() {
                self.snapshot.state = "idle".into();
            }
            return Ok(self.snapshot.clone());
        };
        self.snapshot.serial = read_log(&session.directory.join("serial.log"));
        self.snapshot.hello_verified = session
            .expected
            .as_ref()
            .is_some_and(|expected| self.snapshot.serial.contains(expected));
        let exit = session.child.try_wait().map_err(|e| e.to_string())?;
        if let Some(exit) = exit {
            self.snapshot.state = "exited".into();
            self.snapshot.message = format!(
                "QEMU exited ({exit}). {}",
                read_log(&session.directory.join("qemu.stderr"))
            );
            self.session = None;
        } else if session.expected.is_some()
            && !self.snapshot.hello_verified
            && session.started.elapsed() > Duration::from_secs(10)
        {
            self.snapshot.state = "failed".into();
            self.snapshot.message =
                "No expected generated firmware output within 10 seconds; QEMU was stopped.".into();
            self.session = None;
        } else if session.expected.is_none() {
            self.snapshot.message = "Edited firmware running.".into();
        } else if self.snapshot.hello_verified {
            self.snapshot.message =
                "Generated firmware output verified at EL1. CPU is waiting for interrupts.".into();
        }
        Ok(self.snapshot.clone())
    }

    pub fn stop(&mut self) -> Result<Snapshot, String> {
        if let Some(mut session) = self.session.take() {
            let outcome = session.stop();
            self.snapshot.serial = read_log(&session.directory.join("serial.log"));
            self.snapshot.hello_verified = session
                .expected
                .as_ref()
                .is_some_and(|expected| self.snapshot.serial.contains(expected));
            self.snapshot.state = "stopped".into();
            self.snapshot.message = outcome.err().unwrap_or_else(|| "Platform stopped.".into());
        }
        Ok(self.snapshot.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_other_boards_without_starting_a_process() {
        let mut runtime = Runtime::default();
        assert!(
            runtime
                .run("raspi4b", Path::new("unused"), |_| {})
                .unwrap_err()
                .contains("Only the Arm virt")
        );
        assert!(runtime.session.is_none());
    }

    #[test]
    fn idle_status_and_stop_are_safe() {
        let mut runtime = Runtime::default();
        assert_eq!(runtime.status().unwrap().state, "idle");
        assert_eq!(runtime.stop().unwrap().state, "idle");
    }

    #[test]
    #[ignore = "requires Python, AArch64 Clang/LLD and the pinned QEMU build"]
    fn peripheral_components_boots_and_stops() {
        let cache = Path::new(env!("CARGO_MANIFEST_DIR")).join("../build/runtime-peripheral-smoke");
        let mut runtime = Runtime::default();
        let description = include_str!("../../platforms/arm-virt-peripherals.json");
        runtime.configure_platform(description, &cache).unwrap();
        runtime
            .run(platform::ARM_VIRT_BOARD, &cache, |_| {})
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(12);
        loop {
            let snapshot = runtime.status().unwrap();
            assert_eq!(snapshot.state, "running", "{}", snapshot.message);
            if snapshot.hello_verified {
                assert!(snapshot.serial.contains("Peripheral demo: PASS"));
                break;
            }
            assert!(
                Instant::now() < deadline,
                "generated peripheral firmware timeout"
            );
            thread::sleep(Duration::from_millis(20));
        }
        runtime.stop().unwrap();
        let files = runtime.project_files().unwrap().unwrap();
        for name in ["pl031.c", "pl061.c", "rtc.h", "gpio.h"] {
            let file = files.files.iter().find(|file| file.name == name).unwrap();
            assert!(file.editable);
            runtime
                .save_sources(vec![SourceEdit {
                    name: name.into(),
                    content: file.content.clone() + "\n",
                }])
                .unwrap();
        }
        runtime
            .run(platform::ARM_VIRT_BOARD, &cache, |_| {})
            .unwrap();
        let deadline = Instant::now() + Duration::from_secs(12);
        loop {
            let snapshot = runtime.status().unwrap();
            assert_eq!(snapshot.state, "running", "{}", snapshot.message);
            if snapshot.serial.contains("Peripheral demo: PASS") {
                assert!(snapshot.source_edited);
                assert!(!snapshot.hello_verified);
                assert!(snapshot.serial.contains("RTC load/read: PASS"));
                assert!(snapshot.serial.contains("GPIO masked read/write: PASS"));
                assert!(snapshot.serial.contains("Peripheral demo: PASS"));
                break;
            }
            assert!(Instant::now() < deadline, "peripheral firmware timeout");
            thread::sleep(Duration::from_millis(20));
        }
        runtime.stop().unwrap();
        let directory = &runtime.project.as_ref().unwrap().0;
        let record: Value =
            serde_json::from_slice(&fs::read(directory.join("run.json")).unwrap()).unwrap();
        for name in ["pl031.c", "pl061.c", "rtc.h", "gpio.h"] {
            let bytes = fs::read(directory.join(name)).unwrap();
            assert_eq!(
                record["plan"]["sourcesSha256"][name],
                format!("{:x}", Sha256::digest(bytes))
            );
        }
        let preview = runtime.clean_preview(&cache, CleanScope::Outputs).unwrap();
        assert!(
            preview
                .targets
                .iter()
                .any(|path| path.ends_with("pl031.c.o"))
        );
        assert!(
            preview
                .targets
                .iter()
                .any(|path| path.ends_with("pl061.c.o"))
        );
        runtime
            .clean(&cache, CleanScope::Outputs, preview.targets)
            .unwrap();
        let files = runtime.project_files().unwrap().unwrap();
        assert!(files.files.iter().any(|file| file.name == "pl031.c"));
    }

    #[test]
    #[ignore = "requires Python, AArch64 Clang/LLD and the pinned QEMU build"]
    fn configured_arm_virt_boots_and_stops() {
        let cache = Path::new(env!("CARGO_MANIFEST_DIR")).join("../build/runtime-config-smoke");
        let mut runtime = Runtime::default();
        let baseline = platform::default_description(platform::ARM_VIRT_BOARD).unwrap();
        runtime
            .configure_platform(&baseline.to_string(), &cache)
            .unwrap();
        let original = runtime.project.as_ref().unwrap().0.clone();
        let mut invalid = baseline.clone();
        invalid["devices"][0]["base"] = json!("0x10000000");
        assert!(
            runtime
                .configure_platform(&invalid.to_string(), &cache)
                .is_err()
        );
        assert_eq!(runtime.project.as_ref().unwrap().0, original);
        assert_eq!(
            runtime.description.as_ref().unwrap()["cpu"]["model"],
            "cortex-a55"
        );

        let mut alternate = baseline;
        alternate["id"] = json!("runtime-a53-256m");
        alternate["cpu"]["model"] = json!("cortex-a53");
        alternate["backend"]["gicVersion"] = json!(2);
        alternate["memory"][0]["size"] = json!("0x10000000");
        alternate["firmware"]["entryOffset"] = json!("0x400000");
        alternate["firmware"]["stackSize"] = json!("0x8000");
        alternate["firmware"]["baud"] = json!(57600);
        alternate["firmware"]["message"] = json!("Configured through Rust");
        runtime
            .configure_platform(&alternate.to_string(), &cache)
            .unwrap();
        assert_ne!(runtime.project.as_ref().unwrap().0, original);
        let files = runtime.project_files().unwrap().unwrap();
        for name in ["platform.json", "platform_config.h", "plan.json"] {
            assert!(
                !files
                    .files
                    .iter()
                    .find(|file| file.name == name)
                    .unwrap()
                    .editable
            );
        }
        assert!(
            files
                .files
                .iter()
                .find(|file| file.name == "pl011.c")
                .unwrap()
                .editable
        );
        runtime
            .run(platform::ARM_VIRT_BOARD, &cache, |_| {})
            .unwrap();
        assert!(
            runtime
                .configure_platform(&alternate.to_string(), &cache)
                .is_err()
        );
        let deadline = Instant::now() + Duration::from_secs(12);
        loop {
            let snapshot = runtime.status().unwrap();
            assert_eq!(snapshot.state, "running", "{}", snapshot.message);
            if snapshot.hello_verified {
                assert!(
                    snapshot
                        .serial
                        .contains("Configured through Rust\r\nException level: EL1\r\n")
                );
                break;
            }
            assert!(Instant::now() < deadline, "configured firmware timeout");
            thread::sleep(Duration::from_millis(20));
        }
        runtime.stop().unwrap();
        runtime
            .regenerate(platform::ARM_VIRT_BOARD, &cache)
            .unwrap();
        assert_eq!(
            runtime.description.as_ref().unwrap()["cpu"]["model"],
            "cortex-a53"
        );
        assert_eq!(
            runtime.project.as_ref().unwrap().1.platform["memory"][0]["size"],
            "0x10000000"
        );
    }

    #[test]
    #[ignore = "requires Python, AArch64 Clang/LLD and the pinned QEMU build"]
    fn generated_hello_world_boots_and_stops() {
        let cache = Path::new(env!("CARGO_MANIFEST_DIR")).join("../build/runtime-smoke");
        let mut runtime = Runtime::default();
        let updates = std::cell::RefCell::new(Vec::new());
        let started = runtime
            .run("arm-virt-a55", &cache, |update| {
                updates.borrow_mut().push(update)
            })
            .unwrap();
        assert_eq!(started.state, "running");
        let updates = updates.into_inner();
        let position = |stage: &str| {
            updates
                .iter()
                .position(|update| update.stage == stage)
                .expect(stage)
        };
        assert!(position("generate") < position("compile"));
        assert!(position("compile") < position("link"));
        assert!(position("link") < position("launch"));
        assert!(position("launch") < position("complete"));
        assert!(updates.iter().all(|update| update.stage != "failed"));
        assert!(
            runtime
                .run("arm-virt-a55", &cache, |_| {})
                .unwrap_err()
                .contains("Stop the current")
        );
        let deadline = Instant::now() + Duration::from_secs(12);
        loop {
            let status = runtime.status().unwrap();
            assert_eq!(status.state, "running", "{}", status.message);
            if status.hello_verified {
                assert!(
                    status
                        .serial
                        .contains("Hello from Eidolon!\r\nException level: EL1\r\n")
                );
                break;
            }
            assert!(Instant::now() < deadline, "hello-world timeout");
            thread::sleep(Duration::from_millis(50));
        }
        let stopped = runtime.stop().unwrap();
        assert_eq!(stopped.state, "stopped");
        assert_eq!(stopped.message, "Platform stopped.");
        assert!(stopped.hello_verified);
        assert!(runtime.session.is_none());
        assert_eq!(runtime.stop().unwrap().state, "stopped");
        let original = runtime.project_files().unwrap().unwrap();
        let main = original
            .files
            .iter()
            .find(|file| file.name == "main.c")
            .unwrap();
        let changed = main
            .content
            .replace("Hello from Eidolon!", "Edited firmware says hello!");
        runtime
            .save_sources(vec![SourceEdit {
                name: "main.c".into(),
                content: changed.clone(),
            }])
            .unwrap();
        let rerun = std::cell::RefCell::new(Vec::new());
        runtime
            .run("arm-virt-a55", &cache, |update| {
                rerun.borrow_mut().push(update)
            })
            .unwrap();
        assert!(
            !rerun
                .borrow()
                .iter()
                .any(|update| update.stage == "generate")
        );
        let deadline = Instant::now() + Duration::from_secs(5);
        while !runtime
            .status()
            .unwrap()
            .serial
            .contains("Edited firmware says hello!")
        {
            assert!(Instant::now() < deadline, "edited source did not execute");
            thread::sleep(Duration::from_millis(20));
        }
        // Custom output must neither be labeled as the verified original nor
        // be killed by the original greeting's watchdog.
        runtime.session.as_mut().unwrap().started = Instant::now() - Duration::from_secs(11);
        let custom = runtime.status().unwrap();
        assert_eq!(custom.state, "running");
        assert!(custom.source_edited && !custom.hello_verified);
        assert!(!custom.serial.contains("Hello from Eidolon!"));
        assert!(runtime.save_sources(vec![]).is_err());
        assert!(runtime.regenerate("arm-virt-a55", &cache).is_err());
        assert!(runtime.clean_preview(&cache, CleanScope::Outputs).is_err());
        runtime.stop().unwrap();
        let preview = runtime.clean_preview(&cache, CleanScope::Outputs).unwrap();
        assert!(
            runtime
                .clean(&cache, CleanScope::Outputs, vec!["unexpected".into()])
                .is_err()
        );
        runtime
            .clean(&cache, CleanScope::Outputs, preview.targets)
            .unwrap();
        assert_eq!(
            fs::read_to_string(Path::new(&original.directory).join("main.c")).unwrap(),
            changed
        );
        assert!(!Path::new(&original.directory).join("firmware.elf").exists());
        runtime.regenerate("arm-virt-a55", &cache).unwrap();
        let fresh = runtime.project_files().unwrap().unwrap();
        assert_ne!(fresh.directory, original.directory);
        assert!(
            fresh
                .files
                .iter()
                .find(|file| file.name == "main.c")
                .unwrap()
                .content
                .contains("Hello from Eidolon!")
        );
        assert!(!runtime.snapshot.source_edited);
        // A compiler error must preserve the edited project and leave no guest.
        runtime
            .save_sources(vec![SourceEdit {
                name: "main.c".into(),
                content: "this is not C".into(),
            }])
            .unwrap();
        assert!(runtime.run("arm-virt-a55", &cache, |_| {}).is_err());
        assert!(runtime.session.is_none());
        assert_eq!(
            runtime
                .project_files()
                .unwrap()
                .unwrap()
                .files
                .iter()
                .find(|file| file.name == "main.c")
                .unwrap()
                .content,
            "this is not C"
        );
        runtime.regenerate("arm-virt-a55", &cache).unwrap();
        // Exercise unexpected process-exit detection on a second, fresh run.
        runtime.run("arm-virt-a55", &cache, |_| {}).unwrap();
        runtime.session.as_mut().unwrap().child.kill().unwrap();
        runtime.session.as_mut().unwrap().child.wait().unwrap();
        assert_eq!(runtime.status().unwrap().state, "exited");
        assert!(runtime.session.is_none());
    }
}
