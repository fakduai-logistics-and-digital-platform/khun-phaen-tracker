use crate::models::data::{
    AssigneeDocument, AssigneeGroupDocument, ChecklistTemplateDocument, CommentDocument,
    CommentImage, CommentReaction, ProjectDocument, SprintDocument, TaskDocument, TaskFilterQuery,
};
use futures::stream::StreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId, Bson, Document},
    options::{FindOneOptions, IndexOptions},
    Collection, Database, IndexModel,
};
use std::collections::HashMap;

#[derive(Clone)]
pub struct DataRepository {
    tasks: Collection<TaskDocument>,
    projects: Collection<ProjectDocument>,
    assignees: Collection<AssigneeDocument>,
    assignee_groups: Collection<AssigneeGroupDocument>,
    sprints: Collection<SprintDocument>,
    task_comments: Collection<CommentDocument>,
    checklist_templates: Collection<ChecklistTemplateDocument>,
}

impl DataRepository {
    pub fn new(db: &Database) -> Self {
        Self {
            tasks: db.collection("tasks"),
            projects: db.collection("projects"),
            assignees: db.collection("assignees"),
            assignee_groups: db.collection("assignee_groups"),
            sprints: db.collection("sprints"),
            task_comments: db.collection("task_comments"),
            checklist_templates: db.collection("checklist_templates"),
        }
    }

    pub async fn ensure_comment_indexes(&self) -> mongodb::error::Result<()> {
        let by_workspace_task_created = IndexModel::builder()
            .keys(doc! { "workspace_id": 1, "task_id": 1, "created_at": -1 })
            .options(
                IndexOptions::builder()
                    .name(Some("idx_comments_ws_task_created".to_string()))
                    .build(),
            )
            .build();
        let by_task_id = IndexModel::builder()
            .keys(doc! { "task_id": 1, "_id": -1 })
            .options(
                IndexOptions::builder()
                    .name(Some("idx_comments_task_id".to_string()))
                    .build(),
            )
            .build();
        self.task_comments
            .create_indexes(vec![by_workspace_task_created, by_task_id], None)
            .await?;
        Ok(())
    }

    // ===== TASKS =====

    pub async fn find_tasks(
        &self,
        workspace_id: &ObjectId,
        filter: &TaskFilterQuery,
    ) -> mongodb::error::Result<(Vec<TaskDocument>, u64)> {
        let mut query = doc! { "workspace_id": workspace_id };

        // Status filter
        if let Some(status) = &filter.status {
            match status.as_str() {
                "all" => {}
                "active" => {
                    query.insert("is_archived", false);
                }
                "today" => {
                    let today_start = chrono::Utc::now()
                        .date_naive()
                        .and_hms_opt(0, 0, 0)
                        .unwrap()
                        .and_utc()
                        .to_rfc3339();
                    query.insert("is_archived", false);
                    query.insert(
                        "$or",
                        Bson::Array(vec![
                            Bson::Document(doc! { "status": { "$ne": "done" } }),
                            Bson::Document(
                                doc! { "status": "done", "updated_at": { "$gte": today_start } }
                            ),
                        ]),
                    );
                }
                "archived" => {
                    query.insert("is_archived", true);
                }
                s => {
                    query.insert("status", s);
                }
            }
        }

        // By default exclude archived unless explicitly requested
        if filter.status.is_none() && !filter.include_archived.unwrap_or(false) {
            query.insert("is_archived", false);
        }

        if let Some(category) = &filter.category {
            if category != "all" {
                query.insert("category", category.as_str());
            }
        }
        if let Some(project) = &filter.project {
            if project != "all" {
                query.insert("project", project.as_str());
            }
        }
        if let Some(assignee_id) = &filter.assignee_id {
            if assignee_id == "none" || assignee_id == "unassigned" {
                query.insert(
                    "$or",
                    Bson::Array(vec![
                        Bson::Document(doc! { "assignee_ids": { "$exists": false } }),
                        Bson::Document(doc! { "assignee_ids": Bson::Null }),
                        Bson::Document(doc! { "assignee_ids": { "$size": 0 } }),
                    ]),
                );
            } else if assignee_id != "all" {
                query.insert("assignee_ids", doc! { "$in": [assignee_id.as_str()] });
            }
        }
        if let Some(sprint_id) = &filter.sprint_id {
            if sprint_id != "all" {
                query.insert("sprint_id", sprint_id.as_str());
            }
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

        // Due date range
        if filter.due_start_date.is_some() || filter.due_end_date.is_some() {
            let mut due_query = Document::new();
            if let Some(sd) = &filter.due_start_date {
                due_query.insert("$gte", sd.as_str());
            }
            if let Some(ed) = &filter.due_end_date {
                due_query.insert("$lte", ed.as_str());
            }
            query.insert("due_date", due_query);
        }

        // Due date preset filter (server-side)
        if let Some(preset) = &filter.due_preset {
            let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
            match preset.as_str() {
                "no_dates" => {
                    query.insert(
                        "$or",
                        Bson::Array(vec![
                            Bson::Document(doc! { "due_date": { "$exists": false } }),
                            Bson::Document(doc! { "due_date": Bson::Null }),
                            Bson::Document(doc! { "due_date": "" }),
                        ]),
                    );
                }
                "overdue" => {
                    query.insert("due_date", doc! { "$lt": today });
                    query.insert("status", doc! { "$ne": "done" });
                    query.insert("is_archived", false);
                }
                "next_day" | "next_week" | "next_month" => {
                    let days = match preset.as_str() {
                        "next_day" => 1,
                        "next_week" => 7,
                        _ => 30,
                    };
                    let end = (chrono::Utc::now() + chrono::Duration::days(days))
                        .format("%Y-%m-%d")
                        .to_string();
                    query.insert("due_date", doc! { "$gte": today, "$lte": end });
                }
                _ => {}
            }
        }

        // Count total matching documents before pagination
        let total = self.tasks.count_documents(query.clone(), None).await?;

        // Setup pagination and sorting
        let limit = filter.limit.unwrap_or(20);
        let page = filter.page.unwrap_or(1).max(1);
        let skip = (page - 1) * limit;

        let sort_field = match filter.sort_by.as_deref() {
            Some("date")
            | Some("created_at")
            | Some("updated_at")
            | Some("task_number")
            | Some("title")
            | Some("status")
            | Some("due_date")
            | Some("start_date") => filter.sort_by.as_deref().unwrap_or("updated_at"),
            _ => "updated_at",
        };

        let sort_direction = match filter.sort_order.as_deref() {
            Some("asc") | Some("1") => 1,
            _ => -1,
        };

        let find_options = mongodb::options::FindOptions::builder()
            .sort(doc! { sort_field: sort_direction, "_id": -1 })
            .limit(limit as i64)
            .skip(skip)
            .build();

        let mut cursor = self.tasks.find(query, find_options).await?;
        let mut tasks = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => tasks.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok((tasks, total))
    }

    pub async fn find_daily_report_tasks(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<TaskDocument>> {
        let now = chrono::Utc::now();
        let twenty_four_hours_ago = now - chrono::Duration::hours(24);
        let iso_cutoff = twenty_four_hours_ago.to_rfc3339();

        // Logic:
        // 1. status != "done" (Pending)
        // 2. status == "done" AND updated_at >= 24 hours ago (Completed recently)
        let query = doc! {
            "workspace_id": workspace_id,
            "is_archived": false,
            "$or": [
                { "status": { "$ne": "done" } },
                {
                    "status": "done",
                    "updated_at": { "$gte": iso_cutoff }
                }
            ]
        };

        let find_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "status": 1, "updated_at": -1 })
            .build();

        let mut cursor = self.tasks.find(query, find_options).await?;
        let mut tasks = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => tasks.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(tasks)
    }

    pub async fn find_task_by_id(
        &self,
        id: &ObjectId,
    ) -> mongodb::error::Result<Option<TaskDocument>> {
        self.tasks.find_one(doc! { "_id": id }, None).await
    }

    pub async fn create_task(
        &self,
        mut task: TaskDocument,
    ) -> mongodb::error::Result<TaskDocument> {
        let now = chrono::Utc::now().to_rfc3339();
        task.created_at = Some(now.clone());
        task.updated_at = Some(now);
        let res = self.tasks.insert_one(task.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            task.id = Some(id);
        }
        Ok(task)
    }

    pub async fn get_next_task_number(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<i64> {
        let opts = FindOneOptions::builder()
            .sort(doc! { "task_number": -1 })
            .build();
        let highest = self
            .tasks
            .find_one(
                doc! { "workspace_id": workspace_id, "task_number": { "$exists": true, "$ne": Bson::Null } },
                opts,
            )
            .await?;
        Ok(highest.and_then(|t| t.task_number).unwrap_or(0) + 1)
    }

    pub async fn update_task(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
        updates: Document,
    ) -> mongodb::error::Result<bool> {
        let mut set_doc = updates;
        set_doc.insert("updated_at", chrono::Utc::now().to_rfc3339());
        let res = self
            .tasks
            .update_one(
                doc! { "_id": id, "workspace_id": workspace_id },
                doc! { "$set": set_doc },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_task(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .tasks
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }

    #[allow(dead_code)]
    pub async fn delete_all_tasks(&self, workspace_id: &ObjectId) -> mongodb::error::Result<u64> {
        let res = self
            .tasks
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count)
    }

    pub async fn create_comment(
        &self,
        mut comment: CommentDocument,
    ) -> mongodb::error::Result<CommentDocument> {
        let now = chrono::Utc::now().to_rfc3339();
        comment.created_at = Some(now.clone());
        comment.updated_at = Some(now);
        let res = self.task_comments.insert_one(comment.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            comment.id = Some(id);
        }
        Ok(comment)
    }

    pub async fn find_comments_by_task_paginated(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
        page: u64,
        limit: u64,
    ) -> mongodb::error::Result<(Vec<CommentDocument>, u64)> {
        let query = doc! {
            "workspace_id": workspace_id,
            "task_id": task_id,
        };
        let total = self
            .task_comments
            .count_documents(query.clone(), None)
            .await?;
        let skip = (page - 1) * limit;
        let find_options = mongodb::options::FindOptions::builder()
            .sort(doc! { "created_at": -1, "_id": -1 })
            .limit(limit as i64)
            .skip(skip)
            .build();
        let mut cursor = self.task_comments.find(query, find_options).await?;
        let mut comments = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => comments.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok((comments, total))
    }

    pub async fn find_comment_by_id(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
        comment_id: &ObjectId,
    ) -> mongodb::error::Result<Option<CommentDocument>> {
        self.task_comments
            .find_one(
                doc! { "_id": comment_id, "workspace_id": workspace_id, "task_id": task_id },
                None,
            )
            .await
    }

    pub async fn find_comments_by_task(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<CommentDocument>> {
        let query = doc! {
            "workspace_id": workspace_id,
            "task_id": task_id,
        };
        let mut cursor = self.task_comments.find(query, None).await?;
        let mut comments = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => comments.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(comments)
    }

    pub async fn find_comment_images_paginated(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
        comment_id: &ObjectId,
        page: u64,
        limit: u64,
    ) -> mongodb::error::Result<Option<(Vec<CommentImage>, u64)>> {
        let comment = match self
            .find_comment_by_id(workspace_id, task_id, comment_id)
            .await?
        {
            Some(c) => c,
            None => return Ok(None),
        };
        let total = comment.images.len() as u64;
        let skip = ((page - 1) * limit) as usize;
        let end = (skip + limit as usize).min(comment.images.len());
        let items = if skip >= comment.images.len() {
            Vec::new()
        } else {
            comment.images[skip..end].to_vec()
        };
        Ok(Some((items, total)))
    }

    pub async fn delete_comment(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
        comment_id: &ObjectId,
    ) -> mongodb::error::Result<Option<CommentDocument>> {
        self.task_comments
            .find_one_and_delete(
                doc! { "_id": comment_id, "workspace_id": workspace_id, "task_id": task_id },
                None,
            )
            .await
    }

    pub async fn delete_comments_by_task(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
    ) -> mongodb::error::Result<u64> {
        let res = self
            .task_comments
            .delete_many(
                doc! { "workspace_id": workspace_id, "task_id": task_id },
                None,
            )
            .await?;
        Ok(res.deleted_count)
    }

    pub async fn update_comment_content(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
        comment_id: &ObjectId,
        content: String,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .task_comments
            .update_one(
                doc! { "_id": comment_id, "workspace_id": workspace_id, "task_id": task_id },
                doc! { "$set": { "content": content, "updated_at": chrono::Utc::now().to_rfc3339() } },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    // ===== PROJECTS =====

    pub async fn find_projects(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<ProjectDocument>> {
        let mut cursor = self
            .projects
            .find(doc! { "workspace_id": workspace_id }, None)
            .await?;
        let mut projects = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => projects.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(projects)
    }

    pub async fn create_project(
        &self,
        mut project: ProjectDocument,
    ) -> mongodb::error::Result<ProjectDocument> {
        project.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.projects.insert_one(project.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            project.id = Some(id);
        }
        Ok(project)
    }

    pub async fn update_project(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
        updates: Document,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .projects
            .update_one(
                doc! { "_id": id, "workspace_id": workspace_id },
                doc! { "$set": updates },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    pub async fn toggle_comment_reaction(
        &self,
        workspace_id: &ObjectId,
        task_id: &ObjectId,
        comment_id: &ObjectId,
        user_id: &str,
        emoji: &str,
    ) -> mongodb::error::Result<Option<CommentDocument>> {
        let mut comment = match self
            .find_comment_by_id(workspace_id, task_id, comment_id)
            .await?
        {
            Some(c) => c,
            None => return Ok(None),
        };

        if let Some(existing) = comment.reactions.iter().position(|r| r.user_id == user_id) {
            if comment.reactions[existing].emoji == emoji {
                comment.reactions.remove(existing);
            } else {
                comment.reactions[existing].emoji = emoji.to_string();
                comment.reactions[existing].reacted_at = chrono::Utc::now().to_rfc3339();
            }
        } else {
            comment.reactions.push(CommentReaction {
                emoji: emoji.to_string(),
                user_id: user_id.to_string(),
                reacted_at: chrono::Utc::now().to_rfc3339(),
            });
        }

        comment.updated_at = Some(chrono::Utc::now().to_rfc3339());
        self.task_comments
            .update_one(
                doc! { "_id": comment_id, "workspace_id": workspace_id, "task_id": task_id },
                doc! {
                    "$set": {
                        "reactions": mongodb::bson::to_bson(&comment.reactions).unwrap_or(mongodb::bson::Bson::Array(vec![])),
                        "updated_at": comment.updated_at.clone().unwrap_or_default(),
                    }
                },
                None,
            )
            .await?;

        Ok(Some(comment))
    }

    pub async fn delete_project(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .projects
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }

    // ===== ASSIGNEES =====

    pub async fn find_assignees(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<AssigneeDocument>> {
        let mut cursor = self
            .assignees
            .find(doc! { "workspace_id": workspace_id }, None)
            .await?;
        let mut assignees = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => assignees.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(assignees)
    }

    pub async fn count_tasks_by_project_names(
        &self,
        workspace_id: &ObjectId,
        project_names: &[String],
    ) -> mongodb::error::Result<HashMap<String, u64>> {
        let mut result = HashMap::new();
        for name in project_names {
            let count = self
                .tasks
                .count_documents(
                    doc! {
                        "workspace_id": workspace_id,
                        "project": name
                    },
                    None,
                )
                .await?;
            result.insert(name.clone(), count);
        }
        Ok(result)
    }

    pub async fn count_tasks_by_assignee_ids(
        &self,
        workspace_id: &ObjectId,
        assignee_ids: &[String],
    ) -> mongodb::error::Result<HashMap<String, u64>> {
        let mut result = HashMap::new();
        for assignee_id in assignee_ids {
            let count = self
                .tasks
                .count_documents(
                    doc! {
                        "workspace_id": workspace_id,
                        "$or": [
                            { "assignee_ids": { "$in": [assignee_id] } },
                            { "assignee_id": assignee_id }
                        ]
                    },
                    None,
                )
                .await?;
            result.insert(assignee_id.clone(), count);
        }
        Ok(result)
    }

    pub async fn count_tasks_by_workspaces(
        &self,
        workspace_ids: &[ObjectId],
    ) -> mongodb::error::Result<Vec<(ObjectId, u64)>> {
        let mut results = Vec::new();
        for ws_id in workspace_ids {
            let count = self
                .tasks
                .count_documents(doc! { "workspace_id": ws_id }, None)
                .await?;
            results.push((*ws_id, count));
        }
        Ok(results)
    }

    pub async fn find_assigned_workspaces(
        &self,
        user_id_hex: &str,
    ) -> mongodb::error::Result<Vec<ObjectId>> {
        let mut cursor = self
            .assignees
            .find(doc! { "user_id": user_id_hex }, None)
            .await?;
        let mut w_ids = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => w_ids.push(doc.workspace_id),
                Err(e) => return Err(e),
            }
        }
        Ok(w_ids)
    }

    pub async fn create_assignee(
        &self,
        mut assignee: AssigneeDocument,
    ) -> mongodb::error::Result<AssigneeDocument> {
        assignee.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.assignees.insert_one(assignee.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            assignee.id = Some(id);
        }
        Ok(assignee)
    }

    pub async fn update_assignee(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
        updates: Document,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .assignees
            .update_one(
                doc! { "_id": id, "workspace_id": workspace_id },
                doc! { "$set": updates },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_assignee(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .assignees
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }

    // ===== ASSIGNEE GROUPS =====

    pub async fn find_assignee_groups(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<AssigneeGroupDocument>> {
        let mut cursor = self
            .assignee_groups
            .find(doc! { "workspace_id": workspace_id }, None)
            .await?;
        let mut groups = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => groups.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(groups)
    }

    pub async fn create_assignee_group(
        &self,
        mut group: AssigneeGroupDocument,
    ) -> mongodb::error::Result<AssigneeGroupDocument> {
        group.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.assignee_groups.insert_one(group.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            group.id = Some(id);
        }
        Ok(group)
    }

    pub async fn update_assignee_group(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
        name: Option<&str>,
        assignee_ids: Option<Vec<String>>,
    ) -> mongodb::error::Result<Option<AssigneeGroupDocument>> {
        let filter = doc! { "_id": id, "workspace_id": workspace_id };
        let mut set_doc = mongodb::bson::Document::new();
        if let Some(n) = name {
            set_doc.insert("name", n);
        }
        if let Some(ids) = assignee_ids {
            set_doc.insert(
                "assignee_ids",
                ids.into_iter()
                    .map(mongodb::bson::Bson::String)
                    .collect::<Vec<_>>(),
            );
        }
        if set_doc.is_empty() {
            return Ok(self.assignee_groups.find_one(filter, None).await?);
        }
        let opts = mongodb::options::FindOneAndUpdateOptions::builder()
            .return_document(mongodb::options::ReturnDocument::After)
            .build();
        self.assignee_groups
            .find_one_and_update(filter, doc! { "$set": set_doc }, Some(opts))
            .await
    }

    pub async fn delete_assignee_group(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .assignee_groups
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }

    // ===== SPRINTS =====

    pub async fn find_sprints(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<SprintDocument>> {
        let mut cursor = self
            .sprints
            .find(doc! { "workspace_id": workspace_id }, None)
            .await?;
        let mut sprints = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => sprints.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(sprints)
    }

    pub async fn create_sprint(
        &self,
        mut sprint: SprintDocument,
    ) -> mongodb::error::Result<SprintDocument> {
        sprint.created_at = Some(chrono::Utc::now().to_rfc3339());
        let res = self.sprints.insert_one(sprint.clone(), None).await?;
        if let Some(id) = res.inserted_id.as_object_id() {
            sprint.id = Some(id);
        }
        Ok(sprint)
    }

    pub async fn update_sprint(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
        updates: Document,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .sprints
            .update_one(
                doc! { "_id": id, "workspace_id": workspace_id },
                doc! { "$set": updates },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_sprint(
        &self,
        id: &ObjectId,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .sprints
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }

    // ===== CLEANUP (when workspace is deleted) =====

    #[allow(dead_code)]
    pub async fn delete_all_workspace_data(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<()> {
        self.tasks
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        self.projects
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        self.assignees
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        self.assignee_groups
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        self.sprints
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        self.task_comments
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        self.checklist_templates
            .delete_many(doc! { "workspace_id": workspace_id }, None)
            .await?;
        Ok(())
    }
    // ===== CHECKLIST TEMPLATES =====

    pub async fn find_checklist_templates(
        &self,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Vec<ChecklistTemplateDocument>> {
        let mut cursor = self
            .checklist_templates
            .find(doc! { "workspace_id": workspace_id }, None)
            .await?;
        let mut templates = Vec::new();
        while let Some(result) = cursor.next().await {
            match result {
                Ok(doc) => templates.push(doc),
                Err(e) => return Err(e),
            }
        }
        Ok(templates)
    }

    pub async fn create_checklist_template(
        &self,
        mut template: ChecklistTemplateDocument,
    ) -> mongodb::error::Result<ChecklistTemplateDocument> {
        let now = chrono::Utc::now().to_rfc3339();
        template.created_at = Some(now.clone());
        template.updated_at = Some(now);
        self.checklist_templates
            .insert_one(template.clone(), None)
            .await?;
        Ok(template)
    }

    pub async fn update_checklist_template(
        &self,
        id: &str,
        workspace_id: &ObjectId,
        updates: Document,
    ) -> mongodb::error::Result<bool> {
        let mut set_doc = updates;
        set_doc.insert("updated_at", chrono::Utc::now().to_rfc3339());
        let res = self
            .checklist_templates
            .update_one(
                doc! { "_id": id, "workspace_id": workspace_id },
                doc! { "$set": set_doc },
                None,
            )
            .await?;
        Ok(res.matched_count > 0)
    }

    pub async fn delete_checklist_template(
        &self,
        id: &str,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<bool> {
        let res = self
            .checklist_templates
            .delete_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await?;
        Ok(res.deleted_count > 0)
    }

    #[allow(dead_code)]
    pub async fn find_checklist_template_by_id(
        &self,
        id: &str,
        workspace_id: &ObjectId,
    ) -> mongodb::error::Result<Option<ChecklistTemplateDocument>> {
        self.checklist_templates
            .find_one(doc! { "_id": id, "workspace_id": workspace_id }, None)
            .await
    }
}
