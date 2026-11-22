/* SomeLimits linked 2D drafter, Round 32.
   Plain ES module. No second WebGL context, generated assets, physics or
   document schema. Every edit is routed through the original editor. */

export const LINKED_VIEWS = Object.freeze(['top','side','front']);
const LINKED_TANGENT_LOCK_KEY='somelimits-linked-tangent-lock-v1';

export function planePoint(view, node) {
  if (view === 'top') return {u: node.x, v: -node.z};
  if (view === 'side') return {u: node.x, v: node.h ?? node.y};
  if (view === 'front') return {u: -node.z, v: node.h ?? node.y};
  throw new RangeError('invalid drawing plane');
}

export function fromPlane(view, point, base = {x:0,z:0,h:3,bank:0}, snap = 0) {
  const quantize = (v, lo, hi) => {
    if (!Number.isFinite(v)) return null;
    const rounded = snap === 1 || snap === 5 ?
      Math.round(v/snap)*snap : Math.round(v*10)/10;
    return Math.max(lo, Math.min(hi, rounded));
  };
  if (!point || !Number.isFinite(point.u) || !Number.isFinite(point.v))
    return null;
  if (view === 'top') return {
    x:quantize(point.u,-150,150),z:quantize(-point.v,-150,150),
    h:base.h,bank:base.bank
  };
  if (view === 'side') return {
    x:quantize(point.u,-150,150),z:base.z,
    h:quantize(point.v,1,80),bank:base.bank
  };
  if (view === 'front') return {
    x:base.x,z:quantize(-point.u,-150,150),
    h:quantize(point.v,1,80),bank:base.bank
  };
  return null;
}
export function fitLinkedView(view, nodes, samples, width, height) {
  const points = [];
  for (const n of nodes || []) points.push(planePoint(view,n));
  for (const sm of samples || []) points.push(planePoint(view,sm.pos || sm));
  if (!points.length) points.push({u:0,v:0});
  let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  for (const p of points) {
    minU=Math.min(minU,p.u);maxU=Math.max(maxU,p.u);
    minV=Math.min(minV,p.v);maxV=Math.max(maxV,p.v);
  }
  if (view!=='top') minV=Math.min(minV,0); // keep ground reference visible
  const spanU=Math.max(32,maxU-minU+18);
  const spanV=Math.max(28,maxV-minV+18);
  const w=Math.max(80,width-42),h=Math.max(60,height-38);
  return {u:(minU+maxU)/2,v:(minV+maxV)/2,
    scale:Math.max(.12,Math.min(30,w/spanU,h/spanV))};
}
/* Keep a movable/resizable secondary drawing fully onscreen. Pure
   layout math: not a node, game camera, track sample or physics input. */
export function clampLinkedRect(rect, windowWidth, windowHeight) {
  const w=Math.max(1,windowWidth),h=Math.max(1,windowHeight);
  const minW=Math.min(360,Math.max(100,w-16));
  const minH=Math.min(200,Math.max(100,h-16));
  const width=Math.max(minW,Math.min(Number.isFinite(rect?.width)?rect.width:390,w-16));
  const height=Math.max(minH,Math.min(Number.isFinite(rect?.height)?rect.height:310,h-16));
  const left=Math.max(8,Math.min(Number.isFinite(rect?.left)?rect.left:w-width-12,w-width-8));
  const top=Math.max(8,Math.min(Number.isFinite(rect?.top)?rect.top:h-height-12,h-height-8));
  return {left:Math.round(left),top:Math.round(top),width:Math.round(width),height:Math.round(height)};
}
export function canvasToPlane(viewport, x, y, width, height) {
  return {u:viewport.u+(x-width/2)/viewport.scale,
    v:viewport.v-(y-height/2)/viewport.scale};
}
export function planeToCanvas(viewport, point, width, height) {
  return {x:width/2+(point.u-viewport.u)*viewport.scale,
    y:height/2-(point.v-viewport.v)*viewport.scale};
}

/* Catmull-Rom derives a node's direction from its neighbouring control
   points. This is deliberately a guide/constraint, not another saved handle:
   the same source nodes still define the rail, its physics and every preset. */
export function linkedTangent(view, nodes, index, closed = false) {
  if (!Array.isArray(nodes) || index < 0 || index >= nodes.length || nodes.length < 2)
    return null;
  const count=nodes.length;
  const before=index>0 ? index-1 : (closed ? count-1 : index);
  const after=index<count-1 ? index+1 : (closed ? 0 : index);
  const a=planePoint(view,nodes[before]),b=planePoint(view,nodes[after]);
  const u=b.u-a.u,v=b.v-a.v,length=Math.hypot(u,v);
  return length>1e-8 ? {u:u/length,v:v/length} : null;
}
export function constrainToTangent(origin, candidate, tangent) {
  if (!origin || !candidate || !tangent) return candidate;
  const distance=(candidate.u-origin.u)*tangent.u+(candidate.v-origin.v)*tangent.v;
  return {u:origin.u+distance*tangent.u,v:origin.v+distance*tangent.v};
}

export function createLinkedDrafter({
  element,canvas,getState,onSelect,onMove,onCommit,onRestore,onPlace,onClose
}) {
  const ctx=canvas.getContext('2d',{alpha:false});
  if (!ctx) return {refresh(){},resetFraming(){},syncMode(){},setVisible(){},getView(){return 'top';}};
  const status=element.querySelector('#linkedStatus');
  const tangentToggle=element.querySelector('#linkedTangent');
  const viewButtons=Array.from(element.querySelectorAll('[data-linked-view]'));
  const viewports={top:null,side:null,front:null};
  const chooser=element.querySelector('#linkedMode');
  let view='top',visible=false,active=null,lastWidth=0,lastHeight=0,tangentLocked=false;
  let drawnNodeCount=-1;
  canvas.style.touchAction='none';canvas.tabIndex=0;
  /* The pane can be resized without rebuilding rails or reallocating
     WebGL resources. Canvas backing pixels follow CSS size at DPR≤2. */
  if(typeof ResizeObserver!=='undefined'){
    const sizeObserver=new ResizeObserver(()=>{if(visible)refresh()});
    sizeObserver.observe(canvas);
  }
  const dimensions=()=>{
    const rect=canvas.getBoundingClientRect();
    return {w:Math.max(1,rect.width),h:Math.max(1,rect.height)};
  };
  const coordinates=e=>{
    const b=canvas.getBoundingClientRect();
    return {x:e.clientX-b.left,y:e.clientY-b.top};
  };
  function state(){return getState();}
  function viewport() {
    const {w,h}=dimensions();
    if (!viewports[view]) {
      const s=state();
      viewports[view]=fitLinkedView(view,s.nodes,s.track?.samples,w,h);
    }
    return viewports[view];
  }
  function setStatus(value) {
    if (status) status.textContent=value;
  }
  function setTangentLocked(value,persist=false) {
    tangentLocked=!!value;
    tangentToggle?.setAttribute('aria-pressed',String(tangentLocked));
    tangentToggle?.setAttribute('title',tangentLocked ?
      'Tangent lock is on: drag follows the gold guide' :
      'Lock linked node drags to the visible tangent');
    if(persist)try { localStorage.setItem(LINKED_TANGENT_LOCK_KEY,tangentLocked?'1':'0'); } catch {}
  }
  try {
    const saved=localStorage.getItem(LINKED_TANGENT_LOCK_KEY);
    if(saved==='1'||saved==='0')tangentLocked=saved==='1';
  } catch {}
  setTangentLocked(tangentLocked);
  function drawGrid(w,h,vp){
    const step=vp.scale>7?5:vp.scale>2.5?10:25;
    const min=canvasToPlane(vp,0,h,w,h),max=canvasToPlane(vp,w,0,w,h);
    const drawLines=(spacing,color)=>{
      ctx.beginPath();
      for(let u=Math.ceil(min.u/spacing)*spacing;u<=max.u;u+=spacing){
        const x=planeToCanvas(vp,{u,v:0},w,h).x;
        ctx.moveTo(x,0);ctx.lineTo(x,h);
      }
      for(let v=Math.ceil(min.v/spacing)*spacing;v<=max.v;v+=spacing){
        const y=planeToCanvas(vp,{u:0,v},w,h).y;
        ctx.moveTo(0,y);ctx.lineTo(w,y);
      }
      ctx.strokeStyle=color;ctx.lineWidth=1;ctx.stroke();
    };
    drawLines(step,'#25394a');drawLines(step*5,'#35556b');
    const x0=planeToCanvas(vp,{u:0,v:0},w,h).x;
    const y0=planeToCanvas(vp,{u:0,v:0},w,h).y;
    ctx.strokeStyle='#4e6475';ctx.beginPath();
    ctx.moveTo(x0,0);ctx.lineTo(x0,h);ctx.moveTo(0,y0);ctx.lineTo(w,y0);ctx.stroke();
    return step;
  }
  function refresh() {
    const s=state();
    if (!visible || s.mode!=='edit') return;
    const {w,h}=dimensions();
    if(w<=1||h<=1)return;
    const dpr=Math.min(2,Math.max(1,window.devicePixelRatio||1));
    const pixelsW=Math.round(w*dpr),pixelsH=Math.round(h*dpr);
    if(canvas.width!==pixelsW||canvas.height!==pixelsH){
      canvas.width=pixelsW;canvas.height=pixelsH;
    }
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#0c141c';ctx.fillRect(0,0,w,h);
    const vp=viewport(),spacing=drawGrid(w,h,vp);
    const map=n=>planeToCanvas(vp,planePoint(view,n),w,h);
    if(s.track?.samples?.length){
      ctx.strokeStyle='#82b8d4';ctx.lineWidth=2.25;
      ctx.beginPath();
      s.track.samples.forEach((sm,i)=>{
        const p=map(sm.pos);
        if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);
      });
      ctx.stroke();
    } else if(s.nodes.length>1){
      ctx.strokeStyle='#82b8d4';ctx.lineWidth=1.5;
      ctx.beginPath();
      s.nodes.forEach((n,i)=>{const p=map(n);if(!i)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y)});
      ctx.stroke();
    }
    const tangent=linkedTangent(view,s.nodes,s.selected,!s.building);
    if(tangent){
      const center=map(s.nodes[s.selected]);
      const radius=Math.max(w,h);
      ctx.save();ctx.setLineDash([5,4]);ctx.lineWidth=1.25;ctx.strokeStyle='#f1c96b';
      ctx.beginPath();ctx.moveTo(center.x-tangent.u*radius,center.y+tangent.v*radius);
      ctx.lineTo(center.x+tangent.u*radius,center.y-tangent.v*radius);ctx.stroke();ctx.restore();
    }
    s.nodes.forEach((n,i)=>{
      const p=map(n);
      if(p.x < -15 || p.y < -15 || p.x > w+15 || p.y > h+15)return;
      ctx.beginPath();ctx.arc(p.x,p.y,i===s.selected?6:4.3,0,Math.PI*2);
      ctx.fillStyle=i===s.selected?'#fff':n.station?'#ffac6a':'#c6ff00';
      ctx.fill();
      if(i===s.selected){
        ctx.strokeStyle='#c6ff00';ctx.lineWidth=1.4;
        ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.stroke();
      }
      if(i===s.selected||n.station||s.nodes.length<=12){
        ctx.font='10px monospace';ctx.fillStyle='#d0dce6';
        ctx.fillText(String(i+1),p.x+8,p.y-7);
      }
    });
    ctx.fillStyle='#91a7b7';ctx.font='10px monospace';
    const units=view==='top'?'X / Z':view==='side'?'X / HEIGHT':'Z / HEIGHT';
    ctx.fillText(units+'  ·  '+spacing+'m GRID',10,h-9);
    if(drawnNodeCount!==s.nodes.length){
      drawnNodeCount=s.nodes.length;
      setStatus(s.nodes.length+' nodes · drag a dot, tap paper to extend');
    }
    lastWidth=w;lastHeight=h;
  }
  function fit(){
    const {w,h}=dimensions(),s=state();
    viewports[view]=fitLinkedView(view,s.nodes,s.track?.samples,w,h);
    refresh();
  }
  function setView(v){
    if(!LINKED_VIEWS.includes(v))return;
    if(active)cancel();
    view=v;
    for(const b of viewButtons)
      b.setAttribute('aria-pressed',String(b.dataset.linkedView===v));
    if(chooser)chooser.textContent=v.toUpperCase();
    refresh();
  }
  function zoom(factor,at){
    const {w,h}=dimensions(),vp=viewport();
    const p=at||{x:w/2,y:h/2},before=canvasToPlane(vp,p.x,p.y,w,h);
    vp.scale=Math.max(.12,Math.min(40,vp.scale*factor));
    vp.u=before.u-(p.x-w/2)/vp.scale;
    vp.v=before.v+(p.y-h/2)/vp.scale;
    refresh();
  }
  function pick(point,s){
    const {w,h}=dimensions(),vp=viewport();
    let match=-1,best=14*14;
    for(let i=0;i<s.nodes.length;i++){
      const p=planeToCanvas(vp,planePoint(view,s.nodes[i]),w,h);
      const d=(p.x-point.x)**2+(p.y-point.y)**2;
      if(d<best){best=d;match=i}
    }
    return match;
  }
  function cancel(){
    if(!active)return;
    const drag=active;active=null;
    if(drag.changed && drag.index>=0)onRestore(drag.index,drag.original);
    refresh();
  }
  canvas.addEventListener('pointerdown',e=>{
    if(state().mode!=='edit'||active)return;
    if(e.button!==0&&e.button!==2)return;
    const p=coordinates(e),s=state(),index=e.button===2?-1:pick(p,s);
    active={id:e.pointerId,index,original:index>=0?{...s.nodes[index]}:null,
      x:p.x,y:p.y,startU:viewport().u,startV:viewport().v,
      moved:false,changed:false,panning:e.button===2,tangentLock:tangentLocked,
      tangent:index>=0?linkedTangent(view,s.nodes,index,!s.building):null};
    canvas.setPointerCapture(e.pointerId);
    if(index>=0&&index!==s.selected)onSelect(index);
    setStatus(index<0?'tap to extend · drag to pan':'node '+(index+1)+' · drag to reshape · '+
      (tangentLocked?'tangent lock on':'Shift or TANGENT locks guide'));
    e.preventDefault();
  });
  canvas.addEventListener('pointermove',e=>{
    const p=coordinates(e),s=state();
    if(!active||e.pointerId!==active.id){
      if(visible) {
        const i=pick(p,s),{w,h}=dimensions();
        const world=canvasToPlane(viewport(),p.x,p.y,w,h);
        setStatus(i>=0?'node '+(i+1)+' · drag to adjust':
          (s.building?'tap to add · ':'pan on empty paper · ')+
          world.u.toFixed(1)+', '+world.v.toFixed(1)+'m');
      }
      return;
    }
    const dx=p.x-active.x,dy=p.y-active.y;
    if(!active.moved&&Math.hypot(dx,dy)>5)active.moved=true;
    if(!active.moved)return;
    const {w,h}=dimensions();
    if(active.index>=0&&!active.panning){
      const world=canvasToPlane(viewport(),p.x,p.y,w,h);
      const origin=planePoint(view,active.original);
      const constrained=(e.shiftKey||active.tangentLock) ? constrainToTangent(origin,world,
        active.tangent) : world;
      const move=fromPlane(view,constrained,active.original,s.snap);
      if(move&&onMove(active.index,move))active.changed=true;
    } else {
      const vp=viewport();
      vp.u=active.startU-dx/vp.scale;
      vp.v=active.startV+dy/vp.scale;
      refresh();
    }
    e.preventDefault();
  });
  canvas.addEventListener('pointerup',e=>{
    if(!active||e.pointerId!==active.id)return;
    const drag=active;active=null;
    if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(drag.index>=0){
      if(drag.changed)onCommit(); // one Undo entry for the entire gesture
    }else if(!drag.moved&&e.button!==2){
      const p=coordinates(e),{w,h}=dimensions();
      const world=canvasToPlane(viewport(),p.x,p.y,w,h);
      const s=state(),base=s.nodes.at(-1)||{x:0,z:0,h:3,bank:0};
      const node=fromPlane(view,world,base,s.snap);
      if(node)onPlace(view,node);
    }
    refresh();e.preventDefault();
  });
  canvas.addEventListener('pointercancel',cancel);
  canvas.addEventListener('lostpointercapture',cancel);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('wheel',e=>{
    if(!visible||state().mode!=='edit')return;
    zoom(e.deltaY<0?1.2:1/1.2,coordinates(e));e.preventDefault();
  },{passive:false});
  for(const b of viewButtons)b.addEventListener('click',()=>setView(b.dataset.linkedView));
  element.querySelector('#linkedFit').addEventListener('click',fit);
  element.querySelector('#linkedZoomIn').addEventListener('click',()=>zoom(1.25));
  tangentToggle?.addEventListener('click',()=>{
    setTangentLocked(!tangentLocked,true);
    setStatus(tangentLocked?'tangent lock on · drag a node along the gold guide':'tangent lock off · Shift still locks one drag');
  });
  element.querySelector('#linkedZoomOut').addEventListener('click',()=>zoom(.8));
  element.querySelector('#linkedClose').addEventListener('click',()=>{setVisible(false);onClose?.();});
  canvas.addEventListener('keydown',e=>{
    if((e.key==='t'||e.key==='T')&&!e.altKey&&!e.ctrlKey&&!e.metaKey){
      setTangentLocked(!tangentLocked,true);
      setStatus(tangentLocked?'tangent lock on · drag a node along the gold guide':'tangent lock off · Shift still locks one drag');
      e.preventDefault();e.stopPropagation();return;
    }
    if(!e.key.startsWith('Arrow'))return;
    const s=state(),n=s.nodes[s.selected];if(!n)return;
    const step=e.altKey?.1:e.shiftKey?5:1;
    const delta=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:
      e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0;
    const p=planePoint(view,n),next={
      u:p.u+(e.key==='ArrowLeft'||e.key==='ArrowRight'?delta:0),
      v:p.v+(e.key==='ArrowUp'||e.key==='ArrowDown'?delta:0)
    };
    const changed=onMove(s.selected,fromPlane(view,next,n,s.snap));
    if(changed)onCommit();
    e.preventDefault();e.stopPropagation();
  });
  function syncMode(){
    if(state().mode!=='edit')element.style.display='none';
    else element.style.display=visible?'block':'none';
    if(visible&&state().mode==='edit')refresh();
  }
  function setVisible(value){
    if(active)cancel();
    visible=!!value;
    syncMode(); // measure only AFTER showing the canvas; display:none has a 0px rect
    if(visible && state().mode==='edit' && !viewports[view]){
      const {w,h}=dimensions();
      viewports[view]=fitLinkedView(view,state().nodes,state().track?.samples,w,h);
      refresh();
    }
  }
  return {
    refresh,fit,setView,setVisible,syncMode,
    setTangentLocked,isTangentLocked(){return tangentLocked;},
    resetFraming(){for(const v of LINKED_VIEWS)viewports[v]=null;drawnNodeCount=-1;refresh()},
    getView(){return view},
    isVisible(){return visible}
  };
}
