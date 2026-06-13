mod discord_extractor;
mod setup_webview;
use std::io::Write;
use tauri::{Emitter, Manager};

#[cfg(not(target_os = "android"))]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      app.handle().plugin(tauri_plugin_shell::init())?;
      app.handle().plugin(tauri_plugin_process::init())?;
      app.handle().plugin(tauri_plugin_updater::Builder::new().build())?;
      app.handle().plugin(tauri_plugin_notification::init())?;
      
      let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quitter Eclipse", true, None::<&str>)?;
      let show_i = tauri::menu::MenuItem::with_id(app, "show", "Tableau de Bord", true, None::<&str>)?;
      let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

      tauri::tray::TrayIconBuilder::new()
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "show" => {
               if let Some(window) = app.get_webview_window("main") {
                   let _ = window.show();
                   let _ = window.set_focus();
               }
            }
            _ => ()
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;
      
      use tauri_plugin_shell::ShellExt;
      use tauri_plugin_shell::process::CommandEvent;

      // Resoudre les chemins depuis l'exe en cours d'execution
      // (beaucoup plus fiable que resource_dir() qui pointe vers un autre dossier
      // pour les installeurs NSIS sous Windows)
      let install_dir = match std::env::current_exe() {
          Ok(exe) => exe.parent().map(|p| p.to_path_buf()).unwrap_or_default(),
          Err(e) => {
              eprintln!("[Tauri] Impossible de localiser l'exe: {}", e);
              let _ = app.emit("core-startup-error", format!("Localisation de l'exe impossible: {}", e));
              return Ok(());
          }
      };

      // Logger le diagnostic dans un fichier pour debug
      let log_path = install_dir.join("core_startup.log");
      let mut log = match std::fs::OpenOptions::new()
          .create(true)
          .append(true)
          .open(&log_path)
      {
          Ok(f) => f,
          Err(e) => {
              eprintln!("[Tauri] Impossible de creer le log: {}", e);
              let _ = app.emit("core-startup-error", format!("Log impossible: {}", e));
              return Ok(());
          }
      };

      let node_script_path = install_dir.join("core").join("dist").join("index.js");
      let node_bundled = install_dir.join("core").join("node.exe");

      let _ = writeln!(log, "--- Eclipse Core startup @ {:?} ---", std::time::SystemTime::now());
      let _ = writeln!(log, "install_dir: {}", install_dir.display());
      let _ = writeln!(log, "node_bundled: {} (exists: {})", node_bundled.display(), node_bundled.exists());
      let _ = writeln!(log, "node_script: {} (exists: {})", node_script_path.display(), node_script_path.exists());

      if !node_script_path.exists() {
          let err = format!("Core introuvable a {}", node_script_path.display());
          eprintln!("[Tauri] {}", err);
          let _ = writeln!(log, "ERREUR: {}", err);
          let _ = app.emit("core-startup-error", err);
          return Ok(());
      }

      let script_path_str = node_script_path.to_string_lossy().to_string();
      let spawn_result = if node_bundled.exists() {
          let _ = writeln!(log, "Spawn node bundle: {}", node_bundled.display());
          app.shell().command(&node_bundled).args([&script_path_str]).spawn()
      } else {
          let _ = writeln!(log, "Fallback systeme: node");
          app.shell().command("node").args([&script_path_str]).spawn()
      };

      match spawn_result {
          Ok((mut rx, _child)) => {
              let _ = writeln!(log, "Spawn OK, en ecoute stdout/stderr/terminated");
              tauri::async_runtime::spawn(async move {
                  while let Some(event) = rx.recv().await {
                      match event {
                          CommandEvent::Stdout(line) => {
                              println!("[Node Core] {}", String::from_utf8_lossy(&line));
                              let _ = writeln!(log, "[Node stdout] {}", String::from_utf8_lossy(&line));
                          }
                          CommandEvent::Stderr(line) => {
                              eprintln!("[Node Error] {}", String::from_utf8_lossy(&line));
                              let _ = writeln!(log, "[Node stderr] {}", String::from_utf8_lossy(&line));
                          }
                          CommandEvent::Terminated(payload) => {
                              let code = payload.code.unwrap_or(-1);
                              let err_msg = format!("Le Core s'est arrete (exit code: {})", code);
                              eprintln!("[Tauri] {}", err_msg);
                              let _ = writeln!(log, "[Node terminated] exit_code: {}, signal: {:?}", code, payload.signal);
                              // Note: on ne peut pas emettre depuis un async move Spawn (AppHandle non-Send).
                              // Le crash est logue dans core_startup.log cote exe.
                              // Le frontend detectera la deconnexion WebSocket.
                          }
                          _ => (),
                      }
                  }
              });
          }
          Err(e) => {
              let err_msg = format!("Impossible de demarrer le Core : {}", e);
              eprintln!("[Tauri] {}", err_msg);
              let _ = writeln!(log, "ERREUR spawn: {}", err_msg);
              let _ = app.emit("core-startup-error", err_msg);
          }
      }

      Ok(())
    })
    .on_window_event(|window, event| match event {
      tauri::WindowEvent::CloseRequested { api, .. } => {
        let _ = window.hide();
        api.prevent_close();
      }
      _ => {}
    })
    .invoke_handler(tauri::generate_handler![
      discord_extractor::get_discord_token,
      setup_webview::open_setup_webview,
      setup_webview::bot_token_extracted,
      setup_webview::close_setup_webview
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
