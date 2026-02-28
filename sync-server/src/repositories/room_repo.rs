use mongodb::{bson::doc, Collection, Database};

#[derive(Clone)]
pub struct RoomRepository {
    collection: Collection<serde_json::Value>,
}

impl RoomRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("rooms"),
        }
    }

    pub async fn find_by_code(&self, room_code: &str) -> mongodb::error::Result<Option<serde_json::Value>> {
        self.collection.find_one(doc! { "room_code": room_code }, None).await
    }

    pub async fn upsert_document(&self, room_code: &str, document: &str) -> mongodb::error::Result<()> {
        let filter = doc! { "room_code": room_code };
        let update = doc! {
            "$set": {
                "document": document,
                "last_sync": mongodb::bson::DateTime::now()
            },
        };
        let options = mongodb::options::UpdateOptions::builder().upsert(true).build();
        self.collection.update_one(filter, update, options).await?;
        Ok(())
    }
}
