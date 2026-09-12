/* view3d.js
   Visualização 3D sincronizada com o editor 2D.
   Renderização WebGL com depth buffer real para evitar objetos aparecendo
   através das paredes. Sem dependências externas.
   1 unidade do mundo = 1 metro. */
(function(){
  'use strict';

  const canvas=document.getElementById('canvas-3d');
  const help=document.getElementById('viewer3d-help');
  const btn2d=document.getElementById('btn-view-2d');
  const btn3d=document.getElementById('btn-view-3d');
  const resetBtn=document.getElementById('viewer3d-reset');
  const hideFrontBtn=document.getElementById('viewer3d-hide-front');
  const selectionInfo=document.getElementById('viewer3d-selection');
  if(!canvas || !btn2d || !btn3d) return;

  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false});
  if(!gl){
    btn3d.disabled=true;
    btn3d.title=t('webglUnsupported');
    return;
  }

  let mode='2d';
  let yaw=-0.72;
  let pitch=0.66;
  let distance=16;
  let target={x:0,y:0,z:1};
  let drag=null;
  let interaction=null;
  let hoverElementId=null;
  let hideFrontWalls=false;
  let cameraInitialized=false;
  let walk=null, walkMesh=null;
  let person={eyeHeight:1.65,fov:70};
  function personSettings(value={}){return {eyeHeight:Math.max(1.2,Math.min(1.95,Number(value.eyeHeight)||1.65)),fov:Math.max(55,Math.min(95,Number(value.fov)||70))};}
  function viewFov(aspect){return walk?2*Math.atan(Math.tan(rad(person.fov)/2)/aspect):rad(47);}

  // The same navigation and input code is embedded in the offline HTML viewer.
  function buildWalkScene(project){
    const surfaces=[],walls=[],spawns=[];
    const rectangle=(x,y,w,h)=>[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];
    for(const entry of VisualMakerModel.floorLayout(project)){
      const {floor,elevation:z}=entry,box=VisualMakerModel.footprint(floor)||{x:-4,y:-4,w:8,h:8};
      const holes=VisualMakerModel.stairOpenings(project,floor.id);
      if(floor.floorSurface.enabled!==false||entry.index===0){
        const polygon=entry.index===0?rectangle(box.x-15,box.y-15,box.w+30,box.h+30):rectangle(box.x,box.y,box.w,box.h);
        surfaces.push({polygon,holes,z,floorId:floor.id});
      }
      const room=floor.elements.find(e=>e.type==='room');
      const furniture=floor.elements.filter(e=>e.type==='object'&&e.category!=='structure');
      const focus=furniture.length?{x:furniture.reduce((sum,e)=>sum+e.x,0)/furniture.length,y:furniture.reduce((sum,e)=>sum+e.y,0)/furniture.length}:null;
      spawns.push({floorId:floor.id,x:room?room.x+room.w/2:box.x+box.w/2,y:room?room.y+room.h/2:box.y+box.h/2,z,focus});
      for(const wall of floor.elements.filter(e=>e.type==='wall')){
        const length=Math.hypot(wall.x2-wall.x1,wall.y2-wall.y1);if(length<.001)continue;
        const doors=floor.elements.filter(e=>e.type==='door'&&e.wallId===wall.id).map(e=>({center:(Number(e.wallT)||0)*length,width:e.width||.8,height:e.height||2.1}));
        walls.push({x1:wall.x1,y1:wall.y1,x2:wall.x2,y2:wall.y2,length,thickness:wall.thickness||.15,z,top:z+(wall.height||floor.height),doors});
      }
      for(const e of floor.elements.filter(e=>e.type==='stair')){
        const g=VisualMakerModel.stairGeometry(e,project);if(!g.valid)continue;
        for(const s of g.steps)surfaces.push({polygon:rectangle(s.x-s.w/2,s.y-s.h/2,s.w,s.h).map(p=>g.world(p.x,p.y)),holes:[],z:z+s.z,floorId:floor.id,step:true});
      }
    }
    return {surfaces,walls,spawns};
  }

  function createWalkNavigation(scene,floorId,heading=0,eyeHeight=1.65){
    const inside=(p,polygon)=>{
      let hit=false;
      for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
        const a=polygon[i],b=polygon[j];
        if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;
      }
      return hit;
    };
    const supports=p=>scene.surfaces.filter(s=>inside(p,s.polygon)&&!(s.holes||[]).some(h=>inside(p,h)));
    const blocked=p=>scene.walls.some(w=>{
      if(p.z+eyeHeight<=w.z+.05||p.z>=w.top-.05)return false;
      const dx=(w.x2-w.x1)/w.length,dy=(w.y2-w.y1)/w.length;
      const along=(p.x-w.x1)*dx+(p.y-w.y1)*dy,t=Math.max(0,Math.min(w.length,along));
      if(Math.hypot(p.x-w.x1-dx*t,p.y-w.y1-dy*t)>w.thickness/2+.16)return false;
      return !w.doors.some(d=>Math.abs(along-d.center)<d.width/2-.16&&p.z>=w.z-.05&&p.z+eyeHeight<w.z+d.height);
    });
    const initial=scene.spawns.find(s=>s.floorId===floorId)||scene.spawns[0]||{x:0,y:0,z:0};
    let position={...initial};
    // Avoid starting inside an internal wall or a stairwell.
    outer:for(let radius=0;radius<=6;radius+=.25)for(let i=0;i<24;i++){
      const candidate={...initial,x:initial.x+radius*Math.cos(i*Math.PI/12),y:initial.y+radius*Math.sin(i*Math.PI/12)};
      if(!blocked(candidate)&&supports(candidate).some(s=>Math.abs(s.z-initial.z)<.05)){position=candidate;break outer;}
    }
    let yaw=initial.focus&&Math.hypot(initial.focus.x-position.x,initial.focus.y-position.y)>.5?Math.atan2(initial.focus.y-position.y,initial.focus.x-position.x):heading,pitch=0;
    function advance(dx,dy){
      const next={...position,x:position.x+dx,y:position.y+dy};
      const candidates=supports(next).filter(s=>Math.abs(s.z-position.z)<=.4);
      // Prefer the uppermost reachable tread; otherwise the source slab wins
      // under the first steps and prevents climbing.
      candidates.sort((a,b)=>b.z-a.z);
      if(!candidates.length)return false;
      next.z=candidates[0].z;
      if(blocked(next))return false;
      position=next;return true;
    }
    return {
      eye:()=>({x:position.x,y:position.y,z:position.z+eyeHeight}),
      center:()=>({x:position.x+Math.cos(yaw)*Math.cos(pitch),y:position.y+Math.sin(yaw)*Math.cos(pitch),z:position.z+eyeHeight+Math.sin(pitch)}),
      setEyeHeight(value){eyeHeight=value;},
      look(dx,dy){yaw-=dx*.005;pitch=Math.max(-1.35,Math.min(1.35,pitch-dy*.005));},
      move(forward,right,seconds,fast=false){
        const length=Math.hypot(forward,right);if(!length)return;
        const amount=Math.min(.1,seconds)*(fast?3.6:1.8)/length;
        const dx=(Math.cos(yaw)*forward+Math.sin(yaw)*right)*amount,dy=(Math.sin(yaw)*forward-Math.cos(yaw)*right)*amount;
        const count=Math.max(1,Math.ceil(Math.hypot(dx,dy)/.04));
        for(let i=0;i<count;i++)if(!advance(dx/count,dy/count)){advance(dx/count,0);advance(0,dy/count);}
      }
    };
  }

  function attachWalkControls(canvas,getWalk,redraw,leave){
    const keys=new Set();let frame=null,lastTime=null,pointer=null;
    const navigation=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
    function clear(){keys.clear();pointer=null;lastTime=null;}
    function tick(time){
      frame=null;const current=getWalk();if(!current||!keys.size){lastTime=null;return;}
      const dt=lastTime===null?1/60:(time-lastTime)/1000;lastTime=time;
      current.move(Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown')),Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),dt,keys.has('shift'));
      redraw();frame=requestAnimationFrame(tick);
    }
    function start(){if(frame===null)frame=requestAnimationFrame(tick);}
    for(const button of document.querySelectorAll?.('[data-walk-key]')||[]){
      button.addEventListener('pointerdown',e=>{if(!getWalk())return;e.preventDefault();keys.add(button.dataset.walkKey);try{button.setPointerCapture(e.pointerId);}catch(_){}start();});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,()=>keys.delete(button.dataset.walkKey));
    }
    window.addEventListener('keydown',e=>{
      if(!getWalk())return;
      const tag=document.activeElement?.tagName;
      if(['INPUT','TEXTAREA','SELECT'].includes(tag)||e.ctrlKey||e.metaKey||e.altKey)return;
      const key=e.key.toLowerCase();
      if(key==='escape'){e.preventDefault();e.stopImmediatePropagation();clear();leave();return;}
      if(!navigation.includes(key)&&key!=='shift')return;
      e.preventDefault();e.stopImmediatePropagation();keys.add(key);start();
    },true);
    window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(!keys.size)lastTime=null;},true);
    window.addEventListener('blur',clear);
    document.addEventListener?.('visibilitychange',()=>{if(document.hidden)clear();});
    canvas.addEventListener('pointerdown',e=>{
      if(!getWalk())return;e.preventDefault();e.stopImmediatePropagation();document.activeElement?.blur?.();
      pointer={id:e.pointerId,x:e.clientX,y:e.clientY};try{canvas.setPointerCapture(e.pointerId);}catch(_){}
    },true);
    canvas.addEventListener('pointermove',e=>{
      const current=getWalk();if(!current)return;e.stopImmediatePropagation();
      if(!pointer||pointer.id!==e.pointerId)return;
      current.look(e.clientX-pointer.x,e.clientY-pointer.y);pointer.x=e.clientX;pointer.y=e.clientY;redraw();
    },true);
    for(const type of ['pointerup','pointercancel'])canvas.addEventListener(type,e=>{
      if(!getWalk())return;e.stopImmediatePropagation();pointer=null;try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
    },true);
    canvas.addEventListener('wheel',e=>{if(getWalk()){e.preventDefault();e.stopImmediatePropagation();}},{capture:true,passive:false});
    canvas.addEventListener('dblclick',e=>{if(getWalk()){e.preventDefault();e.stopImmediatePropagation();}},true);
    return clear;
  }

  let buildingFloor=null, buildingProject=null, vertexElevation=0;
  const sceneProject=()=>buildingProject||activeProject();
  const scenePalette=()=>getPalette(undefined,sceneProject().settings.palette);
  let floorVisibility='all';
  function active3DElements(){return buildingFloor?buildingFloor.elements:state.elements;}
  function projectElements(){return state.floors.flatMap(f=>f.elements);}
  function floorBase(){return VisualMakerModel.floorLayout(activeProject()).find(e=>e.floor.id===state.activeFloorId)?.elevation||0;}
  function buildingHeight(){const layout=VisualMakerModel.floorLayout(activeProject()),last=layout[layout.length-1];return last.top;}


  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rad=d=>d*Math.PI/180;
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/n,y:a.y/n,z:a.z/n};};
  const rotateZ=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return {x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};

  function hexToRgb01(hex){
    const h=(hex||'').trim();
    let r=205,g=208,b=210;
    if(/^#[0-9a-f]{3}$/i.test(h)){
      r=parseInt(h[1]+h[1],16);g=parseInt(h[2]+h[2],16);b=parseInt(h[3]+h[3],16);
    } else if(/^#[0-9a-f]{6}$/i.test(h)){
      r=parseInt(h.slice(1,3),16);g=parseInt(h.slice(3,5),16);b=parseInt(h.slice(5,7),16);
    }
    return [r/255,g/255,b/255];
  }
  function shadeColor(hex,factor,alpha=1){
    const c=hexToRgb01(hex);
    return [clamp(c[0]*factor,0,1),clamp(c[1]*factor,0,1),clamp(c[2]*factor,0,1),alpha];
  }
  function vary(hex,factor){
    const c=hexToRgb01(hex);
    const toHex=v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0');
    return `#${toHex(c[0]*factor)}${toHex(c[1]*factor)}${toHex(c[2]*factor)}`;
  }

  function compileShader(type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      const msg=gl.getShaderInfoLog(shader)||'Erro ao compilar shader.';
      gl.deleteShader(shader);
      throw new Error(msg);
    }
    return shader;
  }
  function createProgram(vsSource,fsSource){
    const program=gl.createProgram();
    gl.attachShader(program,compileShader(gl.VERTEX_SHADER,vsSource));
    gl.attachShader(program,compileShader(gl.FRAGMENT_SHADER,fsSource));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Erro ao criar programa WebGL.');
    return program;
  }

  // World-space face normals keep the sun fixed while the camera orbits.
  // A zero normal marks grid/selection lines, which remain unlit.
  const VERTEX_SHADER=`
    attribute vec3 aPosition;
    attribute vec4 aColor;
    attribute vec3 aNormal;
    uniform mat4 uMVP;
    varying vec4 vColor;
    varying vec3 vNormal;
    void main(){
      gl_Position=uMVP*vec4(aPosition,1.0);
      vColor=aColor;
      vNormal=aNormal;
    }
  `;
  const FRAGMENT_SHADER=`
    precision mediump float;
    varying vec4 vColor;
    varying vec3 vNormal;
    void main(){
      float light=1.0;
      if(length(vNormal)>0.01){
        vec3 normal=normalize(vNormal);
        light=0.38+0.62*max(dot(normal,normalize(vec3(-0.55,-0.75,1.25))),0.0);
      }
      gl_FragColor=vec4(vColor.rgb*light,vColor.a);
    }
  `;
  const program=createProgram(VERTEX_SHADER,FRAGMENT_SHADER);

  const aPosition=gl.getAttribLocation(program,'aPosition');
  const aColor=gl.getAttribLocation(program,'aColor');
  const aNormal=gl.getAttribLocation(program,'aNormal');
  const uMVP=gl.getUniformLocation(program,'uMVP');
  const buffer=gl.createBuffer();
  const STRIDE=10;

  function mat4Perspective(fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return new Float32Array([
      f/aspect,0,0,0,
      0,f,0,0,
      0,0,(far+near)*nf,-1,
      0,0,(2*far*near)*nf,0
    ]);
  }
  function mat4LookAt(eye,center,up){
    const z=norm(sub(eye,center));
    const x=norm(cross(up,z));
    const y=cross(z,x);
    return new Float32Array([
      x.x,y.x,z.x,0,
      x.y,y.y,z.y,0,
      x.z,y.z,z.z,0,
      -dot(x,eye),-dot(y,eye),-dot(z,eye),1
    ]);
  }
  function mat4Multiply(a,b){
    const out=new Float32Array(16);
    for(let c=0;c<4;c++){
      for(let r=0;r<4;r++){
        out[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
      }
    }
    return out;
  }

  function contentBBox(){
    const elements=buildingFloor?buildingFloor.elements:projectElements();
    if(!elements.length) return {minX:-4,maxX:4,minY:-4,maxY:4};
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    const include=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}};
    for(const e of elements){
      if('x1' in e){include(e.x1,e.y1);include(e.x2,e.y2);}
      else if(e.type==='room'){include(e.x,e.y);include(e.x+e.w,e.y+e.h);}
      else if(e.type==='stair'){for(const p of VisualMakerModel.stairGeometry(e,sceneProject()).outline)include(p.x,p.y);}
      else if('x' in e){const hw=(e.w||e.width||.4)/2,hh=(e.h||e.width||.4)/2;include(e.x-hw,e.y-hh);include(e.x+hw,e.y+hh);}
    }
    if(!Number.isFinite(minX)) return {minX:-4,maxX:4,minY:-4,maxY:4};
    return {minX,maxX,minY,maxY};
  }

  function markViewChanged(){
    // Movimento de câmera não entra no histórico de elementos, mas passa
    // a ser uma alteração salvável do projeto. Marcamos o projeto como
    // pendente para o aviso de saída também proteger a vista 3D.
    if(typeof markUnsaved==='function' && typeof unsavedChanges!=='undefined' && !unsavedChanges){
      markUnsaved();
    }
  }

  function resetCamera(markChanged=true){
    leaveWalk(false);
    const b=contentBBox();
    const fitted=fitCamera(b,buildingHeight());
    ({target,distance,yaw,pitch}=fitted);
    cameraInitialized=true;
    if(mode==='3d')draw();
    if(markChanged)markViewChanged();
  }
  function fitCamera(b,height){
    const rect=canvas.getBoundingClientRect(),aspect=Math.max(.3,rect.width/Math.max(1,rect.height));
    const yaw=-.72,pitch=.55,cp=Math.cos(pitch),out={x:cp*Math.cos(yaw),y:cp*Math.sin(yaw),z:Math.sin(pitch)};
    const right=norm(cross(mul(out,-1),{x:0,y:0,z:1})),up=cross(right,mul(out,-1));
    const target={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:height/2};
    let distance=2.8;const tan=Math.tan(rad(47)/2);
    for(const x of [b.minX,b.maxX])for(const y of [b.minY,b.maxY])for(const z of [0,height]){
      const p=sub({x,y,z},target);distance=Math.max(distance,dot(p,out)+1.12*Math.max(Math.abs(dot(p,right))/(tan*aspect),Math.abs(dot(p,up))/tan));
    }
    return {yaw,pitch,distance,target};
  }

  function finiteOr(value,fallback){
    return Number.isFinite(Number(value))?Number(value):fallback;
  }

  function get3DViewState(){
    return {
      version:1,
      mode,
      camera:cameraInitialized?{
        yaw,
        pitch,
        distance,
        target:{x:target.x,y:target.y,z:target.z}
      }:null,
      hideFrontWalls:!!hideFrontWalls, floorVisibility,person:{...person}
    };
  }

  function restore3DViewState(saved,options){
    leaveWalk(false);
    const opts=options||{};
    const data=saved&&typeof saved==='object'?saved:null;
    person=personSettings(data?.person);updateWalkUI();
    // Aceita tanto a estrutura v1 quanto uma eventual estrutura plana
    // usada durante desenvolvimento, para não quebrar projetos de teste.
    const cam=data&&(data.camera&&typeof data.camera==='object'?data.camera:
      (Number.isFinite(Number(data.yaw))?data:null));

    if(cam){
      yaw=finiteOr(cam.yaw,-0.72);
      pitch=clamp(finiteOr(cam.pitch,0.66),.12,1.45);
      distance=clamp(finiteOr(cam.distance,16),2.8,180);
      const savedTarget=cam.target&&typeof cam.target==='object'?cam.target:{};
      target={
        x:finiteOr(savedTarget.x,0),
        y:finiteOr(savedTarget.y,0),
        z:finiteOr(savedTarget.z,1)
      };
      cameraInitialized=true;
    }else{
      cameraInitialized=false;
      yaw=-0.72; pitch=0.66; distance=16; target={x:0,y:0,z:1};
    }

    floorVisibility=data?.floorVisibility==='active'?'active':'all';
    document.getElementById('viewer-floor-visibility').value=floorVisibility;
    hideFrontWalls=!!(data&&data.hideFrontWalls);
    updateHideFrontButton();

    if(opts.restoreMode){
      setMode(data&&data.mode==='3d'?'3d':'2d',{markChanged:false,preserveCamera:true});
    }else if(mode==='3d'){
      if(!cameraInitialized)resetCamera(false);
      else draw();
    }
  }
  function cameraEye(){
    if(walk)return walk.eye();
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    return {
      x:target.x+distance*cp*Math.cos(yaw),
      y:target.y+distance*cp*Math.sin(yaw),
      z:target.z+distance*sp
    };
  }
  function cameraCenter(){return walk?walk.center():target;}
  function updateWalkUI(){
    const button=document.getElementById('viewer3d-person');
    button?.setAttribute('aria-pressed',String(!!walk));
    if(button)button.textContent=t(walk?'leavePerson':'viewPerson');
    document.body.classList.toggle('view-person',!!walk);
    const hint=document.getElementById('viewer3d-walk-help');if(hint)hint.textContent=t('personHelp');
    for(const [id,key] of [['person-eye-height','eyeHeight'],['person-fov','fov']]){const input=document.getElementById(id);if(input)input.value=person[key];}
    const heading=document.querySelector?.('#viewer3d-help strong');if(heading)heading.textContent=t(walk?'viewPerson':'editable3d');
  }
  function leaveWalk(redraw=true){
    if(!walk)return;walk=null;walkMesh=null;clearWalkInput();updateWalkUI();if(redraw)draw();
  }
  function enterWalk(){
    window.finish3DInteraction?.();activateTool('select');if(typeof clearSelection==='function')clearSelection();
    walk=createWalkNavigation(buildWalkScene(activeProject()),state.activeFloorId,yaw+Math.PI,person.eyeHeight);
    walkMesh=buildProjectScene(walk.eye(),true);updateWalkUI();draw();
  }
  const clearWalkInput=attachWalkControls(canvas,()=>mode==='3d'?walk:null,()=>draw(),()=>leaveWalk());
  for(const [id,key] of [['person-eye-height','eyeHeight'],['person-fov','fov']])document.getElementById(id)?.addEventListener('input',e=>{person=personSettings({...person,[key]:e.target.value});walk?.setEyeHeight(person.eyeHeight);draw();markViewChanged();});


  function selectedEditableElement(){
    const el=selectedId?getElement(selectedId):null;
    return el&&(typeof elementBelongsToFloor!=='function'||elementBelongsToFloor(el,state.activeFloorId))?el:null;
  }
  function selectedObject(){
    const el=selectedEditableElement();
    return el&&el.type==='object'?el:null;
  }
  function updateSelectionInfo(){
    if(!selectionInfo)return;
    const el=selectedEditableElement();
    if(!el){
      selectionInfo.textContent=t('noObjectSelected');
      return;
    }
    if(el.type==='stair'){
      const g=VisualMakerModel.stairGeometry(el,activeProject());
      selectionInfo.textContent=`${t('stair')} · ${el.stepCount} · ${formatMeters(g.riserHeight)} · ${Math.round(el.rotation||0)}°`;return;
    }
    if(['wall','room','cota','text'].includes(el.type)){
      selectionInfo.textContent=t(el.type==='cota'?'dimension':el.type)+(el.name?' · '+el.name:'');return;
    }
    if(el.type==='door'||el.type==='window'){
      const label=el.type==='door'?t('door'):t('window');
      const attached=el.wallId?` · ${t('wallAttached')}`:'';
      selectionInfo.textContent=`${label} · X ${el.x.toFixed(2)} m · Y ${el.y.toFixed(2)} m · ${formatMeters(el.width||0)}${attached}`;
      return;
    }
    const z=objectElevation(el);
    const rot=((el.rotation||0)%360+360)%360;
    selectionInfo.textContent=`${getAssetLabel(el.kind,el.category,el.label||t('object'))} · X ${el.x.toFixed(2)} m · Y ${el.y.toFixed(2)} m · Z ${z.toFixed(2)} m · ${Math.round(rot)}°`;
  }

  function canvasRay(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return null;
    const ndcX=((clientX-rect.left)/rect.width)*2-1;
    const ndcY=1-((clientY-rect.top)/rect.height)*2;
    const eye=cameraEye();
    const forward=norm(sub(cameraCenter(),eye));
    const right=norm(cross(forward,{x:0,y:0,z:1}));
    const up=norm(cross(right,forward));
    const aspect=rect.width/rect.height;
    const tan=Math.tan(viewFov(aspect)/2);
    const dir=norm(add(forward,add(mul(right,ndcX*tan*aspect),mul(up,ndcY*tan))));
    return {origin:{...eye,z:eye.z-floorBase()},dir};
  }
  function rayPlaneZ(ray,z){
    if(!ray||Math.abs(ray.dir.z)<1e-6)return null;
    const t=(z-ray.origin.z)/ray.dir.z;
    if(t<0)return null;
    return add(ray.origin,mul(ray.dir,t));
  }
  function rotateXYInverse(v,a){
    const c=Math.cos(a),ss=Math.sin(a);
    return {x:v.x*c+v.y*ss,y:-v.x*ss+v.y*c,z:v.z};
  }
  function rayLocalBoxDistance(ray,cx,cy,z0,sx,sy,sz,rotation){
    if(!ray||sx<=0||sy<=0||sz<=0)return Infinity;
    const a=rotation||0;
    const ro=rotateXYInverse({x:ray.origin.x-cx,y:ray.origin.y-cy,z:ray.origin.z-z0-sz/2},a);
    const rd=rotateXYInverse(ray.dir,a);
    const min={x:-sx/2,y:-sy/2,z:-sz/2},max={x:sx/2,y:sy/2,z:sz/2};
    let tmin=-Infinity,tmax=Infinity;
    for(const axis of ['x','y','z']){
      const o=ro[axis],d=rd[axis];
      if(Math.abs(d)<1e-8){
        if(o<min[axis]||o>max[axis])return Infinity;
        continue;
      }
      let t1=(min[axis]-o)/d,t2=(max[axis]-o)/d;
      if(t1>t2){const tmp=t1;t1=t2;t2=tmp;}
      tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);
      if(tmin>tmax)return Infinity;
    }
    if(tmax<0)return Infinity;
    return tmin>=0?tmin:tmax;
  }
  function objectVisualHeight(e){
    return VisualMakerModel.objectHeight(e,buildingFloor||activeFloor());
  }
  function objectRayDistance(ray,e){
    const z=objectElevation(e),h=objectVisualHeight(e);
    const pad=Math.max(.035,Math.min(.12,Math.min(e.w||1,e.h||1)*.08));
    return rayLocalBoxDistance(ray,e.x,e.y,z,(e.w||1)+pad,(e.h||1)+pad,h,rad(e.rotation||0));
  }
  function openingRayDistance(ray,e){
    const h=e.height||(e.type==='door'?2.1:1.2);
    const z0=e.type==='door'?0:(e.sillHeight==null?.9:e.sillHeight);
    const depth=Math.max(.08,(e.wallThickness||.15)*.72);
    return rayLocalBoxDistance(ray,e.x,e.y,z0,e.width||.8,depth,h,rad(e.angle||0));
  }
  function stairRayDistance(ray,e){
    const g=VisualMakerModel.stairGeometry(e,sceneProject());if(!g.valid)return Infinity;
    return Math.min(...g.steps.map(step=>{const p=g.world(step.x,step.y);return rayLocalBoxDistance(ray,p.x,p.y,0,step.w,step.h,step.z,rad(e.rotation||0));}));
  }
  function wallRayDistance(ray,wall){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
    if(L<.02)return Infinity;
    const eye=cameraEye();
    if(shouldHideFrontWall(wall,eye))return Infinity;
    return rayLocalBoxDistance(ray,(wall.x1+wall.x2)/2,(wall.y1+wall.y2)/2,0,L,wall.thickness||.15,wall.height||2.7,Math.atan2(dy,dx));
  }
  function pickEditableAt(clientX,clientY){
    const ray=canvasRay(clientX,clientY);if(!ray)return null;
    let wallT=Infinity,wallHit=null;
    for(const w of active3DElements()){
      if(w.type!=='wall')continue;
      const distance=wallRayDistance(ray,w);if(distance<wallT){wallT=distance;wallHit=w;}
    }
    let best=null,bestT=Infinity;
    for(const e of active3DElements()){
      if(e.type==='text'){
        const p=projectWorld({x:e.x,y:e.y,z:.08});
        const local=p?rotateXYInverse({x:clientX-p.x,y:clientY-p.y,z:0},rad(e.rotation||0)):null;
        if(local&&Math.abs(local.x)<Math.max(30,String(e.content).length*(e.size||16)*.3)&&Math.abs(local.y)<(e.size||16))return e;
        continue;
      }
      if(e.type==='cota'){
        const g=dimensionPoints(e);
        if(pointSegmentDistance(clientX,clientY,projectWorld({...g.a,z:.08}),projectWorld({...g.b,z:.08}))<9)return e;
        continue;
      }
      let t=Infinity;
      if(e.type==='wall')continue;
      else if(e.type==='room')t=rayLocalBoxDistance(ray,e.x+e.w/2,e.y+e.h/2,0,e.w,e.h,.035,0);
      else if(e.type==='stair')t=stairRayDistance(ray,e);
      else if(e.type==='object')t=objectRayDistance(ray,e);
      else if(e.type==='door'||e.type==='window')t=openingRayDistance(ray,e);
      const wallAllowance=e.type==='object'?.025:.24;
      if(t<bestT&&t<=wallT+wallAllowance){best=e;bestT=t;}
    }
    return best||wallHit;
  }
  function projectWorld(p){
    p={...p,z:p.z+floorBase()};
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return null;
    const eye=cameraEye(),forward=norm(sub(cameraCenter(),eye));
    const right=norm(cross(forward,{x:0,y:0,z:1}));
    const up=norm(cross(right,forward));
    const rel=sub(p,eye),z=dot(rel,forward);
    if(z<=.03)return null;
    const aspect=rect.width/rect.height,tan=Math.tan(viewFov(aspect)/2);
    const nx=dot(rel,right)/(z*tan*aspect),ny=dot(rel,up)/(z*tan);
    return {
      x:rect.left+(nx*.5+.5)*rect.width,
      y:rect.top+(1-(ny*.5+.5))*rect.height,
      z
    };
  }
  function pointSegmentDistance(px,py,a,b){
    if(!a||!b)return Infinity;
    const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;
    if(L2<1e-6)return Math.hypot(px-a.x,py-a.y);
    const t=clamp(((px-a.x)*dx+(py-a.y)*dy)/L2,0,1);
    return Math.hypot(px-(a.x+t*dx),py-(a.y+t*dy));
  }
  function gizmoGeometry(e){
    const z0=objectElevation(e),h=objectVisualHeight(e);
    const top=z0+h;
    const axisLen=clamp(Math.max(.65,Math.max(e.w||1,e.h||1)*.42),.65,1.45);
    const ringRadius=Math.max(.48,Math.hypot(e.w||1,e.h||1)/2+.18);
    return {z0,h,top,axisLen,ringRadius};
  }
  function gizmoHitAt(clientX,clientY,e){
    if(!e)return null;
    const g=gizmoGeometry(e);
    const zA=projectWorld({x:e.x,y:e.y,z:g.top+.06});
    const zB=projectWorld({x:e.x,y:e.y,z:g.top+g.axisLen});
    if(pointSegmentDistance(clientX,clientY,zA,zB)<=11)return 'elevation';

    let prev=null,best=Infinity;
    const ringZ=g.z0+.055;
    for(let i=0;i<=44;i++){
      const a=i/44*Math.PI*2;
      const p=projectWorld({x:e.x+Math.cos(a)*g.ringRadius,y:e.y+Math.sin(a)*g.ringRadius,z:ringZ});
      if(prev&&p)best=Math.min(best,pointSegmentDistance(clientX,clientY,prev,p));
      prev=p;
    }
    if(best<=10)return 'rotation';
    return null;
  }

  function openingResizeHandleAt(clientX,clientY,e){
    if(!e||(e.type!=='door'&&e.type!=='window'))return null;
    const h=e.height||(e.type==='door'?2.1:1.2),z0=e.type==='door'?0:(e.sillHeight==null?.9:e.sillHeight),cz=z0+h*.52;
    const a=rad(e.angle||0),ux=Math.cos(a),uy=Math.sin(a),half=(e.width||.8)/2;
    const points={
      left:projectWorld({x:e.x-ux*half,y:e.y-uy*half,z:cz}),
      right:projectWorld({x:e.x+ux*half,y:e.y+uy*half,z:cz})
    };
    for(const side of ['left','right']){const p=points[side];if(p&&Math.hypot(clientX-p.x,clientY-p.y)<=13)return side;}
    return null;
  }

  function moveCameraPlanar(forwardAmount,rightAmount){
    // Move o alvo e, por consequência, a câmera inteira sem alterar o ângulo.
    const fx=-Math.cos(yaw),fy=-Math.sin(yaw);
    const rx=-Math.sin(yaw),ry=Math.cos(yaw);
    target.x+=fx*forwardAmount+rx*rightAmount;
    target.y+=fy*forwardAmount+ry*rightAmount;
    cameraInitialized=true;
    draw();
    markViewChanged();
  }
  function updateHideFrontButton(){
    if(!hideFrontBtn)return;
    hideFrontBtn.textContent=hideFrontWalls?t('showFront'):t('hideFront');
    hideFrontBtn.setAttribute('aria-pressed',String(hideFrontWalls));
  }
  function shouldHideFrontWall(wall,eye){
    if(!hideFrontWalls)return false;
    const cx=(wall.x1+wall.x2)/2,cy=(wall.y1+wall.y2)/2;
    const cam2=norm({x:eye.x-target.x,y:eye.y-target.y,z:0});
    const rel={x:cx-target.x,y:cy-target.y,z:0};
    // Só paredes no lado da câmera e com face razoavelmente voltada a ela.
    if(dot(rel,cam2)<0.12)return false;
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,len=Math.hypot(dx,dy)||1;
    const normal={x:-dy/len,y:dx/len,z:0};
    const toEye=norm({x:eye.x-cx,y:eye.y-cy,z:0});
    return Math.abs(dot(normal,toEye))>.24;
  }

  function resize(){
    const r=canvas.getBoundingClientRect();
    if(r.width<2||r.height<2) return null;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(2,Math.round(r.width*dpr));
    const h=Math.max(2,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);
    return {w,h,cssW:r.width,cssH:r.height};
  }

  function addVertex(arr,p,color,n={x:0,y:0,z:0}){arr.push(p.x,p.y,p.z+vertexElevation,color[0],color[1],color[2],color[3],n.x,n.y,n.z);}
  function faceNormal(a,b,c){return norm(cross(sub(b,a),sub(c,a)));}

  function addTriangle(mesh,a,b,c,colorHex,alpha=1,normalOverride=null){
    const n=normalOverride||faceNormal(a,b,c);
    const color=shadeColor(colorHex,1,alpha);
    const targetArr=alpha<.999?mesh.transparent:mesh.opaque;
    addVertex(targetArr,a,color,n);addVertex(targetArr,b,color,n);addVertex(targetArr,c,color,n);
  }
  function addQuad(mesh,a,b,c,d,colorHex,alpha=1,normalOverride=null){
    addTriangle(mesh,a,b,c,colorHex,alpha,normalOverride);
    addTriangle(mesh,a,c,d,colorHex,alpha,normalOverride);
  }

  function addBox(mesh,cx,cy,cz,sx,sy,sz,colorHex,rotation=0,alpha=1){
    if(sx<=.002||sy<=.002||sz<=.002)return;
    const hx=sx/2,hy=sy/2,hz=sz/2;
    const raw=[
      {x:-hx,y:-hy,z:-hz},{x:hx,y:-hy,z:-hz},{x:hx,y:hy,z:-hz},{x:-hx,y:hy,z:-hz},
      {x:-hx,y:-hy,z:hz},{x:hx,y:-hy,z:hz},{x:hx,y:hy,z:hz},{x:-hx,y:hy,z:hz}
    ];
    const v=raw.map(p=>{const r=rotateZ(p,rotation);return {x:r.x+cx,y:r.y+cy,z:r.z+cz};});
    const nDown=rotateZ({x:0,y:0,z:-1},rotation),nUp=rotateZ({x:0,y:0,z:1},rotation);
    const nFront=rotateZ({x:0,y:-1,z:0},rotation),nRight=rotateZ({x:1,y:0,z:0},rotation),nBack=rotateZ({x:0,y:1,z:0},rotation),nLeft=rotateZ({x:-1,y:0,z:0},rotation);
    addQuad(mesh,v[0],v[3],v[2],v[1],colorHex,alpha,nDown);
    addQuad(mesh,v[4],v[5],v[6],v[7],colorHex,alpha,nUp);
    addQuad(mesh,v[0],v[1],v[5],v[4],colorHex,alpha,nFront);
    addQuad(mesh,v[1],v[2],v[6],v[5],colorHex,alpha,nRight);
    addQuad(mesh,v[2],v[3],v[7],v[6],colorHex,alpha,nBack);
    addQuad(mesh,v[3],v[0],v[4],v[7],colorHex,alpha,nLeft);
  }

  function addCylinder(mesh,cx,cy,z0,radius,height,colorHex,segments=14,alpha=1){
    if(radius<=.002||height<=.002)return;
    const z1=z0+height;
    const top={x:cx,y:cy,z:z1},bottom={x:cx,y:cy,z:z0};
    for(let i=0;i<segments;i++){
      const a0=i*Math.PI*2/segments,a1=(i+1)*Math.PI*2/segments;
      const p0={x:cx+Math.cos(a0)*radius,y:cy+Math.sin(a0)*radius,z:z0};
      const p1={x:cx+Math.cos(a1)*radius,y:cy+Math.sin(a1)*radius,z:z0};
      const q0={x:p0.x,y:p0.y,z:z1},q1={x:p1.x,y:p1.y,z:z1};
      const n=norm({x:Math.cos((a0+a1)/2),y:Math.sin((a0+a1)/2),z:0});
      addQuad(mesh,p0,p1,q1,q0,colorHex,alpha,n);
      addTriangle(mesh,top,q0,q1,colorHex,alpha,{x:0,y:0,z:1});
      addTriangle(mesh,bottom,p1,p0,colorHex,alpha,{x:0,y:0,z:-1});
    }
  }

  function addGrid(lines){
    const b=contentBBox(),pad=2;
    const minX=Math.floor(b.minX-pad),maxX=Math.ceil(b.maxX+pad),minY=Math.floor(b.minY-pad),maxY=Math.ceil(b.maxY+pad);
    const push=(a,b,color)=>{addVertex(lines,a,color);addVertex(lines,b,color);};
    const step=Math.max(.01,Number(sceneProject().settings.gridSpacing)||.5,(maxX-minX)/400,(maxY-minY)/400);
    for(let i=Math.ceil(minX/step);i<=Math.floor(maxX/step);i++){
      const x=i*step,strong=i%5===0;
      push({x,y:minY,z:-.09},{x,y:maxY,z:-.09},strong?[.31,.40,.48,.25]:[.31,.40,.48,.11]);
    }
    for(let i=Math.ceil(minY/step);i<=Math.floor(maxY/step);i++){
      const y=i*step,strong=i%5===0;
      push({x:minX,y,z:-.09},{x:maxX,y,z:-.09},strong?[.31,.40,.48,.25]:[.31,.40,.48,.11]);
    }
  }


  function addOverlayLine(mesh,a,b,color){
    addVertex(mesh.overlayLines,a,color);addVertex(mesh.overlayLines,b,color);
  }
  function addSelectionOverlay(mesh,e=selectedEditableElement()){
    if(!e)return;
    const accent=[.18,.58,1,1],xColor=[.92,.32,.30,1],yColor=[.28,.78,.43,1],zColor=[.28,.58,1,1],ring=[1,.67,.22,1];
    if(['wall','room','cota','text'].includes(e.type)){
      if(e.type==='wall'){
        const z=e.height||activeFloor().height;
        for(const height of [0,z])addOverlayLine(mesh,{x:e.x1,y:e.y1,z:height},{x:e.x2,y:e.y2,z:height},accent);
        for(const p of [{x:e.x1,y:e.y1},{x:e.x2,y:e.y2}])addOverlayLine(mesh,{...p,z:0},{...p,z},accent);
      }else if(e.type==='room'){
        const points=editHandles(e).map(h=>h.point);
        for(const [a,b] of [[0,1],[1,3],[3,2],[2,0]])addOverlayLine(mesh,points[a],points[b],accent);
      }else if(e.type==='cota'){
        const g=dimensionPoints(e);addOverlayLine(mesh,{...g.a,z:.08},{...g.b,z:.08},accent);
      }
      return;
    }

    if(e.type==='stair'){
      const g=VisualMakerModel.stairGeometry(e,sceneProject());
      for(const step of g.steps){
        const pts=[[-step.w/2,-step.h/2],[step.w/2,-step.h/2],[step.w/2,step.h/2],[-step.w/2,step.h/2]].map(([x,y])=>({...g.world(x+step.x,y+step.y),z:step.z+.015}));
        for(let i=0;i<4;i++)addOverlayLine(mesh,pts[i],pts[(i+1)%4],accent);
      }
      return;
    }

    if(e.type==='door'||e.type==='window'){
      const h=e.height||(e.type==='door'?2.1:1.2);
      const z0=e.type==='door'?0:(e.sillHeight==null?.9:e.sillHeight);
      const z1=z0+h,w=(e.width||.8)+.08,d=Math.max(.12,(e.wallThickness||.15)+.08);
      const pts=[localXY(e,-w/2,-d/2),localXY(e,w/2,-d/2),localXY(e,w/2,d/2),localXY(e,-w/2,d/2)];
      const low=pts.map(p=>({x:p.x,y:p.y,z:z0-.025})),high=pts.map(p=>({x:p.x,y:p.y,z:z1+.025}));
      for(let i=0;i<4;i++){
        addOverlayLine(mesh,low[i],low[(i+1)%4],accent);
        addOverlayLine(mesh,high[i],high[(i+1)%4],accent);
        addOverlayLine(mesh,low[i],high[i],accent);
      }
      const axisLen=(e.width||.8)/2,a=rad(e.angle||0),ux=Math.cos(a),uy=Math.sin(a),cz=z0+h*.52;
      const left={x:e.x-ux*axisLen,y:e.y-uy*axisLen,z:cz},right={x:e.x+ux*axisLen,y:e.y+uy*axisLen,z:cz};
      addOverlayLine(mesh,left,right,ring);
      const tick=.12;
      addOverlayLine(mesh,{x:left.x-uy*tick,y:left.y+ux*tick,z:cz},{x:left.x+uy*tick,y:left.y-ux*tick,z:cz},ring);
      addOverlayLine(mesh,{x:right.x-uy*tick,y:right.y+ux*tick,z:cz},{x:right.x+uy*tick,y:right.y-ux*tick,z:cz},ring);
      return;
    }

    const g=gizmoGeometry(e);
    const z0=g.z0-.025,z1=g.top+.025,w=(e.w||1)+.07,d=(e.h||1)+.07;
    const pts=[
      localXY(e,-w/2,-d/2),localXY(e,w/2,-d/2),localXY(e,w/2,d/2),localXY(e,-w/2,d/2)
    ];
    const low=pts.map(p=>({x:p.x,y:p.y,z:z0})),high=pts.map(p=>({x:p.x,y:p.y,z:z1}));
    for(let i=0;i<4;i++){
      addOverlayLine(mesh,low[i],low[(i+1)%4],accent);
      addOverlayLine(mesh,high[i],high[(i+1)%4],accent);
      addOverlayLine(mesh,low[i],high[i],accent);
    }

    if(typeof getSelectionIds==='function'&&getSelectionIds().length>1)return;
    const origin={x:e.x,y:e.y,z:g.top+.06};
    addOverlayLine(mesh,origin,{x:e.x+.72,y:e.y,z:origin.z},xColor);
    addOverlayLine(mesh,origin,{x:e.x,y:e.y+.72,z:origin.z},yColor);
    const zTop={x:e.x,y:e.y,z:g.top+g.axisLen};
    addOverlayLine(mesh,origin,zTop,zColor);
    addOverlayLine(mesh,zTop,{x:e.x-.07,y:e.y,z:zTop.z-.13},zColor);
    addOverlayLine(mesh,zTop,{x:e.x+.07,y:e.y,z:zTop.z-.13},zColor);

    const ringZ=g.z0+.055;
    let prev=null;
    for(let i=0;i<=48;i++){
      const a=i/48*Math.PI*2;
      const pt={x:e.x+Math.cos(a)*g.ringRadius,y:e.y+Math.sin(a)*g.ringRadius,z:ringZ};
      if(prev)addOverlayLine(mesh,prev,pt,ring);
      prev=pt;
    }
  }

  function wallOpenings(wall){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
    if(L<.02)return [];
    const ux=dx/L,uy=dy/L;
    const out=[];
    for(const e of active3DElements()){
      const isGate=e.type==='object'&&['slidingGate','doubleGate','pedestrianGate'].includes(e.kind);
      if(e.type!=='door'&&e.type!=='window'&&!isGate)continue;
      const rx=e.x-wall.x1,ry=e.y-wall.y1;
      const along=rx*ux+ry*uy;
      const px=wall.x1+clamp(along,0,L)*ux,py=wall.y1+clamp(along,0,L)*uy;
      const dist=Math.hypot(e.x-px,e.y-py);
      if(dist>Math.max(.32,(wall.thickness||.15)*1.8))continue;
      const width=Math.min(isGate?(e.w||1):(e.width||.8),L);
      const start=clamp(along-width/2,0,L),end=clamp(along+width/2,0,L);
      if(end-start<.04)continue;
      const H=wall.height||2.7;
      const z0=(e.type==='door'||isGate)?0:clamp(e.sillHeight==null?.9:e.sillHeight,0,H-.15);
      const gateHeight=isGate?objectVisualHeight(e):1.85;
      const z1=clamp(z0+(isGate?gateHeight:(e.height||(e.type==='door'?2.1:1.2))),z0+.1,H);
      out.push({start,end,z0,z1,element:e});
    }
    return out;
  }
  function complementIntervals(holes,H){
    if(!holes.length)return [[0,H]];
    const sorted=holes.map(h=>[clamp(h[0],0,H),clamp(h[1],0,H)]).filter(h=>h[1]-h[0]>.01).sort((a,b)=>a[0]-b[0]);
    const merged=[];
    for(const h of sorted){
      if(!merged.length||h[0]>merged[merged.length-1][1]+.001)merged.push(h.slice());
      else merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],h[1]);
    }
    const out=[];let cur=0;
    for(const h of merged){if(h[0]-cur>.02)out.push([cur,h[0]]);cur=Math.max(cur,h[1]);}
    if(H-cur>.02)out.push([cur,H]);
    return out;
  }
  function addWallGeometry(mesh,wall){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);if(L<.02)return;
    const angle=Math.atan2(dy,dx),H=wall.height||2.7,T=wall.thickness||.15;
    const color=wall.color||'#F0EEE9';
    const openings=wallOpenings(wall);
    const cuts=[0,L];for(const o of openings){cuts.push(o.start,o.end);}cuts.sort((a,b)=>a-b);
    const unique=cuts.filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>.002);
    const ux=dx/L,uy=dy/L;
    for(let i=0;i<unique.length-1;i++){
      const a=unique[i],b=unique[i+1],seg=b-a;if(seg<.01)continue;
      const mid=(a+b)/2;
      const active=openings.filter(o=>mid>o.start+.001&&mid<o.end-.001);
      const vertical=complementIntervals(active.map(o=>[o.z0,o.z1]),H);
      for(const [z0,z1] of vertical){
        const cx=wall.x1+ux*mid,cy=wall.y1+uy*mid;
        addBox(mesh,cx,cy,(z0+z1)/2,seg,T,z1-z0,color,angle,1);
        if(z0===0&&z1>=.12){
          // Ten-centimetre skirting provides a familiar scale cue along walls.
          for(const side of [-1,1])addBox(mesh,cx-uy*side*(T/2+.009),cy+ux*side*(T/2+.009),.05,seg,.018,.10,'#D5D0C7',angle,1);
        }
      }
    }
  }

  function localXY(e,lx,ly){
    const a=rad(e.rotation||e.angle||0),c=Math.cos(a),s=Math.sin(a);
    return {x:e.x+lx*c-ly*s,y:e.y+lx*s+ly*c};
  }
  function objectElevation(e){const v=Number(e&&e.elevation);return Number.isFinite(v)?Math.max(0,v):0;}
  function localBox(mesh,e,lx,ly,cz,sx,sy,sz,color,alpha=1,extraAngle=0){
    const p=localXY(e,lx,ly);
    addBox(mesh,p.x,p.y,cz+objectElevation(e),sx,sy,sz,color,rad((e.rotation||e.angle||0)+extraAngle),alpha);
  }
  function localCylinder(mesh,e,lx,ly,z0,radius,height,color,segments=14,alpha=1){
    const p=localXY(e,lx,ly);addCylinder(mesh,p.x,p.y,z0+objectElevation(e),radius,height,color,segments,alpha);
  }

  function openingHiddenByFrontWall(e,eye){
    if(!hideFrontWalls)return false;
    let best=null,bestDist=Infinity;
    for(const wall of active3DElements().filter(x=>x.type==='wall')){
      const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L2=dx*dx+dy*dy;if(L2<.0001)continue;
      const t=clamp(((e.x-wall.x1)*dx+(e.y-wall.y1)*dy)/L2,0,1);
      const px=wall.x1+t*dx,py=wall.y1+t*dy,dist=Math.hypot(e.x-px,e.y-py);
      if(dist<bestDist){bestDist=dist;best=wall;}
    }
    return !!(best&&bestDist<Math.max(.34,(best.thickness||.15)*2)&&shouldHideFrontWall(best,eye));
  }
  function addOpeningPanels(mesh,eye,includeHidden=false){
    for(const e of active3DElements()){
      if(e.type!=='door'&&e.type!=='window')continue;
      if(!includeHidden&&openingHiddenByFrontWall(e,eye))continue;
      const h=e.height||(e.type==='door'?2.1:1.2),z0=e.type==='door'?0:(e.sillHeight==null?.9:e.sillHeight);
      const t=Math.max(.035,(e.wallThickness||.15)*.30),w=e.width||.8;
      if(e.type==='door'){
        const base=e.color||'#A56B43';
        if((e.doorStyle||'swing')==='sliding'){
          const panelW=w*.57;
          localBox(mesh,e,-w*.20,-t*.12,z0+h/2,panelW,t*.72,h,base,1);
          localBox(mesh,e,w*.20,t*.12,z0+h/2,panelW,t*.72,h,vary(base,.92),1);
          localBox(mesh,e,0,-t*.65,z0+h+.035,w*1.03,.045,.07,vary(base,.65),1);
          const knob=localXY(e,w*.04,-t*.62);addBox(mesh,knob.x,knob.y,z0+h*.5,.05,.03,.055,'#D1B36A',rad(e.angle||0),1);
        }else{
          const hingeRight=e.hingeSide==='right',swing=Number(e.swingSide)===-1?-1:1;
          const phi=18*swing*(hingeRight?-1:1),pr=rad(phi),hingeX=hingeRight?w/2:-w/2;
          const vx=-hingeX,centerX=hingeX+vx*Math.cos(pr),centerY=vx*Math.sin(pr);
          localBox(mesh,e,centerX,centerY,z0+h/2,w,t,h,base,1,phi);
          const knobClosedX=(hingeRight?-1:1)*w*.31,knobVx=knobClosedX-hingeX,knobVy=-t*.72;
          const knobLocal={x:hingeX+knobVx*Math.cos(pr)-knobVy*Math.sin(pr),y:knobVx*Math.sin(pr)+knobVy*Math.cos(pr)};
          const knob=localXY(e,knobLocal.x,knobLocal.y);addBox(mesh,knob.x,knob.y,z0+h*.50,.06,.035,.06,'#D1B36A',rad((e.angle||0)+phi),1);
        }
      } else {
        const glass=e.color||'#9CC9DF',frame='#E9EFF3',style=e.windowStyle||'sliding';
        localBox(mesh,e,0,0,z0+h/2,w,t*.52,h,glass,.34);
        const fw=Math.max(.045,Math.min(.085,w*.07)),fh=Math.max(.045,Math.min(.085,h*.08));
        localBox(mesh,e,-w/2+fw/2,0,z0+h/2,fw,t,h,frame,1);
        localBox(mesh,e,w/2-fw/2,0,z0+h/2,fw,t,h,frame,1);
        localBox(mesh,e,0,0,z0+fh/2,w,t,fh,frame,1);
        localBox(mesh,e,0,0,z0+h-fh/2,w,t,fh,frame,1);
        if(style==='sliding'){
          localBox(mesh,e,0,0,z0+h/2,fw,t*.92,h*.92,frame,1);
          localBox(mesh,e,-w*.23,-t*.34,z0+h*.52,w*.44,.025,fw*.55,frame,1);
          localBox(mesh,e,w*.23,t*.34,z0+h*.48,w*.44,.025,fw*.55,frame,1);
        }else if(style==='fixed'){
          localBox(mesh,e,0,0,z0+h/2,fw*.55,t*.9,h*.90,frame,.8);
        }else if(style==='awning'){
          const side=Number(e.windowSide)===-1?-1:1;
          localBox(mesh,e,0,side*t*.78,z0+h*.56,w*.86,.035,h*.72,frame,1);
          localBox(mesh,e,0,side*t*.86,z0+h*.56,w*.78,.018,h*.62,glass,.30);
          localBox(mesh,e,-w*.38,side*t*.48,z0+h*.18,.035,t*.72,h*.34,frame,1);
          localBox(mesh,e,w*.38,side*t*.48,z0+h*.18,.035,t*.72,h*.34,frame,1);
        }
      }
    }
  }

  function materialBase(r){
    if(!r.color&&(!r.material||r.material==='solid'))return '#D8D2C8';
    return typeof floorMaterialBase==='function'?floorMaterialBase(r,undefined,sceneProject().settings.palette):((r&&r.color)||scenePalette().room);
  }
  function seeded01(n){const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
  function addRoomMaterialDetails(mesh,r,base){
    const material=r.material||'solid';if(material==='solid')return;
    const line=vary(base,document.body.classList.contains('dark-mode')?.72:.78);
    if(material==='tile'){
      const step=.6;
      for(let x=r.x+step;x<r.x+r.w-.02;x+=step)addBox(mesh,x,r.y+r.h/2,.008,.012,r.h,.012,line,0,1);
      for(let y=r.y+step;y<r.y+r.h-.02;y+=step)addBox(mesh,r.x+r.w/2,y,.008,r.w,.012,.012,line,0,1);
    }else if(material==='wood'){
      const plank=.22;
      let i=0;for(let y=r.y+plank;y<r.y+r.h-.02;y+=plank,i++){
        addBox(mesh,r.x+r.w/2,y,.008,r.w,.009,.011,line,0,1);
        const jointX=r.x+((i%2)?.33:.66)*r.w;
        addBox(mesh,jointX,y-plank/2,.009,.009,plank,.012,vary(base,.72),0,1);
      }
    }else if(material==='concrete'){
      const count=Math.min(36,Math.max(10,Math.round(r.w*r.h*.55)));
      for(let i=0;i<count;i++){
        const px=r.x+.08+seeded01(i+r.x*7+r.y*11)*(Math.max(.1,r.w-.16));
        const py=r.y+.08+seeded01(i*1.91+r.x*13-r.y*5)*(Math.max(.1,r.h-.16));
        const sz=.025+seeded01(i*2.7)*.05;
        addBox(mesh,px,py,.006,sz,sz,.009,vary(base,.74+seeded01(i*3.1)*.20),0,1);
      }
    }else if(material==='grass'){
      const area=Math.max(.2,r.w*r.h),spacing=Math.max(.42,Math.sqrt(area/150));
      let idx=0;
      for(let x=r.x+spacing*.45;x<r.x+r.w;x+=spacing){
        for(let y=r.y+spacing*.45;y<r.y+r.h;y+=spacing){
          const jx=(seeded01(idx*3.7)-.5)*spacing*.42,jy=(seeded01(idx*5.9)-.5)*spacing*.42;
          const h=.055+seeded01(idx*7.3)*.06;
          addBox(mesh,x+jx,y+jy,h/2+.003,.018,.075,h,vary(base,.66+seeded01(idx*2.2)*.22),seeded01(idx*4.4)*Math.PI,1);
          idx++;
        }
      }
    }
  }
  function addRooms(mesh){
    for(const r of active3DElements().filter(e=>e.type==='room')){
      const base=materialBase(r);
      // Finish layer sits above the structural slab, avoiding coplanar faces.
      vertexElevation+=.02;
      addCutSurface(mesh,r,-.07,0,base);
      vertexElevation-=.02;
    }
  }

  function objectDefaultColor(kind){
    return ({sofa:'#78889B',bed:'#D9D3C7',table:'#A9825A',desk:'#A9825A',toilet:'#ECEFF1',sink:'#E4E9EC',plant:'#6A966D',pool:'#67B7D1',tree:'#5F8C5B',car:'#708090',grill:'#5D6166',fridge:'#D9E0E4',stove:'#5A6066',counter:'#A47B55',wardrobe:'#9A7656',tv:'#242A30',column:'#B7B9B8',halfwall:'#D2D0CA',slidingGate:'#5A6269',doubleGate:'#5D6266',pedestrianGate:'#566068',pergola:'#9B714B'})[kind]||scenePalette().object;
  }

  function modelSofa(mesh,e,c){
    const w=e.w||2.1,d=e.h||.85;
    localBox(mesh,e,0,0,.17,w*.92,d*.82,.34,vary(c,.84));
    localBox(mesh,e,0,-d*.38,.53,w*.94,d*.18,.72,vary(c,.72));
    localBox(mesh,e,-w*.44,0,.43,w*.12,d*.72,.55,vary(c,.75));
    localBox(mesh,e,w*.44,0,.43,w*.12,d*.72,.55,vary(c,.75));
    localBox(mesh,e,-w*.22,d*.04,.40,w*.40,d*.53,.14,vary(c,1.08));
    localBox(mesh,e,w*.22,d*.04,.40,w*.40,d*.53,.14,vary(c,1.08));
  }
  function modelBed(mesh,e,c){
    const w=e.w||1.6,d=e.h||2;
    localBox(mesh,e,0,0,.12,w,d,.24,vary(c,.62));
    localBox(mesh,e,0,.03*d,.34,w*.94,d*.88,.26,vary(c,1.08));
    localBox(mesh,e,0,-d*.45,.58,w,.10,.86,vary(c,.70));
    localBox(mesh,e,-w*.23,-d*.30,.51,w*.39,d*.19,.12,'#F4F1EA');
    localBox(mesh,e,w*.23,-d*.30,.51,w*.39,d*.19,.12,'#F4F1EA');
    localBox(mesh,e,0,d*.18,.49,w*.91,d*.38,.055,vary(c,.82));
  }
  function modelTable(mesh,e,c){
    const w=e.w||1.5,d=e.h||.9,leg=Math.max(.055,Math.min(.11,Math.min(w,d)*.12));
    localBox(mesh,e,0,0,.74,w,d,.10,c);
    for(const sx of [-1,1])for(const sy of [-1,1])localBox(mesh,e,sx*(w/2-leg*.9),sy*(d/2-leg*.9),.36,leg,leg,.72,vary(c,.72));
  }
  function modelDesk(mesh,e,c){
    const w=e.w||1.3,d=e.h||.65;
    localBox(mesh,e,0,0,.75,w,d,.09,c);
    localBox(mesh,e,-w*.43,0,.37,w*.10,d*.78,.74,vary(c,.72));
    localBox(mesh,e,w*.43,0,.37,w*.10,d*.78,.74,vary(c,.72));
    localBox(mesh,e,w*.25,0,.56,w*.28,d*.67,.25,vary(c,.86));
    localBox(mesh,e,w*.25,-d*.35,.57,w*.20,.035,.035,'#454B52');
  }
  function modelToilet(mesh,e,c){
    const w=e.w||.65,d=e.h||.8;
    localCylinder(mesh,e,0,d*.08,.18,Math.min(w,d)*.30,.32,c,18,1);
    localCylinder(mesh,e,0,d*.08,.49,Math.min(w,d)*.31,.055,'#F7F8F8',18,1);
    localBox(mesh,e,0,-d*.31,.60,w*.70,d*.25,.58,vary(c,.96));
    localBox(mesh,e,0,d*.02,.13,w*.42,d*.38,.26,vary(c,.90));
  }
  function modelSink(mesh,e,c){
    const w=e.w||.8,d=e.h||.55;
    localBox(mesh,e,0,0,.43,w*.88,d*.88,.80,vary(c,.88));
    localBox(mesh,e,0,0,.86,w,d,.10,c);
    localBox(mesh,e,0,d*.01,.91,w*.56,d*.48,.035,'#CBD5DB');
    localBox(mesh,e,0,-d*.28,1.00,.055,.055,.24,'#8A949B');
    localBox(mesh,e,0,-d*.19,1.10,.055,.18,.055,'#8A949B');
  }
  function modelPlant(mesh,e,c){
    const w=e.w||.65,d=e.h||.65,r=Math.min(w,d)*.22;
    localCylinder(mesh,e,0,0,0,r,.34,'#A56B43',14,1);localCylinder(mesh,e,0,0,.30,.035,.36,'#6C7C56',10,1);
    const leaf=vary(c,.94);
    for(const [lx,ly,z,rr] of [[0,0,.52,.23],[w*.16,0,.62,.18],[-w*.16,0,.62,.18],[0,d*.15,.68,.17],[0,-d*.15,.66,.17]]){
      localCylinder(mesh,e,lx,ly,z,rr,.20,leaf,10,1);
    }
  }
  function modelPool(mesh,e,c){
    const w=e.w||4,d=e.h||2.4,b=.12;
    localBox(mesh,e,0,0,.015,w*.94,d*.94,.03,c,.68);
    localBox(mesh,e,0,-d/2+b/2,.055,w,b,.11,'#D8D2C7');
    localBox(mesh,e,0,d/2-b/2,.055,w,b,.11,'#D8D2C7');
    localBox(mesh,e,-w/2+b/2,0,.055,b,d,.11,'#D8D2C7');
    localBox(mesh,e,w/2-b/2,0,.055,b,d,.11,'#D8D2C7');
    for(const x of [-w*.20,0,w*.20])localBox(mesh,e,x,0,.038,.025,d*.72,.018,vary(c,1.18),.80);
  }
  function modelTree(mesh,e,c){
    const w=e.w||1.6,d=e.h||1.6,r=Math.min(w,d);
    localCylinder(mesh,e,0,0,0,.13,1.30,'#7B6248',12,1);
    for(const [lx,ly,z,rr] of [[0,0,1.05,r*.34],[w*.19,0,1.28,r*.28],[-w*.19,0,1.30,r*.28],[0,d*.18,1.48,r*.28],[0,-d*.18,1.45,r*.28],[0,0,1.70,r*.30]]){
      localCylinder(mesh,e,lx,ly,z,rr,.48,vary(c,.94+z*.03),12,1);
    }
  }
  function modelCar(mesh,e,c){
    const w=e.w||1.8,d=e.h||4.2;
    localBox(mesh,e,0,0,.31,w*.88,d*.84,.50,c);
    localBox(mesh,e,0,-d*.02,.72,w*.72,d*.39,.43,vary(c,1.05));
    localBox(mesh,e,0,-d*.23,.80,w*.60,d*.025,.27,'#344654');
    localBox(mesh,e,0,d*.18,.80,w*.60,d*.025,.27,'#344654');
    localBox(mesh,e,0,-d*.37,.43,w*.80,d*.17,.24,vary(c,.95));
    localBox(mesh,e,0,d*.36,.42,w*.80,d*.16,.22,vary(c,.92));
    for(const sx of [-1,1])for(const sy of [-1,1])localBox(mesh,e,sx*w*.46,sy*d*.27,.23,w*.11,d*.18,.36,'#272A2D');
    localBox(mesh,e,0,-d*.445,.48,w*.46,.035,.09,'#F3E6B3');
    localBox(mesh,e,0,d*.445,.47,w*.46,.035,.09,'#B44C4C');
  }
  function modelGrill(mesh,e,c){
    const w=e.w||.9,d=e.h||.75,r=Math.min(w,d)*.34;
    localCylinder(mesh,e,0,0,.55,r,.28,c,16,1);
    localCylinder(mesh,e,0,0,.82,r*.96,.035,'#33383D',16,1);
    for(const [lx,ly] of [[-w*.23,-d*.18],[w*.23,-d*.18],[0,d*.23]])localBox(mesh,e,lx,ly,.28,.055,.055,.56,'#5A6065');
    localBox(mesh,e,0,0,.91,w*.58,.035,.035,'#B8BDC1');
  }
  function modelFridge(mesh,e,c){
    const w=e.w||.9,d=e.h||.72,H=1.85;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,-d*.505,H*.57,w*.92,.025,.045,vary(c,.72));
    localBox(mesh,e,w*.32,-d*.535,H*.72,.035,.035,.42,'#8D969D');
    localBox(mesh,e,w*.32,-d*.535,H*.29,.035,.035,.42,'#8D969D');
    localBox(mesh,e,0,-d*.52,H*.77,w*.86,.018,H*.37,vary(c,1.05));
    localBox(mesh,e,0,-d*.52,H*.29,w*.86,.018,H*.48,vary(c,.98));
  }
  function modelStove(mesh,e,c){
    const w=e.w||.62,d=e.h||.66,H=.9;
    localBox(mesh,e,0,0,H*.43,w,d,H*.86,c);
    localBox(mesh,e,0,0,H*.91,w*.98,d*.98,.08,vary(c,.82));
    for(const [lx,ly] of [[-w*.22,-d*.2],[w*.22,-d*.2],[-w*.22,d*.2],[w*.22,d*.2]])localCylinder(mesh,e,lx,ly,H*.96,Math.min(w,d)*.115,.026,'#202429',14,1);
    localBox(mesh,e,0,-d*.505,H*.47,w*.72,.018,H*.42,'#272D32');
    localBox(mesh,e,0,-d*.52,H*.74,w*.72,.035,.035,'#AEB5BA');
    for(const x of [-w*.28,-w*.10,w*.10,w*.28])localCylinder(mesh,e,x,-d*.535,H*.82,.025,.035,'#D0D4D6',10,1);
  }
  function modelCounter(mesh,e,c){
    const w=e.w||1.8,d=e.h||.65,H=.92;
    localBox(mesh,e,0,0,H*.44,w*.98,d*.94,H*.84,c);
    localBox(mesh,e,0,0,H*.91,w,d,.09,vary(c,1.08));
    for(const x of [-w*.32,0,w*.32])localBox(mesh,e,x,-d*.49,H*.46,.018,.025,H*.74,vary(c,.70));
    for(const x of [-w*.16,w*.16])localBox(mesh,e,x,-d*.515,H*.54,.035,.035,.035,'#3F464C');
  }
  function modelWardrobe(mesh,e,c){
    const w=e.w||1.8,d=e.h||.6,H=2.15;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,-d*.51,H*.52,.018,.018,H*.92,vary(c,.65));
    localBox(mesh,e,-w*.035,-d*.535,H*.52,.025,.025,.20,'#B7A37D');
    localBox(mesh,e,w*.035,-d*.535,H*.52,.025,.025,.20,'#B7A37D');
    localBox(mesh,e,0,0,H*.96,w*.96,d*.96,.06,vary(c,.88));
  }
  function modelTV(mesh,e,c){
    const w=e.w||1.25,d=e.h||.12,H=.72;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,-d*.54,H*.52,w*.91,.018,H*.82,'#11171B');
    localBox(mesh,e,0,d*.20,-.08,w*.12,d*.45,.16,vary(c,.72));
    localBox(mesh,e,0,d*.36,-.15,w*.36,d*.25,.055,vary(c,.65));
  }
  function modelColumn(mesh,e,c){
    const w=e.w||.3,d=e.h||.3,H=2.7;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,0,.08,w*1.18,d*1.18,.16,vary(c,.85));
    localBox(mesh,e,0,0,H-.08,w*1.14,d*1.14,.16,vary(c,.9));
  }
  function modelHalfWall(mesh,e,c){
    const w=e.w||2,d=e.h||.16,H=1.05;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,0,H+.035,w*1.02,d*1.45,.07,vary(c,.88));
  }
  function gateBars(mesh,e,c,w,d,H,mode){
    localBox(mesh,e,0,0,.07,w,d*.9,.14,vary(c,.70));
    localBox(mesh,e,0,0,H-.06,w,d*.9,.12,vary(c,.74));
    const spacing=Math.max(.18,w/14);
    for(let x=-w/2+.11;x<w/2-.08;x+=spacing)localBox(mesh,e,x,0,H/2,.045,d*.82,H*.91,c);
    if(mode==='double'){
      localBox(mesh,e,0,-d*.04,H/2,.055,d,H*.96,vary(c,.72));
      localBox(mesh,e,-w*.25,-d*.03,H/2,w*.56,.035,.045,vary(c,.84),1,32);
      localBox(mesh,e,w*.25,-d*.03,H/2,w*.56,.035,.045,vary(c,.84),1,-32);
    }
  }
  function modelSlidingGate(mesh,e,c){
    const w=e.w||3.2,d=e.h||.16,H=1.85;gateBars(mesh,e,c,w,d,H,'sliding');
    localCylinder(mesh,e,-w*.38,d*.10,.02,.07,.08,'#252A2E',12,1);localCylinder(mesh,e,w*.38,d*.10,.02,.07,.08,'#252A2E',12,1);
    localBox(mesh,e,0,d*.65,.025,w*1.08,.05,.05,'#6D7378');
  }
  function modelDoubleGate(mesh,e,c){const w=e.w||3,d=e.h||.16,H=1.85;gateBars(mesh,e,c,w,d,H,'double');}
  function modelPedestrianGate(mesh,e,c){
    const w=e.w||.95,d=e.h||.14,H=1.9;gateBars(mesh,e,c,w,d,H,'single');
    localCylinder(mesh,e,w*.31,-d*.62,H*.52,.035,.05,'#C6A45B',10,1);
  }
  function modelPergola(mesh,e,c){
    const w=e.w||3,d=e.h||2.5,H=2.45,post=.13;
    for(const sx of [-1,1])for(const sy of [-1,1])localBox(mesh,e,sx*(w/2-post),sy*(d/2-post),H/2,post,post,H,c);
    localBox(mesh,e,0,-d/2+post,H,w,post,.16,vary(c,.9));localBox(mesh,e,0,d/2-post,H,w,post,.16,vary(c,.9));
    const beams=7;for(let i=0;i<beams;i++){const x=-w*.43+i*(w*.86/(beams-1));localBox(mesh,e,x,0,H+.09,.09,d*1.03,.12,vary(c,1.03));}
  }
  function modelGeneric(mesh,e,c){
    const w=e.w||1,d=e.h||1;
    localBox(mesh,e,0,0,.31,w,d,.62,c);
    localBox(mesh,e,0,0,.64,w*.78,d*.78,.05,vary(c,1.12));
  }

  function addObjects(mesh){
    for(const e of active3DElements().filter(e=>e.type==='object')){
      const starts={opaque:mesh.opaque.length,transparent:mesh.transparent.length};
      const c=e.color||objectDefaultColor(e.kind);
      if(e.kind==='sofa')modelSofa(mesh,e,c);
      else if(e.kind==='bed')modelBed(mesh,e,c);
      else if(e.kind==='table')modelTable(mesh,e,c);
      else if(e.kind==='desk')modelDesk(mesh,e,c);
      else if(e.kind==='toilet')modelToilet(mesh,e,c);
      else if(e.kind==='sink')modelSink(mesh,e,c);
      else if(e.kind==='plant')modelPlant(mesh,e,c);
      else if(e.kind==='pool')modelPool(mesh,e,c);
      else if(e.kind==='tree')modelTree(mesh,e,c);
      else if(e.kind==='car')modelCar(mesh,e,c);
      else if(e.kind==='grill')modelGrill(mesh,e,c);
      else if(e.kind==='fridge')modelFridge(mesh,e,c);
      else if(e.kind==='stove')modelStove(mesh,e,c);
      else if(e.kind==='counter')modelCounter(mesh,e,c);
      else if(e.kind==='wardrobe')modelWardrobe(mesh,e,c);
      else if(e.kind==='tv')modelTV(mesh,e,c);
      else if(e.kind==='column')modelColumn(mesh,e,c);
      else if(e.kind==='halfwall')modelHalfWall(mesh,e,c);
      else if(e.kind==='slidingGate')modelSlidingGate(mesh,e,c);
      else if(e.kind==='doubleGate')modelDoubleGate(mesh,e,c);
      else if(e.kind==='pedestrianGate')modelPedestrianGate(mesh,e,c);
      else if(e.kind==='pergola')modelPergola(mesh,e,c);
      else modelGeneric(mesh,e,c);
      fitObjectGeometry(mesh,starts,e);
    }
  }

  // Match the full model (including feet, handles and trim) to its metre-sized
  // footprint and height. Recompute normals after nonuniform scaling.
  function fitObjectGeometry(mesh,starts,e){
    const angle=rad(e.rotation||0),c=Math.cos(angle),s=Math.sin(angle);
    const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    const local=(arr,i)=>{const x=arr[i]-e.x,y=arr[i+1]-e.y;return [x*c+y*s,-x*s+y*c,arr[i+2]];};
    for(const kind of ['opaque','transparent'])for(let i=starts[kind];i<mesh[kind].length;i+=STRIDE){const p=local(mesh[kind],i);for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a]);}}
    const size=[e.w||1,e.h||1,objectVisualHeight(e)],scale=size.map((v,a)=>v/Math.max(.0001,max[a]-min[a]));
    for(const kind of ['opaque','transparent']){
      const arr=mesh[kind];
      for(let i=starts[kind];i<arr.length;i+=STRIDE){const p=local(arr,i),x=(p[0]-(min[0]+max[0])/2)*scale[0],y=(p[1]-(min[1]+max[1])/2)*scale[1];arr[i]=e.x+x*c-y*s;arr[i+1]=e.y+x*s+y*c;arr[i+2]=vertexElevation+objectElevation(e)+(p[2]-min[2])*scale[2];}
      for(let i=starts[kind];i<arr.length;i+=STRIDE*3){const point=o=>({x:arr[o],y:arr[o+1],z:arr[o+2]}),a=point(i),n=norm(cross(sub(point(i+STRIDE),a),sub(point(i+STRIDE*2),a)));for(let v=0;v<3;v++){arr[i+v*STRIDE+7]=n.x;arr[i+v*STRIDE+8]=n.y;arr[i+v*STRIDE+9]=n.z;}}
    }
  }

  function emptyMesh(){return {opaque:[],transparent:[],lines:[],overlayLines:[],annotations:[]};}
  function dimensionPoints(e){
    const dx=e.x2-e.x1,dy=e.y2-e.y1,length=Math.hypot(dx,dy)||1,offset=e.offset??.3;
    return {a:{x:e.x1-dy/length*offset,y:e.y1+dx/length*offset},b:{x:e.x2-dy/length*offset,y:e.y2+dx/length*offset}};
  }
  function addAnnotations(mesh){
    const label=(e,x,y,text,size=13)=>mesh.annotations.push({id:e.id,floorId:buildingFloor.id,x,y,z:vertexElevation+.08,text:String(text||''),size,bold:!!e.bold,rotation:e.rotation||0,color:e.color||'#334155'});
    for(const e of active3DElements()){
      if(e.type==='text')label(e,e.x,e.y,e.content,e.size||16);
      if(e.type==='room'&&e.name)label(e,e.x+e.w/2,e.y+e.h/2,e.name);
      if(e.type==='cota'){
        const {a,b}=dimensionPoints(e),length=Math.hypot(b.x-a.x,b.y-a.y);
        const line=(a,b)=>addBox(mesh,(a.x+b.x)/2,(a.y+b.y)/2,.055,Math.hypot(b.x-a.x,b.y-a.y),.018,.012,'#6685A4',Math.atan2(b.y-a.y,b.x-a.x));
        line(a,b);line({x:e.x1,y:e.y1},a);line({x:e.x2,y:e.y2},b);
        label(e,(a.x+b.x)/2,(a.y+b.y)/2,formatMeters(length),12);
      }
    }
  }
  function addStairs(mesh){
    for(const e of active3DElements().filter(e=>e.type==='stair')){
      const g=VisualMakerModel.stairGeometry(e,sceneProject());if(!g.valid)continue;
      for(const step of g.steps){
        const p=g.world(step.x,step.y);
        addBox(mesh,p.x,p.y,step.z/2,step.w,step.h,step.z,e.color||'#C6B49A',rad(e.rotation||0));
      }
    }
  }
  function addCutSurface(mesh,r,z0,z1,color){
    const holes=VisualMakerModel.stairOpenings(sceneProject(),buildingFloor.id);
    if(!holes.length){
      addBox(mesh,r.x+r.w/2,r.y+r.h/2,(z0+z1)/2,r.w,r.h,z1-z0,color);
      addRoomMaterialDetails(mesh,r,color);return;
    }
    const polygon=[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];
    for(const piece of VisualMakerModel.subtractOpenings(polygon,holes)){
      for(let i=1;i<piece.length-1;i++){
        addTriangle(mesh,{...piece[0],z:z1},{...piece[i],z:z1},{...piece[i+1],z:z1},color);
        addTriangle(mesh,{...piece[0],z:z0},{...piece[i+1],z:z0},{...piece[i],z:z0},color);
      }
      for(let i=0;i<piece.length;i++){
        const a=piece[i],b=piece[(i+1)%piece.length];
        addQuad(mesh,{...a,z:z0},{...b,z:z0},{...b,z:z1},{...a,z:z1},color);
      }
    }
    // Clip tile joints, planks and other finish detail triangles as well, so no
    // decorative geometry floats across the stairwell.
    const details=emptyMesh();addRoomMaterialDetails(details,r,color);
    for(const kind of ['opaque','transparent']){
      const arr=details[kind];
      for(let i=0;i<arr.length;i+=STRIDE*3){
        const poly=[0,1,2].map(v=>{const o=i+v*STRIDE;return {x:arr[o],y:arr[o+1],z:arr[o+2],r:arr[o+3],g:arr[o+4],b:arr[o+5],a:arr[o+6],nx:arr[o+7],ny:arr[o+8],nz:arr[o+9]};});
        for(const piece of VisualMakerModel.subtractOpenings(poly,holes))for(let j=1;j<piece.length-1;j++)for(const p of [piece[0],piece[j],piece[j+1]])mesh[kind].push(p.x,p.y,p.z,p.r,p.g,p.b,p.a,p.nx,p.ny,p.nz);
      }
    }
  }
  function addFloorSurface(mesh,floor){
    const bounds=VisualMakerModel.footprint(floor),surface=floor.floorSurface;
    if(!bounds||surface.enabled===false)return;
    const r={...bounds,...surface},thickness=Math.max(.008,floor.slabThickness);
    const base=materialBase(r);
    addCutSurface(mesh,r,-thickness,0,base);
  }
  function buildProjectScene(eye,exporting=false,project=activeProject()){
    const mesh=emptyMesh(),layout=VisualMakerModel.floorLayout(project);
    mesh.floors=[];buildingProject=project;
    try{
      if(!exporting&&sceneProject().settings.gridOn!==false){vertexElevation=floorBase();addGrid(mesh.lines);vertexElevation=0;}
      for(const entry of layout){
        if(!exporting&&floorVisibility==='active'&&entry.floor.id!==state.activeFloorId)continue;
        const range={id:entry.floor.id,name:floorDisplayName(entry.floor,entry.index),elevation:entry.elevation,opaqueStart:mesh.opaque.length,transparentStart:mesh.transparent.length};
        buildingFloor=entry.floor;vertexElevation=entry.elevation;
        addFloorSurface(mesh,entry.floor);addRooms(mesh);
        range.wallStart=mesh.opaque.length;
        for(const wall of active3DElements().filter(e=>e.type==='wall'))if(exporting||!shouldHideFrontWall(wall,eye))addWallGeometry(mesh,wall);
        range.wallEnd=mesh.opaque.length;
        addOpeningPanels(mesh,eye,exporting);addObjects(mesh);addStairs(mesh);addAnnotations(mesh);
        if(!exporting&&entry.floor.id===state.activeFloorId){
          const selection=typeof getSelectedElements==='function'?getSelectedElements():[selectedEditableElement()].filter(Boolean);
          for(const e of selection)addSelectionOverlay(mesh,e);
        }
        range.opaqueEnd=mesh.opaque.length;range.transparentEnd=mesh.transparent.length;mesh.floors.push(range);
      }
      buildingFloor=null;vertexElevation=0;
    }finally{buildingFloor=null;buildingProject=null;vertexElevation=0;}
    return mesh;
  }
  function buildScene(eye){return buildProjectScene(eye);}
  // Editor, HTML and OBJ all consume the exact same storey geometry.
  function buildExportScene(){return buildProjectScene(cameraEye(),true);}

  function exportBaseName(){
    let name='planta';
    try{
      if(typeof safeProjectFilename==='function')name=safeProjectFilename();
      else if(state&&state.projectName)name=String(state.projectName);
    }catch(_){/* usa nome padrão */}
    name=String(name||'planta').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\- ]/g,'').trim().replace(/\s+/g,'-');
    return name||'planta';
  }

  function materialInfoFromVertex(arr,offset){
    const r=clamp(arr[offset+3]||0,0,1),g=clamp(arr[offset+4]||0,0,1),b=clamp(arr[offset+5]||0,0,1),a=clamp(arr[offset+6]==null?1:arr[offset+6],0,1);
    const ri=Math.round(r*255),gi=Math.round(g*255),bi=Math.round(b*255),ai=Math.round(a*255);
    return {key:`mat_${ri}_${gi}_${bi}_${ai}`,r,g,b,a};
  }

  function meshToOBJMTL(mesh,objName,mtlFileName){
    const obj=[
      '# Visual Maker - modelo 3D',
      '# 1 unidade = 1 metro',
      `mtllib ${mtlFileName}`,
      `o ${objName}`,
      's off'
    ];
    const materials=new Map();
    let vertexIndex=1,lastMaterial='';

    const appendTriangles=arr=>{
      const triStride=STRIDE*3;
      for(let i=0;i+triStride<=arr.length;i+=triStride){
        const mat=materialInfoFromVertex(arr,i);
        if(!materials.has(mat.key))materials.set(mat.key,mat);
        if(mat.key!==lastMaterial){obj.push(`usemtl ${mat.key}`);lastMaterial=mat.key;}
        for(let v=0;v<3;v++){
          const o=i+v*STRIDE;
          const x=Number(arr[o]).toFixed(5),y=Number(arr[o+1]).toFixed(5),z=Number(arr[o+2]).toFixed(5);
          obj.push(`v ${x} ${y} ${z}`);
          obj.push(`vn ${arr[o+7].toFixed(6)} ${arr[o+8].toFixed(6)} ${arr[o+9].toFixed(6)}`);
        }
        obj.push(`f ${vertexIndex}//${vertexIndex} ${vertexIndex+1}//${vertexIndex+1} ${vertexIndex+2}//${vertexIndex+2}`);
        vertexIndex+=3;
      }
    };
    appendTriangles(mesh.opaque);
    appendTriangles(mesh.transparent);

    const mtl=['# Visual Maker - materiais'];
    for(const mat of materials.values()){
      const f=n=>Number(n).toFixed(6);
      mtl.push('',`newmtl ${mat.key}`,
        `Ka ${f(mat.r*.22)} ${f(mat.g*.22)} ${f(mat.b*.22)}`,
        `Kd ${f(mat.r)} ${f(mat.g)} ${f(mat.b)}`,
        'Ks 0.060000 0.060000 0.060000',
        'Ns 18.000000',
        `d ${f(mat.a)}`,
        'illum 2');
    }
    return {obj:obj.join('\n')+'\n',mtl:mtl.join('\n')+'\n'};
  }

  function crc32(bytes){
    let crc=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++){
      crc^=bytes[i];
      for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xEDB88320:0);
    }
    return (crc^0xFFFFFFFF)>>>0;
  }

  function zipDosDateTime(date){
    const year=Math.max(1980,date.getFullYear());
    return {
      time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),
      date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()
    };
  }

  function makeStoredZip(entries){
    const encoder=new TextEncoder(),now=zipDosDateTime(new Date());
    const locals=[],centrals=[];
    let offset=0,centralSize=0;
    const u16=(view,at,v)=>view.setUint16(at,v,true),u32=(view,at,v)=>view.setUint32(at,v>>>0,true);

    for(const entry of entries){
      const nameBytes=encoder.encode(entry.name),dataBytes=typeof entry.data==='string'?encoder.encode(entry.data):entry.data;
      const crc=crc32(dataBytes),local=new Uint8Array(30+nameBytes.length),lv=new DataView(local.buffer);
      u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0);u16(lv,8,0);u16(lv,10,now.time);u16(lv,12,now.date);
      u32(lv,14,crc);u32(lv,18,dataBytes.length);u32(lv,22,dataBytes.length);u16(lv,26,nameBytes.length);u16(lv,28,0);
      local.set(nameBytes,30);
      locals.push(local,dataBytes);

      const central=new Uint8Array(46+nameBytes.length),cv=new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0);u16(cv,10,0);u16(cv,12,now.time);u16(cv,14,now.date);
      u32(cv,16,crc);u32(cv,20,dataBytes.length);u32(cv,24,dataBytes.length);u16(cv,28,nameBytes.length);u16(cv,30,0);u16(cv,32,0);
      u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);central.set(nameBytes,46);
      centrals.push(central);centralSize+=central.length;
      offset+=local.length+dataBytes.length;
    }

    const end=new Uint8Array(22),ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,entries.length);u16(ev,10,entries.length);
    u32(ev,12,centralSize);u32(ev,16,offset);u16(ev,20,0);
    return new Blob([...locals,...centrals,end],{type:'application/zip'});
  }

  function downloadBlob(blob,filename){
    const a=document.createElement('a'),url=URL.createObjectURL(blob);
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function standaloneViewerCamera(){
    if(cameraInitialized){
      return {yaw,pitch,distance,target:{x:target.x,y:target.y,z:target.z}};
    }
    return fitCamera(contentBBox(),buildingHeight());
  }

  function buildStandalone3DHTML(mesh){
    const camera=standaloneViewerCamera();
    const projectName=String((state&&state.projectName)||t('standalone3D'));
    const dark=document.body.classList.contains('dark-mode');
    const scenes=state.projects.map((project,index)=>{
      const geometry=project.id===state.activeProjectId?mesh:buildProjectScene(cameraEye(),true,project);
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,maxZ=0;
      for(const vertices of [geometry.opaque,geometry.transparent])for(let i=0;i<vertices.length;i+=STRIDE){minX=Math.min(minX,vertices[i]);maxX=Math.max(maxX,vertices[i]);minY=Math.min(minY,vertices[i+1]);maxY=Math.max(maxY,vertices[i+1]);maxZ=Math.max(maxZ,vertices[i+2]);}
      if(!Number.isFinite(minX)){minX=minY=-4;maxX=maxY=4;}
      const fit=fitCamera({minX,minY,maxX,maxY},maxZ);
      return {id:project.id,name:projectDisplayName(project,index),opaque:geometry.opaque,transparent:geometry.transparent,annotations:geometry.annotations,floors:geometry.floors,walkScene:buildWalkScene(project),person:project.id===state.activeProjectId?person:personSettings(project.settings.view3d?.person),activeFloorId:project.activeFloorId,camera:project.id===state.activeProjectId?camera:fit,dark};
    });
    const payload={activeProjectId:state.activeProjectId,projects:scenes,source:VisualMakerModel.serialize(state)};
    const dataJSON=JSON.stringify(payload).replace(/</g,'\\u003c');
    const title=projectName.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    const lang=window.getCurrentLanguage()==='en'?'en':'pt-BR';
    const lightBgJSON=JSON.stringify(t('lightBackground'));
    const darkBgJSON=JSON.stringify(t('darkBackground'));
    return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — ${t('standalone3D')}</title>
<style>
  :root{color-scheme:${dark?'dark':'light'};font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:${dark?'#1b222a':'#e3ecf2'}}
  body{position:relative;-webkit-user-select:none;user-select:none}canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}canvas.dragging{cursor:grabbing}
  .topbar{position:fixed;left:16px;right:16px;top:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;pointer-events:none;z-index:2}
  .card{pointer-events:auto;background:${dark?'rgba(28,35,43,.92)':'rgba(255,255,255,.92)'};color:${dark?'#eef3f7':'#1d2935'};border:1px solid ${dark?'rgba(255,255,255,.12)':'rgba(23,42,58,.14)'};box-shadow:0 10px 30px rgba(0,0,0,.14);border-radius:12px;backdrop-filter:blur(9px)}
  .title{padding:11px 14px;max-width:min(480px,70vw)}.title strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title small{display:block;margin-top:3px;opacity:.66;font-size:11px}
  .actions{display:flex;flex-wrap:wrap;align-items:center;gap:7px;padding:7px}.actions select{max-width:150px;padding:7px;border-radius:6px}.actions label{font-size:12px}.actions button{border:1px solid ${dark?'rgba(255,255,255,.12)':'rgba(23,42,58,.14)'};background:${dark?'#303a44':'#f7fafc'};color:inherit;border-radius:8px;padding:8px 11px;font:inherit;font-size:12px;cursor:pointer}.actions button:hover{filter:brightness(${dark?'1.12':'.97'})}
  .help{position:fixed;left:16px;bottom:16px;max-width:min(560px,calc(100vw - 32px));padding:10px 13px;font-size:11px;line-height:1.45;pointer-events:none;z-index:2}.help b{font-weight:650}.error{position:fixed;inset:0;display:none;place-items:center;padding:30px;text-align:center;color:#fff;background:#202830;z-index:5}.error.show{display:grid}
  .walk-controls{display:none;position:fixed;right:16px;bottom:100px;gap:6px;z-index:3}body.view-person .walk-controls{display:flex}.walk-controls button{width:42px;height:42px;border:1px solid #8996a5;border-radius:8px;background:#fff;color:#182b40;font-size:22px;touch-action:none}
  .person-settings{display:none;position:fixed;left:16px;bottom:75px;padding:10px;gap:12px;z-index:3}body.view-person .person-settings{display:flex}.person-settings label{font-size:12px}.person-settings input{width:64px;margin-left:6px;padding:5px}
  @media(max-width:620px){.topbar{left:10px;right:10px;top:10px}.title small{display:none}.help{left:10px;bottom:10px}.actions button{padding:8px}.actions .wide{display:none}}
</style>
</head>
<body>
<canvas id="viewer" aria-label="${t('standalone3D')} — ${title}"></canvas>
<svg id="annotations" style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none" aria-hidden="true"></svg>
<div class="topbar">
  <div class="card title"><strong>${title}</strong><small>${t('standalone3DOffline')}</small></div>
  <div class="card actions"><select id="projects" aria-label="${t('projects')}"></select><select id="floors" aria-label="${t('floors')}"></select><button id="reset" title="${t('centerTitle')}">${t('center')}</button><button id="top">${t('topView')}</button><button id="person" aria-pressed="false">${t('viewPerson')}</button><label><input id="walls" type="checkbox" checked>${t('wall')}</label><label><input id="labels" type="checkbox" checked>${t('annotations')}</label><button id="theme" class="wide" title="${t('toggleBackground')}">${dark?t('lightBackground'):t('darkBackground')}</button></div>
</div>
<div class="card help" id="help">${t('standaloneHelp')}</div>
<div class="card person-settings"><label>${t('eyeHeight')}<input id="eye-height" aria-label="${t('eyeHeight')}" type="number" min="1.2" max="1.95" step=".05" value="1.65"></label><label>${t('fieldOfView')}<input id="fov" aria-label="${t('fieldOfView')}" type="number" min="55" max="95" step="1" value="70"></label></div>
<div class="walk-controls" aria-label="${t('walkControls')}"><button data-walk-key="a" aria-label="${t('walkLeft')}">←</button><button data-walk-key="w" aria-label="${t('walkForward')}">↑</button><button data-walk-key="s" aria-label="${t('walkBack')}">↓</button><button data-walk-key="d" aria-label="${t('walkRight')}">→</button></div>
<div class="error" id="error"><div><h2>${t('couldNotOpen3D')}</h2><p>${t('webglNeeded')}</p></div></div>
<script id="visual-maker-data" type="application/json">${dataJSON}</script>
<script>
(()=>{
'use strict';
const FILE=JSON.parse(document.getElementById('visual-maker-data').textContent);
let DATA=FILE.projects.find(p=>p.id===FILE.activeProjectId)||FILE.projects[0],floorId='all',showWalls=true,showLabels=true;
const canvas=document.getElementById('viewer'),error=document.getElementById('error');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false});
if(!gl){error.classList.add('show');return;}
const STRIDE=${STRIDE},clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=d=>d*Math.PI/180;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return{x:a.x/n,y:a.y/n,z:a.z/n}};
const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
let yaw=finite(DATA.camera.yaw,-.72),pitch=finite(DATA.camera.pitch,.66),distance=finite(DATA.camera.distance,16);
let target={x:finite(DATA.camera.target.x,0),y:finite(DATA.camera.target.y,0),z:finite(DATA.camera.target.z,1)};
let initial={yaw,pitch,distance,target:{...target}};let drag=null,dark=!!DATA.dark;
let walk=null;
${personSettings.toString()}
let person=personSettings(DATA.person);
${viewFov.toString()}
${createWalkNavigation.toString()}
${attachWalkControls.toString()}
function setWalking(enabled){
  clearWalkInput();drag=null;
  walk=enabled?createWalkNavigation(DATA.walkScene,floorId==='all'?DATA.activeFloorId:floorId,yaw+Math.PI,person.eyeHeight):null;
  const button=document.getElementById('person');button.textContent=walk?${JSON.stringify(t('leavePerson'))}:${JSON.stringify(t('viewPerson'))};button.setAttribute('aria-pressed',String(!!walk));
  document.body.classList.toggle('view-person',!!walk);
  document.getElementById('help').innerHTML=walk?${JSON.stringify(t('personHelp'))}:${JSON.stringify(t('standaloneHelp'))};
  document.getElementById('walls').disabled=!!walk;document.getElementById('labels').disabled=!!walk;
  for(const [id,key] of [['eye-height','eyeHeight'],['fov','fov']])document.getElementById(id).value=person[key];
  draw();
}
const clearWalkInput=attachWalkControls(canvas,()=>walk,draw,()=>setWalking(false));
document.getElementById('person').addEventListener('click',()=>setWalking(!walk));
for(const [id,key] of [['eye-height','eyeHeight'],['fov','fov']])document.getElementById(id).addEventListener('input',e=>{person=personSettings({...person,[key]:e.target.value});walk?.setEyeHeight(person.eyeHeight);draw();});
function center(){return walk?walk.center():target;}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader');return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,${JSON.stringify(VERTEX_SHADER)}));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,${JSON.stringify(FRAGMENT_SHADER)}));gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Programa WebGL');
const aPosition=gl.getAttribLocation(program,'aPosition'),aColor=gl.getAttribLocation(program,'aColor'),aNormal=gl.getAttribLocation(program,'aNormal'),uMVP=gl.getUniformLocation(program,'uMVP'),buffer=gl.createBuffer();
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,(2*far*near)*nf,0])}
function lookAt(eye,center,up){const z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out}
function eye(){if(walk)return walk.eye();const cp=Math.cos(pitch),sp=Math.sin(pitch);return{x:target.x+distance*cp*Math.cos(yaw),y:target.y+distance*cp*Math.sin(yaw),z:target.z+distance*sp}}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);return{w,h}}
function bind(data){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const bytes=STRIDE*4;gl.enableVertexAttribArray(aPosition);gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(aColor);gl.vertexAttribPointer(aColor,4,gl.FLOAT,false,bytes,12);gl.enableVertexAttribArray(aNormal);gl.vertexAttribPointer(aNormal,3,gl.FLOAT,false,bytes,28)}
function drawData(data){if(!data||!data.length)return;bind(data);gl.drawArrays(gl.TRIANGLES,0,data.length/STRIDE)}
${renderAnnotationLabels.toString()}
function drawLabels(){
  const r=canvas.getBoundingClientRect(),e=eye(),forward=norm(sub(center(),e)),right=norm(cross(forward,{x:0,y:0,z:1})),up=norm(cross(right,forward)),tan=Math.tan(viewFov(r.width/r.height)/2);
  renderAnnotationLabels(document.getElementById('annotations'),!walk&&showLabels?(DATA.annotations||[]).filter(a=>floorId==='all'||a.floorId===floorId):[],p=>{
    const rel=sub(p,e),z=dot(rel,forward);if(z<=.03)return null;
    return {x:(dot(rel,right)/(z*tan*r.width/r.height)*.5+.5)*r.width,y:(.5-dot(rel,up)/(z*tan)*.5)*r.height};
  });
}
function draw(){const sz=resize(),bg=dark?[.105,.133,.164,1]:[.89,.925,.945,1];document.documentElement.style.colorScheme=dark?'dark':'light';document.body.style.background=dark?'#1b222a':'#e3ecf2';gl.clearColor(...bg);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);const e=eye(),mvp=multiply(perspective(viewFov(sz.w/sz.h),sz.w/sz.h,.05,Math.max(250,distance*18)),lookAt(e,center(),{x:0,y:0,z:1}));gl.useProgram(program);gl.uniformMatrix4fv(uMVP,false,mvp);drawData(visibleVertices('opaque'));if(DATA.transparent&&DATA.transparent.length){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);drawData(visibleVertices('transparent'));gl.depthMask(true);gl.disable(gl.BLEND)}drawLabels();}
function reset(){if(walk)setWalking(false);yaw=initial.yaw;pitch=initial.pitch;distance=initial.distance;target={...initial.target};draw()}
function moveCamera(forward,right){const fx=-Math.cos(yaw),fy=-Math.sin(yaw),rx=-Math.sin(yaw),ry=Math.cos(yaw);target.x+=fx*forward+rx*right;target.y+=fy*forward+ry*right;draw()}
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1&&e.button!==2)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,yaw,pitch};canvas.classList.add('dragging');try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw-(e.clientX-drag.x)*.008;pitch=clamp(drag.pitch+(e.clientY-drag.y)*.006,.12,1.45);draw()});
function pointerEnd(e){drag=null;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId)}catch(_){}}canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*(e.deltaY>0?1.09:.92),2.8,180);draw()},{passive:false});canvas.addEventListener('dblclick',reset);
window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement?.tagName))return;const key=e.key.toLowerCase(),keys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];if(!keys.includes(key))return;e.preventDefault();const step=Math.max(.18,Math.min(1.2,distance*.032))*(e.shiftKey?2.7:1);if(key==='w'||key==='arrowup')moveCamera(step,0);else if(key==='s'||key==='arrowdown')moveCamera(-step,0);else if(key==='a'||key==='arrowleft')moveCamera(0,-step);else moveCamera(0,step)});

function visibleVertices(kind){
  if(walk)return DATA[kind];
  const result=[];
  for(const floor of DATA.floors){if(floorId!=='all'&&floor.id!==floorId)continue;for(let i=floor[kind+'Start'];i<floor[kind+'End'];i++){if(!showWalls&&kind==='opaque'&&i>=floor.wallStart&&i<floor.wallEnd)continue;result.push(DATA[kind][i]);}}
  return result;
}
const projectSelect=document.getElementById('projects'),floorSelect=document.getElementById('floors');
for(const p of FILE.projects){const option=document.createElement('option');option.value=p.id;option.textContent=p.name;projectSelect.appendChild(option);}projectSelect.value=DATA.id;
function updateFloors(){floorSelect.replaceChildren();const all=document.createElement('option');all.value='all';all.textContent=${JSON.stringify(t('allFloors'))};floorSelect.appendChild(all);for(const f of DATA.floors){const option=document.createElement('option');option.value=f.id;option.textContent=f.name;floorSelect.appendChild(option);}floorSelect.value='all';floorId='all';}
projectSelect.addEventListener('change',()=>{DATA=FILE.projects.find(p=>p.id===projectSelect.value);person=personSettings(DATA.person);initial={...DATA.camera,target:{...DATA.camera.target}};updateFloors();reset();});
floorSelect.addEventListener('change',()=>{floorId=floorSelect.value;if(walk)setWalking(true);else draw();});
updateFloors();
document.getElementById('walls').addEventListener('change',e=>{showWalls=e.target.checked;draw();});
document.getElementById('labels').addEventListener('change',e=>{showLabels=e.target.checked;draw();});
document.getElementById('top').addEventListener('click',()=>{if(walk)setWalking(false);yaw=-Math.PI/2;pitch=1.45;draw();});
window.addEventListener('resize',draw);document.getElementById('reset').addEventListener('click',reset);document.getElementById('theme').addEventListener('click',e=>{dark=!dark;e.currentTarget.textContent=dark?${lightBgJSON}:${darkBgJSON};draw()});draw();
})();
</script>
</body>
</html>`;
  }

  function exportStandalone3DHTML(){
    const hasGeometry=state.projects.some(p=>p.floors.some(f=>f.elements.some(e=>['wall','room','door','window','object','stair','cota','text'].includes(e.type))));
    if(!hasGeometry){alert(t('addElements3DHTML'));return;}
    const mesh=buildExportScene();
    const html=buildStandalone3DHTML(mesh);
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`${exportBaseName()}-3d.html`);
  }

  function export3DModel(){
    const hasGeometry=projectElements().some(e=>['wall','room','door','window','object','stair','cota'].includes(e.type));
    if(!hasGeometry){alert(t('addElements3D'));return;}
    const base=exportBaseName(),objFile=`${base}-3d.obj`,mtlFile=`${base}-3d.mtl`;
    const mesh=buildExportScene();
    if(!mesh.opaque.length&&!mesh.transparent.length){alert(t('couldNotGenerate3D'));return;}
    const files=meshToOBJMTL(mesh,`${base}-3d`,mtlFile);
    const readme=[
      t('readmeTitle'),
      '',
      t('readmeOpen',{file:objFile}),
      t('readmeKeep',{obj:objFile,mtl:mtlFile}),
      t('readmeScale'),
      '',
      t('readmeFull')
    ].join('\n');
    const zip=makeStoredZip([
      {name:objFile,data:files.obj},
      {name:mtlFile,data:files.mtl},
      {name:t('readmeFilename'),data:readme}
    ]);
    downloadBlob(zip,`${base}-3d.zip`);
  }

  function bindArray(data){
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);
    const bytes=STRIDE*4;
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,bytes,0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor,4,gl.FLOAT,false,bytes,3*4);
    gl.enableVertexAttribArray(aNormal);
    gl.vertexAttribPointer(aNormal,3,gl.FLOAT,false,bytes,7*4);
  }
  function drawArray(data,primitive){
    if(!data.length)return;
    bindArray(data);
    gl.drawArrays(primitive,0,data.length/STRIDE);
  }

  function draw(){
    if(mode!=='3d')return;
    const size=resize();if(!size)return;
    const dark=document.body.classList.contains('dark-mode');
    const bg=dark?[0.105,0.133,0.164,1]:[0.89,0.925,0.945,1];
    gl.clearColor(bg[0],bg[1],bg[2],bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    const eye=cameraEye();
    const proj=mat4Perspective(viewFov(size.w/size.h),size.w/size.h,.05,Math.max(250,distance*18));
    const view=mat4LookAt(eye,cameraCenter(),{x:0,y:0,z:1});
    const mvp=mat4Multiply(proj,view);
    gl.useProgram(program);
    gl.uniformMatrix4fv(uMVP,false,mvp);

    const mesh=walk?walkMesh:buildScene(eye);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawArray(mesh.lines,gl.LINES);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    drawArray(mesh.opaque,gl.TRIANGLES);

    if(mesh.transparent.length){
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawArray(mesh.transparent,gl.TRIANGLES);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Gizmo e contorno ficam visíveis mesmo quando parte do objeto está
    // encoberta: facilita localizar e editar o item selecionado.
    if(mesh.overlayLines.length){
      gl.disable(gl.DEPTH_TEST);
      drawArray(mesh.overlayLines,gl.LINES);
      gl.enable(gl.DEPTH_TEST);
    }
    if(walk)document.getElementById('annotations-3d')?.replaceChildren();else drawEditorOverlay(mesh);
    updateSelectionInfo();
  }

  function setMode(next,options){
    leaveWalk(false);
    const opts=options||{};
    const previousMode=mode;
    mode=next==='3d'?'3d':'2d';
    const is3d=mode==='3d';
    document.body.classList.toggle('view-3d',is3d);
    canvas.classList.toggle('hidden',!is3d);
    document.getElementById('svg-canvas').classList.toggle('hidden',is3d);
    help.classList.toggle('hidden',!is3d);
    document.getElementById('annotations-3d')?.classList.toggle('hidden',!is3d);
    btn2d.classList.toggle('active',!is3d);btn3d.classList.toggle('active',is3d);
    btn2d.setAttribute('aria-pressed',String(!is3d));btn3d.setAttribute('aria-pressed',String(is3d));
    const status=document.getElementById('status-mode');
    if(status&&status.lastChild)status.lastChild.textContent=is3d?` ${t('view3d')}`:(state.blueprintOn?` ${t('blueprintMode')}`:` ${t('normalEdit')}`);
    const empty=document.getElementById('empty-hint');if(empty)empty.classList.toggle('hidden',is3d||active3DElements().length!==0);
    if(is3d){
      activateTool('select');
      if(!cameraInitialized)resetCamera(false);
      else draw();
    }else{
      render();
    }
    if(opts.markChanged!==false && previousMode!==mode)markViewChanged();
  }

  btn2d.addEventListener('click',()=>setMode('2d'));
  btn3d.addEventListener('click',()=>setMode('3d'));
  resetBtn.addEventListener('click',()=>resetCamera(true));
  document.getElementById('viewer3d-top')?.addEventListener('click',()=>{leaveWalk(false);yaw=-Math.PI/2;pitch=1.45;cameraInitialized=true;draw();markViewChanged();});
  document.getElementById('viewer3d-person')?.addEventListener('click',()=>{if(walk)leaveWalk();else enterWalk();});
  if(hideFrontBtn)hideFrontBtn.addEventListener('click',()=>{hideFrontWalls=!hideFrontWalls;updateHideFrontButton();draw();markViewChanged();});
  function startOrbit(e){
    interaction={type:'orbit',x:e.clientX,y:e.clientY,yaw,pitch};
    canvas.classList.add('dragging');
  }
  const currentTool=()=>typeof tool==='string'?tool:'select';
  function renderAnnotationLabels(layer,labels,project){
    if(!layer||!document.createElementNS)return;
    layer.replaceChildren();
    for(const label of labels){
      const p=project(label);if(!p)continue;
      const node=document.createElementNS('http://www.w3.org/2000/svg','text');
      const attrs={x:p.x,y:p.y,'text-anchor':'middle','font-family':'sans-serif','font-size':label.size,'font-weight':label.bold?'700':'400',fill:label.color,stroke:'#EDF2F7','stroke-width':3,'paint-order':'stroke',transform:`rotate(${label.rotation} ${p.x} ${p.y})`};
      for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);
      node.textContent=label.text;layer.appendChild(node);
    }
  }
  function editHandles(e){
    if(!e)return [];
    if('x1' in e){const z=e.type==='wall'?(e.height||activeFloor().height):.08;return [{handle:'p1',point:{x:e.x1,y:e.y1,z}},{handle:'p2',point:{x:e.x2,y:e.y2,z}}];}
    if(e.type==='room')return [['tl',0,0],['tr',e.w,0],['bl',0,e.h],['br',e.w,e.h]].map(([key,x,y])=>({handle:'room-'+key,point:{x:e.x+x,y:e.y+y,z:.04}}));
    return [];
  }
  function editHandleAt(x,y){
    const e=selectedEditableElement();
    if(typeof getSelectionIds==='function'&&getSelectionIds().length>1)return null;
    for(const h of editHandles(e)){
      const p=projectWorld(h.point);if(p&&Math.hypot(x-p.x,y-p.y)<10)return {id:e.id,handle:h.handle,planeZ:h.point.z};
    }
    return null;
  }
  function mirrorSegments(){
    if(typeof mirrorState==='undefined')return [];
    const b=contentBBox(),pad=2,out=[];
    if(mirrorState.xActive&&mirrorState.axisX!=null)out.push({axis:'x',a:{x:mirrorState.axisX,y:b.minY-pad,z:.07},b:{x:mirrorState.axisX,y:b.maxY+pad,z:.07}});
    if(mirrorState.yActive&&mirrorState.axisY!=null)out.push({axis:'y',a:{x:b.minX-pad,y:mirrorState.axisY,z:.07},b:{x:b.maxX+pad,y:mirrorState.axisY,z:.07}});
    return out;
  }
  function mirrorAxisAt(x,y){
    return mirrorSegments().find(s=>pointSegmentDistance(x,y,projectWorld(s.a),projectWorld(s.b))<7)?.axis;
  }
  function drawEditorOverlay(mesh){
    const layer=document.getElementById('annotations-3d');if(!layer||!document.createElementNS)return;
    layer.replaceChildren();const r=canvas.getBoundingClientRect();
    const create=(tag,attrs)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);layer.appendChild(node);return node;};
    const point=p=>{const s=projectWorld(p);return s?{x:s.x-r.left,y:s.y-r.top}:null;};
    const line=(a,b,color='#3B82F6')=>{a=point(a);b=point(b);if(a&&b)create('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:color,'stroke-width':2});};
    renderAnnotationLabels(layer,mesh.annotations,a=>point({...a,z:a.z-floorBase()}));
    const e=selectedEditableElement();
    const handles=typeof getSelectionIds==='function'&&getSelectionIds().length>1?[]:editHandles(e);
    for(const h of handles){const p=point(h.point);if(p)create('circle',{cx:p.x,cy:p.y,r:6,fill:'#EAF2FF',stroke:'#3B82F6','stroke-width':2});}
    for(const s of mirrorSegments())line(s.a,s.b,'#DAA34C');
    if(typeof wallDraft!=='undefined'&&wallDraft){
      const a=wallDraft.lastPoint,b=wallDraft.previewPoint,h=activeFloor().height;
      line({...a,z:.03},{...b,z:.03});line({...a,z:h},{...b,z:h});line({...a,z:0},{...a,z:h});line({...b,z:0},{...b,z:h});
    }
    if(typeof cotaDraft!=='undefined'&&cotaDraft)line({...cotaDraft.startPoint,z:.08},{...cotaDraft.previewPoint,z:.08});
    if(typeof roomDraft!=='undefined'&&roomDraft){
      const d=roomDraft,p=[{x:d.startX,y:d.startY,z:.04},{x:d.curX,y:d.startY,z:.04},{x:d.curX,y:d.curY,z:.04},{x:d.startX,y:d.curY,z:.04}];
      for(let i=0;i<4;i++)line(p[i],p[(i+1)%4]);
    }
  }
  function editorPointAt(e,planeZ=0){
    const ray=canvasRay(e.clientX,e.clientY);
    if(currentTool()==='door'||currentTool()==='window'){
      const distances=active3DElements().filter(e=>e.type==='wall').map(w=>wallRayDistance(ray,w));
      const distance=Math.min(...distances);if(Number.isFinite(distance))return add(ray.origin,mul(ray.dir,distance));
    }
    return rayPlaneZ(ray,planeZ);
  }
  function beginEditorPointer(e,hit){
    const el=hit?.id?getElement(hit.id):null,planeZ=hit?.planeZ??(el?.type==='object'?objectElevation(el):0);
    const p=editorPointAt(e,planeZ);if(!p)return;
    editorPointerDown(e,p,hit||null);
    interaction={type:'editor',planeZ,originalElements:VisualMakerModel.clone(state.elements),originalMirror:typeof mirrorState!=='undefined'?{...mirrorState}:null};
  }
  function endEditorPointer(cancel=false){
    if(interaction?.type!=='editor')return;
    const finished=interaction;interaction=null;
    if(cancel){
      state.elements=finished.originalElements;
      if(finished.originalMirror)Object.assign(mirrorState,finished.originalMirror);
      dragInfo=null;clearDrafts();render();updatePropertiesPanel();
    }else editorPointerUp();
  }
  function pointerInteractionChanged(i){
    if(!i||!i.original)return false;
    const el=getElement(i.id);if(!el)return false;
    if(el.type==='door'||el.type==='window'){
      return Math.abs((el.x||0)-i.original.x)>.001||
        Math.abs((el.y||0)-i.original.y)>.001||
        Math.abs((el.angle||0)-i.original.angle)>.05||
        Math.abs((el.width||0)-(i.original.width||0))>.001||
        String(el.wallId||'')!==String(i.original.wallId||'')||
        Math.abs((Number(el.wallT)||0)-(Number(i.original.wallT)||0))>.0005;
    }
    return Math.abs((el.x||0)-i.original.x)>.001||
      Math.abs((el.y||0)-i.original.y)>.001||
      Math.abs((el.elevation||0)-i.original.elevation)>.001||
      Math.abs((el.rotation||0)-i.original.rotation)>.05;
  }
  function clearPointerClasses(){
    canvas.classList.remove('dragging','object-drag','opening-drag','opening-resize','gizmo-drag','rotate-drag','object-hover','opening-hover');
  }
  function updateHoverCursor(e){
    if(interaction)return;
    if(currentTool()!=='select'){canvas.style.cursor='crosshair';return;}
    canvas.style.cursor=editHandleAt(e.clientX,e.clientY)||mirrorAxisAt(e.clientX,e.clientY)?'pointer':'default';
    const selected=selectedObject(),editable=selectedEditableElement();
    const handle=selected?gizmoHitAt(e.clientX,e.clientY,selected):null;
    const openingHandle=editable&&(editable.type==='door'||editable.type==='window')?openingResizeHandleAt(e.clientX,e.clientY,editable):null;
    let hit=null;
    if(!handle&&!openingHandle)hit=pickEditableAt(e.clientX,e.clientY);
    hoverElementId=hit?hit.id:null;
    canvas.classList.toggle('gizmo-drag',handle==='elevation');
    canvas.classList.toggle('rotate-drag',handle==='rotation');
    canvas.classList.toggle('opening-resize',!!openingHandle);
    canvas.classList.toggle('object-hover',!!hit&&hit.type==='object'&&!handle);
    canvas.classList.toggle('opening-hover',!!hit&&(hit.type==='door'||hit.type==='window')&&!handle);
  }


  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('dblclick',e=>{if(currentTool()!=='select')return;const hit=pickEditableAt(e.clientX,e.clientY);if(hit?.type==='text')openTextEditor(hit.x,hit.y,hit.id);else if(!hit)resetCamera(true);});
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='3d')return;
    if(e.button!==0&&e.button!==1&&e.button!==2)return;
    e.preventDefault();
    try{canvas.setPointerCapture(e.pointerId);}catch(_){}

    // Botão direito/meio sempre orbita, inclusive quando o cursor está sobre um móvel.
    if(e.button===1||e.button===2){startOrbit(e);return;}

    if(currentTool()!=='select'){beginEditorPointer(e,null);return;}
    const handleHit=editHandleAt(e.clientX,e.clientY),axis=mirrorAxisAt(e.clientX,e.clientY);
    if(handleHit){beginEditorPointer(e,handleHit);return;}
    if(axis&&!e.shiftKey){beginEditorPointer(e,{axis});return;}

    const current=selectedEditableElement();
    const openingHandle=current&&(current.type==='door'||current.type==='window')?openingResizeHandleAt(e.clientX,e.clientY,current):null;
    if(current&&openingHandle){
      interaction={type:'resize-opening',id:current.id,edge:openingHandle,original:{x:current.x,y:current.y,angle:current.angle||0,width:current.width||0,wallId:current.wallId||null,wallT:Number(current.wallT)||0}};
      canvas.classList.add('opening-resize');return;
    }
    const handle=current&&current.type==='object'&&(typeof getSelectionIds!=='function'||getSelectionIds().length<=1)?gizmoHitAt(e.clientX,e.clientY,current):null;
    if(current&&handle==='elevation'){
      interaction={
        type:'elevation',id:current.id,startY:e.clientY,startValue:objectElevation(current),
        original:{x:current.x,y:current.y,elevation:objectElevation(current),rotation:current.rotation||0}
      };
      canvas.classList.add('gizmo-drag');return;
    }
    if(current&&handle==='rotation'){
      const g=gizmoGeometry(current),ray=canvasRay(e.clientX,e.clientY);
      const p=rayPlaneZ(ray,g.z0+.055);
      interaction={
        type:'rotation',id:current.id,
        startAngle:p?Math.atan2(p.y-current.y,p.x-current.x):0,
        startRotation:current.rotation||0,
        original:{x:current.x,y:current.y,elevation:objectElevation(current),rotation:current.rotation||0}
      };
      canvas.classList.add('rotate-drag');return;
    }

    const hit=pickEditableAt(e.clientX,e.clientY);
    if(hit){beginEditorPointer(e,{id:hit.id});return;}
    if(!e.shiftKey){if(typeof clearSelection==='function')clearSelection();else selectedId=null;updatePropertiesPanel();draw();startOrbit(e);}
  });

  canvas.addEventListener('pointermove',e=>{
    if(!interaction){
      if(currentTool()!=='select'){const p=editorPointAt(e);if(p)editorPointerMove(e,p);}
      updateHoverCursor(e);return;
    }
    if(interaction.type==='editor'){const p=editorPointAt(e,interaction.planeZ);if(p)editorPointerMove(e,p);return;}

    if(interaction.type==='orbit'){
      // Movimento invertido em relação ao mouse: arrastar a cena para um lado
      // faz a câmera orbitar para o lado oposto.
      yaw=interaction.yaw-(e.clientX-interaction.x)*.008;
      pitch=clamp(interaction.pitch+(e.clientY-interaction.y)*.006,.12,1.45);
      draw();return;
    }

    const el=getElement(interaction.id);
    if(!el)return;

    if(interaction.type==='resize-opening'){
      const p=rayPlaneZ(canvasRay(e.clientX,e.clientY),0);if(!p)return;
      if(typeof resizeOpeningOnWall==='function')resizeOpeningOnWall(el,interaction.edge,p.x,p.y);
      draw();return;
    }

    if(el.type!=='object')return;

    if(interaction.type==='elevation'){
      const sensitivity=Math.max(.0035,Math.min(.018,distance*.00085));
      let value=interaction.startValue+(interaction.startY-e.clientY)*sensitivity;
      value=clamp(value,0,12);
      if(!e.altKey){
        value=Math.round(value/.05)*.05;
        if(value<.075)value=0;
      }
      el.elevation=value;
      draw();return;
    }

    if(interaction.type==='rotation'){
      const g=gizmoGeometry(el),p=rayPlaneZ(canvasRay(e.clientX,e.clientY),g.z0+.055);
      if(!p)return;
      const angle=Math.atan2(p.y-el.y,p.x-el.x);
      let degrees=interaction.startRotation+(angle-interaction.startAngle)*180/Math.PI;
      degrees=((degrees%360)+360)%360;
      if(!e.altKey)degrees=Math.round(degrees/15)*15%360;
      el.rotation=degrees;
      draw();
    }
  });

  const endPointer=e=>{
    if(interaction?.type==='editor'){endEditorPointer(e.type==='pointercancel');clearPointerClasses();try{canvas.releasePointerCapture(e.pointerId);}catch(_){}return;}
    const finished=interaction;
    interaction=null;
    drag=null;
    clearPointerClasses();
    try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
    if(finished&&finished.type!=='orbit'&&pointerInteractionChanged(finished)){
      pushHistory();
      updatePropertiesPanel();
      render();
    }else{
      if(finished&&finished.type==='orbit'){
        const changed=Math.abs(yaw-finished.yaw)>.0001||Math.abs(pitch-finished.pitch)>.0001;
        if(changed){cameraInitialized=true;markViewChanged();}
      }
      updateSelectionInfo();
      if(mode==='3d')draw();
    }
  };
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('pointerleave',e=>{if(!interaction){canvas.classList.remove('object-hover','opening-hover','gizmo-drag','rotate-drag');hoverElementId=null;}});
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*(e.deltaY>0?1.09:.92),2.8,180);cameraInitialized=true;draw();markViewChanged();},{passive:false});
  window.addEventListener('keydown',e=>{
    if(document.getElementById('hierarchy-confirm').open)return;
    if(mode!=='3d')return;
    const tag=(document.activeElement&&document.activeElement.tagName)||'';
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    const key=e.key.toLowerCase();
    if(e.ctrlKey||e.metaKey||e.altKey)return;
    if(key==='escape'){
      e.preventDefault();e.stopImmediatePropagation();
      endEditorPointer(true);clearSelection();activateTool('select');updatePropertiesPanel();updateSelectionInfo();draw();return;
    }
    const nav=['arrowup','arrowdown','arrowleft','arrowright'];
    if(nav.includes(key)){
      e.preventDefault();e.stopImmediatePropagation();
      const step=Math.max(.18,Math.min(1.2,distance*.032))*(e.shiftKey?2.7:1);
      if(key==='w'||key==='arrowup')moveCameraPlanar(step,0);
      else if(key==='s'||key==='arrowdown')moveCameraPlanar(-step,0);
      else if(key==='a'||key==='arrowleft')moveCameraPlanar(0,-step);
      else if(key==='d'||key==='arrowright')moveCameraPlanar(0,step);
      return;
    }
    if(key==='h'){
      e.preventDefault();e.stopImmediatePropagation();hideFrontWalls=!hideFrontWalls;updateHideFrontButton();draw();markViewChanged();return;
    }
  },true);
  window.addEventListener('resize',()=>{if(mode==='3d')draw();});
  updateHideFrontButton();

  const export3DHTMLBtn=document.getElementById('export-3d-html');
  if(export3DHTMLBtn)export3DHTMLBtn.addEventListener('click',()=>{
    const modal=document.getElementById('export-modal');if(modal)modal.classList.add('hidden');
    exportStandalone3DHTML();
  });

  const export3DBtn=document.getElementById('export-3d');
  if(export3DBtn)export3DBtn.addEventListener('click',()=>{
    const modal=document.getElementById('export-modal');if(modal)modal.classList.add('hidden');
    export3DModel();
  });

  window.update3DLanguage=()=>{
    updateWalkUI();
    if(btn3d.disabled)btn3d.title=t('webglUnsupported');
    if(resetBtn)resetBtn.textContent=t('recenter');
    updateHideFrontButton();
    updateSelectionInfo();
    const status=document.getElementById('status-mode');
    if(status&&status.lastChild)status.lastChild.textContent=mode==='3d'?` ${t('view3d')}`:(state.blueprintOn?` ${t('blueprintMode')}`:` ${t('normalEdit')}`);
  };
  window.refresh3DView=()=>{if(mode==='3d'){if(walk)walkMesh=buildProjectScene(walk.eye(),true);draw();}};
  window.onActiveFloorChanged=()=>{const wasWalking=!!walk;leaveWalk(false);interaction=null;hoverElementId=null;clearPointerClasses();cameraInitialized=false;if(mode==='3d'){resetCamera(false);if(wasWalking)enterWalk();}updateSelectionInfo();};
  window.leavePersonView=()=>leaveWalk(false);
  window.finish3DInteraction=()=>{if(interaction?.type==='editor')endEditorPointer();const current=interaction;interaction=null;drag=null;clearPointerClasses();if(current&&current.type!=='orbit'&&pointerInteractionChanged(current))pushHistory();};
  window.editor3DPoint=(x,y)=>{const p=projectWorld({x,y,z:.08}),r=canvas.getBoundingClientRect();return p?{x:p.x-r.left,y:p.y-r.top}:null;};
  document.getElementById('viewer-floor-visibility').addEventListener('change',e=>{floorVisibility=e.target.value;draw();markViewChanged();});
  window.export3DModel=export3DModel;
  window.exportStandalone3DHTML=exportStandalone3DHTML;
  window.setEditorViewMode=setMode;
  window.get3DViewState=get3DViewState;
  window.restore3DViewState=restore3DViewState;
})();
