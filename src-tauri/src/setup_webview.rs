use tauri::{AppHandle, Emitter, Manager};

const SETUP_INIT_SCRIPT: &str = r###"
(function() {
  'use strict';
  if (window.__eclipseSetupInjected) return;
  window.__eclipseSetupInjected = true;
  
  const APP_NAME = 'Eclipse';
  let tokenExtracted = false;
  let bannerEl = null;
  let currentStep = 'loading';

  function showBanner(text, type) {
    type = type || 'info';
    if (bannerEl) bannerEl.remove();
    bannerEl = document.createElement('div');
    bannerEl.id = 'eclipse-setup-banner';
    bannerEl.innerHTML = text;
    var colors = { info: '#e69a00', success: '#2d9e8a', error: '#d4656b' };
    bannerEl.style.cssText = 
      'position:fixed;top:0;left:0;right:0;z-index:99999;' +
      'background:' + (colors[type] || colors.info) + ';color:#070709;' +
      'padding:10px 16px;font-size:13px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;' +
      'text-align:center;font-weight:600;letter-spacing:0.01em;';
    document.body.appendChild(bannerEl);
  }

  function hideBanner() {
    if (bannerEl) { bannerEl.remove(); bannerEl = null; }
  }

  function autoFillAppName() {
    if (window.__eclipseNameAutoFilled) return;
    window.__eclipseNameAutoFilled = true;
    var inputs = document.querySelectorAll('input[type="text"], input:not([type])');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var label = (input.closest('div')?.querySelector('label')?.textContent || '').toLowerCase();
      var placeholder = (input.placeholder || '').toLowerCase();
      var ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      if (label.includes('name') || label.includes('nom') ||
          placeholder.includes('name') || placeholder.includes('nom') ||
          ariaLabel.includes('name') || ariaLabel.includes('nom')) {
        try {
          var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(input, APP_NAME);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        } catch(e) {}
      }
    }
    return false;
  }

  function sendToken(token) {
    if (tokenExtracted || !token || token.length < 20) return;
    // Security v0.4.0: ne déclencher l'extraction que sur la page bot, avec un
    // marker DOM spécifique. Avant : n'importe quel string de 20+ chars dans
    // n'importe quelle page Discord pouvait être traité comme un token.
    var path = window.location.pathname;
    if (!/^\/developers\/applications\/\d+\/bot/.test(path)) {
      return; // Pas sur la page bot, on ignore
    }
    var tokenEl = document.querySelector('pre, code, [class*="token"]');
    // Le token Discord est affiché dans un élément <pre> ou <code> après le
    // clic sur "Copy Token". On vérifie que le token détecté est dans un
    // tel élément (pas dans le texte d'un message utilisateur).
    if (!tokenEl || !tokenEl.textContent || tokenEl.textContent.indexOf(token) === -1) {
      return; // Token non présent dans un élément de type code/pre
    }
    tokenExtracted = true;
    showBanner('Token detecte! Configuration terminee.', 'success');
    try {
      window.__TAURI_INTERNALS__.invoke('bot_token_extracted', { token: token });
    } catch(e) {
      console.error('[Eclipse Setup] Failed to send token:', e);
    }
    setTimeout(hideBanner, 3000);
  }

  // Detect token in the page (the monospace text block Discord shows)
  function scanForToken() {
    if (tokenExtracted) return '';
    var tokenPattern = /^[A-Za-z0-9._-]{50,100}$/;
    var pres = document.querySelectorAll('pre, code, .token-string, [class*="token"]');
    for (var i = 0; i < pres.length; i++) {
      var text = (pres[i].textContent || '').trim();
      if (tokenPattern.test(text)) {
        return text;
      }
    }
    // Generic text nodes containing a token-like string
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    var node;
    while (node = walker.nextNode()) {
      var text = (node.textContent || '').trim();
      if (tokenPattern.test(text)) {
        return text;
      }
    }
    return '';
  }

  // Clipboard monitoring (fallback: user clicks "Copy Token")
  document.addEventListener('copy', function(e) {
    var selection = (document.getSelection() || '').toString().trim();
    if (selection && selection.length >= 20 && /^[A-Za-z0-9._-]{20,120}$/.test(selection)) {
      sendToken(selection);
    }
  });

  // Monitor clipboard periodically via Clipboard API
  async function checkClipboard() {
    if (tokenExtracted) return;
    try {
      var clipText = await navigator.clipboard.readText();
      if (clipText && clipText.length >= 50 && /^[A-Za-z0-9._-]+$/.test(clipText)) {
        sendToken(clipText);
      }
    } catch(e) {}
  }

  // Navigation monitoring
  function getPageContext() {
    var path = window.location.pathname;
    if (path === '/developers/applications') return 'applications-list';
    if (/^\/developers\/applications\/\d+$/.test(path)) return 'app-detail';
    if (/^\/developers\/applications\/\d+\/bot/.test(path)) return 'app-bot';
    if (/^\/developers\/applications\/\d+\/oauth2/.test(path)) return 'app-oauth2';
    if (/^\/developers\/applications\/\d+\/information/.test(path)) return 'app-info';
    if (path === '/login' || path === '/app') return 'login';
    return 'unknown';
  }

  function extractAppId() {
    var match = window.location.pathname.match(/^\/developers\/applications\/(\d+)/);
    return match ? match[1] : null;
  }

  function notifyAppId() {
    if (window.__eclipseAppIdNotified) return;
    var id = extractAppId();
    if (!id) return;
    window.__eclipseAppIdNotified = true;
    try {
      window.__TAURI_INTERNALS__.invoke('bot_app_id_extracted', { appId: id });
      showBanner('App ID detecte! Configuration du Bot en cours...', 'success');
    } catch(e) {
      console.error('[Eclipse Setup] Failed to send app id:', e);
    }
  }

  function onNavigation() {
    var ctx = getPageContext();
    currentStep = ctx;
    hideBanner();

    // Always clear any previous per-page intervals to avoid leaks
    if (scanForTokenInterval) { clearInterval(scanForTokenInterval); scanForTokenInterval = null; }
    if (clipboardInterval) { clearInterval(clipboardInterval); clipboardInterval = null; }

    switch(ctx) {
      case 'applications-list':
        showBanner('1/4) Creez une nouvelle application nommee "' + APP_NAME + '"');
        // No token/clipboard polling on the list page (Discord SPA is heavy)
        break;
      case 'app-detail':
      case 'app-info':
        showBanner('2/4) Allez dans l\'onglet "Bot" a gauche');
        setTimeout(function() { autoFillAppName(); }, 500);
        notifyAppId();
        // Clipboard monitoring is enough on the detail page; token isn't shown yet
        clipboardInterval = setInterval(checkClipboard, 2000);
        break;
      case 'app-oauth2':
        showBanner('2/4) Allez dans l\'onglet "Bot" a gauche (pas OAuth2)');
        notifyAppId();
        clipboardInterval = setInterval(checkClipboard, 2000);
        break;
      case 'app-bot':
        showBanner('3/4) Cliquez "Add Bot" puis "Copy Token"');
        notifyAppId();
        // Scan for token (maybe already on page) + clipboard monitoring
        scanForTokenInterval = setInterval(function() {
          var token = scanForToken();
          if (token) sendToken(token);
        }, 1000);
        clipboardInterval = setInterval(checkClipboard, 2000);
        break;
      case 'login':
        showBanner('Connectez-vous a Discord pour continuer');
        break;
      default:
        // Unknown page: keep intervals cleared to avoid CPU drain
        break;
    }
  }

  var scanForTokenInterval = null;
  var clipboardInterval = null;
  var lastPath = window.location.pathname;

  // Watch for URL changes (Discord SPA uses pushState)
  var origPushState = history.pushState;
  history.pushState = function() {
    origPushState.apply(this, arguments);
    setTimeout(onNavigation, 500);
  };
  
  var origReplaceState = history.replaceState;
  history.replaceState = function() {
    origReplaceState.apply(this, arguments);
    setTimeout(onNavigation, 500);
  };

  window.addEventListener('popstate', function() {
    setTimeout(onNavigation, 500);
  });

  // DOM mutation observer for content changes (token appears dynamically).
  // CRITICAL: must be throttled. Discord.com SPA fires thousands of mutations/sec
  // (chat list, presence, etc.). Without throttling, scanForToken() — which walks
  // every text node on the page — pegs the CPU and freezes the WebView2 window
  // (white screen of death). 1.5s interval is a good balance: responsive enough
  // to catch a token that's copied/displayed, cheap enough to never freeze.
  var lastScanAt = 0;
  var SCAN_THROTTLE_MS = 1500;
  var bodyObserver = new MutationObserver(function() {
    if (tokenExtracted) return;
    var now = Date.now();
    if (now - lastScanAt < SCAN_THROTTLE_MS) return;
    lastScanAt = now;
    // Only scan when we're on a page where a token can appear.
    if (currentStep !== 'app-bot' && currentStep !== 'app-detail') return;
    var token = scanForToken();
    if (token) sendToken(token);
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true, characterData: true });

  // Initial page
  setTimeout(onNavigation, 1000);
})();
"###;

#[tauri::command]
pub fn open_setup_webview(app: AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;
    use tauri::WebviewUrl;

    if let Some(existing) = app.get_webview_window("setup") {
        let _ = existing.close();
    }

    let url: url::Url = "https://discord.com/developers/applications"
        .parse()
        .map_err(|e| format!("URL invalide: {}", e))?;

    let _webview = WebviewWindowBuilder::new(&app, "setup", WebviewUrl::External(url))
        .title("Eclipse - Setup Slash Commands")
        .inner_size(900.0, 700.0)
        .min_inner_size(600.0, 500.0)
        .initialization_script(SETUP_INIT_SCRIPT)
        .build()
        .map_err(|e| format!("Erreur création fenêtre: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn bot_token_extracted(app: AppHandle, token: String) -> Result<(), String> {
    // Validation : un token Discord fait entre 50 et 100 caractères et n'utilise
    // que [A-Za-z0-9._-]. Sans cette validation, n'importe quel string de 20+
    // chars émis par une page Discord compromise pourrait être traité comme un
    // token (cf. audit v0.4.0).
    if !is_valid_discord_token(&token) {
        return Err(format!(
            "Token invalide: doit faire 50-100 chars et n'utiliser que [A-Za-z0-9._-] (reçu {} chars)",
            token.len()
        ));
    }
    app.emit("bot-token-extracted", token)
        .map_err(|e| format!("Erreur émission événement: {}", e))
}

#[tauri::command]
pub fn bot_app_id_extracted(app: AppHandle, app_id: String) -> Result<(), String> {
    // Un App ID Discord est un snowflake de 17-20 chiffres.
    if !is_valid_discord_snowflake(&app_id) {
        return Err(format!(
            "App ID invalide: doit être un snowflake de 17-20 chiffres (reçu {} chars)",
            app_id.len()
        ));
    }
    app.emit("bot-app-id-extracted", app_id)
        .map_err(|e| format!("Erreur émission événement: {}", e))
}

/// Valide qu'un string ressemble à un token Discord.
/// Format : 50-100 caractères alphanumériques + . _ -
fn is_valid_discord_token(token: &str) -> bool {
    let len = token.len();
    if len < 50 || len > 100 {
        return false;
    }
    token.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '_' || c == '-')
}

/// Valide qu'un string est un snowflake Discord (17-20 chiffres).
fn is_valid_discord_snowflake(s: &str) -> bool {
    let len = s.len();
    if len < 17 || len > 20 {
        return false;
    }
    s.chars().all(|c| c.is_ascii_digit())
}

#[tauri::command]
pub fn close_setup_webview(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview_window("setup") {
        let _ = webview.close();
    }
    Ok(())
}
