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

const root=fileURLToPath(new URL('../',import.meta.url));
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
  // Importmap URLs still name the exact shipped CDN dependency, but the
  // browser test supplies the already-installed Three.js files locally.
  // Test reliability is not dependent on a third-party CDN being up.
  await page.route('https://unpkg.com/three@0.160.0/**',async route=>{
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
  await page.goto(baseURL,{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForFunction(()=>window.__slBooted===true,null,{timeout:30000});
  assert.deepEqual(errors,[],'uncaught errors during boot');
  return errors;
}
try {
  browser=await chromium.launch({headless:true,args:[
    '--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
    '--enable-unsafe-swiftshader','--enable-webgl'
  ]});

  // Desktop: real game boot, editing, autosave, library save and lazy PNG.
  const desktop=await browser.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1});
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
    return {cssW:window.innerWidth,cssH:window.innerHeight,
      backingW:canvas.width,backingH:canvas.height};
  });
  assert.equal(dims.cssW,390);
  assert.equal(dims.backingW,780,'3x device must draw at capped 2x DPR');
  assert.equal(dims.backingH,1688,'mobile canvas height must cap at 2x');
  await mp.locator('#btnStartNew').tap();
  const blank=await mp.evaluate(()=>JSON.parse(localStorage.getItem('somelimits-autosave-v1')));
  assert.equal(blank.building,true);
  assert.equal(blank.nodes.length,0,'new must begin with an empty plot');
  // The plot center is clear of the folded mobile panel.
  await mp.touchscreen.tap(195,380);
  await mp.waitForFunction(()=>{
    const doc=JSON.parse(localStorage.getItem('somelimits-autosave-v1'));
    return doc?.nodes?.length===1 && doc.nodes[0].station===true;
  },null,{timeout:8000});
  assert.deepEqual(mobileErrors,[],'mobile page errors after station tap');
  console.log('PASS mobile WebGL: 3x -> 2x raster, blank plot, station placed by touch');

  await desktop.close();await mobile.close();
  console.log('PASS browser smoke: actual Three.js module + editor DOM in headless Chromium');
} finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
}
