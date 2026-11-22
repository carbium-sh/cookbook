//! Look up a transaction and its status. A recent signature for the USDC mint stands in for yours:
//! getSignatureStatuses reads its status, then getTransaction reads the transaction itself.
use carbium::{
    Carbium, ClientOptions, Code, Commitment, EncodedTransaction, GetSignatureStatusesConfig, SignaturesForAddressConfig,
    TransactionConfig, TransactionEncoding,
};
use serde_json::json;

const ADDRESS: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC

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
    let mut latest = SignaturesForAddressConfig::new();
    latest.limit = Some(1);
    let latest = client.get_signatures_for_address(ADDRESS, Some(&latest)).await.unwrap_or_else(|e| fail(e));
    let Some(latest) = latest.first() else {
        eprintln!(r#"{{"status":200,"code":null,"message":"the address has no signature to look up"}}"#);
        std::process::exit(1);
    };
    let mut history = GetSignatureStatusesConfig::new();
    history.search_transaction_history = Some(true);
    let statuses = client.get_signature_statuses(&[latest.signature.clone()], Some(&history)).await.unwrap_or_else(|e| fail(e));
    let status = statuses.value.first().cloned().flatten();
    // max_supported_transaction_version 1: without it a version 1 transaction is refused.
    let mut config = TransactionConfig::new();
    config.encoding = Some(TransactionEncoding::Base64);
    config.max_supported_transaction_version = Some(1);
    config.commitment = Some(Commitment::Confirmed);
    let tx = client.get_transaction(&latest.signature, Some(&config)).await.unwrap_or_else(|e| fail(e));
    let bytes = match tx.as_ref().map(|t| &t.transaction) {
        Some(EncodedTransaction::Tuple(data, _)) => Some(data.len() / 4 * 3 - data.chars().rev().take_while(|c| *c == '=').count()),
        _ => None,
    };
    let meta = tx.as_ref().and_then(|t| t.meta.as_ref());
    println!("{}", json!({
        "signature": latest.signature,
        "slot": status.as_ref().map_or(latest.slot.clone(), |s| s.slot.clone()),
        "confirmationStatus": status.as_ref().and_then(|s| s.confirmation_status.clone()),
        "err": status.as_ref().and_then(|s| s.err.clone()),
        "blockTime": tx.as_ref().and_then(|t| t.block_time.clone()),
        "version": tx.as_ref().and_then(|t| t.version.clone()),
        "feeLamports": meta.map(|m| m.fee.clone()),
        "computeUnits": meta.and_then(|m| m.compute_units_consumed.clone()),
        "bytes": bytes,
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
