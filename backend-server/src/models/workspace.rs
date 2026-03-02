use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

mod datetime_rfc3339_or_bson {
    use chrono::{DateTime, Utc};
    use mongodb::bson::Bson;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(value: &DateTime<Utc>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&value.to_rfc3339())
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<DateTime<Utc>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = Bson::deserialize(deserializer)?;
        parse_bson_datetime(v).map_err(serde::de::Error::custom)
    }

    fn parse_bson_datetime(v: Bson) -> Result<DateTime<Utc>, String> {
        match v {
            Bson::DateTime(dt) => Ok(dt.to_chrono()),
            Bson::String(s) => chrono::DateTime::parse_from_rfc3339(&s)
                .map(|dt| dt.with_timezone(&Utc))
                .map_err(|e| format!("invalid RFC3339 datetime: {e}")),
            Bson::Document(doc) => {
                if let Some(Bson::DateTime(dt)) = doc.get("$date") {
                    Ok(dt.to_chrono())
                } else if let Some(Bson::String(s)) = doc.get("$date") {
                    chrono::DateTime::parse_from_rfc3339(s)
                        .map(|dt| dt.with_timezone(&Utc))
                        .map_err(|e| format!("invalid RFC3339 datetime in $date: {e}"))
                } else {
                    Err("unsupported datetime document shape".to_string())
                }
            }
            _ => Err("unsupported datetime value type".to_string()),
        }
    }
}

mod optional_datetime_rfc3339_or_bson {
    use chrono::{DateTime, Utc};
    use mongodb::bson::Bson;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(value: &Option<DateTime<Utc>>, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        match value {
            Some(dt) => serializer.serialize_some(&dt.to_rfc3339()),
            None => serializer.serialize_none(),
        }
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<DateTime<Utc>>, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = Option::<Bson>::deserialize(deserializer)?;
        match v {
            None | Some(Bson::Null) => Ok(None),
            Some(Bson::DateTime(dt)) => Ok(Some(dt.to_chrono())),
            Some(Bson::String(s)) => chrono::DateTime::parse_from_rfc3339(&s)
                .map(|dt| Some(dt.with_timezone(&Utc)))
                .map_err(serde::de::Error::custom),
            Some(Bson::Document(doc)) => {
                if let Some(Bson::DateTime(dt)) = doc.get("$date") {
                    Ok(Some(dt.to_chrono()))
                } else if let Some(Bson::String(s)) = doc.get("$date") {
                    chrono::DateTime::parse_from_rfc3339(s)
                        .map(|dt| Some(dt.with_timezone(&Utc)))
                        .map_err(serde::de::Error::custom)
                } else {
                    Err(serde::de::Error::custom("unsupported datetime document shape"))
                }
            }
            Some(_) => Err(serde::de::Error::custom("unsupported datetime value type")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationConfig {
    pub discord_webhook_url: Option<String>,
    pub line_notify_token: Option<String>,
    pub enabled: bool,
    pub days: Vec<u8>, // 0=Sun, 1=Mon, ..., 6=Sat
    pub time: String,  // "HH:MM"
    #[serde(with = "optional_datetime_rfc3339_or_bson")]
    pub last_sent_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub notify_on_create: bool,
    #[serde(default)]
    pub notify_on_status_change: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workspace {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
    pub owner_id: ObjectId,
    pub room_code: String,
    pub notification_config: Option<NotificationConfig>,
    #[serde(with = "datetime_rfc3339_or_bson")]
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Deserialize)]
pub struct CreateWorkspaceRequest {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateWorkspaceRequest {
    pub name: String,
    pub color: Option<String>,
    pub icon: Option<String>,
}

#[derive(Deserialize)]
pub struct UpdateNotificationConfigRequest {
    pub discord_webhook_url: Option<String>,
    pub line_notify_token: Option<String>,
    pub enabled: bool,
    pub days: Vec<u8>,
    pub time: String,
    pub notify_on_create: bool,
    pub notify_on_status_change: Vec<String>,
}
