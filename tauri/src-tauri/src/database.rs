use rusqlite::{Connection, Result};
use std::path::Path;
use tauri::Manager;

pub fn get_database_connection() -> Result<Connection> {
    let db_path = Path::new("mcp_servers.db");
    let conn = Connection::open(db_path)?;
    Ok(conn)
}

pub fn get_database_connection_with_app(app: &tauri::AppHandle) -> Result<Connection> {
    let data_dir = app.path()
        .app_data_dir()
        .map_err(|e| rusqlite::Error::InvalidPath(e.to_string().into()))?;

    std::fs::create_dir_all(&data_dir)
        .map_err(|e| rusqlite::Error::InvalidPath(e.to_string().into()))?;

    let db_path = data_dir.join("mcp_servers.db");
    let conn = Connection::open(db_path)?;
    Ok(conn)
}

pub fn init_database(app: tauri::AppHandle) -> Result<(), String> {
    println!("Initializing database...");

    let conn = get_database_connection_with_app(&app)
        .map_err(|e| format!("Failed to get database connection: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS mcp_servers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            command TEXT NOT NULL,
            args TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    ).map_err(|e| format!("Failed to create table: {}", e))?;

    println!("Database initialized successfully");

    Ok(())
}
