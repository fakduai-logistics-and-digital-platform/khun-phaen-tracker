// Every route of the removed Axum backend (backend-server/src/main.rs in git history) must be routed by the Worker, not fall through to 404/405.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
const fixture=JSON.parse(await readFile(process.env.TEST_FIXTURE_PATH,'utf8'));
const {base,admin}=fixture;
const discover=process.env.CONTRACT_DISCOVER==='1';
const dump={};
async function request(path,method='GET',body,token=admin){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
 return {status:response.status,data};
}
async function ok(path,method='GET',body){const r=await request(path,method,body);assert.ok(r.status<300,`${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`);dump[`${method} ${path}`]={status:r.status,body:r.data};return r.data;}
const ws=(await ok('/api/workspaces','POST',{name:'Contract workspace'})).workspace;
const p=`/api/workspaces/${ws.id}`;
const today=new Date().toISOString().slice(0,10);
const project=(await ok(`${p}/projects`,'POST',{name:'Contract'})).project;
const assignee=(await ok(`${p}/assignees`,'POST',{name:'Worker'})).assignee;
const group=(await ok(`${p}/assignee-groups`,'POST',{name:'G',assignee_ids:[assignee.id]})).group;
const sprint=(await ok(`${p}/sprints`,'POST',{name:'S',start_date:today,end_date:today})).sprint;
const milestone=await ok(`${p}/milestones`,'POST',{title:'M',target_date:today});
const template=(await ok(`${p}/checklist-templates`,'POST',{name:'T',items:['a']})).template;
const task=(await ok(`${p}/tasks`,'POST',{title:'Contract task',start_date:today})).task;
const suiteId=(await ok(`${p}/test-suites`,'POST',{title:'Suite'})).id;
const tcId=(await ok(`${p}/test-cases`,'POST',{name:'Case',suite_id:suiteId,classic_steps:[{action:'a',data:'',expected:'b'}]})).id;
const runId=(await ok(`${p}/test-runs`,'POST',{name:'Run',test_case_ids:[tcId]})).id;
const routes=[
 ['GET','/'],['GET','/health'],['GET','/api/auth/setup-info?token=x'],['GET','/api/auth/me'],['PUT','/api/auth/me',{}],['GET','/api/auth/users'],
 ['GET','/api/admin/storage/config'],['GET','/api/admin/ai/config'],['GET','/api/admin/storage/stats'],['GET','/api/admin/storage/objects'],
 ['POST','/api/admin/storage/objects/bulk-delete',{keys:['missing/key']}],['DELETE','/api/admin/storage/objects/missing/key'],
 ['GET','/api/workspaces'],['GET','/api/workspaces/stats'],['PUT',p,{name:'Contract workspace'}],
 ['GET',`${p}/notifications`],['GET',`/api/workspaces/access/${ws.room_code}`],['GET','/api/my/tasks'],
 ['GET','/api/notifications'],['POST','/api/notifications/read-all',{}],
 ['GET',`${p}/tasks`],['GET',`${p}/tasks/next-number`],['GET',`${p}/tasks/${task.id}`],['PUT',`${p}/tasks/${task.id}`,{notes:'x'}],
 ['GET',`${p}/tasks/${task.id}/comments`],['GET',`${p}/daily-report`],
 ['GET',`${p}/projects`],['GET',`${p}/projects/stats`],['PUT',`${p}/projects/${project.id}`,{name:'Contract'}],
 ['GET',`${p}/assignees`],['GET',`${p}/assignees/stats`],['PUT',`${p}/assignees/${assignee.id}`,{name:'Worker'}],
 ['GET',`${p}/assignee-groups`],['PUT',`${p}/assignee-groups/${group.id}`,{name:'G'}],
 ['GET',`${p}/sprints`],['PUT',`${p}/sprints/${sprint.id}`,{name:'S'}],
 ['GET',`${p}/milestones`],['GET',`${p}/milestones/${milestone.id}`],['PUT',`${p}/milestones/${milestone.id}`,{title:'M'}],
 ['GET',`${p}/checklist-templates`],['GET',`${p}/checklist-templates/${template.id}`],['PUT',`${p}/checklist-templates/${template.id}`,{name:'T'}],
 ['GET',`${p}/test-suites`],['GET',`/api/test-suites/${suiteId}`],['PATCH',`/api/test-suites/${suiteId}`,{title:'Suite'}],
 ['GET',`${p}/test-cases`],['GET',`${p}/test-cases/next-number`],['GET',`${p}/test-cases/counts`],['GET',`${p}/test-cases/all`],
 ['GET',`/api/test-cases/${tcId}`],['PATCH',`/api/test-cases/${tcId}`,{name:'Case'}],
 ['PATCH',`/api/test-cases/${tcId}/steps`,{steps:[{action:'a',expected:'b'}]}],['PATCH',`/api/test-cases/${tcId}/status`,{status:'passed'}],
 ['PATCH',`/api/test-cases/${tcId}/fixed`,{fixed:'yes'}],['PATCH',`/api/test-cases/${tcId}/assign-dev`,{assignee_ids:[]}],
 ['PATCH',`/api/test-cases/${tcId}/priority`,{priority:'high'}],['PATCH',`/api/test-cases/${tcId}/assign-tester`,{tester_ids:[]}],
 ['PATCH',`/api/test-cases/${tcId}/notes`,{notes:'n'}],
 ['GET',`${p}/test-runs`],['GET',`${p}/test-runs/${runId}`],['PATCH',`${p}/test-runs/${runId}/status`,{status:'running'}],
 ['PATCH',`${p}/test-runs/${runId}/cases/${tcId}/status`,{status:'passed'}],
 ['GET',`/api/public/workspaces/${ws.id}/test-suites`],['GET',`/api/public/workspaces/${ws.id}/summary`],
 ['GET',`/api/public/workspaces/${ws.id}/test-cases`],['GET',`/api/public/workspaces/${ws.id}/all-test-cases`],
 ['GET',`/api/public/workspaces/${ws.id}/test-runs/latest`],
 ['POST',`/api/test-cases/${tcId}/convert-to-task`,{}],
 ['DELETE',`${p}/test-runs/${runId}`],['DELETE',`/api/test-cases/${tcId}`],['DELETE',`/api/test-suites/${suiteId}`],
 ['DELETE',`${p}/checklist-templates/${template.id}`],['DELETE',`${p}/milestones/${milestone.id}`],['DELETE',`${p}/sprints/${sprint.id}`],
 ['DELETE',`${p}/assignee-groups/${group.id}`],['DELETE',`${p}/assignees/${assignee.id}`],['DELETE',`${p}/projects/${project.id}`],
 ['DELETE',`${p}/tasks/${task.id}`],
];
const gaps=[];const seen={};
const label=(method,path)=>`${method} ${path.replace(`/api/workspaces/${ws.id}`,':ws').replace(ws.id,':ws').replace(ws.room_code,':room').replace(task.id,':task').replace(project.id,':project').replace(group.id,':group').replace(sprint.id,':sprint').replace(tcId,':tc').replace(runId,':run')}`;
try {
 for (const [method,path,body] of routes) {
  const r=await request(path,method,body);
  const unrouted=(r.status===404&&r.data?.error==='Not found')||[405,415,500,501].includes(r.status);
  if (discover) console.log(String(r.status).padEnd(4),method.padEnd(7),path.replace(ws.id,':ws'),unrouted?`  <-- ${JSON.stringify(r.data).slice(0,120)}`:'');
  if (process.env.CONTRACT_DUMP) dump[`${method} ${path.replaceAll(ws.id,':ws')}`]={status:r.status,body:r.data};
  seen[label(method,path)]=r.data;
  if (unrouted) gaps.push(`${method} ${path}: ${r.status} ${JSON.stringify(r.data)}`);
 }
} finally { await request(p,'DELETE'); if (process.env.CONTRACT_DUMP) await writeFile(process.env.CONTRACT_DUMP,JSON.stringify(dump,null,1)); }
// Fields the frontend reads from each response (src/lib/db.ts, routes and components).
const reads={
 'GET /api/auth/me':['id','email','user_id','role','profile'],'GET /api/auth/users':['users'],
 'GET /api/admin/storage/stats':['bucket','endpoint','region','used_bytes','object_count'],'GET /api/admin/storage/objects':['objects','total','pages'],
 'GET /api/admin/storage/config':['config'],'GET /api/admin/ai/config':['config'],
 'GET /api/workspaces':['workspaces'],'GET /api/workspaces/stats':['task_counts'],'GET :ws/notifications':['success','config'],
 'GET /api/workspaces/access/:room':['success','has_access','workspace'],'GET /api/my/tasks':['tasks','total','page','pages','limit'],
 'GET /api/notifications':['notifications'],'GET :ws/tasks':['tasks','total','page','pages','limit'],'GET :ws/tasks/next-number':['next_task_number'],
 'GET :ws/tasks/:task':['task'],'PUT :ws/tasks/:task':['task'],'GET :ws/tasks/:task/comments':['comments','total','page','pages','limit'],
 'GET :ws/daily-report':['success','tasks'],'GET :ws/projects':['projects'],'GET :ws/projects/stats':['stats'],'PUT :ws/projects/:project':['project'],
 'GET :ws/assignees':['assignees'],'GET :ws/assignees/stats':['stats'],'GET :ws/assignee-groups':['groups'],'PUT :ws/assignee-groups/:group':['group'],
 'GET :ws/sprints':['sprints'],'PUT :ws/sprints/:sprint':['sprint'],'GET :ws/checklist-templates':['templates'],
 'GET :ws/test-cases/next-number':['next_number'],'GET /api/test-cases/:tc':['name','suite_id','priority','assign_dev','assign_tester','test_no'],
 'GET :ws/test-runs':['data','total'],'GET :ws/test-runs/:run':['_id','created_by','test_cases'],
 'GET /api/public/workspaces/:ws/summary':['sample_cases','active_tasks','test_cases','teammates'],'POST /api/test-cases/:tc/convert-to-task':['task_id'],
};
const arrays=['GET :ws/milestones','GET :ws/test-suites','GET :ws/test-cases','GET :ws/test-cases/all','GET /api/public/workspaces/:ws/test-suites','GET /api/public/workspaces/:ws/test-cases','GET /api/public/workspaces/:ws/all-test-cases'];
for (const [key,fields] of Object.entries(reads)) { const body=seen[key]; assert.ok(body,`contract probe did not call ${key}`); for (const f of fields) assert.ok(f in body,`${key} is missing ${f}`); }
for (const key of arrays) assert.ok(Array.isArray(seen[key]),`${key} must return an array`);
assert.deepEqual(gaps,[],'legacy routes not handled by the Worker');
console.log(`PASS: ${routes.length} legacy route contracts are routed`);
