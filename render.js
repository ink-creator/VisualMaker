/* render.js
   Desenho da planta em SVG (grade, cômodos, paredes, portas, janelas,
   cotas, textos, seleção, eixo de espelho) e detecção de clique
   (hit-test) sobre os elementos. */

function makeLine(x1,y1,x2,y2,color,width){
  const l = document.createElementNS(svgNS,'line');
  l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
  l.setAttribute('stroke',color); l.setAttribute('stroke-width',width);
  return l;
}
function makeHandle(x,y){
  const c = document.createElementNS(svgNS,'circle');
  c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',6);
  c.setAttribute('fill','var(--control)'); c.setAttribute('stroke','var(--accent)'); c.setAttribute('stroke-width','2');
  c.style.cursor='pointer';
  return c;
}
function makeLabel(x,y,text,color){
  const t = document.createElementNS(svgNS,'text');
  t.setAttribute('x',x); t.setAttribute('y',y);
  t.setAttribute('text-anchor','middle');
  t.setAttribute('font-family',"'IBM Plex Mono',monospace");
  t.setAttribute('font-size','11.5');
  t.setAttribute('fill', color||'var(--accent)');
  t.textContent = text;
  return t;
}

/* ===== Camadas de fundo ===== */
function drawGrid(layer){
  const wrap = document.getElementById('canvas-wrap');
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  const tl = toWorld(0,0), br = toWorld(cw,ch);
  const g = state.gridSpacing;
  let startX = Math.floor(tl.x/g)*g, endX = Math.ceil(br.x/g)*g;
  let startY = Math.floor(tl.y/g)*g, endY = Math.ceil(br.y/g)*g;
  if ((endX-startX)/g > 800 || (endY-startY)/g > 800) return;
  for (let x=startX; x<=endX; x+=g){
    const isMajor = Math.abs(Math.round(x*1000)%1000)<1;
    const p1=toScreen(x,startY), p2=toScreen(x,endY);
    layer.appendChild(makeLine(p1.x,p1.y,p2.x,p2.y, isMajor?'var(--paper-grid-major)':'var(--paper-grid)', isMajor?1:0.6));
  }
  for (let y=startY; y<=endY; y+=g){
    const isMajor = Math.abs(Math.round(y*1000)%1000)<1;
    const p1=toScreen(startX,y), p2=toScreen(endX,y);
    layer.appendChild(makeLine(p1.x,p1.y,p2.x,p2.y, isMajor?'var(--paper-grid-major)':'var(--paper-grid)', isMajor?1:0.6));
  }
}
function drawMirrorAxes(layer){
  const wrap = document.getElementById('canvas-wrap');
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  if (mirrorState.xActive && mirrorState.axisX!=null){
    const sx = toScreen(mirrorState.axisX,0).x;
    const line = makeLine(sx,0,sx,ch,'var(--warm)',2);
    line.setAttribute('stroke-dasharray','2 6');
    layer.appendChild(line);
  }
  if (mirrorState.yActive && mirrorState.axisY!=null){
    const sy = toScreen(0,mirrorState.axisY).y;
    const line = makeLine(0,sy,cw,sy,'var(--warm)',2);
    line.setAttribute('stroke-dasharray','2 6');
    layer.appendChild(line);
  }
}

/* ===== Elementos ===== */
function roomPatternId(el){ return 'room-pattern-'+String(el.id||'x').replace(/[^a-zA-Z0-9_-]/g,''); }
function buildRoomPatternDefs(){
  const rooms=[...getActiveFloorElements(),...floorSurfaceElements()].filter(e=>e.type==='room'&&(e.material||'solid')!=='solid');
  if(!rooms.length) return null;
  const defs=document.createElementNS(svgNS,'defs');
  const dark=document.body.classList.contains('dark-mode');
  rooms.forEach(el=>{
    const material=el.material||'solid',base=(typeof floorMaterialBase==='function'?floorMaterialBase(el,dark?'dark':'light'):(el.color||'var(--room-fill)'));
    const pattern=document.createElementNS(svgNS,'pattern');
    pattern.setAttribute('id',roomPatternId(el));pattern.setAttribute('patternUnits','userSpaceOnUse');
    const size=material==='wood'?36:material==='tile'?30:material==='grass'?24:32;
    pattern.setAttribute('width',size);pattern.setAttribute('height',material==='wood'?14:size);
    const bg=document.createElementNS(svgNS,'rect');bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill',base);pattern.appendChild(bg);
    const ink=dark?'#D5DEE8':'#35414D';
    if(material==='wood'){
      const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M0 0H36M0 14H36M18 0V14');path.setAttribute('fill','none');path.setAttribute('stroke',ink);path.setAttribute('stroke-opacity','.23');path.setAttribute('stroke-width','1');pattern.appendChild(path);
    }else if(material==='tile'){
      const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M0 0H30V30H0Z');path.setAttribute('fill','none');path.setAttribute('stroke',ink);path.setAttribute('stroke-opacity','.24');path.setAttribute('stroke-width','1');pattern.appendChild(path);
    }else if(material==='concrete'){
      for(const [cx,cy,r] of [[7,9,1.4],[24,20,1],[14,28,.8]]){const c=document.createElementNS(svgNS,'circle');c.setAttribute('cx',cx);c.setAttribute('cy',cy);c.setAttribute('r',r);c.setAttribute('fill',ink);c.setAttribute('fill-opacity','.13');pattern.appendChild(c);}
    }else if(material==='grass'){
      const path=document.createElementNS(svgNS,'path');path.setAttribute('d','M4 21l2-7 2 7m6 0 2-9 2 9M9 8l2-5 2 5');path.setAttribute('fill','none');path.setAttribute('stroke','#315D35');path.setAttribute('stroke-opacity','.58');path.setAttribute('stroke-width','1.1');pattern.appendChild(path);
    }
    defs.appendChild(pattern);
  });
  return defs;
}
function drawRoom(layer, el){
  const p1 = toScreen(el.x, el.y), p2 = toScreen(el.x+el.w, el.y+el.h);
  const rect = document.createElementNS(svgNS,'rect');
  rect.setAttribute('x', Math.min(p1.x,p2.x)); rect.setAttribute('y', Math.min(p1.y,p2.y));
  rect.setAttribute('width', Math.abs(p2.x-p1.x)); rect.setAttribute('height', Math.abs(p2.y-p1.y));
  const textured=(el.material||'solid')!=='solid'&&!state.blueprintOn; rect.setAttribute('fill',textured?`url(#${roomPatternId(el)})`:(el.color||'var(--room-fill)')); rect.setAttribute('fill-opacity',textured?'0.78':'0.42'); rect.setAttribute('stroke','none');
  layer.appendChild(rect);
  if(el.surfaceOnly)return;
  const cx=(p1.x+p2.x)/2, cy=(p1.y+p2.y)/2;
  const name = document.createElementNS(svgNS,'text');
  name.setAttribute('x',cx); name.setAttribute('y',cy-6); name.setAttribute('text-anchor','middle');
  name.setAttribute('font-family',"'IBM Plex Sans',sans-serif"); name.setAttribute('font-weight','600');
  name.setAttribute('font-size','13'); name.setAttribute('fill','var(--room-ink)'); name.textContent = el.name;
  layer.appendChild(name);
  const area = document.createElementNS(svgNS,'text');
  area.setAttribute('x',cx); area.setAttribute('y',cy+10); area.setAttribute('text-anchor','middle');
  area.setAttribute('font-family',"'IBM Plex Mono',monospace"); area.setAttribute('font-size','11');
  area.setAttribute('fill','var(--text-secondary)'); const value=typeof roomArea==='function'?roomArea(el):Math.abs(el.w*el.h); area.textContent = `${typeof localizedNumber==='function'?localizedNumber(value,2):value.toFixed(2)} m²`; 
  layer.appendChild(area);
}
function drawWall(layer, el){
  const p1=toScreen(el.x1,el.y1), p2=toScreen(el.x2,el.y2);
  const strokeW = Math.max(2, el.thickness*view.pxPerMeter);
  const line = makeLine(p1.x,p1.y,p2.x,p2.y,'var(--ink)',strokeW);
  line.setAttribute('stroke-linecap','square');
  layer.appendChild(line);
}
function drawOpeningGroup(el, innerBuilder){
  const p = toScreen(el.x, el.y);
  const wPx = el.width*view.pxPerMeter;
  const tPx = (el.wallThickness||0.15)*view.pxPerMeter;
  const g = document.createElementNS(svgNS,'g');
  g.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${el.angle||0})`);
  const gap = document.createElementNS(svgNS,'rect');
  gap.setAttribute('x',-wPx/2); gap.setAttribute('y',-tPx/2-1);
  gap.setAttribute('width',wPx); gap.setAttribute('height',tPx+2);
  gap.setAttribute('fill','var(--paper)');
  g.appendChild(gap);
  innerBuilder(g, wPx, tPx);
  return g;
}
function drawDoor(layer, el){
  const g = drawOpeningGroup(el, (g, wPx, tPx)=>{
    if((el.doorStyle||'swing')==='sliding'){
      const rail=makeLine(-wPx*.52,-tPx*.34,wPx*.52,-tPx*.34,'var(--ink)',1.4);g.appendChild(rail);
      const leaf1=makeLine(-wPx*.48,-tPx*.10,wPx*.08,-tPx*.10,'var(--ink)',2.2);g.appendChild(leaf1);
      const leaf2=makeLine(-wPx*.08,tPx*.14,wPx*.48,tPx*.14,'var(--ink)',2.2);g.appendChild(leaf2);
      return;
    }
    const hingeRight=el.hingeSide==='right',swing=Number(el.swingSide)===-1?-1:1;
    const hingeX=hingeRight?wPx/2:-wPx/2,closedX=hingeRight?-wPx/2:wPx/2;
    const openY=-wPx*swing;
    const leaf=document.createElementNS(svgNS,'line');
    leaf.setAttribute('x1',hingeX);leaf.setAttribute('y1',0);leaf.setAttribute('x2',hingeX);leaf.setAttribute('y2',openY);
    leaf.setAttribute('stroke','var(--ink)');leaf.setAttribute('stroke-width','2');g.appendChild(leaf);
    const arc=document.createElementNS(svgNS,'path');
    const sweep=(hingeRight?1:0)^(swing<0?1:0);
    arc.setAttribute('d',`M ${hingeX} ${openY} A ${wPx} ${wPx} 0 0 ${sweep} ${closedX} 0`);
    arc.setAttribute('fill','none');arc.setAttribute('stroke','var(--text-secondary)');arc.setAttribute('stroke-width','1');arc.setAttribute('stroke-dasharray','3 3');g.appendChild(arc);
    const hinge=document.createElementNS(svgNS,'circle');hinge.setAttribute('cx',hingeX);hinge.setAttribute('cy',0);hinge.setAttribute('r',2.4);hinge.setAttribute('fill','var(--accent)');g.appendChild(hinge);
  });
  layer.appendChild(g);
}
function drawWindow(layer, el){
  const g = drawOpeningGroup(el, (g, wPx, tPx)=>{
    const style=el.windowStyle||'sliding',side=Number(el.windowSide)===-1?-1:1;
    [-tPx/4,tPx/4].forEach(yOff=>{const l=makeLine(-wPx/2,yOff,wPx/2,yOff,'var(--accent)',2);g.appendChild(l);});
    if(style==='sliding'){
      const center=makeLine(0,-tPx*.55,0,tPx*.55,'var(--accent)',1.4);g.appendChild(center);
      const arrow1=makeLine(-wPx*.28,-tPx*.75,-wPx*.04,-tPx*.75,'var(--text-secondary)',1);g.appendChild(arrow1);
      const arrow2=makeLine(wPx*.28,tPx*.75,wPx*.04,tPx*.75,'var(--text-secondary)',1);g.appendChild(arrow2);
    }else if(style==='fixed'){
      const center=makeLine(0,-tPx*.45,0,tPx*.45,'var(--text-secondary)',1);center.setAttribute('opacity','.5');g.appendChild(center);
    }else if(style==='awning'){
      const y=-side*Math.max(8,wPx*.18),edge=makeLine(-wPx*.42,0,wPx*.42,y,'var(--accent)',1.5);g.appendChild(edge);
      const edge2=makeLine(wPx*.42,0,-wPx*.42,y,'var(--accent)',1.5);g.appendChild(edge2);
    }
  });
  layer.appendChild(g);
}
function cotaGeometry(el){
  const dx=el.x2-el.x1, dy=el.y2-el.y1;
  const len=Math.hypot(dx,dy);
  if (len<0.001) return null;
  const nx=-dy/len, ny=dx/len;
  return {
    len,
    a1:{x:el.x1+nx*el.offset, y:el.y1+ny*el.offset},
    a2:{x:el.x2+nx*el.offset, y:el.y2+ny*el.offset}
  };
}
function drawCota(layer, el){
  const geo = cotaGeometry(el); if (!geo) return;
  const e1=toScreen(el.x1,el.y1), e2=toScreen(el.x2,el.y2);
  const p1=toScreen(geo.a1.x,geo.a1.y), p2=toScreen(geo.a2.x,geo.a2.y);
  layer.appendChild(makeLine(e1.x,e1.y,p1.x,p1.y,'var(--text-secondary)',1));
  layer.appendChild(makeLine(e2.x,e2.y,p2.x,p2.y,'var(--text-secondary)',1));
  layer.appendChild(makeLine(p1.x,p1.y,p2.x,p2.y,'var(--text-secondary)',1.2));
  const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
  layer.appendChild(makeLabel(mx,my-6,formatMeters(geo.len),'var(--text-secondary)'));
}
function drawText(layer, el){
  const p = toScreen(el.x, el.y);
  const t = document.createElementNS(svgNS,'text');
  t.setAttribute('x',p.x); t.setAttribute('y',p.y);
  t.setAttribute('font-family',"'IBM Plex Sans',sans-serif");
  t.setAttribute('font-size', el.size||16);
  t.setAttribute('font-weight', el.bold?'700':'400');
  const dark=document.body.classList.contains('dark-mode');
  const textColor=(!el.color||(dark&&String(el.color).toLowerCase()==='#1b2430'))?(dark?'var(--ink)':'#1B2430'):el.color;
  t.setAttribute('fill', textColor);
  if (el.rotation) t.setAttribute('transform', `rotate(${el.rotation} ${p.x} ${p.y})`);
  t.style.userSelect='none';
  t.textContent = el.content;
  layer.appendChild(t);
}
function drawObject(layer, el){
  const p=toScreen(el.x,el.y), w=(el.w||1)*view.pxPerMeter, h=(el.h||1)*view.pxPerMeter;
  const g=document.createElementNS(svgNS,'g');
  g.setAttribute('transform',`translate(${p.x} ${p.y}) rotate(${el.rotation||0})`);
  g.setAttribute('fill',el.color||'var(--object-fill)'); g.setAttribute('stroke','var(--object-stroke)');
  g.setAttribute('stroke-width','1.4'); g.setAttribute('stroke-linejoin','round');
  const add=(tag,attrs)=>{ const n=document.createElementNS(svgNS,tag); Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v)); g.appendChild(n); return n; };
  if (el.kind==='sofa'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:Math.min(8,h*.16)}); add('line',{x1:-w*.32,y1:-h/2,x2:-w*.32,y2:h/2}); add('line',{x1:w*.32,y1:-h/2,x2:w*.32,y2:h/2}); add('rect',{x:-w/2+3,y:-h/2+3,width:w-6,height:h*.22,rx:2,fill:'none'});
  } else if (el.kind==='bed'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:3}); add('line',{x1:-w/2,y1:-h*.2,x2:w/2,y2:-h*.2}); add('rect',{x:-w*.38,y:-h*.42,width:w*.32,height:h*.18,rx:3,fill:'none'}); add('rect',{x:w*.06,y:-h*.42,width:w*.32,height:h*.18,rx:3,fill:'none'});
  } else if (el.kind==='table'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:Math.min(8,h*.15)}); [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([dx,dy])=>add('circle',{cx:dx*(w/2+7),cy:dy*(h/2-4),r:5,fill:'none'}));
  } else if (el.kind==='desk'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:2}); add('rect',{x:-w*.25,y:-h*.25,width:w*.5,height:h*.32,rx:2,fill:'none'}); add('line',{x1:0,y1:h*.07,x2:0,y2:h*.36});
  } else if (el.kind==='toilet'){
    add('rect',{x:-w*.35,y:-h/2,width:w*.7,height:h*.25,rx:3}); add('ellipse',{cx:0,cy:h*.12,rx:w*.34,ry:h*.35}); add('ellipse',{cx:0,cy:h*.1,rx:w*.2,ry:h*.22,fill:'none'});
  } else if (el.kind==='sink'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:3}); add('ellipse',{cx:0,cy:0,rx:w*.32,ry:h*.27,fill:'none'}); add('circle',{cx:0,cy:0,r:2});
  } else if (el.kind==='plant'){
    add('circle',{cx:0,cy:0,r:Math.min(w,h)*.34}); for(let i=0;i<6;i++) add('ellipse',{cx:0,cy:-h*.2,rx:w*.11,ry:h*.25,fill:'none',transform:`rotate(${i*60})`});
  } else if (el.kind==='pool'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:Math.min(12,h*.16)}); for(let yy=-h*.25;yy<=h*.25;yy+=Math.max(8,h*.22)) add('path',{d:`M ${-w*.38} ${yy} Q ${-w*.18} ${yy-5} 0 ${yy} T ${w*.38} ${yy}`,fill:'none'});
  } else if (el.kind==='tree'){
    add('circle',{cx:0,cy:0,r:Math.min(w,h)*.42}); add('circle',{cx:0,cy:0,r:Math.min(w,h)*.18,fill:'none'}); for(let i=0;i<8;i++) add('line',{x1:0,y1:0,x2:0,y2:-Math.min(w,h)*.4,transform:`rotate(${i*45})`});
  } else if (el.kind==='car'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:Math.min(10,h*.22)}); add('rect',{x:-w*.28,y:-h*.28,width:w*.56,height:h*.56,rx:4,fill:'none'}); add('line',{x1:-w*.28,y1:0,x2:w*.28,y2:0});
  } else if (el.kind==='grill'){
    add('circle',{cx:0,cy:-h*.08,r:Math.min(w,h)*.34}); add('line',{x1:-w*.24,y1:h*.18,x2:-w*.35,y2:h*.5}); add('line',{x1:w*.24,y1:h*.18,x2:w*.35,y2:h*.5}); add('line',{x1:-w*.3,y1:-h*.08,x2:w*.3,y2:-h*.08});
  } else if (el.kind==='fridge'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:3}); add('line',{x1:-w/2,y1:-h*.05,x2:w/2,y2:-h*.05}); add('line',{x1:w*.30,y1:-h*.38,x2:w*.30,y2:-h*.12}); add('line',{x1:w*.30,y1:h*.08,x2:w*.30,y2:h*.38});
  } else if (el.kind==='stove'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:2}); [[-.22,-.2],[.22,-.2],[-.22,.2],[.22,.2]].forEach(([x,y])=>add('circle',{cx:x*w,cy:y*h,r:Math.min(w,h)*.12,fill:'none'}));
  } else if (el.kind==='counter'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:2}); add('line',{x1:-w/2,y1:-h*.18,x2:w/2,y2:-h*.18}); add('line',{x1:-w*.16,y1:-h*.18,x2:-w*.16,y2:h/2}); add('line',{x1:w*.16,y1:-h*.18,x2:w*.16,y2:h/2});
  } else if (el.kind==='wardrobe'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:2}); add('line',{x1:0,y1:-h/2,x2:0,y2:h/2}); add('circle',{cx:-w*.04,cy:0,r:2}); add('circle',{cx:w*.04,cy:0,r:2});
  } else if (el.kind==='tv'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:2}); add('line',{x1:-w*.12,y1:h/2+3,x2:w*.12,y2:h/2+3});
  } else if (el.kind==='column'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h}); add('line',{x1:-w*.35,y1:-h*.35,x2:w*.35,y2:h*.35}); add('line',{x1:w*.35,y1:-h*.35,x2:-w*.35,y2:h*.35});
  } else if (el.kind==='halfwall'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:1}); add('line',{x1:-w/2,y1:0,x2:w/2,y2:0});
  } else if (el.kind==='slidingGate'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h}); for(let x=-w*.35;x<=w*.35;x+=Math.max(8,w*.18))add('line',{x1:x,y1:-h/2,x2:x,y2:h/2}); add('line',{x1:-w*.45,y1:h*.65,x2:w*.45,y2:h*.65});
  } else if (el.kind==='doubleGate'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h}); add('line',{x1:0,y1:-h/2,x2:0,y2:h/2}); add('line',{x1:-w/2,y1:-h/2,x2:0,y2:h/2}); add('line',{x1:w/2,y1:-h/2,x2:0,y2:h/2});
  } else if (el.kind==='pedestrianGate'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h}); for(let x=-w*.3;x<=w*.3;x+=Math.max(6,w*.22))add('line',{x1:x,y1:-h/2,x2:x,y2:h/2}); add('circle',{cx:w*.27,cy:0,r:2});
  } else if (el.kind==='pergola'){
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,fill:'none'}); for(let x=-w*.4;x<=w*.4;x+=Math.max(10,w*.2))add('line',{x1:x,y1:-h/2,x2:x,y2:h/2});
  } else {
    add('rect',{x:-w/2,y:-h/2,width:w,height:h,rx:3});
  }
  layer.appendChild(g);
}

function drawBlueprintDimensions(layer){
  for(const wall of (typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements).filter(e=>e.type==='wall')){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,len=Math.hypot(dx,dy); if(len<.02) continue;
    const nx=-dy/len,ny=dx/len,offset=.34;
    const a=toScreen(wall.x1+nx*offset,wall.y1+ny*offset),b=toScreen(wall.x2+nx*offset,wall.y2+ny*offset);
    const e1=toScreen(wall.x1,wall.y1),e2=toScreen(wall.x2,wall.y2);
    const color='var(--accent)';
    [makeLine(e1.x,e1.y,a.x,a.y,color,.8),makeLine(e2.x,e2.y,b.x,b.y,color,.8),makeLine(a.x,a.y,b.x,b.y,color,1)].forEach(n=>layer.appendChild(n));
    const tick=5; layer.appendChild(makeLine(a.x-tick*ny,a.y+tick*nx,a.x+tick*ny,a.y-tick*nx,color,1)); layer.appendChild(makeLine(b.x-tick*ny,b.y+tick*nx,b.x+tick*ny,b.y-tick*nx,color,1));
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
    const bg=document.createElementNS(svgNS,'rect'); const label=formatMeters(len); const bw=Math.max(38,label.length*7);
    bg.setAttribute('x',mx-bw/2);bg.setAttribute('y',my-13);bg.setAttribute('width',bw);bg.setAttribute('height',16);bg.setAttribute('rx',2);bg.setAttribute('fill','var(--paper)');bg.setAttribute('fill-opacity','.94');layer.appendChild(bg);
    layer.appendChild(makeLabel(mx,my-2,label,color));
  }
}

function drawSmartGuides(layer){
  if(typeof smartGuides==='undefined'||!Array.isArray(smartGuides)||!smartGuides.length)return;
  const wrap=document.getElementById('canvas-wrap'),cw=wrap.clientWidth,ch=wrap.clientHeight;
  for(const guide of smartGuides){
    if(guide.axis==='x'){
      const x=toScreen(guide.value,0).x;
      const line=makeLine(x,0,x,ch,'var(--warm)',1.2);line.setAttribute('stroke-dasharray','5 5');line.setAttribute('opacity','.85');layer.appendChild(line);
      if(Number.isFinite(guide.anchor)&&Number.isFinite(guide.moving)){
        const a=toScreen(guide.value,guide.anchor),b=toScreen(guide.value,guide.moving),d=Math.abs(guide.moving-guide.anchor);
        if(d>.08){const measure=makeLine(a.x,a.y,b.x,b.y,'var(--warm)',1.5);layer.appendChild(measure);layer.appendChild(makeLabel(x+28,(a.y+b.y)/2,formatMeters(d),'var(--warm)'));}
      }
    }else if(guide.axis==='y'){
      const y=toScreen(0,guide.value).y;
      const line=makeLine(0,y,cw,y,'var(--warm)',1.2);line.setAttribute('stroke-dasharray','5 5');line.setAttribute('opacity','.85');layer.appendChild(line);
      if(Number.isFinite(guide.anchor)&&Number.isFinite(guide.moving)){
        const a=toScreen(guide.anchor,guide.value),b=toScreen(guide.moving,guide.value),d=Math.abs(guide.moving-guide.anchor);
        if(d>.08){const measure=makeLine(a.x,a.y,b.x,b.y,'var(--warm)',1.5);layer.appendChild(measure);layer.appendChild(makeLabel((a.x+b.x)/2,y-8,formatMeters(d),'var(--warm)'));}
      }
    }
  }
}

/* ===== Seleção / handles ===== */
function drawSelection(layer, el, showHandles=true){
  if (!el) return;
  if ('x1' in el){
    const p1=toScreen(el.x1,el.y1), p2=toScreen(el.x2,el.y2);
    if (el.type==='wall'){
      const outline = makeLine(p1.x,p1.y,p2.x,p2.y,'var(--accent)', Math.max(4, el.thickness*view.pxPerMeter+4));
      outline.setAttribute('opacity','0.30');
      layer.appendChild(outline);
    } else {
      const outline = makeLine(p1.x,p1.y,p2.x,p2.y,'var(--accent)',3);
      outline.setAttribute('opacity','0.5');
      layer.appendChild(outline);
    }
    const length = Math.hypot(el.x2-el.x1, el.y2-el.y1);
    const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
    if(showHandles){layer.appendChild(makeLabel(mx,my-12,formatMeters(length)));layer.appendChild(makeHandle(p1.x,p1.y));layer.appendChild(makeHandle(p2.x,p2.y));}
  } else if (el.type==='object'){
    const p=toScreen(el.x,el.y),w=(el.w||1)*view.pxPerMeter,h=(el.h||1)*view.pxPerMeter;
    const outline=document.createElementNS(svgNS,'rect'); outline.setAttribute('x',p.x-w/2-4);outline.setAttribute('y',p.y-h/2-4);outline.setAttribute('width',w+8);outline.setAttribute('height',h+8);outline.setAttribute('rx',4);outline.setAttribute('fill','none');outline.setAttribute('stroke','var(--accent)');outline.setAttribute('stroke-width','1.5');outline.setAttribute('stroke-dasharray','4 3');outline.setAttribute('transform',`rotate(${el.rotation||0} ${p.x} ${p.y})`);layer.appendChild(outline);
  } else if (el.type==='text'){
    const p = toScreen(el.x, el.y);
    const m = textBoxMetrics(el);
    const rect = document.createElementNS(svgNS,'rect');
    rect.setAttribute('x', p.x-4); rect.setAttribute('y', p.y-m.h+4);
    rect.setAttribute('width', m.w+8); rect.setAttribute('height', m.h);
    rect.setAttribute('fill','none'); rect.setAttribute('stroke','var(--accent)');
    rect.setAttribute('stroke-width','1.4'); rect.setAttribute('stroke-dasharray','4 3');
    if (el.rotation) rect.setAttribute('transform', `rotate(${el.rotation} ${p.x} ${p.y})`);
    layer.appendChild(rect);
  } else if (el.type==='door' || el.type==='window'){
    const left=typeof openingEdgeWorld==='function'?openingEdgeWorld(el,'left'):null,right=typeof openingEdgeWorld==='function'?openingEdgeWorld(el,'right'):null;
    if(left&&right){
      const a=toScreen(left.x,left.y),b=toScreen(right.x,right.y);
      const outline=makeLine(a.x,a.y,b.x,b.y,'var(--accent)',5);outline.setAttribute('opacity','.32');layer.appendChild(outline);
      if(showHandles){layer.appendChild(makeHandle(a.x,a.y));layer.appendChild(makeHandle(b.x,b.y));}
    }
  } else if (el.type==='room'){
    const p1=toScreen(el.x,el.y), p2=toScreen(el.x+el.w,el.y+el.h);
    const outline=document.createElementNS(svgNS,'rect');
    outline.setAttribute('x',p1.x); outline.setAttribute('y',p1.y);
    outline.setAttribute('width',p2.x-p1.x); outline.setAttribute('height',p2.y-p1.y);
    outline.setAttribute('fill','none'); outline.setAttribute('stroke','var(--accent)'); outline.setAttribute('stroke-width','2');
    layer.appendChild(outline);
    if(showHandles){layer.appendChild(makeHandle(p1.x,p1.y)); layer.appendChild(makeHandle(p2.x,p1.y));layer.appendChild(makeHandle(p1.x,p2.y)); layer.appendChild(makeHandle(p2.x,p2.y));}
  }
}

/* ===== Prévias (enquanto desenha) ===== */
function drawWallPreview(layer){
  if (!wallDraft.previewPoint) return;
  const p1 = toScreen(wallDraft.lastPoint.x, wallDraft.lastPoint.y);
  const p2 = toScreen(wallDraft.previewPoint.x, wallDraft.previewPoint.y);
  const line = makeLine(p1.x,p1.y,p2.x,p2.y,'var(--accent)',3);
  line.setAttribute('stroke-dasharray','6 4');
  layer.appendChild(line);
  const length = Math.hypot(wallDraft.previewPoint.x-wallDraft.lastPoint.x, wallDraft.previewPoint.y-wallDraft.lastPoint.y);
  const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
  layer.appendChild(makeLabel(mx,my-12,formatMeters(length)));
  layer.appendChild(makeHandle(p1.x,p1.y));
}
function drawCotaPreview(layer){
  if (!cotaDraft.previewPoint) return;
  const p1=toScreen(cotaDraft.startPoint.x,cotaDraft.startPoint.y);
  const p2=toScreen(cotaDraft.previewPoint.x,cotaDraft.previewPoint.y);
  const line = makeLine(p1.x,p1.y,p2.x,p2.y,'var(--text-secondary)',1.5);
  line.setAttribute('stroke-dasharray','4 3');
  layer.appendChild(line);
  const len = Math.hypot(cotaDraft.previewPoint.x-cotaDraft.startPoint.x, cotaDraft.previewPoint.y-cotaDraft.startPoint.y);
  const mx=(p1.x+p2.x)/2, my=(p1.y+p2.y)/2;
  layer.appendChild(makeLabel(mx,my-8,formatMeters(len),'var(--text-secondary)'));
}
function drawRoomPreview(layer){
  const x=Math.min(roomDraft.startX,roomDraft.curX), y=Math.min(roomDraft.startY,roomDraft.curY);
  const w=Math.abs(roomDraft.curX-roomDraft.startX), h=Math.abs(roomDraft.curY-roomDraft.startY);
  const p1=toScreen(x,y), p2=toScreen(x+w,y+h);
  const rect=document.createElementNS(svgNS,'rect');
  rect.setAttribute('x',p1.x); rect.setAttribute('y',p1.y);
  rect.setAttribute('width',p2.x-p1.x); rect.setAttribute('height',p2.y-p1.y);
  rect.setAttribute('fill','var(--accent-soft)'); rect.setAttribute('fill-opacity','0.4');
  rect.setAttribute('stroke','var(--accent)'); rect.setAttribute('stroke-dasharray','4 3');
  layer.appendChild(rect);
  layer.appendChild(makeLabel((p1.x+p2.x)/2, (p1.y+p2.y)/2, `${w.toFixed(2)}×${h.toFixed(2)} m`));
}

/* ===== Composição das camadas ===== */
function renderCanvas(){
  svgEl.innerHTML = '';
  const materialDefs=buildRoomPatternDefs();if(materialDefs)svgEl.appendChild(materialDefs);
  const layerGrid = document.createElementNS(svgNS,'g');
  const layerRooms = document.createElementNS(svgNS,'g');
  const layerWalls = document.createElementNS(svgNS,'g');
  const layerOpenings = document.createElementNS(svgNS,'g');
  const layerObjects = document.createElementNS(svgNS,'g');
  const layerCotas = document.createElementNS(svgNS,'g');
  const layerTexts = document.createElementNS(svgNS,'g');
  const layerSelection = document.createElementNS(svgNS,'g');
  [layerGrid,layerRooms,layerWalls,layerOpenings,layerObjects,layerCotas,layerTexts,layerSelection].forEach(l=>svgEl.appendChild(l));

  if (state.gridOn) drawGrid(layerGrid);
  for(const surface of floorSurfaceElements())drawRoom(layerRooms,surface);
  if(activeProject().settings.ghostFloors){
    const ghost=document.createElementNS(svgNS,'g');
    ghost.setAttribute('opacity','.18');ghost.setAttribute('pointer-events','none');
    ghost.setAttribute('data-layer','other-floors');
    for(const f of state.floors.filter(f=>f.id!==state.activeFloorId))for(const el of f.elements){
      if(el.type==='wall')drawWall(ghost,el);
      else if(el.type==='room')drawRoom(ghost,{...el,material:'solid'});
      else if(el.type==='object')drawObject(ghost,el);
    }
    svgEl.insertBefore(ghost,layerWalls);
  }
  const activeElements=typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements;
  for (const el of activeElements){
    if (el.type==='room') drawRoom(layerRooms, el);
    else if (el.type==='wall') drawWall(layerWalls, el);
    else if (el.type==='door') drawDoor(layerOpenings, el);
    else if (el.type==='window') drawWindow(layerOpenings, el);
    else if (el.type==='object') drawObject(layerObjects, el);
    else if (el.type==='cota') drawCota(layerCotas, el);
    else if (el.type==='text') drawText(layerTexts, el);
  }
  if (state.blueprintOn) drawBlueprintDimensions(layerCotas);
  drawMirrorAxes(layerSelection);
  drawSmartGuides(layerSelection);
  const selection=typeof getSelectedElements==='function'?getSelectedElements():(selectedId?[getElement(selectedId)].filter(Boolean):[]);
  const multi=selection.length>1;
  selection.forEach(el=>drawSelection(layerSelection,el,!multi&&el.id===selectedId));
  if (tool==='wall' && wallDraft) drawWallPreview(layerSelection);
  if (tool==='cota' && cotaDraft) drawCotaPreview(layerSelection);
  if (tool==='room' && roomDraft) drawRoomPreview(layerSelection);
}
function render(){
  renderCanvas();
  const emptyHint=document.getElementById('empty-hint');
  if(emptyHint){const count=(typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements).length;emptyHint.classList.toggle('hidden', count!==0 || document.body.classList.contains('view-3d'));}
  updateSummary();
  if (window.refresh3DView) window.refresh3DView();
}
function updateSummary(){
  const summaryEl = document.getElementById('summary-panel');
  const activeElements=typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements;
  if (activeElements.length===0){ summaryEl.classList.add('hidden'); return; }
  summaryEl.classList.remove('hidden');
  const rooms = activeElements.filter(e=>e.type==='room');
  const walls = activeElements.filter(e=>e.type==='wall');
  const doors = activeElements.filter(e=>e.type==='door');
  const windows = activeElements.filter(e=>e.type==='window');
  const objects = activeElements.filter(e=>e.type==='object');
  const totalArea = rooms.reduce((sum,room)=>sum+(typeof roomArea==='function'?roomArea(room):Math.abs(room.w*room.h)),0);
  const perimeter = walls.reduce((s,w)=>s+Math.hypot(w.x2-w.x1,w.y2-w.y1),0);
  const num=value=>typeof localizedNumber==='function'?localizedNumber(value,2):Number(value).toFixed(2);
  const parts = [];
  if (totalArea>0) parts.push(t('totalArea',{area:num(totalArea)}));
  parts.push(walls.length===1?t('wallCountOne'):t('wallCount',{count:walls.length}));
  if (doors.length) parts.push(doors.length===1?t('doorCountOne'):t('doorCount',{count:doors.length}));
  if (windows.length) parts.push(windows.length===1?t('windowCountOne'):t('windowCount',{count:windows.length}));
  if (objects.length) parts.push(objects.length===1?t('itemCountOne'):t('itemCount',{count:objects.length}));
  parts.push(t('perimeter',{value:num(perimeter)}));
  summaryEl.textContent = parts.join('  ·  ');
}

/* ===== Hit-test (o que está sob o cursor) ===== */
function hitTestText(sx,sy,el){
  const p = toScreen(el.x, el.y);
  const m = textBoxMetrics(el);
  return sx>=p.x-4 && sx<=p.x-4+m.w+8 && sy>=p.y-m.h+4 && sy<=p.y-m.h+4+m.h;
}
function hitTestDoorWindow(sx,sy,el){
  const p = toScreen(el.x,el.y);
  const wPx = el.width*view.pxPerMeter;
  return Math.hypot(sx-p.x, sy-p.y) < wPx/2+6;
}
function hitTestObject(sx,sy,el){
  const p=toScreen(el.x,el.y), radius=Math.hypot((el.w||1)*view.pxPerMeter,(el.h||1)*view.pxPerMeter)/2;
  return Math.hypot(sx-p.x,sy-p.y)<radius;
}
function hitTestCota(sx,sy,el){
  const geo = cotaGeometry(el); if (!geo) return false;
  const p1=toScreen(geo.a1.x,geo.a1.y), p2=toScreen(geo.a2.x,geo.a2.y);
  return distToSegment(sx,sy,p1.x,p1.y,p2.x,p2.y) < 8;
}
function hitTestMirrorAxis(sx,sy){
  const wrap = document.getElementById('canvas-wrap');
  if (mirrorState.xActive && mirrorState.axisX!=null){
    const ax = toScreen(mirrorState.axisX,0).x;
    if (Math.abs(sx-ax) < 8 && sy>=0 && sy<=wrap.clientHeight) return 'x';
  }
  if (mirrorState.yActive && mirrorState.axisY!=null){
    const ay = toScreen(0,mirrorState.axisY).y;
    if (Math.abs(sy-ay) < 8 && sx>=0 && sx<=wrap.clientWidth) return 'y';
  }
  return null;
}
function hitTest(sx,sy){
  const selectionIds=typeof getSelectionIds==='function'?getSelectionIds():(selectedId?[selectedId]:[]);
  if (selectedId && selectionIds.length<=1){
    const el = getElement(selectedId);
    if (el && 'x1' in el){
      const p1=toScreen(el.x1,el.y1), p2=toScreen(el.x2,el.y2);
      if (Math.hypot(sx-p1.x,sy-p1.y)<9) return {id:el.id, handle:'p1'};
      if (Math.hypot(sx-p2.x,sy-p2.y)<9) return {id:el.id, handle:'p2'};
    }
    if(el && (el.type==='door'||el.type==='window') && typeof openingEdgeWorld==='function'){
      for(const side of ['left','right']){const wp=openingEdgeWorld(el,side),pt=wp&&toScreen(wp.x,wp.y);if(pt&&Math.hypot(sx-pt.x,sy-pt.y)<10)return {id:el.id,handle:'opening-'+side};}
    }
    if (el && el.type==='room'){
      const p1=toScreen(el.x,el.y), p2=toScreen(el.x+el.w,el.y+el.h);
      const corners = {tl:p1, tr:{x:p2.x,y:p1.y}, bl:{x:p1.x,y:p2.y}, br:p2};
      for (const key in corners){
        const pt = corners[key];
        if (Math.hypot(sx-pt.x,sy-pt.y)<9) return {id:el.id, handle:'room-'+key};
      }
    }
  }
  const activeElements=typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements;
  for (let i=activeElements.length-1;i>=0;i--){
    const el = activeElements[i];
    if (el.type==='object'){
      if (hitTestObject(sx,sy,el)) return {id:el.id};
    } else if (el.type==='door' || el.type==='window'){
      if (hitTestDoorWindow(sx,sy,el)) return {id:el.id};
    } else if (el.type==='text'){
      if (hitTestText(sx,sy,el)) return {id:el.id};
    } else if (el.type==='wall'){
      const p1=toScreen(el.x1,el.y1), p2=toScreen(el.x2,el.y2);
      const hitW = Math.max(8, el.thickness*view.pxPerMeter/2+4);
      if (distToSegment(sx,sy,p1.x,p1.y,p2.x,p2.y)<hitW) return {id:el.id};
    } else if (el.type==='cota'){
      if (hitTestCota(sx,sy,el)) return {id:el.id};
    }
  }
  for (let i=activeElements.length-1;i>=0;i--){
    const el = activeElements[i];
    if (el.type==='room'){
      const wp = toWorld(sx,sy);
      if (wp.x>=el.x && wp.x<=el.x+el.w && wp.y>=el.y && wp.y<=el.y+el.h) return {id:el.id};
    }
  }
  return null;
}
