mod formatter;
mod platform;
mod runtime;
mod workspace;

use runtime::{BuildProgress, RuntimeState, Snapshot};
use tauri::Manager;
use workspace::{CleanPreview, CleanScope, ProjectFiles, SourceEdit};

#[tauri::command]
async fn format_source(
    app: tauri::AppHandle,
    name: String,
    content: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let runtime = app.state::<RuntimeState>();
        let mut runtime = runtime.lock().map_err(|e| e.to_string())?;
        runtime.format_source(&name, &content)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn run_platform(
    app: tauri::AppHandle,
    board_id: String,
    progress: tauri::ipc::Channel<BuildProgress>,
) -> Result<Snapshot, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .run(&board_id, &cache, |update| {
                let _ = progress.send(update);
            })
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn platform_status(app: tauri::AppHandle) -> Result<Snapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .status()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn stop_platform(app: tauri::AppHandle) -> Result<Snapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .stop()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn project_files(app: tauri::AppHandle) -> Result<Option<ProjectFiles>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .project_files()
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn save_sources(app: tauri::AppHandle, edits: Vec<SourceEdit>) -> Result<Snapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .save_sources(edits)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn regenerate_project(app: tauri::AppHandle, board_id: String) -> Result<Snapshot, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .regenerate(&board_id, &cache)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn configure_platform(
    app: tauri::AppHandle,
    description_json: String,
) -> Result<Snapshot, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .configure_platform(&description_json, &cache)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn preview_cleanup(app: tauri::AppHandle, scope: CleanScope) -> Result<CleanPreview, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .clean_preview(&cache, scope)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
async fn clean_platform(
    app: tauri::AppHandle,
    scope: CleanScope,
    expected_targets: Vec<String>,
) -> Result<Snapshot, String> {
    let cache = app.path().app_cache_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || {
        app.state::<RuntimeState>()
            .lock()
            .map_err(|e| e.to_string())?
            .clean(&cache, scope, expected_targets)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState::default())
        .invoke_handler(tauri::generate_handler![
            run_platform,
            platform_status,
            stop_platform,
            project_files,
            save_sources,
            format_source,
            regenerate_project,
            configure_platform,
            preview_cleanup,
            clean_platform
        ])
        .build(tauri::generate_context!())
        .expect("error while building Eidolon")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Ok(mut runtime) = app.state::<RuntimeState>().lock() {
                    let _ = runtime.stop();
                }
            }
        });
}
