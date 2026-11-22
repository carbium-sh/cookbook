//! Verify a webhook delivery, offline. A delivery is a POST whose webhook-signature header carries an HMAC-SHA256 of
//! webhook-id.webhook-timestamp.body under the webhook's secret. This example makes a made-up secret and a sample
//! delivery in the shape of carbium.sh's test event, checks it with the crate's verify_webhook, then shows the same
//! delivery with one byte changed being refused. In your receiver, take the secret from CARBIUM_WEBHOOK_SECRET and pass
//! the raw body bytes as they arrived.
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use carbium::webhooks::{VerifyOptions, verify_webhook};
use hmac::{Hmac, KeyInit, Mac};
use serde_json::json;
use sha2::{Digest, Sha256};

fn main() {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    // carbium.sh shows a webhook's secret once, when you create or rotate the webhook: whsec_ and then base64. This
    // made-up one is derived from the clock.
    let key = Sha256::digest(now.as_nanos().to_le_bytes());
    let secret = format!("whsec_{}", STANDARD.encode(key));

    // The sample delivery: the body and the three headers carbium.sh sends.
    let timestamp = now.as_secs().to_string();
    let body = format!(
        r#"[{{"slot":0,"blockTime":{timestamp},"indexWithinBlock":0,"signature":"{}","err":null,"status":{{"Ok":null}},"test":true}}]"#,
        "1".repeat(64)
    );
    let webhook_id = format!("evt_test_{:016x}", now.as_nanos() as u64);
    let mut mac = Hmac::<Sha256>::new_from_slice(&key).expect("any key length");
    mac.update(format!("{webhook_id}.{timestamp}.").as_bytes());
    mac.update(body.as_bytes());
    let signature = format!("v1,{}", STANDARD.encode(mac.finalize().into_bytes()));
    let headers = [("webhook-id", webhook_id.as_str()), ("webhook-timestamp", timestamp.as_str()), ("webhook-signature", signature.as_str())];

    let options = VerifyOptions::default();
    let events = match verify_webhook(body.as_bytes(), &headers, &secret, &options) {
        Ok(events) => events,
        Err(error) => {
            eprintln!(r#"{{"status":{},"code":{},"message":{}}}"#, error.http_status(), json!(error.reason()), json!(error.message()));
            std::process::exit(1);
        }
    };
    // One byte changed: "slot":0 becomes "slot":1.
    let changed = body.replacen(r#""slot":0"#, r#""slot":1"#, 1);
    let refused = match verify_webhook(changed.as_bytes(), &headers, &secret, &options) {
        Ok(_) => "accepted".to_string(),
        Err(error) => error.reason().unwrap_or("error").to_string(),
    };
    if refused != "no_match" {
        eprintln!(r#"{{"status":0,"code":{},"message":"a delivery with one byte changed was not refused"}}"#, json!(refused));
        std::process::exit(1);
    }
    let test = events.first().and_then(|e| e.test) == Some(true);
    println!("{}", json!({ "webhookId": webhook_id, "events": events.len(), "test": test, "changedByte": refused }));
}
