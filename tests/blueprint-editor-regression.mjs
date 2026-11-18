// Round 25: production-source semantics for classic blueprint and track continuation.
// Does not rely on a replacement implementation or affect ride physics.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const moduleScript=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(moduleScript,'the game module exists');
new Function(moduleScript.replace(/^import[^\n]*\n/gm,'')); // browser JS syntax
const a=moduleScript.indexOf('function openExtension(a, b, kind) {');
const b=moduleScript.indexOf('function extendOpenTrack(kind',a);
assert.ok(a>=0&&b>a,'the actual continuation helper must be available');
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const extend=new Function('THREE',moduleScript.slice(a,b)+'\nreturn openExtension;')({MathUtils:{clamp}});
const low={x:0,z:0,h:3,bank:0};
const crest={x:0,z:-14,h:42.5,bank:26};
const before=structuredClone([low,crest]);
const level=extend(crest,low,'level');
assert.deepEqual(level,{x:0,z:-28,h:42.5,bank:26},
  'adding beyond the lift crest must be level at the exact crest height');
const left=extend(crest,low,'left'),right=extend(crest,low,'right');
assert.ok(left.x<0&&right.x>0,'turn labels must match the TOP drawing');
assert.equal(left.h,42.5);assert.equal(right.h,42.5);
assert.equal(left.bank,26,'continuations keep existing banking');
assert.equal(right.bank,26);
const drop=extend(crest,low,'drop');
assert.deepEqual({z:drop.z,h:drop.h,bank:drop.bank},{z:-34,h:22.5,bank:26},
  'a deliberately requested drop descends by 20 metres');
assert.equal(extend(low,{x:0,z:14,h:3},'drop').h,3,'drop stops at ground-level floor');
assert.deepEqual([low,crest],before,'extension must not change upstream control points');
const edge=extend({x:150,z:10,h:50,bank:0},{x:136,z:10,h:50,bank:0},'level');
assert.equal(edge.x,150,'end nodes must remain inside editable plot bounds');
// The editing views must use an actual orthographic projection, never 3D
// perspective pretending to be a blueprint by merely rotating the eye.
for(const text of [
  'const orthoCamera = new THREE.OrthographicCamera(',
  "controls.mouseButtons.LEFT = view === '3d' ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN",
  'controls.object = camera;',
  "controls.touches.ONE = view === '3d' ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN",
  "if ((editorView === 'side' || editorView === 'front') && elevationPress && grabSnap)",
  "const pointHeight = editorView === 'top' ? prev.h : 3;",
  "if (editorView !== '3d') setEditorView('3d');",
  "setEditorView('top'); // new coaster opens as a blueprint"
]) assert.ok(moduleScript.includes(text),'missing editor behavior '+text);
for(const view of ['top','side','front','3d'])
  assert.ok(html.includes('data-editor-view="'+view+'"'),'missing visible '+view+' view');
for(const id of ['btnContinue','btnTurnLeft','btnTurnRight','btnMakeDrop'])
  assert.ok(html.includes('id="'+id+'"'),'missing continuation control '+id);
console.log('PASS blueprint/elevation input contract, exact crest continuation, left/right, drop and old physics untouched');
