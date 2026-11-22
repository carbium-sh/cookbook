//! Follow a wallet over WebSocket. logsSubscribe with mentions fires for every transaction that touches the wallet;
//! getBalance reads the balance it starts from. The example takes at most one notification within 10 seconds, then
//! unsubscribes and exits.
use std::time::{Duration, Instant};

use carbium::ws::{Carrier, SocketEvent, SocketState};
use carbium::{Carbium, ClientOptions, Code, Commitment, CommitmentConfig};
use serde_json::{Value, json};
use tokio::sync::mpsc::UnboundedReceiver;

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
    // The default carrier: the key travels in the x-api-key header of the handshake.
    let (socket, mut events) = client.socket(Carrier::default()).unwrap_or_else(|e| fail(e));
    let mut sub = socket
        .logs_subscribe(json!({ "mentions": [WALLET] }), Some(json!({ "commitment": "confirmed" })))
        .unwrap_or_else(|e| fail(e));
    let work = async {
        let subscription = sub.ready().await?;
        let mut config = CommitmentConfig::new();
        config.commitment = Some(Commitment::Confirmed);
        let balance = client.get_balance(WALLET, Some(&config)).await?;
        let started = Instant::now();
        let notification = match tokio::time::timeout(Duration::from_secs(10), sub.next()).await {
            Ok(Some(Ok(n))) => json!({ "slot": n.context.slot, "signature": n.value.signature, "failed": n.value.err.is_some() }),
            Ok(Some(Err(e))) => return Err(e),
            _ => Value::Null,
        };
        let waited_ms = started.elapsed().as_millis() as u64;
        sub.unsubscribe();
        Ok(json!({ "wallet": WALLET, "subscription": subscription, "lamports": balance.value, "waitedMs": waited_ms, "notification": notification }))
    };
    // Nothing here waits longer than 20 seconds in all. A fatal event (a refused or revoked key) ends the run at once.
    let output = tokio::select! {
        done = tokio::time::timeout(Duration::from_secs(20), work) => match done {
            Ok(Ok(output)) => output,
            Ok(Err(error)) => fail(error),
            Err(_) => {
                eprintln!(r#"{{"status":0,"code":null,"message":"no answer within 20 seconds"}}"#);
                std::process::exit(1);
            }
        },
        error = fatal(&mut events) => fail(error),
    };
    // The unsubscribe goes out before the socket closes; wait for that, briefly, then print.
    let _ = tokio::time::timeout(Duration::from_secs(2), closed(&mut events)).await;
    println!("{output}");
}

/// The socket's fatal error, when it gives up for good.
async fn fatal(events: &mut UnboundedReceiver<SocketEvent>) -> carbium::Error {
    loop {
        match events.recv().await {
            Some(SocketEvent::Fatal(error)) => return error,
            Some(_) => {}
            None => std::future::pending::<()>().await,
        }
    }
}

/// Resolves once the socket is idle again after the unsubscribe. A fatal close that came instead ends the run with it.
async fn closed(events: &mut UnboundedReceiver<SocketEvent>) {
    while let Some(event) = events.recv().await {
        match event {
            SocketEvent::Fatal(error) => fail(error),
            SocketEvent::State(SocketState::Idle, _) => return,
            _ => {}
        }
    }
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
