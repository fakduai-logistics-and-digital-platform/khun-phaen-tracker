use mongodb::{bson::{doc, oid::ObjectId}, Collection, Database};
use crate::models::user::User;

#[derive(Clone)]
pub struct UserRepository {
    collection: Collection<User>,
}

impl UserRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            collection: db.collection("users"),
        }
    }

    pub async fn find_by_email(&self, email: &str) -> mongodb::error::Result<Option<User>> {
        self.collection.find_one(doc! { "email": email }, None).await
    }

    pub async fn find_by_id(&self, id: &ObjectId) -> mongodb::error::Result<Option<User>> {
        self.collection.find_one(doc! { "_id": id }, None).await
    }

    pub async fn create(&self, user: User) -> mongodb::error::Result<ObjectId> {
        let result = self.collection.insert_one(user, None).await?;
        Ok(result.inserted_id.as_object_id().unwrap())
    }
}
