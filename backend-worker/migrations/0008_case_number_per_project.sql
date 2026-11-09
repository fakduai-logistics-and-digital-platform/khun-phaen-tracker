DROP INDEX documents_case_number;
CREATE UNIQUE INDEX documents_case_number ON documents(workspace_id,kind,COALESCE(json_extract(payload,'$.project_id'),''),json_extract(payload,'$.test_no')) WHERE kind='test-cases';
