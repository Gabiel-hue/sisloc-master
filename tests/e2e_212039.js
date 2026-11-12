// E2E v35.13.7 — roda o sisloc_master.js INTEIRO num DOM simulado (jsdom) da demanda #212039, com fetch mockado
// (estado mutável: demanda, requisitos, relações). Executa a rotina em TODOS os requisitos (Gravar/Registrar →
// Atualizar links), depois DESFAZ tudo e confere que voltou byte-a-byte. Nada é enviado ao Redmine.
// Cenário A = estado real dos requisitos em 12/11/2026; B = requisitos 'limpos' (sem o que a #212039 já gravou).
// Rodar: node tests/e2e_212039.js A   |   node tests/e2e_212039.js B   (precisa de jsdom)
// Sessão completa: roda o bookmarklet inteiro na #212039 e executa a rotina em TODOS os requisitos,
// depois desfaz tudo. Estado mutável (demanda, requisitos, relações). Nada vai pro Redmine real.
const fs=require('fs');const {JSDOM}=require('jsdom');
const scenario=process.argv[2]||'B';
const path=require('path');const BM=fs.readFileSync(path.join(__dirname,'..','sisloc_master.js'),'utf8').trim();
const ids=['32745','79','60592','31468','31059'];
const S={'212039':fs.readFileSync(path.join(__dirname,'fixtures','212039.txt'),'utf8')};ids.forEach(id=>S[id]=fs.readFileSync(path.join(__dirname,'fixtures_req',id+'.txt'),'utf8'));
if(scenario==='B'){ // estado "limpo": remove o que a #212039 já gravou nos requisitos
  ids.forEach(id=>{let d=S[id];
    d=d.replace(/(\r?\n)+Demanda: #212039\r?\nRT0 - Criar campos de FUST e FUNTTEL na NFCom \(OUT \/ 2026\)\r?\n/,'$1');
    d=d.replace(/(\r?\n)+h3\. RN\d+[^\r\n]*\r?\n\r?\n\(#212039\)[\s\S]*?(?=\r?\n\r?\n(?:h\d\.|---))/,'');
    S[id]=d;});
}
const ORIG=JSON.parse(JSON.stringify(S));const RES={};
const REL={};let relSeq=9000;
if(scenario==='A'){['32745','79','31468','31059'].forEach(id=>REL[id]=[{relId:'5'+id,to:'212039'}]);} // estado real: já relacionados
const REL0=JSON.stringify(REL);const posts=[];const errs=[];const log=[];
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const editHtml=(id)=>`<html><head><meta name="csrf-token" content="TK"></head><body><form id="issue-form"><input id="issue_subject" name="issue[subject]" value="Req ${id}"><textarea id="issue_description" name="issue[description]">${esc(S[id])}</textarea></form></body></html>`;
const showHtml=(id)=>`<html><head><meta name="csrf-token" content="TK"></head><body><table class="list issues">${(REL[id]||[]).map(r=>`<tr id="relation-${r.relId}"><td><input type="checkbox" name="ids[]" value="${r.to}"></td></tr>`).join('')}</table></body></html>`;
const dom=new JSDOM(`<html><head><meta name="csrf-token" content="TK"></head><body><div id="content"><h2>Demanda #212039</h2><div class="subject"><h3>RT0 - Criar campos de FUST e FUNTTEL na NFCom (OUT / 2026)</h3></div></div></body></html>`,{url:'http://net1/redmine/issues/212039',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window;
Object.defineProperty(w.HTMLElement.prototype,'innerText',{get(){return this.textContent},set(v){this.textContent=v},configurable:true});
w.alert=()=>{};w.confirm=()=>true;w.navigator.clipboard={writeText:async()=>{}};
const ok=(body)=>({ok:true,status:200,statusText:'OK',redirected:true,text:async()=>body||'<html><body>ok</body></html>'});
w.fetch=async(url,opt)=>{url=String(url);const method=(opt&&opt.method||'GET').toUpperCase();
  let m;
  if((m=url.match(/\/relations\/(\d+)$/))&&method==='POST'){Object.keys(REL).forEach(k=>REL[k]=REL[k].filter(r=>r.relId!==m[1]));posts.push({url,kind:'delrel'});return ok();}
  if((m=url.match(/\/issues\/(\d+)\/relations$/))&&method==='POST'){const o={};opt.body.forEach((v,k)=>o[k]=v);(REL[m[1]]=REL[m[1]]||[]).push({relId:String(++relSeq),to:o['relation[issue_to_id]']});posts.push({url,kind:'addrel'});return ok();}
  m=url.match(/\/issues\/(\d+)(\/edit)?(?:[?#].*)?$/);if(!m||S[m[1]]==null)return {ok:false,status:404,text:async()=>''};
  const id=m[1];
  if(method==='POST'){const o={};opt.body.forEach((v,k)=>o[k]=v);if(o['issue[description]']!=null){S[id]=o['issue[description]'];posts.push({url,kind:'desc',id});}return ok();}
  return ok(m[2]?editHtml(id):showHtml(id));};
w.addEventListener('error',e=>errs.push('error: '+e.message));
process.on('unhandledRejection',e=>errs.push('unhandledRejection: '+(e&&e.message||e)));
const origErr=w.console.error;w.console.error=(...a)=>errs.push('console.error: '+a.join(' '));
w.eval('(function(){'+BM.replace(/^javascript:\(function\(\)\{/,'').replace(/\}\)\(\);?$/,'')+'})()');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const T=el=>el.textContent.replace(/\s+/g,' ');
(async()=>{await sleep(2500);const doc=w.document;
  // expande "ver mais" / incluir sem-regra se existir
  const cards=()=>{const out={};const c=[...doc.querySelectorAll('div')].filter(d=>(d.textContent.match(/Requisito #\d+/g)||[]).length===1&&d.querySelector('button'));c.sort((a,b)=>b.textContent.length-a.textContent.length);c.forEach(d=>{const id=d.textContent.match(/Requisito #(\d+)/)[1];if(!out[id])out[id]=d});return out};
  const btn=(card,re)=>[...card.querySelectorAll('button')].find(b=>re.test(b.textContent)&&!b.disabled);
  const msgs=card=>(T(card).match(/(❌[^❌⚠✅↻⊘🔗]{0,120}|⊘[^❌⚠✅↻]{0,110}|↻[^❌⚠✅]{0,70}|✅ [^❌⚠✅↻]{0,70}|⚠️ [^❌⚠✅↻]{0,80}|🔗 Rela[^❌⚠✅↻]{0,50}|🚫[^❌⚠✅↻]{0,40})/g)||[]);
  const say=s=>{log.push(s);console.log(s)};
  const C=cards();
  say('VERSÃO '+(T(doc.body).match(/v35\.\d+\.\d+/)||[])[0]+' — cenário '+scenario);
  ids.forEach(id=>{const c=C[id];say(' card #'+id+': '+(c?[(T(c).match(/Última: RN\d+/)||['sem-regra'])[0],[...c.querySelectorAll('button')].map(b=>b.textContent.trim()).join(' / ')].join(' · '):'(sem card)'));});
  say('\n— ROTINA —');
  const undoStack=[];
  for(const id of ids){const c=C[id];if(!c)continue;
    let b=btn(c,/Gravar Regras/)||btn(c,/Registrar Changelog/);
    if(!b){const bad=btn(c,/Gravar mesmo assim/);say(' #'+id+': '+(bad?'⛔ bloqueado (regra já existe no requisito) — não clicado, comportamento esperado':'sem ação (já registrado)')+' | '+msgs(c).slice(0,2).join(' ¦ '));continue;}
    const before=S[id];const label=b.textContent.trim();b.click();await sleep(1800);
    const after=S[id];const changed=before!==after;
    const newRN=(after.match(/h3\. (RN\d+)[^\r\n]*\r?\n\r?\n\(#212039\)/)||[])[1];
    const chCount=(after.match(/Demanda: #212039\r?\n/g)||[]).length;
    say(' #'+id+': ['+label+'] gravou='+changed+(newRN?' regra='+newRN:'')+' changelog#212039 x'+chCount+' rel='+JSON.stringify((REL[id]||[]).map(r=>r.to))+' | '+msgs(c).slice(0,3).join(' ¦ '));
    RES[id]={changed,newRN,chCount,after};
    if(changed)undoStack.push({id,kind:/Gravar/.test(label)?'grav':'ch'});
    const bl=btn(c,/Atualizar links/);
    if(bl&&/Gravar/.test(label)){const d0=S['212039'];bl.click();await sleep(1800);const d1=S['212039'];
      const a=d0.split('\n'),z=d1.split('\n');const diffs=a.map((l,i)=>l!==z[i]?'L'+(i+1)+': '+l.trim()+'  ⟶  '+(z[i]||'').trim():null).filter(Boolean);
      say('    Atualizar links: '+(diffs.length?diffs.join('\n                     '):'(nenhuma linha mudou)')+' | '+msgs(c).filter(x=>!/Rela/.test(x)).slice(-2).join(' ¦ '));
      if(d0!==d1)undoStack.push({id,kind:'links'});}
  }
  say('\n— DESFAZER TUDO (ordem inversa) —');
  for(const u of undoStack.reverse()){const c=C[u.id];
    const re=u.kind==='links'?/Desfazer atualiza/:u.kind==='grav'?/Desfazer grava/:/Desfazer changelog/;
    const b=btn(c,re);if(!b){say(' #'+u.id+' '+u.kind+': ✗ botão desfazer não achado');continue;}
    b.click();await sleep(300);const y=[...c.querySelectorAll('.cyes, .btn-confirm-yes, button')].find(x=>/Sim/.test(x.textContent));if(y)y.click();await sleep(1500);
    say(' #'+u.id+' desfazer '+u.kind+': '+msgs(c).filter(x=>/↻|⊘|❌/.test(x)).slice(-1).join(''));}
  say('\n— CONFERÊNCIA FINAL —');
  ['212039',...ids].forEach(id=>say(' #'+id+' voltou ao original: '+(S[id].replace(/\r\n/g,'\n')===ORIG[id].replace(/\r\n/g,'\n'))+'   relações: '+JSON.stringify(REL[id]||[])));
  ids.forEach(id=>{if(S[id].replace(/\r\n/g,'\n')!==ORIG[id].replace(/\r\n/g,'\n')){const a=ORIG[id].replace(/\r\n/g,'\n'),b=S[id].replace(/\r\n/g,'\n');let i=0;while(a[i]===b[i])i++;say('   diff #'+id+' @'+i+' (len '+a.length+'→'+b.length+')\n     orig = '+JSON.stringify(a.slice(Math.max(0,i-80),i+160))+'\n     agora= '+JSON.stringify(b.slice(Math.max(0,i-80),i+160)));}});
  say('Erros JS: '+(errs.length?errs.join(' | '):'nenhum'));
  const fail=[];const A=(c,m)=>{if(!c)fail.push(m)};
  A(!errs.length,'erros JS: '+errs.join(' | '));
  A(RES['60592']&&RES['60592'].newRN==='RN5'&&RES['60592'].chCount===1,'#60592 deveria gravar RN5 + changelog');
  A(RES['31468']&&RES['31468'].newRN==='RN102'&&RES['31468'].chCount===1,'#31468 deveria gravar RN102 (não RN94775) com changelog único');
  if(RES['31468']){const h=[...RES['31468'].after.matchAll(/\nh3\. (RN[\d.-]+)/g)].map(m=>m[1]);const k=h.indexOf('RN102');A(h[k-1]==='RN101','#31468: RN102 deveria vir logo após RN101 (veio após '+h[k-1]+')');}
  if(scenario==='B'){A(RES['32745']&&RES['32745'].newRN==='RN84','#32745 RN84');A(RES['79']&&RES['79'].newRN==='RN96','#79 RN96');A(RES['31059']&&RES['31059'].changed&&RES['31059'].chCount===1,'#31059 changelog');}
  if(scenario==='A'){A(!RES['32745']&&!RES['79'],'#32745/#79 deveriam ficar bloqueados (regra já existe)');}
  ['212039',...ids].forEach(id=>A(S[id].replace(/\r\n/g,'\n')===ORIG[id].replace(/\r\n/g,'\n'),'#'+id+' não voltou ao original após desfazer'));
  const normRel=o=>JSON.stringify(Object.keys(o).filter(k=>o[k].length).sort().map(k=>[k,o[k]]));
  A(normRel(REL)===normRel(JSON.parse(REL0)),'relações após desfazer diferentes das iniciais: '+JSON.stringify(REL)+' x '+REL0);
  if(scenario==='A'){const c=cards();['32745','79','31059'].forEach(id=>{const b=c[id]&&(c[id].querySelector('.btn-add-rel-cr')||c[id].querySelector('.btn-add-rel'));A(b&&b.disabled&&/Relação já existe/.test(b.textContent),'#'+id+': botão de relação deveria estar "✓ Relação já existe" desabilitado');});}
  console.log('\n'+(fail.length?'❌ FALHOU ('+fail.length+'):\n  - '+fail.join('\n  - '):'✅ e2e #212039 cenário '+scenario+': TUDO OK'));
  process.exit(fail.length?1:0);})();
