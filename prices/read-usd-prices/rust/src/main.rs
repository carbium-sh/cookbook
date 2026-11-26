//! Read the USD price of a few mints with one prices call. The table behind it is rebuilt about every 30 seconds.
use carbium::{Carbium, ClientOptions, Code, PricesParams};
use serde_json::{Map, json};

const MINTS: [&str; 3] = [
    "So11111111111111111111111111111111111111112",  // SOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
];

#[tokio::main]
async fn main() {
    // CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
    let client = Carbium::new(ClientOptions { api_key: std::env::var("CARBIUM_KEY").ok(), ..Default::default() }).unwrap_or_else(|e| fail(e));
    let mut params = PricesParams::new();
    params.mints = Some(MINTS.iter().map(|m| m.to_string()).collect());
    let table = client.prices(&params).await.unwrap_or_else(|e| fail(e));
    // Each row is (mint, price in USD or None, TVL in USD, quote mint). A mint the table does not carry is absent.
    let prices: Map<String, serde_json::Value> = table.rows.iter().map(|(mint, price, _, _)| (mint.clone(), json!(price))).collect();
    // stale counts the table's rows that are stale, 0 when none.
    println!("{}", json!({ "solUsd": table.sol_usd, "builtUnix": table.built_unix, "stale": table.stale, "prices": prices }));
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
