//! List a wallet's tokens and NFTs, page by page, with getAssetsByOwner. show_fungible adds the tokens it holds.
use carbium::{Carbium, ClientOptions, Code, DasDisplayOptions, DasSort, DasSortBy, GetAssetsByOwnerParams, SortOrder};
use serde_json::{Value, json};

const OWNER: &str = "DFFiJgCASVfPEQgRkrjkYAPGtFyo2pygx9aGp5XpMT9H";
const LIMIT: u64 = 10;
const MAX_PAGES: u64 = 2; // this example stops after two pages; raise it to read everything

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
    let mut assets = Vec::new();
    let mut pages_read = 0;
    let mut next_page = Some(1);
    while let Some(page) = next_page.filter(|_| pages_read < MAX_PAGES) {
        let mut params = GetAssetsByOwnerParams::new(OWNER);
        params.limit = Some(LIMIT);
        params.page = Some(page);
        let mut sort = DasSort::new(DasSortBy::Id);
        sort.sort_direction = Some(SortOrder::Asc);
        params.sort_by = Some(sort);
        let mut options = DasDisplayOptions::new();
        options.show_fungible = Some(true);
        params.options = Some(options);
        let list = client.get_assets_by_owner(&params).await.unwrap_or_else(|e| fail(e));
        for asset in &list.items {
            let name = asset.content.as_ref().and_then(|c| c.get("metadata")).and_then(|m| m.get("name")).and_then(Value::as_str).filter(|n| !n.is_empty());
            assets.push(json!({ "id": asset.id, "interface": asset.interface, "name": name }));
        }
        pages_read += 1;
        // A page shorter than the limit is the last one.
        next_page = if (list.items.len() as u64) < LIMIT { None } else { Some(page + 1) };
    }
    println!("{}", json!({ "owner": OWNER, "limit": LIMIT, "pagesRead": pages_read, "nextPage": next_page, "assets": assets }));
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
