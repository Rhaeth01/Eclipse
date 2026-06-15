/**
 * secure_store.rs
 *
 * Chiffrement du bot token Discord + gestion du secret WS, avec une clé
 * liée au process Tauri (DPAPI sur Windows, fallback dérivé sur Linux/macOS).
 *
 * Stratégie (v0.4.0) :
 * - Windows : la clé maître est chiffrée par DPAPI (entropie = app-specific bytes)
 *   → seul le user Windows courant peut la déchiffrer, ce qui rend le
 *   ciphertext dans localStorage inexploitable par un autre process / un
 *   autre user / un autre PC.
 * - Linux/macOS dev : fallback sur un secret dérivé de l'app id + machine-id.
 *   Pour la prod réelle, on cible Windows en priorité.
 *
 * Format du fichier secure.bin (bot token) :
 *   [12 bytes nonce AES-GCM][N bytes ciphertext+tag]
 *
 * Format du fichier ws_secret.bin (WebSocket auth) :
 *   [N bytes random secret]
 *
 * Fichiers stockés dans %APPDATA%/Eclipse/ (Windows) ou
 * ~/.config/eclipse/ (Linux/macOS).
 */

use std::fs;
use std::path::PathBuf;
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use rand::RngCore;

/// Retourne le répertoire de stockage cross-platform
fn secure_dir() -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA")
            .map_err(|_| "APPDATA introuvable".to_string())?;
        let dir = PathBuf::from(appdata).join("Eclipse");
        fs::create_dir_all(&dir).map_err(|e| format!("Impossible de créer {}: {}", dir.display(), e))?;
        Ok(dir)
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "HOME introuvable".to_string())?;
        let dir = PathBuf::from(home).join(".config").join("eclipse");
        fs::create_dir_all(&dir).map_err(|e| format!("Impossible de créer {}: {}", dir.display(), e))?;
        Ok(dir)
    }
}

fn secure_file_path() -> Result<PathBuf, String> {
    Ok(secure_dir()?.join("secure.bin"))
}

fn ws_secret_path() -> Result<PathBuf, String> {
    Ok(secure_dir()?.join("ws_secret.bin"))
}

/// Dérive la clé maître (32 bytes) pour AES-256-GCM
fn get_or_create_master_key() -> Result<[u8; 32], String> {
    #[cfg(target_os = "windows")]
    {
        get_or_create_master_key_windows()
    }
    #[cfg(not(target_os = "windows"))]
    {
        get_or_create_master_key_fallback()
    }
}

#[cfg(target_os = "windows")]
fn get_or_create_master_key_windows() -> Result<[u8; 32], String> {
    use winapi::um::dpapi::CryptProtectData;
    use winapi::um::dpapi::CryptUnprotectData;
    use winapi::um::wincrypt::CRYPTOAPI_BLOB;
    use std::ptr;

    let cache_path = secure_dir()?.join("master.dpapi");

    if cache_path.exists() {
        let blob = fs::read(&cache_path).map_err(|e| format!("Lecture master.dpapi: {}", e))?;
        let mut data_in = CRYPTOAPI_BLOB {
            cbData: blob.len() as u32,
            pbData: blob.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPTOAPI_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };
        let entropy = b"eclipse-secure-v1";
        let mut entropy_blob = CRYPTOAPI_BLOB {
            cbData: entropy.len() as u32,
            pbData: entropy.as_ptr() as *mut u8,
        };
        unsafe {
            let ok = CryptUnprotectData(
                &mut data_in,
                ptr::null_mut(),
                &mut entropy_blob,
                ptr::null_mut(),
                ptr::null_mut(),
                0,
                &mut data_out,
            );
            if ok == 0 {
                return Err("DPAPI CryptUnprotectData a échoué".to_string());
            }
            if data_out.cbData != 32 {
                winapi::um::winbase::LocalFree(data_out.pbData as *mut _);
                return Err(format!("Clé maître invalide: taille {} (attendu 32)", data_out.cbData));
            }
            let slice = std::slice::from_raw_parts(data_out.pbData, 32);
            let mut key = [0u8; 32];
            key.copy_from_slice(slice);
            winapi::um::winbase::LocalFree(data_out.pbData as *mut _);
            Ok(key)
        }
    } else {
        let mut key = [0u8; 32];
        OsRng.fill_bytes(&mut key);
        let mut data_in = CRYPTOAPI_BLOB {
            cbData: 32,
            pbData: key.as_ptr() as *mut u8,
        };
        let mut data_out = CRYPTOAPI_BLOB {
            cbData: 0,
            pbData: ptr::null_mut(),
        };
        let entropy = b"eclipse-secure-v1";
        let mut entropy_blob = CRYPTOAPI_BLOB {
            cbData: entropy.len() as u32,
            pbData: entropy.as_ptr() as *mut u8,
        };
        unsafe {
            let ok = CryptProtectData(
                &mut data_in,
                entropy.as_ptr() as *mut _,
                &mut entropy_blob,
                ptr::null_mut(),
                ptr::null_mut(),
                0,
                &mut data_out,
            );
            if ok == 0 {
                return Err("DPAPI CryptProtectData a échoué".to_string());
            }
            let slice = std::slice::from_raw_parts(data_out.pbData, data_out.cbData as usize);
            fs::write(&cache_path, slice).map_err(|e| format!("Écriture master.dpapi: {}", e))?;
            winapi::um::winbase::LocalFree(data_out.pbData as *mut _);
            Ok(key)
        }
    }
}

#[cfg(not(target_os = "windows"))]
fn get_or_create_master_key_fallback() -> Result<[u8; 32], String> {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let salt = b"eclipse-v0.4.0-fallback-key-derivation";
    let hostname = std::env::var("HOSTNAME")
        .or_else(|_| std::env::var("COMPUTERNAME"))
        .unwrap_or_else(|_| "unknown".to_string());
    let user = std::env::var("USER")
        .or_else(|_| std::env::var("USERNAME"))
        .unwrap_or_else(|_| "unknown".to_string());

    let mut combined = Vec::new();
    combined.extend_from_slice(salt);
    combined.extend_from_slice(hostname.as_bytes());
    combined.extend_from_slice(user.as_bytes());
    let mut key = [0u8; 32];
    for i in 0..4 {
        let mut hasher = DefaultHasher::new();
        combined.hash(&mut hasher);
        (i as u64).hash(&mut hasher);
        let h = hasher.finish();
        let bytes = h.to_le_bytes();
        let start = i * 8;
        key[start..start + 8].copy_from_slice(&bytes);
    }
    Ok(key)
}

/// Chiffre un plaintext avec AES-256-GCM et écrit le ciphertext dans secure.bin.
/// Retourne le blob encodé en base64 (pour confirmer le stockage).
#[tauri::command]
pub fn store_bot_token(token: String) -> Result<String, String> {
    if !is_valid_token(&token) {
        return Err(format!(
            "Token invalide ({} chars, doit être 50-100 alphanum)",
            token.len()
        ));
    }

    let key = get_or_create_master_key()?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce_bytes = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce_bytes, token.as_bytes())
        .map_err(|e| format!("Chiffrement AES-GCM échoué: {}", e))?;

    let mut blob = Vec::with_capacity(12 + ciphertext.len());
    blob.extend_from_slice(&nonce_bytes);
    blob.extend_from_slice(&ciphertext);

    let path = secure_file_path()?;
    fs::write(&path, &blob).map_err(|e| format!("Écriture secure.bin: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o600);
            let _ = fs::set_permissions(&path, perms);
        }
    }

    Ok(BASE64.encode(&blob))
}

/// Lit et déchiffre le bot token depuis secure.bin. Retourne None si absent.
#[tauri::command]
pub fn load_bot_token() -> Result<Option<String>, String> {
    let path = secure_file_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let blob = fs::read(&path).map_err(|e| format!("Lecture secure.bin: {}", e))?;
    if blob.len() < 12 + 16 {
        return Err("secure.bin corrompu (trop court)".to_string());
    }
    let (nonce_bytes, ciphertext) = blob.split_at(12);

    let key = get_or_create_master_key()?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| "Déchiffrement échoué (clé maître modifiée ou fichier corrompu)".to_string())?;

    let token = String::from_utf8(plaintext)
        .map_err(|_| "Token déchiffré n'est pas UTF-8 valide".to_string())?;
    Ok(Some(token))
}

/// Supprime le bot token sécurisé.
#[tauri::command]
pub fn clear_bot_token() -> Result<(), String> {
    let path = secure_file_path()?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("Suppression secure.bin: {}", e))?;
    }
    Ok(())
}

/// Valide qu'un string ressemble à un token Discord (50-100 chars alphanum + ._-) .
/// Validation stricte, partagée avec le frontend.
pub fn is_valid_token(token: &str) -> bool {
    let len = token.len();
    if len < 50 || len > 100 {
        return false;
    }
    token
        .chars()
        .all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

// ============================================================================
// WS Auth Secret
// ============================================================================

/// Génère ou lit le secret WS (32 bytes random). Le Core et le WebView
/// partagent ce secret pour authentifier les connexions WS sur localhost:4040.
#[tauri::command]
pub fn get_ws_secret() -> Result<String, String> {
    get_or_create_ws_secret()
}

fn get_or_create_ws_secret() -> Result<String, String> {
    let path = ws_secret_path()?;
    if path.exists() {
        let bytes = fs::read(&path).map_err(|e| format!("Lecture ws_secret.bin: {}", e))?;
        if bytes.len() != 32 {
            // Fichier corrompu, on régénère
            let _ = fs::remove_file(&path);
        } else {
            return Ok(BASE64.encode(&bytes));
        }
    }
    let mut secret = [0u8; 32];
    OsRng.fill_bytes(&mut secret);
    fs::write(&path, secret).map_err(|e| format!("Écriture ws_secret.bin: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = fs::metadata(&path) {
            let mut perms = metadata.permissions();
            perms.set_mode(0o600);
            let _ = fs::set_permissions(&path, perms);
        }
    }
    Ok(BASE64.encode(&secret))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_valid_token() {
        assert!(is_valid_token("a".repeat(50).as_str()));
        assert!(is_valid_token("a".repeat(100).as_str()));
        assert!(!is_valid_token("a".repeat(49).as_str()));
        assert!(!is_valid_token("a".repeat(101).as_str()));
        assert!(!is_valid_token("abc def"));
    }

    #[test]
    fn test_store_and_load_roundtrip() {
        #[cfg(not(target_os = "windows"))]
        {
            let original = "MTAxMjM0NTY3ODkwMTIzNA.AbCdEf.ghIjKlMnOpQrStUvWxYz0123456789AB";
            store_bot_token(original).expect("store");
            let loaded = load_bot_token().expect("load");
            assert_eq!(loaded, Some(original.to_string()));
            clear_bot_token().expect("clear");
        }
    }

    #[test]
    fn test_ws_secret_persistence() {
        let s1 = get_or_create_ws_secret().expect("first call");
        let s2 = get_or_create_ws_secret().expect("second call");
        assert_eq!(s1, s2, "WS secret doit être stable entre appels");
    }
}
