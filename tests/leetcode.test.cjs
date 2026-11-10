const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const core=require('../leetcode-core.js');
const {createApp}=require('../server.cjs');
test('the authored trace solves duplicates, zeroes, negatives, and overflow-sensitive examples',()=>{
  for(const [nums,target]of [[[3,3],6],[[0,4,0],0],[[-3,4,3,90],0],[[2147483647,-2147483648,0,-1],-1],[[2,7],9]]){
    const t=core.traceTwoSum(nums,target);assert(t.answer);const [a,b]=t.answer;assert.notEqual(a,b);assert.equal(nums[a]+nums[b],target);
    for(const frame of t.frames){if(frame.phase==='read'||frame.phase==='check'||frame.phase==='found')assert(frame.map.every(pair=>pair.index<frame.i));}
  }
  const none=core.traceTwoSum([1,2,3],99);assert.equal(none.answer,null);assert.equal(none.frames.at(-1).phase,'done');
});
test('trace outputs agree with brute-force existence on 300 deterministic examples',()=>{
  let seed=17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  for(let test=0;test<300;test++){const nums=Array.from({length:2+random()%15},()=>random()%41-20),target=random()%61-30;let exists=false;for(let i=0;i<nums.length;i++)for(let j=i+1;j<nums.length;j++)if(nums[i]+nums[j]===target)exists=true;const trace=core.traceTwoSum(nums,target);assert.equal(!!trace.answer,exists);if(trace.answer){const [i,j]=trace.answer;assert(i<j);assert.equal(nums[i]+nums[j],target);}}
});
test('invalid examples fail clearly and source arrays are not mutated',()=>{
  const nums=[3,2,4];core.traceTwoSum(nums,6);assert.deepEqual(nums,[3,2,4]);for(const [a,t]of [[[1],2],[[1,2.5],3],[[1,2],Infinity],[[2147483648,2],0]])assert.throws(()=>core.traceTwoSum(a,t));
});
function validGenerated(){return {...core.lesson,source:'generated',cNotes:core.lesson.cNotes.map(n=>({line:core.c.slice(0,core.c.indexOf(n.match)).split('\n').length,text:n.text})),visual:{frames:[{caption:'Start',items:[{id:'a',label:'index 0',value:2,state:'active'}],edges:[],variables:[]},{caption:'Find partner',items:[{id:'a',label:'index 0',value:2,state:'found'},{id:'b',label:'index 1',value:7,state:'found'}],edges:[{from:'a',to:'b',label:'sum 9'}],variables:[{name:'answer',value:'[0, 1]'}]}]}};}
test('lesson validation requires the full teaching journey, both languages and a valid trace',()=>{
  const lesson=core.validateLesson(validGenerated());assert.equal(lesson.source,'generated');assert.equal(lesson.sections.length,8);assert.equal(lesson.visual.frames.length,2);
  for(const change of [{sections:[]},{python:''},{visual:null},{cNotes:[]}])assert.throws(()=>core.validateLesson({...validGenerated(),...change}));
  const bad=validGenerated();bad.visual.frames[0].items.push({id:'a',value:3});assert.throws(()=>core.validateLesson(bad));
});
async function invoke(app,body){const req={url:'/api/leetcode/lesson',method:'POST',headers:{host:'127.0.0.1:8765',origin:'http://127.0.0.1:8765','content-type':'application/json'},async *[Symbol.asyncIterator](){yield Buffer.from(JSON.stringify(body));}};const res=new EventEmitter();res.writeHead=s=>{res.status=s;res.headersSent=true;};res.end=t=>{res.raw=t;res.writableEnded=true;};await app(req,res);return {status:res.status,json:()=>JSON.parse(res.raw)};}
test('the lesson endpoint uses a larger bounded budget and validates generated lesson data',async()=>{
  let payload;const app=createApp({apiKey:'test-not-real',fetchImpl:async(_,options)=>{payload=JSON.parse(options.body);return {ok:true,async json(){return {output:[{content:[{type:'output_text',text:JSON.stringify(validGenerated())}]}]};}};}});
  const r=await invoke(app,{problem:'Find two distinct positions in an integer array whose values sum to a target. Return their indices.'});assert.equal(r.status,200);assert.equal(r.json().lesson.sections.length,8);assert.equal(payload.max_output_tokens,8000);assert.equal(payload.store,false);assert.match(payload.instructions,/first time/);
});
test('incomplete generated lessons and underspecified requests do not become saved teaching content',async()=>{
  const app=createApp({apiKey:'test',fetchImpl:async()=>({ok:true,async json(){return {output:[{content:[{type:'output_text',text:'{"title":"incomplete"}'}]}]};}})});
  assert.equal((await invoke(app,{problem:'Solve this new algorithm problem with examples and constraints supplied here.'})).status,502);assert.equal((await invoke(app,{problem:'hi'})).status,400);
});

