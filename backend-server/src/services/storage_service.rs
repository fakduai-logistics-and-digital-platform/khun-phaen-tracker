use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::Client;
use std::env;

pub async fn create_s3_client() -> Client {
    // 1. Get configuration
    let access_key = env::var("RUSTFS_ACCESS_KEY").unwrap_or_else(|_| "rustfsadmin".to_string());
    let secret_key = env::var("RUSTFS_SECRET_KEY").unwrap_or_else(|_| "rustfsadmin".to_string());
    let endpoint_url =
        env::var("STORAGE_URL").unwrap_or_else(|_| "http://localhost:9000".to_string());

    // 2. Set credentials
    let credentials = Credentials::new(access_key, secret_key, None, None, "static");

    // 3. Create the configuration for S3 that points to RustFS
    let region_provider = RegionProviderChain::default_provider().or_else(Region::new("us-east-1"));

    let config = aws_config::defaults(aws_config::BehaviorVersion::latest())
        .region(region_provider)
        .credentials_provider(credentials)
        .endpoint_url(&endpoint_url)
        .load()
        .await;

    // 4. Force path style is important for S3-compatible endpoints
    let s3_config = aws_sdk_s3::config::Builder::from(&config)
        .force_path_style(true)
        .build();

    tracing::info!(
        "🔗 Initialized S3 storage client to endpoint: {}",
        endpoint_url
    );

    Client::from_conf(s3_config)
}

pub async fn ensure_bucket_exists(
    client: &Client,
    bucket_name: &str,
) -> Result<(), aws_sdk_s3::Error> {
    let resp = client.list_buckets().send().await?;
    let buckets = resp.buckets();

    let exists = buckets.iter().any(|b| b.name() == Some(bucket_name));

    if !exists {
        tracing::info!("🪣 Bucket '{}' does not exist, creating it...", bucket_name);
        client.create_bucket().bucket(bucket_name).send().await?;
        tracing::info!("✅ Bucket '{}' created successfully", bucket_name);
    } else {
        tracing::debug!("✅ Bucket '{}' exists", bucket_name);
    }

    Ok(())
}
