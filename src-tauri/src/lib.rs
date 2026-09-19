use tauri::webview::NewWindowResponse;

// Navigation never promotes a remote document into the privileged main window.
fn local_navigation(url: &tauri::Url) -> bool {
    if !url.username().is_empty() || url.password().is_some() || url.port().is_some() {
        #[cfg(debug_assertions)]
        return url.origin().ascii_serialization() == "http://127.0.0.1:5567"
            && url.username().is_empty()
            && url.password().is_none();
        #[cfg(not(debug_assertions))]
        return false;
    }
    matches!(
        (url.scheme(), url.host_str()),
        ("tauri", Some("localhost")) | ("http", Some("tauri.localhost"))
    )
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // JS routes approved links; do not let the opener auto-open every popup.
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .setup(|app| {
            tauri::WebviewWindowBuilder::from_config(app, &app.config().app.windows[0])?
                .on_navigation(local_navigation)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running TypeWords desktop");
}

#[cfg(test)]
mod tests {
    use super::local_navigation;

    #[test]
    fn main_window_keeps_remote_documents_out() {
        for url in ["http://tauri.localhost/words", "tauri://localhost/setting"] {
            assert!(local_navigation(&url.parse().unwrap()), "{url}");
        }
        for url in [
            "https://github.com/zyronon/TypeWords",
            "https://tauri.localhost/",
            "http://tauri.localhost.evil.test/",
            "http://tauri.localhost:5567/",
            "http://user@tauri.localhost/",
            "file:///tmp/index.html",
            "data:text/html,hello",
        ] {
            assert!(!local_navigation(&url.parse().unwrap()), "{url}");
        }
        assert_eq!(
            local_navigation(&"http://127.0.0.1:5567/".parse().unwrap()),
            cfg!(debug_assertions)
        );
        assert!(!local_navigation(
            &"http://127.0.0.1:5568/".parse().unwrap()
        ));
    }
}
