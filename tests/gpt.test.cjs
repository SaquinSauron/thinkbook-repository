const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
const {createApp,validateRequest,extractText}=require('../server.cjs');
const origin='http://127.0.0.1:8765';
const noteMessages=[{role:'system',content:'Ask a useful question.'},{role:'user',content:'My notebook passage.'},{role:'assistant',content:'Why does that follow?'},{role:'user',content:'Explain the assumption.'}];
async function invoke(app,{url='/api/gpt/respond',body={messages:noteMessages},method='POST',headers={}}={}){
  const req={url,method,headers:{host:'127.0.0.1:8765',origin,'content-type':'application/json',...headers},async *[Symbol.asyncIterator](){yield Buffer.from(typeof body==='string'?body:JSON.stringify(body));}};
  const res=new EventEmitter();res.headers={};res.status=0;res.raw='';res.writableEnded=false;res.destroyed=false;
  res.writeHead=(status,head)=>{res.status=status;res.headers=head;res.headersSent=true;};res.end=text=>{res.raw=String(text||'');res.writableEnded=true;};
  await app(req,res);return {status:res.status,headers:res.headers,raw:res.raw,json:()=>JSON.parse(res.raw)};
}
test('GPT status never returns the configured key; secret and arbitrary paths are not served',async()=>{
  const secret='test-server-secret';const app=createApp({apiKey:secret});
  const status=await invoke(app,{url:'/api/gpt/status',method:'GET'});assert.equal(status.json().configured,true);assert(!status.raw.includes(secret));
  for(const url of ['/.env','/server.cjs','/../.env'])assert.equal((await invoke(app,{url,method:'GET'})).status,404);
});
test('missing keys fail without making an OpenAI request',async()=>{
  let called=false;const app=createApp({fetchImpl:async()=>{called=true;}});const res=await invoke(app);assert.equal(res.status,503);assert.equal(called,false);
});
test('foreign origins, missing origins, invalid hosts and oversized bodies are rejected',async()=>{
  const app=createApp({apiKey:'test'});
  for(const headers of [{origin:'https://evil.example'},{origin:undefined},{host:'evil.example:8765'}])assert.equal((await invoke(app,{headers})).status,403);
  assert.equal((await invoke(app,{body:{padding:'x'.repeat(130000)}})).status,413);
  assert.equal((await invoke(app,{body:'{broken'})).status,400);
});
test('Responses API receives context and follow-ups, with the key only in server headers',async()=>{
  let outbound;const key='test-secret-not-a-real-key';
  const app=createApp({apiKey:key,fetchImpl:async(url,options)=>{outbound={url,...options};return {ok:true,async json(){return {output:[{type:'message',content:[{type:'output_text',text:'Try checking the assumption first.'}]}]};}};}});
  const res=await invoke(app,{body:{messages:noteMessages,model:'gpt-4.1-mini',max_tokens:500}});
  assert.equal(res.status,200);assert.equal(res.json().text,'Try checking the assumption first.');assert.equal(outbound.url,'https://api.openai.com/v1/responses');
  assert.equal(outbound.headers.Authorization,'Bearer '+key);const payload=JSON.parse(outbound.body);assert.equal(payload.store,false);assert.equal(payload.instructions,noteMessages[0].content);assert.deepEqual(payload.input,noteMessages.slice(1));assert(!outbound.body.includes(key));assert(!res.raw.includes(key));
});
test('OpenAI errors are safe, readable, and do not echo upstream secret-bearing messages',async()=>{
  const app=createApp({apiKey:'test-secret',fetchImpl:async()=>({ok:false,status:401,async json(){return {error:{message:'bad key test-secret'}};}})});
  const res=await invoke(app);assert.equal(res.status,502);assert.match(res.json().error,/rejected/);assert(!res.raw.includes('test-secret'));
});
test('a second tab cannot start a concurrent billable request',async()=>{
  let release,started;const start=new Promise(r=>started=r),gate=new Promise(r=>release=r);
  const app=createApp({apiKey:'test',fetchImpl:async()=>{started();await gate;return {ok:true,async json(){return {output:[{content:[{type:'output_text',text:'Done'}]}]};}};}});
  const first=invoke(app);await start;const second=await invoke(app);assert.equal(second.status,429);release();assert.equal((await first).status,200);
});
test('empty responses fail visibly and malformed messages are not accepted',async()=>{
  const app=createApp({apiKey:'test',fetchImpl:async()=>({ok:true,async json(){return {output:[]};}})});assert.equal((await invoke(app)).status,502);
  assert.throws(()=>validateRequest({messages:[{role:'tool',content:'bad'}]}));assert.equal(extractText({output:[{content:[{type:'refusal',refusal:'I cannot help with that.'}]}]}),'I cannot help with that.');
});
test('the notebook can select GPT, defaults to manual, and uses it inside the conversation',async()=>{
  const elements=new Map(),disk=new Map();
  const el=s=>{if(!elements.has(s))elements.set(s,{value:'',checked:false,textContent:'',disabled:false,classList:{toggle(){}},close(){},showModal(){},querySelectorAll(){return [];}});return elements.get(s);};
  let payload;
  const context={crypto:webcrypto,location:{protocol:'http:'},document:{querySelector:el,querySelectorAll:()=>[]},localStorage:{getItem:k=>disk.get(k)||null,setItem:(k,v)=>disk.set(k,v)},setTimeout:()=>0,clearTimeout(){},AbortController,fetch:async(url,options)=>({ok:true,async json(){if(url==='/api/gpt/status')return {configured:true};payload=JSON.parse(options.body);return {text:'A reply from the mocked GPT backend.'};}})};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../app.js'),'utf8').replace(/init\(\);\s*$/,''),context);
  const run=source=>vm.runInContext(source,context);
  run("ready=true;state.notes=[newNote('Study')];state.active=state.notes[0].id;state.notes[0].blocks[0].text='A sorted array lets binary search discard half.';");
  el('#gptConsent').checked=true;el('#gptModel').value='gpt-4.1-mini';await run('connectGPT()');assert.equal(run('engine.provider'),'openai');assert.equal(run('current().mode'),'manual');
  run("state.active='another-note'");await run("requestThought(state.notes[0],state.notes[0].blocks[0].id,'explain')");assert.match(payload.messages[1].content,/binary search/);assert.equal(run('state.notes[0].thoughts[0].source'),'openai');assert.match(run('state.notes[0].thoughts[0].messages[0].content'),/mocked GPT/);
  context.location.protocol='file:';await run('connectGPT()');assert.match(el('#gptMessage').textContent,/server edition/);
});

