mod discord_extractor;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        #[allow(unused_imports)]
        use tauri::Manager;
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
                   window.show().unwrap();
                   window.set_focus().unwrap();
               }
            }
            _ => ()
        })
        .on_tray_icon_event(|tray, event| {
            if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    window.show().unwrap();
                    window.set_focus().unwrap();
                }
            }
        })
        .build(app)?;
      
      use tauri_plugin_shell::ShellExt;
      use tauri_plugin_shell::process::CommandEvent;

      // Note: According to Tauri CWD, we might need to adjust the path if run from src-tauri directly.
      let node_script_path = if std::path::Path::new("core/dist/index.js").exists() {
           "core/dist/index.js"
      } else {
           "../core/dist/index.js"
      };

      if let Ok((mut rx, _child)) = app.handle().shell().command("node").args([node_script_path]).spawn() {
          tauri::async_runtime::spawn(async move {
              while let Some(event) = rx.recv().await {
                  match event {
                      CommandEvent::Stdout(line) => println!("[Node Core] {}", String::from_utf8_lossy(&line)),
                      CommandEvent::Stderr(line) => eprintln!("[Node Error] {}", String::from_utf8_lossy(&line)),
                      _ => (),
                  }
              }
          });
      } else {
          eprintln!("[Tauri] Impossible de démarrer le Core Node.js ! Vérifiez le chemin vers core/dist/index.js");
      }

      Ok(())
    })
    .on_window_event(|window, event| match event {
      tauri::WindowEvent::CloseRequested { api, .. } => {
        // Hide window instead of quitting the selfbot
        window.hide().unwrap();
        api.prevent_close();
      }
      _ => {}
    })
    .invoke_handler(tauri::generate_handler![discord_extractor::get_discord_token])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
