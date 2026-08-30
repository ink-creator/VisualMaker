/* elements.js
   Criação e manipulação dos elementos da planta (paredes, textos,
   portas, janelas, cômodos, cotas). Cada elemento é um objeto simples
   e serializável (sem funções), guardado em state.elements.

   Convenção usada em vários lugares do app (move, duplicar, desfazer):
   - elementos com ponta A/B (parede, cota) guardam x1,y1,x2,y2
   - elementos com um ponto (texto, porta, janela, cômodo) guardam x,y
   Isso permite mover/duplicar qualquer elemento genericamente, sem
   precisar tratar cada tipo separadamente. */

function addWall(x1,y1,x2,y2,thickness){
  thickness = thickness || 0.15;
  if (Math.hypot(x2-x1,y2-y1) < 0.02) return null;
  const el = {id:genId(), type:'wall', x1,y1,x2,y2, thickness, height:2.7, color:'#F0EEE9'};
  state.elements.push(el);
  return el;
}
function addText(x,y,content){
  const el = {id:genId(), type:'text', x, y, content, size:16, bold:false, rotation:0, color:'#1B2430'};
  state.elements.push(el);
  return el;
}
function addDoor(x,y,angle,wallThickness){
  const el = {id:genId(), type:'door', x, y, width:0.8, height:2.1, angle:angle||0, wallThickness:wallThickness||0.15, color:'#A56B43'};
  state.elements.push(el);
  return el;
}
function addWindow(x,y,angle,wallThickness){
  const el = {id:genId(), type:'window', x, y, width:1.2, height:1.2, sillHeight:0.9, angle:angle||0, wallThickness:wallThickness||0.15, color:'#9CC9DF'};
  state.elements.push(el);
  return el;
}
function addRoom(x,y,w,h,name){
  const el = {id:genId(), type:'room', x, y, w, h, name: name||'Cômodo', material:'solid'};
  state.elements.push(el);
  return el;
}
function addCota(x1,y1,x2,y2,offset){
  const el = {id:genId(), type:'cota', x1,y1,x2,y2, offset: offset==null?0.3:offset};
  state.elements.push(el);
  return el;
}
function addObject(x,y,kind,label,category,w,h){
  const el = {id:genId(), type:'object', x, y, kind, label, category, w:w||1, h:h||1, rotation:0, color:null, elevation:0};
  state.elements.push(el);
  return el;
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
function computeContentBBox(){
  if (state.elements.length===0) return {minX:0,minY:0,maxX:5,maxY:5};
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for (const el of state.elements){
    if ('x1' in el){
      minX=Math.min(minX,el.x1,el.x2); maxX=Math.max(maxX,el.x1,el.x2);
      minY=Math.min(minY,el.y1,el.y2); maxY=Math.max(maxY,el.y1,el.y2);
    } else if (el.type==='room'){
      minX=Math.min(minX,el.x); maxX=Math.max(maxX,el.x+el.w);
      minY=Math.min(minY,el.y); maxY=Math.max(maxY,el.y+el.h);
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
  state.elements.push(copy); selectedId = copy.id;
  pushHistory(); render(); updatePropertiesPanel();
}
function deleteElement(id){
  state.elements = state.elements.filter(e=>e.id!==id);
  if (selectedId===id) selectedId=null;
  pushHistory(); render(); updatePropertiesPanel();
}
function pasteClipboard(){
  if (!clipboard) return;
  const copy = JSON.parse(JSON.stringify(clipboard)); copy.id = genId();
  offsetCopy(copy);
  state.elements.push(copy); selectedId = copy.id;
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
  } else if (el.type==='door' || el.type==='window'){
    el.angle = ((el.angle||0)+deltaDeg)%360;
  } else if (el.type==='object'){
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
  created.forEach(c=>state.elements.push(c));
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
