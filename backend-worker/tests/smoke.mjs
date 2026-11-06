import assert from 'node:assert/strict';
import { parseEnv } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';
const base=process.env.WORKER_TEST_URL;
if (!base || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base)) throw new Error('Use npm run worker:smoke with an isolated localhost Worker');
const env=await readFile(new URL('../.dev.vars',import.meta.url),'utf8');
const setup=parseEnv(env).INITIAL_SETUP_TOKEN;
const password=`Test-${crypto.randomUUID()}`;
const suffix=crypto.randomUUID();
async function request(path,method='GET',data,token,extra={}) {
  const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} :{}),...extra},body:data===undefined?undefined:JSON.stringify(data)});
  const body=await response.json();
  return {status:response.status,body};
}
assert.equal((await request('/health')).status,200);
// Uses an isolated local D1 state directory. Never point this test at production.
let r=await request('/api/auth/invite','POST',{email:`admin-${suffix}@example.test`,password},undefined,{'X-Setup-Token':setup});
assert.equal(r.status,200,`bootstrap: ${JSON.stringify(r.body)}`);
r=await request('/api/auth/login','POST',{email:`admin-${suffix}@example.test`,password});
assert.equal(r.status,200,`login: ${JSON.stringify(r.body)}`);let admin=r.body.token;
assert.equal((await request('/api/auth/me','GET',undefined,admin)).body.role,'admin');
// Workzy: enabled by WORKZY_API_URL, but nobody is linked yet (no network call is made)
assert.deepEqual((await request('/api/integrations/workzy','GET',undefined,admin)).body,{enabled:true,connected:false,employee_code:null});
assert.deepEqual((await request('/api/integrations/workzy/today','GET',undefined,admin)).body,{connected:false});
assert.equal((await request('/api/integrations/workzy','POST',{code:'',password:''},admin)).status,400);
r=await request('/api/workspaces','POST',{name:'Worker smoke'},admin);assert.equal(r.status,200,JSON.stringify(r.body));
const workspace=r.body.workspace;
assert.match(workspace.id,/^[\da-f]{8}-[\da-f]{4}-4/);
await request('/api/auth/invite','POST',{email:`outsider-${suffix}@example.test`,password},admin);
r=await request('/api/auth/login','POST',{email:`outsider-${suffix}@example.test`,password});const outsider=r.body.token;const outsiderId=r.body.id;
assert.ok(outsider);
assert.equal((await request(`/api/workspaces/${workspace.id}/tasks`,'GET',undefined,outsider)).status,403);
assert.equal((await request(`/api/workspaces/${workspace.room_code}/realtime-ticket`,'POST',{},outsider)).status,403);
r=await request(`/api/workspaces/${workspace.id}/assignees`,'POST',{name:'Linked user',user_id:outsiderId},admin);
assert.equal(r.status,200,JSON.stringify(r.body));const member=r.body.assignee;
assert.equal((await request(`/api/workspaces/${workspace.id}/tasks`,'GET',undefined,outsider)).status,200);
assert.equal((await request(`/api/workspaces/${workspace.id}/assignees`,'POST',{name:'Cannot grant',user_id:outsiderId},outsider)).status,403);
await request(`/api/workspaces/${workspace.id}/assignees/${member.id}`,'DELETE',undefined,admin);
assert.equal((await request(`/api/workspaces/${workspace.id}/tasks`,'GET',undefined,outsider)).status,403);
r=await request(`/api/workspaces/${workspace.room_code}/realtime-ticket`,'POST',{},admin);assert.equal(r.status,200,JSON.stringify(r.body));
const socket=new WebSocket(`${base.replace(/^http/,'ws')}/ws?ticket=${r.body.ticket}`);
const events=[];socket.addEventListener('message',e=>events.push(JSON.parse(e.data)));
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
try {
  const taskPath=`/api/workspaces/${workspace.id}/tasks`;
  r=await request(taskPath,'POST',{title:'Persisted task',start_date:'2026-11-06',workspace_id:'forged'},admin);
  assert.equal(r.status,200,JSON.stringify(r.body));const task=r.body.task;
  assert.match(task.created_at,/^\d{4}-\d{2}-\d{2}T/);assert.equal(task.workspace_id,workspace.id);assert.equal(task.task_number,1);
  for(let i=0;i<20 && !events.some(e=>e.type==='data');i++)await new Promise(r=>setTimeout(r,50));
  assert.ok(events.some(e=>e.type==='data' && JSON.parse(e.data).id===task.id),'server event after D1 write');
  const list=await request(taskPath,'GET',undefined,admin);assert.equal(list.body.total,1);assert.equal(list.body.tasks[0].id,task.id);
  r=await request(`${taskPath}/${task.id}`,'PUT',{title:'Updated task',project:'',duration_minutes:5,start_date:'2026-11-06',date:'2026-11-06',end_date:null,due_date:null,status:'done',priority:'high',task_type:null,category:'Development',notes:'Full form update',assignee_ids:[],sprint_id:null,is_archived:false,checklist:[],links:[],testcase_id:null,id:'forged',task_number:999},admin);
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.task.title,'Updated task');assert.equal(r.body.task.id,task.id);assert.equal(r.body.task.task_number,1);assert.equal(r.body.task.sprint_id,null);
  // Client-originated broadcast must never mutate D1 or be forwarded to peers.
  const count=events.filter(e=>e.type==='data').length;
  socket.send(JSON.stringify({action:'broadcast',data:JSON.stringify({entity:'task',action:'delete',id:task.id})}));
  await new Promise(r=>setTimeout(r,100));
  assert.equal(events.filter(e=>e.type==='data').length,count);
  assert.equal((await request(`${taskPath}/${task.id}`,'GET',undefined,admin)).status,200);
  assert.equal((await request(`${taskPath}/${task.id}`,'DELETE',undefined,admin)).status,200);
  assert.equal((await request(taskPath,'GET',undefined,admin)).body.total,0);
  assert.equal((await request('/api/auth/logout','POST',{},outsider)).status,200);
  assert.equal((await request('/api/auth/me','GET',undefined,outsider)).status,401);
  const firstSession=admin;
  const delivered=events.filter(e=>e.type==='data').length;
  await request('/api/auth/logout','POST',{},firstSession);
  r=await request('/api/auth/login','POST',{email:`admin-${suffix}@example.test`,password});
  admin=r.body.token;assert.ok(admin);
  assert.equal((await request(taskPath,'POST',{title:'After logout',start_date:'2026-11-06'},admin)).status,200);
  await new Promise(r=>setTimeout(r,100));
  assert.equal(events.filter(e=>e.type==='data').length,delivered,'revoked session receives no new workspace events');
  console.log('PASS: local D1 auth, UUIDs, permissions, task CRUD, server-only realtime, logout and socket revocation');
} finally {
  socket.close();
  await request(`/api/workspaces/${workspace.id}`,'DELETE',undefined,admin);
}

if (process.env.TEST_FIXTURE_PATH) await writeFile(process.env.TEST_FIXTURE_PATH, JSON.stringify({base,admin,email:`admin-${suffix}@example.test`,password}),{mode:0o600});
