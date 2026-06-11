mod discord_extractor;
use tauri::Manager;

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

      let resource_dir = app.path().resource_dir()
          .unwrap_or_default();

      let node_script_path = resource_dir.join("core").join("dist").join("index.js");

      if !node_script_path.exists() {
          eprintln!("[Tauri] Core introuvable: {}", node_script_path.display());
          return Ok(());
      }

      let script_path_str = node_script_path.to_string_lossy().to_string();

      match app.handle().shell().command("node").args([&script_path_str]).spawn() {
          Ok((mut rx, _child)) => {
              tauri::async_runtime::spawn(async move {
                  while let Some(event) = rx.recv().await {
                      match event {
                          CommandEvent::Stdout(line) => println!("[Node Core] {}", String::from_utf8_lossy(&line)),
                          CommandEvent::Stderr(line) => eprintln!("[Node Error] {}", String::from_utf8_lossy(&line)),
                          _ => (),
                      }
                  }
              });
          }
          Err(e) => {
              eprintln!("[Tauri] Impossible de démarrer le Core Node.js : {}", e);
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
    .invoke_handler(tauri::generate_handler![discord_extractor::get_discord_token])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
