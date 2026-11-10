'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const leetcode = require('./leetcode-core.js');

function localConfig(root, env = process.env) {
  const config = {};
  try {
    const file = fs.readFileSync(path.join(root, '.env'), 'utf8');
    for (const line of file.split(/\r?\n/)) {
      const match = line.match(/^\s*(OPENAI_API_KEY|OPENAI_MODEL|PORT)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1,-1);
      config[match[1]] = value;
    }
  } catch (e) { if (e.code !== 'ENOENT') throw Error('Could not read .env. Check its file permissions.'); }
  for (const key of ['OPENAI_API_KEY', 'OPENAI_MODEL', 'PORT']) if (env[key] !== undefined) config[key] = env[key];
  return config;
}
function validateRequest(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 14) throw Error('Include 1 to 14 conversation messages.');
  const messages = body.messages.map(m => {
    if (!m || !['system','user','assistant'].includes(m.role) || typeof m.content !== 'string' || m.content.length > 16000) throw Error('Invalid conversation message.');
    return {role:m.role, content:m.content};
  });
  if (messages.reduce((sum,m) => sum+m.content.length,0) > 42000) throw Error('This conversation is too long. Start a new thought.');
  if (body.model !== undefined && (typeof body.model !== 'string' || !/^[a-zA-Z0-9._:-]{1,120}$/.test(body.model))) throw Error('Enter a valid model ID.');
  return {messages, model:body.model, maxTokens:Math.min(2000, Math.max(128,Number(body.max_tokens)||850))};
}
function extractText(data) {
  return (Array.isArray(data?.output) ? data.output : []).flatMap(item => Array.isArray(item.content) ? item.content : []).filter(c => c.type === 'output_text' || c.type === 'refusal').map(c => c.type === 'refusal' ? c.refusal : c.text).filter(t => typeof t === 'string').join('\n').trim();
}
function createApp({apiKey = '', model = 'gpt-4.1-mini', port = 8765, root = __dirname, fetchImpl = globalThis.fetch} = {}) {
  let inFlight = false;
  const requests = [];
  const hosts = new Set([`127.0.0.1:${port}`,`localhost:${port}`]);
  const origins = new Set([`http://127.0.0.1:${port}`,`http://localhost:${port}`]);
  function json(res,status,body) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}
  return async function app(req,res) {
    try {
      if (!hosts.has(req.headers.host)) return json(res,403,{error:'Use the local Thinkbook address.'});
      if (req.headers.origin && !origins.has(req.headers.origin)) return json(res,403,{error:'Requests must come from this local notebook.'});
      const route = req.url.split('?')[0];
      if (req.method === 'GET' && route === '/api/gpt/status') return json(res,200,{configured:!!apiKey,model,provider:'openai'});
      if (req.method === 'GET' && route === '/api/health') return json(res,200,{app:'thinkbook',ok:true});
      const assets = {'/':['index.html','text/html'], '/index.html':['index.html','text/html'], '/app.js':['app.js','text/javascript'], '/style.css':['style.css','text/css'], '/leetcode.html':['leetcode.html','text/html'], '/leetcode.js':['leetcode.js','text/javascript'], '/leetcode-core.js':['leetcode-core.js','text/javascript'], '/leetcode.css':['leetcode.css','text/css']};
      if (req.method === 'GET' && assets[route]) {
        const [file,type]=assets[route];
        res.writeHead(200,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});
        return res.end(fs.readFileSync(path.join(root,file)));
      }
      const isLesson = route === '/api/leetcode/lesson';
      if (req.method !== 'POST' || (!isLesson && route !== '/api/gpt/respond')) return json(res,404,{error:'Not found'});
      if (!origins.has(req.headers.origin)) return json(res,403,{error:'Open the notebook through its local server before using GPT.'});
      if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return json(res,415,{error:'Send a JSON request.'});
      let raw='';for await (const chunk of req) {raw+=chunk;if(Buffer.byteLength(raw)>120000)return json(res,413,{error:'This request is too large.'});}
      let body;try {const input=JSON.parse(raw);if(isLesson){if(typeof input.problem!=='string'||input.problem.trim().length<30||input.problem.length>14000)throw Error('Paste 30 to 14,000 characters of problem text, including examples and constraints.');body=validateRequest({messages:leetcode.teachingMessages(input.problem),model:input.model});body.maxTokens=8000;}else body=validateRequest(input);}catch(e){return json(res,400,{error:e instanceof SyntaxError?'Invalid JSON request.':e.message});}
      if (!apiKey) return json(res,503,{error:'Set OPENAI_API_KEY in the server environment or local .env, then restart Thinkbook.'});
      const now=Date.now();while(requests.length&&requests[0]<now-60000)requests.shift();
      if (inFlight) return json(res,429,{error:'Another GPT response is still running. Wait or stop it before retrying.'});
      if (requests.length>=20) return json(res,429,{error:'Local limit reached: 20 GPT requests per minute. Please wait.'});
      requests.push(now);inFlight=true;
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),90000);
      const cancel=()=>{if(!res.writableEnded)controller.abort();};res.on('close',cancel);
      try {
        const instructions=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
        const input=body.messages.filter(m=>m.role!=='system');
        if (!input.length) return json(res,400,{error:'Include a user message.'});
        const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:body.model||model,instructions,input,max_output_tokens:body.maxTokens,store:false}),signal:controller.signal});
        if (!response.ok) {
          const messages={401:'OpenAI rejected the server API key. Check OPENAI_API_KEY and restart.',403:'Your API account does not have access to this model.',429:'OpenAI reports a quota or rate limit. Check API billing and limits.',400:'OpenAI could not use this model or request. Check the model ID and account access.'};
          return json(res,response.status===429?429:502,{error:messages[response.status]||'OpenAI is temporarily unavailable. Please try again later.'});
        }
        const data=await response.json(),text=extractText(data);
        if (!text) return json(res,502,{error:'OpenAI returned no visible answer. Try a different model or a shorter request.'});
        if(isLesson){let parsed;try{parsed=JSON.parse(text.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));if(typeof parsed.error==='string')return json(res,422,{error:parsed.error.slice(0,500)});parsed=leetcode.validateLesson(parsed);}catch{return json(res,502,{error:'The model returned an incomplete lesson. No partial result was installed. Try again or use a more capable model.'});}return json(res,200,{lesson:parsed,model:body.model||model});}
        return json(res,200,{text,model:body.model||model});
      } catch(e) {if(!res.destroyed)return json(res,controller.signal.aborted?504:502,{error:controller.signal.aborted?'GPT request was stopped or timed out.':'Could not reach OpenAI. Check the connection and try again.'});}
      finally {clearTimeout(timeout);res.removeListener('close',cancel);inFlight=false;}
    } catch {if(!res.headersSent)json(res,500,{error:'Thinkbook could not complete this request.'});else if(!res.writableEnded)res.end();}
  };
}
if (require.main === module) {
  const config=localConfig(__dirname),port=Number(config.PORT||8765);
  if(!Number.isInteger(port)||port<1024||port>65535)throw Error('PORT must be between 1024 and 65535.');
  const server=http.createServer(createApp({apiKey:config.OPENAI_API_KEY||'',model:config.OPENAI_MODEL||'gpt-4.1-mini',port}));
  server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'This port is already in use. Stop the old server or change PORT in .env.':'Could not start Thinkbook.');process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log(`Thinkbook: http://127.0.0.1:${port}\nGPT key configured: ${config.OPENAI_API_KEY?'yes':'no'}\nKeep this terminal open. Press Ctrl+C to stop.`));
}
module.exports={createApp,validateRequest,extractText,localConfig};

