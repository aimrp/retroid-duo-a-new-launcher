// 连接掌机后的回归：adb + WebView CDP，无第三方依赖。
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {setTimeout as wait} from 'node:timers/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const adb=path.join(root,'tools/toolchain/platform-tools/adb.exe');
const run=(...args)=>execFileSync(adb,args,{encoding:'utf8'}).trim();
const pid=run('shell','pidof','tech.foursee.duoime');
run('forward','tcp:9333',`localabstract:webview_devtools_remote_${pid}`);
const targets=await (await fetch('http://localhost:9333/json')).json();
const target=targets.find(x=>x.url.includes('home.html'));
const ws=new WebSocket(target.webSocketDebuggerUrl);
await new Promise(r=>ws.onopen=r);
let id=0; const pending=new Map();
ws.onmessage=e=>{const d=JSON.parse(e.data); if(pending.has(d.id)){pending.get(d.id)(d.result);pending.delete(d.id);}};
async function js(expression){const result=await new Promise(resolve=>{const n=++id;pending.set(n,resolve);ws.send(JSON.stringify({id:n,method:'Runtime.evaluate',params:{expression,returnByValue:true,awaitPromise:true}}));});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;}
const selected=()=>js('document.querySelector(".selected")?.dataset.pkg || null');
async function key(display,code){run('shell',`input -d ${display} keyevent ${code}`); await wait(180);}
async function axis(display,axis,value,hold=80){
  // 注入真实 Retroid 控制器的 evdev 轴；不是 JS 模拟。
  run('shell',`sendevent /dev/input/event8 3 ${axis} ${value}; sendevent /dev/input/event8 0 0 0`);
  await wait(hold);
  run('shell',`sendevent /dev/input/event8 3 ${axis} 0; sendevent /dev/input/event8 0 0 0`);
  await wait(180);
}
try {
  for(let i=0;i<40;i++){ if(await js('typeof render === "function"')) break; await wait(150); }
  await js('render()');
  const apps=await js('[...document.querySelectorAll(".cell[data-pkg]")].map(c=>c.dataset.pkg)');
  await key(0,'KEYCODE_DPAD_RIGHT'); assert.equal(await selected(),apps[1]);
  await key(0,'KEYCODE_DPAD_DOWN'); assert.equal(await selected(),apps[6]);
  await axis(0,0,32767); assert.equal(await selected(),apps[7]);
  await axis(0,1,-32767); assert.equal(await selected(),apps[2]);
  await axis(0,0,5000); assert.equal(await selected(),apps[2]); // 死区
  run('shell','input -d 2 tap 1260 930'); await wait(300);
  await axis(2,0,32767); assert.equal(await selected(),apps[3]);
  await key(2,'KEYCODE_DPAD_RIGHT'); assert.equal(await selected(),apps[4]);
  // 只给 WebView 注入临时图标，用真实控制器测两页 + 不满尾页。
  await js('layout(Array.from({length:17},(_,i)=>({pkg:"test."+i,label:"测试 "+i}))); homeNav.refresh()');
  await key(0,'KEYCODE_DPAD_UP');
  for(let i=0;i<5;i++) await axis(0,0,32767);
  assert.equal(await selected(),'test.10');
  assert.equal(await js('Math.round(pages.scrollLeft/pages.clientWidth)'),1);
  await key(0,'KEYCODE_DPAD_DOWN'); assert.equal(await selected(),'test.15');
  await axis(0,0,32767); assert.equal(await selected(),'test.16');
  await axis(0,0,32767); assert.equal(await selected(),'test.16');
  await axis(0,0,-32767); assert.equal(await selected(),'test.15');
  await axis(0,0,-32767); assert.equal(await selected(),'test.9');
  // 长按后归中必须停。
  await axis(0,0,-32767,750);
  const stopped=await selected(); await wait(550); assert.equal(await selected(),stopped);
  await js('render(); document.querySelectorAll(".cell[data-pkg]")[8].dispatchEvent(new PointerEvent("pointerdown",{bubbles:true})); homeNav.move("right"); homeNav.move("left")');
  assert.equal(await selected(),'com.android.settings');
  await key(2,'KEYCODE_BUTTON_A'); await wait(600);
  assert.match(run('shell','dumpsys','activity','activities'), /topResumedActivity=.*com.android.settings/);
  const background=await selected(); await key(2,'KEYCODE_DPAD_LEFT'); assert.equal(await selected(),background);
  run('shell','am','start','--display','0','-n','tech.foursee.duoime/.HomeActivity'); await wait(350);
  console.log('PASS: real DPAD, physical joystick X/Y, deadzone, bottom-focus forwarding, edge paging, partial last row, hold/release, A launches and no background desktop navigation');
} finally { await js('render()'); ws.close(); }
