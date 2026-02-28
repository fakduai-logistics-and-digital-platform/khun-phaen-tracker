use mongodb::{Collection, Database, bson::doc};
use crate::models::profile::UserProfile;

pub struct ProfileRepository {
    collection: Collection<UserProfile>,
}

impl ProfileRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("user_profiles"),
        }
    }

    pub async fn create(&self, profile: UserProfile) -> mongodb::error::Result<()> {
        self.collection.insert_one(profile, None).await?;
        Ok(())
    }

    pub async fn find_by_user_id(&self, user_id: &str) -> mongodb::error::Result<Option<UserProfile>> {
        self.collection.find_one(doc! { "user_id": user_id }, None).await
    }

    pub async fn delete_by_user_id(&self, user_id: &str) -> mongodb::error::Result<()> {
        self.collection.delete_one(doc! { "user_id": user_id }, None).await?;
        Ok(())
    }
}
