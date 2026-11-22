// Round 32: linked orthographic editing is geometrically independent of
// the 3D physics renderer and edits only the visible source node axes.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planePoint,fromPlane,fitLinkedView,planeToCanvas,canvasToPlane,clampLinkedRect,linkedTangent,constrainToTangent} from '../play/linked-drafter.js';

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
const tangentNodes=[{x:0,z:0,h:3},{x:10,z:0,h:13},{x:30,z:10,h:23}];
const sideTangent=linkedTangent('side',tangentNodes,1,false);
assert.ok(sideTangent&&Math.abs(sideTangent.u-3/Math.sqrt(13))<1e-12&&
  Math.abs(sideTangent.v-2/Math.sqrt(13))<1e-12,'interior SIDE tangent follows the true neighboring node direction');
const tangentOrigin=planePoint('side',tangentNodes[1]);
const tangentMove=constrainToTangent(tangentOrigin,{u:26,v:9},sideTangent);
assert.ok(Math.abs((tangentMove.u-tangentOrigin.u)*sideTangent.v-
  (tangentMove.v-tangentOrigin.v)*sideTangent.u)<1e-12,'tangent constraint removes only perpendicular drag motion');
assert.equal(linkedTangent('top',[base],0,false),null,'one node has no invented tangent');
assert.ok(linkedTangent('top',tangentNodes,0,false),'open endpoint uses its one real adjacent direction');
assert.ok(linkedTangent('top',tangentNodes,0,true),'closed endpoint wraps to real final neighbor');

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
for(const rect of [
  {left:-400,top:-50,width:5000,height:3000},
  {left:1400,top:900,width:480,height:340},
  {left:100,top:120,width:390,height:310}
]){
 const b=clampLinkedRect(rect,1440,900);
 assert.ok(b.width>=360&&b.width<=1424,'desktop resize keeps a viable paper width');
 assert.ok(b.height>=200&&b.height<=884,'desktop resize keeps viable paper height');
 assert.ok(b.left>=8&&b.left+b.width<=1432,'desktop pane cannot disappear horizontally');
 assert.ok(b.top>=8&&b.top+b.height<=892,'desktop pane cannot disappear vertically');
 assert.ok(Object.values(b).every(Number.isFinite),'restored coordinates must be finite');
}
assert.deepEqual(clampLinkedRect({left:100,top:120,width:390,height:310},1440,900),
 {left:100,top:120,width:390,height:310},'normal layout is never silently moved');
const tiny=clampLinkedRect({left:-2,top:900,width:900,height:600},390,844);
assert.ok(tiny.left>=8&&tiny.top>=8&&tiny.left+tiny.width<=382);
assert.ok(tiny.top+tiny.height<=836);
const bad=clampLinkedRect({left:NaN,top:Infinity,width:0,height:NaN},1440,900);
assert.ok(Object.values(bad).every(Number.isFinite),'corrupt stored layout cannot poison editor geometry');
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const drafterSource=readFileSync(new URL('../play/linked-drafter.js',import.meta.url),'utf8');
for(const code of ["linkedTangent(view,s.nodes,s.selected,!s.building)","e.shiftKey ? constrainToTangent"])
  assert.ok(drafterSource.includes(code),'tangent interaction wiring missing '+code);
assert.ok(html.includes("import { createLinkedDrafter, clampLinkedRect } from './linked-drafter.js';"));
for(const name of ['linkedPane','linkedCanvas','btnLinkedPane','linkedFit','linkedZoomOut',
  'linkedZoomIn','linkedClose','linkedStatus','linkedResize'])
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
 "if (e.key === 'j' || e.key === 'J') toggleLinkedPane();",
 "function applyLinkedWindowRect(rect,persist=false){",
 "linkedWindow.style.right='auto';",
 "linkedWindow.style.bottom='auto';",
 "localStorage.setItem(LINKED_LAYOUT_KEY,JSON.stringify(next));",
 "grip.setPointerCapture(e.pointerId);",
 "applyLinkedWindowRect(gesture.original); // no partial preferences",
 "linkedResize.addEventListener('keydown',e=>{",
 "addEventListener('resize',restoreLinkedWindowLayout);"
])assert.ok(html.includes(code),'source node/edit lifecycle missing '+code);
const core=html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core&&!core.includes('linkedPane'),'physics core may not depend on second viewport');
console.log('PASS linked TOP/SIDE/FRONT projection math, reversible picking, axis isolation, 80-node fit, node lifecycle and physics boundary');
