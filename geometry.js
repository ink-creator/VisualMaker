/* geometry.js
   Funções puras: conversão de coordenadas, formatação de medidas,
   snapping (grade + pontas de parede) e utilidades sem estado próprio.
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
  if (min<1) return 'agora mesmo';
  if (min<60) return `há ${min} min`;
  const hr = Math.floor(min/60);
  if (hr<24) return `há ${hr} h`;
  const day = Math.floor(hr/24);
  if (day===1) return 'ontem';
  if (day<7) return `há ${day} dias`;
  return new Date(ts).toLocaleDateString('pt-BR');
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

/* ===== Coordenadas: metros (mundo) <-> pixels (tela) ===== */
function toScreen(xm,ym){ return { x: xm*view.pxPerMeter+view.panX, y: ym*view.pxPerMeter+view.panY }; }
function toWorld(xs,ys){ return { x: (xs-view.panX)/view.pxPerMeter, y: (ys-view.panY)/view.pxPerMeter }; }

/* ===== Snap: pontas de parede + grade ===== */
function snapToEndpoints(xm,ym,excludeId){
  const thresholdM = 12/view.pxPerMeter;
  let best=null, bestDist=thresholdM;
  for (const el of state.elements){
    if (el.type!=='wall' || el.id===excludeId) continue;
    for (const pt of [{x:el.x1,y:el.y1},{x:el.x2,y:el.y2}]){
      const d = Math.hypot(pt.x-xm, pt.y-ym);
      if (d<bestDist){ bestDist=d; best=pt; }
    }
  }
  return best;
}
function snapPoint(xm,ym,excludeId){
  const ep = snapToEndpoints(xm,ym,excludeId);
  if (ep) return {x:ep.x,y:ep.y};
  if (state.gridOn){
    const g = state.gridSpacing;
    return { x: Math.round(xm/g)*g, y: Math.round(ym/g)*g };
  }
  return { x:xm, y:ym };
}

function distToSegment(px,py,x1,y1,x2,y2){
  const dx=x2-x1, dy=y2-y1;
  const lenSq = dx*dx+dy*dy;
  let t = lenSq===0 ? 0 : ((px-x1)*dx+(py-y1)*dy)/lenSq;
  t = Math.max(0, Math.min(1,t));
  const cx=x1+t*dx, cy=y1+t*dy;
  return Math.hypot(px-cx, py-cy);
}

/* Ponto mais próximo (mundo) em cima de uma parede — usado para
   encaixar portas/janelas na parede mais perto do clique. */
function findNearestWall(worldX, worldY, maxDist){
  let best=null, bestDist=maxDist;
  for (const el of state.elements){
    if (el.type!=='wall') continue;
    const dx=el.x2-el.x1, dy=el.y2-el.y1;
    const lenSq=dx*dx+dy*dy;
    let t = lenSq===0?0:((worldX-el.x1)*dx+(worldY-el.y1)*dy)/lenSq;
    t=Math.max(0,Math.min(1,t));
    const cx=el.x1+t*dx, cy=el.y1+t*dy;
    const d=Math.hypot(worldX-cx, worldY-cy);
    if (d<bestDist){ bestDist=d; best={wall:el, x:cx, y:cy, t}; }
  }
  return best;
}

/* ===== Espelhamento: reflete um ponto em torno de um eixo X ou Y ===== */
function reflectCoords(x, y, axis, axisPos){
  if (axis==='x') return { x: 2*axisPos-x, y };
  return { x, y: 2*axisPos-y };
}
