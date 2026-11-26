//! Builds an unsigned transaction for your own wallet to sign. This example holds no private key, signs nothing and sends nothing.
//!
//! Quotes 0.01 SOL to USDC, builds the swap for one wallet's public key, and prints what that wallet would pay.
use carbium::{Carbium, ClientOptions, Code, QuoteParams, QuoteParamsAmountIn, SwapParams};
use serde_json::json;

const SOL: &str = "So11111111111111111111111111111111111111112";
const USDC: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// The wallet that would sign and pay the fees. Put your own public key here.
const USER_PUBKEY: &str = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";

#[tokio::main]
async fn main() {
    // CARBIUM_KEY is optional here: unset, the calls go out with no key, up to 30 a minute per IP address.
    let client = Carbium::new(ClientOptions { api_key: std::env::var("CARBIUM_KEY").ok(), ..Default::default() }).unwrap_or_else(|e| fail(e));
    let params = QuoteParams::new(SOL, USDC, QuoteParamsAmountIn::Text("10000000".into()), 50);
    let quote = client.quote(&params).await.unwrap_or_else(|e| fail(e));
    let swap = client.swap(&SwapParams::new(quote.quote_id.clone(), USER_PUBKEY)).await.unwrap_or_else(|e| fail(e));
    println!("{}", json!({
        "userPubkey": USER_PUBKEY,
        "inAmount": quote.src_amount_in,
        "outAmount": quote.dest_amount_out,
        "minAmountOut": swap.min_amount_out,
        "signatureFeeLamports": "5000",
        "priorityFeeLamports": swap.priority_fee_lamports,
        "rentLamports": swap.rent_lamports,
        "lastValidBlockHeight": swap.last_valid_block_height,
        // Base64. Decode it as a versioned transaction and sign it with your own wallet.
        "transaction": swap.transaction,
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
