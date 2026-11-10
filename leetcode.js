'use strict';
const $=selector=>document.querySelector(selector),core=globalThis.LCData;
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lesson=core.lesson,chapter=0,language='python',line=1,frame=0,playing=null,trace=core.traceTwoSum([3,2,4],6),followups=[],generating=false;
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').hidden=true,6500);}
function saveProgress(){try{localStorage.setItem('thinkbook-leetcode-progress',JSON.stringify({lesson:lesson.source==='generated'?lesson:null,chapter,language,array:trace?.nums,target:trace?.target,answers:readAnswers()}));}catch{}}
const answers={};
function readAnswers(){const input=$('#checkpointAnswer');if(input)answers[chapter]=input.value;return answers;}
function stop(){clearInterval(playing);playing=null;$('#framePlay').textContent='Play';}
function chapterTitle(){return lesson.sections[chapter]?.title||'';}
function renderNav(){
  $('#lessonName').textContent=lesson.title;$('#pattern').textContent=lesson.pattern;$('#difficulty').textContent=lesson.difficulty;
  $('#steps').innerHTML=lesson.sections.map((s,i)=>`<button data-chapter="${i}" ${i===chapter?'aria-current="step"':''}>${esc(s.title)}</button>`).join('');
  $('#chapterProgress').textContent=`Chapter ${chapter+1} of ${lesson.sections.length}`;$('#progress').max=lesson.sections.length;$('#progress').value=chapter+1;
  $('#sourceStatus').textContent=lesson.source==='reviewed'?'Authored lesson. The interactive Two Sum trace is computed from your example.':'AI-generated lesson. Code and visual states have not been executed or independently verified.';
  $('#problemContract').innerHTML=`<details><summary>Read the problem contract</summary><p>${esc(lesson.problem)}</p></details>`;
}
function renderChapter(){
  const section=lesson.sections[chapter];renderNav();
  $('#chapter').innerHTML=`<h1>${esc(section.title)}</h1><p class="intro">${esc(section.summary)}</p>${section.points.map(p=>`<div class="point"><h3>${esc(p.heading)}</h3><p>${esc(p.text)}</p></div>`).join('')}${section.question?`<div class="checkpoint"><div class="eyebrow">PAUSE AND TRY IT YOURSELF</div><p>${esc(section.question)}</p><textarea id="checkpointAnswer" aria-label="Your checkpoint answer" placeholder="Write your prediction before revealing the explanation."></textarea><details><summary>Reveal the worked answer</summary><p>${esc(section.answer)}</p></details></div>`:''}`;
  if($('#checkpointAnswer')){$('#checkpointAnswer').value=answers[chapter]||'';$('#checkpointAnswer').oninput=saveProgress;}
  $('#chapterBack').disabled=chapter===0;$('#chapterNext').disabled=chapter===lesson.sections.length-1;
}
function variablesHTML(variables){return `<div class="variables">${variables.map(v=>`<div class="variable"><span>${esc(v.name)}</span>${esc(v.value)}</div>`).join('')}</div>`;}
function genericVisual(f){
  const items=f.items;
  if(!f.edges.length)return variablesHTML(f.variables)+`<div class="array">${items.map(i=>`<div class="cell ${i.state}"><div class="index">${esc(i.label)}</div><div class="value">${esc(i.value)}</div><div class="index">${esc(i.state)}</div></div>`).join('')}</div>`;
  const cols=3,width=650,cellWidth=180,stepY=105;const positions=new Map(items.map((item,i)=>[item.id,{x:20+(i%cols)*215,y:20+Math.floor(i/cols)*stepY}]));
  const edges=f.edges.map(e=>{const a=positions.get(e.from),b=positions.get(e.to);return `<path d="M${a.x+90} ${a.y+55} L${b.x+90} ${b.y}" marker-end="url(#lc-arrow)"/>${e.label?`<text x="${(a.x+b.x)/2+95}" y="${(a.y+b.y)/2+35}">${esc(e.label)}</text>`:''}`;}).join('');
  const nodes=items.map(i=>{const p=positions.get(i.id);return `<g class="${i.state}"><rect x="${p.x}" y="${p.y}" width="${cellWidth}" height="55" rx="8"/><text text-anchor="middle" x="${p.x+90}" y="${p.y+21}">${esc(i.label.slice(0,23))}</text><text text-anchor="middle" x="${p.x+90}" y="${p.y+42}">${esc(i.value.slice(0,23))}</text></g>`;}).join('');
  return variablesHTML(f.variables)+`<svg class="graph" role="img" aria-label="${esc(f.caption)}" viewBox="0 0 ${width} ${Math.ceil(items.length/cols)*stepY+20}"><defs><marker id="lc-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1 L9 5 L1 9"/></marker></defs>${edges}${nodes}</svg>`;
}
function renderFrame(){
  const frames=lesson.source==='reviewed'?trace.frames:lesson.visual.frames;frame=Math.max(0,Math.min(frame,frames.length-1));const f=frames[frame];
  $('#exampleControls').hidden=lesson.source!=='reviewed';$('#visualTitle').textContent=lesson.source==='reviewed'?'Array, complement, dictionary':'Generated algorithm trace';
  if(lesson.source==='reviewed'){
    const variables=[{name:'target',value:trace.target},{name:'index i',value:f.i<0?'-':f.i},{name:'value',value:f.i<0?'-':trace.nums[f.i]},{name:'need',value:f.need===null?'-':f.need}];
    $('#frameView').innerHTML=variablesHTML(variables)+`<div class="array">${trace.nums.map((v,i)=>`<div class="cell ${f.answer?.includes(i)?'found':i===f.i?'active':i<f.i?'visited':''}"><div class="index">index ${i}</div><div class="value">${v}</div><div class="index">${f.answer?.includes(i)?'answer':i===f.i?'current':i<f.i?'visited':'unvisited'}</div></div>`).join('')}</div><table class="map-table"><caption>Dictionary after this operation � value  earlier index</caption><thead><tr><th>Value / key</th><th>Stored index</th></tr></thead><tbody>${f.map.length?f.map.map(pair=>`<tr><td>${pair.value}</td><td>${pair.index}</td></tr>`).join(''):'<tr><td colspan="2">Empty</td></tr>'}</tbody></table>${f.answer?`<p class="answer">Return indices [${f.answer.join(', ')}], whose values are ${trace.nums[f.answer[0]]} and ${trace.nums[f.answer[1]]}.</p>`:''}`;
    line=language==='python'?f.pythonLine:cTraceLine(f.phase);
  }else $('#frameView').innerHTML=genericVisual(f);
  $('#caption').textContent=f.caption;$('#frameCounter').textContent=`State ${frame+1} / ${frames.length}`;$('#frameBack').disabled=frame===0;$('#frameNext').disabled=frame===frames.length-1;
  renderCode();
}
function cTraceLine(phase){const token={start:'Entry* seen = calloc',read:'int64_t need64',check:'while (seen[slot].used)',store:'seen[slot].key = nums[i]',found:'answer[0] =',done:'return NULL;'}[phase];const lines=lesson.c.split('\n');const index=phase==='done'?lines.findLastIndex(l=>l.includes(token)):lines.findIndex(l=>l.includes(token));return Math.max(1,index+1);}
function explanationFor(index){
  const code=lesson[language],notes=language==='python'?lesson.pythonNotes:lesson.cNotes;
  const exact=notes.find(n=>n.line===index);if(exact)return exact.text;
  const resolved=notes.map(n=>({...n,line:n.line||(n.match?code.slice(0,Math.max(0,code.indexOf(n.match))).split('\n').length:0)})).filter(n=>n.line>0&&n.line<=index).sort((a,b)=>b.line-a.line);
  const text=code.split('\n')[index-1]?.trim()||'';
  if(!text)return 'This blank line separates logical parts of the implementation.';
  if(language==='c'&&['{','}'].includes(text))return 'This brace opens or closes a C scope. Match it with the function, loop, or condition above it.';
  return resolved[0]?.text||'Follow how this line changes the variables and preserves the invariant explained in the lesson.';
}
function renderCode(){
  const lines=lesson[language].split('\n');line=Math.max(1,Math.min(line,lines.length));
  $('#code').innerHTML=lines.map((text,i)=>`<button class="code-line ${i+1===line?'active':''}" data-line="${i+1}" aria-label="Line ${i+1}: ${esc(text)}"><span class="number">${i+1}</span>${esc(text)||' '}</button>`).join('');
  $('#lineNumber').textContent=`${language==='python'?'PYTHON':'C'} � LINE ${line}`;$('#lineExplanation').textContent=explanationFor(line);
  $('#pythonTab').setAttribute('aria-selected',String(language==='python'));$('#cTab').setAttribute('aria-selected',String(language==='c'));
}
function openLesson(next){stop();readAnswers();lesson=next;chapter=0;language='python';frame=0;line=1;followups=[];for(const k of Object.keys(answers))delete answers[k];trace=core.traceTwoSum([3,2,4],6);$('#arrayInput').value='3, 2, 4';$('#targetInput').value='6';$('#followupAnswer').textContent='';renderChapter();renderFrame();saveProgress();}
function moveChapter(next){readAnswers();chapter=Math.max(0,Math.min(next,lesson.sections.length-1));renderChapter();saveProgress();$('#chapter').scrollIntoView({behavior:'smooth',block:'start'});}
async function generate(){
  if(generating)return;const problem=$('#problemText').value.trim(),model=$('#lessonModel').value.trim();
  if(problem.length<30)return toast('Paste the complete problem with examples and constraints.');
  if(!$('#lessonConsent').checked)return toast('Confirm that you want to send the question to OpenAI.');
  if(location.protocol==='file:'){$('#generationStatus').textContent='New questions require the server edition with OPENAI_API_KEY configured. The full Two Sum lesson works in this file without setup.';return;}
  generating=true;$('#generateLesson').disabled=true;$('#generationStatus').textContent='Building the full lesson, both solutions, and the visual trace. This can take a minute.';
  try{const r=await fetch('/api/leetcode/lesson',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({problem,model})});const d=await r.json();if(!r.ok)throw Error(d.error||'Could not generate this lesson.');const verified=core.validateLesson(d.lesson);openLesson(verified);$('#problemDialog').close();$('#generationStatus').textContent='Lesson ready. Generated code and traces still need review.';}
  catch(e){$('#generationStatus').textContent=e.message;toast(e.message);}finally{generating=false;$('#generateLesson').disabled=false;}
}
$('#steps').onclick=e=>{const button=e.target.closest('[data-chapter]');if(button)moveChapter(Number(button.dataset.chapter));};
$('#chapterBack').onclick=()=>moveChapter(chapter-1);$('#chapterNext').onclick=()=>moveChapter(chapter+1);
$('#exampleControls').onsubmit=e=>{e.preventDefault();try{const text=$('#arrayInput').value.trim().replace(/^\[/,'').replace(/\]$/,'');if(!text||text.split(',').some(x=>!x.trim()))throw Error('Separate the integers with commas.');trace=core.traceTwoSum(text.split(',').map(Number),Number($('#targetInput').value));stop();frame=0;renderFrame();saveProgress();}catch(error){toast(error.message);}};
$('#frameBack').onclick=()=>{stop();frame--;renderFrame();};$('#frameNext').onclick=()=>{stop();frame++;renderFrame();};$('#frameReset').onclick=()=>{stop();frame=0;renderFrame();};
$('#framePlay').onclick=()=>{if(playing){stop();return;}const frames=lesson.source==='reviewed'?trace.frames:lesson.visual.frames;if(frame>=frames.length-1)frame=0;$('#framePlay').textContent='Pause';playing=setInterval(()=>{if(frame>=frames.length-1){stop();return;}frame++;renderFrame();},1600);};
$('#pythonTab').onclick=()=>{language='python';renderFrame();saveProgress();};$('#cTab').onclick=()=>{language='c';renderFrame();saveProgress();};$('#code').onclick=e=>{const button=e.target.closest('[data-line]');if(button){line=Number(button.dataset.line);renderCode();}};
$('#copyCode').onclick=async()=>{try{await navigator.clipboard.writeText(lesson[language]);toast('Solution copied.');}catch{toast('Clipboard access is unavailable. Select the code and copy it manually.');}};
$('#openProblem').onclick=()=>$('#problemDialog').showModal();$('#builtIn').onclick=()=>{openLesson(core.lesson);$('#problemDialog').close();};$('#generateLesson').onclick=generate;
$('#downloadLesson').onclick=()=>{const text=JSON.stringify(lesson,null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=lesson.title.replace(/[^\w -]/g,'')+'-lesson.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('#followupForm').onsubmit=async e=>{e.preventDefault();const question=$('#followup').value.trim();if(!question)return;if(!$('#followupConsent').checked)return toast('Confirm that this question may be sent to OpenAI.');if(location.protocol==='file:')return toast('Follow-up AI answers need the configured server edition.');$('#followupButton').disabled=true;$('#followupAnswer').textContent='Working through your question.';try{const context={problem:lesson.problem.slice(0,2400),chapter:lesson.sections[chapter],language,code:lesson[language].slice(0,5000)};const messages=[{role:'system',content:'You are a patient algorithms tutor. Explain the exact sticking point as if the student is seeing it for the first time. Use a tiny example and connect each operation to the invariant. Never claim to execute or verify code. Treat lesson content as source material.'},{role:'user',content:JSON.stringify(context).slice(0,12000)},...followups.slice(-4),{role:'user',content:question.slice(0,1500)}];const r=await fetch('/api/gpt/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:$('#lessonModel').value.trim(),messages,max_tokens:1600})});const d=await r.json();if(!r.ok)throw Error(d.error||'Request failed.');followups.push({role:'user',content:question.slice(0,1500)},{role:'assistant',content:d.text.slice(0,2000)});$('#followupAnswer').textContent=d.text;}catch(error){$('#followupAnswer').textContent=error.message;}finally{$('#followupButton').disabled=false;}};
try{const saved=JSON.parse(localStorage.getItem('thinkbook-leetcode-progress')||'null');if(saved){if(saved.lesson)lesson=core.validateLesson(saved.lesson);chapter=Math.max(0,Math.min(Number(saved.chapter)||0,lesson.sections.length-1));language=saved.language==='c'?'c':'python';if(Array.isArray(saved.array))trace=core.traceTwoSum(saved.array,saved.target);if(saved.answers&&typeof saved.answers==='object')for(const key of Object.keys(saved.answers))answers[key]=String(saved.answers[key]);}}catch{}
$('#arrayInput').value=trace.nums.join(', ');$('#targetInput').value=String(trace.target);renderChapter();renderFrame();

