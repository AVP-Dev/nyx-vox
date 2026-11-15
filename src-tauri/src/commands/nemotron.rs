use crate::nemotron::{self, NemotronDownloadState, NemotronModelStatus};
use tauri::{AppHandle, State};

#[tauri::command]
pub fn get_nemotron_status(
    download_state: State<'_, NemotronDownloadState>,
) -> NemotronModelStatus {
    nemotron::model_status(&download_state)
}

#[tauri::command]
pub async fn download_nemotron_model(
    app: AppHandle,
    download_state: State<'_, NemotronDownloadState>,
) -> Result<(), String> {
    nemotron::download_model(app, &download_state).await
}

#[tauri::command]
pub fn delete_nemotron_model(
    download_state: State<'_, NemotronDownloadState>,
) -> Result<(), String> {
    nemotron::delete_model(&download_state)
}
