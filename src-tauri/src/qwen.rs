use crate::state::{FormattingStyle, FormattingStyleState};
use reqwest::Client;
use serde_json::json;
use tauri::{AppHandle, Manager, Runtime};

pub async fn refine_text<R: Runtime>(
    app: AppHandle<R>,
    text: String,
    api_key: String,
    _instruction: Option<String>,
) -> Result<String, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;

    // Default to Alibaba DashScope (OpenAI Compatible)
    // For OpenRouter, use: https://openrouter.ai/api/v1/chat/completions
    let url = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

    let style_state = app.state::<FormattingStyleState>();
    let style = *style_state.0.lock().unwrap_or_else(|e| e.into_inner());

    let style_prompt = match style {
        FormattingStyle::Casual => crate::prompts::FORMAT_STYLE_LIGHT,
        FormattingStyle::Professional => crate::prompts::FORMAT_STYLE_DEEP,
    };

    let system_prompt = format!(
        "{}\n\n{}\n\n{}",
        crate::prompts::REFINEMENT_SYSTEM_PROMPT,
        style_prompt,
        crate::prompts::FORMAT_STYLE_UNIVERSAL_RULE
    );

    let user_instruction = _instruction
        .unwrap_or_else(|| crate::prompts::REFINEMENT_USER_INSTRUCTION_GENERIC.to_string());
    let user_content = format!(
        "{}{}{}{}",
        user_instruction,
        crate::prompts::REFINEMENT_USER_DELIMITER,
        text,
        crate::prompts::REFINEMENT_USER_SUFFIX
    );

    let format_model = app
        .try_state::<crate::state::CustomModels>()
        .and_then(|s| s.0.lock().ok().and_then(|m| m.get("qwen_format").cloned()))
        .unwrap_or_else(|| "qwen3.7-flash".to_string());

    let body = json!({
        "model": format_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": crate::prompts::DEFAULT_TEMPERATURE,
        "top_p": crate::prompts::DEFAULT_TOP_P
    });

    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Qwen request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Qwen API Error: {}", err_text));
    }

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse json failed: {}", e))?;

    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("");
    let cleaned = crate::utils::clean_repetitive_phrases(content);
    let final_text = crate::utils::strip_filler_phrases(&cleaned);

    Ok(final_text)
}
