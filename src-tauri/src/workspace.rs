//! Only named generated files and recognized build directories are exposed.
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};

pub const SOURCES: [&str; 8] = [
    "startup.S",
    "main.c",
    "linker.ld",
    "platform.c",
    "pl011.c",
    "console.h",
    "platform.h",
    "platform_config.h",
];
const EDITABLE: [&str; 7] = [
    "startup.S",
    "main.c",
    "linker.ld",
    "platform.c",
    "pl011.c",
    "console.h",
    "platform.h",
];
const FILES: [&str; 11] = [
    "main.c",
    "startup.S",
    "platform.c",
    "pl011.c",
    "console.h",
    "platform.h",
    "linker.ld",
    "platform_config.h",
    "platform.json",
    "plan.json",
    "run.json",
];
const OUTPUTS: [&str; 10] = [
    "startup.S.o",
    "main.c.o",
    "platform.c.o",
    "pl011.c.o",
    "firmware.elf",
    "serial.log",
    "qemu.stderr",
    "run.json",
    "tool.stdout",
    "tool.stderr",
];
pub const SOURCE_LIMIT: usize = 256 * 1024;

#[derive(Serialize)]
pub struct SourceFile {
    pub name: String,
    pub content: String,
    pub editable: bool,
}
#[derive(Deserialize)]
pub struct SourceEdit {
    pub name: String,
    pub content: String,
}
#[derive(Serialize)]
pub struct ProjectFiles {
    pub directory: String,
    pub files: Vec<SourceFile>,
}
#[derive(Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum CleanScope {
    Outputs,
    Projects,
    Full,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanPreview {
    pub targets: Vec<String>,
    pub includes_qemu: bool,
}

pub fn regular_directory(path: &Path) -> Result<(), String> {
    let meta = fs::symlink_metadata(path).map_err(|e| format!("{}: {e}", path.display()))?;
    if !meta.is_dir() || meta.file_type().is_symlink() {
        return Err(format!("Expected a regular directory: {}", path.display()));
    }
    Ok(())
}

pub fn regular_file(path: &Path) -> Result<(), String> {
    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    if !meta.is_file() || meta.file_type().is_symlink() {
        return Err(format!("Expected a regular file: {}", path.display()));
    }
    Ok(())
}

pub fn project_root(cache: &Path) -> Result<PathBuf, String> {
    fs::create_dir_all(cache).map_err(|e| e.to_string())?;
    let root = cache
        .canonicalize()
        .map_err(|e| e.to_string())?
        .join("bare-metal");
    if root.exists() || root.is_symlink() {
        regular_directory(&root)?;
    }
    Ok(root)
}

fn recognized_project(path: &Path) -> Result<(), String> {
    regular_directory(path)?;
    if !path
        .file_name()
        .and_then(|n| n.to_str())
        .is_some_and(|name| name.starts_with("arm-virt-"))
    {
        return Err("Unrecognized project directory".into());
    }
    let plan = path.join("plan.json");
    regular_file(&plan)?;
    let plan: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(plan).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let legacy = plan["recipe"]["id"] == "arm-virt-a55-hello-v1";
    let modular = plan["projectKind"] == "eidolon-bare-metal-v2"
        && plan["platform"]["backend"]["kind"] == "qemu-arm-virt";
    if !legacy && !modular {
        return Err("Unrecognized generated project".into());
    }
    Ok(())
}

pub fn files(directory: &Path) -> Result<ProjectFiles, String> {
    recognized_project(directory)?;
    let mut files = Vec::new();
    for name in FILES {
        let path = directory.join(name);
        if !path.exists() {
            continue;
        }
        regular_file(&path)?;
        if fs::metadata(&path).map_err(|e| e.to_string())?.len() > SOURCE_LIMIT as u64 {
            return Err(format!("{name} exceeds the editor's 256 KiB limit"));
        }
        files.push(SourceFile {
            name: name.into(),
            content: fs::read_to_string(path).map_err(|e| e.to_string())?,
            editable: EDITABLE.contains(&name),
        });
    }
    Ok(ProjectFiles {
        directory: directory.to_string_lossy().into_owned(),
        files,
    })
}

pub fn save(directory: &Path, edits: &[SourceEdit]) -> Result<(), String> {
    recognized_project(directory)?;
    if edits.is_empty() || edits.len() > EDITABLE.len() {
        return Err("Provide one or more editable source files".into());
    }
    let mut seen = std::collections::HashSet::new();
    for edit in edits {
        if !EDITABLE.contains(&edit.name.as_str()) || !seen.insert(&edit.name) {
            return Err("Only allowlisted firmware sources and headers may be edited".into());
        }
        if edit.content.len() > SOURCE_LIMIT || edit.content.contains('\0') {
            return Err("Invalid source contents or file exceeds 256 KiB".into());
        }
        regular_file(&directory.join(&edit.name))?;
    }
    for edit in edits {
        fs::write(directory.join(&edit.name), edit.content.as_bytes())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn validate_outputs(directory: &Path) -> Result<(), String> {
    for name in OUTPUTS {
        let path = directory.join(name);
        if path.exists() || path.is_symlink() {
            regular_file(&path)?;
        }
    }
    Ok(())
}

/// Only the repository-local QEMU build can be included in full clean. Never
/// follow EIDOLON_QEMU into an external installation or remove its source tree.
pub fn local_qemu_build(repo: &Path) -> Result<Option<PathBuf>, String> {
    let build = repo.join("build");
    if !build.exists() {
        return Ok(None);
    }
    regular_directory(&build)?;
    let path = build.join("qemu");
    if !path.exists() && !path.is_symlink() {
        return Ok(None);
    }
    regular_directory(&path)?;
    let marker = path.join("config-host.mak");
    regular_file(&marker)?;
    let expected = repo
        .join("third_party/qemu")
        .canonicalize()
        .map_err(|e| e.to_string())?;
    let config = fs::read_to_string(marker).map_err(|e| e.to_string())?;
    let source = config
        .lines()
        .find_map(|line| line.strip_prefix("SRC_PATH="))
        .ok_or("QEMU build source marker is missing")?;
    if Path::new(source)
        .canonicalize()
        .map_err(|e| e.to_string())?
        != expected
    {
        return Err("QEMU build does not belong to this checkout".into());
    }
    Ok(Some(path.canonicalize().map_err(|e| e.to_string())?))
}

pub fn preview(
    cache: &Path,
    project: Option<&Path>,
    scope: CleanScope,
    qemu: Option<PathBuf>,
) -> Result<CleanPreview, String> {
    let root = project_root(cache)?;
    let mut paths = Vec::new();
    match scope {
        CleanScope::Outputs => {
            if let Some(directory) = project {
                recognized_project(directory)?;
                if directory.parent() != Some(root.as_path()) {
                    return Err("Project is outside the app cache".into());
                }
                for name in OUTPUTS {
                    let path = directory.join(name);
                    if path.exists() || path.is_symlink() {
                        regular_file(&path)?;
                        paths.push(path);
                    }
                }
            }
        }
        CleanScope::Projects | CleanScope::Full => {
            if root.exists() {
                for entry in fs::read_dir(&root).map_err(|e| e.to_string())? {
                    let path = entry.map_err(|e| e.to_string())?.path();
                    // Unknown files, directories and links are preserved.
                    if recognized_project(&path).is_ok() {
                        paths.push(path);
                    }
                }
            }
        }
    }
    let includes_qemu = matches!(scope, CleanScope::Full) && qemu.is_some();
    if includes_qemu {
        paths.push(qemu.expect("checked QEMU path"));
    }
    paths.sort();
    Ok(CleanPreview {
        targets: paths
            .iter()
            .map(|p| p.to_string_lossy().into_owned())
            .collect(),
        includes_qemu,
    })
}

pub fn delete(preview: &CleanPreview) -> Result<(), String> {
    for target in &preview.targets {
        let path = Path::new(target);
        let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
        if meta.file_type().is_symlink() {
            return Err("Refusing to clean a symlink".into());
        }
        if meta.is_dir() {
            fs::remove_dir_all(path).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};
    struct Fixture(PathBuf);
    impl Fixture {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "eidolon-workspace-test-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir(&path).unwrap();
            Self(path.canonicalize().unwrap())
        }
        fn project(&self) -> PathBuf {
            let path = project_root(&self.0).unwrap().join("arm-virt-a55-test");
            fs::create_dir_all(&path).unwrap();
            fs::write(
                path.join("plan.json"),
                r#"{"recipe":{"id":"arm-virt-a55-hello-v1"}}"#,
            )
            .unwrap();
            for name in SOURCES {
                fs::write(path.join(name), "original").unwrap();
            }
            path
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    #[test]
    fn editor_restricts_paths_manifests_size_and_duplicate_files() {
        let fixture = Fixture::new();
        let project = fixture.project();
        for name in [
            "../outside.c",
            "/tmp/outside.c",
            "plan.json",
            "run.json",
            "platform.json",
            "platform_config.h",
        ] {
            assert!(
                save(
                    &project,
                    &[SourceEdit {
                        name: name.into(),
                        content: "x".into()
                    }]
                )
                .is_err()
            );
        }
        assert!(
            save(
                &project,
                &[SourceEdit {
                    name: "main.c".into(),
                    content: "x".repeat(SOURCE_LIMIT + 1)
                }]
            )
            .is_err()
        );
        assert!(
            save(
                &project,
                &[
                    SourceEdit {
                        name: "main.c".into(),
                        content: "a".into()
                    },
                    SourceEdit {
                        name: "main.c".into(),
                        content: "b".into()
                    }
                ]
            )
            .is_err()
        );
        assert_eq!(
            fs::read_to_string(project.join("main.c")).unwrap(),
            "original"
        );
        save(
            &project,
            &[SourceEdit {
                name: "main.c".into(),
                content: "edited".into(),
            }],
        )
        .unwrap();
        let files = files(&project).unwrap();
        assert_eq!(
            files
                .files
                .iter()
                .find(|f| f.name == "main.c")
                .unwrap()
                .content,
            "edited"
        );
        assert!(
            !files
                .files
                .iter()
                .find(|f| f.name == "plan.json")
                .unwrap()
                .editable
        );
    }

    #[test]
    fn output_clean_preserves_sources_and_unrelated_files() {
        let fixture = Fixture::new();
        let project = fixture.project();
        fs::write(project.join("firmware.elf"), "binary").unwrap();
        fs::write(project.join("notes.txt"), "keep").unwrap();
        let preview = preview(&fixture.0, Some(&project), CleanScope::Outputs, None).unwrap();
        assert_eq!(
            preview.targets,
            vec![project.join("firmware.elf").to_string_lossy()]
        );
        delete(&preview).unwrap();
        assert!(project.join("main.c").exists());
        assert!(project.join("plan.json").exists());
        assert!(project.join("notes.txt").exists());
        assert!(!project.join("firmware.elf").exists());
    }

    #[test]
    fn generated_project_clean_preserves_qemu_and_unknown_directories() {
        let fixture = Fixture::new();
        let project = fixture.project();
        let qemu = fixture.0.join("qemu-build");
        fs::create_dir(&qemu).unwrap();
        let unknown = project.parent().unwrap().join("personal-files");
        fs::create_dir(&unknown).unwrap();
        let preview = preview(
            &fixture.0,
            Some(&project),
            CleanScope::Projects,
            Some(qemu.clone()),
        )
        .unwrap();
        assert!(!preview.includes_qemu);
        delete(&preview).unwrap();
        assert!(!project.exists());
        assert!(qemu.exists());
        assert!(unknown.exists());
    }

    #[test]
    fn full_clean_only_includes_the_recognized_local_qemu_build() {
        let fixture = Fixture::new();
        let project = fixture.project();
        let source = fixture.0.join("third_party/qemu");
        fs::create_dir_all(&source).unwrap();
        let qemu = fixture.0.join("build/qemu");
        fs::create_dir_all(&qemu).unwrap();
        fs::write(
            qemu.join("config-host.mak"),
            format!("SRC_PATH={}\n", source.display()),
        )
        .unwrap();
        let external = fixture.0.join("external-qemu");
        fs::write(&external, "preserve").unwrap();
        let build = local_qemu_build(&fixture.0).unwrap();
        let preview = preview(&fixture.0, Some(&project), CleanScope::Full, build).unwrap();
        assert!(preview.includes_qemu);
        assert_eq!(preview.targets.len(), 2);
        delete(&preview).unwrap();
        assert!(!project.exists());
        assert!(!qemu.exists());
        assert!(source.exists());
        assert!(external.exists());
    }

    #[cfg(unix)]
    #[test]
    fn symlinks_cannot_redirect_editor_output_or_cleanup() {
        use std::os::unix::fs::symlink;
        let fixture = Fixture::new();
        let project = fixture.project();
        let outside = fixture.0.join("outside.c");
        fs::write(&outside, "preserve").unwrap();
        fs::remove_file(project.join("main.c")).unwrap();
        symlink(&outside, project.join("main.c")).unwrap();
        assert!(files(&project).is_err());
        assert!(
            save(
                &project,
                &[SourceEdit {
                    name: "main.c".into(),
                    content: "overwrite".into()
                }]
            )
            .is_err()
        );
        symlink(&outside, project.join("firmware.elf")).unwrap();
        assert!(validate_outputs(&project).is_err());
        assert!(preview(&fixture.0, Some(&project), CleanScope::Outputs, None).is_err());
        assert_eq!(fs::read_to_string(outside).unwrap(), "preserve");
    }
}
