// Browser-independent regression for lazy library thumbnails and device DPR.
// Run: node tests/library-render-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game script missing');
new Function(script.replace(/^import[^\n]*\n/gm,''));

const pStart=script.indexOf('function gamePixelRatio(dpr)');
const pEnd=script.indexOf('\nconst renderer =',pStart);
assert.ok(pStart>=0 && pEnd>pStart,'render ratio helper missing');
const gamePixelRatio = new Function(script.slice(pStart,pEnd)+'\nreturn gamePixelRatio;')();
assert.equal(gamePixelRatio(3),2,'3x phone must cap at 2x');
assert.equal(gamePixelRatio(2),2,'Retina 2x stays sharp');
assert.equal(gamePixelRatio(1),1,'desktop 1x unchanged');
assert.equal(gamePixelRatio(1.5),1.5,'fractional DPR preserved');
assert.equal(gamePixelRatio(0),1,'invalid DPR falls back to 1x');
assert.equal(gamePixelRatio(NaN),1,'NaN DPR falls back to 1x');
assert.ok(script.includes('renderer.setPixelRatio(gamePixelRatio(window.devicePixelRatio));'));
assert.ok(script.includes('if (ratio !== renderer.getPixelRatio())'));

const start=script.indexOf('const libraryBlueprints = new Map();');
const end=script.indexOf('\nlet libArmId',start);
assert.ok(start>=0 && end>start,'thumbnail helpers missing');
const source=script.slice(start,end);
let renderCount=0;
const blueprint=nodes=> {renderCount++;return 'image_'+JSON.stringify(nodes);};
class FakeObserver {
  constructor(cb,opts){this.cb=cb;this.opts=opts;this.targets=new Set();this.disconnected=false;FakeObserver.current=this;}
  observe(t){this.targets.add(t);}
  unobserve(t){this.targets.delete(t);}
  disconnect(){this.disconnected=true;this.targets.clear();}
  enter(t){if(this.targets.has(t))this.cb([{target:t,isIntersecting:true}],this);}
}
function instantiate(observer){
  return new Function('blueprint','IntersectionObserver',source+
    '\nreturn {libraryBlueprint,libraryBlueprints,queueLibraryThumb,resetLibraryThumbObserver};')(
    blueprint,observer);
}
const l=instantiate(FakeObserver);
l.resetLibraryThumbObserver();
const first=FakeObserver.current;
assert.equal(first.opts.rootMargin,'180px 0px');
const entry={id:'A',name:'A',nodes:[{x:1,z:2,h:3}]};
const img={src:''};
l.queueLibraryThumb(img,entry);
assert.equal(renderCount,0,'invisible thumbnail should not rebuild a spline');
assert.equal(img.src,'');
assert.equal(first.targets.has(img),true);
first.enter(img);
assert.equal(renderCount,1,'visible thumbnail should render exactly once');
assert.ok(img.src.startsWith('image_'));
assert.equal(first.targets.size,0,'observer must release rendered thumbnail');
const again={src:''};
l.queueLibraryThumb(again,entry);
first.enter(again);
assert.equal(renderCount,1,'cached thumbnail should not regenerate');
l.resetLibraryThumbObserver();
assert.equal(first.disconnected,true,'rerender should detach old observer');
const second=FakeObserver.current;
const newImg={src:''}; l.queueLibraryThumb(newImg,{id:'B',nodes:[{x:2}]});
second.enter(newImg);
assert.equal(renderCount,2);
assert.equal(l.libraryBlueprints.size,2);

// Bounded cache: a large library never pins hundreds of derived PNGs.
for(let i=0;i<50;i++)l.libraryBlueprint({id:'number_'+i,nodes:[{x:i}]});
assert.equal(l.libraryBlueprints.size,40);
assert.equal(l.libraryBlueprints.has('A'),false,'oldest entry should evict first');
const oldCount=renderCount;
l.libraryBlueprint(entry);
assert.equal(renderCount,oldCount+1,'evicted entry regenerates from source nodes');
assert.equal(l.libraryBlueprints.has('A'),true);
// Recency reorder: touching A again makes it newest without re-render.
const before=renderCount;l.libraryBlueprint(entry);assert.equal(renderCount,before);

// On old browsers without IntersectionObserver the gallery must still work.
const eager=instantiate(undefined);
eager.resetLibraryThumbObserver();
const fallback={src:''};
const prev=renderCount;
eager.queueLibraryThumb(fallback,{id:'old-browser',nodes:[{x:7}]});
assert.ok(fallback.src.startsWith('image_'));
assert.equal(renderCount,prev+1,'fallback should draw synchronously');

// Source integration contract: renderLib resets observer and queues images.
const renderLibSource=script.slice(script.indexOf('function renderLib() {'),script.indexOf('function download(',script.indexOf('function renderLib() {')));
assert.ok(renderLibSource.includes('resetLibraryThumbObserver();'));
assert.ok(renderLibSource.includes("queueLibraryThumb(div.querySelector('img'), entry);"));
assert.ok(html.includes('aspect-ratio:3/2'),'image placeholders must reserve space');

console.log('PASS: 2x mobile DPR cap, resize, off-screen lazy thumbs, observer lifecycle, 40-card LRU, legacy fallback');
