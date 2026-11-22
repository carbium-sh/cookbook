//! Quote a swap of 0.01 SOL to USDC with one quote call. Amounts are strings in base units: lamports and USDC atoms.
use carbium::{Carbium, ClientOptions, Code, QuoteParams, QuoteParamsAmountIn};
use serde_json::json;

const SOL: &str = "So11111111111111111111111111111111111111112";
const USDC: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

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
    let params = QuoteParams::new(SOL, USDC, QuoteParamsAmountIn::Text("10000000".into()), 50);
    let quote = client.quote(&params).await.unwrap_or_else(|e| fail(e));
    let route: Vec<String> = quote.route_plan.iter().map(|leg| format!("{} {}%", leg.swap_info.label, leg.percent)).collect();
    println!("{}", json!({
        "inputMint": quote.input_mint,
        "outputMint": quote.output_mint,
        "inAmount": quote.src_amount_in,
        "outAmount": quote.dest_amount_out, // net of the router fee
        "minAmountOut": quote.min_amount_out, // the floor a swap built from this quote enforces
        "route": route,
        "fee": quote.platform_fee,
        "quoteId": quote.quote_id, // valid for 30 seconds
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
