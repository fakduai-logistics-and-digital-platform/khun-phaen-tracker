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

    pub async fn find_by_setup_token(&self, token: &str) -> mongodb::error::Result<Option<User>> {
        self.collection.find_one(doc! { "setup_token": token }, None).await
    }

    pub async fn update(&self, user: &User) -> mongodb::error::Result<()> {
        let id = user.id.unwrap();
        self.collection.replace_one(doc! { "_id": id }, user, None).await?;
        Ok(())
    }

    pub async fn find_all(&self) -> mongodb::error::Result<Vec<User>> {
        use futures::TryStreamExt;
        let mut cursor = self.collection.find(None, None).await?;
        let mut users = Vec::new();
        while let Some(user) = cursor.try_next().await? {
            users.push(user);
        }
        Ok(users)
    }

    pub async fn count(&self) -> mongodb::error::Result<u64> {
        self.collection.estimated_document_count(None).await
    }

    pub async fn delete_by_id(&self, id: &ObjectId) -> mongodb::error::Result<()> {
        self.collection.delete_one(doc! { "_id": id }, None).await?;
        Ok(())
    }
}
