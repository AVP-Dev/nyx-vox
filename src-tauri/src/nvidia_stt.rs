use crate::cloud_stt;
use serde_json::Value;

pub async fn transcribe_batch(
    wav: Vec<u8>,
    api_key: &str,
    function_id: &str,
) -> Result<String, String> {
    let function_id = validate_function_id(function_id)?;
    let file = reqwest::multipart::Part::bytes(wav)
        .file_name("recording.wav")
        .mime_str("audio/wav")
        .map_err(|e| e.to_string())?;
    let form = reqwest::multipart::Form::new().part("file", file);
    let url =
        format!("https://{function_id}.invocation.api.nvcf.nvidia.com/v1/audio/transcriptions");
    let response = crate::utils::shared_http_client()
        .post(url)
        .header("Authorization", format!("Bearer {api_key}"))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("NVIDIA Build request failed: {e}"))?;
    let status = response.status();
    let body = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(cloud_stt::response_error("NVIDIA Build", status, &body));
    }
    transcript_text(&body)
}

pub(crate) fn validate_function_id(value: &str) -> Result<&str, String> {
    let valid = value.len() == 36
        && value.bytes().enumerate().all(|(index, byte)| {
            if [8, 13, 18, 23].contains(&index) {
                byte == b'-'
            } else {
                byte.is_ascii_hexdigit()
            }
        });
    if valid {
        Ok(value)
    } else {
        Err("NVIDIA Build function ID must be a UUID".to_string())
    }
}

fn transcript_text(body: &str) -> Result<String, String> {
    let value: Value = serde_json::from_str(body)
        .map_err(|e| format!("NVIDIA Build returned invalid JSON: {e}"))?;
    value
        .get("text")
        .or_else(|| value.get("transcript"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .ok_or_else(|| "NVIDIA Build response has no transcript text".to_string())
}

#[cfg(test)]
mod tests {
    use super::{transcript_text, validate_function_id};

    #[test]
    fn accepts_uuid_function_id() {
        assert_eq!(
            validate_function_id("1598d209-5e27-4d3c-8079-4751568b1081").unwrap(),
            "1598d209-5e27-4d3c-8079-4751568b1081"
        );
    }

    #[test]
    fn rejects_invalid_function_id() {
        assert!(validate_function_id("not-a-uuid").is_err());
    }

    #[test]
    fn reads_transcript_from_supported_response_fields() {
        assert_eq!(transcript_text(r#"{"text":"hello"}"#).unwrap(), "hello");
        assert_eq!(
            transcript_text(r#"{"transcript":"world"}"#).unwrap(),
            "world"
        );
    }
}
