// Actual desktop + simulated mobile browser smoke test.
// Maintainer-only, NOT imported by the game. Requires test-only Playwright
// and pinned Three.js, as installed by the GitHub Actions regression job.
// Run: node tests/browser-smoke.mjs
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// fileURLToPath(new URL('../', ...)) ends with '/', so normalize it.
// Otherwise root + path.sep becomes a double slash and rejects every
// perfectly legitimate local /play/ request with a false 403.
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const threeRoot=path.join(root,'node_modules','three');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.svg':'image/svg+xml','.png':'image/png','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  try {
    const uri=new URL(req.url,'http://127.0.0.1');
    let rel=decodeURIComponent(uri.pathname);
    if(rel.endsWith('/'))rel+='index.html';
    const filename=path.resolve(root,'.'+rel);
    if(!filename.startsWith(root+path.sep)){
      res.writeHead(403);res.end('forbidden');return;
    }
    const body=await readFile(filename);
    res.writeHead(200,{'content-type':mime[path.extname(filename)]||'application/octet-stream'});
    res.end(body);
  } catch(e) {
    res.writeHead(404);res.end('not found');
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const baseURL='http://127.0.0.1:'+server.address().port+'/play/';
let browser;
async function prepare(page){
  const requests=[],failedRequests=[];
  page.on('requestfailed',req=>failedRequests.push(req.url()+' : '+req.failure()?.errorText));
  page.on('response',resp=>{if(resp.status()>=400)failedRequests.push(resp.status()+' '+resp.url());});
  // Importmap URLs still name the exact shipped CDN dependency, but the
  // browser test supplies the already-installed Three.js files locally.
  // Test reliability is not dependent on a third-party CDN being up.
  await page.route('https://unpkg.com/three@0.160.0/**',async route=>{
    requests.push(route.request().url());
    const u=new URL(route.request().url());
    const rel=decodeURIComponent(u.pathname.replace(/^\/three@0\.160\.0\//,''));
    const filename=path.resolve(threeRoot,rel);
    if(!filename.startsWith(threeRoot+path.sep)){
      await route.fulfill({status:403,body:'forbidden'});return;
    }
    try {
      const body=await readFile(filename);
      await route.fulfill({status:200,body,contentType:'text/javascript',
        headers:{'access-control-allow-origin':'*'}});
    } catch(err) {
      await route.fulfill({status:404,body:'missing test module: '+rel,
        headers:{'access-control-allow-origin':'*'}});
    }
  });
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  page.on('console',msg=>{if(msg.type()==='error' && !msg.text().includes('favicon'))errors.push(msg.text());});
  /* commit only means the local document was received. The real boot
     assertion below waits for all modules, scene construction and app state. */
  await page.goto(baseURL,{waitUntil:'commit',timeout:15000});
  try {
    await page.waitForFunction(()=>window.__slBooted===true,null,{timeout:14000});
  } catch(err) {
    const state=await page.evaluate(()=>({
      booted:window.__slBooted,
      toast:document.querySelector('#toast')?.textContent,
      title:document.title,
      canvas:!!document.querySelector('#app canvas'),
      text:document.body?.innerText?.slice(0,350)
    })).catch(e=>({evalError:e.message}));
    throw new Error('WebGL game boot did not complete: '+
      JSON.stringify({state,errors,failedRequests,servedThreeModules:requests.slice(0,16),count:requests.length}));
  }
  assert.deepEqual(errors,[],'uncaught errors during boot: '+JSON.stringify({failedRequests,requests}));
  return errors;
}
try {
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--enable-webgl'
  ]});

  // Desktop: real game boot, editing, autosave, library save and lazy PNG.
  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
  const p=await desktop.newPage();
  const deskErrors=await prepare(p);
  const supports=await p.evaluate(()=>window.__slSupports);
  assert.ok(supports && supports.centreBruteUpperBound>0,'supports not generated');
  assert.ok(supports.centreCandidatesTested < supports.centreBruteUpperBound,
    'support index not used by real WebGL build');
  await p.locator('#btnStartBuild').click();
  assert.equal(await p.locator('#titleScreen').evaluate(el=>el.classList.contains('open')),false);
  const before=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.ok(before?.nodes?.length>=4,'classic preset missing');
  const firstHeight=before.nodes[0].h;
  await p.locator('#rngH').evaluate(el=>{
    el.value='20';
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const after=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(after.nodes[0].h,20,'height slider did not commit to autosave');
  assert.equal(after.nodes[0].bank,before.nodes[0].bank,'height edit moved the bank');
  /* The checkbox selects WHICH point is the station. Unchecking
     the only station must not silently strip the role from all nodes. */
  await p.locator('#chkStation').click(); // app intentionally rechecks sole station
  assert.equal(await p.locator('#chkStation').isChecked(),true,
    'the unique station cannot be unchecked');
  const afterStationClick=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterStationClick.nodes.filter(n=>n.station).length,1);
  await p.locator('#btnSaveLib').click();
  const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-library-v1')));
  assert.ok(saved?.length===1,'library save did not create an entry');
  assert.equal(saved[0].thumb,undefined,'library wrote a PNG into persistent storage');
  await p.locator('#btnLibrary').click();
  await p.waitForFunction(()=>document.querySelector('.libcard img')?.src.startsWith('data:image/png'),null,{timeout:30000});
  const image=await p.locator('.libcard img').first().evaluate(el=>({complete:el.complete,w:el.naturalWidth}));
  assert.ok(image.complete && image.w>0,'visible library thumbnail did not load');
  assert.deepEqual(deskErrors,[],'desktop page errors after editing');
  console.log('PASS desktop WebGL: boot, supports, station, height edit, autosave, library, visible blueprint (from '+firstHeight+'m)');

  // Browser-level recovery: download a 1-node open draft and import
  // the same real JSON file without accidentally closing the track.
  await p.locator('#btnLibClose').click();
  await p.locator('#btnNew').click();
  await p.locator('#btnNew').click(); // two-click guard when edits exist
  await p.waitForFunction(() => {
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.building === true && st.nodes?.length === 0;
  });
  const blankControls=await p.evaluate(()=>({
    index:document.querySelector('#nodeIdx').textContent,
    hLabel:document.querySelector('#hVal').textContent,
    bLabel:document.querySelector('#bVal').textContent,
    heightDisabled:document.querySelector('#rngH').disabled,
    bankDisabled:document.querySelector('#rngB').disabled,
    stationDisabled:document.querySelector('#chkStation').disabled,
    liftDisabled:document.querySelector('#chkLift').disabled,
    deleteDisabled:document.querySelector('#btnDel').disabled,
    nodeCount:document.querySelector('#dsN').textContent,
    length:document.querySelector('#dsLen').textContent
  }));
  assert.deepEqual(blankControls,{
    index:'-',hLabel:'-',bLabel:'-',heightDisabled:true,bankDisabled:true,
    stationDisabled:true,liftDisabled:true,deleteDisabled:true,
    nodeCount:'0',length:'-'
  },'empty draft must not display old node controls or previous stats');
  await p.mouse.click(850,480); // free canvas area, not the side panel
  await p.waitForFunction(() => {
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.building === true && st.nodes?.length === 1 && st.nodes[0].station === true;
  });
  assert.equal(await p.locator('#rngH').isDisabled(),false,'height editor returns with a station');
  assert.equal(await p.locator('#rngB').isDisabled(),false,'bank editor returns with a station');
  assert.equal(await p.locator('#chkStation').isDisabled(),true,'station checkbox locked while building');
  assert.equal(await p.locator('#dsN').textContent(),'1','one station is one actual node');
  assert.match(await p.locator('#dsH').textContent(),/3\.0 m/,'lone station height must be real');
  const downloadPending=p.waitForEvent('download');
  await p.locator('#btnExportJson').click();
  const downloaded=await downloadPending;
  assert.ok(downloaded.suggestedFilename().endsWith('.somelimits-draft.json'));
  const readStream=await downloaded.createReadStream(),chunks=[];
  for await(const chunk of readStream) chunks.push(chunk);
  const exported=Buffer.concat(chunks),draft=JSON.parse(exported.toString('utf8'));
  assert.equal(draft.app,'somelimits');
  assert.equal(draft.building,true);
  assert.equal(draft.nodes.length,1);
  const stationBefore=draft.nodes[0];
  await p.locator('#fileImp').setInputFiles([{
    name:'restored.somelimits-draft.json',mimeType:'application/json',buffer:exported
  }]);
  await p.waitForFunction((expected) => {
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.building === true && st.nodes?.length === 1 &&
      st.nodes[0].x === expected.x && st.nodes[0].z === expected.z &&
      st.nodes[0].station === true;
  },stationBefore,{timeout:10000});
  assert.deepEqual(deskErrors,[], 'desktop errors after exporting/importing open draft');
  console.log('PASS desktop draft rescue: 1-node open build exported and restored without closing the circuit');
  /* Round 32: actual simultaneous 3D + independently editable SIDE/FRONT
     drafting canvas, no second WebGL renderer, same points and history. */
  assert.equal(await p.locator('#linkedPane').isVisible(),true,
    'roomy desktop should show linked drawing by default');
  await p.locator('[data-editor-view="3d"]').click();
  await p.locator('[data-linked-view="side"]').click();
  await p.locator('#linkedFit').click();
  const linkedPixel=async projection=>p.evaluate(async v=>{
    const lib=await import('/play/linked-drafter.js');
    const n=JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0];
    const rect=document.getElementById('linkedCanvas').getBoundingClientRect();
    const vp=lib.fitLinkedView(v,[n],[],rect.width,rect.height);
    const pixel=lib.planeToCanvas(vp,lib.planePoint(v,n),rect.width,rect.height);
    return {x:rect.x+pixel.x,y:rect.y+pixel.y};
  },projection);
  const initialLinked=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const sidePixel=await linkedPixel('side');
  await p.mouse.move(sidePixel.x,sidePixel.y);
  await p.mouse.down();
  await p.mouse.move(sidePixel.x+42,sidePixel.y-33,{steps:8});
  await p.mouse.up();
  await p.waitForFunction(before=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===1&&d.nodes[0].h>before.nodes[0].h+1&&
      d.nodes[0].x>before.nodes[0].x+2;
  },initialLinked,{timeout:15000});
  const afterLinkedSide=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterLinkedSide.nodes[0].z,initialLinked.nodes[0].z,'SIDE linked drag preserves hidden Z exactly');
  assert.equal(afterLinkedSide.nodes[0].bank,initialLinked.nodes[0].bank,'SIDE linked drag never changes banking');
  assert.equal(afterLinkedSide.nodes[0].station,true,'SIDE linked drag preserves station');
  assert.equal(await p.locator('[data-editor-view="3d"]').getAttribute('aria-pressed'),'true',
    'secondary 2D editing cannot hijack the main 3D camera');
  await p.locator('#btnUndo').click();
  assert.deepEqual((await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    initialLinked.nodes,'one linked drag should Undo as exactly one track edit');
  await p.locator('#btnRedo').click();
  assert.deepEqual((await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    afterLinkedSide.nodes,'Redo restores the original linked drag');
  await p.locator('[data-linked-view="front"]').click();
  await p.locator('#linkedFit').click();
  const frontPixel=await linkedPixel('front');
  await p.mouse.move(frontPixel.x,frontPixel.y);
  await p.mouse.down();
  await p.mouse.move(frontPixel.x+36,frontPixel.y,{steps:7});
  await p.mouse.up();
  await p.waitForFunction(before=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===1 && d.nodes[0].z<before.z-1;
  },afterLinkedSide.nodes[0],{timeout:15000});
  const afterLinkedFront=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterLinkedFront.nodes[0].x,afterLinkedSide.nodes[0].x,'FRONT linked drag preserves hidden X');
  assert.equal(afterLinkedFront.nodes[0].h,afterLinkedSide.nodes[0].h,'horizontal FRONT drag preserves height');
  await p.locator('#btnUndo').click();
  assert.deepEqual((await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    afterLinkedSide.nodes,'FRONT drag Undo returns preceding drawing');
  await p.locator('[data-linked-view="side"]').click();
  await p.locator('#linkedFit').click();
  const endPoint=await linkedPixel('side');
  await p.mouse.click(endPoint.x+72,endPoint.y-32);
  await p.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.building && d.nodes.length===2;
  },null,{timeout:15000});
  const addedLinked=await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(addedLinked.nodes[1].z,afterLinkedSide.nodes[0].z,
    'tapping SIDE linked paper adds next node while retaining hidden Z');
  assert.ok(addedLinked.nodes[1].h>afterLinkedSide.nodes[0].h+1,
    'SIDE linked paper can draw an uphill segment with 3D still visible');
  await p.locator('#btnUndo').click();
  assert.deepEqual((await p.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    afterLinkedSide.nodes,'linked click-to-extend is a single undoable document edit');
  await p.locator('#linkedClose').click();
  assert.equal(await p.locator('#linkedPane').isVisible(),false,'linked close hides the pane');
  await p.locator('#btnLinkedPane').click();
  assert.equal(await p.locator('#linkedPane').isVisible(),true,'inspector toggle reopens linked pane');
  assert.deepEqual(deskErrors,[],'no errors in linked two-pane WebGL/Canvas2D workflow');
  console.log('PASS desktop LINKED 2D+3D: SIDE+FRONT actual drags, exact hidden axes, independent main 3D view, open-track placement, Undo/Redo and toggle');
  /* A continuous desktop software-WebGL render loop can starve the
     second Chromium page on GitHub's shared CPU runner. The two user
     journeys are independent, so retire desktop before mobile boots. */
  await desktop.close();

  // Mobile: 3x simulated device should render at 2x while preserving
  // touch-first blank-plot building. No external images or modes.
  const mobile=await browser.newContext({
    viewport:{width:390,height:844},deviceScaleFactor:3,
    isMobile:true,hasTouch:true
  });
  const mp=await mobile.newPage();
  const mobileErrors=await prepare(mp);
  assert.equal(await mp.locator('#linkedPane').isVisible(),false,
    'the secondary drafting canvas must never steal default 390px phone touch area');
  const dims=await mp.evaluate(()=>{
    const canvas=document.querySelector('#app canvas');
    const hint=document.querySelector('#hint');
    return {cssW:window.innerWidth,cssH:window.innerHeight,
      screenW:screen.width,visualW:window.visualViewport?.width,
      docClientW:document.documentElement.clientWidth,
      bodyScrollW:document.body.scrollWidth,
      hintBox:hint?.getBoundingClientRect().toJSON(),
      backingW:canvas.width,backingH:canvas.height};
  });
  console.log('MOBILE VIEWPORT METRICS: '+JSON.stringify(dims));
  assert.equal(dims.cssW,390,'mobile layout viewport expanded unexpectedly');
  assert.equal(dims.backingW,780,'3x device must draw at capped 2x DPR');
  assert.equal(dims.backingH,1688,'mobile canvas height must cap at 2x');
  await mp.locator('#btnStartNew').tap();
  assert.equal(await mp.locator('[data-editor-view="top"]').getAttribute('aria-pressed'),'true',
    'new coaster must start in 2D blueprint view');
  /* Existing real mobile cap/grip/orbit regressions explicitly exercise
     classic 3D; the new blueprint authoring journey runs afterward. */
  await mp.locator('[data-editor-view="3d"]').tap();
  const blank=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(blank.building,true);
  assert.equal(blank.nodes.length,0,'new must begin with an empty plot');
  await mp.waitForFunction(()=>document.getElementById('hLabel').style.display==='none',
    null,{timeout:8000}); // no point = no floating number
  // The view/build dock may not steal the central build canvas.
  const centerHit=await mp.evaluate(()=>({
    tag:document.elementFromPoint(195,380)?.tagName,
    dock:document.getElementById('editorDock').getBoundingClientRect().toJSON()
  }));
  console.log('MOBILE BLUEPRINT DOCK '+JSON.stringify(centerHit));
  assert.equal(centerHit.tag,'CANVAS','editor view/build dock must not block central canvas');
  await mp.touchscreen.tap(195,380);
  await mp.waitForFunction(()=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===1 && doc.nodes[0].station===true;
  },null,{timeout:8000});
  assert.deepEqual(mobileErrors,[],'mobile page errors after station tap');
  /* A first station has no spline, but its height label must already
     be visible. The old render-loop guard required track !== null. */
  await mp.waitForFunction(()=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    const label=document.getElementById('hLabel');
    return st?.building&&st.nodes?.length===1&&label.style.display==='block'&&
      label.textContent===st.nodes[0].h.toFixed(1)+' m';
  },null,{timeout:10000});
  console.log('PASS mobile WebGL: 3x -> 2x raster, blank plot, station and first-point height label');

  /* Real Chromium touch events, not element.tap() or fake JS edits:
     the station has no cap/grip, so aiming a finger at its projected
     centre tests the same lime-node gesture users have. Frame Track
     puts the one point at the exact centre of the viewport. */
  await mp.evaluate(()=>document.getElementById('btnFrame').click());
  const original=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const station=original.nodes[0];
  const center={x:195,y:422};
  const cdp=await mobile.newCDPSession(mp);
  const finger=(id,x,y)=>({id,x,y});
  const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await send('touchStart',[finger(10,center.x,center.y)]);
  await send('touchMove',[finger(10,center.x,center.y-105)]);
  await send('touchEnd',[]);
  await mp.waitForFunction((before)=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1 && st.nodes[0].h > before.h+3;
  },station,{timeout:12000});
  const raised=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(raised.nodes[0].x,station.x,'vertical drag moved ground x');
  assert.equal(raised.nodes[0].z,station.z,'vertical drag moved ground z');
  assert.equal(raised.nodes[0].bank,station.bank,'vertical drag altered bank');
  assert.equal(raised.nodes[0].station,true,'vertical drag lost station role');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  await mp.waitForFunction((before)=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1 && st.nodes[0].h===before.h;
  },station,{timeout:8000});
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  await mp.waitForFunction((h)=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1 && st.nodes[0].h===h;
  },raised.nodes[0].h,{timeout:8000});
  console.log('PASS true touch drag: raise one station point, unchanged x/z/bank, undo and redo');

  /* Simulate an interrupted touch: move the grabbed point, then
     lose window focus before finger-up. Uncommitted point movement
     must roll back, and a subsequent pointer must work normally. */
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  await mp.evaluate(()=>document.getElementById('btnFrame').click());
  await send('touchStart',[finger(21,center.x,center.y)]);
  await send('touchMove',[finger(21,center.x,center.y-80)]);
  await mp.waitForFunction((h)=>document.getElementById('hVal').textContent !== h.toFixed(1)+' m',
    station.h,{timeout:9000});
  await mp.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await send('touchEnd',[]);
  await mp.waitForFunction((h)=>document.getElementById('hVal').textContent === h.toFixed(1)+' m',
    station.h,{timeout:9000});
  const aborted=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(aborted.nodes,original.nodes,'blur cannot commit a half drag');
  console.log('PASS interrupted touch: blur restores node and does not change persisted document');

  /* A second simultaneous touch is not an instruction to move the
     grabbed point with the passenger finger. It must undo the first
     uncommitted edit, hold OrbitControls while the grab is unresolved,
     and release all ownership when both fingers lift. */
  await mp.evaluate(()=>document.getElementById('btnFrame').click());
  await send('touchStart',[finger(31,center.x,center.y)]);
  await send('touchMove',[finger(31,center.x,center.y-85)]);
  await mp.waitForFunction(h=>document.getElementById('hVal').textContent !== h.toFixed(1)+' m',
    station.h,{timeout:9000});
  await send('touchStart',[finger(31,center.x,center.y-85),finger(32,center.x+50,center.y-25)]);
  await mp.waitForFunction(h=>document.getElementById('hVal').textContent === h.toFixed(1)+' m',
    station.h,{timeout:9000});
  await send('touchMove',[finger(31,center.x,center.y-120),finger(32,center.x+65,center.y-15)]);
  await send('touchEnd',[]);
  const afterPinch=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(afterPinch.nodes,original.nodes,'two-finger cancellation must not persist a half edit');

  /* Capture loss is distinct from pointercancel: some browsers
     drop it when focus changes or a gesture is handed to browser
     chrome. Revoke canvas capture while the finger remains down. */
  await mp.evaluate(()=>{
    const canvas=document.querySelector('#app canvas');
    canvas.addEventListener('pointerdown',e=>{window.__slTestActiveId=e.pointerId;},{capture:true});
    document.getElementById('btnFrame').click();
  });
  await send('touchStart',[finger(41,center.x,center.y)]);
  await send('touchMove',[finger(41,center.x,center.y-80)]);
  await mp.waitForFunction(h=>document.getElementById('hVal').textContent !== h.toFixed(1)+' m',
    station.h,{timeout:9000});
  const hadCapture=await mp.evaluate(()=>{
    const canvas=document.querySelector('#app canvas'),id=window.__slTestActiveId;
    if(id==null)return false;
    const held=canvas.hasPointerCapture(id);
    if(held)canvas.releasePointerCapture(id);
    return held;
  });
  assert.equal(hadCapture,true,'node drag must own pointer capture');
  /* Pointer Events processes a pending release at the NEXT pointer
     event; releasePointerCapture() does not guarantee synchronous
     lostpointercapture dispatch. Move while the finger is still
     down to trigger real browser capture-release ordering. */
  await send('touchMove',[finger(41,center.x,center.y-81)]);
  await mp.waitForFunction(h=>document.getElementById('hVal').textContent === h.toFixed(1)+' m',
    station.h,{timeout:9000});
  await send('touchEnd',[]);
  const afterLost=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(afterLost.nodes,original.nodes,'lostpointercapture must roll back uncommitted drag');

  /* The next touch must still work. This also detects a stuck
     activePtr or controlsHeld after either cancellation path. */
  await mp.evaluate(()=>document.getElementById('btnFrame').click());
  await send('touchStart',[finger(51,center.x,center.y)]);
  await send('touchMove',[finger(51,center.x,center.y-75)]);
  await send('touchEnd',[]);
  await mp.waitForFunction(h=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1&&st.nodes[0].h>h+3;
  },station.h,{timeout:12000});
  console.log('PASS multi-touch and capture loss: uncommitted drags roll back; next touch remains usable');

  /* This is the original playtest's companion: actual SIDEWAYS
     finger movement should change the plan x/z but not the point's
     height or banking. Unit tests only established the mutation
     helper; this exercises picking, axis intent and camera projection.
     The station is the sole node, so Frame Track centers it. */
  await mp.evaluate(()=>document.getElementById('btnFrame').click());
  const beforeSide=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const beforeNode=beforeSide.nodes[0];
  await send('touchStart',[finger(61,center.x,center.y)]);
  await send('touchMove',[finger(61,center.x+95,center.y+1)]);
  await send('touchEnd',[]);
  await mp.waitForFunction(before=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1 &&
      Math.hypot(st.nodes[0].x-before.x,st.nodes[0].z-before.z)>3;
  },beforeNode,{timeout:12000});
  const afterSide=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterSide.nodes[0].h,beforeNode.h,'sideways drag must not change height');
  assert.equal(afterSide.nodes[0].bank,beforeNode.bank,'sideways drag must not change banking');
  assert.equal(afterSide.nodes[0].station,true,'sideways drag must retain station role');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  await mp.waitForFunction(before=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1 && st.nodes[0].x===before.x &&
      st.nodes[0].z===before.z;
  },beforeNode,{timeout:8000});
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  await mp.waitForFunction(after=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st?.nodes?.length===1 && st.nodes[0].x===after.x &&
      st.nodes[0].z===after.z;
  },afterSide.nodes[0],{timeout:8000});
  console.log('PASS sideways touch drag: x/z move, unchanged height/bank, undo/redo exactly restore coordinates');

  /* A newly placed station has ONE point and NO sampled track. It
     used to lack its orange cap and blue grip entirely. Project the
     documented 2.4m orange cap and 2.6m roll grip into the known
     Frame Track camera, then exercise the *actual* grabbable meshes
     with Chromium's real touch events. No test-only app hooks. */
  const gameSource=await readFile(path.join(root,'play/index.html'),'utf8');
  const gripSrcStart=gameSource.indexOf('function editGripRadius(n) {');
  const gripSrcEnd=gameSource.indexOf('function buildSelectedEditHandles()',gripSrcStart);
  assert.ok(gripSrcStart>=0&&gripSrcEnd>gripSrcStart,'grip radius must be implemented once in game source');
  const gripSrc=gameSource.slice(gripSrcStart,gripSrcEnd);
  async function loneHandlePixels(){
    await mp.evaluate(()=>document.getElementById('btnFrame').click());
    return mp.evaluate(async (gripSrc)=>{
      const THREE=await import('three');
      const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
      const n=doc.nodes[0];
      const eye=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,1000);
      eye.position.set(n.x+52,n.h+44,n.z+74);
      eye.lookAt(n.x,n.h,n.z);
      eye.updateMatrixWorld();
      const gripRadius=new Function('THREE','camera','COARSE','innerHeight',
        gripSrc+'\nreturn editGripRadius;')(THREE,eye,true,innerHeight)(n);
      const screen=(x,y,z)=>{
        const v=new THREE.Vector3(x,y,z).project(eye);
        return {x:Math.round((v.x+1)*innerWidth/2),
                y:Math.round((1-v.y)*innerHeight/2)};
      };
      /* A lone station's tangent is +X by definition; its side is
         world -Z and up is +Y. This works at ANY banking angle, so
         the browser can probe grip/cap overlap around +/-90 degrees
         instead of assuming the original zero-bank state. */
      const rad=THREE.MathUtils.degToRad(n.bank);
      return {cap:screen(n.x,n.h+2.4,n.z),
              grip:screen(n.x,n.h-Math.sin(rad)*gripRadius,
                n.z-Math.cos(rad)*gripRadius),
              rollDown:screen(n.x,n.h-gripRadius,n.z),
              node:screen(n.x,n.h,n.z),
              gripRadius,nodeData:{...n}};
    },gripSrc);
  }
  const beforeCap=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const capPix=await loneHandlePixels();
  console.log('LONE HANDLE PIXELS '+JSON.stringify(capPix));
  assert.equal(beforeCap.building,true);
  assert.equal(beforeCap.nodes.length,1);
  await send('touchStart',[finger(71,capPix.cap.x,capPix.cap.y)]);
  await send('touchMove',[finger(71,capPix.cap.x,capPix.cap.y-76)]);
  await mp.waitForFunction(h=>{
    const label=document.getElementById('hLabel');
    return label.style.display==='block'&&label.textContent.endsWith(' m')&&
      parseFloat(label.textContent)>h+2;
  },beforeCap.nodes[0].h,{timeout:11000});
  const whileCap=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(whileCap.nodes,beforeCap.nodes,
    'orange cap must not autosave an uncommitted touch movement');
  await send('touchEnd',[]);
  await mp.waitForFunction(h=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===1&&doc.nodes[0].h>h+2;
  },beforeCap.nodes[0].h,{timeout:11000});
  const afterCap=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterCap.nodes[0].x,beforeCap.nodes[0].x,'orange cap moved x');
  assert.equal(afterCap.nodes[0].z,beforeCap.nodes[0].z,'orange cap moved z');
  assert.equal(afterCap.nodes[0].bank,beforeCap.nodes[0].bank,'orange cap moved bank');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  await mp.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0].h===h,
    beforeCap.nodes[0].h,{timeout:8000});
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  await mp.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0].h===h,
    afterCap.nodes[0].h,{timeout:8000});
  console.log('PASS orange cap: first station precision touch drag, unchanged ground/bank, exact undo/redo');

  /* Return to zero bank and frame the newly raised station. A touch
     starting exactly on the blue grip, then moving to the -Y spoke,
     should roll the same one point toward +90 degrees. */
  const beforeGrip=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const gripPix=await loneHandlePixels();
  await send('touchStart',[finger(81,gripPix.grip.x,gripPix.grip.y)]);
  await send('touchMove',[finger(81,gripPix.rollDown.x,gripPix.rollDown.y)]);
  /* During an active drag the bank is updated in memory and in
     the on-screen slider, but autosave must NOT change until
     pointerup commits. Comparing the live text to localStorage
     here is a category error—and would make this test impossible. */
  await mp.waitForFunction(b=>{
    const label=document.getElementById('hLabel');
    const liveBank=parseInt(document.getElementById('bVal').textContent,10);
    return label.style.display==='block'&&Number.isFinite(liveBank)&&
      Math.abs(liveBank-b)>30 &&
      label.textContent==='bank '+liveBank+' deg';
  },beforeGrip.nodes[0].bank,{timeout:11000});
  const whileGrip=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(whileGrip.nodes,beforeGrip.nodes,
    'blue grip must not autosave an uncommitted touch movement');
  await send('touchEnd',[]);
  await mp.waitForFunction(b=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===1&&Math.abs(doc.nodes[0].bank-b)>30;
  },beforeGrip.nodes[0].bank,{timeout:11000});
  const afterGrip=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterGrip.nodes[0].h,beforeGrip.nodes[0].h,'blue grip moved height');
  assert.equal(afterGrip.nodes[0].x,beforeGrip.nodes[0].x,'blue grip moved x');
  assert.equal(afterGrip.nodes[0].z,beforeGrip.nodes[0].z,'blue grip moved z');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  await mp.waitForFunction(b=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0].bank===b,
    beforeGrip.nodes[0].bank,{timeout:8000});
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  await mp.waitForFunction(b=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0].bank===b,
    afterGrip.nodes[0].bank,{timeout:8000});
  console.log('PASS blue grip: first station bank touch drag, unchanged position/height, exact undo/redo');
  await mp.waitForFunction(h=>{
    const label=document.getElementById('hLabel');
    return label.style.display==='block'&&label.textContent===h.toFixed(1)+' m';
  },afterGrip.nodes[0].h,{timeout:8000});
  console.log('PASS first-point floating readout: height visible without spline; live cap height and grip bank; reset after release');

  /* The rolled blue grip comes closest to the orange cap near
     -90 degrees (the up-pointing bank orientation). Both have
     thumb-sized hit proxies, so a ray can hit BOTH. The aimed
     screen centre must pick the intended handle. Run each case
     in the actual WebGL page, not as a fake handler call. */
  for (const angle of [-90,-80,90]) {
    await mp.evaluate(bank=>{
      const slider=document.getElementById('rngB');
      slider.value=String(bank);
      slider.dispatchEvent(new Event('input',{bubbles:true}));
      slider.dispatchEvent(new Event('change',{bubbles:true}));
    },angle);
    await mp.waitForFunction(bank=>{
      const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
      return st?.nodes?.length===1&&st.nodes[0].bank===bank;
    },angle,{timeout:9000});
    const centers=await loneHandlePixels();
    const separation=Math.hypot(centers.cap.x-centers.grip.x,
      centers.cap.y-centers.grip.y);
    console.log('EXTREME BANK HANDLE CENTERS '+JSON.stringify({
      angle,cap:centers.cap,grip:centers.grip,node:centers.node,
      separation,gripRadius:centers.gripRadius
    }));
    assert.ok(separation>=8,'bank '+angle+' leaves cap and grip visually inseparable in mobile frame');
    const stored=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
    for(const [kind,expected] of [['cap','ns-resize'],['grip','grabbing']]){
      const pt=centers[kind],id=220+angle+ (kind==='grip'?1:0);
      const topElement=await mp.evaluate(point=>document.elementFromPoint(point.x,point.y)?.tagName,pt);
      assert.equal(topElement,'CANVAS','mobile dock must not cover '+kind+' at bank '+angle+' (screen '+pt.x+','+pt.y+')');
      await send('touchStart',[finger(id,pt.x,pt.y)]);
      const actual=await mp.evaluate(()=>document.querySelector('#app canvas').style.cursor);
      console.log('EXTREME HANDLE TOUCH '+JSON.stringify({angle,kind,actual,expected}));
      assert.equal(actual,expected,
        'touch exactly at '+kind+' center must select '+kind+' at bank '+angle);
      await send('touchEnd',[]);
    }
    /* A cap halo can cover the lime node's center even when the
       grip and cap correctly pick themselves. Editing the point
       directly is more important than halo ordering: touching
       the visible node must NOT initiate an orange or blue drag. */
    await send('touchStart',[finger(290+angle,centers.node.x,centers.node.y)]);
    const nodePick=await mp.evaluate(()=>document.querySelector('#app canvas').style.cursor);
    console.log('EXTREME LIME NODE PICK '+JSON.stringify({angle,nodePick}));
    assert.ok(nodePick!=='ns-resize'&&nodePick!=='grabbing',
      'lime node center at bank '+angle+' must not be stolen by precision controls');
    await send('touchEnd',[]);
    const afterTaps=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
    assert.deepEqual(afterTaps.nodes,stored.nodes,
      'testing handles with touch taps must not commit a false edit');
  }
  console.log('PASS extreme bank screen-space picking: orange cap and blue grip remain distinct at -90, -80 and +90 degrees');
  assert.deepEqual(mobileErrors,[],'mobile errors after precision handle and overlap touch tests');

  /* Round 25 genuine browser workflow: the rest of this test retained
     the old 3D gestures, now verify an actual blueprint lift crest
     continues LEVEL instead of magically falling to 3m. */
  await mp.evaluate(()=>{
    document.getElementById('btnNew').click();
    document.getElementById('btnNew').click();
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.building && d.nodes.length===0 &&
      document.querySelector('[data-editor-view="top"]').getAttribute('aria-pressed')==='true';
  });
  await mp.touchscreen.tap(195,380);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===1;
  });
  await mp.evaluate(()=>{
    const s=document.querySelector('#rngH');
    s.value='42.5';s.dispatchEvent(new Event('input',{bubbles:true}));
    s.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.[0]?.h===42.5;
  });
  /* Physical interaction, not a static source assertion:
     SIDE and FRONT must move the point in only the two displayed axes.
     The first lone node is centered by Frame Track in each view.
     Real touch-start/move/end and actual WebGL projection govern the edit. */
  async function projectedLoneElevation(view) {
    await mp.locator('[data-editor-view="'+view+'"]').tap();
    return mp.evaluate(async which=>{
      const THREE=await import('three');
      const n=JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0];
      const target=new THREE.Vector3(n.x,Math.max(2,n.h),n.z);
      const mn=new THREE.Vector3(target.x-58,0,target.z-58);
      const mx=new THREE.Vector3(target.x+58,Math.max(50,target.y+15),target.z+58);
      const center=mn.clone().add(mx).multiplyScalar(.5);
      const aspect=innerWidth/innerHeight;
      const horizontal=116,vertical=mx.y-mn.y;
      const halfHeight=Math.max(18,vertical*.66,horizontal/aspect*.66);
      const eye=new THREE.OrthographicCamera(-halfHeight*aspect,halfHeight*aspect,halfHeight,-halfHeight,.1,1000);
      eye.up.set(0,1,0);
      if(which==='side')eye.position.set(center.x,center.y,center.z+190);
      else eye.position.set(center.x+190,center.y,center.z);
      eye.lookAt(center);eye.updateMatrixWorld();
      const point=new THREE.Vector3(n.x,n.h,n.z).project(eye);
      return {x:Math.round((point.x+1)*innerWidth/2),
        y:Math.round((1-point.y)*innerHeight/2)};
    },view);
  }
  for(const view of ['side','front']){
    const before=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
    const pixel=await projectedLoneElevation(view);
    const onCanvas=await mp.evaluate(point=>document.elementFromPoint(point.x,point.y)?.tagName,pixel);
    assert.equal(onCanvas,'CANVAS',view+' station needs a tappable elevation node');
    const id=view==='side'?491:492;
    await send('touchStart',[finger(id,pixel.x,pixel.y)]);
    await send('touchMove',[finger(id,pixel.x+42,pixel.y-54)]);
    await send('touchEnd',[]);
    await mp.waitForFunction(({h})=>{
      const a=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
      return a?.nodes?.length===1 && a.nodes[0].h>h+4;
    },{h:before.nodes[0].h},{timeout:12000});
    const edited=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
    assert.notEqual(edited.nodes[0][view==='side'?'x':'z'],
      before.nodes[0][view==='side'?'x':'z'],
      view+' dragging horizontally changes the visible lateral coordinate');
    assert.equal(edited.nodes[0][view==='side'?'z':'x'],
      before.nodes[0][view==='side'?'z':'x'],
      view+' must keep the hidden perpendicular coordinate');
    assert.equal(edited.nodes[0].bank,before.nodes[0].bank,view+' should never change banking');
    await mp.evaluate(()=>document.getElementById('btnUndo').click());
    const undone2=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
    assert.deepEqual(undone2.nodes,before.nodes,view+' Undo should restore exact coordinates');
    console.log('PASS '+view.toUpperCase()+' real touch elevation drag: visible plane only, bank preserved, exact Undo');
  }
  await mp.locator('[data-editor-view="top"]').tap();
  assert.equal((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes[0].h,
    42.5,'return from elevation view must preserve the original lift crest');
  await mp.locator('#btnContinue').tap();
  await mp.locator('#btnTurnLeft').tap();
  await mp.locator('#btnMakeDrop').tap();
  const blueprint=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(blueprint.nodes.length,4,'LEVEL, LEFT and DROP add one node each');
  assert.deepEqual(blueprint.nodes.map(n=>n.h),[42.5,42.5,42.5,22.5],
    'crest remains level through the turn and drops only when asked');
  assert.ok(blueprint.nodes[2].x<blueprint.nodes[1].x,'LEFT really turns left');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  const undone=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(undone.nodes.length,3,'Undo removes deliberate drop');
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    blueprint.nodes,'Redo restores the exact node geometry');
  for(const view of ['side','front','top','3d']){
    await mp.locator('[data-editor-view="'+view+'"]').tap();
    assert.equal(await mp.locator('[data-editor-view="'+view+'"]').getAttribute('aria-pressed'),'true',
      'view selector must report '+view);
  }
  assert.equal(await mp.locator('#nodeIdx').textContent(),'#4 of 4',
    'Redo must restore selection to the newly inserted DROP node');
  /* Precision after construction: TOP arrow nudges must touch only the
     selected point and only the visible axis. Inspector coordinate edits
     are undoable, and prev/next selection must not create document edits
     even if stacked nodes are impossible to distinguish by screen tap. */
  await mp.locator('[data-editor-view="top"]').tap();
  const preNudge=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  /* A soft-keyboard input must keep its own arrow keys; use the game
     canvas/body as a real external keyboard target for editor nudges. */
  await mp.evaluate(()=>document.activeElement?.blur());
  await mp.keyboard.press('ArrowLeft');
  await mp.waitForFunction(x=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===4&&d.nodes[3].x<x-.5;
  },preNudge.nodes[3].x,{timeout:9000});
  const afterNudge=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(afterNudge.nodes.slice(0,3),preNudge.nodes.slice(0,3),'nudge moves only selected node');
  assert.equal(afterNudge.nodes[3].z,preNudge.nodes[3].z,'left nudge leaves Z alone');
  assert.equal(afterNudge.nodes[3].h,preNudge.nodes[3].h,'left nudge leaves height alone');
  assert.equal(afterNudge.nodes[3].bank,preNudge.nodes[3].bank,'left nudge leaves banking alone');
  await mp.evaluate(()=>{
    const x=document.getElementById('inpNodeX');
    x.value='22.7';x.dispatchEvent(new Event('change',{bubbles:true}));
  });
  const afterNumber=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(afterNumber.nodes[3].x,22.7,'numeric X editor commits exact 0.1 m');
  assert.deepEqual(afterNumber.nodes.slice(0,3),preNudge.nodes.slice(0,3),'numeric edit leaves neighbors alone');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  const afterCoordUndo=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(afterCoordUndo.nodes,afterNudge.nodes,'Undo restores pre-number position');
  await mp.evaluate(()=>document.getElementById('btnPrevNode').click());
  assert.equal(await mp.locator('#nodeIdx').textContent(),'#3 of 4','prev selects stacked neighbor exactly');
  await mp.evaluate(()=>document.getElementById('btnNextNode').click());
  assert.equal(await mp.locator('#nodeIdx').textContent(),'#4 of 4','next reselects actual last node');
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    afterNudge.nodes,'node selection never changes autosave document');
  console.log('PASS precision WebGL: TOP arrow nudge axis isolation, numeric X, Undo, previous/next no document changes');
  /* Round 28: SIDE and FRONT can now CREATE nodes on an open layout, not
     only move old points. Test actual finger taps with WebGL raycasting,
     inherited hidden coordinates, exact Undo/Redo and camera view memory. */
  await mp.evaluate(()=>{
    document.getElementById('btnNew').click();
    document.getElementById('btnNew').click();
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.building===true&&d.nodes.length===0;
  });
  await mp.touchscreen.tap(195,380);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.building===true&&d.nodes.length===1&&d.nodes[0].station===true;
  });
  const stationForDrawing=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0]);
  const stationSidePixel=await projectedLoneElevation('side');
  const sideNext={x:stationSidePixel.x+70,y:stationSidePixel.y-54};
  assert.equal(await mp.evaluate(pt=>document.elementFromPoint(pt.x,pt.y)?.tagName,sideNext),
    'CANVAS','SIDE drawing surface must remain tappable after view dock additions');
  await mp.touchscreen.tap(sideNext.x,sideNext.y);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===2;
  },null,{timeout:14000});
  const drawnSide=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(drawnSide.nodes[1].z,stationForDrawing.z,'SIDE new point inherits hidden Z');
  assert.equal(drawnSide.nodes[1].bank,stationForDrawing.bank,'SIDE new point inherits bank');
  assert.ok(drawnSide.nodes[1].x>stationForDrawing.x+5,'SIDE tap extends along the X drawing axis');
  assert.ok(drawnSide.nodes[1].h>stationForDrawing.h+8,'SIDE tap creates the uphill lift directly');
  await mp.locator('#btnZoomIn').tap();
  await mp.waitForFunction(()=>document.getElementById('zoomReadout').textContent==='1.3x',
    null,{timeout:6000});
  await mp.locator('[data-editor-view="top"]').tap();
  await mp.locator('[data-editor-view="side"]').tap();
  await mp.waitForFunction(()=>document.getElementById('zoomReadout').textContent==='1.3x',
    null,{timeout:6000});
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    drawnSide.nodes,'changing/returning drafting view must preserve node data');
  await mp.locator('#btnFrameView').tap();
  await mp.waitForFunction(()=>document.getElementById('zoomReadout').textContent==='1.0x',
    null,{timeout:6000});
  await mp.locator('[data-editor-view="front"]').tap();
  const frontNext={x:260,y:425};
  assert.equal(await mp.evaluate(pt=>document.elementFromPoint(pt.x,pt.y)?.tagName,frontNext),
    'CANVAS','FRONT drawing surface cannot be covered by controls');
  await mp.touchscreen.tap(frontNext.x,frontNext.y);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===3;
  },null,{timeout:14000});
  const drawnFront=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(drawnFront.nodes[2].x,drawnSide.nodes[1].x,'FRONT new point inherits hidden X');
  assert.notEqual(drawnFront.nodes[2].z,drawnSide.nodes[1].z,'FRONT tap controls Z');
  assert.equal(drawnFront.nodes[2].bank,drawnSide.nodes[1].bank,'FRONT tap inherits bank');
  assert.deepEqual(drawnFront.nodes.slice(0,2),drawnSide.nodes,'FRONT placement never changes upstream nodes');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    drawnSide.nodes,'Undo removes only the FRONT extension');
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    drawnFront.nodes,'Redo returns exact FRONT-drawn geometry');
  console.log('PASS elevation DRAW WebGL: SIDE tap creates lift, FRONT tap shapes next segment, camera zoom survives view switching, FIT resets, exact Undo/Redo');
  /* Round 29: opt-in 5m grid snapping across the three blueprint views.
     Real touch tests use the game's actual click-to-place path, not a
     fake call into the quantizer. The default OFF case has already
     been checked in every previous 3D/2D gesture. */
  await mp.locator('#btnGridSnap').tap();
  assert.equal(await mp.locator('#btnGridSnap').textContent(),'snap: 1m');
  await mp.locator('#btnGridSnap').tap();
  assert.equal(await mp.locator('#btnGridSnap').textContent(),'snap: 5m');
  await mp.locator('[data-editor-view="top"]').tap();
  await mp.evaluate(()=>{
    document.getElementById('btnNew').click();
    document.getElementById('btnNew').click();
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===0&&d?.building===true;
  });
  await mp.touchscreen.tap(195,380);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===1&&d.nodes[0].station===true;
  });
  const snappedStation=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0]);
  assert.equal(Math.abs(snappedStation.x%5),0,'TOP station X snapped to 5m grid');
  assert.equal(Math.abs(snappedStation.z%5),0,'TOP station Z snapped to 5m grid');
  const snapSidePixel=await projectedLoneElevation('side');
  await mp.touchscreen.tap(snapSidePixel.x+70,snapSidePixel.y-54);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===2;
  },null,{timeout:14000});
  const snappedSide=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(Math.abs(snappedSide.nodes[1].x%5),0,'SIDE new point X snaps to 5m');
  assert.equal(Math.abs(snappedSide.nodes[1].h%5),0,'SIDE new point height snaps to 5m');
  assert.equal(snappedSide.nodes[1].z,snappedStation.z,'SIDE hidden Z stays exact');
  await mp.locator('[data-editor-view="top"]').tap();
  /* Move a real mouse over otherwise empty drafting paper. The
     ghost preview shows distance + height change without persisting
     a point or forcing an expensive track rebuild. */
  await mp.mouse.move(110,510);
  await mp.waitForFunction(()=>{
    const label=document.getElementById('draftMeasure').textContent;
    return label.includes('m curve · ')&&label.includes('m H');
  },null,{timeout:7000});
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    snappedSide.nodes,'moving ghost preview never edits the coaster');
  await mp.touchscreen.tap(110,510);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes?.length===3;
  },null,{timeout:14000});
  const snappedTop=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(Math.abs(snappedTop.nodes[2].x%5),0,'TOP new turn X snaps to 5m');
  assert.equal(Math.abs(snappedTop.nodes[2].z%5),0,'TOP new turn Z snaps to 5m');
  assert.equal(snappedTop.nodes[2].h,snappedSide.nodes[1].h,
    'TOP still inherits exact lift crest height');
  await mp.locator('#btnGridSnap').tap();
  assert.equal(await mp.locator('#btnGridSnap').textContent(),'snap: off');
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    snappedTop.nodes,'toggling snap does not retroactively change any source point');
  console.log('PASS real 5m SNAP WebGL: TOP station, SIDE uphill new node, TOP turn and curved ghost readout; snap OFF leaves geometry unchanged');
  /* Round 30: pressing +node on a lift segment must place the control
     point ON the actual Catmull-Rom rail, not at the X/Z/H chord
     midpoint. This split must preserve auto lift on both halves.
     A real Undo/Redo must restore the exact source document. */
  const beforeRefine=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const expectedRefine=await mp.evaluate(async()=>{
    const THREE=await import('three');
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    const curve=new THREE.CatmullRomCurve3(d.nodes.map(n=>new THREE.Vector3(n.x,n.h,n.z)),
      false,'centripetal',0.5);
    const p=curve.getPoint(0.5/(d.nodes.length-1));
    const a=d.nodes[0],b=d.nodes[1];
    return {x:Math.round(p.x*10)/10,z:Math.round(p.z*10)/10,
      h:Math.round(THREE.MathUtils.clamp(p.y,Math.min(a.h,b.h)-1.5,
        Math.max(a.h,b.h)+1.5)*10)/10};
  });
  await mp.evaluate(()=>{
    document.getElementById('btnPrevNode').click();
    document.getElementById('btnPrevNode').click();
    document.getElementById('btnAdd').click();
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.building===true && d.nodes.length===4;
  },null,{timeout:12000});
  const afterRefine=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  for(const k of ['x','z','h'])assert.equal(afterRefine.nodes[1][k],expectedRefine[k],
    'new control '+k+' matches exact spline, not chord midpoint');
  assert.equal(afterRefine.nodes[0].station,true,'original station ownership remains');
  assert.ok(afterRefine.nodes[0].lift && afterRefine.nodes[1].lift,
    'splitting an automatic lift cannot silently disable either half');
  assert.deepEqual(afterRefine.nodes.slice(2),beforeRefine.nodes.slice(1),
    'refining a lift does not move subsequent source control points');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    beforeRefine.nodes,'refine Undo restores original coordinates and automatic lift status');
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    afterRefine.nodes,'refine Redo restores exact on-rail insertion and both lift flags');
  assert.deepEqual(mobileErrors,[], 'curved preview and lift refinement produce no mobile WebGL errors');
  console.log('PASS real WebGL CURVE REFINE: midpoint on original rail, chain retained on both split halves, exact Undo/Redo');
  /* Round 31: a real 390px phone editor accepts custom segment
     dimensions while keeping the dock's one-tap actions. Verify the
     button click results and exact defaults separately in the
     source-level regression—never silently alter old coasters. */
  await mp.evaluate(()=>{
    document.getElementById('btnNew').click();
    document.getElementById('btnNew').click();
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.building && d.nodes.length===0;
  });
  await mp.touchscreen.tap(195,380);
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes.length===1 && d.nodes[0].station;
  });
  await mp.evaluate(()=>{
    const h=document.getElementById('rngH');
    h.value='42.5';h.dispatchEvent(new Event('input',{bubbles:true}));
    h.dispatchEvent(new Event('change',{bubbles:true}));
    for(const [id,value] of [
      ['optSectionLength','30'],['optSectionTurn','30'],
      ['optSectionDropRun','35'],['optSectionDropHeight','12']
    ]) {
      const input=document.getElementById(id);
      input.value=value;input.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes[0].h===42.5 &&
      JSON.parse(localStorage.getItem('somelimits-section-dimensions-v1'))?.turnDegrees===30;
  });
  assert.ok((await mp.locator('#btnTurnLeft').getAttribute('title')).includes('30°'),
    'turn preview tooltip should reflect chosen angle');
  const beforeCustom=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.ok(!('turnDegrees' in beforeCustom),'editor preferences must not leak into saved coaster');
  await mp.locator('#btnContinue').tap();
  await mp.locator('#btnTurnLeft').tap();
  await mp.locator('#btnMakeDrop').tap();
  await mp.waitForFunction(()=>{
    const d=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return d?.nodes.length===4;
  },null,{timeout:12000});
  const custom=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(custom.nodes[1].h,42.5,'LEVEL stays on actual lift crest');
  assert.equal(custom.nodes[2].h,42.5,'custom turn stays level');
  assert.equal(custom.nodes[3].h,30.5,'custom DROP descends requested 12m');
  const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  assert.ok(Math.abs(distance(custom.nodes[0],custom.nodes[1])-30)<.001,'custom level run =30m');
  assert.ok(Math.abs(distance(custom.nodes[1],custom.nodes[2])-30)<.001,'custom turn run =30m');
  assert.ok(Math.abs(distance(custom.nodes[2],custom.nodes[3])-35)<.001,'custom drop forward run =35m');
  assert.ok(custom.nodes[2].x<custom.nodes[1].x-14,'custom LEFT direction turns by 30°');
  await mp.evaluate(()=>document.getElementById('btnUndo').click());
  const undoCustom=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(undoCustom.nodes.length,3,'custom drop Undo removes only its section');
  await mp.evaluate(()=>document.getElementById('btnRedo').click());
  assert.deepEqual((await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')))).nodes,
    custom.nodes,'custom dimension Redo restores exact geometry');
  console.log('PASS adjustable sections WebGL: 30m level, 30° turn, 35m forward /12m down drop, exact Undo/Redo and local preference isolation');
  assert.deepEqual(mobileErrors,[],'real blueprint continuation and camera views produced no WebGL errors');
  console.log('PASS blueprint WebGL: TOP new, 42.5m crest, LEVEL, LEFT, DROP, Undo/Redo, SIDE/FRONT/3D views');
  await mobile.close();

  /* A lone station has a special +X tangent fallback. Verify the
     SAME gestures on an elevated, banked, non-station control point
     in an actual completed circuit with a genuine geometric tangent.
     Frame Track computes its own camera from the sampled spline;
     the test projects the selected node from THE EXACT computeTrack
     source so no camera test hook is added to the player. */
  const loopNodes=[
    {x:-45,z:45,h:3,bank:0,station:true},
    {x:-45,z:-45,h:27,bank:40,lift:true},
    {x:20,z:-55,h:9,bank:60},
    {x:54,z:12,h:8,bank:-35},
    {x:0,z:62,h:3,bank:15}
  ];
  const realCore=gameSource.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
  assert.ok(realCore,'must project same physics source the game uses');
  const multi=await browser.newContext({viewport:{width:390,height:844},
    deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const q=await multi.newPage();
  const multiErrors=await prepare(q);
  await q.locator('#btnStartBuild').tap();
  await q.locator('#fileImp').setInputFiles([{
    name:'five-point-test.somelimits.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({app:'somelimits',version:1,
      name:'five point real touch',nodes:loopNodes}))
  }]);
  await q.waitForFunction(()=> {
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.building===false&&doc.nodes?.length===5&&doc.nodes[1].h===27;
  },null,{timeout:20000});
  await q.evaluate(()=>document.getElementById('btnFrame').click());

  async function projectedMultiPoint(idx,targetBank=null){
    const doc=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
    return q.evaluate(async ({core,nodes,idx,targetBank,gripSrc})=>{
      const THREE=await import('three');
      const computeTrack=new Function('THREE',core+'\nreturn computeTrack;')(THREE);
      const track=computeTrack(nodes);
      const mn=new THREE.Vector3(1e9,1e9,1e9),mx=new THREE.Vector3(-1e9,-1e9,-1e9);
      for(const sm of track.samples){mn.min(sm.pos);mx.max(sm.pos)}
      const center=mn.clone().add(mx).multiplyScalar(0.5);
      const radius=Math.max(20,mn.distanceTo(mx)/2);
      const dist=radius/Math.sin(THREE.MathUtils.degToRad(62/2))*1.05;
      const dir=new THREE.Vector3(0.85,0.62,1).normalize();
      const camera=new THREE.PerspectiveCamera(62,390/844,0.1,1000);
      camera.position.copy(center).addScaledVector(dir,dist);
      camera.lookAt(center);camera.updateMatrixWorld();
      const gripRadius=new Function('THREE','camera','COARSE','innerHeight',
        gripSrc+'\nreturn editGripRadius;')(THREE,camera,true,innerHeight)(nodes[idx]);
      const px=v=>{
        const p=v.clone().project(camera);
        return {x:Math.round((p.x+1)*390/2),y:Math.round((1-p.y)*844/2)};
      };
      const n=nodes[idx],prev=nodes[(idx-1+nodes.length)%nodes.length],
        next=nodes[(idx+1)%nodes.length];
      const tan=new THREE.Vector3(next.x-prev.x,next.h-prev.h,next.z-prev.z).normalize();
      const up=new THREE.Vector3(0,1,0).addScaledVector(tan,-tan.y).normalize();
      const side=new THREE.Vector3().crossVectors(up,tan).normalize();
      const roll=(deg)=>{
        const rad=THREE.MathUtils.degToRad(deg);
        return new THREE.Vector3(n.x,n.h,n.z)
          .addScaledVector(side,gripRadius*Math.cos(rad))
          .addScaledVector(up,-gripRadius*Math.sin(rad));
      };
      const pos=new THREE.Vector3(n.x,n.h,n.z);
      return {node:px(pos),cap:px(pos.clone().add(new THREE.Vector3(0,2.4,0))),
        grip:px(roll(n.bank)),gripTarget:px(roll(targetBank??n.bank)),
        gripRadius,index:idx,savedNode:n};
    },{core:realCore,nodes:doc.nodes,idx,targetBank,gripSrc});
  }

  const pick=await projectedMultiPoint(1);
  console.log('MULTI-NODE PIXELS '+JSON.stringify(pick));
  assert.ok(pick.node.x>45&&pick.node.x<345&&pick.node.y>120&&pick.node.y<425,
    'elevated non-station point must be inside the visible touch-safe viewport');
  await q.touchscreen.tap(pick.node.x,pick.node.y);
  await q.waitForFunction(()=>document.getElementById('nodeIdx').textContent==='#2 of 5',
    null,{timeout:12000});
  assert.equal(await q.locator('#rngB').inputValue(),'40',
    'selected non-station point must show its OWN 40° bank');

  const multiCDP=await multi.newCDPSession(q);
  const touch=(id,x,y)=>({id,x,y});
  const gesture=(type,pts)=>multiCDP.send('Input.dispatchTouchEvent',{type,touchPoints:pts});
  const beforeElevated=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const capP=await projectedMultiPoint(1);
  await gesture('touchStart',[touch(101,capP.cap.x,capP.cap.y)]);
  await gesture('touchMove',[touch(101,capP.cap.x,capP.cap.y-65)]);
  await gesture('touchEnd',[]);
  await q.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].h>h+2,
    beforeElevated.nodes[1].h,{timeout:18000});
  const higher=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(higher.nodes.filter((_,i)=>i!==1),beforeElevated.nodes.filter((_,i)=>i!==1),
    'dragging cap of node 2 must never shift the four neighboring nodes');
  assert.equal(higher.nodes[1].x,beforeElevated.nodes[1].x);
  assert.equal(higher.nodes[1].z,beforeElevated.nodes[1].z);
  assert.equal(higher.nodes[1].bank,beforeElevated.nodes[1].bank);
  await q.evaluate(()=>document.getElementById('btnUndo').click());
  await q.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].h===h,
    beforeElevated.nodes[1].h,{timeout:8000});
  await q.evaluate(()=>document.getElementById('btnRedo').click());
  await q.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].h===h,
    higher.nodes[1].h,{timeout:8000});
  console.log('PASS multi-node cap: edited only elevated point 2; four neighbors untouched; exact undo/redo');

  await q.evaluate(()=>document.getElementById('btnFrame').click());
  const beforeBank=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const gripP=await projectedMultiPoint(1,120);
  console.log('MULTI-NODE BANK PIXELS '+JSON.stringify(gripP));
  assert.ok(Math.hypot(gripP.grip.x-gripP.node.x,gripP.grip.y-gripP.node.y)>=14,
    'mobile grip must be at least 14 screen px from the node center');
  assert.ok(Math.hypot(gripP.gripTarget.x-gripP.grip.x,gripP.gripTarget.y-gripP.grip.y)>=12,
    'bank target must be far enough away to represent a deliberate gesture');
  await gesture('touchStart',[touch(111,gripP.grip.x,gripP.grip.y)]);
  const gripCursor=await q.evaluate(()=>document.querySelector('#app canvas')?.style.cursor);
  console.log('MULTI-NODE TOUCH PICK '+JSON.stringify({gripCursor}));
  await gesture('touchMove',[touch(111,gripP.gripTarget.x,gripP.gripTarget.y)]);
  await gesture('touchEnd',[]);
  await q.waitForFunction(b=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return Math.abs(doc.nodes[1].bank-b)>20;
  },beforeBank.nodes[1].bank,{timeout:18000});
  const banked=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(banked.nodes.filter((_,i)=>i!==1),beforeBank.nodes.filter((_,i)=>i!==1),
    'banking node 2 must not rewrite neighbor banking or any adjacent positions');
  for(const key of ['x','z','h','station','lift']){
    assert.equal(banked.nodes[1][key],beforeBank.nodes[1][key],
      'banking non-station node changed its '+key);
  }
  await q.evaluate(()=>document.getElementById('btnUndo').click());
  await q.waitForFunction(b=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].bank===b,
    beforeBank.nodes[1].bank,{timeout:8000});
  await q.evaluate(()=>document.getElementById('btnRedo').click());
  await q.waitForFunction(b=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].bank===b,
    banked.nodes[1].bank,{timeout:8000});
  assert.deepEqual(multiErrors,[],'real multi-node canvas editing raised browser errors');
  console.log('PASS multi-node bank: nonstation grip adjusts only point 2 bank, neighbors stable, undo/redo exact');

  /* The bank and height grips both work on an elevated nonstation
     node. Now verify touching the ACTUAL LIME NODE on the same
     completed, banked circuit. Large touch halos can overlap:
     center-aiming a lime point must start a point drag, not steal
     its orange cap or blue grip. This test catches that failure. */
  await q.evaluate(()=>document.getElementById('btnFrame').click());
  const groundBefore=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const groundP=await projectedMultiPoint(1);
  await gesture('touchStart',[touch(121,groundP.node.x,groundP.node.y)]);
  const nodeCursor=await q.evaluate(()=>document.querySelector('#app canvas').style.cursor);
  console.log('MULTI NODE DIRECT PICK '+JSON.stringify({nodeCursor,groundP}));
  /* A lime node pointerdown deliberately leaves cursor unchanged
     until the first move chooses horizontal vs vertical intent.
     Cap/grip set their own cursors synchronously on pointerdown.
     Assert neither special handle stole the press, then verify
     the actual axis intent after movement. */
  assert.ok(nodeCursor!=='ns-resize'&&nodeCursor!=='grabbing',
    'touch at lime centre must not be claimed by cap or bank grip');
  await gesture('touchMove',[touch(121,groundP.node.x+86,groundP.node.y+1)]);
  const groundCursor=await q.evaluate(()=>document.querySelector('#app canvas').style.cursor);
  assert.equal(groundCursor,'move','sideways node touch must resolve to ground-plan drag');
  await gesture('touchEnd',[]);
  await q.waitForFunction(before=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return Math.hypot(st.nodes[1].x-before.x,st.nodes[1].z-before.z)>4;
  },groundBefore.nodes[1],{timeout:18000});
  const groundAfter=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(groundAfter.nodes.filter((_,i)=>i!==1),groundBefore.nodes.filter((_,i)=>i!==1),
    'nonstation sideways lime drag moved neighbors');
  assert.equal(groundAfter.nodes[1].h,groundBefore.nodes[1].h,'sideways lime drag moved height');
  assert.equal(groundAfter.nodes[1].bank,groundBefore.nodes[1].bank,'sideways lime drag changed its banking');
  await q.evaluate(()=>document.getElementById('btnUndo').click());
  await q.waitForFunction(before=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st.nodes[1].x===before.x&&st.nodes[1].z===before.z;
  },groundBefore.nodes[1],{timeout:9000});
  await q.evaluate(()=>document.getElementById('btnRedo').click());
  await q.waitForFunction(after=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return st.nodes[1].x===after.x&&st.nodes[1].z===after.z;
  },groundAfter.nodes[1],{timeout:9000});
  console.log('PASS multi-node direct sideways lime drag: only point 2 x/z, height/bank unchanged, undo/redo exact');

  await q.evaluate(()=>document.getElementById('btnFrame').click());
  const directUpBefore=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const upP=await projectedMultiPoint(1);
  await gesture('touchStart',[touch(131,upP.node.x,upP.node.y)]);
  const upCursor=await q.evaluate(()=>document.querySelector('#app canvas').style.cursor);
  assert.ok(upCursor!=='ns-resize'&&upCursor!=='grabbing',
    'vertical drag touch at lime centre must not be claimed by cap/grip');
  await gesture('touchMove',[touch(131,upP.node.x+1,upP.node.y-90)]);
  const verticalCursor=await q.evaluate(()=>document.querySelector('#app canvas').style.cursor);
  assert.equal(verticalCursor,'ns-resize','vertical lime node touch should choose height intent');
  await gesture('touchEnd',[]);
  await q.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].h>h+3,
    directUpBefore.nodes[1].h,{timeout:18000});
  const directUpAfter=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(directUpAfter.nodes.filter((_,i)=>i!==1),directUpBefore.nodes.filter((_,i)=>i!==1),
    'nonstation vertical lime drag moved neighbors');
  for(const key of ['x','z','bank','station','lift']){
    assert.equal(directUpAfter.nodes[1][key],directUpBefore.nodes[1][key],
      'vertical lime drag changed '+key);
  }
  await q.evaluate(()=>document.getElementById('btnUndo').click());
  await q.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].h===h,
    directUpBefore.nodes[1].h,{timeout:9000});
  await q.evaluate(()=>document.getElementById('btnRedo').click());
  await q.waitForFunction(h=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[1].h===h,
    directUpAfter.nodes[1].h,{timeout:9000});
  console.log('PASS multi-node direct upward lime drag: only point 2 height, ground/bank unchanged, undo/redo exact');
  assert.deepEqual(multiErrors,[],'multi-node lime point gestures raised browser errors');

  /* The source-level BVH test proves exact terrain math and fewer
     segment projections. Exercise a real 80-node import AND edit
     through the actual browser to catch stale proximity indexes,
     geometry rebuild exceptions, or subtle saved-node corruption.
     Timing is diagnostic only: headless software WebGL is not a
     valid physical iPhone FPS benchmark. */
  const largeNodes=Array.from({length:80},(_,i)=>{
    const angle=i*Math.PI/40;
    return {x:Math.cos(angle)*(71+6*Math.sin(i*.42)),
      z:Math.sin(angle)*(63+8*Math.cos(i*.37)),
      h:8+15*(1+Math.sin(i*.19))/2,
      bank:Math.round(40*Math.sin(i*.27)),
      station:i===0,lift:i===1};
  });
  const importStarted=Date.now();
  await q.locator('#fileImp').setInputFiles([{
    name:'eighty-node-performance.somelimits.json',
    mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({app:'somelimits',version:1,
      name:'eighty-point browser performance',nodes:largeNodes}))
  }]);
  await q.waitForFunction(()=> {
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===80&&doc.nodes[0].station===true&&
      doc.name==='eighty-point browser performance';
  },null,{timeout:60000});
  const importWallMs=Date.now()-importStarted;
  const fullBefore=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  const desiredHeight=fullBefore.nodes[0].h+6;
  const editStarted=Date.now();
  await q.evaluate(value=>{
    const slider=document.getElementById('rngH');
    slider.value=String(value);
    slider.dispatchEvent(new Event('input',{bubbles:true}));
    slider.dispatchEvent(new Event('change',{bubbles:true}));
  },desiredHeight);
  await q.waitForFunction(h=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===80&&Math.abs(doc.nodes[0].h-h)<1e-7;
  },desiredHeight,{timeout:60000});
  const editWallMs=Date.now()-editStarted;
  const fullAfter=await q.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.deepEqual(fullAfter.nodes.slice(1),fullBefore.nodes.slice(1),
    '80-node height slider must not move any of 79 other nodes');
  assert.equal(fullAfter.nodes.filter(n=>n.station).length,1);
  await q.evaluate(()=>document.getElementById('btnUndo').click());
  await q.waitForFunction(h=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===80&&Math.abs(doc.nodes[0].h-h)<1e-7;
  },fullBefore.nodes[0].h,{timeout:60000});
  await q.evaluate(()=>document.getElementById('btnRedo').click());
  await q.waitForFunction(h=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===80&&Math.abs(doc.nodes[0].h-h)<1e-7;
  },fullAfter.nodes[0].h,{timeout:60000});
  assert.deepEqual(multiErrors,[],'80-node import/edit browser errors');
  console.log('PASS 80-node WebGL import/height edit/undo-redo: all 79 neighbors unchanged; '+
    'import wall '+importWallMs+'ms, slider edit wall '+editWallMs+'ms (software WebGL timing diagnostic)');
  await multi.close();

  console.log('PASS browser smoke: actual Three.js module + editor DOM in headless Chromium');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
