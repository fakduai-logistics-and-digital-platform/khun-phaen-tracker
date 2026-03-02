use mongodb::bson::oid::ObjectId;
use serde::{Deserialize, Serialize};

mod object_id_or_string {
    use mongodb::bson::Bson;
    use serde::{Deserialize, Deserializer, Serializer};

    pub fn serialize<S>(value: &String, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(value)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<String, D::Error>
    where
        D: Deserializer<'de>,
    {
        let v = Bson::deserialize(deserializer)?;
        match v {
            Bson::String(s) => Ok(s),
            Bson::ObjectId(oid) => Ok(oid.to_hex()),
            Bson::Binary(b) if b.bytes.len() == 16 => {
                let mut arr = [0u8; 16];
                arr.copy_from_slice(&b.bytes);
                Ok(uuid::Uuid::from_bytes(arr).to_string())
            }
            other => Err(serde::de::Error::custom(format!("expected string, ObjectId, or Binary UUID, got: {:?}", other))),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Milestone {
    #[serde(rename = "_id", with = "object_id_or_string")]
    pub id: String,
    pub workspace_id: ObjectId,
    pub title: String,
    pub description: Option<String>,
    pub target_date: String, // ISO 8601
    #[serde(default)]
    pub is_hidden: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateMilestoneRequest {
    pub title: String,
    pub description: Option<String>,
    pub target_date: String,
    #[serde(default)]
    pub is_hidden: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdateMilestoneRequest {
    pub title: Option<String>,
    pub description: Option<Option<String>>,
    pub target_date: Option<String>,
    pub is_hidden: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_milestone_serialization() {
        let id = Uuid::now_v7().to_string();
        let ws_id = ObjectId::new();
        let milestone = Milestone {
            id: id.clone(),
            workspace_id: ws_id,
            title: "Test Milestone".to_string(),
            description: Some("Test Description".to_string()),
            target_date: "2024-12-31".to_string(),
            is_hidden: false,
            created_at: Some("2024-03-01".to_string()),
            updated_at: Some("2024-03-01".to_string()),
        };

        let serialized = serde_json::to_string(&milestone).unwrap();
        assert!(serialized.contains(&id.to_string()));
        assert!(serialized.contains(&ws_id.to_string()));
    }
}
