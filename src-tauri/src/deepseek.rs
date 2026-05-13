use serde_json::json;

// ── Text Refinement (Formatting) using DeepSeek ──────────────────────────────
pub async fn refine_text(
    text: String,
    api_key: String,
    instruction: Option<String>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| format!("Client build failed: {}", e))?;
    let url = "https://api.deepseek.com/chat/completions";

    let user_instruction = instruction.unwrap_or_else(|| crate::prompts::REFINEMENT_USER_INSTRUCTION_DEEPSEEK.to_string());
    
    // DeepSeek API accepts a system role. We will combine our new unified system prompt with the user input.
    let system_prompt = crate::prompts::REFINEMENT_SYSTEM_PROMPT;
    
    let user_content = format!(
        "{}\n\n{}", 
        user_instruction, 
        text
    );

    let body = json!({
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content}
        ],
        "temperature": crate::prompts::DEFAULT_TEMPERATURE,
        "top_p": crate::prompts::DEFAULT_TOP_P,
        "stream": false
    });

    let res = client
        .post(url)
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("DeepSeek request failed: {}", e))?;

    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("DeepSeek API Error: {}", err_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| format!("Parse json failed: {}", e))?;
    let content = json["choices"][0]["message"]["content"].as_str().unwrap_or("");
    let cleaned = crate::utils::clean_repetitive_phrases(content);
    let final_text = crate::utils::strip_filler_phrases(&cleaned);

    Ok(final_text)
}
