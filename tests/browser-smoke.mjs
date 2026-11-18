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
  const blank=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(blank.building,true);
  assert.equal(blank.nodes.length,0,'new must begin with an empty plot');
  await mp.waitForFunction(()=>document.getElementById('hLabel').style.display==='none',
    null,{timeout:8000}); // no point = no floating number
  // The plot center is clear of the folded mobile panel.
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
  async function loneHandlePixels(){
    await mp.evaluate(()=>document.getElementById('btnFrame').click());
    return mp.evaluate(async ()=>{
      const THREE=await import('three');
      const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
      const n=doc.nodes[0];
      const eye=new THREE.PerspectiveCamera(62,innerWidth/innerHeight,0.1,1000);
      eye.position.set(n.x+52,n.h+44,n.z+74);
      eye.lookAt(n.x,n.h,n.z);
      eye.updateMatrixWorld();
      const screen=(x,y,z)=>{
        const v=new THREE.Vector3(x,y,z).project(eye);
        return {x:Math.round((v.x+1)*innerWidth/2),
                y:Math.round((1-v.y)*innerHeight/2)};
      };
      /* A lone station's tangent is +X by definition. Its bank
         starts at 0, so fr.side is world -Z; +90 banks to -Y. */
      return {cap:screen(n.x,n.h+2.4,n.z),
              grip:screen(n.x,n.h,n.z-2.6),
              rollDown:screen(n.x,n.h-2.6,n.z),
              node:{...n}};
    });
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
  await mp.waitForFunction(b=>{
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return Math.abs(st.nodes[0].bank-b)>30;
  },beforeGrip.nodes[0].bank,{timeout:11000});
  const midGrip=await mp.evaluate(()=>{
    const label=document.getElementById('hLabel');
    return {label:label.textContent,inlineDisplay:label.style.display,
      computedDisplay:getComputedStyle(label).display,
      bank:Number(document.getElementById('rngB').value),
      bankValue:document.getElementById('bVal').textContent,
      saved:JSON.parse(localStorage.getItem('somelimits-autosave-v1')).nodes[0]};
  });
  console.log('LIVE GRIP READOUT DIAGNOSTICS '+JSON.stringify(midGrip));
  await mp.waitForFunction(b=>{
    const label=document.getElementById('hLabel');
    const st=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return label.style.display==='block'&&label.textContent.startsWith('bank ')&&
      Math.abs(st.nodes[0].bank-b)>30 &&
      label.textContent==='bank '+st.nodes[0].bank+' deg';
  },beforeGrip.nodes[0].bank,{timeout:8000});
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
  assert.deepEqual(mobileErrors,[],'mobile errors after precision handle and touch tests');

  await mobile.close();
  console.log('PASS browser smoke: actual Three.js module + editor DOM in headless Chromium');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
