// 掌机 WebView 的真实 CDP 触屏手势测试，结束时恢复用户的原始顺序。
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import path from 'node:path';
const adb=path.resolve(import.meta.dirname,'../../tools/toolchain/platform-tools/adb.exe');
const run=(...args)=>execFileSync(adb,args,{encoding:'utf8'}).trim();
const pid=run('shell','pidof','tech.foursee.duoime');
run('forward','tcp:9333',`localabstract:webview_devtools_remote_${pid}`);
const target=(await (await fetch('http://localhost:9333/json')).json()).find(x=>x.url.includes('home.html'));
const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
let id=0; const pending=new Map();
ws.onmessage=e=>{const d=JSON.parse(e.data);if(pending.has(d.id)){const cb=pending.get(d.id);pending.delete(d.id);cb(d);}};
async function cdp(method,params={}){const d=await new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},5000);pending.set(n,x=>{clearTimeout(timer);resolve(x)});ws.send(JSON.stringify({id:n,method,params}));});if(d.error)throw Error(JSON.stringify(d.error));return d.result;}
async function js(expression){const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function point(index){return js(`(()=>{const r=document.querySelector('.cell[data-index="${index}"]').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);}
async function touch(type,p){
  // 将 WebView CSS 坐标映射为设备原始纵屏坐标，注入上屏触屏驱动。
  if(type==='touchEnd'){run('shell','sendevent /dev/input/event5 3 57 -1; sendevent /dev/input/event5 1 330 0; sendevent /dev/input/event5 0 0 0');return;}
  const dims=await js('({w:innerWidth,h:innerHeight})');
  const x=Math.round((1-p.y/dims.h)*1079), y=Math.round(p.x/dims.w*1919);
  const begin=type==='touchStart'?'sendevent /dev/input/event5 3 47 0; sendevent /dev/input/event5 3 57 42; sendevent /dev/input/event5 1 330 1; ':'';
  run('shell',`${begin}sendevent /dev/input/event5 3 53 ${x}; sendevent /dev/input/event5 3 54 ${y}; sendevent /dev/input/event5 3 58 50; sendevent /dev/input/event5 0 0 0`);
}
async function drag(from,to,hold=650){await touch('touchStart',from);await wait(hold);await touch('touchMove',to);await wait(150);await touch('touchEnd');await wait(200);}
for(let i=0;i<40;i++){if(await js('typeof homeOrder !== "undefined" && typeof render === "function"'))break;await wait(150);}
const original=await js('localStorage.getItem("duo.home.order.v1")');
try {
 await js('localStorage.removeItem("duo.home.order.v1"); render()');
 const before=await js('[...pages.querySelectorAll(".cell[data-pkg]")].map(x=>x.dataset.pkg)');
 const from=await point(0),to=await point(3);
 await drag(from,to);
 let now=await js('[...pages.querySelectorAll(".cell[data-pkg]")].map(x=>x.dataset.pkg)');
 assert.deepEqual(now,[...before.slice(1,4),before[0],...before.slice(4)]);
 await js('(()=>{setTimeout(()=>location.reload(),100);return true})()'); await wait(1200);
 for(let i=0;i<40;i++){if(await js('typeof render === "function"'))break;await wait(150);}
 assert.deepEqual(await js('[...pages.querySelectorAll(".cell[data-pkg]")].map(x=>x.dataset.pkg)'),now);
 // 临时模拟新增和卸载：不改变真实系统应用。
 assert.deepEqual(await js(`homeOrder.update(${JSON.stringify([{pkg:'new.app'},...before.slice(0,-1).map(pkg=>({pkg}))])}).map(x=>x.pkg)`),[...now.filter(x=>x!==before.at(-1)),'new.app']);
 assert.deepEqual(await js(`homeOrder.update(${JSON.stringify([{pkg:'newer.app'},{pkg:'new.app'},...before.slice(0,-1).map(pkg=>({pkg}))])}).map(x=>x.pkg)`),[...now.filter(x=>x!==before.at(-1)),'new.app','newer.app']);
 // 应用临时缺席期间调整其他图标，重装后仍保留原来的槽位。
 await js('localStorage.setItem("duo.home.order.v1", JSON.stringify(["fake.0","fake.1","fake.2"])); drawApps(homeOrder.update([{pkg:"fake.0",label:"A"},{pkg:"fake.2",label:"C"}]))');
 await drag(await point(1),await point(0));
 assert.deepEqual(await js('homeOrder.update([{pkg:"fake.0"},{pkg:"fake.1"},{pkg:"fake.2"}]).map(x=>x.pkg)'),['fake.2','fake.1','fake.0']);
 // 临时两页，测试拖到边缘翻页，再拖入尾页的空位。
 const fake=Array.from({length:17},(_,i)=>({pkg:'fake.'+i,label:'测试 '+i}));
 await js(`localStorage.removeItem("duo.home.order.v1"); drawApps(homeOrder.update(${JSON.stringify(fake)}))`);
 const start=await point(0), edge=await js('(()=>{let r=pages.getBoundingClientRect();return {x:r.right-5,y:r.top+r.height*.25}})()');
 await touch('touchStart',start); await wait(650); await touch('touchMove',edge); await wait(900);
 assert.equal(await js('Math.round(pages.scrollLeft/pages.clientWidth)'),1);
 const empty=await point(19); await touch('touchMove',empty); await wait(100); await touch('touchEnd'); await wait(200);
 assert.equal(await js('[...pages.querySelectorAll(".cell[data-pkg]")].at(-1).dataset.pkg'),'fake.0');
 // 空白位置开始横滑可翻回上一页。
 const blank=await point(19); await touch('touchStart',blank);await touch('touchMove',{x:blank.x+300,y:blank.y});await touch('touchEnd');await wait(250);
 assert.equal(await js('Math.round(pages.scrollLeft/pages.clientWidth)'),0);
 console.log('PASS: long press reorder, persistence after reload, app changes, edge paging, empty-slot drop and swipe');
} finally {
 await js(`(()=>{const v=${JSON.stringify(original)};if(v===null)localStorage.removeItem("duo.home.order.v1");else localStorage.setItem("duo.home.order.v1",v);render()})()`);
 ws.close();
}
