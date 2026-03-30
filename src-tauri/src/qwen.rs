use serde_json::json;
use reqwest::Client;

pub async fn refine_text(
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

    let system_prompt = crate::prompts::REFINEMENT_SYSTEM_PROMPT;
    let user_instruction = _instruction.unwrap_or_else(|| crate::prompts::REFINEMENT_USER_INSTRUCTION_GENERIC.to_string());
    let user_content = format!(
        "{}{}{}{}", 
        user_instruction, 
        crate::prompts::REFINEMENT_USER_DELIMITER, 
        text, 
        crate::prompts::REFINEMENT_USER_SUFFIX
    );

    let body = json!({
        "model": "qwen-plus", 
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

    let json: serde_json::Value = res.json().await.map_err(|e| format!("Parse json failed: {}", e))?;
    
    let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("");
    let cleaned = crate::utils::clean_repetitive_phrases(content);
    let final_text = crate::utils::strip_filler_phrases(&cleaned);

    Ok(final_text)
}
