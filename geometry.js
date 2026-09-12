/* geometry.js
   Funções puras: conversão de coordenadas, formatação de medidas,
   snapping (grade + alinhamentos arquitetônicos) e utilidades sem estado próprio.
   Depende das variáveis globais `view` e `state`, declaradas em app.js
   (carregado por último — ok, pois estas funções só são chamadas em
   resposta a eventos, quando todos os scripts já terminaram de carregar). */

function genId(){ return 'el'+(idCounter++)+'_'+Math.random().toString(36).slice(2,7); }

function getElement(id){ return state.elements.find(e=>e.id===id); }

function escapeHTML(s){ const d=document.createElement('div'); d.textContent=String(s); return d.innerHTML; }
function escapeAttr(s){ return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'); }
function escapeXML(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function bindEnterBlur(el){ el.addEventListener('keydown', e=>{ if(e.key==='Enter') el.blur(); }); }

function relativeDate(ts){
  const diff = Date.now()-ts;
  const min = Math.floor(diff/60000);
  if (min<1) return t('justNow');
  if (min<60) return t('minutesAgo',{count:min});
  const hr = Math.floor(min/60);
  if (hr<24) return t('hoursAgo',{count:hr});
  const day = Math.floor(hr/24);
  if (day===1) return t('yesterday');
  if (day<7) return t('daysAgo',{count:day});
  return new Date(ts).toLocaleDateString(window.getCurrentLanguage()==='en'?'en-US':'pt-BR');
}

/* ===== Medidas reais (m / cm) ===== */
function formatMeters(m){
  m = Math.max(0, m||0);
  const totalCm = Math.round(m*100);
  const meters = Math.floor(totalCm/100);
  const cm = totalCm%100;
  if (meters===0) return `${cm} cm`;
  if (cm===0) return `${meters} m`;
  return `${meters} m ${cm} cm`;
}
function parseMeters(str){
  if (typeof str==='number') return str;
  if (!str) return null;
  str = String(str).trim().toLowerCase().replace(',', '.');
  if (!str) return null;
  const mMatch = str.match(/(-?\d+(?:\.\d+)?)\s*m(?!\w)/);
  const cmMatch = str.match(/(-?\d+(?:\.\d+)?)\s*cm/);
  if (mMatch || cmMatch){
    let total = 0;
    if (mMatch) total += parseFloat(mMatch[1]);
    if (cmMatch) total += parseFloat(cmMatch[1])/100;
    return total;
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}
function roomArea(room){
  if(!room||room.type!=='room')return 0;
  return Math.abs(Number(room.w)||0)*Math.abs(Number(room.h)||0);
}

/* ===== Coordenadas: metros (mundo) <-> pixels (tela) ===== */
function toScreen(xm,ym){ return { x: xm*view.pxPerMeter+view.panX, y: ym*view.pxPerMeter+view.panY }; }
function toWorld(xs,ys){ return { x: (xs-view.panX)/view.pxPerMeter, y: (ys-view.panY)/view.pxPerMeter }; }

/* ===== Pavimentos / elementos ativos ===== */
function currentFloorId(){ return (typeof state!=='undefined'&&state.activeFloorId)||'floor-1'; }
function elementBelongsToFloor(el,floorId){
  if(!el)return false;
  const target=floorId||currentFloorId();
  return (el.floorId||target)===target;
}
function getActiveFloorElements(){
  const floorId=currentFloorId();
  return (state.elements||[]).filter(el=>elementBelongsToFloor(el,floorId));
}
function normalizedExcludeIds(exclude){
  if(!exclude)return new Set();
  if(exclude instanceof Set)return exclude;
  if(Array.isArray(exclude))return new Set(exclude);
  return new Set([exclude]);
}

/* ===== Snap inteligente 2D + guias de alinhamento ===== */
function snapThresholdMeters(px=10){ return px/Math.max(8,view.pxPerMeter||60); }
function snapToEndpoints(xm,ym,excludeId){
  const excluded=normalizedExcludeIds(excludeId);
  const thresholdM = snapThresholdMeters(12);
  let best=null, bestDist=thresholdM;
  for (const el of getActiveFloorElements()){
    if (el.type!=='wall' || excluded.has(el.id)) continue;
    for (const pt of [{x:el.x1,y:el.y1},{x:el.x2,y:el.y2}]){
      const d = Math.hypot(pt.x-xm, pt.y-ym);
      if (d<bestDist){ bestDist=d; best={x:pt.x,y:pt.y,sourceId:el.id}; }
    }
  }
  return best;
}
function axisSnapCandidates(excludeId){
  const excluded=normalizedExcludeIds(excludeId);
  const xs=[],ys=[];
  const pushX=(value,anchor,sourceId,kind)=>{if(Number.isFinite(value))xs.push({value,anchor,sourceId,kind});};
  const pushY=(value,anchor,sourceId,kind)=>{if(Number.isFinite(value))ys.push({value,anchor,sourceId,kind});};
  for(const el of getActiveFloorElements()){
    if(!el||excluded.has(el.id))continue;
    if(el.type==='wall'){
      const mx=(el.x1+el.x2)/2,my=(el.y1+el.y2)/2;
      pushX(el.x1,el.y1,el.id,'endpoint');pushX(el.x2,el.y2,el.id,'endpoint');pushX(mx,my,el.id,'center');
      pushY(el.y1,el.x1,el.id,'endpoint');pushY(el.y2,el.x2,el.id,'endpoint');pushY(my,mx,el.id,'center');
    }else if(el.type==='room'){
      const cx=el.x+el.w/2,cy=el.y+el.h/2;
      [el.x,el.x+el.w,cx].forEach(v=>pushX(v,cy,el.id,v===cx?'center':'edge'));
      [el.y,el.y+el.h,cy].forEach(v=>pushY(v,cx,el.id,v===cy?'center':'edge'));
    }else if(el.type==='object'){
      pushX(el.x,el.y,el.id,'center');pushY(el.y,el.x,el.id,'center');
      if(Math.abs(((el.rotation||0)%90+90)%90)<.001){
        pushX(el.x-(el.w||1)/2,el.y,el.id,'edge');pushX(el.x+(el.w||1)/2,el.y,el.id,'edge');
        pushY(el.y-(el.h||1)/2,el.x,el.id,'edge');pushY(el.y+(el.h||1)/2,el.x,el.id,'edge');
      }
    }else if(el.type==='door'||el.type==='window'||el.type==='text'||el.type==='stair'){
      pushX(el.x,el.y,el.id,'center');pushY(el.y,el.x,el.id,'center');
    }
  }
  return {xs,ys};
}
function nearestAxisCandidate(value,candidates,threshold){
  let best=null,bestDist=threshold;
  for(const candidate of candidates){
    if(!candidate||!Number.isFinite(candidate.value))continue;
    const d=Math.abs(candidate.value-value);
    if(d<bestDist){bestDist=d;best=candidate;}
  }
  return best;
}
function smartSnapXY(xm,ym,excludeId,options){
  const opts=options||{};
  const threshold=Number.isFinite(opts.threshold)?opts.threshold:snapThresholdMeters(9);
  let x=xm,y=ym;
  if(opts.grid!==false && state.gridOn){
    const g=Math.max(.01,Number(state.gridSpacing)||.5);
    x=Math.round(x/g)*g;y=Math.round(y/g)*g;
  }
  const candidates=axisSnapCandidates(excludeId);
  const axisX=nearestAxisCandidate(xm,candidates.xs,threshold),axisY=nearestAxisCandidate(ym,candidates.ys,threshold);
  const guides=[];
  if(axisX){
    x=axisX.value;
    guides.push({axis:'x',value:x,anchor:axisX.anchor,sourceId:axisX.sourceId,kind:axisX.kind,moving:ym});
  }
  if(axisY){
    y=axisY.value;
    guides.push({axis:'y',value:y,anchor:axisY.anchor,sourceId:axisY.sourceId,kind:axisY.kind,moving:xm});
  }
  if(opts.guides!==false && typeof setSmartGuides==='function')setSmartGuides(guides);
  return {x,y,guides};
}
function snapPoint(xm,ym,excludeId){
  const ep = snapToEndpoints(xm,ym,excludeId);
  if (ep){
    if(typeof setSmartGuides==='function')setSmartGuides([
      {axis:'x',value:ep.x,anchor:ep.y,sourceId:ep.sourceId,kind:'endpoint',moving:ym},
      {axis:'y',value:ep.y,anchor:ep.x,sourceId:ep.sourceId,kind:'endpoint',moving:xm}
    ]);
    return {x:ep.x,y:ep.y};
  }
  return smartSnapXY(xm,ym,excludeId,{grid:true});
}
function smartSnapObjectPosition(el,xm,ym,ignoreSnap,excludeIds){
  if(!el)return {x:xm,y:ym};
  if(ignoreSnap){if(typeof setSmartGuides==='function')setSmartGuides([]);return {x:xm,y:ym};}
  const threshold=snapThresholdMeters(10);
  const excluded=normalizedExcludeIds(excludeIds||el.id);excluded.add(el.id);
  return smartSnapXY(xm,ym,excluded,{grid:true,threshold});
}

function distToSegment(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  const lenSq = dx*dx+dy*dy;
  let t = lenSq===0 ? 0 : ((px-x1)*dx+(py-y1)*dy)/lenSq;
  t = Math.max(0, Math.min(1,t));
  const cx=x1+t*dx, cy=y1+t*dy;
  return Math.hypot(px-cx, py-cy);
}

function projectPointToWall(wall,worldX,worldY,openingWidth){
  if(!wall||wall.type!=='wall')return null;
  const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
  if(L<.02)return null;
  const raw=((worldX-wall.x1)*dx+(worldY-wall.y1)*dy)/(L*L);
  const half=Math.max(0,Number(openingWidth)||0)/2;
  const margin=L>half*2+.02?Math.min(.49,half/L):0;
  const t=Math.max(margin,Math.min(1-margin,raw));
  const x=wall.x1+dx*t,y=wall.y1+dy*t;
  return {wall,x,y,t,distance:Math.hypot(worldX-x,worldY-y),length:L,angle:Math.atan2(dy,dx)*180/Math.PI};
}

/* Ponto mais próximo (mundo) em cima de uma parede — usado para
   encaixar portas/janelas e elementos arquitetônicos na parede. */
function findNearestWall(worldX, worldY, maxDist, openingWidth, floorId){
  let best=null, bestDist=Number.isFinite(maxDist)?maxDist:Infinity;
  const targetFloor=floorId||currentFloorId();
  for (const el of state.elements){
    if (el.type!=='wall' || !elementBelongsToFloor(el,targetFloor)) continue;
    const projected=projectPointToWall(el,worldX,worldY,openingWidth);
    if(!projected)continue;
    if (projected.distance<bestDist){ bestDist=projected.distance; best=projected; }
  }
  return best;
}
function attachOpeningToWall(opening,wallOrHit,tOverride){
  if(!opening||(opening.type!=='door'&&opening.type!=='window'))return false;
  const wall=wallOrHit&&wallOrHit.wall?wallOrHit.wall:wallOrHit;
  if(!wall||wall.type!=='wall')return false;
  const projected=projectPointToWall(
    wall,
    Number.isFinite(opening.x)?opening.x:wall.x1,
    Number.isFinite(opening.y)?opening.y:wall.y1,
    opening.width
  );
  if(!projected)return false;
  let t=Number.isFinite(tOverride)?tOverride:(wallOrHit&&Number.isFinite(wallOrHit.t)?wallOrHit.t:projected.t);
  const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
  const half=Math.max(0,Number(opening.width)||0)/2;
  const margin=L>half*2+.02?Math.min(.49,half/L):0;
  t=Math.max(margin,Math.min(1-margin,t));
  opening.wallId=wall.id;
  opening.floorId=wall.floorId||opening.floorId||currentFloorId();
  opening.wallT=t;
  opening.x=wall.x1+dx*t;
  opening.y=wall.y1+dy*t;
  opening.angle=Math.atan2(dy,dx)*180/Math.PI;
  opening.wallThickness=wall.thickness||.15;
  return true;
}
function bindOpeningToNearestWall(opening,maxDist){
  if(!opening||(opening.type!=='door'&&opening.type!=='window'))return null;
  const hit=findNearestWall(opening.x,opening.y,Number.isFinite(maxDist)?maxDist:.55,opening.width,opening.floorId||currentFloorId());
  if(!hit)return null;
  attachOpeningToWall(opening,hit,hit.t);
  return hit;
}
function syncOpeningsForWall(wallId){
  const wall=getElement(wallId);
  if(!wall||wall.type!=='wall')return;
  for(const opening of state.elements){
    if((opening.type==='door'||opening.type==='window')&&opening.wallId===wallId){
      attachOpeningToWall(opening,wall,opening.wallT!=null&&Number.isFinite(Number(opening.wallT))?Number(opening.wallT):undefined);
    }
  }
}
function ensureOpeningBindings(){
  for(const opening of state.elements){
    if(opening.type!=='door'&&opening.type!=='window')continue;
    if(!opening.floorId)opening.floorId=currentFloorId();
    if(opening.type==='door'){
      opening.doorStyle=opening.doorStyle||'swing';
      opening.hingeSide=opening.hingeSide==='right'?'right':'left';
      opening.swingSide=Number(opening.swingSide)===-1?-1:1;
    }else{
      opening.windowStyle=opening.windowStyle||'sliding';
      opening.windowSide=Number(opening.windowSide)===-1?-1:1;
    }
    const wall=opening.wallId?getElement(opening.wallId):null;
    if(wall&&wall.type==='wall'&&elementBelongsToFloor(wall,opening.floorId))attachOpeningToWall(opening,wall,opening.wallT!=null&&Number.isFinite(Number(opening.wallT))?Number(opening.wallT):undefined);
    else {opening.wallId=null;opening.wallT=null;bindOpeningToNearestWall(opening,Math.max(.38,(opening.wallThickness||.15)*2.4));}
  }
}

function openingEdgeWorld(opening,edge){
  if(!opening)return null;
  const a=(Number(opening.angle)||0)*Math.PI/180;
  const sign=edge==='right'?1:-1;
  const half=Math.max(.05,Number(opening.width)||.8)/2;
  return {x:opening.x+Math.cos(a)*half*sign,y:opening.y+Math.sin(a)*half*sign};
}
function resizeOpeningOnWall(opening,edge,worldX,worldY){
  if(!opening||(opening.type!=='door'&&opening.type!=='window'))return false;
  const wall=opening.wallId?getElement(opening.wallId):null;
  if(wall&&wall.type==='wall'){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);if(L<.22)return false;
    const raw=((worldX-wall.x1)*dx+(worldY-wall.y1)*dy)/(L*L);
    const currentT=Number.isFinite(Number(opening.wallT))?Number(opening.wallT):.5;
    const halfT=(Math.max(.2,Number(opening.width)||.8)/2)/L;
    const fixedT=edge==='left'?currentT+halfT:currentT-halfT;
    const minWidth=.2,margin=.01/L;
    let movingT=Math.max(0,Math.min(1,raw));
    if(edge==='left')movingT=Math.min(movingT,fixedT-minWidth/L);
    else movingT=Math.max(movingT,fixedT+minWidth/L);
    movingT=Math.max(margin,Math.min(1-margin,movingT));
    const width=Math.max(minWidth,Math.abs(fixedT-movingT)*L);
    const centerT=(fixedT+movingT)/2;
    opening.width=Math.min(width,L-.02);
    return attachOpeningToWall(opening,wall,centerT);
  }
  const fixed=openingEdgeWorld(opening,edge==='left'?'right':'left');if(!fixed)return false;
  const a=(Number(opening.angle)||0)*Math.PI/180,ux=Math.cos(a),uy=Math.sin(a);
  const along=(worldX-fixed.x)*ux+(worldY-fixed.y)*uy;
  const moving={x:fixed.x+ux*along,y:fixed.y+uy*along};
  const width=Math.max(.2,Math.hypot(moving.x-fixed.x,moving.y-fixed.y));
  opening.width=width;opening.x=(moving.x+fixed.x)/2;opening.y=(moving.y+fixed.y)/2;
  return true;
}

/* ===== Espelhamento: reflete um ponto em torno de um eixo X ou Y ===== */
function reflectCoords(x, y, axis, axisPos){
  if (axis==='x') return { x: 2*axisPos-x, y };
  return { x, y: 2*axisPos-y };
}
