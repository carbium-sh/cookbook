//! Get a wallet's SOL balance with one getBalance call.
use carbium::{Carbium, ClientOptions, Code, Commitment, CommitmentConfig};
use serde_json::json;

const WALLET: &str = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

#[tokio::main]
async fn main() {
    let api_key = match std::env::var("CARBIUM_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            eprintln!("set CARBIUM_KEY to your c_serv_ key");
            std::process::exit(2);
        }
    };
    let client = Carbium::new(ClientOptions { api_key: Some(api_key), ..Default::default() }).unwrap_or_else(|e| fail(e));
    let mut config = CommitmentConfig::new();
    config.commitment = Some(Commitment::Confirmed);
    let answer = client.get_balance(WALLET, Some(&config)).await.unwrap_or_else(|e| fail(e));
    let lamports = answer.value.as_u64().unwrap_or_default();
    println!("{}", json!({ "wallet": WALLET, "lamports": lamports, "sol": lamports as f64 / 1e9, "slot": answer.context.slot }));
}

/// Prints the HTTP status, the error code and the message as one line of JSON on stderr, and exits 1.
fn fail(error: carbium::Error) -> ! {
    let code = match error.code() {
        Some(Code::Number(n)) => n.to_string(),
        Some(code) => json!(code.to_string()).to_string(),
        None => "null".to_string(),
    };
    eprintln!(r#"{{"status":{},"code":{},"message":{}}}"#, error.http_status(), code, json!(error.message()));
    std::process::exit(1)
}
