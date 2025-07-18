// use std::sync::Mutex;

// pub struct PortState(pub Mutex<u16>);

pub fn get_free_port() -> Result<u16, String> {
    Ok(std::net::TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind to port: {}", e))?
        .local_addr()
        .map_err(|e| format!("Failed to get local address: {}", e))?
        .port())
}

// pub fn load_dotenv_file() -> Result<(), String> {
//     // Get the executable path and find .env relative to it
//     let exe_path = std::env::current_exe()
//         .map_err(|e| format!("Failed to get executable path: {}", e))?;

//     // Look for .env in the same directory as the executable
//     let env_path = exe_path.parent()
//         .ok_or("Failed to get executable directory")?
//         .join(".env");

//     // If not found there, try the src-tauri directory (for development)
//     // let env_path = if env_path.exists() {
//     //     env_path
//     // } else {
//     //     exe_path.parent()
//     //         .ok_or("Failed to get executable directory")?
//     //         .join("src-tauri")
//     //         .join(".env")
//     // };

//     // If .env doesn't exist, try to copy from .env.example
//     if !env_path.exists() {
//         println!("No .env file found at {:?}", env_path);

//         let env_example_path = env_path.parent()
//             .ok_or("Failed to get .env parent directory")?
//             .join(".env.example");

//         if env_example_path.exists() {
//             std::fs::copy(&env_example_path, &env_path)
//                 .map_err(|e| format!("Failed to copy .env.example to .env: {}", e))?;
//             println!("Copied .env.example to .env at {:?}", env_path);
//         } else {
//             return Err(format!("Neither .env nor .env.example found in {:?}", env_path.parent().unwrap()));
//         }
//     }

//     // Load the .env file
//     dotenv::from_path(&env_path)
//         .map_err(|e| format!("Failed to load .env file: {}", e))?;

//     Ok(())
// }
