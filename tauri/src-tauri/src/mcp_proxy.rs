use axum::{
    routing::any,
    Router,
    extract::{Extension, OriginalUri},
    http::{HeaderMap, StatusCode, Method},
    response::IntoResponse,
};
use std::net::SocketAddr;
use std::sync::Arc;
use tauri::command;
use tokio::net::TcpStream;
use std::sync::Mutex;
use once_cell::sync::Lazy;
use tokio::task::JoinHandle;
use axum::body::Body;
use futures_util::StreamExt;
use async_stream::stream;
use bytes::Bytes;

static MCP_PROXY_HANDLE: Lazy<Mutex<Option<JoinHandle<()>>>> = Lazy::new(|| Mutex::new(None));

pub struct ProxyConfig {
    pub backend_url: String,
}

async fn proxy_handler(
    Extension(config): Extension<Arc<ProxyConfig>>,
    headers: HeaderMap,
    method: Method,
    OriginalUri(uri): OriginalUri,
    body: Body,
) -> impl IntoResponse {
    // Create a stream of Bytes from the body
    let mut first = true;
    let req_stream = stream! {
        let mut stream = body.into_data_stream();
        while let Some(chunk_result) = stream.next().await {
            match chunk_result {
                Ok(chunk) => {
                    if first {
                        match std::str::from_utf8(&chunk) {
                            Ok(s) => println!("[MCP Proxy] Body (utf8, first chunk): {}", s),
                            Err(_) => println!("[MCP Proxy] Body (hex, first chunk): {}", hex::encode(&chunk)),
                        }
                        first = false;
                    }
                    yield Ok::<Bytes, std::io::Error>(chunk);
                }
                Err(e) => {
                    yield Err(std::io::Error::new(std::io::ErrorKind::Other, e));
                    break;
                }
            }
        }
    };
    let reqwest_body = reqwest::Body::wrap_stream(req_stream);
    println!("[MCP Proxy] {} {}", method, uri.path());
    println!("[MCP Proxy] Headers:");
    for (name, value) in headers.iter() {
        println!("  {}: {:?}", name, value);
    }
    // Build client request
    let client = reqwest::Client::new();
    let mut req_builder = client
        .request(method.clone(), format!("{}{}", config.backend_url, uri.path()))
        .body(reqwest_body);
    // Forward headers, except for 'host' and 'content-length'
    for (name, value) in headers.iter() {
        if name != "host" && name != "content-length" {
            req_builder = req_builder.header(name, value);
        }
    }
    let req = req_builder;
    match req.send().await {
        Ok(resp) => {
            let status = StatusCode::from_u16(resp.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
            let mut resp_headers = HeaderMap::new();
            for (k, v) in resp.headers().iter() {
                resp_headers.insert(k, v.clone());
            }
            let stream = resp.bytes_stream().map(|chunk| chunk.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e)));
            let body = Body::from_stream(stream);
            (status, resp_headers, body)
        }
        Err(e) => (
            StatusCode::BAD_GATEWAY,
            HeaderMap::new(),
            Body::from(format!("Proxy error: {}", e)),
        ),
    }
}

#[command]
pub async fn check_mcp_proxy_health() -> bool {
    let is_ok = TcpStream::connect("127.0.0.1:8080").await.is_ok();
    println!("MCP Proxy health check: {}", is_ok);
    is_ok
}

#[command]
pub async fn start_mcp_proxy() -> bool {
    let mut handle = MCP_PROXY_HANDLE.lock().unwrap();
    if handle.is_some() {
        println!("MCP Proxy already running");
        return true;
    }
    let config = ProxyConfig { backend_url: "http://localhost:3001".to_string() };
    let join = tokio::spawn(async move {
        run_proxy(config).await;
    });
    *handle = Some(join);
    println!("MCP Proxy started");
    true
}

#[command]
pub async fn stop_mcp_proxy() -> bool {
    let mut handle = MCP_PROXY_HANDLE.lock().unwrap();
    if let Some(h) = handle.take() {
        h.abort();
        true
    } else {
        false
    }
}

pub async fn run_proxy(config: ProxyConfig) {
    let config = Arc::new(config);
    let app = Router::new()
        .route("/{*path}", any(proxy_handler))
        .layer(Extension(config));

    let addr = SocketAddr::from(([127, 0, 0, 1], 8080));
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    println!("Proxy listening on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}