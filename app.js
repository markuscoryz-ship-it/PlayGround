(() => {
  const canvas = document.getElementById('worldCanvas');
  const ctx = canvas.getContext('2d');
  const W = 96, H = 64, SZ = 8;
  const grid = new Array(W * H).fill('water');
  const forest = new Set(), scorch = new Set(), wet = new Set();
  const settlements = [], people = [], animals = [], particles = [];
  const history = Array(25).fill(1);
  let selectedTool = 'land', brush = 3, playing = false, speed = 1, day = 1, zoom = 1;
  let isDrawing = false, lastPaint = 0, hintTimer, toastTimer, population = 0, lifeType = 'human';
  let pointer = {x:-1,y:-1}, seed = 73421, rainTicks = 0, lightningAt = null;
  const $ = id => document.getElementById(id);
  const hash = (x,y) => { let n = (x*374761393 + y*668265263 + seed*1442695041)|0; n=(n^(n>>>13))*1274126177; return ((n^(n>>>16))>>>0)/4294967295; };
  const idx = (x,y) => y*W+x;
  const inside = (x,y) => x>=0&&y>=0&&x<W&&y<H;
  const terrainAt = (x,y) => inside(x,y) ? grid[idx(x,y)] : 'water';
  const rnd = (n=1) => Math.random()*n;

  function generateWorld(){
    seed = Math.floor(Math.random()*999999)+1;
    grid.fill('water'); forest.clear(); scorch.clear(); wet.clear(); settlements.length=0; people.length=0; animals.length=0;
    // Two softly irregular islands, with shallows, beaches and one tiny offshore islet.
    for(let y=0;y<H;y++) for(let x=0;x<W;x++){
      const nx=(x-47)/34, ny=(y-32)/25;
      const broad=Math.sqrt(nx*nx+ny*ny);
      const coastNoise=(hash(Math.floor(x/4),Math.floor(y/4))-.5)*.24+(hash(x,y)-.5)*.08;
      const west=Math.sqrt(((x-21)/12)**2+((y-39)/9)**2);
      const east=Math.sqrt(((x-76)/7)**2+((y-18)/6)**2);
      let h=1.02-broad+coastNoise;
      if(h>.11) grid[idx(x,y)] = h>.58 ? 'high' : h>.27 ? 'land' : 'sand';
      if(west<.96+coastNoise) grid[idx(x,y)]='land';
      if(east<.9+coastNoise) grid[idx(x,y)]='land';
      if(grid[idx(x,y)]==='land' && hash(x+33,y+91)>.78 && (x>30&&x<65&&y>16&&y<48)) forest.add(idx(x,y));
    }
    // Bring a small, peaceful settlement to life at the heart of the island.
    const home=nearestLand(48,34);
    settlements.push({x:home.x,y:home.y,name:'Mossvale',color:'#bc8a62',age:1,pop:8});
    for(let i=0;i<8;i++){const p=findNearbyLand(home.x+(rnd(13)-6),home.y+(rnd(11)-5)); people.push({x:p.x+(rnd()-.5)*.5,y:p.y+(rnd()-.5)*.5,skin:i%3===0?'#dca77c':i%3===1?'#bd825e':'#edc39a',shirt:['#b97d5b','#6c8c69','#e2c77f','#829ba0'][i%4],wander:rnd(6)});}
    for(let i=0;i<5;i++){const p=findNearbyLand(35+rnd(28),22+rnd(24));animals.push({x:p.x,y:p.y,kind:i<3?'deer':'rabbit',dir:rnd(6)});}
    day=1; population=8; playing=false; updateUi(); draw(); toast('Welcome to the Green Reach');
  }
  function nearestLand(x,y){let best={x:48,y:32},d=Infinity;for(let yy=0;yy<H;yy++)for(let xx=0;xx<W;xx++)if(grid[idx(xx,yy)]!=='water'&&grid[idx(xx,yy)]!=='sand'){const q=(xx-x)**2+(yy-y)**2;if(q<d){d=q;best={x:xx,y:yy}}}return best;}
  function findNearbyLand(x,y){for(let i=0;i<25;i++){let xx=Math.max(1,Math.min(W-2,Math.round(x+rnd(9)-4))),yy=Math.max(1,Math.min(H-2,Math.round(y+rnd(9)-4)));if(terrainAt(xx,yy)!=='water'&&terrainAt(xx,yy)!=='sand')return{x:xx,y:yy}}return nearestLand(x,y);}
  function toast(text){$('toastText').textContent=text;$('eventToast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('eventToast').classList.remove('show'),2100);}

  function resize(){const box=canvas.parentElement.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.round(box.width*dpr));canvas.height=Math.max(1,Math.round(box.height*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);draw();}
  function draw(){
    if(!canvas.width||!canvas.height)return;
    const dpr=Math.min(window.devicePixelRatio||1,2), cw=canvas.width/dpr,ch=canvas.height/dpr;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cw,ch);
    // A soft sage sea with hand-drawn little current lines.
    const sea=ctx.createLinearGradient(0,0,cw,ch);sea.addColorStop(0,'#a9c5b7');sea.addColorStop(.55,'#9bbab0');sea.addColorStop(1,'#aac3b2');ctx.fillStyle=sea;ctx.fillRect(0,0,cw,ch);
    const cell=Math.min(cw/W,ch/H)*zoom, mapW=W*cell,mapH=H*cell, ox=(cw-mapW)/2,oy=(ch-mapH)/2;
    ctx.save();ctx.beginPath();ctx.rect(0,0,cw,ch);ctx.clip();ctx.translate(ox,oy);
    // waves outside the islands
    for(let i=0;i<145;i++){const x=hash(i,8)*W,y=hash(i,19)*H;if(terrainAt(Math.floor(x),Math.floor(y))!=='water')continue;ctx.strokeStyle=i%3===0?'#e0e9d45a':'#739f9955';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(x*cell,y*cell);ctx.quadraticCurveTo((x+.7)*cell,(y-.18)*cell,(x+1.5)*cell,y*cell);ctx.stroke();}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const t=grid[idx(x,y)],px=x*cell,py=y*cell,r=hash(x,y);
      if(t==='water')continue;
      const nearWater=terrainAt(x+1,y)==='water'||terrainAt(x-1,y)==='water'||terrainAt(x,y+1)==='water'||terrainAt(x,y-1)==='water';
      let color;
      if(t==='sand'||nearWater) color=['#d9c99c','#dfd0a6','#d5c695'][Math.floor(r*3)];
      else if(t==='high') color=['#819c70','#8ba779','#79966d'][Math.floor(r*3)];
      else color=['#a1bb83','#a9c58d','#9db77e','#abc48b'][Math.floor(r*4)];
      if(scorch.has(idx(x,y)))color='#776d57';
      ctx.fillStyle=color;ctx.fillRect(px,py,cell+.25,cell+.25);
      // fine flecks add a quiet, tactile map texture
      if(cell>4&&r>.56){ctx.fillStyle=t==='sand'?'#f0dfb966':t==='high'?'#c2d19855':'#d6dfa955';ctx.fillRect(px+cell*.22,py+cell*.3,Math.max(1,cell*.12),Math.max(1,cell*.12));}
      if(forest.has(idx(x,y))&&t!=='sand'&&!scorch.has(idx(x,y))) drawTree(px,py,cell,r);
      if(t==='high'&&r>.74){ctx.fillStyle='#ced6a6';ctx.fillRect(px+cell*.2,py+cell*.15,cell*.3,cell*.13);}
    }
    // soft little shadows under buildings and inhabitants
    settlements.forEach((s,si)=>drawSettlement(s,cell,si));
    animals.forEach(a=>drawAnimal(a,cell));
    people.forEach((p,i)=>drawPerson(p,cell,i));
    if(lightningAt){ctx.strokeStyle='#fff5bf';ctx.lineWidth=Math.max(1,cell*.16);ctx.beginPath();ctx.moveTo(lightningAt.x*cell,lightningAt.y*cell-cell*2);ctx.lineTo((lightningAt.x-.5)*cell,(lightningAt.y-.3)*cell);ctx.lineTo((lightningAt.x+.15)*cell,lightningAt.y*cell);ctx.lineTo((lightningAt.x-.25)*cell,(lightningAt.y+1)*cell);ctx.stroke();}
    if(pointer.x>=0){ctx.strokeStyle='#f8f2d9bd';ctx.lineWidth=1;ctx.beginPath();ctx.arc((pointer.x+.5)*cell,(pointer.y+.5)*cell,Math.max(5,brush*cell*.48),0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#3456499a';ctx.beginPath();ctx.arc((pointer.x+.5)*cell,(pointer.y+.5)*cell,Math.max(4,brush*cell*.48-2),0,Math.PI*2);ctx.stroke();}
    ctx.restore();
  }
  function drawTree(x,y,s,r){const size=s*(.43+r*.14),cx=x+s*.52,base=y+s*.88;ctx.fillStyle='#536d4e';ctx.fillRect(cx-size*.11,base-size*.5,size*.22,size*.5);ctx.fillStyle=r>.83?'#477451':'#5f8559';ctx.beginPath();ctx.moveTo(cx,base-size*1.65);ctx.lineTo(cx-size*.65,base-size*.42);ctx.lineTo(cx+size*.7,base-size*.42);ctx.closePath();ctx.fill();ctx.fillStyle='#7fa06a';ctx.beginPath();ctx.moveTo(cx,base-size*1.35);ctx.lineTo(cx-size*.46,base-size*.63);ctx.lineTo(cx+size*.48,base-size*.63);ctx.closePath();ctx.fill();}
  function drawSettlement(s,cell,si){const x=(s.x+.5)*cell,y=(s.y+.5)*cell;ctx.fillStyle='#536b4c42';ctx.beginPath();ctx.ellipse(x,y+cell*.3,cell*2.7,cell*.8,0,0,7);ctx.fill();
    const houses=Math.max(3,Math.min(7,Math.round(s.pop/3)));for(let i=0;i<houses;i++){const a=i*Math.PI*2/houses+(si*.8),hx=x+Math.cos(a)*cell*1.5,hy=y+Math.sin(a)*cell*.92;const z=Math.max(2.6,cell*.39);ctx.fillStyle='#e7d8b5';ctx.fillRect(hx-z*.5,hy-z*.1,z,z*.65);ctx.fillStyle=i%2?'#a77157':'#b77f5e';ctx.beginPath();ctx.moveTo(hx-z*.68,hy);ctx.lineTo(hx,hy-z*.56);ctx.lineTo(hx+z*.68,hy);ctx.closePath();ctx.fill();ctx.fillStyle='#715e49';ctx.fillRect(hx-z*.08,hy+z*.22,z*.16,z*.34);}
    ctx.fillStyle='#fff8e6';ctx.beginPath();ctx.arc(x,y-cell*.1,Math.max(2,cell*.24),0,7);ctx.fill();ctx.fillStyle='#6b9670';ctx.beginPath();ctx.arc(x,y-cell*.1,Math.max(1.7,cell*.18),0,7);ctx.fill();}
  function drawPerson(p,cell,i){const x=(p.x+.5)*cell,y=(p.y+.55)*cell,z=Math.max(2.3,cell*.26);ctx.fillStyle='#53614950';ctx.beginPath();ctx.ellipse(x,y+z*.7,z*.9,z*.34,0,0,7);ctx.fill();ctx.fillStyle=p.shirt;ctx.fillRect(x-z*.43,y-z*.05,z*.86,z*.85);ctx.fillStyle=p.skin;ctx.beginPath();ctx.arc(x,y-z*.28,z*.38,0,7);ctx.fill();ctx.fillStyle='#554a3a';ctx.fillRect(x-z*.3,y-z*.54,z*.6,z*.11);}
  function drawAnimal(a,cell){const x=(a.x+.5)*cell,y=(a.y+.55)*cell,z=Math.max(2,cell*.24);ctx.fillStyle=a.kind==='deer'?'#9c7854':'#e5e0c8';ctx.beginPath();ctx.ellipse(x,y,z*1.15,z*.65,0,0,7);ctx.fill();ctx.beginPath();ctx.arc(x+z*.9,y-z*.3,z*.43,0,7);ctx.fill();if(a.kind==='deer'){ctx.strokeStyle='#8c7151';ctx.lineWidth=Math.max(1,z*.2);ctx.beginPath();ctx.moveTo(x+z,y-z*.55);ctx.lineTo(x+z*1.1,y-z*1.1);ctx.lineTo(x+z*1.35,y-z*.95);ctx.moveTo(x+z*1.08,y-z*.94);ctx.lineTo(x+z*.85,y-z*1.2);ctx.stroke();}}

  function canvasPoint(e){const rect=canvas.getBoundingClientRect();const cw=rect.width,ch=rect.height;const cell=Math.min(cw/W,ch/H)*zoom;const ox=(cw-W*cell)/2,oy=(ch-H*cell)/2;return{x:Math.floor((e.clientX-rect.left-ox)/cell),y:Math.floor((e.clientY-rect.top-oy)/cell)};}
  function paint(e){const p=canvasPoint(e);if(!inside(p.x,p.y))return;pointer=p;const now=performance.now();if(now-lastPaint<45)return;lastPaint=now;$('coordinateText').textContent=`${String.fromCharCode(65+Math.floor(p.x/8))}${String(1+Math.floor(p.y/8)).padStart(2,'0')} · ${p.x}, ${p.y}`;if(isDrawing)applyTool(p.x,p.y);draw();}
  function applyTool(x,y){if(selectedTool==='lightning'){if(performance.now()-lastPaint<180&&lightningAt)return;lightningAt={x,y};setTimeout(()=>{lightningAt=null;draw()},350);for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++)if(inside(xx,yy)&&terrainAt(xx,yy)!=='water'){scorch.add(idx(xx,yy));forest.delete(idx(xx,yy));}toast('A little thunder in the distance');return;}if(selectedTool==='meteor'){const r=Math.max(2,brush);for(let yy=y-r;yy<=y+r;yy++)for(let xx=x-r;xx<=x+r;xx++)if(inside(xx,yy)&&(xx-x)**2+(yy-y)**2<r*r){if(terrainAt(xx,yy)!=='water'){scorch.add(idx(xx,yy));forest.delete(idx(xx,yy));}else grid[idx(xx,yy)]='land';}const s=settlements.find(s=>(s.x-x)**2+(s.y-y)**2<r*r);if(s){s.pop=Math.max(0,s.pop-3);population=Math.max(0,population-3);}toast('A shooting star changed the landscape');return;}
    if(selectedTool==='rain'){rainTicks=20;for(let yy=y-brush;yy<=y+brush;yy++)for(let xx=x-brush;xx<=x+brush;xx++)if(inside(xx,yy)&&terrainAt(xx,yy)!=='water')wet.add(idx(xx,yy));toast('A soft rain is falling');draw();return;}
    for(let yy=y-brush+1;yy<y+brush;yy++)for(let xx=x-brush+1;xx<x+brush;xx++)if(inside(xx,yy)&&(xx-x)**2+(yy-y)**2<brush*brush){const k=idx(xx,yy),t=grid[k];if(selectedTool==='land'){grid[k]=t==='water'?'sand':t==='sand'?'land':'high';scorch.delete(k);}else if(selectedTool==='water'){grid[k]='water';forest.delete(k);scorch.delete(k);}else if(selectedTool==='forest'){if(t!=='water'&&t!=='sand'){forest.add(k);scorch.delete(k);}}else if(selectedTool==='life'){if(t!=='water'&&t!=='sand')spawnLife(xx,yy);}}
  }
  function spawnLife(x,y){if(lifeType==='human'){if(people.length>=120)return;people.push({x:x+(rnd()-.5)*.4,y:y+(rnd()-.5)*.4,skin:['#dca77c','#bd825e','#edc39a'][Math.floor(rnd(3))],shirt:['#b97d5b','#6c8c69','#e2c77f','#829ba0'][Math.floor(rnd(4))],wander:rnd(6)});population++;let s=settlements.find(s=>(s.x-x)**2+(s.y-y)**2<12);if(!s){s={x,y,name:['Mossvale','Cloverfield','Pinehollow','Fernrest'][Math.floor(rnd(4))],color:'#bc8a62',age:1,pop:0};settlements.push(s);toast(`${s.name} has found a home`);}s.pop++;}else if(animals.length<100)animals.push({x,y,kind:lifeType,dir:rnd(6)});updateUi();}

  function tick(){if(!playing)return;day++;settlements.forEach(s=>{s.age++;let capacity=18+forest.size*.035;if(s.pop<capacity&&Math.random()<.30){const p=findNearbyLand(s.x,s.y);people.push({x:p.x+(rnd()-.5)*.4,y:p.y+(rnd()-.5)*.4,skin:['#dca77c','#bd825e','#edc39a'][Math.floor(rnd(3))],shirt:['#b97d5b','#6c8c69','#e2c77f','#829ba0'][Math.floor(rnd(4))],wander:rnd(6)});s.pop++;population++;}if(s.pop>0&&Math.random()<.055){s.pop--;population=Math.max(0,population-1);if(people.length)people.splice(Math.floor(rnd(people.length)),1);}});
    people.forEach(p=>{if(Math.random()<.22){const nx=Math.round(p.x+rnd(3)-1),ny=Math.round(p.y+rnd(3)-1);if(terrainAt(nx,ny)!=='water'&&terrainAt(nx,ny)!=='sand'){p.x=nx;p.y=ny;}}});animals.forEach(a=>{if(Math.random()<.15){let nx=Math.round(a.x+rnd(3)-1),ny=Math.round(a.y+rnd(3)-1);if(terrainAt(nx,ny)!=='water'&&terrainAt(nx,ny)!=='sand'){a.x=nx;a.y=ny;}}});
    if(day%18===0&&settlements.length&&Math.random()<.55){const s=settlements[Math.floor(rnd(settlements.length))];toast(`${s.name} is growing nicely`);}if(day%7===0){history.push(Math.max(1,population));history.shift();}if(rainTicks>0)rainTicks--;updateUi();draw();}
  function updateUi(){
    $('populationCount').textContent=population.toLocaleString();$('settlementCount').textContent=settlements.length;$('speciesCount').textContent=animals.length?new Set(animals.map(a=>a.kind)).size+(people.length?1:0):people.length?1:0;
    $('worldAge').textContent=`DAY ${String(day).padStart(2,'0')}`;$('timelineDay').textContent=String(day).padStart(2,'0');const pct=Math.min(96,4+(day%25)*3.6);$('trackProgress').style.width=pct+'%';$('trackKnob').style.left=pct+'%';
    const max=Math.max(2,...history);$('chartBars').innerHTML=history.map((v,i)=>`<i class="chart-bar" style="height:${Math.max(12,Math.round(v/max*82))}%"></i>`).join('');
    $('playButton').textContent=playing?'Ⅱ':'▶';$('playButton').setAttribute('aria-label',playing?'Pause':'Play');
  }
  const configs={land:['LAND TOOL','Raise the earth and make room for life.','RAISE LAND'],water:['WATER TOOL','Shape the shoreline and make new bays.','ADD WATER'],forest:['FOREST TOOL','Grow a little green, one grove at a time.','PLANT FOREST'],life:['LIFE TOOL','Choose a little one to welcome to your world.','CREATE LIFE'],lightning:['LIGHTNING','A tiny flash of weather, right where you point.','STRIKE LIGHTNING'],meteor:['METEOR','Rearrange the landscape with a falling star.','DROP METEOR'],rain:['RAIN CLOUD','Bring a gentle shower to this corner.','BRING THE RAIN']};
  function chooseTool(tool){selectedTool=tool;document.querySelectorAll('.rail-tool').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));const c=configs[tool];$('settingsTitle').textContent=c[0];$('settingsDescription').textContent=c[1];$('actionLabel').textContent=c[2];$('lifePicker').classList.toggle('visible',tool==='life');}
  document.querySelectorAll('.rail-tool').forEach(b=>b.addEventListener('click',()=>chooseTool(b.dataset.tool)));
  canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);isDrawing=true;paint(e);$('mapHint').classList.add('hidden');clearTimeout(hintTimer);});canvas.addEventListener('pointermove',e=>paint(e));canvas.addEventListener('pointerup',()=>{isDrawing=false});canvas.addEventListener('pointercancel',()=>isDrawing=false);canvas.addEventListener('pointerleave',()=>{if(!isDrawing){pointer={x:-1,y:-1};draw();}});
  $('brushSlider').addEventListener('input',e=>{brush=+e.target.value;$('brushSize').textContent=brush;draw();});$('brushDown').onclick=()=>{$('brushSlider').value=Math.max(1,brush-1);$('brushSlider').dispatchEvent(new Event('input'));};$('brushUp').onclick=()=>{$('brushSlider').value=Math.min(9,brush+1);$('brushSlider').dispatchEvent(new Event('input'));};$('toolAction').onclick=()=>{const p=pointer.x>=0?pointer:nearestLand(48,33);applyTool(p.x,p.y);draw();};
  $('playButton').onclick=()=>{playing=!playing;updateUi();};document.querySelectorAll('.speed-button').forEach(b=>b.onclick=()=>{speed=+b.dataset.speed;document.querySelectorAll('.speed-button').forEach(x=>x.classList.toggle('active',x===b));});
  setInterval(()=>{if(playing)for(let i=0;i<speed;i++)tick();},850);
  $('zoomIn').onclick=()=>{zoom=Math.min(1.8,zoom+.15);draw();};$('zoomOut').onclick=()=>{zoom=Math.max(.65,zoom-.15);draw();};$('centerMap').onclick=()=>{zoom=1;draw();};$('newWorldBtn').onclick=()=>{generateWorld();$('mapHint').classList.remove('hidden');};
  $('brushSlider').value=brush;
  $('lifeType').addEventListener('change',e=>{lifeType=e.target.value;});
  $('helpBtn').onclick=()=>{$('helpModal').classList.add('open');$('helpModal').setAttribute('aria-hidden','false');};$('closeHelp').onclick=$('startPlaying').onclick=()=>{$('helpModal').classList.remove('open');$('helpModal').setAttribute('aria-hidden','true');};$('helpModal').addEventListener('click',e=>{if(e.target===$('helpModal'))$('closeHelp').click();});
  $('soundBtn').onclick=e=>{e.currentTarget.classList.toggle('muted');toast(e.currentTarget.classList.contains('muted')?'Sound is off':'Sound is on');};$('worldMenu').onclick=()=>toast('A little corner of the universe');
  $('actionLabel').addEventListener('click',()=>{});
  window.addEventListener('keydown',e=>{if(e.key>='1'&&e.key<='4')chooseTool(['land','water','forest','life'][+e.key-1]);if(e.code==='Space'){e.preventDefault();playing=!playing;updateUi();}if(e.key==='Escape')$('closeHelp').click();if(e.key==='+'||e.key==='='){$('zoomIn').click();}if(e.key==='-')$('zoomOut').click();});
  $('life-card');
  // Clicking Life's action cycles through friendly creatures; the canvas tool then places that choice.
  $('toolAction').addEventListener('contextmenu',e=>e.preventDefault());
  $('settingsTitle').addEventListener('dblclick',()=>{});
  const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);generateWorld();
})();
