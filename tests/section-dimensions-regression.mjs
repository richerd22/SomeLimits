// Round 31: easy defaults remain bit-for-bit, advanced section
// dimensions modify ONLY future editor points, never the ride core.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source);
new Function(source.replace(/^import[^\n]*\n/gm,''));
const a=source.indexOf('function openExtension(a, b, kind) {');
const b=source.indexOf("function extendOpenTrack(kind = 'level') {",a);
assert.ok(a>=0&&b>a);
const core=s=>s.indexOf("/* === CORE START === */");
const THREE={MathUtils:{clamp:(v,lo,hi)=>Math.max(lo,Math.min(hi,v))}};
const extend=new Function('THREE',source.slice(a,b)+'\nreturn openExtension;')(THREE);
const crest={x:0,z:-14,h:42.5,bank:26};
const prev={x:0,z:0,h:3,bank:0};
const unchanged=structuredClone([crest,prev]);
assert.deepEqual(extend(crest,prev,'level'),{x:0,z:-28,h:42.5,bank:26},
  'existing level button 14m untouched');
assert.deepEqual(extend(crest,prev,'drop'),{x:0,z:-34,h:22.5,bank:26},
  'existing 20/20 drop untouched');
assert.ok(extend(crest,prev,'left').x<0);
assert.ok(extend(crest,prev,'right').x>0);
const p={length:30,turnDegrees:30,dropRun:35,dropHeight:12};
assert.deepEqual(extend(crest,prev,'level',p),{x:0,z:-44,h:42.5,bank:26});
assert.equal(extend(crest,prev,'drop',p).z,-49);
assert.equal(extend(crest,prev,'drop',p).h,30.5);
const l=extend(crest,prev,'left',p),r=extend(crest,prev,'right',p);
assert.ok(Math.abs(l.x+15)<1e-9&&Math.abs(r.x-15)<1e-9,
  '30-degree turn changes heading by exactly requested angle');
assert.ok(Math.abs(l.z-r.z)<1e-9&&l.h===42.5&&r.h===42.5);
assert.equal(l.bank,26);
assert.equal(extend({x:0,z:-14,h:10,bank:0},prev,'drop',p).h,3,
  'requested drop clamps to established 3m floor');
const invalid={length:NaN,turnDegrees:Infinity,dropRun:-Infinity,dropHeight:NaN};
assert.deepEqual(extend(crest,prev,'level',invalid),extend(crest,prev,'level'));
assert.deepEqual(extend(crest,prev,'drop',invalid),extend(crest,prev,'drop'));
const out=extend(crest,prev,'drop',{length:-100,turnDegrees:600,dropRun:1000,dropHeight:500});
assert.equal(out.z,-74,'drop run clamps to 60m');
assert.equal(out.h,3,'drop height clamps and keeps floor');
assert.deepEqual([crest,prev],unchanged,'source control points stay immutable');
const required=[
  "const SECTION_PREF_KEY = 'somelimits-section-dimensions-v1';",
  "length:14,turnDegrees:45,dropRun:20,dropHeight:20",
  "function updateSectionTooltips() {",
  "localStorage.setItem(SECTION_PREF_KEY,JSON.stringify(sectionPrefs));",
  "const next = openExtension(a, b, kind, sectionPrefs);",
  "nodes.push(openExtension(a, b, 'level', sectionPrefs));",
  "$('sectionOptions').style.display = mode === 'edit' && building ? 'block' : 'none';",
  "$('sectionOptions').style.display = m === 'edit' && building ? 'block' : 'none';"
];
for(const word of required)assert.ok(source.includes(word),'missing UI/selection lifecycle '+word);
for(const id of ['sectionOptions','optSectionLength','optSectionTurn','optSectionDropRun','optSectionDropHeight'])
 assert.ok(html.includes('id="'+id+'"'),'missing advanced setting '+id);
const rideCore=source.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(rideCore&&!rideCore.includes('sectionPrefs'),
  'advanced editor preferences cannot enter physical ride model');
console.log('PASS default geometry, custom run/turn/drop, clamp + invalid handling, persistence isolation and pure physics boundary');
