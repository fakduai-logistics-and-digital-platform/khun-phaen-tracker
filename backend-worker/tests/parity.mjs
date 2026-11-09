import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const fixture=JSON.parse(await readFile(process.env.TEST_FIXTURE_PATH,'utf8'));
const {base,admin}=fixture;
const networkFetch=globalThis.fetch;globalThis.fetch=(input,init={})=>networkFetch(input,{...init,signal:init.signal||AbortSignal.timeout(15000)});const mock=process.env.MOCK_SERVICE_URL;
assert.match(base,/^http:\/\/127\.0\.0\.1:\d+$/);assert.match(mock,/^http:\/\/127\.0\.0\.1:\d+$/);
const root=fileURLToPath(new URL('../../',import.meta.url));
const headers=token=>({'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})});
async function request(path,method='GET',body,token=admin){
 const response=await fetch(base+path,{method,headers:headers(token),body:body===undefined?undefined:JSON.stringify(body)});
 const text=await response.text();let data;try{data=text?JSON.parse(text):null}catch{data=text}
 return {status:response.status,data};
}
async function ok(path,method='GET',body,token=admin,status=200){const r=await request(path,method,body,token);assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(r.data)}`);return r.data;}
async function createUser(name,position){const email=`${name}-${crypto.randomUUID()}@example.test`;await ok('/api/auth/invite','POST',{email,password:fixture.password,position});return await ok('/api/auth/login','POST',{email,password:fixture.password});}
async function socketFor(path,token){const {ticket}=await ok(path,'POST',{},token);const socket=new WebSocket(`${base.replace(/^http/,'ws')}/ws?ticket=${ticket}`);const events=[];socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.type==='data')events.push(JSON.parse(m.data))});await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true})});return {socket,events};}
async function waitFor(predicate,label){for(let i=0;i<100;i++){if(await predicate())return;await new Promise(r=>setTimeout(r,20));}assert.fail(label);}
function sql(command){execFileSync(resolve(root,'node_modules/.bin/wrangler'),['d1','execute','khun-phaen','--local','--persist-to',process.env.TEST_STATE,'--config','backend-worker/wrangler.jsonc','--command',command],{cwd:root,stdio:'pipe'});}
async function tick(){const response=await fetch(`${base}/__scheduled?cron=*+*+*+*+*`);assert.ok(response.ok,`scheduled status ${response.status}`);}
const ws1=(await ok('/api/workspaces','POST',{name:'Parity workspace',short_name:'PW'})).workspace;
const ws2=(await ok('/api/workspaces','POST',{name:'Other workspace'})).workspace;
const p=`/api/workspaces/${ws1.id}`,p2=`/api/workspaces/${ws2.id}`;
const qa=await createUser('qa','QA Tester'),dev=await createUser('dev','Developer'),outsider=await createUser('outside','Developer');
const devWorker=(await ok(`${p}/assignees`,'POST',{name:'Developer',user_id:dev.id})).assignee;
const qaWorker=(await ok(`${p}/assignees`,'POST',{name:'QA',user_id:qa.id})).assignee;
const otherWorker=(await ok(`${p2}/assignees`,'POST',{name:'Other worker'})).assignee;
const ownUser=await createUser('owner','Developer');
const owned=(await ok('/api/workspaces','POST',{name:'Owned by ordinary user'},ownUser.token)).workspace;
const sockets=[];
try {
 // Profile/admin contracts, server-controlled role grants, and revocation.
 await ok('/api/auth/me','PUT',{nickname:'Local admin'});
 assert.equal((await ok('/api/auth/me')).profile.nickname,'Local admin');
 assert.equal((await request('/api/auth/me','PUT',{position:'QA Tester'},dev.token)).status,403);
 assert.equal((await request(`/api/auth/users/${dev.id}`,'PUT',{role:'admin'},dev.token)).status,403);
 assert.equal((await request(`/api/auth/users/${fixture.adminId||'missing'}`,'DELETE',undefined,dev.token)).status,403);
 assert.ok((await ok(`/api/auth/users?workspace_id=${owned.id}`,'GET',undefined,ownUser.token)).users.length>=4);
 assert.equal((await request(`/api/auth/users?workspace_id=${ws1.id}`,'GET',undefined,dev.token)).status,403);
 await ok(`/api/auth/users/${dev.id}`,'PUT',{nickname:'Dev name',position:'Developer'});
 await ok(`/api/auth/users/${outsider.id}`,'PUT',{is_active:false});
 assert.equal((await request('/api/auth/me','GET',undefined,outsider.token)).status,401);
 await ok(`/api/auth/users/${outsider.id}`,'PUT',{is_active:true});
 console.log('PASS: profile/admin access and active-user revocation');

 // Metadata shapes, scoped references, SQL filters, counters and concurrent patches.
 const project=(await ok(`${p}/projects`,'POST',{name:'Core',short_name:'CORE'})).project;
 const sprint=(await ok(`${p}/sprints`,'POST',{name:'Sprint',start_date:'2026-11-01',end_date:'2026-11-14'})).sprint;
 const group=(await ok(`${p}/assignee-groups`,'POST',{name:'Team',assignee_ids:[devWorker.id,qaWorker.id]})).group;assert.ok(group.id);
 const template=(await ok(`${p}/checklist-templates`,'POST',{name:'Release',items:['Build','Verify']})).template;assert.ok(template.id);
 const milestone=await ok(`${p}/milestones`,'POST',{title:'Ship',target_date:'2026-11-30'},admin);assert.ok(milestone.id);
 assert.ok(Array.isArray(await ok(`${p}/milestones`)));
 assert.equal((await request(`${p}/tasks`,'POST',{title:'Cross-scope',start_date:'2026-11-06',assignee_ids:[otherWorker.id]})).status,400);
 const today=new Date().toISOString().slice(0,10);
 const task=(await ok(`${p}/tasks`,'POST',{title:'needle task',start_date:today,due_date:today,status:'todo',project:'Core',sprint_id:sprint.id,assignee_ids:[devWorker.id],priority:'high'})).task;
 const noDate=(await ok(`${p}/tasks`,'POST',{title:'No due date',start_date:today,assignee_ids:[]})).task;
 const done=(await ok(`${p}/tasks`,'POST',{title:'Done task',start_date:today,status:'done',sprint_id:sprint.id})).task;
 assert.equal((await ok(`${p}/tasks?assignee_id=none&due_preset=no_dates`)).total,2);
 assert.equal((await ok(`${p}/tasks?assignee_id=none&due_preset=no_dates&status=done`)).tasks[0].id,done.id);
 assert.equal((await ok(`${p}/tasks?due_start_date=${today}&due_end_date=${today}&priority=high`)).total,1);
 assert.equal((await ok(`${p}/tasks?search=needle`)).tasks[0].id,task.id);
 assert.equal((await ok(`${p}/tasks?search=%25`)).total,0,'search percent is a literal');
 assert.equal((await ok(`${p}/tasks?limit=1&page=2&sort_by=title&sort_order=asc`)).tasks.length,1);
 assert.equal((await ok('/api/my/tasks','GET',undefined,dev.token)).tasks[0].id,task.id);
 assert.equal((await ok('/api/my/tasks/stats','GET',undefined,dev.token)).stats.total,1);
 assert.equal((await ok(`${p}/projects/stats`)).stats.find(s=>s.id===project.id).taskCount,1);
 assert.equal((await ok(`${p}/assignees/stats`)).stats.find(s=>s.id===devWorker.id).taskCount,1);
 await ok(`${p}/tasks/${task.id}`,'PUT',{assignee_ids:[qaWorker.id]});
 assert.equal((await ok('/api/my/tasks','GET',undefined,dev.token)).total,0,'task_assignees follows reassignment');
 assert.equal((await ok(`${p}/tasks?assignee_id=${qaWorker.id}`)).tasks[0].id,task.id);
 assert.equal((await ok(`${p}/assignees/stats`)).stats.find(s=>s.id===devWorker.id).taskCount,0);
 await ok(`${p}/tasks/${task.id}`,'PUT',{assignee_ids:[devWorker.id]});
 assert.equal((await ok('/api/my/tasks','GET',undefined,dev.token)).total,1);
 await ok(`${p}/projects/${project.id}`,'PUT',{name:'Renamed'});
 assert.equal((await ok(`${p}/tasks/${task.id}`)).task.project,'Renamed');
 await Promise.all([ok(`${p}/tasks/${task.id}`,'PUT',{notes:'Concurrent notes'}),ok(`${p}/tasks/${task.id}`,'PUT',{priority:'urgent'})]);
 const changed=(await ok(`${p}/tasks/${task.id}`)).task;assert.equal(changed.notes,'Concurrent notes');assert.equal(changed.priority,'urgent');
 const numbered=await Promise.all(Array.from({length:4},(_,i)=>ok(`${p}/tasks`,'POST',{title:`Parallel ${i}`,start_date:today})));
 assert.equal(new Set(numbered.map(r=>r.task.task_number)).size,4);
 assert.equal((await ok(`${p}/sprints/${sprint.id}/archive`,'POST',{})).archived_count,1);
 assert.equal((await ok(`${p}/sprints/${sprint.id}/archive`,'POST',{})).archived_count,0);
 assert.equal((await ok(`${p}/tasks?status=archived`)).tasks[0].id,done.id);
 assert.ok((await ok(`${p}/daily-report`)).tasks.some(t=>t.id===task.id));
 // Exact payload shape built by addTask/updateTask in src/lib/db.ts, with nulls for empty fields.
 const formTask=(await ok(`${p}/tasks`,'POST',{title:'Form task',project:'',duration_minutes:0,start_date:today,date:today,due_date:null,end_date:null,status:'todo',priority:'none',task_type:null,category:'อื่นๆ',notes:'',assignee_ids:null,sprint_id:null,is_archived:false,checklist:null,links:null,testcase_id:null})).task;
 assert.ok((await ok(`${p}/tasks?assignee_id=none&search=Form%20task`)).tasks.some(t=>t.id===formTask.id),'null assignee_ids counts as unassigned');
 const formUpdated=(await ok(`${p}/tasks/${formTask.id}`,'PUT',{title:'Form task',assignee_ids:[devWorker.id],due_date:null,end_date:null,links:null,checklist:null,sprint_id:null})).task;
 assert.deepEqual(formUpdated.assignee_ids,[devWorker.id]);
 assert.equal((await ok(`${p}/tasks/${formTask.id}`,'PUT',{assignee_ids:null})).task.assignee_ids,null);
 await ok(`${p}/tasks/${formTask.id}`,'DELETE');
 // status=today: every unarchived unfinished task regardless of date, plus done tasks updated today (UTC), as in the legacy backend.
 const todayTask=title=>ok(`${p}/tasks`,'POST',{title,start_date:'2020-01-01',category:'today-check'}).then(r=>r.task);
 const oldTodo=await todayTask('Old todo'),doneToday=await todayTask('Done today'),doneOld=await todayTask('Done long ago'),archivedTodo=await todayTask('Archived todo');
 await ok(`${p}/tasks/${doneToday.id}`,'PUT',{status:'done'});await ok(`${p}/tasks/${doneOld.id}`,'PUT',{status:'done'});
 await ok(`${p}/tasks/${archivedTodo.id}`,'PUT',{is_archived:true});
 sql(`UPDATE documents SET payload=json_set(payload,'$.updated_at','2020-01-02T00:00:00.000Z') WHERE id='${doneOld.id}'`);
 const todayIds=async extra=>(await ok(`${p}/tasks?status=today&category=today-check${extra}`)).tasks.map(t=>t.id).sort();
 assert.deepEqual(await todayIds(''),[oldTodo.id,doneToday.id].sort());
 assert.deepEqual(await todayIds('&search=Old'),[oldTodo.id]);
 assert.equal((await ok(`${p}/tasks?status=today&category=today-check`)).total,2);
 assert.deepEqual((await ok(`${p}/tasks?status=done&category=today-check`)).tasks.map(t=>t.id).sort(),[doneToday.id,doneOld.id].sort());
 // The worker form resends an unchanged user_id; only a real link change needs the owner.
 await ok(`${p}/assignees/${devWorker.id}`,'PUT',{name:'Developer',color:'#123456',user_id:dev.id},dev.token);
 assert.equal((await request(`${p}/assignees/${devWorker.id}`,'PUT',{name:'Developer',user_id:outsider.id},dev.token)).status,403);
 console.log('PASS: metadata, My Tasks, combined filters, pagination, archive, numbering and concurrent patches');

 // Persistent backend-owned assignment notifications, personal DO delivery and reconnect catch-up.
 const personal=await socketFor('/api/notifications/realtime-ticket',dev.token);sockets.push(personal.socket);
 const assigned=(await ok(`${p}/tasks`,'POST',{title:'Assigned live',start_date:today,assignee_ids:[devWorker.id]})).task;
 await waitFor(()=>personal.events.some(e=>e.entity==='notification'),'personal assignment event');
 const notification=(await ok('/api/notifications','GET',undefined,dev.token)).notifications.find(n=>n.source_id===assigned.id);assert.ok(notification?.id);
 assert.equal(notification.actor_user_id,(await ok('/api/auth/me')).id);
 await ok(`${p}/tasks/${assigned.id}`,'PUT',{assignee_ids:[devWorker.id]});
 assert.equal((await ok('/api/notifications','GET',undefined,dev.token)).notifications.filter(n=>n.source_id===assigned.id).length,1);
 await ok('/api/notifications','POST',{source_type:'task',source_id:assigned.id,recipient_user_ids:[outsider.id],actor_name:'forged'},dev.token);
 assert.equal((await ok('/api/notifications','GET',undefined,outsider.token)).notifications.length,0);
 assert.equal((await request(`/api/notifications/${notification.id}/read`,'PATCH',{},qa.token)).status,404);
 await ok(`/api/notifications/${notification.id}/read`,'PATCH',{},dev.token);
 assert.ok((await ok('/api/notifications','GET',undefined,dev.token)).notifications.find(n=>n.id===notification.id).read_at);
 await ok(`/api/notifications/${notification.id}`,'DELETE',undefined,dev.token);
 assert.ok(!(await ok('/api/notifications','GET',undefined,dev.token)).notifications.some(n=>n.id===notification.id));
 personal.socket.close();
 const missed=(await ok(`${p}/tasks`,'POST',{title:'Missed while disconnected',start_date:today,assignee_ids:[devWorker.id]})).task;
 const reconnect=await socketFor('/api/notifications/realtime-ticket',dev.token);sockets.push(reconnect.socket);
 assert.ok((await ok('/api/notifications','GET',undefined,dev.token)).notifications.some(n=>n.source_id===missed.id));
 await ok('/api/notifications/read-all','POST',{},dev.token);
 assert.ok((await ok('/api/notifications','GET',undefined,dev.token)).notifications.every(n=>n.read_at));
 const self=(await ok(`${p}/tasks`,'POST',{title:'Self assignment',start_date:today,assignee_ids:[devWorker.id]},dev.token)).task;
 assert.ok(!(await ok('/api/notifications','GET',undefined,dev.token)).notifications.some(n=>n.source_id===self.id));
 console.log('PASS: personal Durable Object notifications, dedupe, server-owned recipients, read/delete and reconnect');

 // Test suite/case/run contracts, QA/developer roles, public views and workspace-safe nested references.
 const suite=await ok(`${p}/test-suites`,'POST',{title:'Suite'},qa.token,201);assert.equal(suite.id,suite._id);
 const otherSuite=await ok(`${p2}/test-suites`,'POST',{title:'Other suite'},admin,201);
 assert.equal((await request(`${p}/test-cases`,'POST',{name:'No QA permission'},dev.token)).status,403);
 assert.equal((await request(`${p}/test-cases`,'POST',{name:'Wrong suite',suite_id:otherSuite.id},qa.token)).status,400);
 const tc=await ok(`${p}/test-cases`,'POST',{name:'needle case',suite_id:suite.id,status:'actual',assign_dev:devWorker.id,classic_steps:[{action:'Open app',data:'',expected:'Dashboard'}]},qa.token,201);
 const unassigned=await ok(`${p}/test-cases`,'POST',{name:'Unassigned',status:'draft'},qa.token,201);
 const elsewhere=await ok(`${p2}/test-cases`,'POST',{name:'Other workspace case'},admin,201);
 assert.equal((await request(`/api/test-cases/${elsewhere.id}`,'GET',undefined,dev.token)).status,403);
 assert.equal((await ok(`${p}/test-cases?status=actual,draft&field=steps&q=Dashboard`, 'GET',undefined,dev.token))[0].id,tc.id);
 assert.equal((await ok(`${p}/test-cases?field=test_no&q=${tc.test_no}`))[0].id,tc.id);
 assert.ok((await ok(`${p}/test-suites`)).some(s=>s._id==='unassigned'&&s.case_count===1));
 assert.equal((await ok(`${p}/test-cases/counts`))[suite.id],1);
 // Project scoping: a case lives in its suite's project, moving a suite moves its cases, and lists filter by project.
 const projectRes=await request(`${p}/projects`,'POST',{name:'Repo A'},admin);assert.ok(projectRes.status<300);const repo=projectRes.data.project;
 assert.equal((await request(`/api/test-suites/${suite.id}`,'PATCH',{project_id:'missing'},qa.token)).status,400);
 await ok(`/api/test-suites/${suite.id}`,'PATCH',{project_id:repo.id},qa.token);
 assert.equal((await ok(`/api/test-cases/${tc.id}`)).project_id,repo.id);
 assert.deepEqual((await ok(`${p}/test-cases?project_id=${repo.id}`)).map(c=>c.id),[tc.id]);
 assert.ok((await ok(`${p}/test-cases?project_id=none`)).every(c=>c.id!==tc.id));
 assert.deepEqual((await ok(`${p}/test-suites?project_id=${repo.id}`)).map(s=>s.id),[suite.id]);
 assert.ok(!(await ok(`${p}/test-suites?project_id=none`)).some(s=>s.id===suite.id));
 assert.equal((await ok(`${p}/test-cases/counts?project_id=${repo.id}`))[suite.id],1);
 const publicProjects=await ok(`/api/public/workspaces/${ws1.id}/projects`,'GET',undefined,null);
 assert.deepEqual(Object.keys(publicProjects.find(x=>x.id===repo.id)).sort(),['id','name']);
 assert.deepEqual((await ok(`/api/public/workspaces/${ws1.id}/test-cases?project_id=${repo.id}`,'GET',undefined,null)).map(c=>c.id),[tc.id]);
 await ok(`/api/test-cases/${unassigned.id}`,'PATCH',{project_id:repo.id},qa.token);
 assert.equal((await ok(`${p}/test-cases?project_id=${repo.id}`)).length,2);
 assert.equal((await request(`/api/test-cases/${unassigned.id}`,'PATCH',{project_id:'missing'},qa.token)).status,400);
 await ok(`/api/test-cases/${unassigned.id}`,'PATCH',{project_id:''},qa.token);
 await ok(`/api/test-suites/${suite.id}`,'PATCH',{project_id:''},qa.token);
 assert.equal((await ok(`/api/test-cases/${tc.id}`)).project_id,'');
 assert.equal((await ok(`${p}/test-cases?project_id=${repo.id}`)).length,0);
 console.log('PASS: test cases and suites are scoped to projects and can be moved between them');
 // An admin who belongs to a workspace manages it like its owner, but admins do not see workspaces they are not part of.
 const coAdmin=await createUser('coadmin','Developer');
 await ok(`/api/auth/users/${coAdmin.id}`,'PUT',{role:'admin'});
 assert.equal((await request(p,'PUT',{name:'Hijack'},coAdmin.token)).status,403);
 assert.ok(!(await ok('/api/workspaces','GET',undefined,coAdmin.token)).workspaces.some(w=>w.id===ws1.id));
 await ok(`${p}/assignees`,'POST',{name:'Co admin',user_id:coAdmin.id});
 assert.equal((await request(p,'PUT',{name:ws1.name},dev.token)).status,403);
 await ok(p,'PUT',{name:ws1.name},coAdmin.token);
 console.log('PASS: admins manage workspaces they belong to like the owner');
 // Public pages are cached, but a new or removed case must show up immediately.
 const publicCases=async()=>(await ok(`/api/public/workspaces/${ws1.id}/test-cases?limit=100`,'GET',undefined,null)).length;
 const publicBefore=await publicCases();
 const fresh=await ok(`${p}/test-cases`,'POST',{name:'Fresh public case',suite_id:suite.id},qa.token,201);
 assert.equal(await publicCases(),publicBefore+1,'new case visible on the public page');
 await ok(`/api/test-cases/${fresh.id}`,'DELETE',undefined,qa.token);
 assert.equal(await publicCases(),publicBefore,'deleted case gone from the public page');
 console.log('PASS: public pages reflect new and deleted test cases without waiting for the cache');
 await ok(`/api/test-suites/${suite.id}`,'PATCH',{title:'Renamed suite'},qa.token);
 assert.equal((await request(`/api/test-cases/${tc.id}/status`,'PATCH',{status:'passed'},dev.token)).status,403);
 await ok(`/api/test-cases/${tc.id}/fixed`,'PATCH',{fixed:'yes'},dev.token);
 await ok(`/api/test-cases/${tc.id}/notes`,'PATCH',{dev_note:'Developer note'},dev.token);
 // Frontend sends both notes; a developer's dev_note saves and test_note is ignored, as in the legacy backend.
 await ok(`/api/test-cases/${tc.id}/notes`,'PATCH',{dev_note:'Dev saw it',test_note:'Not allowed'},dev.token);
 const noted=await ok(`/api/test-cases/${tc.id}`,'GET',undefined,dev.token);
 assert.equal(noted.dev_note,'Dev saw it');assert.notEqual(noted.test_note,'Not allowed');
 await ok(`/api/test-cases/${tc.id}/assign-dev`,'PATCH',{assign_dev:devWorker.id},dev.token);
 assert.equal((await request(`/api/test-cases/${tc.id}/assign-dev`,'PATCH',{assign_dev:qaWorker.id},dev.token)).status,403);
 await ok(`/api/test-cases/${tc.id}/steps`,'PATCH',{step_format:'gherkin',gherkin_steps:[{keyword:'given',text:'User logs in'}]},qa.token);
 assert.equal((await ok(`/api/test-cases/${tc.id}`)).classic_steps,null);
 await ok(`/api/test-cases/${tc.id}/priority`,'PATCH',{priority:'high'},qa.token);
 const history=await ok(`/api/test-cases/${tc.id}/history`);
 assert.ok(history.some(h=>h.action==='update'&&h.user_name&&h.changes.some(c=>c.field==='priority'&&c.to==='high')),'priority change recorded with its author');
 assert.ok(history.some(h=>h.action==='create'));
 await ok(`/api/test-cases/${tc.id}/assign-tester`,'PATCH',{assign_tester:qaWorker.id},qa.token);
 const converted=await ok(`/api/test-cases/${tc.id}/convert-to-task`,'POST',{},dev.token,201);
 assert.equal((await ok(`${p}/tasks/${converted.task_id}`)).task.testcase_id,tc.id);
 assert.equal((await request(`${p}/test-runs`,'POST',{name:'Bad run',test_case_ids:[elsewhere.id]})).status,400);
 const run=await ok(`${p}/test-runs`,'POST',{name:'Run',test_case_ids:[tc.id,unassigned.id]},qa.token,201);
 const listing=await ok(`${p}/test-runs`);assert.equal(listing.total,1);assert.ok(Array.isArray(listing.data));
 await Promise.all([ok(`${p}/test-runs/${run.id}/cases/${tc.id}/status`,'PATCH',{status:'passed'},qa.token),ok(`${p}/test-runs/${run.id}/cases/${unassigned.id}/status`,'PATCH',{status:'failed'},qa.token)]);
 const passedCase=await ok(`/api/test-cases/${tc.id}`);assert.ok(passedCase.passed_at&&passedCase.status_changed_at,'passed time recorded');
 const failedCase=await ok(`/api/test-cases/${unassigned.id}`);assert.equal(failedCase.passed_at,null);assert.ok(failedCase.status_changed_at);
 const runDetail=await ok(`${p}/test-runs/${run.id}`);assert.equal(runDetail.stats.passed,1);assert.equal(runDetail.stats.failed,1);assert.equal(runDetail.test_cases[0].test_case.id,tc.id);
 await ok(`${p}/test-runs/${run.id}/status`,'PATCH',{status:'completed'},qa.token);
 assert.equal((await ok(`/api/public/workspaces/${ws1.id}/test-runs/latest`,'GET',undefined,null)).status,'completed');
 const publicSummary=await ok(`/api/public/workspaces/${ws1.id}/summary`,'GET',undefined,null);assert.equal(publicSummary.test_cases,2);assert.equal(publicSummary.latest_run.stats.total,2);
 assert.ok(Array.isArray(await ok(`/api/public/workspaces/${ws1.id}/test-suites`,'GET',undefined,null)));
 assert.ok(Array.isArray(await ok(`/api/public/workspaces/${ws1.id}/test-cases`,'GET',undefined,null)));
 assert.equal((await ok(`/api/public/workspaces/${ws1.id}/all-test-cases`,'GET',undefined,null)).length,2);
 assert.equal((await request('/api/test-suites/unassigned?mode=delete','DELETE')).status,400);
 await ok(`/api/test-suites/unassigned?mode=delete&workspace_id=${ws1.id}`,'DELETE',undefined,qa.token);
 assert.equal((await ok(`${p2}/test-cases/all`)).length,1,'synthetic suite deletion stays in one workspace');
 await ok(`/api/test-suites/${suite.id}?mode=move`,'DELETE',undefined,qa.token);
 assert.equal((await ok(`/api/test-cases/${tc.id}`)).suite_id,'');
 console.log('PASS: QA contracts, developer permissions, steps, run concurrency and public pages');

 // Real HTTP adapters against local fake S3/AI providers; never use the live RustFS server.
 await ok('/api/admin/storage/config','PUT',{provider:'env',endpoint:mock,bucket:'bucket',region:'us-east-1',access_key:'test-access',secret_key:process.env.TEST_S3_SECRET});
 assert.equal((await request('/api/admin/storage/config','GET',undefined,dev.token)).status,403);
 async function multipart(path,form,token=admin){const response=await fetch(base+path,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;}
 const form=new FormData();form.append('file',new Blob(['attachment bytes'],{type:'text/plain'}),'ไทย file.txt');
 const attached=await multipart(`${p}/tasks/${task.id}/attachments`,form);const file=attached.attachments[0];
 const download=await fetch(`${base}/api/files/${file.file_key}`,{headers:headers(dev.token)});assert.equal(download.status,200);assert.equal(await download.text(),'attachment bytes');
 assert.equal((await request(`/api/files/${file.file_key}`,'GET',undefined,outsider.token)).status,403);
 assert.equal((await request(`/api/files/${file.file_key}`,'GET',undefined,null)).status,401);
 // Signed links let <img src> load files without a bearer token, only after the normal access check.
 const signed=(await ok('/api/files/sign','POST',{keys:[file.file_key,'missing/key']},dev.token)).urls;
 assert.deepEqual(Object.keys(signed),[file.file_key]);
 const viaLink=await fetch(base+signed[file.file_key]);assert.equal(viaLink.status,200);assert.equal(await viaLink.text(),'attachment bytes');
 assert.match(viaLink.headers.get('cache-control'),/max-age=3600/);
 assert.equal((await fetch(base+signed[file.file_key].replace(/sig=./,'sig=0'))).status,403,'tampered signature');
 assert.equal((await fetch(base+signed[file.file_key].replace(/exp=\d+/,'exp=1'))).status,403,'expired link');
 assert.deepEqual((await ok('/api/files/sign','POST',{keys:[file.file_key]},outsider.token)).urls,{},'outsiders get no link');
 const commentForm=new FormData();commentForm.append('content','A comment');commentForm.append('images',new Blob(['image'],{type:'image/png'}),'image.png');
 const comment=(await multipart(`${p}/tasks/${task.id}/comments`,commentForm,dev.token)).comment;
 const comments=await ok(`${p}/tasks/${task.id}/comments`);assert.equal(comments.total,1);assert.equal(comments.comments[0].created_by_name,'Dev name');
 assert.equal((await ok(`${p}/tasks/${task.id}/comments/${comment.id}/images`)).images.length,1);
 const imageKey=(await ok(`${p}/tasks/${task.id}/comments/${comment.id}/images`)).images[0].file_key;
 const thumb=await fetch(base+(await ok('/api/files/sign','POST',{keys:[imageKey]},dev.token)).urls[imageKey]+'&w=320');
 assert.equal(thumb.status,200);assert.equal(await thumb.text(),'image','undecodable image falls back to the original');
 assert.equal((await request(`${p}/tasks/${noDate.id}/comments/${comment.id}`,'PUT',{content:'wrong parent'})).status,404);
 await ok(`${p}/tasks/${task.id}/comments/${comment.id}`,'PUT',{content:'Edited'},dev.token);
 await Promise.all([ok(`${p}/tasks/${task.id}/comments/${comment.id}/reactions`,'POST',{emoji:'👍'},dev.token),ok(`${p}/tasks/${task.id}/comments/${comment.id}/reactions`,'POST',{emoji:'🔥'},qa.token)]);
 assert.equal((await ok(`${p}/tasks/${task.id}/comments`)).comments[0].reactions.length,2);
 await ok(`${p}/tasks/${task.id}/comments/${comment.id}/reactions`,'POST',{emoji:'👍'},dev.token);
 assert.equal((await ok(`${p}/tasks/${task.id}/comments`)).comments[0].reactions.length,1);
 const caseForm=new FormData();caseForm.append('file',new Blob(['case-file']),'case.bin');
 assert.equal((await multipart(`${p}/test-cases/${tc.id}/attachments`,caseForm,qa.token)).attachments.length,1);
 assert.equal((await ok('/api/admin/storage/stats')).object_count,3);
 assert.equal((await ok('/api/admin/storage/objects?limit=2&page=2')).objects.length,1,'S3 continuation tokens are followed');
 const before=(await (await fetch(mock+'/__test/state')).json()).files.length;
 await fetch(mock+'/__test/fail-put',{method:'POST',body:JSON.stringify({after:2})});
 const fail=new FormData();fail.append('files',new Blob(['first']),'a.txt');fail.append('files',new Blob(['second']),'b.txt');
 const failed=await fetch(base+`${p}/tasks/${task.id}/attachments`,{method:'POST',headers:{Authorization:`Bearer ${admin}`},body:fail});assert.equal(failed.status,502);
 assert.equal((await (await fetch(mock+'/__test/state')).json()).files.length,before,'failed multi-file upload compensates earlier objects');
 assert.equal((await (await fetch(mock+'/__test/state')).json()).signatureFailures,0,'complete SigV4 HTTP signatures verified independently');
 await ok(`${p}/tasks/${task.id}/attachments/${file.id}`,'DELETE');
 assert.equal((await request(`/api/files/${file.file_key}`)).status,404);
 await ok(`${p}/tasks/${task.id}/comments/${comment.id}`,'DELETE',undefined,dev.token);
 console.log('PASS: multipart streaming, SigV4, attachments, nested comment permissions, reaction concurrency and compensation');

 await ok('/api/admin/ai/config','PUT',{embeddings_url:mock+'/ai/embeddings',embeddings_api_key:'test-ai-key',embeddings_model:'test-model',llm_url:mock+'/ai',llm_api_key:'test-ai-key',llm_model:'test-model',tts_url:mock+'/ai/audio/speech',tts_api_key:'test-ai-key',tts_model:'test-model'});
 assert.equal((await ok('/api/admin/ai/models')).models[0],'test-model');assert.equal((await ok('/api/admin/ai/embeddings-models')).models[0],'test-model');
 const answer=await ok(`${p}/ai/tasks/chat`,'POST',{message:'needle',limit:1,task_limit:100});assert.equal(answer.results[0].task.id,task.id);
 assert.equal((await ok(`${p}/ai/tasks/generate`,'POST',{prompt:'Create a feature'})).task.title,'Feature: generated task');
 assert.ok((await ok(`${p}/ai/generate-speech`,'POST',{report_content:'Report'})).script);
 const tts=await fetch(base+`${p}/ai/text-to-speech`,{method:'POST',headers:headers(admin),body:JSON.stringify({text:'สวัสดี'})});assert.equal(tts.headers.get('content-type'),'audio/mpeg');assert.ok((await tts.text()).startsWith('ID3'));
 await ok('/api/admin/ai/config/reset','POST',{});
 assert.equal((await request(`${p}/ai/tasks/generate`,'POST',{prompt:'No provider'})).status,503);
 console.log('PASS: AI settings, model lists, batched embeddings, generation, speech and disabled-provider behavior');

 // Persisted event jobs, Thailand-time schedules, retries and cleanup under the local scheduled event.
 const schedule={enabled:true,days:[0,1,2,3,4,5,6],time:'09:00',notify_on_create:true,notify_on_status_change:['done'],discord_webhook_url:mock+'/hook',line_notify_token:''};
 assert.equal((await request(`${p}/notifications`,'PUT',schedule,dev.token)).status,403);
 await ok(`${p}/notifications`,'PUT',schedule);assert.equal((await ok(`${p}/notifications`)).config.enabled,true);
 assert.equal((await request(`${p}/notifications`,'PUT',{...schedule,line_notify_token:'legacy'})).status,400);
 await ok(`${p}/tasks`,'POST',{title:'Webhook event',start_date:today});
 await fetch(mock+'/__test/fail-webhook',{method:'POST'});await tick();
 await new Promise(r=>setTimeout(r,200));
 sql('UPDATE webhook_jobs SET next_attempt=0,claimed_until=0; UPDATE notification_schedules SET next_run_at=0,claimed_until=0;');
 await tick();
 await waitFor(async()=>((await (await fetch(mock+'/__test/state')).json()).webhooks.length>=2),'webhook retry and scheduled report');
 await waitFor(async()=>(await ok(`${p}/notifications`)).config.last_sent_at,"scheduled report delivery timestamp");
 const leftover=(await (await fetch(mock+'/__test/state')).json()).files.length;
 await ok(`/api/test-cases/${tc.id}`,'DELETE',undefined,qa.token);
 await tick();
 await waitFor(async()=>((await (await fetch(mock+'/__test/state')).json()).files.length<leftover),'case attachment cleanup');
 assert.equal((await ok(`${p}/tasks/${converted.task_id}`)).task.testcase_id,null);
 assert.equal((await ok(`${p}/test-runs/${run.id}`)).stats.total,2,'run retains historical entries for deleted cases');
 await ok(`${p}/test-runs/${run.id}`,'DELETE',undefined,qa.token,204);
 await ok(`${p}/projects/${project.id}`,'DELETE');assert.equal((await ok(`${p}/tasks/${task.id}`)).task.project,'');
 await ok(`${p}/sprints/${sprint.id}`,'DELETE');assert.equal((await ok(`${p}/tasks/${task.id}`)).task.sprint_id,null);
 await ok(`${p}/assignees/${devWorker.id}`,'DELETE');assert.equal((await request(`${p}/tasks`,'GET',undefined,dev.token)).status,403);
 assert.equal((await ok('/api/notifications','GET',undefined,dev.token)).notifications.length,0,'revoked workspace metadata is not returned');
 console.log('PASS: durable jobs, schedule/retry, file cleanup, cascades and revoked-access notification privacy');
} finally {
 for(const socket of sockets)socket.close();
 for(const id of [ws1.id,ws2.id,owned.id])await request(`/api/workspaces/${id}`,'DELETE',undefined,id===owned.id?ownUser.token:admin);
}
