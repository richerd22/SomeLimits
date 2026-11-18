// Exact production-source regression for editable 2D node precision.
// No browser test dependencies; game module source is parsed unchanged.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../play/index.html',import.meta.url),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(source,'game module missing');
new Function(source.replace(/^import[^\n]*\n/gm,''));
const start=source.indexOf('function nudgeAxes(view,key,step) {');
const end=source.indexOf('function nudgeSelectedNode(key,step) {',start);
assert.ok(start>=0&&end>start,'production nudge helper not found');
const nudgeAxes=new Function(source.slice(start,end)+'\nreturn nudgeAxes;')();
assert.deepEqual(nudgeAxes('top','ArrowUp',1),{axis:'z',delta:-1});
assert.deepEqual(nudgeAxes('top','ArrowDown',5),{axis:'z',delta:5});
assert.deepEqual(nudgeAxes('top','ArrowLeft',.1),{axis:'x',delta:-.1});
assert.deepEqual(nudgeAxes('top','ArrowRight',1),{axis:'x',delta:1});
assert.deepEqual(nudgeAxes('side','ArrowRight',1),{axis:'x',delta:1});
assert.deepEqual(nudgeAxes('side','ArrowUp',5),{axis:'h',delta:5});
assert.deepEqual(nudgeAxes('side','ArrowDown',.1),{axis:'h',delta:-.1});
assert.deepEqual(nudgeAxes('front','ArrowRight',1),{axis:'z',delta:-1});
assert.deepEqual(nudgeAxes('front','ArrowLeft',1),{axis:'z',delta:1});
assert.deepEqual(nudgeAxes('front','ArrowDown',5),{axis:'h',delta:-5});
for(const invalid of [['3d','ArrowUp',1],['top','A',1],['side','ArrowUp',0],['front','ArrowRight',NaN]])
 assert.equal(nudgeAxes(...invalid),null,'invalid/view-relative nudge cannot mutate source');
const body=source.slice(end,source.indexOf("/* presets are a document replace",end));
assert.ok(body.includes('Math.round((n[axis]+change.delta)*10)/10'));
assert.ok(body.includes("axis==='h'?[1,80]:[-150,150]"));
assert.ok(body.includes('buildTrack(); commit();'),'each nudge must be undoable');
assert.ok(source.includes("e.altKey ? .1 : e.shiftKey ? 5 : 1"));
assert.ok(source.includes("e.key === '[' || e.key === ']'"));
assert.ok(source.includes("function stepSelectedNode(dir) {"));
assert.ok(html.includes('id="inpNodeX"')&&html.includes('id="inpNodeZ"'));
assert.ok(html.includes('id="btnPrevNode"')&&html.includes('id="btnNextNode"'));
// All convenience controls are editor actions only; not part of the
// source CORE or the serialized coaster document format.
const core=html.match(/\/\* === CORE START === \*\/([\s\S]*?)\/\* === CORE END === \*\//)?.[1];
assert.ok(core&&!core.includes('nudgeAxes('));
console.log('PASS exact TOP/SIDE/FRONT arrow nudge axes and steps, node iteration and pure data boundaries');
