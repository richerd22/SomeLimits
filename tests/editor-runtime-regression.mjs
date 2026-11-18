// Zero-dependency checks for the browser editor's resource lifecycle.
// Run: node tests/editor-runtime-regression.mjs
// No DOM, GPU, install or build step needed.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html = readFileSync(new URL('../play/index.html', import.meta.url), 'utf8');
const script = html.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
assert.ok(script, 'game module not found');
new Function(script.replace(/^import [^\n]*\n/gm, '')); // syntax-only parse

// Transient track and handle groups must dispose their OWN resources,
// once each, even when several meshes share geometry/material objects.
const disposeCode = 'function disposeEditGroup(group) {' +
  script.split('function disposeEditGroup(group) {')[1]?.split('\nfunction addHitProxy')[0];
assert.ok(disposeCode && disposeCode.includes('geo.dispose()'), 'group disposer missing');
let removed = 0, disposedGeo = 0, disposedMat = 0, proxyGeoDisposed = 0, proxyMatDisposed = 0;
const proxyGeoUnit = {dispose() {proxyGeoDisposed++;}};
const hitProxyMat = {dispose() {proxyMatDisposed++;}};
const geo = {dispose() {disposedGeo++;}};
const mat = {dispose() {disposedMat++;}};
const scene = {remove(){removed++;}};
const disposeEditGroup = new Function('scene', 'proxyGeoUnit', 'hitProxyMat',
  disposeCode + '\nreturn disposeEditGroup;')(scene, proxyGeoUnit, hitProxyMat);
disposeEditGroup({traverse(fn){
  fn({geometry:geo,material:mat});
  fn({geometry:geo,material:mat}); // shared within one group
  fn({geometry:proxyGeoUnit,material:hitProxyMat}); // persistent touch halo
  fn({material:[mat,hitProxyMat]});
}});
assert.equal(removed, 1);
assert.equal(disposedGeo, 1);
assert.equal(disposedMat, 1);
assert.equal(proxyGeoDisposed, 0);
assert.equal(proxyMatDisposed, 0);
disposeEditGroup(null);

// Many pointer events per frame must yield one latest-shape preview.
// Cancelling a scheduled preview before a committed rebuild must be safe.
const previewSource = script.split('let previewFrame = 0;')[1]?.split('function buildTrack() {')[0];
assert.ok(previewSource?.includes('cancelTrackPreview'), 'preview helpers missing');
let nextId = 1, builds = 0;
const scheduled = new Map();
const requestAnimationFrame = fn => {const id=nextId++;scheduled.set(id,fn);return id;};
const cancelAnimationFrame = id => scheduled.delete(id);
const {queueTrackPreview,cancelTrackPreview} = new Function(
  'requestAnimationFrame','cancelAnimationFrame','buildTrack',
  'let previewFrame = 0;' + previewSource +
  '\nreturn {queueTrackPreview,cancelTrackPreview};'
)(requestAnimationFrame,cancelAnimationFrame,() => {builds++;});
for(let i=0;i<100;i++) queueTrackPreview();
assert.equal(scheduled.size,1,'pointer flood should queue only one preview');
const first = [...scheduled.entries()][0];scheduled.delete(first[0]);first[1]();
assert.equal(builds,1);
queueTrackPreview();cancelTrackPreview();
assert.equal(scheduled.size,0);
assert.equal(builds,1);
queueTrackPreview();
const second=[...scheduled.entries()][0];scheduled.delete(second[0]);second[1]();
assert.equal(builds,2);

// The library saves editable nodes, never generated PNG data URIs.
// Legacy PNGs are stripped on the next write without losing user data.
const storeSrc = 'function storeLib(lib) {' +
  script.split('function storeLib(lib) {')[1]?.split('\nfunction saveToLibrary')[0];
assert.ok(storeSrc?.includes('compact'), 'compact library store missing');
let stored='', failed=false, warned=0;
const localStorage = {setItem(_key,value){if(failed)throw Error('quota');stored=value;}};
const libraryCache = new Map([['orphan', {src:'old png'}], ['one', {src:'kept png'}]]);
const storeLib = new Function('localStorage','LIB_KEY','toast','libraryBlueprints',storeSrc+'\nreturn storeLib;')(
  localStorage,'somelimits-library-v1',()=>{warned++;},libraryCache);
const sample=[{id:'one',name:'Coaster',nodes:[{x:0,h:3,z:0}],thumb:'data:image/png;base64,huge',
  stats:{len:100,maxH:3,count:1},custom:'keep me'}];
assert.equal(storeLib(sample),true);
const parsed=JSON.parse(stored);
assert.equal(parsed[0].thumb,undefined);
assert.equal(parsed[0].name,'Coaster');
assert.equal(parsed[0].custom,'keep me');
assert.ok(sample[0].thumb,'input should remain intact');
assert.ok(libraryCache.has('one'), 'retained coaster keeps cached blueprint');
assert.equal(libraryCache.has('orphan'),false, 'deleted coaster must evict its cached PNG');
failed=true;
assert.equal(storeLib(sample),false,'failed writes must report failure');
assert.equal(warned,1,'quota failure needs a real warning');

// Images live in memory, derived from nodes; editing invalidates cache.
const cacheSrc = 'const libraryBlueprints = new Map();' +
  script.split('const libraryBlueprints = new Map();')[1]?.split('\nlet libArmId')[0];
let renders=0;
const libraryBlueprint = new Function('blueprint',cacheSrc+'\nreturn libraryBlueprint;')(
  nodes => {renders++;return 'blueprint_'+JSON.stringify(nodes);});
const entry={id:'one',nodes:[{x:0,z:0,h:3}]};
assert.equal(libraryBlueprint(entry),libraryBlueprint(entry));
assert.equal(renders,1,'library rerender must reuse the thumbnail');
entry.nodes[0].x=12;
assert.notEqual(libraryBlueprint(entry),'blueprint_[]');
assert.equal(renders,2,'an edited layout needs a fresh thumbnail');

console.log('PASS: syntax, GPU disposal, preview coalescing, compact saves, cache invalidation, quota errors');
