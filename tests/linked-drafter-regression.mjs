// Round 32: linked orthographic editing is geometrically independent of
// the 3D physics renderer and edits only the visible source node axes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planePoint,fromPlane,fitLinkedView,planeToCanvas,canvasToPlane} from '../play/linked-drafter.js';

const base={x:17.3,z:-26.6,h:42.5,bank:-35,station:true,lift:true};
const old=structuredClone(base);
assert.deepEqual(planePoint('top',base),{u:17.3,v:26.6});
assert.deepEqual(planePoint('side',base),{u:17.3,v:42.5});
assert.deepEqual(planePoint('front',base),{u:26.6,v:42.5});
assert.deepEqual(planePoint('side',{x:17.3,y:42.5,z:-26.6}),{u:17.3,v:42.5},
  'actual THREE Vector3 track samples use Y instead of source-node H');
assert.deepEqual(fromPlane('top',{u:24.16,v:-11.16},base),
  {x:24.2,z:11.2,h:42.5,bank:-35});
assert.deepEqual(fromPlane('side',{u:28.04,v:19.54},base),
  {x:28,z:-26.6,h:19.5,bank:-35});
assert.deepEqual(fromPlane('front',{u:-30.05,v:36.11},base),
  {x:17.3,z:30.1,h:36.1,bank:-35});
assert.deepEqual(fromPlane('side',{u:23.4,v:26},base,5),
  {x:25,z:-26.6,h:25,bank:-35});
assert.deepEqual(fromPlane('front',{u:-34,v:46},base,5),
  {x:17.3,z:35,h:45,bank:-35});
assert.deepEqual(fromPlane('top',{u:300,v:-400},base),
  {x:150,z:150,h:42.5,bank:-35});
assert.deepEqual(fromPlane('side',{u:300,v:-400},base),
  {x:150,z:-26.6,h:1,bank:-35});
assert.equal(fromPlane('side',{u:Infinity,v:0},base),null);
assert.equal(fromPlane('front',{u:0,v:NaN},base),null);
assert.deepEqual(base,old,'draw projections cannot mutate nodes or station/lift flags');

for(const view of ['top','side','front']){
  const nodes=[base,{x:30,z:60,h:6,bank:40},{x:-45,z:-22,h:27,bank:80}];
  const samples=[{pos:{x:31,y:66,z:-25}},{pos:{x:-16,y:40,z:22}}];
  const vp=fitLinkedView(view,nodes,samples,360,226);
  assert.ok(Number.isFinite(vp.u)&&Number.isFinite(vp.v)&&Number.isFinite(vp.scale));
  assert.ok(vp.scale>=.12,'fit bounds must never create an invalid scale');
  for(const p of nodes){
    const point=planePoint(view,p);
    const scr=planeToCanvas(vp,point,360,226);
    const rt=canvasToPlane(vp,scr.x,scr.y,360,226);
    assert.ok(Math.abs(rt.u-point.u)<1e-10&&Math.abs(rt.v-point.v)<1e-10,
      'screen/world roundtrip must preserve coordinates');
    assert.ok(scr.x>=0&&scr.x<=360&&scr.y>=0&&scr.y<=226,'fit must keep nodes visible');
  }
}
assert.ok(fitLinkedView('top',[],[],390,230).scale>0);
assert.ok(fitLinkedView('side',[base],[],390,230).scale>0);
const many=Array.from({length:80},(_,i)=>({
  x:i*2-80,z:Math.sin(i*.22)*36,h:5+Math.cos(i*.25)*3
}));
for(const view of ['top','side','front']){
 const vp=fitLinkedView(view,many,[],380,220);
 assert.ok(vp.scale>=.12&&vp.scale<=30,'large coaster fits without invalid zoom');
}
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
assert.ok(html.includes("import { createLinkedDrafter } from './linked-drafter.js';"));
for(const name of ['linkedPane','linkedCanvas','btnLinkedPane','linkedFit','linkedZoomOut',
  'linkedZoomIn','linkedClose','linkedStatus'])
  assert.ok(html.includes('id="'+name+'"'),'linked pane control missing '+name);
for(const code of [
 "linkedPane = createLinkedDrafter({",
 "linkedPane?.refresh();",
 "linkedPane?.resetFraming();",
 "linkedPane?.syncMode();",
 "buildClickAtElevation(node);",
 "queueTrackPreview(); // shared one-per-frame original spline",
 "buildTrack();commit(); // one Undo entry for the entire linked drag",
 "onRestore(index, original)",
 "if (e.key === 'j' || e.key === 'J') toggleLinkedPane();"
])assert.ok(html.includes(code),'source node/edit lifecycle missing '+code);
const core=html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core&&!core.includes('linkedPane'),'physics core may not depend on second viewport');
console.log('PASS linked TOP/SIDE/FRONT projection math, reversible picking, axis isolation, 80-node fit, node lifecycle and physics boundary');
