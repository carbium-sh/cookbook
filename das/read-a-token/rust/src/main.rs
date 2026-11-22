//! Read a token: its name and symbol (getAsset), its supply (getTokenSupply) and one holder's balance (getTokenAccounts).
use carbium::{Carbium, ClientOptions, Code, GetAssetParams, GetTokenAccountsParams};
use serde_json::{Value, json};

const MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

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
    let asset = client.get_asset(&GetAssetParams::new(MINT)).await.unwrap_or_else(|e| fail(e));
    let supply = client.get_token_supply(MINT, None).await.unwrap_or_else(|e| fail(e)).value;
    let mut holders = GetTokenAccountsParams::new();
    holders.mint = Some(MINT.to_string());
    holders.limit = Some(1);
    let holders = client.get_token_accounts(&holders).await.unwrap_or_else(|e| fail(e));
    let metadata = asset.content.as_ref().and_then(|c| c.get("metadata"));
    let field = |name: &str| metadata.and_then(|m| m.get(name)).and_then(Value::as_str);
    let holder = holders.token_accounts.first().map(|h| json!({ "owner": h.owner, "tokenAccount": h.address, "amount": h.amount.to_string() }));
    println!("{}", json!({
        "mint": MINT,
        "name": field("name"),
        "symbol": field("symbol"),
        "decimals": supply.decimals,
        "supply": supply.ui_amount_string,
        "holder": holder,
    }));
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
