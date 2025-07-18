use crate::database::connection::get_database_connection_with_app;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct McpServerDefinition {
    pub command: String,
    pub args: Vec<String>,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct McpServersConfig {
    pub mcp_servers: std::collections::HashMap<String, McpServerDefinition>,
}

#[tauri::command]
pub async fn run_mcp_server_in_sandbox(
    _app: tauri::AppHandle,
    server_name: String,
    config: McpServerDefinition,
) -> Result<String, String> {
    use std::process::Stdio;
    use tokio::io::{AsyncBufReadExt, BufReader};
    use tokio::process::Command as TokioCommand;

    println!("Starting MCP server '{}' in sandbox", server_name);

    // Build the command with all arguments
    let mut child = TokioCommand::new("sandbox-exec")
        .arg("-f").arg("./sandbox-exec-profiles/mcp-server-everything-for-now.sb")
        .arg(&config.command)
        .args(&config.args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn sandboxed MCP server: {}", e))?;

    println!("MCP server '{}' started in sandbox!", server_name);

    // Handle stdout
    if let Some(stdout) = child.stdout.take() {
        let mut reader = BufReader::new(stdout).lines();
        let server_name_clone = server_name.clone();
        tauri::async_runtime::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                print!("[MCP Server '{}' stdout] {}\n", server_name_clone, line);
            }
        });
    }

    // Handle stderr
    if let Some(stderr) = child.stderr.take() {
        let mut reader = BufReader::new(stderr).lines();
        let server_name_clone = server_name.clone();
        tauri::async_runtime::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                eprint!("[MCP Server '{}' stderr] {}\n", server_name_clone, line);
            }
        });
    }

    // Wait for the process to complete
    match child.wait().await {
        Ok(status) => {
            if status.success() {
                Ok(format!("MCP server '{}' completed successfully", server_name))
            } else {
                Ok(format!("MCP server '{}' exited with status: {:?}", server_name, status))
            }
        }
        Err(e) => Err(format!("MCP server failed: {}", e))
    }
}


#[tauri::command]
pub async fn save_mcp_server(app: tauri::AppHandle, name: String, command: String, args: Vec<String>) -> Result<(), String> {
    let conn = get_database_connection_with_app(&app).map_err(|e| format!("Failed to get database connection: {}", e))?;

    let args_json = serde_json::to_string(&args).map_err(|e| format!("Failed to serialize args: {}", e))?;

    conn.execute(
        "INSERT OR REPLACE INTO mcp_servers (name, command, args) VALUES (?1, ?2, ?3)",
        [&name, &command, &args_json],
    ).map_err(|e| format!("Failed to save MCP server: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn load_mcp_servers(app: tauri::AppHandle) -> Result<std::collections::HashMap<String, McpServerDefinition>, String> {
    let conn = get_database_connection_with_app(&app).map_err(|e| format!("Failed to get database connection: {}", e))?;

    let mut stmt = conn.prepare("SELECT name, command, args FROM mcp_servers").map_err(|e| format!("Failed to prepare statement: {}", e))?;
    let rows = stmt.query_map([], |row| {
        let args_json: String = row.get(2)?;
        let args: Vec<String> = serde_json::from_str(&args_json).map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
        Ok((
            row.get::<_, String>(0)?,
            McpServerDefinition {
                command: row.get(1)?,
                args,
            }
        ))
    }).map_err(|e| format!("Failed to query MCP servers: {}", e))?;

    let mut servers = std::collections::HashMap::new();
    for row in rows {
        let (name, config) = row.map_err(|e| format!("Failed to read row: {}", e))?;
        servers.insert(name, config);
    }

    Ok(servers)
}

#[tauri::command]
pub async fn delete_mcp_server(app: tauri::AppHandle, name: String) -> Result<(), String> {
    let conn = get_database_connection_with_app(&app).map_err(|e| format!("Failed to get database connection: {}", e))?;

    conn.execute(
        "DELETE FROM mcp_servers WHERE name = ?1",
        [&name],
    ).map_err(|e| format!("Failed to delete MCP server: {}", e))?;

    Ok(())
}

pub async fn start_all_mcp_servers(app: tauri::AppHandle) -> Result<(), String> {
    println!("Starting all persisted MCP servers...");

    // Load all persisted MCP servers
    let conn = get_database_connection_with_app(&app).map_err(|e| format!("Failed to get database connection: {}", e))?;
    let mut stmt = conn.prepare("SELECT name, command, args FROM mcp_servers").map_err(|e| format!("Failed to prepare statement: {}", e))?;
    let rows = stmt.query_map([], |row| {
        let args_json: String = row.get(2)?;
        let args: Vec<String> = serde_json::from_str(&args_json).map_err(|e| rusqlite::Error::InvalidParameterName(e.to_string()))?;
        Ok((row.get::<_, String>(0)?, McpServerDefinition {
            command: row.get(1)?,
            args,
        }))
    }).map_err(|e| format!("Failed to query MCP servers: {}", e))?;

    let mut servers = std::collections::HashMap::new();
    for row in rows {
        let (name, definition) = row.map_err(|e| format!("Failed to parse row: {}", e))?;
        servers.insert(name, definition);
    }

    if servers.is_empty() {
        println!("No persisted MCP servers found to start.");
        return Ok(());
    }

    println!("Found {} MCP servers to start", servers.len());

    // Start each server in the background
    for (server_name, config) in servers {
        let app_clone = app.clone();

        tauri::async_runtime::spawn(async move {
            match run_mcp_server_in_sandbox(app_clone, server_name, config).await {
                Ok(result) => println!("MCP server started successfully: {}", result),
                Err(e) => eprintln!("Failed to start MCP server: {}", e),
            }
        });
    }

    println!("All MCP servers have been queued for startup.");
    Ok(())
}
