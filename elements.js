/* elements.js
   Criação e manipulação dos elementos da planta (paredes, textos,
   portas, janelas, cômodos, cotas). Cada elemento é um objeto simples
   e serializável (sem funções), guardado em state.elements.

   Convenção usada em vários lugares do app (move, duplicar, desfazer):
   - elementos com ponta A/B (parede, cota) guardam x1,y1,x2,y2
   - elementos com um ponto (texto, porta, janela, cômodo) guardam x,y
   Isso permite mover/duplicar qualquer elemento genericamente, sem
   precisar tratar cada tipo separadamente. */

function activeFloorId(){ return (state&&state.activeFloorId)||'floor-1'; }
function incomingStairs(){
  return state.floors.flatMap(f=>f.elements).filter(e=>e.type==='stair'&&e.endFloorId===activeFloorId()&&e.floorId!==activeFloorId());
}

// Derived surface shared by 2D display and image exports; never an editable room.
function floorSurfaceElements(){
  const floor=activeFloor(),bounds=VisualMakerModel.footprint(floor);
  return bounds&&floor.floorSurface.enabled?[{...bounds,...floor.floorSurface,id:'storey-surface',type:'room',surfaceOnly:true,name:'',color:floorMaterialBase(floor.floorSurface)}]:[];
}

function addWall(x1,y1,x2,y2,thickness){
  thickness = thickness || 0.15;
  if (Math.hypot(x2-x1,y2-y1) < 0.02) return null;
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'wall', x1,y1,x2,y2, thickness, height:activeFloor().height, color:'#F0EEE9'};
  state.elements.push(el);
  return el;
}
function addText(x,y,content){
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'text', x, y, content, size:16, bold:false, rotation:0, color:'#1B2430'};
  state.elements.push(el);
  return el;
}
function addDoor(x,y,angle,wallThickness,wallId,wallT){
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'door', x, y, width:0.8, height:2.1, angle:angle||0, wallThickness:wallThickness||0.15, color:'#A56B43', wallId:wallId||null, wallT:Number.isFinite(wallT)?wallT:null, doorStyle:'swing', hingeSide:'left', swingSide:1};
  state.elements.push(el);
  return el;
}
function addWindow(x,y,angle,wallThickness,wallId,wallT){
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'window', x, y, width:1.2, height:1.2, sillHeight:0.9, angle:angle||0, wallThickness:wallThickness||0.15, color:'#9CC9DF', wallId:wallId||null, wallT:Number.isFinite(wallT)?wallT:null, windowStyle:'sliding', windowSide:1};
  state.elements.push(el);
  return el;
}
function addRoom(x,y,w,h,name){
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'room', x, y, w, h, name: name||'Cômodo', material:'solid'};
  state.elements.push(el);
  return el;
}
function addCota(x1,y1,x2,y2,offset){
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'cota', x1,y1,x2,y2, offset: offset==null?0.3:offset};
  state.elements.push(el);
  return el;
}
function addObject(x,y,kind,label,category,w,h){
  const el = {id:genId(), projectId:state.activeProjectId, floorId:activeFloorId(), type:'object', x, y, kind, label, category, w:w||1, h:h||1, rotation:0, color:null, elevation:0};
  state.elements.push(el);
  return el;
}
function addStair(x,y){
  const index=state.floors.findIndex(f=>f.id===activeFloorId());
  const el={id:genId(),projectId:state.activeProjectId,floorId:activeFloorId(),startFloorId:activeFloorId(),
    endFloorId:state.floors[index+1]?.id||null,type:'stair',x,y,width:1,length:4.2,stepCount:16,rotation:0,stairType:'straight',color:'#C6B49A'};
  state.elements.push(el);VisualMakerModel.syncStairs(activeProject());return el;
}
function createRectFromDims(w,h){
  addWall(0,0,w,0); addWall(w,0,w,h); addWall(w,h,0,h); addWall(0,h,0,0);
}

function textBoxMetrics(el){
  const w = Math.max(20, el.content.length*(el.size||16)*0.56);
  const h = (el.size||16)*1.3;
  return {w,h};
}

/* Caixa envolvente (em metros) de todos os elementos — usada para
   centralizar a vista, exportar PNG e posicionar o eixo de espelho. */
function computeContentBBox(includeReferences=false){
  const elements=[...(typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements),...incomingStairs(),...(includeReferences?VisualMakerModel.referenceFloors(activeProject()).flatMap(f=>f.elements):[])];
  if (elements.length===0) return {minX:0,minY:0,maxX:5,maxY:5};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const el of elements){
    if ('x1' in el){
      minX=Math.min(minX,el.x1,el.x2); maxX=Math.max(maxX,el.x1,el.x2);
      minY=Math.min(minY,el.y1,el.y2); maxY=Math.max(maxY,el.y1,el.y2);
    } else if (el.type==='room'){
      minX=Math.min(minX,el.x); maxX=Math.max(maxX,el.x+el.w);
      minY=Math.min(minY,el.y); maxY=Math.max(maxY,el.y+el.h);
    } else if (el.type==='stair'){
      for(const p of VisualMakerModel.stairGeometry(el,activeProject()).outline){
        minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
      }
    } else if (el.type==='object'){
      const radius=Math.hypot(el.w||1,el.h||1)/2;
      minX=Math.min(minX,el.x-radius); maxX=Math.max(maxX,el.x+radius);
      minY=Math.min(minY,el.y-radius); maxY=Math.max(maxY,el.y+radius);
    } else if (el.type==='text'){
      minX=Math.min(minX,el.x); maxX=Math.max(maxX,el.x+2);
      minY=Math.min(minY,el.y-0.3); maxY=Math.max(maxY,el.y+0.3);
    } else if (el.type==='door' || el.type==='window'){
      minX=Math.min(minX,el.x-el.width/2); maxX=Math.max(maxX,el.x+el.width/2);
      minY=Math.min(minY,el.y-el.width/2); maxY=Math.max(maxY,el.y+el.width/2);
    }
  }
  return {minX,minY,maxX,maxY};
}

/* ===== Duplicar / excluir / colar (genérico p/ qualquer tipo) ===== */
function offsetCopy(copy){
  if ('x1' in copy){ copy.x1+=0.3; copy.y1+=0.3; copy.x2+=0.3; copy.y2+=0.3; }
  else if ('x' in copy){ copy.x+=0.3; copy.y+=0.3; }
}
function duplicateElement(id){
  const el = getElement(id); if (!el) return;
  const copy = JSON.parse(JSON.stringify(el)); copy.id = genId();
  offsetCopy(copy);
  if(copy.type==='door'||copy.type==='window'){ copy.wallId=null; copy.wallT=null; if(typeof bindOpeningToNearestWall==='function')bindOpeningToNearestWall(copy,.65); }
  state.elements.push(copy); selectedId = copy.id;
  pushHistory(); render(); updatePropertiesPanel();
}
function deleteElement(id){
  const target=getElement(id);
  if(target&&target.type==='wall'){
    state.elements = state.elements.filter(e=>e.id!==id && !((e.type==='door'||e.type==='window')&&e.wallId===id));
  }else{
    state.elements = state.elements.filter(e=>e.id!==id);
  }
  if (selectedId===id || !getElement(selectedId)) selectedId=null;
  pushHistory(); render(); updatePropertiesPanel();
}
function pasteClipboard(){
  if (!clipboard) return;
  if(clipboard.multi&&Array.isArray(clipboard.elements)){
    const source=JSON.parse(JSON.stringify(clipboard.elements));
    const idMap=new Map(source.map(el=>[el.id,genId()]));
    const copies=source.map(el=>{const copy=el;copy.id=idMap.get(el.id);copy.floorId=activeFloorId();copy.projectId=state.activeProjectId;offsetCopy(copy);if((copy.type==='door'||copy.type==='window')&&copy.wallId){copy.wallId=idMap.get(copy.wallId)||null;if(!copy.wallId)copy.wallT=null;}return copy;});
    state.elements.push(...copies);
    copies.forEach(copy=>{if((copy.type==='door'||copy.type==='window')&&copy.wallId){const wall=getElement(copy.wallId);if(wall)attachOpeningToWall(copy,wall,copy.wallT);}else if((copy.type==='door'||copy.type==='window')&&typeof bindOpeningToNearestWall==='function')bindOpeningToNearestWall(copy,.65);});
    if(typeof setSelection==='function')setSelection(copies.map(c=>c.id),copies[copies.length-1]?.id);else selectedId=copies[copies.length-1]?.id||null;
    pushHistory();render();updatePropertiesPanel();return;
  }
  const copy = JSON.parse(JSON.stringify(clipboard)); copy.id = genId();copy.floorId=activeFloorId();copy.projectId=state.activeProjectId;
  offsetCopy(copy);
  if(copy.type==='door'||copy.type==='window'){ copy.wallId=null; copy.wallT=null; if(typeof bindOpeningToNearestWall==='function')bindOpeningToNearestWall(copy,.65); }
  state.elements.push(copy); if(typeof setSingleSelection==='function')setSingleSelection(copy.id);else selectedId = copy.id;
  pushHistory(); render(); updatePropertiesPanel();
}

/* ===== Rotação (genérica: reta em torno do ponto médio, ou campo angle/rotation) ===== */
function rotateElement(id, deltaDeg){
  const el = getElement(id); if (!el) return;
  if ('x1' in el){
    const cx=(el.x1+el.x2)/2, cy=(el.y1+el.y2)/2;
    const rad = deltaDeg*Math.PI/180;
    const rot = (x,y)=>{ const dx=x-cx,dy=y-cy; return {x:cx+dx*Math.cos(rad)-dy*Math.sin(rad), y:cy+dx*Math.sin(rad)+dy*Math.cos(rad)}; };
    const np1=rot(el.x1,el.y1), np2=rot(el.x2,el.y2);
    el.x1=np1.x; el.y1=np1.y; el.x2=np2.x; el.y2=np2.y;
    if(el.type==='wall'&&typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.id);
  } else if (el.type==='door' || el.type==='window'){
    if(el.wallId&&typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.wallId);
    else el.angle = ((el.angle||0)+deltaDeg)%360;
  } else if (el.type==='object'||el.type==='stair'){
    el.rotation = ((el.rotation||0)+deltaDeg)%360;
  } else if (el.type==='text'){
    el.rotation = ((el.rotation||0)+deltaDeg)%360;
  }
  pushHistory(); render(); updatePropertiesPanel();
}

/* ===== Espelhamento =====
   Cria uma cópia refletida de um elemento em torno de um eixo X ou Y.
   Usado tanto pelo "modo espelhamento" (ao desenhar) quanto pelo botão
   "Espelhar" no painel de propriedades. */
function mirrorElementData(el, axis, axisPos){
  const copy = JSON.parse(JSON.stringify(el));
  copy.id = genId();
  if ('x1' in copy){
    const p1 = reflectCoords(el.x1, el.y1, axis, axisPos);
    const p2 = reflectCoords(el.x2, el.y2, axis, axisPos);
    copy.x1=p1.x; copy.y1=p1.y; copy.x2=p2.x; copy.y2=p2.y;
  } else if (copy.type==='stair'){
    const p=reflectCoords(el.x,el.y,axis,axisPos);copy.x=p.x;copy.y=p.y;
    copy.rotation=axis==='x'?-(el.rotation||0):180-(el.rotation||0);
    copy.mirrored=!el.mirrored;
  } else if (copy.type==='object'){
    const p = reflectCoords(el.x, el.y, axis, axisPos);
    copy.x=p.x; copy.y=p.y;
    copy.rotation = axis==='x' ? (((180-(el.rotation||0))%360)+360)%360 : (((-(el.rotation||0))%360)+360)%360;
  } else if (copy.type==='text'){
    const p = reflectCoords(el.x, el.y, axis, axisPos);
    copy.x=p.x; copy.y=p.y;
    copy.rotation = axis==='x' ? (((180-(el.rotation||0))%360)+360)%360 : (((-(el.rotation||0))%360)+360)%360;
  } else if (copy.type==='door' || copy.type==='window'){
    const p = reflectCoords(el.x, el.y, axis, axisPos);
    copy.x=p.x; copy.y=p.y;
    copy.angle = axis==='x' ? (((180-(el.angle||0))%360)+360)%360 : (((-(el.angle||0))%360)+360)%360;
  } else if (copy.type==='room'){
    const p = reflectCoords(el.x, el.y, axis, axisPos);
    // espelhar a partir do canto oposto para manter w/h positivos
    copy.x = axis==='x' ? p.x-el.w : el.x;
    copy.y = axis==='y' ? p.y-el.h : el.y;
  }
  return copy;
}
function addMirroredCopiesFor(el){
  const created = [];
  const {xActive,yActive,axisX,axisY} = mirrorState;
  if (xActive && axisX!=null) created.push(mirrorElementData(el,'x',axisX));
  if (yActive && axisY!=null) created.push(mirrorElementData(el,'y',axisY));
  if (xActive && yActive && axisX!=null && axisY!=null){
    const xCopy = mirrorElementData(el,'x',axisX);
    created.push(mirrorElementData(xCopy,'y',axisY));
  }
  created.forEach(c=>{
    if(c.type==='door'||c.type==='window'){ c.wallId=null; c.wallT=null; }
    state.elements.push(c);
    if((c.type==='door'||c.type==='window')&&typeof bindOpeningToNearestWall==='function')bindOpeningToNearestWall(c,.65);
  });
  return created;
}
function defaultMirrorAxisX(){
  const b = computeContentBBox();
  return state.elements.length ? (b.minX+b.maxX)/2 : toWorld(document.getElementById('canvas-wrap').clientWidth/2, 0).x;
}
function defaultMirrorAxisY(){
  const b = computeContentBBox();
  return state.elements.length ? (b.minY+b.maxY)/2 : toWorld(0, document.getElementById('canvas-wrap').clientHeight/2).y;
}
