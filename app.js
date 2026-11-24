/* ===== app ===== */
const $=s=>document.querySelector(s);
const css=n=>getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmtN=new Intl.NumberFormat('en-IN',{maximumFractionDigits:1});
const fmt0=new Intl.NumberFormat('en-IN',{maximumFractionDigits:0});
const f=(n)=>fmtN.format(n), f0=n=>fmt0.format(Math.round(n));
const pc=n=>(n*100).toFixed(1)+'%';
const cr=n=>(n/1e7).toFixed(2);
const f2=n=>n.toFixed(2);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

const REPORT=window.REPORT||null;
let D=null, META=null;
let tab=(location.hash||'').slice(1); if(!['month','branch','rank','target'].includes(tab))tab='month';
const defKey=()=>tab==='target'?'target':tab==='rank'?'rank':'sales';
const F={};            // filters: dimKey -> Set of dim indices
const closedFY=new Set();
const sortSt={branch:{col:'ret',dir:-1},tbranch:{col:'tgt',dir:-1}};
const ui={mMetric:'ret',bMetric:'ret',bMode:'top',tMode:'bottom',q:'',tq:''};

/* ---- metric definitions ---- */
const SMET=[
 {k:'ret',l:'Retail',fn:f,tile:f},
 {k:'mga',l:'MGA DDL',fn:f0,chart:v=>cr(v)+' Cr',tile:v=>cr(v),unit:'Cr',tl:'MGA DDL'},
 {k:'mgaCar',l:'MGA / Car',fn:f0,tile:f0,tl:'MGA / Car'},
 {k:'vas',l:'VAS',fn:f0,tile:v=>cr(v),unit:'Cr',tl:'VAS'},
 {k:'vasCar',l:'VAS / Car',fn:f0,tile:f0,tl:'VAS / Car'},
 {k:'ew',l:'EW Nos',fn:f0,hideTile:1},
 {k:'ewP',l:'EW %',fn:pc,tile:pc,pct:1},
 {k:'ccp',l:'CCP Nos',fn:f0,hideTile:1},
 {k:'ccpP',l:'CCP %',fn:pc,tile:pc,pct:1},
 {k:'exc',l:'Exchange',fn:f0,hideTile:1},
 {k:'excP',l:'Exchange %',fn:pc,tile:pc,pct:1},
 {k:'arena',l:'ARENA Contribution',fn:pc,tile:pc,pct:1,mOnly:1},
];
const SMETm=Object.fromEntries(SMET.map(m=>[m.k,m]));
const cmpv=(m,v)=>m.chart?m.chart(v):m.fn(v);

/* ---- filter definitions ---- */
const FDEF={
 sales:[['gm','GM'],['fy','FY'],['per','Period'],['dlr','Dlr'],['ch','Channel'],['club','Branch club'],['model','Actual model'],['nexa','NEXA model']],
 target:[['gm','GM'],['fy','FY'],['mon','Month'],['dlr','Dlr'],['ch','Channel'],['branch','Branch']],
 rank:[['gm','GM'],['fy','FY'],['dlr','Dlr'],['ch','Channel']],
};
const HIER={dlr:['gm','ch'],club:['gm','dlr','ch'],branch:['gm','dlr','ch'],model:['nexa','ch']}; // child -> parent filters that narrow its list
function present(k){ // values of dim k that exist under the parent selections
  const t=tab==='target',rows=t?D.t:D.s,fm=t?TF:SF;if(!(k in fm))return null;
  const sets={};(HIER[k]||[]).forEach(d=>{sets[d]=F[d];});
  const pass=makePass(sets,fm),out=new Set(),c=fm[k];
  for(const r of rows)if(pass(r))out.add(r[c]);
  return out;
}
function optList(k){
  const av=present(k),sel=F[k]||new Set();
  const arr=D.dims[k].map((v,i)=>({i,l:k==='mon'?monLabel(v):v,raw:v})).filter(o=>!av||av.has(o.i)||sel.has(o.i));
  if(k==='mon'||k==='fy')arr.sort((a,b)=>a.raw<b.raw?-1:1); else arr.sort((a,b)=>String(a.l).localeCompare(String(b.l),'en',{numeric:true}));
  return arr;
}
function prune(changed){ // drop selections in other filters that no longer exist under the new selection
  const def=FDEF[defKey()];
  def.forEach(([k])=>{if(!HIER[k]||!HIER[k].includes(changed)||!F[k]||!F[k].size)return;const av=present(k);if(av)[...F[k]].forEach(i=>{if(!av.has(i))F[k].delete(i);});});
}
if(REPORT&&!REPORT.all){['sales','target','rank'].forEach(z=>{FDEF[z]=FDEF[z].filter(x=>x[0]!=='gm');});}
let openPop=null;
function renderFilters(){
  const def=FDEF[defKey()];
  const box=$('#filters');box.innerHTML='';
  def.forEach(([k,label])=>{
    const set=F[k]||(F[k]=new Set());const opts=optList(k);
    const w=document.createElement('div');w.className='fwrap';
    const b=document.createElement('button');b.className='fbtn'+(set.size?' on':'');b.setAttribute('aria-haspopup','true');
    const summ=!set.size?'All':set.size===1?String(opts.find(o=>set.has(o.i)).l):set.size+' selected';
    b.innerHTML='<span class="l">'+label+'</span><span class="v">'+esc(summ)+'</span><span aria-hidden="true">\u25BE</span>';
    w.appendChild(b);
    b.onclick=e=>{e.stopPropagation();const was=w.querySelector('.pop');closePop();if(!was)showPop(w,k,optList(k),set);};
    box.appendChild(w);
  });
  const any=def.some(([k])=>F[k]&&F[k].size);
  if(any){const r=document.createElement('button');r.className='btn ghost';r.textContent='Reset filters';r.onclick=()=>{def.forEach(([k])=>F[k].clear());renderAll();};box.appendChild(r);}
}
function showPop(w,k,opts,set){
  const p=document.createElement('div');p.className='pop';p.onclick=e=>e.stopPropagation();
  p.innerHTML=(opts.length>8?'<input type="search" placeholder="Search" aria-label="Search options">':'')+'<div class="acts"><button data-a="all">Select all</button><button data-a="none">Clear</button></div><div class="opts"></div>';
  const list=p.querySelector('.opts');
  const draw=(q='')=>{list.innerHTML='';opts.filter(o=>String(o.l).toLowerCase().includes(q)).forEach(o=>{
    const l=document.createElement('label');const c=document.createElement('input');c.type='checkbox';c.checked=set.has(o.i);
    c.onchange=()=>{c.checked?set.add(o.i):set.delete(o.i);prune(k);dirty=true;renderAll(true);};
    l.append(c,document.createTextNode(o.l));list.appendChild(l);});};
  draw();
  const s=p.querySelector('input[type=search]');if(s){s.oninput=()=>draw(s.value.toLowerCase());setTimeout(()=>s.focus(),0);}
  p.querySelector('[data-a=all]').onclick=()=>{opts.forEach(o=>set.add(o.i));prune(k);dirty=true;renderAll(true);draw(s?s.value.toLowerCase():'');};
  p.querySelector('[data-a=none]').onclick=()=>{set.clear();prune(k);dirty=true;renderAll(true);draw(s?s.value.toLowerCase():'');};
  w.appendChild(p);openPop=p;
}
let dirty=false;
function closePop(){if(openPop){openPop.remove();openPop=null;if(dirty){dirty=false;renderFilters();}}}
document.addEventListener('click',closePop);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closePop();});

/* ---- helpers ---- */
const fyIdxOrder=()=>D.dims.fy.map((v,i)=>({v,i})).sort((a,b)=>a.v<b.v?-1:1);
const monthKeyParts=k=>{const[y,m]=k.split('-');return{y:+y,m:+m-1};};
function visSets(){const o={};FDEF[defKey()].forEach(([k])=>{o[k]=F[k];});return o;}
function salesPass(){return makePass(visSets(),SF);} function targetPass(){return makePass(visSets(),TF);}
const noData=()=>'<div class="panel"><div class="empty">No rows match these filters.</div></div>';

/* ---- KPI strips ---- */
function renderKpis(){
  const k=$('#kpis');
  if(tab==='rank'){k.innerHTML='';return;}
  if(tab==='target'){
    const g=groupT(D.t,targetPass(),()=>0).get(0);
    if(!g){k.innerHTML='';return;}
    const d=deriveT(g);const months=new Set();D.t.forEach(r=>{if(targetPass()(r))months.add(r[1]);});
    const br=new Set();D.t.forEach(r=>{if(targetPass()(r))br.add(r[4]);});
    const cells=[['Target',f(d.tgt),''],['Achieved',f(d.ach),''],['Target achieved',pc(d.pct),''],['Avg DSEs / month',f0(d.dse/Math.max(months.size,1)),''],['Productivity',d.prod.toFixed(2),'cars / DSE'],['Branches',br.size,'']];
    k.innerHTML=cells.map(c=>'<div class="kpi"><div class="l">'+c[0]+'</div><div class="v">'+c[1]+(c[2]?'<small>'+c[2]+'</small>':'')+'</div></div>').join('');
    return;
  }
  const g=groupS(D.s,salesPass(),()=>0).get(0);
  if(!g){k.innerHTML='';return;}
  const d=deriveS(g);
  k.innerHTML=SMET.filter(m=>!m.hideTile&&(!m.mOnly||d.arena>0)).map(m=>'<div class="kpi"><div class="l">'+(m.tl||m.l)+'</div><div class="v">'+m.tile(d[m.k])+(m.unit?'<small>'+m.unit+'</small>':'')+'</div></div>').join('');
}

/* ---- MONTH WISE ---- */
function renderMonth(){
  const pass=salesPass();
  const byFYM=groupS(D.s,pass,r=>r[0]+'|'+monthKeyParts(D.dims.mon[r[1]]).m);
  const byFY=groupS(D.s,pass,r=>r[0]);
  const total=groupS(D.s,pass,()=>0).get(0);
  if(!total){$('#view').innerHTML=noData();return;}
  const cols=SMET;
  const rowCells=a=>{const d=deriveS(a);return cols.map(m=>'<td class="n">'+m.fn(d[m.k])+'</td>').join('');};
  let tb='';
  for(const{v,i}of fyIdxOrder()){
    const a=byFY.get(i);if(!a)continue;
    const closed=closedFY.has(i);
    tb+='<tr class="fy'+(closed?' closed':'')+'" data-fy="'+i+'"><td>'+v+'</td>'+rowCells(a)+'</tr>';
    if(!closed)FISCAL.forEach(m=>{const x=byFYM.get(i+'|'+m);if(x)tb+='<tr class="mo"><td>'+MN[m]+'</td>'+rowCells(x)+'</tr>';});
  }
  const showAr=true;
  $('#view').innerHTML=
    '<div class="panel"><div class="ph"><h3>Month wise summary</h3><span class="sub">Click a financial year to collapse or expand its months</span></div><div class="tw"><table><thead><tr><th>Month</th>'+cols.map(m=>'<th class="n">'+m.l+'</th>').join('')+'</tr></thead><tbody>'+tb+'</tbody><tfoot><tr><td>Grand total</td>'+rowCells(total)+'</tr></tfoot></table></div></div>';
  $('#view').querySelectorAll('tr.fy').forEach(tr=>tr.onclick=()=>{const i=+tr.dataset.fy;closedFY.has(i)?closedFY.delete(i):closedFY.add(i);renderMonth();});
}
/* ---- BRANCH WISE ---- */
function renderBranch(){
  const pass=salesPass();
  const g=groupS(D.s,pass,r=>r[6]);const total=groupS(D.s,pass,()=>0).get(0);
  if(!total){$('#view').innerHTML=noData();return;}
  const cols=SMET.filter(m=>!m.mOnly);
  $('#view').innerHTML=
    '<div class="panel"><div class="ph"><h3>Branch wise summary</h3><div class="ctl"><span class="sub" id="bcount"></span><input class="search" id="bq" type="search" placeholder="Search branch" aria-label="Search branch" value="'+esc(ui.q)+'"></div></div><div class="tw"><table id="btab"></table></div></div>';
  $('#bq').oninput=e=>{ui.q=e.target.value;drawBranchTable();};
  drawBranchTable();
}
function drawBranchTable(){
  const pass=salesPass();const g=groupS(D.s,pass,r=>r[6]);const total=deriveS(groupS(D.s,pass,()=>0).get(0));
  const cols=SMET.filter(m=>!m.mOnly);const st=sortSt.branch;
  let rows=[...g.entries()].map(([k,a])=>({name:D.dims.club[k],d:deriveS(a)}));
  const q=ui.q.trim().toLowerCase();if(q)rows=rows.filter(r=>r.name.toLowerCase().includes(q));
  rows.sort((a,b)=>st.col==='name'?st.dir*a.name.localeCompare(b.name,'en',{numeric:true}):st.dir*(a.d[st.col]-b.d[st.col]));
  const maxRet=Math.max(...rows.map(r=>r.d.ret),1);
  $('#bcount').textContent=rows.length+' branches';
  const th=(k,l,n)=>'<th class="sortable'+(n?' n':'')+'" data-c="'+k+'" aria-sort="'+(st.col===k?(st.dir>0?'ascending':'descending'):'none')+'">'+l+(st.col===k?'<span class="ar">'+(st.dir>0?'\u25B2':'\u25BC')+'</span>':'')+'</th>';
  $('#btab').innerHTML='<thead><tr>'+th('name','Branch',0)+cols.map(m=>th(m.k,m.l,1)).join('')+'</tr></thead><tbody>'+
   rows.map(r=>'<tr><td>'+esc(r.name)+'</td>'+cols.map(m=>'<td class="n'+(m.k==='ret'?' bar" style="--w:'+(r.d.ret/maxRet).toFixed(3):'')+'">'+m.fn(r.d[m.k])+'</td>').join('')+'</tr>').join('')+
   '</tbody><tfoot><tr><td>Grand total</td>'+cols.map(m=>'<td class="n">'+m.fn(total[m.k])+'</td>').join('')+'</tr></tfoot>';
  $('#btab').querySelectorAll('th.sortable').forEach(h=>h.onclick=()=>{const c=h.dataset.c;st.dir=st.col===c?-st.dir:(c==='name'?1:-1);st.col=c;drawBranchTable();});
}

/* ---- BRANCH RANKING ---- */
const RK=[
 {k:'ret',l:'Total retail',fn:f},{k:'pct',l:'Target achieved',fn:pc},{k:'mgaCar',l:'MGA per car',fn:f0},
 {k:'vasCar',l:'VAS per car',fn:f0},{k:'ewP',l:'EW %',fn:pc},{k:'ccpP',l:'CCP %',fn:pc}];
ui.minRet=20;ui.topN=10;
function rankData(){
  const S=groupS(D.s,salesPass(),r=>r[SF.club]),T=groupT(D.t,targetPass(),r=>r[TF.branch]);
  const nk=x=>String(x).trim().toLowerCase(),tmap=new Map();
  for(const[k,a]of T)tmap.set(nk(D.dims.branch[k]),a);
  const rows=[];
  for(const[k,a]of S){const name=D.dims.club[k],d=deriveS(a);if(d.ret<ui.minRet||d.ret<=0)continue;
    const ta=tmap.get(nk(name));if(!ta||ta[0]<=0)continue;
    rows.push({name,ret:d.ret,pct:deriveT(ta).pct,mgaCar:d.mgaCar,vasCar:d.vasCar,ewP:d.ewP,ccpP:d.ccpP});}
  RK.forEach(m=>{rows.forEach(r=>{r['rk_'+m.k]=1+rows.filter(o=>o[m.k]>r[m.k]).length;});});
  rows.forEach(r=>{r.avg=RK.reduce((a,m)=>a+r['rk_'+m.k],0)/RK.length;});
  return rows;
}
function renderRank(){
  $('#view').innerHTML=
  '<div class="panel"><div class="ph"><h3>Overall branch ranking</h3><div class="ctl"><label class="sub" for="topN">Show top</label><input class="search" style="width:64px" id="topN" type="number" min="1" max="200" step="1" value="'+ui.topN+'"><label class="sub" for="minRet">Minimum retail cars</label><input class="search" style="width:80px" id="minRet" type="number" min="0" step="5" value="'+ui.minRet+'"><span class="sub" id="rkN"></span></div></div>'+
  '<div class="legend-note" style="padding:6px 14px 0">Overall rank = average of the branch\'s rank in the six parameters (equal weight). A lower average rank is better. Only branches with sales and a target in the selected period are ranked.</div>'+
  '<div class="tw" id="rkOverall" style="max-height:none"></div></div>'+
  '<div class="grid3" id="rkGrid" style="margin-top:16px"></div>';
  $('#topN').oninput=e=>{ui.topN=Math.min(200,Math.max(1,Math.floor(+e.target.value)||1));clearTimeout(ui.rt);ui.rt=setTimeout(drawRank,250);};
  $('#minRet').oninput=e=>{ui.minRet=Math.max(0,+e.target.value||0);clearTimeout(ui.rt);ui.rt=setTimeout(drawRank,250);};
  drawRank();
}
function drawRank(){
  const rows=rankData();$('#rkN').textContent=rows.length+' branches ranked';
  if(!rows.length){$('#rkOverall').innerHTML='<div class="empty">No branches match these filters.</div>';$('#rkGrid').innerHTML='';return;}
  const cell=(r,m)=>'<td class="n">'+m.fn(r[m.k])+'<span class="rk'+(r['rk_'+m.k]<=ui.topN?' hi':'')+'">#'+r['rk_'+m.k]+'</span></td>';
  const ov=rows.slice().sort((a,b)=>a.avg-b.avg||b.ret-a.ret).slice(0,ui.topN);
  $('#rkOverall').innerHTML='<table><thead><tr><th class="n" style="text-align:left">Rank</th><th class="l">Branch</th><th class="n">Avg rank</th>'+RK.map(m=>'<th class="n">'+m.l+'</th>').join('')+'</tr></thead><tbody>'+
    ov.map((r,i)=>'<tr><td class="n" style="text-align:left"><b>'+(i+1)+'</b></td><td class="l">'+esc(r.name)+'</td><td class="n"><b>'+r.avg.toFixed(1)+'</b></td>'+RK.map(m=>cell(r,m)).join('')+'</tr>').join('')+'</tbody></table>';
  $('#rkGrid').innerHTML=RK.map(m=>{
    const top=rows.slice().sort((a,b)=>b[m.k]-a[m.k]||b.ret-a.ret).slice(0,ui.topN);const mx=Math.max(...top.map(r=>r[m.k]),1e-9);
    return '<div class="panel"><div class="ph"><h3>Top '+Math.min(ui.topN,rows.length)+': '+m.l+'</h3></div><div class="tw" style="max-height:none"><table><thead><tr><th class="n" style="text-align:left">#</th><th class="l">Branch</th><th class="n">'+m.l+'</th></tr></thead><tbody>'+
     top.map((r,i)=>'<tr><td class="n" style="text-align:left">'+(i+1)+'</td><td class="l">'+esc(r.name)+'</td><td class="n bar" style="--w:'+(r[m.k]/mx).toFixed(3)+'">'+m.fn(r[m.k])+'</td></tr>').join('')+'</tbody></table></div></div>';}).join('');
}

/* ---- TARGET ---- */
const band=p=>p>=.9?'good':p>=.75?'warn':'bad';
function renderTarget(){
  const pass=targetPass();
  const total=groupT(D.t,pass,()=>0).get(0);
  if(!total){$('#view').innerHTML=noData();return;}
  const byFY=groupT(D.t,pass,r=>r[0]);
  const byFYM=groupT(D.t,pass,r=>r[0]+'|'+monthKeyParts(D.dims.mon[r[1]]).m);
  const cell=(d)=>'<td class="n">'+f(d.tgt)+'</td><td class="n">'+f(d.ach)+'</td><td class="n"><span class="tag '+band(d.pct)+'">'+pc(d.pct)+'</span></td><td class="n">'+f0(d.dse)+'</td><td class="n">'+d.prod.toFixed(2)+'</td>';
  let tb='';
  for(const{v,i}of fyIdxOrder()){const a=byFY.get(i);if(!a)continue;const closed=closedFY.has(i);
    tb+='<tr class="fy'+(closed?' closed':'')+'" data-fy="'+i+'"><td>'+v+'</td>'+cell(deriveT(a))+'</tr>';
    if(!closed)FISCAL.forEach(m=>{const x=byFYM.get(i+'|'+m);if(x)tb+='<tr class="mo"><td>'+MN[m]+'</td>'+cell(deriveT(x))+'</tr>';});}
  $('#view').innerHTML=
    '<div class="grid2" style="grid-template-columns:minmax(0,5fr) minmax(0,6fr)">'+
   '<div class="panel"><div class="ph"><h3>Month wise</h3><span class="sub">Click a year to collapse</span></div><div class="tw"><table><thead><tr><th>Month</th><th class="n">Target</th><th class="n">Achieved</th><th class="n">Tgt ach %</th><th class="n">DSE count</th><th class="n">Productivity</th></tr></thead><tbody>'+tb+'</tbody><tfoot><tr><td>Grand total</td>'+cell(deriveT(total))+'</tr></tfoot></table></div><div class="legend-note"><span><span class="tag good">90%+</span> on track</span><span><span class="tag warn">75-90%</span> watch</span><span><span class="tag bad">below 75%</span> behind</span></div></div>'+
   '<div class="panel"><div class="ph"><h3>Branch wise</h3><div class="ctl"><span class="sub" id="tcount"></span><input class="search" id="tq" type="search" placeholder="Search branch" aria-label="Search branch" value="'+esc(ui.tq)+'"></div></div><div class="tw"><table id="ttab"></table></div><div class="legend-note"><span>DSE count here is the average per record. Productivity is retail per DSE.</span></div></div>'+
  '</div>';
  $('#view').querySelectorAll('tr.fy').forEach(tr=>tr.onclick=()=>{const i=+tr.dataset.fy;closedFY.has(i)?closedFY.delete(i):closedFY.add(i);renderTarget();});
  $('#tq').oninput=e=>{ui.tq=e.target.value;drawTBranch();};
  drawTBranch();
}
function drawTBranch(){
  const pass=targetPass();const g=groupT(D.t,pass,r=>r[4]);const st=sortSt.tbranch;
  let rows=[...g.entries()].map(([k,a])=>({name:D.dims.branch[k],d:deriveT(a)}));
  const q=ui.tq.trim().toLowerCase();if(q)rows=rows.filter(r=>r.name.toLowerCase().includes(q));
  rows.sort((a,b)=>st.col==='name'?st.dir*a.name.localeCompare(b.name,'en',{numeric:true}):st.dir*(a.d[st.col]-b.d[st.col]));
  $('#tcount').textContent=rows.length+' branches';
  const total=deriveT(groupT(D.t,pass,()=>0).get(0));
  const H=[['name','Branch',0],['tgt','Target',1],['ach','Achieved',1],['pct','Tgt ach %',1],['avgDse','DSE count',1],['prod','Productivity',1]];
  const th=([k,l,n])=>'<th class="sortable'+(n?' n':'')+'" data-c="'+k+'" aria-sort="'+(st.col===k?(st.dir>0?'ascending':'descending'):'none')+'">'+l+(st.col===k?'<span class="ar">'+(st.dir>0?'\u25B2':'\u25BC')+'</span>':'')+'</th>';
  const cell=d=>'<td class="n">'+f(d.tgt)+'</td><td class="n">'+f(d.ach)+'</td><td class="n"><span class="tag '+band(d.pct)+'">'+pc(d.pct)+'</span></td><td class="n">'+d.avgDse.toFixed(1)+'</td><td class="n">'+d.prod.toFixed(2)+'</td>';
  $('#ttab').innerHTML='<thead><tr>'+H.map(th).join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.name)+'</td>'+cell(r.d)+'</tr>').join('')+'</tbody><tfoot><tr><td>Grand total</td>'+cell(total)+'</tr></tfoot>';
  $('#ttab').querySelectorAll('th.sortable').forEach(h=>h.onclick=()=>{const c=h.dataset.c;st.dir=st.col===c?-st.dir:(c==='name'?1:-1);st.col=c;drawTBranch();});
}
/* ---- orchestration ---- */
function renderAll(keepPop){
  const pop=keepPop&&openPop;
  if(!pop)closePop();
  document.querySelectorAll('.tab').forEach(t=>t.setAttribute('aria-selected',t.dataset.tab===tab));
  if(!pop)renderFilters(); else{ /* update button summaries without closing popup */ refreshFilterLabels(); }
  renderKpis();
  if(tab==='month')renderMonth();else if(tab==='branch')renderBranch();else if(tab==='rank')renderRank();else renderTarget();
}
function refreshFilterLabels(){
  const def=FDEF[defKey()];
  document.querySelectorAll('#filters .fwrap').forEach((w,idx)=>{const[k]=def[idx];const set=F[k];const opts=optList(k);const b=w.querySelector('.fbtn');
    b.className='fbtn'+(set.size?' on':'');
    b.querySelector('.v').textContent=!set.size?'All':set.size===1?String(opts.find(o=>set.has(o.i)).l):set.size+' selected';});
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{tab=t.dataset.tab;history.replaceState(null,'','#'+tab);renderAll();});
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(['month','branch','rank','target'].includes(h)&&h!==tab){tab=h;renderAll();}});

/* ---- status bar ---- */
function latestMonth(){let m='';D.s.forEach(r=>{const k=D.dims.mon[r[1]];if(k>m)m=k;});return m?monLabel(m):'-';}
function renderStatus(){
  if(REPORT){$('#status').innerHTML='<span class="pill"><i></i>'+(REPORT.all?'Dashboard snapshot':'GM report')+'</span><span><b>'+esc(REPORT.gm)+'</b></span><span>Sales through <b>'+latestMonth()+'</b></span><span>Prepared '+esc(REPORT.at)+'</span>';return;}
  const custom=META&&META.custom;
  $('#status').innerHTML='<span class="pill'+(custom?' custom':'')+'"><i></i>'+(custom?'Uploaded data':'Original data')+'</span>'+
   '<span><b>'+esc(META.name)+'</b>'+(custom&&META.at?' \u00B7 loaded '+esc(META.at):'')+'</span>'+
   '<span>Sales through <b>'+latestMonth()+'</b></span><span><b>'+fmt0.format(D.counts.sales)+'</b> sale rows \u00B7 <b>'+fmt0.format(D.counts.target)+'</b> target rows</span>';
  $('#resetBtn').hidden=!custom;
}

/* ---- persistence (this browser only) ---- */
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('gm-dashboard',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function idbGet(k){try{const db=await idb();return await new Promise((res,rej)=>{const q=db.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);});}catch(e){return null;}}
async function idbSet(k,v){try{const db=await idb();await new Promise((res,rej)=>{const t=db.transaction('kv','readwrite');v===undefined?t.objectStore('kv').delete(k):t.objectStore('kv').put(v,k);t.oncomplete=res;t.onerror=()=>rej(t.error);});return true;}catch(e){return false;}}

/* ---- upload ---- */
const upMsg=(t,c='')=>{const m=$('#upMsg');m.className='upmsg '+c;m.innerHTML=c===''&&t?'<span class="spin"></span>'+t:t;};
const tick=()=>new Promise(r=>setTimeout(r,30));
async function handleFile(file){
  if(!file)return;
  try{
    if(typeof XLSX==='undefined')throw new Error('The Excel reader (vendor/xlsx.full.min.js) did not load. Make sure the vendor folder was uploaded to GitHub, then redeploy.');
    upMsg('Reading '+esc(file.name)+'...');await tick();
    const buf=await file.arrayBuffer();
    const names=XLSX.read(buf,{type:'array',bookSheets:true}).SheetNames;
    const pick=re=>names.find(n=>re.test(n.trim().toLowerCase()));
    const sN=pick(/^sale\s*register$/)||pick(/sale/),tN=pick(/^target$/)||names.find(n=>/target/i.test(n)&&!/achiev/i.test(n));
    if(!sN||!tN)throw new Error('Could not find the sheets "Sale Register" and "Target". Sheets in this file: '+names.join(', '));
    upMsg('Parsing sheets (this can take a while for large files)...');await tick();
    const wb=XLSX.read(buf,{type:'array',sheets:[sN,tN],cellFormula:false,cellHTML:false,cellStyles:false,cellNF:false,cellText:false});
    const toMx=n=>XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,raw:true,defval:null});
    upMsg('Calculating pivots...');await tick();
    const sr=matrixToRows(toMx(sN),SALES_MUST);
    if(!sr)throw new Error('The "'+sN+'" sheet needs these headers: FY, Mmm-Yy, Branch Club, Retail Count, Per Car (plus the other columns of your current file).');
    const tg=matrixToRows(toMx(tN),TARGET_MUST);
    if(!tg)throw new Error('The "'+tN+'" sheet needs these headers: Branch, Target, Achieved, MMM-YY, FY.');
    const ds=buildDataset(sr,tg);
    if(!ds.counts.sales)throw new Error('No usable rows found in "'+sN+'". Check that FY and Mmm-Yy are filled in.');
    const meta={name:file.name,custom:true,at:new Date().toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})};
    D=ds;META=meta;resetFilters();
    const saved=await idbSet('dataset',{ds,meta});
    renderStatus();renderAll();
    upMsg('Done. '+fmt0.format(ds.counts.sales)+' sale rows and '+fmt0.format(ds.counts.target)+' target rows loaded'+(saved?' and saved in this browser.':'. Could not save in this browser, so it will reset on reload.'),'ok');
  }catch(e){console.error(e);upMsg(esc(e.message||String(e)),'err');}
}
function resetFilters(){DIMS.forEach(k=>F[k]=new Set());}
$('#upBtn').onclick=()=>{const p=$('#upPanel');p.hidden=!p.hidden;$('#upBtn').setAttribute('aria-expanded',!p.hidden);};
$('#file').onchange=e=>{handleFile(e.target.files[0]);e.target.value='';};
const dz=$('#drop');
['dragenter','dragover'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');}));
['dragleave','drop'].forEach(ev=>dz.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');}));
dz.addEventListener('drop',e=>handleFile(e.dataTransfer.files[0]));
$('#resetBtn').onclick=async()=>{await idbSet('dataset',undefined);D=EMBED;META=EMBED_META;resetFilters();renderStatus();renderAll();upMsg('Original data restored.','ok');};


/* ---- GM report download: one self-contained HTML file per GM ---- */
function subsetDataset(ds,gi){
  const sRows=ds.s.filter(r=>r[SF.gm]===gi),tRows=ds.t.filter(r=>r[TF.gm]===gi);
  const used={};DIMS.forEach(d=>used[d]=new Set());
  sRows.forEach(r=>{for(const k in SF)used[k].add(r[SF[k]]);});
  tRows.forEach(r=>{for(const k in TF)used[k].add(r[TF[k]]);});
  const map={},dims={};
  DIMS.forEach(d=>{map[d]=new Map();dims[d]=[];ds.dims[d].forEach((v,i)=>{if(used[d].has(i)){map[d].set(i,dims[d].length);dims[d].push(v);}});});
  const remap=(rows,F)=>rows.map(r=>{const o=r.slice();for(const k in F)o[F[k]]=map[k].get(r[F[k]]);return o;});
  return{v:2,dims,s:remap(sRows,SF),t:remap(tRows,TF),counts:{sales:sRows.length,target:tRows.length}};
}
async function buildReport(gi){
  const name=gi==null?'All GMs':D.dims.gm[gi];
  const get=u=>fetch(u).then(r=>{if(!r.ok)throw new Error(u);return r.text();});
  let html,core,app;
  if(window.__SRC){({html,core,app}=window.__SRC);}
  else try{[html,core,app]=await Promise.all([get('index.html'),get('core.js'),get('app.js')]);}
  catch(e){throw new Error('Open the dashboard from its web address to download reports.');}
  const rep=gi==null?D:subsetDataset(D,gi);
  const at=new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
  const safe=x=>x.replace(/<\/script/gi,'<\\/script');
  const inline='<script>window.REPORT='+safe(JSON.stringify({gm:name,at,all:gi==null}))+';<\/script>\n<script>'+safe(core)+'<\/script>\n<script>const EMBED='+safe(JSON.stringify(rep))+';const EMBED_META={name:'+safe(JSON.stringify((gi==null?'Dashboard - ':'GM report - ')+name))+',custom:false};<\/script>\n<script>'+safe(app)+'<\/script>\n';
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+(gi==null?'GM':esc(name))+' Sales Dashboard</title>').replace(/<script[\s\S]*<\/body>|<\/body>/,()=>inline+'</body>');
  const lm=(()=>{let m='';rep.s.forEach(r=>{const k=rep.dims.mon[r[SF.mon]];if(k>m)m=k;});return m?monLabel(m):'';})();
  return{html,file:'Dashboard_'+name.replace(/[^A-Za-z0-9]+/g,'_')+(lm?'_'+lm:'')+'.html'};
}
function saveFile(name,html){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
function gmList(){return D.dims.gm.map((v,i)=>({v,i})).filter(x=>x.v!=='(unassigned)'&&D.s.some(r=>r[SF.gm]===x.i)).sort((a,b)=>a.v.localeCompare(b.v));}
$('#dlBtn').onclick=e=>{
  e.stopPropagation();const w=$('#dlWrap');const was=w.querySelector('.pop');closePop();if(was)return;
  const p=document.createElement('div');p.className='pop';p.style.left='auto';p.style.right='0';p.onclick=ev=>ev.stopPropagation();
  p.innerHTML='<div class="sub" style="padding:2px 6px;color:var(--ink3);font-size:12px">Files open on their own, no upload needed</div><div class="opts"></div><div class="upmsg" id="dlMsg" role="status"></div>';
  const list=p.querySelector('.opts');const msg=p.querySelector('#dlMsg');
  const one=async g=>{try{msg.className='upmsg';msg.textContent='Preparing '+g.v+'...';const r=await buildReport(g.i);saveFile(r.file,r.html);msg.className='upmsg ok';msg.textContent='Downloaded '+r.file;}catch(err){msg.className='upmsg err';msg.textContent=err.message;}};
  const full=document.createElement('button');full.className='btn primary';full.style.cssText='margin:3px 0 8px;width:100%;justify-content:space-between';full.innerHTML='<span>Full dashboard (all GMs)</span><span aria-hidden="true">\u2193</span>';full.onclick=()=>one({v:'All GMs',i:null});list.appendChild(full);
  const lbl=document.createElement('div');lbl.className='sub';lbl.style.cssText='padding:2px 6px;color:var(--ink3);font-size:12px';lbl.textContent='Or one GM only';list.appendChild(lbl);
  gmList().forEach(g=>{const b=document.createElement('button');b.className='btn';b.style.cssText='margin:3px 0;justify-content:space-between;width:100%';b.innerHTML='<span>'+esc(g.v)+'</span><span aria-hidden="true">↓</span>';b.onclick=()=>one(g);list.appendChild(b);});
  const all=document.createElement('button');all.className='btn primary';all.style.cssText='margin-top:6px;width:100%;justify-content:center';all.textContent='Download all 3 GM reports';
  all.onclick=async()=>{for(const g of gmList()){await one(g);await new Promise(r=>setTimeout(r,700));}};list.appendChild(all);
  w.appendChild(p);openPop=p;
};

/* ---- boot ---- */
(async function boot(){
  D=EMBED;META=EMBED_META;resetFilters();
  if(REPORT){$('#upBtn').hidden=true;$('#upPanel').remove();$('#dlWrap').hidden=true;}
  else{const s=await idbGet('dataset');
  if(s&&s.ds&&s.ds.v===2&&s.meta){D=s.ds;META=s.meta;}}
  renderStatus();renderAll();
})();
