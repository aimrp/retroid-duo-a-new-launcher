// 无外部依赖：覆盖所有尾页长度、双行导航、刷新和打开应用。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../web/home-nav.js'), 'utf8');
function setup(n) {
  let all, launched = [], listeners = {};
  const pages = {scrollLeft:0, clientWidth:1000, children:[],
    addEventListener(name, fn) { listeners[name] = fn; },
    scrollTo({left}) { this.scrollLeft = left; },
    querySelectorAll(sel) { return sel === '.selected' ? all.filter(c=>c.classList.contains('selected')) : all; }};
  function populate(count) {
    if(all) all.forEach(c=>c.isConnected=false);
    pages.children = Array.from({length:Math.ceil(count/10)}, ()=>({}));
    all = Array.from({length:count}, (_,i)=>{
      const classes = new Set();
      return {dataset:{pkg:'app'+i}, parentElement:pages.children[Math.floor(i/10)], isConnected:true,
        classList:{add:x=>classes.add(x), remove:x=>classes.delete(x), contains:x=>classes.has(x)}, setAttribute(){}};
    });
  }
  populate(n);
  const win = {DuoHome:{launch:p=>launched.push(p)}, addEventListener(){}};
  vm.runInNewContext(source, {window:win, document:{getElementById:()=>pages, addEventListener(){}}});
  const nav = win.homeNav;
  const selected = () => all.findIndex(c=>c.classList.contains('selected'));
  return {nav,pages,listeners,selected,launched,populate,all:()=>all};
}
let checks=0;
for(let n=1;n<=45;n++) {
  const t=setup(n); t.nav.refresh(); t.nav.open(); assert.equal(t.launched.at(-1),'app0');
  for(let i=0;i<n;i++) for(const dir of ['up','down','left','right']) {
    t.pages.scrollLeft=Math.floor(i/10)*1000;
    t.listeners.pointerdown({target:{closest:()=>t.all()[i]}});
    const p=Math.floor(i/10), row=Math.floor(i%10/5), col=i%5;
    let want=i;
    if(dir==='up' && row) want=i-5;
    if(dir==='down' && !row && i+5<n) want=i+5;
    if(dir==='left') {
      if(col) want=i-1;
      else if(p>0) want=(p-1)*10+row*5+4;
    }
    if(dir==='right') {
      if(col<4 && i+1<n) want=i+1;
      else if((p+1)*10<n) { const start=(p+1)*10; want=start+row*5<n?start+row*5:start; }
    }
    t.nav.move(dir); assert.equal(t.selected(),want,`n=${n}, i=${i}, dir=${dir}`);
    assert.equal(t.pages.scrollLeft,Math.floor(want/10)*1000);
    t.nav.open(); assert.equal(t.launched.at(-1),'app'+want); checks++;
  }
  t.populate(n); t.nav.refresh(); t.nav.open(); assert.ok(t.launched.at(-1));
}
console.log(`PASS: ${checks} directional cases (1–45 apps), page boundaries, empty slots, launch and refresh`);
