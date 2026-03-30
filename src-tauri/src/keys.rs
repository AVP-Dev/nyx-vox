use aes_gcm::{
    aead::{rand_core::RngCore, Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use machineid_rs::{Encryption, HWIDComponent, IdBuilder};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Debug, Clone, Hash, Eq, PartialEq, Serialize, Deserialize)]
pub enum Service {
    #[serde(rename = "gemini", alias = "Gemini")]
    Gemini,
    #[serde(rename = "deepseek", alias = "Deepseek", alias = "DeepSeek")]
    Deepseek,
    #[serde(rename = "groq", alias = "Groq")]
    Groq,
    #[serde(rename = "deepgram", alias = "Deepgram")]
    Deepgram,
    #[serde(rename = "qwen", alias = "Qwen")]
    Qwen,
}

impl Service {
    pub const ALL: [Service; 5] = [
        Service::Gemini,
        Service::Deepseek,
        Service::Groq,
        Service::Deepgram,
        Service::Qwen,
    ];

    pub fn store_key(&self) -> &'static str {
        match self {
            Service::Gemini => "gemini_api_key",
            Service::Deepseek => "deepseek_api_key",
            Service::Groq => "groq_api_key",
            Service::Deepgram => "deepgram_api_key",
            Service::Qwen => "qwen_api_key",
        }
    }
}

pub struct ApiKeys(pub Mutex<HashMap<Service, Option<String>>>);

impl ApiKeys {
    fn get_master_key() -> [u8; 32] {
        let mut builder = IdBuilder::new(Encryption::SHA256);
        // HWIDComponent names in 1.2+ are slightly different.
        // Using common components that exist in most versions.
        builder.add_component(HWIDComponent::SystemID);

        let hardware_id = builder
            .build("NYX_VOX_SALT")
            .unwrap_or_else(|_| "FALLBACK_ID".to_string());
        if hardware_id == "FALLBACK_ID" {
            eprintln!("WARNING: Using fallback HWID for encryption. Keys may not be portable.");
        }
        let mut hasher = Sha256::new();
        hasher.update(hardware_id.as_bytes());
        let result = hasher.finalize();
        let mut key = [0u8; 32];
        key.copy_from_slice(&result);
        key
    }

    pub fn encrypt_key(plain_text: &str) -> Result<String, String> {
        let key_bytes = Self::get_master_key();
        let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| e.to_string())?;

        let mut nonce_bytes = [0u8; 12];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let encrypted_data = cipher
            .encrypt(nonce, plain_text.as_bytes())
            .map_err(|e| e.to_string())?;

        let mut payload = Vec::with_capacity(12 + encrypted_data.len());
        payload.extend_from_slice(&nonce_bytes);
        payload.extend_from_slice(&encrypted_data);
        Ok(format!("v2:{}", general_purpose::STANDARD.encode(payload)))
    }

    pub fn decrypt_key(cipher_text: &str) -> Result<String, String> {
        if let Some(v2_payload) = cipher_text.strip_prefix("v2:") {
            let key_bytes = Self::get_master_key();
            let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| e.to_string())?;

            let payload = general_purpose::STANDARD
                .decode(v2_payload)
                .map_err(|e| e.to_string())?;
            if payload.len() <= 12 {
                return Err("Invalid encrypted payload".to_string());
            }

            let (nonce_bytes, encrypted_data) = payload.split_at(12);
            let nonce = Nonce::from_slice(nonce_bytes);
            let decrypted_data = cipher
                .decrypt(nonce, encrypted_data)
                .map_err(|e| e.to_string())?;
            return String::from_utf8(decrypted_data).map_err(|e| e.to_string());
        }

        Self::decrypt_legacy_key(cipher_text)
    }

    fn decrypt_legacy_key(cipher_text: &str) -> Result<String, String> {
        let key_bytes = Self::get_master_key();
        let cipher = Aes256Gcm::new_from_slice(&key_bytes).map_err(|e| e.to_string())?;
        let nonce = Nonce::from_slice(b"NYXVOX_NONCE");

        let data = general_purpose::STANDARD
            .decode(cipher_text)
            .map_err(|e| e.to_string())?;
        let decrypted_data = cipher
            .decrypt(nonce, data.as_slice())
            .map_err(|e| e.to_string())?;

        String::from_utf8(decrypted_data).map_err(|e| e.to_string())
    }

    pub fn load_from_store<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
    ) -> Result<(), String> {
        use tauri_plugin_store::StoreExt;
        let store = app.store("settings.json").map_err(|e| e.to_string())?;
        let mut lock = self.0.lock().map_err(|e| e.to_string())?;
        let mut migrated_any = false;

        for service in Service::ALL.iter() {
            if let Some(val) = store.get(service.store_key()) {
                if let Some(encrypted_str) = val.as_str() {
                    if !encrypted_str.is_empty() {
                        match Self::decrypt_key(encrypted_str) {
                            Ok(decrypted) => {
                                let clean = decrypted
                                    .trim_matches('"')
                                    .trim_matches('\'')
                                    .trim()
                                    .to_string();
                                lock.insert(service.clone(), Some(clean));

                                if !encrypted_str.starts_with("v2:") {
                                    if let Ok(migrated_cipher) = Self::encrypt_key(
                                        lock.get(service)
                                            .and_then(|v| v.as_ref())
                                            .map(|s| s.as_str())
                                            .unwrap_or_default(),
                                    ) {
                                        store.set(
                                            service.store_key(),
                                            serde_json::json!(migrated_cipher),
                                        );
                                        migrated_any = true;
                                    }
                                }
                            }
                            Err(e) => {
                                eprintln!("ERROR: Failed to decrypt key for {:?}: {}", service, e);
                            }
                        }
                    }
                }
            }
        }

        if migrated_any {
            store.save().map_err(|e| e.to_string())?;
        }

        Ok(())
    }

    pub fn save_to_store<R: tauri::Runtime>(
        &self,
        app: &tauri::AppHandle<R>,
        service: Service,
        key: String,
    ) -> Result<(), String> {
        use tauri_plugin_store::StoreExt;
        let store = app.store("settings.json").map_err(|e| e.to_string())?;

        if key.is_empty() {
            store.delete(service.store_key());
            let mut lock = self.0.lock().map_err(|e| e.to_string())?;
            lock.insert(service, None);
        } else {
            let encrypted = Self::encrypt_key(&key)?;
            store.set(service.store_key(), serde_json::json!(encrypted));
            let mut lock = self.0.lock().map_err(|e| e.to_string())?;
            lock.insert(service, Some(key));
        }
        store.save().map_err(|e| e.to_string())?;
        Ok(())
    }
}

impl Default for ApiKeys {
    fn default() -> Self {
        let mut map = HashMap::new();
        for service in Service::ALL.iter() {
            map.insert(service.clone(), None);
        }
        Self(Mutex::new(map))
    }
}
