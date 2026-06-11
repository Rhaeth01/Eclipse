#[cfg(target_os = "windows")]
mod dpapi {
    use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce, Key};
    use std::ptr;
    use winapi::um::dpapi::CryptUnprotectData;
    use winapi::um::wincrypt::CRYPTOAPI_BLOB;
    use winapi::um::winbase::LocalFree;

    pub fn decrypt(encrypted_data: &[u8]) -> Result<Vec<u8>, String> {
        let mut data_in = CRYPTOAPI_BLOB {
            cbData: encrypted_data.len() as u32,
            pbData: encrypted_data.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPTOAPI_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };

        unsafe {
            let success = CryptUnprotectData(
                &mut data_in,
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                ptr::null_mut(),
                0,
                &mut data_out,
            );

            if success == 0 {
                return Err("Échec du déchiffrement DPAPI".to_string());
            }

            let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
            let result = slice.to_vec();
            LocalFree(data_out.pbData as *mut _);
            Ok(result)
        }
    }

    pub fn decrypt_aes_gcm(encrypted_token: &[u8], key: &[u8]) -> Result<String, String> {
        if encrypted_token.len() < 15 {
            return Err("Jeton chiffré trop court".to_string());
        }

        let nonce_bytes = &encrypted_token[3..15];
        let ciphertext = &encrypted_token[15..];

        let key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(nonce_bytes);

        match cipher.decrypt(nonce, ciphertext) {
            Ok(decrypted) => String::from_utf8(decrypted)
                .map_err(|_| "Erreur d'encodage UTF-8".to_string()),
            Err(_) => Err("Déchiffrement AES-GCM a échoué".to_string()),
        }
    }
}

#[tauri::command]
pub fn get_discord_token() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::env;
        use std::fs;
        use std::path::PathBuf;
        use regex::Regex;
        use serde_json::Value;
        use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

        let appdata = env::var("APPDATA")
            .map_err(|_| "Variable APPDATA introuvable".to_string())?;

        let paths = vec![
            PathBuf::from(&appdata).join("discord"),
            PathBuf::from(&appdata).join("discordptb"),
            PathBuf::from(&appdata).join("discordcanary"),
        ];

        let re = Regex::new(r"dQw4w9WgXcQ:([^\x22]+)").unwrap();
        let mut tokens = Vec::new();

        for discord_path in paths {
            if !discord_path.exists() {
                continue;
            }

            let local_state_path = discord_path.join("Local State");
            let local_state_content = match fs::read_to_string(&local_state_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let json: Value = match serde_json::from_str(&local_state_content) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let encrypted_key_b64 = match json["os_crypt"]["encrypted_key"].as_str() {
                Some(k) => k,
                None => continue,
            };

            let mut encrypted_key = match BASE64.decode(encrypted_key_b64) {
                Ok(k) => k,
                Err(_) => continue,
            };

            if encrypted_key.len() < 5 {
                continue;
            }
            encrypted_key = encrypted_key[5..].to_vec();

            let master_key = match dpapi::decrypt(&encrypted_key) {
                Ok(k) => k,
                Err(_) => continue,
            };

            let leveldb_path = discord_path.join("Local Storage").join("leveldb");
            if !leveldb_path.exists() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(leveldb_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    let ext = path.extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("");

                    if ext != "ldb" && ext != "log" {
                        continue;
                    }

                    let content = fs::read(&path).unwrap_or_default();
                    let content_str = String::from_utf8_lossy(&content);

                    for cap in re.captures_iter(&content_str) {
                        let b64_token = &cap[1];
                        if let Ok(encrypted_token) = BASE64.decode(b64_token) {
                            if let Ok(decrypted) = dpapi::decrypt_aes_gcm(&encrypted_token, &master_key) {
                                if !tokens.contains(&decrypted) {
                                    tokens.push(decrypted);
                                }
                            }
                        }
                    }
                }
            }
        }

        if tokens.is_empty() {
            return Err("Aucun jeton Discord trouvé. Êtes-vous connecté à l'application de bureau ?".to_string());
        }

        return Ok(tokens[0].clone());
    }

    #[cfg(not(target_os = "windows"))]
    {
        return Err("L'extraction auto du token Discord est uniquement disponible sur Windows (DPAPI). Veuillez entrer votre token manuellement dans l'interface.".to_string());
    }
}
