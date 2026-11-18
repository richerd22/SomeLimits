// Source-backed no-dependency safety test for browser autosave and draft JSON.
// Run: node tests/draft-rescue-regression.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const script=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'game module missing');
new Function(script.replace(/^import[^\n]*\n/gm,'')); // syntax of entire player module
const core=html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core,'core markers missing');
const THREE={MathUtils:{clamp:(n,min,max)=>Math.max(min,Math.min(max,n))}};
const {serializeCoaster,serializeDraft,parseCoasterJSON,sanitizeDraftNodes}=new Function(
  'THREE',core+'\nreturn {serializeCoaster,serializeDraft,parseCoasterJSON,sanitizeDraftNodes};')(THREE);
const original=[
 {x:17,z:-12,h:3,bank:0,station:true},
 {x:18,z:-28,h:28,bank:-55,lift:true},
 {x:0,z:-38,h:3,bank:120},
 {x:-25,z:5,h:12,bank:-130},
 {x:-5,z:18,h:3,bank:0}
];
for(const count of [0,1,2,3,5]){
 const draft=original.slice(0,count);
 const saved=serializeDraft('unfinished build',draft);
 const payload=JSON.parse(saved);
 assert.equal(payload.app,'somelimits');
 assert.equal(payload.version,1);
 assert.equal(payload.building,true);
 assert.equal(payload.nodes.length,count);
 const parsed=parseCoasterJSON(saved);
 assert.equal(parsed.name,'unfinished build');
 assert.equal(parsed.building,true,'draft with '+count+' nodes must remain open');
 assert.equal(parsed.nodes.length,count);
 if(count) {
   assert.equal(parsed.nodes[0].station,true);
   assert.deepEqual(parsed.nodes.map(x=>x.bank),draft.map(x=>x.bank),
      'banking must stay on the same points');
 }
 const result=serializeDraft(parsed.name,parsed.nodes);
 assert.equal(result,saved,'draft format canonical round-trip '+count+' nodes');
}
const completed=JSON.parse(serializeCoaster('finished coaster',original));
assert.equal(completed.building,undefined,'completed save format unchanged');
const finished=parseCoasterJSON(JSON.stringify(completed));
assert.equal(finished.building,undefined);
assert.equal(finished.nodes.length,5);
assert.equal(parseCoasterJSON(JSON.stringify({app:'somelimits',nodes:original.slice(0,3)})),null,
  'unbranded short drafts cannot become a fake finished coaster');
assert.equal(parseCoasterJSON(JSON.stringify({app:'somelimits',building:true,nodes:'not array'})),null,
  'malformed draft must fail cleanly');
assert.equal(sanitizeDraftNodes([]).length,0);
assert.equal(sanitizeDraftNodes(null),null);
const changed=sanitizeDraftNodes([
 {x:500,z:-500,h:700,bank:400,station:false},
 {x:0,z:0,h:3,bank:-10,station:true}
]);
assert.equal(changed[0].x,200);
assert.equal(changed[0].z,-200);
assert.equal(changed[0].h,120);
assert.equal(changed[0].bank,180);
assert.equal(changed[0].station,true,'first draft node is the station');
assert.equal(changed[1].station,false,'other draft nodes must not take station role');

// Actual shipped autosave helper under a mock browser storage quota.
const start=script.indexOf('const AUTOSAVE_WARNING');
const stop=script.indexOf('function syncPanel()',start);
assert.ok(start>=0 && stop>start,'autosave warning helper missing');
const autosaveCode=script.slice(start,stop);
let full=false, writes=[],toasts=[];
const storage={setItem(k,v){if(full)throw Error('quota exceeded');writes.push({k,v});}};
const els={saveMsg:{textContent:''}};
const toast=(msg,ms)=>toasts.push({msg,ms});
const session=new Function('localStorage','els','toast','trackName','nodes','building',
 autosaveCode+'\nreturn {autosave,failed:()=>autosaveFailed,warning:AUTOSAVE_WARNING};')(
 storage,els,toast,'unfinished build',original.slice(0,2),true);
assert.equal(session.autosave(),true);
assert.equal(session.failed(),false);
assert.equal(writes.length,1);
assert.equal(JSON.parse(writes[0].v).building,true,'autosave preserves open state');
full=true;
assert.equal(session.autosave(),false);
assert.equal(session.autosave(),false);
assert.equal(session.failed(),true);
assert.equal(toasts.length,1,'quota warning must not spam every edit');
assert.equal(els.saveMsg.textContent,session.warning,'failure remains visible in the editor');
assert.ok(toasts[0].msg.toLowerCase().includes('export json'),'warn about practical recovery');
full=false;
assert.equal(session.autosave(),true,'storage recovery recognized');
assert.equal(session.failed(),false);
assert.equal(toasts.length,2,'one recovery notice');
assert.equal(els.saveMsg.textContent,'autosave working again.');
assert.equal(session.autosave(),true);
assert.equal(toasts.length,2,'successful repeated commits do not spam recovery');
full=true;
assert.equal(session.autosave(),false,'future failures are still announced');
assert.equal(toasts.length,3);

// Live UI is wired to the branded draft serializer and parser.
assert.ok(script.includes("serializeDraft(trackName, nodes)"));
assert.ok(script.includes("nodes = parsed.nodes; building = !!parsed.building;"));
assert.ok(script.includes("if (building && nodes.length < 2) framePlot();"));
console.log('PASS: 0/1/2/3/5-node open drafts, canonical round-trip, finished schema, bounds/station, quota warning and recovery');
