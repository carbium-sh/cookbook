//! Page through a wallet's history. getSignaturesForAddress pages with a before cursor: the last signature of a page.
//! getTransactionsForAddress pages with the paginationToken of its answer, None on the last page.
use carbium::{AddressHistoryDetails, Carbium, ClientOptions, Code, SignaturesForAddressConfig, TransactionsForAddressConfig};
use serde_json::json;

const ADDRESS: &str = "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9";
const LIMIT: u64 = 5;
const MAX_PAGES: usize = 2; // this example stops after two pages; raise it to read further back

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
    let mut pages = Vec::new();
    let (mut newest, mut oldest): (Option<String>, Option<String>) = (None, None);
    while pages.len() < MAX_PAGES {
        let mut config = SignaturesForAddressConfig::new();
        config.limit = Some(LIMIT);
        config.before = oldest.clone();
        let page = client.get_signatures_for_address(ADDRESS, Some(&config)).await.unwrap_or_else(|e| fail(e));
        pages.push(page.len());
        if newest.is_none() {
            newest = page.first().map(|s| s.signature.clone());
        }
        oldest = page.last().map(|s| s.signature.clone()).or(oldest);
        if (page.len() as u64) < LIMIT {
            break; // the last page
        }
    }
    // The same history in the other shape, newest first: each answer's paginationToken asks for the next page.
    let (mut rows, mut token, mut history_floor) = (Vec::new(), None::<String>, None);
    loop {
        let mut config = TransactionsForAddressConfig::new();
        config.limit = Some(LIMIT);
        config.transaction_details = Some(AddressHistoryDetails::Signatures);
        config.pagination_token = token.clone();
        let answer = client.get_transactions_for_address(ADDRESS, Some(&config)).await.unwrap_or_else(|e| fail(e));
        rows.push(answer.data.len());
        token = answer.pagination_token;
        history_floor = answer.history_floor.or(history_floor);
        if token.is_none() || rows.len() >= MAX_PAGES {
            break;
        }
    }
    println!("{}", json!({
        "address": ADDRESS,
        "pages": pages,
        "newest": newest,
        "oldest": oldest,
        // It reads only down to historyFloor, the ledger floor: an address quiet since then shows no rows here.
        "transactionsForAddress": { "pages": rows, "more": token.is_some(), "historyFloor": history_floor },
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
