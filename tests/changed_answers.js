const fs=require('fs'),vm=require('vm'),assert=require('assert');
const path=require('path'),root=path.resolve(__dirname,'..');
const elements=new Map();
function el(key){if(!elements.has(key))elements.set(key,{textContent:'',innerHTML:'',value:'',checked:true,hidden:false,style:{},classList:{toggle(){},add(){},remove(){}},addEventListener(){}});return elements.get(key);}
const context={window:{addEventListener(){}},document:{querySelector:el,querySelectorAll:()=>[],createElement:()=>({textContent:'',get innerHTML(){return this.textContent;}}),addEventListener(){}},localStorage:{getItem(){return null;},setItem(){}},navigator:{},location:{protocol:'file:'},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},console};
vm.createContext(context);
context.viewRoot=el('#viewRoot');
vm.runInContext(fs.readFileSync(path.join(root,'questions.js'),'utf8'),context);
let source=fs.readFileSync(path.join(root,'app.js'),'utf8');
source=source.replace('refreshChrome();renderHome();refreshAccount();updatePomoUI();','');
vm.runInContext(source,context);
vm.runInContext(`
  if(BANK.length!==900||CHANGED_BANK.length!==227)throw Error('counts');
  if(BANK.some(q=>!q.explanation?.trim()))throw Error('missing explanation');
  const original=BANK.map(q=>q.id).join(',');
  const sample=drawRandom(BANK,100);
  if(sample.length!==100||new Set(sample.map(q=>q.id)).size!==100)throw Error('random duplicates');
  if(BANK.map(q=>q.id).join(',')!==original)throw Error('bank order mutated');
  if(drawRandom(BANK,1000).length!==900)throw Error('random count clamp');
  renderHome();
  if(!viewRoot.innerHTML.includes('答案变更专项')||viewRoot.innerHTML.includes('???'))throw Error('home encoding');
  for(const [type,count] of Object.entries({tf:34,single:38,multi:155})){
    const pool=CHANGED_BANK.filter(q=>q.type===type);
    if(pool.length!==count)throw Error('type count');
    changedSettings={pool,count:Math.min(10,pool.length),remaining:shuffle(pool),loop:true,round:1};
    const seen=new Set();
    while(seen.size<pool.length){for(const q of takeChangedRound()){if(q.type!==type)throw Error('type leak');seen.add(q.id);}}
    if(seen.size!==pool.length)throw Error('coverage');
  }
  changedSettings={pool:CHANGED_BANK,count:20,remaining:shuffle(CHANGED_BANK),loop:true,round:1};
  const first=takeChangedRound();startPractice('changed',first);
  session.index=19;nextQuestion();
  if(changedSettings.round!==2||session.index!==0||session.questions.length!==20||Object.keys(session.answers).length)throw Error('loop reset');
  const multi=CHANGED_BANK.find(q=>q.type==='multi');startPractice('changed',[multi]);
  selectOption('A');selectOption('B');
  if(session.selected.join('')!=='AB')throw Error('multi selection lost');
  session.selected=[...multi.answer];submitAnswer();
  if(!session.submitted||!feedbackHtml(multi,multi.answer).includes('旧版答案'))throw Error('feedback');
`,context);
const bank=context.window.QUESTION_BANK;
const comparison=JSON.parse(fs.readFileSync(path.join(root,'docs/answer-comparison.json'),'utf8'));
for(const change of comparison.changes){const q=bank.find(q=>q.id===change.id);assert.deepStrictEqual(Array.from(q.answer),change.newAnswer);assert.deepStrictEqual(Array.from(q.previousAnswer),change.oldAnswer);}
console.log('PASS: 900 questions, 227 changes, type filtering, quantities, full coverage, loop reset, multi selection, new/old feedback');
