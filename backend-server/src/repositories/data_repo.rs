use mongodb::{bson::{doc, oid::ObjectId, Document, Bson}, Collection, Database};
use crate::models::data::{TaskDocument, ProjectDocument, AssigneeDocument, SprintDocument, TaskFilterQuery};
use futures::stream::StreamExt;

#[derive(Clone)]
pub struct DataRepository {
    tasks: Collection<TaskDocument>,
    projects: Collection<ProjectDocument>,
    assignees: Collection<AssigneeDocument>,
    sprints: Collection<SprintDocument>,
}

impl DataRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            tasks: db.collection("tasks"),
            projects: db.collection("projects"),
            assignees: db.collection("assignees"),
            sprints: db.collection("sprints"),
        }
    }

    // ===== TASKS =====

    pub async fn find_tasks(&self, workspace_id: &ObjectId, filter: &TaskFilterQuery) -> mongodb::error::Result<Vec<TaskDocument>> {
        let mut query = doc! { "workspace_id": workspace_id };

        // Status filter
        if let Some(status) = &filter.status {
            match status.as_str() {
                "all" => {},
                "active" => { query.insert("is_archived", false); },
                "archived" => { query.insert("is_archived", true); },
                s => { query.insert("status", s); },
            }
        }

        // By default exclude archived unless explicitly requested
        if filter.status.is_none() && !filter.include_archived.unwrap_or(false) {
            query.insert("is_archived", false);
        }

        if let Some(category) = &filter.category {
            if category != "all" { query.insert("category", category.as_str()); }
        }
        if let Some(project) = &filter.project {
            if project != "all" { query.insert("project", project.as_str()); }
        }
        if let Some(assignee_id) = &filter.assignee_id {
            if assignee_id != "all" { query.insert("assignee_ids", doc! { "$in": [assignee_id.as_str()] }); }
        }
        if let Some(sprint_id) = &filter.sprint_id {
            if sprint_id != "all" { query.insert("sprint_id", sprint_id.as_str()); }
        }
        if let Some(search) = &filter.search {
            if !search.is_empty() {
                query.insert("title", doc! { "$regex": search.as_str(), "$options": "i" });
            }
        }

        // Date range
        if filter.start_date.is_some() || filter.end_date.is_some() {
            let mut date_query = Document::new();
            if let Some(sd) = &filter.start_date {
                date_query.insert("$gte", sd.as_str());
            }
            if let Some(ed) = &filter.end_date {
                date_query.insert("$lte", ed.as_str());
            }
            query.insert("date", date_query);
        }

        let mut cursor = self.tasks.find(query, None).await?;
        let mut tasks = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => tasks.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(tasks)
    }

    pub async fn find_task_by_id(&self, id: &ObjectId) -> mongodb::error::Result<Option<TaskDocument>> {
        self.tasks.find_one(doc! { "_id": id }, None).await
    }

    pub async fn create_task(&self, mut task: TaskDocument) -> mongodb::error::Result<TaskDocument> {
        let now = chrono::Utc::now().to_rfc3339();
        task.created_at = Some(now.clone());
        task.updated_at = Some(now);
        let res = self.tasks.insert_one(task.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            task.id = Some(id);
        }
        Ok(task)
    }

    pub async fn update_task(&self, id: &ObjectId, workspace_id: &ObjectId, updates: Document) -> mongodb::error::Result<bool> {
        let mut set_doc = updates;
        set_doc.insert("updated_at", chrono::Utc::now().to_rfc3339());
        let res = self.tasks.update_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            doc! { "$set": set_doc },
            None,
        ).await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_task(&self, id: &ObjectId, workspace_id: &ObjectId) -> mongodb::error::Result<bool> {
        let res = self.tasks.delete_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            None,
        ).await?;
        Ok(res.deleted_count > 0)
    }

    pub async fn delete_all_tasks(&self, workspace_id: &ObjectId) -> mongodb::error::Result<u64> {
        let res = self.tasks.delete_many(doc! { "workspace_id": workspace_id }, None).await?;
        Ok(res.deleted_count)
    }

    // ===== PROJECTS =====

    pub async fn find_projects(&self, workspace_id: &ObjectId) -> mongodb::error::Result<Vec<ProjectDocument>> {
        let mut cursor = self.projects.find(doc! { "workspace_id": workspace_id }, None).await?;
        let mut projects = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => projects.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(projects)
    }

    pub async fn create_project(&self, mut project: ProjectDocument) -> mongodb::error::Result<ProjectDocument> {
        project.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.projects.insert_one(project.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            project.id = Some(id);
        }
        Ok(project)
    }

    pub async fn update_project(&self, id: &ObjectId, workspace_id: &ObjectId, updates: Document) -> mongodb::error::Result<bool> {
        let res = self.projects.update_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            doc! { "$set": updates },
            None,
        ).await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_project(&self, id: &ObjectId, workspace_id: &ObjectId) -> mongodb::error::Result<bool> {
        let res = self.projects.delete_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            None,
        ).await?;
        Ok(res.deleted_count > 0)
    }

    // ===== ASSIGNEES =====

    pub async fn find_assignees(&self, workspace_id: &ObjectId) -> mongodb::error::Result<Vec<AssigneeDocument>> {
        let mut cursor = self.assignees.find(doc! { "workspace_id": workspace_id }, None).await?;
        let mut assignees = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => assignees.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(assignees)
    }

    pub async fn find_assigned_workspaces(&self, user_id_hex: &str) -> mongodb::error::Result<Vec<ObjectId>> {
        let mut cursor = self.assignees.find(doc! { "user_id": user_id_hex }, None).await?;
        let mut w_ids = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => w_ids.push(doc.workspace_id),
                Err(e) => return Err(e),
            }
        }
        Ok(w_ids)
    }

    pub async fn create_assignee(&self, mut assignee: AssigneeDocument) -> mongodb::error::Result<AssigneeDocument> {
        assignee.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.assignees.insert_one(assignee.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            assignee.id = Some(id);
        }
        Ok(assignee)
    }

    pub async fn update_assignee(&self, id: &ObjectId, workspace_id: &ObjectId, updates: Document) -> mongodb::error::Result<bool> {
        let res = self.assignees.update_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            doc! { "$set": updates },
            None,
        ).await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_assignee(&self, id: &ObjectId, workspace_id: &ObjectId) -> mongodb::error::Result<bool> {
        let res = self.assignees.delete_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            None,
        ).await?;
        Ok(res.deleted_count > 0)
    }

    // ===== SPRINTS =====

    pub async fn find_sprints(&self, workspace_id: &ObjectId) -> mongodb::error::Result<Vec<SprintDocument>> {
        let mut cursor = self.sprints.find(doc! { "workspace_id": workspace_id }, None).await?;
        let mut sprints = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => sprints.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(sprints)
    }

    pub async fn create_sprint(&self, mut sprint: SprintDocument) -> mongodb::error::Result<SprintDocument> {
        sprint.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.sprints.insert_one(sprint.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            sprint.id = Some(id);
        }
        Ok(sprint)
    }

    pub async fn update_sprint(&self, id: &ObjectId, workspace_id: &ObjectId, updates: Document) -> mongodb::error::Result<bool> {
        let res = self.sprints.update_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            doc! { "$set": updates },
            None,
        ).await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_sprint(&self, id: &ObjectId, workspace_id: &ObjectId) -> mongodb::error::Result<bool> {
        let res = self.sprints.delete_one(
            doc! { "_id": id, "workspace_id": workspace_id },
            None,
        ).await?;
        Ok(res.deleted_count > 0)
    }

    // ===== CLEANUP (when workspace is deleted) =====

    pub async fn delete_all_workspace_data(&self, workspace_id: &ObjectId) -> mongodb::error::Result<()> {
        self.tasks.delete_many(doc! { "workspace_id": workspace_id }, None).await?;
        self.projects.delete_many(doc! { "workspace_id": workspace_id }, None).await?;
        self.assignees.delete_many(doc! { "workspace_id": workspace_id }, None).await?;
        self.sprints.delete_many(doc! { "workspace_id": workspace_id }, None).await?;
        Ok(())
    }
}
