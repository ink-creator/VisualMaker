/* app.js
   Estado da aplicação, histórico (desfazer/refazer), painel de
   propriedades, editor de texto embutido, zoom/pan, atalhos de
   teclado, navegação entre telas, exportação PNG e ligação de toda
   a interface. Carregado por último — depende de geometry.js,
   elements.js, render.js e storage.js. */

const svgNS = 'http://www.w3.org/2000/svg';
const svgEl = document.getElementById('svg-canvas');

/* ===== Estado global ===== */
let state = { projectId:null, projectName:'Novo projeto', elements:[], gridSpacing:0.5, gridOn:true, blueprintOn:false, palette:'technical', view3d:null };
let view = { pxPerMeter:60, panX:80, panY:80 };
let tool = 'select';
let selectedId = null;
let history = [];
let historyIndex = -1;
let wallDraft = null;
let cotaDraft = null;
let roomDraft = null;
let dragInfo = null;
let clipboard = null;
let unsavedChanges = false;
let idCounter = 1;
let mirrorState = { xActive:false, yActive:false, axisX:null, axisY:null };
let selectedAssetKind = null;
const palettes = {
  technical:{room:'#DCE6F2',object:'#F8FAFC',stroke:'#44566C',darkRoom:'#2B4660',darkObject:'#293642',darkStroke:'#A9BFD4'},
  warm:{room:'#E7D9C6',object:'#F4EFE7',stroke:'#875D43',darkRoom:'#584536',darkObject:'#40352E',darkStroke:'#D4B293'},
  coastal:{room:'#CFE4DF',object:'#F0F8F7',stroke:'#236C6F',darkRoom:'#28524F',darkObject:'#263B3A',darkStroke:'#83C8C2'},
  mono:{room:'#E2E2E0',object:'#FAFAF8',stroke:'#333333',darkRoom:'#3B3B39',darkObject:'#2E2E2C',darkStroke:'#C9C9C5'}
};
function getPalette(theme){
  const p=palettes[state.palette||'technical']||palettes.technical;
  const useDark=theme==='dark'||(theme==null&&document.body.classList.contains('dark-mode'));
  return useDark?{room:p.darkRoom,object:p.darkObject,stroke:p.darkStroke}:{room:p.room,object:p.object,stroke:p.stroke};
}
const assetLibrary = [
  {kind:'sofa',label:'Sofá',category:'interior',w:2.1,h:.85},
  {kind:'bed',label:'Cama',category:'interior',w:1.6,h:2},
  {kind:'table',label:'Mesa',category:'interior',w:1.5,h:.9},
  {kind:'desk',label:'Escrivaninha',category:'interior',w:1.3,h:.65},
  {kind:'toilet',label:'Vaso',category:'interior',w:.65,h:.8},
  {kind:'sink',label:'Pia',category:'interior',w:.8,h:.55},
  {kind:'plant',label:'Planta',category:'interior',w:.65,h:.65},
  {kind:'fridge',label:'Geladeira',category:'interior',w:.9,h:.72},
  {kind:'stove',label:'Fogão',category:'interior',w:.62,h:.66},
  {kind:'counter',label:'Balcão',category:'interior',w:1.8,h:.65},
  {kind:'wardrobe',label:'Guarda-roupa',category:'interior',w:1.8,h:.6},
  {kind:'tv',label:'TV',category:'interior',w:1.25,h:.12,elevation:1.05},
  {kind:'pool',label:'Piscina',category:'outdoor',w:4,h:2.4},
  {kind:'tree',label:'Árvore',category:'outdoor',w:1.6,h:1.6},
  {kind:'car',label:'Carro',category:'outdoor',w:1.8,h:4.2},
  {kind:'grill',label:'Churrasqueira',category:'outdoor',w:.9,h:.75},
  {kind:'table',label:'Mesa externa',category:'outdoor',w:1.4,h:1.4},
  {kind:'plant',label:'Canteiro',category:'outdoor',w:1.8,h:.7},
  {kind:'column',label:'Pilar',category:'structure',w:.3,h:.3},
  {kind:'halfwall',label:'Meia parede',category:'structure',w:2,h:.16},
  {kind:'slidingGate',label:'Portão correr',category:'structure',w:3.2,h:.16},
  {kind:'doubleGate',label:'Portão duplo',category:'structure',w:3,h:.16},
  {kind:'pedestrianGate',label:'Portão social',category:'structure',w:.95,h:.14},
  {kind:'pergola',label:'Pergolado',category:'structure',w:3,h:2.5}
];

const floorMaterials = {
  solid:'Cor lisa',
  wood:'Madeira',
  tile:'Cerâmica',
  concrete:'Concreto',
  grass:'Grama'
};
function floorMaterialBase(room, theme){
  if(room && room.color) return room.color;
  const material=(room&&room.material)||'solid';
  const dark=theme==='dark'||(theme==null&&document.body.classList.contains('dark-mode'));
  if(material==='wood') return dark?'#71543F':'#B88962';
  if(material==='tile') return dark?'#59616A':'#D8D6D0';
  if(material==='concrete') return dark?'#50555A':'#B8BAB9';
  if(material==='grass') return dark?'#3F623B':'#6F995A';
  return getPalette(theme).room;
}

/* ===== Histórico (desfazer/refazer) ===== */
function snapshotElements(){ return JSON.parse(JSON.stringify(state.elements)); }
function pushHistory(){
  history = history.slice(0, historyIndex+1);
  history.push(snapshotElements());
  historyIndex = history.length-1;
  if (history.length>100){ history.shift(); historyIndex--; }
  markUnsaved();
}
function undo(){
  if (historyIndex<=0) return;
  historyIndex--;
  state.elements = JSON.parse(JSON.stringify(history[historyIndex]));
  selectedId = null;
  render(); updatePropertiesPanel(); markUnsaved();
}
function redo(){
  if (historyIndex>=history.length-1) return;
  historyIndex++;
  state.elements = JSON.parse(JSON.stringify(history[historyIndex]));
  selectedId = null;
  render(); updatePropertiesPanel(); markUnsaved();
}
function markUnsaved(){ unsavedChanges = true; updateSaveButton(); }
function updateSaveButton(){
  const btn = document.getElementById('btn-save');
  btn.classList.toggle('unsaved', unsavedChanges);
  btn.innerHTML = unsavedChanges ? '<span>Salvar alterações</span>' : '<span>Salvar</span>';
}
function flashSaveIndicator(){
  const btn = document.getElementById('btn-save');
  btn.innerHTML = '<span>Salvo</span>';
  setTimeout(updateSaveButton, 1100);
}


/* ===== Posicionamento de objetos / snap arquitetônico ===== */
function objectWallProjectedExtent(el,nx,ny){
  if(!el || el.type!=='object') return 0;
  const a=(el.rotation||0)*Math.PI/180;
  const ax={x:Math.cos(a),y:Math.sin(a)};
  const ay={x:-Math.sin(a),y:Math.cos(a)};
  const hx=(el.w||1)/2,hy=(el.h||1)/2;
  return Math.abs(ax.x*nx+ax.y*ny)*hx + Math.abs(ay.x*nx+ay.y*ny)*hy;
}
function nearestWallSnapCandidate(el,excludedIds,preferDistance){
  if(!el || el.type!=='object') return null;
  const excluded=excludedIds||new Set();
  let best=null;
  for(const wall of state.elements){
    if(wall.type!=='wall'||excluded.has(wall.id)) continue;
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
    if(L<0.02) continue;
    const ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
    const raw=((el.x-wall.x1)*ux+(el.y-wall.y1)*uy);
    const along=Math.max(0,Math.min(L,raw));
    const px=wall.x1+ux*along,py=wall.y1+uy*along;
    const rx=el.x-px,ry=el.y-py;
    const signed=rx*nx+ry*ny;
    const side=signed<0?-1:1;
    const extent=objectWallProjectedExtent(el,nx,ny);
    const desired=extent+(wall.thickness||0.15)/2+0.015;
    const lineDistance=Math.hypot(rx,ry);
    const gap=Math.abs(Math.abs(signed)-desired);
    const endpointPenalty=(raw<0||raw>L)?Math.min(0.45,Math.abs(raw<0?raw:raw-L))*.65:0;
    const score=(preferDistance?lineDistance:gap)+endpointPenalty;
    if(!best||score<best.score){
      best={wall,px,py,nx,ny,ux,uy,side,desired,gap,lineDistance,score};
    }
  }
  return best;
}
function snapObjectToNearestWall(el,maxGap,force){
  if(!el||el.type!=='object') return false;
  const candidate=nearestWallSnapCandidate(el,null,!!force);
  if(!candidate) return false;
  const limit=Number.isFinite(maxGap)?maxGap:0.32;
  if(!force && candidate.gap>limit) return false;
  el.x=candidate.px+candidate.nx*candidate.side*candidate.desired;
  el.y=candidate.py+candidate.ny*candidate.side*candidate.desired;
  return true;
}
function snapObjectIntoNearbyCorner(el,maxGap){
  if(!el||el.type!=='object') return false;
  const limit=Number.isFinite(maxGap)?maxGap:0.30;
  const first=nearestWallSnapCandidate(el);
  if(!first||first.gap>limit) return false;
  el.x=first.px+first.nx*first.side*first.desired;
  el.y=first.py+first.ny*first.side*first.desired;

  // Se houver outra parede quase perpendicular e também próxima,
  // encaixa a segunda face: isso facilita posicionar móveis em cantos.
  const excluded=new Set([first.wall.id]);
  let second=null;
  for(const wall of state.elements){
    if(wall.type!=='wall'||excluded.has(wall.id)) continue;
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
    if(L<0.02) continue;
    const ux=dx/L,uy=dy/L,nx=-uy,ny=ux;
    if(Math.abs(first.nx*nx+first.ny*ny)>.78) continue;
    const raw=((el.x-wall.x1)*ux+(el.y-wall.y1)*uy);
    const along=Math.max(0,Math.min(L,raw));
    const px=wall.x1+ux*along,py=wall.y1+uy*along;
    const rx=el.x-px,ry=el.y-py,signed=rx*nx+ry*ny,side=signed<0?-1:1;
    const desired=objectWallProjectedExtent(el,nx,ny)+(wall.thickness||0.15)/2+0.015;
    const gap=Math.abs(Math.abs(signed)-desired);
    const endpointPenalty=(raw<0||raw>L)?Math.min(.45,Math.abs(raw<0?raw:raw-L))*.65:0;
    const score=gap+endpointPenalty;
    if(gap<=limit&&(!second||score<second.score)) second={px,py,nx,ny,side,desired,score};
  }
  if(second){
    el.x=second.px+second.nx*second.side*second.desired;
    el.y=second.py+second.ny*second.side*second.desired;
  }
  return true;
}

/* ===== Painel de propriedades ===== */
function updatePropertiesPanel(){
  const panel = document.getElementById('properties-panel');
  const el = selectedId ? getElement(selectedId) : null;
  if (!el){ panel.classList.add('hidden'); panel.innerHTML=''; return; }
  panel.classList.remove('hidden');

  if (el.type==='wall'){
    const length = Math.hypot(el.x2-el.x1, el.y2-el.y1);
    let angle = Math.round(Math.atan2(el.y2-el.y1, el.x2-el.x1)*180/Math.PI);
    if (angle<0) angle += 360;
    panel.innerHTML = `
      <div class="prop-header">PAREDE</div>
      <label>Comprimento<input id="prop-length" type="text" value="${escapeAttr(formatMeters(length))}"></label>
      <label>Espessura<input id="prop-thickness" type="text" value="${escapeAttr(formatMeters(el.thickness))}"></label>
      <label>Altura 3D<input id="prop-wall-height" type="text" value="${escapeAttr(formatMeters(el.height||2.7))}"></label>
      <label>Cor da parede no 3D<input id="prop-wall-color" type="color" value="${el.color||'#F0EEE9'}"></label>
      <label>Rotação<input id="prop-rot-display" type="text" value="${angle}°" readonly></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">Espelhar</button>
        <button id="prop-duplicate" class="btn-secondary">Duplicar</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">Excluir</button></div>`;
    const lenInput = document.getElementById('prop-length');
    lenInput.addEventListener('change', ()=>{
      const newLen = parseMeters(lenInput.value);
      if (newLen && newLen>0.02){
        const ratio = newLen/length;
        el.x2 = el.x1+(el.x2-el.x1)*ratio; el.y2 = el.y1+(el.y2-el.y1)*ratio;
        pushHistory(); render(); updatePropertiesPanel();
      }
    });
    bindEnterBlur(lenInput);
    const thickInput = document.getElementById('prop-thickness');
    thickInput.addEventListener('change', ()=>{
      const t = parseMeters(thickInput.value);
      if (t && t>0.01){ el.thickness = t; pushHistory(); render(); }
    });
    bindEnterBlur(thickInput);
    const wallHeightInput = document.getElementById('prop-wall-height');
    wallHeightInput.addEventListener('change', ()=>{
      const h = parseMeters(wallHeightInput.value);
      if (h && h>0.2){ el.height=h; pushHistory(); render(); updatePropertiesPanel(); }
    });
    bindEnterBlur(wallHeightInput);
    const wallColorInput = document.getElementById('prop-wall-color');
    wallColorInput.addEventListener('input', ()=>{ el.color=wallColorInput.value; render(); });
    wallColorInput.addEventListener('change', ()=>pushHistory());
  } else if (el.type==='text'){
    panel.innerHTML = `
      <div class="prop-header">TEXTO</div>
      <label>Conteúdo<input id="prop-content" type="text" value="${escapeAttr(el.content)}"></label>
      <label>Tamanho<input id="prop-size" type="number" value="${el.size||16}" min="8" max="72"></label>
      <label class="check-row"><input id="prop-bold" type="checkbox" ${el.bold?'checked':''}> Negrito</label>
      <label>Rotação (°)<input id="prop-rot" type="number" value="${el.rotation||0}" step="15"></label>
      <label>Cor<input id="prop-color" type="color" value="${el.color||'#1B2430'}"></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">Espelhar</button>
        <button id="prop-duplicate" class="btn-secondary">Duplicar</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">Excluir</button></div>`;
    const contentInput = document.getElementById('prop-content');
    contentInput.addEventListener('change', ()=>{ el.content=contentInput.value||'Texto'; pushHistory(); render(); });
    bindEnterBlur(contentInput);
    document.getElementById('prop-size').addEventListener('change', e=>{ el.size=parseFloat(e.target.value)||16; pushHistory(); render(); });
    document.getElementById('prop-bold').addEventListener('change', e=>{ el.bold=e.target.checked; pushHistory(); render(); });
    document.getElementById('prop-rot').addEventListener('change', e=>{ el.rotation=parseFloat(e.target.value)||0; pushHistory(); render(); });
    const colorInput = document.getElementById('prop-color');
    colorInput.addEventListener('input', ()=>{ el.color=colorInput.value; render(); });
    colorInput.addEventListener('change', ()=>{ pushHistory(); });
  } else if (el.type==='door' || el.type==='window'){
    const label = el.type==='door' ? 'PORTA' : 'JANELA';
    panel.innerHTML = `
      <div class="prop-header">${label}</div>
      <label>Largura<input id="prop-width" type="text" value="${escapeAttr(formatMeters(el.width))}"></label>
      <label>Altura 3D<input id="prop-opening-height" type="text" value="${escapeAttr(formatMeters(el.height||(el.type==='door'?2.1:1.2)))}"></label>
      ${el.type==='window'?`<label>Altura do peitoril<input id="prop-sill-height" type="text" value="${escapeAttr(formatMeters(el.sillHeight==null?0.9:el.sillHeight))}"></label>`:''}
      <label>Cor no 3D<input id="prop-opening-color" type="color" value="${el.color||(el.type==='door'?'#A56B43':'#9CC9DF')}"></label>
      <label>Ângulo (°)<input id="prop-angle" type="number" value="${Math.round(el.angle||0)}" step="15"></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">Espelhar</button>
        <button id="prop-duplicate" class="btn-secondary">Duplicar</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">Excluir</button></div>`;
    const widthInput = document.getElementById('prop-width');
    widthInput.addEventListener('change', ()=>{ const w=parseMeters(widthInput.value); if (w&&w>0.1){ el.width=w; pushHistory(); render(); } });
    bindEnterBlur(widthInput);
    const openingHeightInput=document.getElementById('prop-opening-height');
    openingHeightInput.addEventListener('change',()=>{const h=parseMeters(openingHeightInput.value);if(h&&h>.2){el.height=h;pushHistory();render();updatePropertiesPanel();}});
    bindEnterBlur(openingHeightInput);
    const sillInput=document.getElementById('prop-sill-height');
    if(sillInput){sillInput.addEventListener('change',()=>{const h=parseMeters(sillInput.value);if(h!=null&&h>=0){el.sillHeight=h;pushHistory();render();updatePropertiesPanel();}});bindEnterBlur(sillInput);}
    const openingColor=document.getElementById('prop-opening-color');
    openingColor.addEventListener('input',()=>{el.color=openingColor.value;render();});
    openingColor.addEventListener('change',()=>pushHistory());
    document.getElementById('prop-angle').addEventListener('change', e=>{ el.angle=parseFloat(e.target.value)||0; pushHistory(); render(); });
  } else if (el.type==='room'){
    const area = el.w*el.h;
    panel.innerHTML = `
      <div class="prop-header">CÔMODO</div>
      <label>Nome<input id="prop-room-name" type="text" value="${escapeAttr(el.name)}"></label>
      <label>Largura<input id="prop-room-w" type="text" value="${escapeAttr(formatMeters(el.w))}"></label>
      <label>Espessura<input id="prop-room-h" type="text" value="${escapeAttr(formatMeters(el.h))}"></label>
      <label>Área<input id="prop-room-area" type="text" value="${area.toFixed(2).replace('.',',')} m²" readonly></label>
      <label>Cor do ambiente<input id="prop-room-color" type="color" value="${floorMaterialBase(el)}"></label>
      <label>Material do piso<select id="prop-room-material">
        ${Object.entries(floorMaterials).map(([value,label])=>`<option value="${value}" ${(el.material||'solid')===value?'selected':''}>${label}</option>`).join('')}
      </select></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">Espelhar</button>
        <button id="prop-duplicate" class="btn-secondary">Duplicar</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">Excluir</button></div>`;
    const nameInput = document.getElementById('prop-room-name');
    nameInput.addEventListener('change', ()=>{ el.name=nameInput.value||'Cômodo'; pushHistory(); render(); });
    bindEnterBlur(nameInput);
    const wInput = document.getElementById('prop-room-w');
    wInput.addEventListener('change', ()=>{ const w=parseMeters(wInput.value); if (w&&w>0.1){ el.w=w; pushHistory(); render(); updatePropertiesPanel(); } });
    bindEnterBlur(wInput);
    const hInput = document.getElementById('prop-room-h');
    hInput.addEventListener('change', ()=>{ const h=parseMeters(hInput.value); if (h&&h>0.1){ el.h=h; pushHistory(); render(); updatePropertiesPanel(); } });
    bindEnterBlur(hInput);
    const roomColor=document.getElementById('prop-room-color');
    roomColor.addEventListener('input',()=>{el.color=roomColor.value;render();});
    roomColor.addEventListener('change',()=>pushHistory());
    const roomMaterial=document.getElementById('prop-room-material');
    roomMaterial.addEventListener('change',()=>{
      const previous=el.material||'solid';
      el.material=roomMaterial.value;
      // Ao escolher um material pela primeira vez, usa uma cor-base coerente.
      if(!el.color || (previous==='solid' && el.color===getPalette().room)) el.color=null;
      pushHistory();render();updatePropertiesPanel();
    });
  } else if (el.type==='object'){
    panel.innerHTML = `
      <div class="prop-header">${escapeHTML(el.label||'ITEM')}</div>
      <div class="prop-subheader">POSIÇÃO</div>
      <div class="prop-two-cols">
        <label>X<input id="prop-object-x" type="text" value="${escapeAttr(`${Number(el.x||0).toFixed(2)} m`)}"></label>
        <label>Y<input id="prop-object-y" type="text" value="${escapeAttr(`${Number(el.y||0).toFixed(2)} m`)}"></label>
      </div>
      <label>Elevação 3D<input id="prop-elevation" type="text" value="${escapeAttr(formatMeters(el.elevation||0))}"></label>
      <label>Rotação (°)<input id="prop-rot" type="number" value="${Math.round((el.rotation||0)*100)/100}" step="15"></label>
      <div class="prop-actions prop-actions-tight">
        <button id="prop-snap-wall" class="btn-secondary" title="Move o objeto até a parede mais próxima">Encostar parede</button>
        <button id="prop-floor" class="btn-secondary" title="Zera a elevação do objeto">Encostar no chão</button>
      </div>
      <div class="prop-subheader">TAMANHO E APARÊNCIA</div>
      <label>Largura<input id="prop-object-w" type="text" value="${escapeAttr(formatMeters(el.w))}"></label>
      <label>Profundidade<input id="prop-object-h" type="text" value="${escapeAttr(formatMeters(el.h))}"></label>
      <label>Cor<input id="prop-color" type="color" value="${el.color||getPalette().object}"></label>
      <div class="prop-actions"><button id="prop-mirror" class="btn-secondary">Espelhar</button><button id="prop-duplicate" class="btn-secondary">Duplicar</button></div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">Excluir</button></div>`;

    const xInput=document.getElementById('prop-object-x'),yInput=document.getElementById('prop-object-y');
    const applyAxis=(input,key)=>{
      const v=parseMeters(input.value);
      if(v!=null&&Number.isFinite(v)){el[key]=v;pushHistory();render();updatePropertiesPanel();}
    };
    xInput.addEventListener('change',()=>applyAxis(xInput,'x')); bindEnterBlur(xInput);
    yInput.addEventListener('change',()=>applyAxis(yInput,'y')); bindEnterBlur(yInput);

    const elevationInput=document.getElementById('prop-elevation');
    elevationInput.addEventListener('change',()=>{const v=parseMeters(elevationInput.value);if(v!=null&&v>=0&&v<20){el.elevation=v;pushHistory();render();updatePropertiesPanel();}});bindEnterBlur(elevationInput);

    document.getElementById('prop-rot').addEventListener('change',e=>{
      let rot=parseFloat(e.target.value);if(!Number.isFinite(rot))rot=0;
      el.rotation=((rot%360)+360)%360;pushHistory();render();updatePropertiesPanel();
    });

    document.getElementById('prop-snap-wall').addEventListener('click',()=>{
      if(snapObjectToNearestWall(el,Infinity,true)){pushHistory();render();updatePropertiesPanel();}
    });
    document.getElementById('prop-floor').addEventListener('click',()=>{
      if((el.elevation||0)!==0){el.elevation=0;pushHistory();render();updatePropertiesPanel();}
    });

    const ow=document.getElementById('prop-object-w'),oh=document.getElementById('prop-object-h');
    ow.addEventListener('change',()=>{const v=parseMeters(ow.value);if(v>.1){el.w=v;pushHistory();render();updatePropertiesPanel();}}); bindEnterBlur(ow);
    oh.addEventListener('change',()=>{const v=parseMeters(oh.value);if(v>.1){el.h=v;pushHistory();render();updatePropertiesPanel();}}); bindEnterBlur(oh);
    const oc=document.getElementById('prop-color');oc.addEventListener('input',()=>{el.color=oc.value;render();});oc.addEventListener('change',()=>pushHistory());
  } else if (el.type==='cota'){
    const length = Math.hypot(el.x2-el.x1, el.y2-el.y1);
    panel.innerHTML = `
      <div class="prop-header">COTA</div>
      <label>Medida<input id="prop-cota-len" type="text" value="${escapeAttr(formatMeters(length))}"></label>
      <div class="prop-actions"><button id="prop-duplicate" class="btn-secondary">Duplicar</button></div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">Excluir</button></div>`;
    const lenInput = document.getElementById('prop-cota-len');
    lenInput.addEventListener('change', ()=>{
      const newLen = parseMeters(lenInput.value);
      if (newLen && newLen>0.02){
        const ratio = newLen/length;
        el.x2 = el.x1+(el.x2-el.x1)*ratio; el.y2 = el.y1+(el.y2-el.y1)*ratio;
        pushHistory(); render(); updatePropertiesPanel();
      }
    });
    bindEnterBlur(lenInput);
  }
  const mirrorBtn = document.getElementById('prop-mirror');
  if (mirrorBtn) mirrorBtn.addEventListener('click', ()=>{
    if (!mirrorState.xActive && !mirrorState.yActive){ alert('Ative o espelhamento em X ou Y na barra lateral primeiro.'); return; }
    const created = addMirroredCopiesFor(el);
    if (created.length){ selectedId = created[0].id; pushHistory(); render(); updatePropertiesPanel(); }
  });
  document.getElementById('prop-duplicate').addEventListener('click', ()=>duplicateElement(el.id));
  document.getElementById('prop-delete').addEventListener('click', ()=>deleteElement(el.id));
}

/* ===== Editor de texto embutido ===== */
function openTextEditor(worldX, worldY, existingId){
  const overlay = document.getElementById('text-editor-overlay');
  const input = document.getElementById('text-editor-input');
  const screenPt = toScreen(worldX, worldY);
  overlay.style.left = screenPt.x+'px';
  overlay.style.top = (screenPt.y-14)+'px';
  overlay.classList.remove('hidden');
  input.value = existingId ? (getElement(existingId).content||'') : '';
  setTimeout(()=>{ input.focus(); input.select(); }, 0);

  let committed = false;
  function finish(save){
    if (committed) return;
    committed = true;
    overlay.classList.add('hidden');
    input.removeEventListener('keydown', onKey);
    input.removeEventListener('blur', onBlur);
    if (save){
      const val = input.value.trim();
      if (existingId){
        if (val){ getElement(existingId).content = val; pushHistory(); }
      } else if (val){
        const newEl = addText(worldX, worldY, val);
        addMirroredCopiesFor(newEl);
        pushHistory();
      }
    }
    tool = 'select';
    updateToolButtons();
    render();
    updatePropertiesPanel();
  }
  function onKey(e){
    if (e.key==='Enter'){ e.preventDefault(); finish(true); }
    else if (e.key==='Escape'){ finish(false); }
  }
  function onBlur(){ finish(true); }
  input.addEventListener('keydown', onKey);
  input.addEventListener('blur', onBlur);
}

/* ===== Zoom / pan ===== */
function updateZoomLabel(){
  document.getElementById('zoom-label').textContent = Math.round(view.pxPerMeter/60*100)+'%';
}
function zoomBy(factor){
  const wrap = document.getElementById('canvas-wrap');
  const cx = wrap.clientWidth/2, cy = wrap.clientHeight/2;
  const worldBefore = toWorld(cx,cy);
  view.pxPerMeter = Math.max(8, Math.min(400, view.pxPerMeter*factor));
  view.panX = cx - worldBefore.x*view.pxPerMeter;
  view.panY = cy - worldBefore.y*view.pxPerMeter;
  updateZoomLabel(); render();
}
function fitView(){
  const wrap = document.getElementById('canvas-wrap');
  const cw = wrap.clientWidth, ch = wrap.clientHeight;
  if (state.elements.length===0){
    view.pxPerMeter=60; view.panX=cw/2-2.5*60; view.panY=ch/2-2.5*60; return;
  }
  const b = computeContentBBox();
  const bw = Math.max(0.5,b.maxX-b.minX), bh = Math.max(0.5,b.maxY-b.minY);
  const scaleX = (cw-140)/bw, scaleY = (ch-140)/bh;
  view.pxPerMeter = Math.max(8, Math.min(scaleX, scaleY, 200));
  view.panX = cw/2 - (b.minX+bw/2)*view.pxPerMeter;
  view.panY = ch/2 - (b.minY+bh/2)*view.pxPerMeter;
}
function resizeSVG(){
  if (!document.getElementById('screen-editor').classList.contains('active')) return;
  const wrap = document.getElementById('canvas-wrap');
  svgEl.setAttribute('width', wrap.clientWidth);
  svgEl.setAttribute('height', wrap.clientHeight);
  render();
}

/* ===== Ferramentas ===== */
function updateToolButtons(){
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
    btn.classList.toggle('active', btn.dataset.tool===tool);
  });
  document.querySelectorAll('.asset-btn').forEach(btn=>btn.classList.toggle('active',tool==='object'&&btn.dataset.kind===selectedAssetKind));
  svgEl.style.cursor = tool==='select' ? 'default' : 'crosshair';
}
function clearDrafts(){ wallDraft=null; cotaDraft=null; roomDraft=null; }
function activateTool(nextTool){
  tool=nextTool; selectedAssetKind=null; clearDrafts(); updateToolButtons(); render();
}
document.querySelectorAll('.tool-btn[data-tool]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    activateTool(btn.dataset.tool);
  });
});
function assetIcon(kind){
  const icons={
    sofa:'<rect x="3" y="8" width="18" height="10" rx="3"/><path d="M6 8V5h12v3M8 8v10m8-10v10M4 18v2m16-2v2"/>',
    bed:'<rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M6 6h5v3H6zM3 19v2m18-2v2"/>',
    table:'<rect x="5" y="7" width="14" height="10" rx="2"/><circle cx="3" cy="9" r="2"/><circle cx="21" cy="9" r="2"/><circle cx="3" cy="15" r="2"/><circle cx="21" cy="15" r="2"/>',
    desk:'<rect x="3" y="5" width="18" height="14" rx="1"/><rect x="7" y="8" width="10" height="6" rx="1"/><path d="M12 14v4"/>',
    toilet:'<path d="M7 3h10v5H7zM8 8h8c1 5-1 10-4 10s-5-5-4-10Z"/><path d="M9 18h6v3H9z"/>',
    sink:'<rect x="3" y="5" width="18" height="14" rx="2"/><ellipse cx="12" cy="12" rx="6" ry="4"/><circle cx="12" cy="12" r="1"/>',
    plant:'<circle cx="12" cy="12" r="8"/><path d="M12 12V4m0 8 6-5m-6 5 7 4m-7-4v8m0-8-7 5m7-5-7-5"/>',
    pool:'<rect x="2" y="5" width="20" height="14" rx="5"/><path d="M5 10c2-2 4 2 6 0s4 2 7 0M5 14c2-2 4 2 6 0s4 2 7 0"/>',
    tree:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6m0 6v6M3 12h6m6 0h6M6 6l4 4m4 4 4 4m0-12-4 4m-4 4-4 4"/>',
    car:'<rect x="6" y="2" width="12" height="20" rx="4"/><path d="M7 7h10M7 16h10M9 8h6v7H9z"/>',
    grill:'<circle cx="12" cy="10" r="7"/><path d="M5 10h14M8 16l-2 6m10-6 2 6"/>',
    fridge:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M16 5v3m0 5v5"/>',
    stove:'<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><rect x="7" y="12" width="10" height="6" rx="1"/>',
    counter:'<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M9 10v9m6-9v9"/>',
    wardrobe:'<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M12 3v18M10 12h1m2 0h1"/>',
    tv:'<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M9 21h6M12 17v4"/>',
    column:'<rect x="7" y="3" width="10" height="18"/><path d="M5 3h14M5 21h14"/>',
    halfwall:'<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M2 8h20"/>',
    slidingGate:'<rect x="2" y="5" width="20" height="14"/><path d="M7 5v14m5-14v14m5-14v14M3 21h18"/>',
    doubleGate:'<rect x="2" y="5" width="20" height="14"/><path d="M12 5v14M3 6l8 12M21 6l-8 12"/>',
    pedestrianGate:'<rect x="6" y="3" width="12" height="18"/><path d="M9 3v18m6-18v18M14.5 12h1"/>',
    pergola:'<path d="M4 21V7m16 14V7M2 7h20M5 3v8m5-8v8m5-8v8m5-8v8"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind]||icons.table}</svg>`;
}
function renderAssetLibrary(category){
  const grid=document.getElementById('asset-grid');grid.innerHTML='';
  assetLibrary.filter(a=>a.category===category).forEach(asset=>{
    const btn=document.createElement('button');btn.className='asset-btn';btn.dataset.kind=asset.kind;btn.title=`Adicionar ${asset.label}`;
    btn.innerHTML=assetIcon(asset.kind)+`<span>${escapeHTML(asset.label)}</span>`;
    btn.addEventListener('click',()=>{selectedAssetKind=asset.kind;selectedAssetCategory=asset.category;selectedAssetLabel=asset.label;tool='object';clearDrafts();updateToolButtons();});
    grid.appendChild(btn);
  });
  updateToolButtons();
}
let selectedAssetCategory='interior',selectedAssetLabel='Item';
document.querySelectorAll('.library-tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.library-tab').forEach(b=>b.classList.toggle('active',b===btn));renderAssetLibrary(btn.dataset.category);
}));
renderAssetLibrary('interior');

/* ===== Interação no canvas ===== */
svgEl.addEventListener('mousedown', (e)=>{
  const rect = svgEl.getBoundingClientRect();
  const sx = e.clientX-rect.left, sy = e.clientY-rect.top;
  const worldPt = toWorld(sx,sy);

  if (tool==='wall'){
    const snapped = snapPoint(worldPt.x, worldPt.y);
    if (!wallDraft){
      wallDraft = { lastPoint:snapped, previewPoint:snapped };
    } else {
      const newWall = addWall(wallDraft.lastPoint.x, wallDraft.lastPoint.y, snapped.x, snapped.y);
      if (newWall) addMirroredCopiesFor(newWall);
      wallDraft.lastPoint = snapped;
      pushHistory();
    }
    render();
    return;
  }
  if (tool==='cota'){
    const snapped = snapPoint(worldPt.x, worldPt.y);
    if (!cotaDraft){
      cotaDraft = { startPoint:snapped, previewPoint:snapped };
    } else {
      addCota(cotaDraft.startPoint.x, cotaDraft.startPoint.y, snapped.x, snapped.y);
      cotaDraft = null;
      pushHistory();
      tool='select'; updateToolButtons();
    }
    render();
    return;
  }
  if (tool==='room'){
    const snapped = snapPoint(worldPt.x, worldPt.y);
    roomDraft = { startX:snapped.x, startY:snapped.y, curX:snapped.x, curY:snapped.y };
    render();
    return;
  }
  if (tool==='door' || tool==='window'){
    const nearest = findNearestWall(worldPt.x, worldPt.y, 25/view.pxPerMeter);
    let x,y,angle,thickness;
    if (nearest){ x=nearest.x; y=nearest.y; angle=Math.atan2(nearest.wall.y2-nearest.wall.y1, nearest.wall.x2-nearest.wall.x1)*180/Math.PI; thickness=nearest.wall.thickness; }
    else { x=worldPt.x; y=worldPt.y; angle=0; thickness=0.15; }
    const newEl = tool==='door' ? addDoor(x,y,angle,thickness) : addWindow(x,y,angle,thickness);
    addMirroredCopiesFor(newEl);
    selectedId = newEl.id;
    pushHistory(); updatePropertiesPanel();
    tool='select'; updateToolButtons();
    render();
    return;
  }
  if (tool==='text'){
    openTextEditor(worldPt.x, worldPt.y);
    return;
  }
  if (tool==='object'){
    const asset=assetLibrary.find(a=>a.kind===selectedAssetKind&&a.category===selectedAssetCategory) || assetLibrary.find(a=>a.kind===selectedAssetKind);
    if(asset){const snapped=snapPoint(worldPt.x,worldPt.y);const newEl=addObject(snapped.x,snapped.y,asset.kind,selectedAssetLabel,asset.category,asset.w,asset.h);newEl.elevation=asset.elevation||0;selectedId=newEl.id;pushHistory();updatePropertiesPanel();render();}
    return;
  }

  // ferramenta Selecionar
  const axisHit = hitTestMirrorAxis(sx,sy);
  if (axisHit){
    dragInfo = { mode:'mirror-axis', axis:axisHit };
    return;
  }
  const hit = hitTest(sx,sy);
  if (hit){
    selectedId = hit.id;
    const el = getElement(hit.id);
    if (hit.handle){
      if (hit.handle.startsWith('room-')){
        const corner = hit.handle.slice(5);
        let fixedX, fixedY;
        if (corner==='tl'){ fixedX=el.x+el.w; fixedY=el.y+el.h; }
        else if (corner==='tr'){ fixedX=el.x; fixedY=el.y+el.h; }
        else if (corner==='bl'){ fixedX=el.x+el.w; fixedY=el.y; }
        else { fixedX=el.x; fixedY=el.y; }
        dragInfo = { mode:'resize', id:hit.id, handle:hit.handle, fixed:{x:fixedX,y:fixedY} };
      } else {
        dragInfo = { mode:'resize', id:hit.id, handle:hit.handle };
      }
    } else {
      dragInfo = { mode:'move', id:hit.id, startWorld:worldPt, orig:JSON.parse(JSON.stringify(el)) };
    }
  } else {
    selectedId = null;
    dragInfo = { mode:'pan', startClientX:e.clientX, startClientY:e.clientY, startPan:{x:view.panX,y:view.panY} };
  }
  updatePropertiesPanel();
  render();
});

svgEl.addEventListener('mousemove', (e)=>{
  const rect = svgEl.getBoundingClientRect();
  const sx = e.clientX-rect.left, sy = e.clientY-rect.top;
  const worldPt = toWorld(sx,sy);

  if (tool==='wall' && wallDraft){ wallDraft.previewPoint = snapPoint(worldPt.x, worldPt.y); render(); return; }
  if (tool==='cota' && cotaDraft){ cotaDraft.previewPoint = snapPoint(worldPt.x, worldPt.y); render(); return; }
  if (tool==='room' && roomDraft){
    const snapped = snapPoint(worldPt.x, worldPt.y);
    roomDraft.curX = snapped.x; roomDraft.curY = snapped.y;
    render(); return;
  }

  if (!dragInfo){
    if (tool==='select'){
      const hover = hitTest(sx,sy);
      svgEl.style.cursor = hover ? (hover.handle ? 'pointer' : 'move') : (hitTestMirrorAxis(sx,sy) ? 'ew-resize' : 'default');
    }
    return;
  }
  if (dragInfo.mode==='pan'){
    view.panX = dragInfo.startPan.x + (e.clientX-dragInfo.startClientX);
    view.panY = dragInfo.startPan.y + (e.clientY-dragInfo.startClientY);
    render();
  } else if (dragInfo.mode==='mirror-axis'){
    if (dragInfo.axis==='x') mirrorState.axisX = worldPt.x; else mirrorState.axisY = worldPt.y;
    render();
  } else if (dragInfo.mode==='move'){
    const el = getElement(dragInfo.id); if (!el) return;
    const dx = worldPt.x-dragInfo.startWorld.x, dy = worldPt.y-dragInfo.startWorld.y;
    if ('x1' in dragInfo.orig){
      el.x1=dragInfo.orig.x1+dx; el.y1=dragInfo.orig.y1+dy;
      el.x2=dragInfo.orig.x2+dx; el.y2=dragInfo.orig.y2+dy;
    } else if ('x' in dragInfo.orig){
      el.x=dragInfo.orig.x+dx; el.y=dragInfo.orig.y+dy;
    }
    render();
  } else if (dragInfo.mode==='resize'){
    const el = getElement(dragInfo.id); if (!el) return;
    if (dragInfo.handle==='p1' || dragInfo.handle==='p2'){
      const snapped = snapPoint(worldPt.x, worldPt.y, dragInfo.id);
      if (dragInfo.handle==='p1'){ el.x1=snapped.x; el.y1=snapped.y; } else { el.x2=snapped.x; el.y2=snapped.y; }
    } else if (dragInfo.handle && dragInfo.handle.startsWith('room-')){
      const snapped = snapPoint(worldPt.x, worldPt.y);
      const fx=dragInfo.fixed.x, fy=dragInfo.fixed.y;
      el.x = Math.min(fx,snapped.x); el.y = Math.min(fy,snapped.y);
      el.w = Math.max(0.1, Math.abs(snapped.x-fx)); el.h = Math.max(0.1, Math.abs(snapped.y-fy));
    }
    render();
  }
});

window.addEventListener('mouseup', ()=>{
  if (tool==='room' && roomDraft){
    const x=Math.min(roomDraft.startX,roomDraft.curX), y=Math.min(roomDraft.startY,roomDraft.curY);
    const w=Math.abs(roomDraft.curX-roomDraft.startX), h=Math.abs(roomDraft.curY-roomDraft.startY);
    if (w>0.15 && h>0.15){
      const newEl = addRoom(x,y,w,h,'Cômodo');
      addMirroredCopiesFor(newEl);
      selectedId = newEl.id;
      pushHistory(); updatePropertiesPanel();
      tool='select'; updateToolButtons();
    }
    roomDraft = null;
    render();
    return;
  }
  if (dragInfo && dragInfo.mode!=='pan' && dragInfo.mode!=='mirror-axis'){ pushHistory(); updatePropertiesPanel(); }
  dragInfo = null;
});

svgEl.addEventListener('dblclick', (e)=>{
  if (tool!=='select') return;
  const rect = svgEl.getBoundingClientRect();
  const sx = e.clientX-rect.left, sy = e.clientY-rect.top;
  for (let i=state.elements.length-1;i>=0;i--){
    const el = state.elements[i];
    if (el.type==='text' && hitTestText(sx,sy,el)){ openTextEditor(el.x, el.y, el.id); return; }
  }
});

svgEl.addEventListener('wheel', (e)=>{
  e.preventDefault();
  if (e.ctrlKey || e.metaKey){
    const rect = svgEl.getBoundingClientRect();
    const sx = e.clientX-rect.left, sy = e.clientY-rect.top;
    const worldBefore = toWorld(sx,sy);
    const factor = e.deltaY<0 ? 1.1 : 1/1.1;
    view.pxPerMeter = Math.max(8, Math.min(400, view.pxPerMeter*factor));
    view.panX = sx - worldBefore.x*view.pxPerMeter;
    view.panY = sy - worldBefore.y*view.pxPerMeter;
  } else {
    view.panX -= e.deltaX;
    view.panY -= e.deltaY;
  }
  updateZoomLabel(); render();
}, {passive:false});

/* ===== Atalhos de teclado ===== */
window.addEventListener('keydown', (e)=>{
  if (!document.getElementById('screen-editor').classList.contains('active')) return;
  if(e.key==='Escape'&&!document.getElementById('unsaved-modal').classList.contains('hidden')){closeUnsavedDialog();return;}
  if(e.key==='Escape'&&!document.getElementById('export-modal').classList.contains('hidden')){document.getElementById('export-modal').classList.add('hidden');return;}
  const reloadShortcut=e.key==='F5'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r');
  if(reloadShortcut&&unsavedChanges){e.preventDefault();closeExportModal();openUnsavedDialog('reload');return;}
  const activeTag = document.activeElement.tagName;
  if (activeTag==='INPUT' || activeTag==='TEXTAREA'){
    if (e.key==='Escape') document.activeElement.blur();
    return;
  }
  const mod = e.ctrlKey||e.metaKey;
  if (mod && e.key.toLowerCase()==='z'){ e.preventDefault(); undo(); }
  else if (mod && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase()==='s'){ e.preventDefault(); saveProject(true); }
  else if (mod && e.key.toLowerCase()==='c'){ if (selectedId){ clipboard = JSON.parse(JSON.stringify(getElement(selectedId))); } }
  else if (mod && e.key.toLowerCase()==='v'){ if (clipboard) pasteClipboard(); }
  else if (e.key==='Delete' || e.key==='Backspace'){ if (selectedId){ e.preventDefault(); deleteElement(selectedId); } }
  else if (e.shiftKey && e.key.toLowerCase()==='r'){ if (selectedId) rotateElement(selectedId, 90); }
  else if (!mod && !e.altKey){
    const shortcutTools={q:'select',w:'wall',e:'door',r:'window',t:'room',y:'cota',u:'text'};
    const nextTool=shortcutTools[e.key.toLowerCase()];
    if(nextTool){e.preventDefault();activateTool(nextTool);}
    else if (e.key==='Escape'){ activateTool('select'); }
  }
  else if (e.key==='Escape'){ clearDrafts(); tool='select'; updateToolButtons(); render(); }
});

/* ===== Navegação entre telas ===== */
function startNewProject(){
  state = { projectId:null, projectName:'Novo projeto', elements:[], gridSpacing:0.5, gridOn:true, blueprintOn:false, palette:'technical', view3d:null };
  selectedId = null;
  mirrorState = { xActive:false, yActive:false, axisX:null, axisY:null };
  view = { pxPerMeter:60, panX:80, panY:80 };
}
function goToEditor(){
  document.getElementById('screen-home').classList.remove('active');
  document.getElementById('screen-editor').classList.add('active');
  document.getElementById('project-name-input').value = state.projectName;
  document.getElementById('grid-toggle').checked = state.gridOn;
  document.getElementById('grid-spacing').value = Math.round(state.gridSpacing*100);
  document.getElementById('mirror-x-toggle').checked = mirrorState.xActive;
  document.getElementById('mirror-y-toggle').checked = mirrorState.yActive;
  document.getElementById('blueprint-toggle').checked = !!state.blueprintOn;
  applyProjectAppearance();
  tool = 'select'; updateToolButtons();
  unsavedChanges = !state.projectId; updateSaveButton();
  selectedId = null;
  history = [snapshotElements()]; historyIndex = 0;
  requestAnimationFrame(()=>{
    resizeSVG();
    fitView();
    updateZoomLabel();
    render();
    updatePropertiesPanel();
    // Restaura a visualização 3D salva do projeto. Em projetos antigos,
    // sem esse campo, o editor simplesmente começa em 2D e calcula a
    // câmera quando o usuário entrar no 3D pela primeira vez.
    if(typeof window.restore3DViewState==='function'){
      window.restore3DViewState(state.view3d,{restoreMode:true});
    }
  });
}
function goHome(){
  document.getElementById('screen-editor').classList.remove('active');
  document.getElementById('screen-home').classList.add('active');
  document.body.classList.remove('blueprint-mode');
  renderHomeScreen();
}
async function openProject(id){
  const ok = await loadProjectData(id);
  if (!ok){ alert('Não foi possível abrir esse projeto.'); return; }
  mirrorState = { xActive:false, yActive:false, axisX:null, axisY:null };
  view = { pxPerMeter:60, panX:80, panY:80 };
  goToEditor();
}

function applyProjectAppearance(){
  document.body.classList.toggle('blueprint-mode',!!state.blueprintOn);
  const p=getPalette();
  document.body.style.setProperty('--room-fill',p.room);
  document.body.style.setProperty('--object-fill',p.object);
  document.body.style.setProperty('--object-stroke',p.stroke);
  document.querySelectorAll('.palette-option').forEach(btn=>btn.classList.toggle('active',btn.dataset.palette===(state.palette||'technical')));
  const status=document.getElementById('status-mode');status.lastChild.textContent=state.blueprintOn?' Modo Blueprint':' Edição normal';
}
function setDarkMode(active,savePreference){
  document.body.classList.toggle('dark-mode',active);
  document.querySelectorAll('.theme-toggle').forEach(btn=>{
    btn.setAttribute('aria-pressed',String(active));
    btn.setAttribute('aria-label',active?'Ativar modo claro':'Ativar modo escuro');
    btn.title=active?'Ativar modo claro':'Ativar modo escuro';
  });
  applyProjectAppearance();
  if(document.getElementById('screen-editor').classList.contains('active')) render();
  if(typeof window.refresh3DView==='function') window.refresh3DView();
  if(savePreference){try{localStorage.setItem('visual-maker-theme',active?'dark':'light');}catch(e){/* preferência não persistida */}}
}
function applyStoredTheme(){
  let preference=null;try{preference=localStorage.getItem('visual-maker-theme');}catch(e){/* usa preferência do sistema */}
  setDarkMode(preference?preference==='dark':window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches,false);
}

/* ===== Exportar PNG / SVG ===== */
function exportThemeColors(mode){
  const blueprint=mode==='blueprint';
  if(blueprint){
    return {blueprint:true,bg:'#0B4380',ink:'#FFFFFF',muted:'#9FD6FF',room:'#1B5A94',objectFill:'#0D4A88',objectStroke:'#E1F4FF',grid:'#16528E'};
  }
  const dark=mode==='dark',p=getPalette(dark?'dark':'light');
  return dark
    ? {blueprint:false,bg:'#20262D',ink:'#E9EEF4',muted:'#9AA8B7',room:p.room,objectFill:p.object,objectStroke:p.stroke,grid:'#2C353F'}
    : {blueprint:false,bg:'#FFFFFF',ink:'#1B2430',muted:'#667080',room:p.room,objectFill:p.object,objectStroke:p.stroke,grid:'#E0E5E8'};
}
function buildExportSVG(bbox, pad, ppm, mode){
  const w=(bbox.maxX-bbox.minX+pad*2)*ppm, h=(bbox.maxY-bbox.minY+pad*2)*ppm;
  const ox=-bbox.minX+pad, oy=-bbox.minY+pad;
  const c=exportThemeColors(mode),blueprint=c.blueprint;
  const {bg,ink,muted,room,objectFill,objectStroke}=c;
  let parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`, `<rect width="${w}" height="${h}" fill="${bg}"/>`];
  if(!blueprint){
    const defs=[];
    state.elements.filter(e=>e.type==='room'&&(e.material||'solid')!=='solid').forEach((r,i)=>{
      const id=`floor-pattern-${i}`;r.__exportPatternId=id;
      const base=floorMaterialBase(r,mode==='dark'?'dark':'light');
      if(r.material==='wood') defs.push(`<pattern id="${id}" width="60" height="18" patternUnits="userSpaceOnUse"><rect width="60" height="18" fill="${base}"/><path d="M0 0H60M0 18H60M30 0V18" stroke="${objectStroke}" stroke-opacity=".28" stroke-width="1"/></pattern>`);
      else if(r.material==='tile') defs.push(`<pattern id="${id}" width="42" height="42" patternUnits="userSpaceOnUse"><rect width="42" height="42" fill="${base}"/><path d="M0 0H42V42H0Z" fill="none" stroke="${objectStroke}" stroke-opacity=".30" stroke-width="1"/></pattern>`);
      else if(r.material==='concrete') defs.push(`<pattern id="${id}" width="34" height="34" patternUnits="userSpaceOnUse"><rect width="34" height="34" fill="${base}"/><circle cx="8" cy="10" r="1.4" fill="${objectStroke}" fill-opacity=".18"/><circle cx="25" cy="22" r="1" fill="${objectStroke}" fill-opacity=".14"/><path d="M4 27l7-3m12-16 6-2" stroke="${objectStroke}" stroke-opacity=".13"/></pattern>`);
      else if(r.material==='grass') defs.push(`<pattern id="${id}" width="28" height="28" patternUnits="userSpaceOnUse"><rect width="28" height="28" fill="${base}"/><path d="M5 23l2-7 2 7m7 0 2-9 2 9M10 9l2-5 2 5" stroke="#315D35" stroke-opacity=".55" stroke-width="1.1" fill="none"/></pattern>`);
    });
    if(defs.length) parts.push(`<defs>${defs.join('')}</defs>`);
  }
  if(blueprint){for(let x=0;x<=w;x+=ppm/2)parts.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${c.grid}" stroke-width="1"/>`);for(let y=0;y<=h;y+=ppm/2)parts.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${c.grid}" stroke-width="1"/>`);}
  for (const el of state.elements){
    if (el.type!=='room') continue;
    const x=(el.x+ox)*ppm, y=(el.y+oy)*ppm, ww=el.w*ppm, hh=el.h*ppm;
    const roomFill=(!blueprint&&el.__exportPatternId)?`url(#${el.__exportPatternId})`:(el.color||room);
    parts.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${roomFill}" fill-opacity="${el.__exportPatternId?'0.82':'0.42'}"/>`);
    parts.push(`<text x="${x+ww/2}" y="${y+hh/2-4}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-weight="600" font-size="${Math.max(12,ppm*0.14)}" fill="${ink}">${escapeXML(el.name)}</text>`);
    parts.push(`<text x="${x+ww/2}" y="${y+hh/2+14}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="${Math.max(10,ppm*0.11)}" fill="${muted}">${(el.w*el.h).toFixed(2).replace('.',',')} m²</text>`);
  }
  for (const el of state.elements){
    if (el.type!=='wall') continue;
    const x1=(el.x1+ox)*ppm, y1=(el.y1+oy)*ppm, x2=(el.x2+ox)*ppm, y2=(el.y2+oy)*ppm;
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${el.thickness*ppm}" stroke-linecap="square"/>`);
  }
  for (const el of state.elements){
    if (el.type!=='door' && el.type!=='window') continue;
    const x=(el.x+ox)*ppm, y=(el.y+oy)*ppm, wpx=el.width*ppm, tpx=(el.wallThickness||0.15)*ppm;
    parts.push(`<g transform="translate(${x} ${y}) rotate(${el.angle||0})">`);
    parts.push(`<rect x="${-wpx/2}" y="${-tpx/2-1}" width="${wpx}" height="${tpx+2}" fill="${bg}"/>`);
    if (el.type==='door'){
      parts.push(`<line x1="${-wpx/2}" y1="0" x2="${-wpx/2}" y2="${-wpx}" stroke="${ink}" stroke-width="2"/>`);
      parts.push(`<path d="M ${-wpx/2} ${-wpx} A ${wpx} ${wpx} 0 0 1 ${wpx/2} 0" fill="none" stroke="${muted}" stroke-width="1" stroke-dasharray="3 3"/>`);
    } else {
      parts.push(`<line x1="${-wpx/2}" y1="${-tpx/4}" x2="${wpx/2}" y2="${-tpx/4}" stroke="${muted}" stroke-width="2"/>`);
      parts.push(`<line x1="${-wpx/2}" y1="${tpx/4}" x2="${wpx/2}" y2="${tpx/4}" stroke="${muted}" stroke-width="2"/>`);
    }
    parts.push('</g>');
  }
  for(const el of state.elements.filter(e=>e.type==='object')){
    const x=(el.x+ox)*ppm,y=(el.y+oy)*ppm,ww=(el.w||1)*ppm,hh=(el.h||1)*ppm;
    parts.push(`<g transform="translate(${x} ${y}) rotate(${el.rotation||0})"><rect x="${-ww/2}" y="${-hh/2}" width="${ww}" height="${hh}" rx="${Math.min(8,hh*.12)}" fill="${el.color||objectFill}" stroke="${objectStroke}" stroke-width="1.5"/>`);
    if(el.kind==='bed')parts.push(`<line x1="${-ww/2}" y1="${-hh*.2}" x2="${ww/2}" y2="${-hh*.2}" stroke="${objectStroke}"/><rect x="${-ww*.38}" y="${-hh*.42}" width="${ww*.32}" height="${hh*.18}" rx="3" fill="none" stroke="${objectStroke}"/><rect x="${ww*.06}" y="${-hh*.42}" width="${ww*.32}" height="${hh*.18}" rx="3" fill="none" stroke="${objectStroke}"/>`);
    else if(el.kind==='pool')parts.push(`<path d="M ${-ww*.38} -10 Q ${-ww*.18} -15 0 -10 T ${ww*.38} -10 M ${-ww*.38} 10 Q ${-ww*.18} 5 0 10 T ${ww*.38} 10" fill="none" stroke="${objectStroke}"/>`);
    else parts.push(`<line x1="${-ww*.3}" y1="0" x2="${ww*.3}" y2="0" stroke="${objectStroke}"/><line x1="0" y1="${-hh*.3}" x2="0" y2="${hh*.3}" stroke="${objectStroke}"/>`);
    parts.push('</g>');
  }
  for (const el of state.elements){
    if (el.type!=='cota') continue;
    const geo = cotaGeometry(el); if (!geo) continue;
    const ax1=(geo.a1.x+ox)*ppm, ay1=(geo.a1.y+oy)*ppm, ax2=(geo.a2.x+ox)*ppm, ay2=(geo.a2.y+oy)*ppm;
    const e1x=(el.x1+ox)*ppm, e1y=(el.y1+oy)*ppm, e2x=(el.x2+ox)*ppm, e2y=(el.y2+oy)*ppm;
    parts.push(`<line x1="${e1x}" y1="${e1y}" x2="${ax1}" y2="${ay1}" stroke="${muted}" stroke-width="1"/>`);
    parts.push(`<line x1="${e2x}" y1="${e2y}" x2="${ax2}" y2="${ay2}" stroke="${muted}" stroke-width="1"/>`);
    parts.push(`<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="${muted}" stroke-width="1.2"/>`);
    parts.push(`<text x="${(ax1+ax2)/2}" y="${(ay1+ay2)/2-5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="${muted}">${escapeXML(formatMeters(geo.len))}</text>`);
  }
  if(blueprint){for(const el of state.elements.filter(e=>e.type==='wall')){const dx=el.x2-el.x1,dy=el.y2-el.y1,len=Math.hypot(dx,dy);if(len<.02)continue;const nx=-dy/len,ny=dx/len,off=.34;const x1=(el.x1+nx*off+ox)*ppm,y1=(el.y1+ny*off+oy)*ppm,x2=(el.x2+nx*off+ox)*ppm,y2=(el.y2+ny*off+oy)*ppm,ex1=(el.x1+ox)*ppm,ey1=(el.y1+oy)*ppm,ex2=(el.x2+ox)*ppm,ey2=(el.y2+oy)*ppm,mx=(x1+x2)/2,my=(y1+y2)/2,label=escapeXML(formatMeters(len));parts.push(`<line x1="${ex1}" y1="${ey1}" x2="${x1}" y2="${y1}" stroke="${muted}"/><line x1="${ex2}" y1="${ey2}" x2="${x2}" y2="${y2}" stroke="${muted}"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${muted}"/><rect x="${mx-34}" y="${my-13}" width="68" height="17" rx="2" fill="${bg}"/><text x="${mx}" y="${my}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="11" fill="${muted}">${label}</text>`);}}
  for (const el of state.elements){
    if (el.type!=='text') continue;
    const x=(el.x+ox)*ppm, y=(el.y+oy)*ppm;
    const isDefaultText=!el.color||String(el.color).toLowerCase()==='#1b2430';
    const textColor=blueprint?ink:((mode==='dark'&&isDefaultText)?ink:(el.color||ink));
    parts.push(`<text x="${x}" y="${y}" font-family="IBM Plex Sans, sans-serif" font-size="${el.size||16}" font-weight="${el.bold?700:400}" fill="${textColor}" transform="rotate(${el.rotation||0} ${x} ${y})">${escapeXML(el.content)}</text>`);
  }
  const totalArea = state.elements.filter(e=>e.type==='room').reduce((s,r)=>s+r.w*r.h,0);
  const footer = totalArea>0 ? `Visual Maker · Área total ${totalArea.toFixed(2).replace('.',',')} m²` : `Visual Maker · ${state.elements.filter(e=>e.type==='wall').length} paredes`;
  parts.push(`<text x="10" y="${h-10}" font-family="IBM Plex Mono, monospace" font-size="11" fill="${muted}">${escapeXML(footer)}</text>`);
  parts.push('</svg>');
  state.elements.filter(e=>e.type==='room').forEach(r=>{if('__exportPatternId' in r) delete r.__exportPatternId;});
  return parts.join('');
}
function exportPNG(mode){
  if (state.elements.length===0){ alert('Adicione ao menos uma parede antes de exportar.'); return; }
  const bbox = computeContentBBox();
  const ppm = 100;
  const svgBlob = new Blob([buildExportSVG(bbox,1.1,ppm,mode)], {type:'image/svg+xml;charset=utf-8'});
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  img.onload = ()=>{
    const w = (bbox.maxX-bbox.minX+2.2)*ppm, h = (bbox.maxY-bbox.minY+2.2)*ppm;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = exportThemeColors(mode).bg; ctx.fillRect(0,0,w,h);
    ctx.drawImage(img,0,0,w,h);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob)=>{
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const suffix=mode==='blueprint'?'-blueprint':(mode==='dark'?'-escuro':'-claro');
      a.download = safeProjectFilename() + suffix + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
  };
  img.onerror = ()=> alert('Não foi possível gerar a imagem.');
  img.src = url;
}
function safeProjectFilename(){return (state.projectName||'planta').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\- ]/g,'').trim()||'planta';}
function exportSVGFile(mode){
  if(state.elements.length===0){alert('Adicione ao menos uma parede antes de exportar.');return;}
  const blob=new Blob([buildExportSVG(computeContentBBox(),1.1,100,mode)],{type:'image/svg+xml;charset=utf-8'}),a=document.createElement('a');
  const suffix=mode==='blueprint'?'-blueprint':(mode==='dark'?'-escuro':'-claro');
  a.href=URL.createObjectURL(blob);a.download=safeProjectFilename()+suffix+'.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ===== Ligação da interface ===== */
const unsavedModal=document.getElementById('unsaved-modal');
let pendingUnsavedAction='home';
function openUnsavedDialog(action){
  pendingUnsavedAction=action;
  const isReload=action==='reload';
  document.getElementById('unsaved-title').textContent=isReload?'Salvar antes de atualizar?':'Salvar antes de sair?';
  document.getElementById('unsaved-description').textContent=isReload?'Este projeto possui alterações que ainda não foram salvas. Se você atualizar a página agora, elas serão perdidas.':'Este projeto possui alterações que ainda não foram salvas. Se você sair agora, elas serão perdidas.';
  document.getElementById('unsaved-discard').textContent=isReload?'Atualizar sem salvar':'Sair sem salvar';
  document.getElementById('unsaved-save').textContent=isReload?'Salvar e atualizar':'Salvar e sair';
  unsavedModal.classList.remove('hidden');
  requestAnimationFrame(()=>document.getElementById('unsaved-save').focus());
}
function closeUnsavedDialog(){unsavedModal.classList.add('hidden');document.getElementById('btn-home').focus();}
function completeUnsavedAction(){
  const action=pendingUnsavedAction;closeUnsavedDialog();
  if(action==='reload') window.location.reload(); else goHome();
}
document.getElementById('btn-home').addEventListener('click', ()=>{
  if(unsavedChanges){openUnsavedDialog('home');return;}
  goHome();
});
document.getElementById('unsaved-cancel').addEventListener('click',closeUnsavedDialog);
document.getElementById('unsaved-discard').addEventListener('click',()=>{unsavedChanges=false;completeUnsavedAction();});
document.getElementById('unsaved-save').addEventListener('click',async()=>{await saveProject(false);if(!unsavedChanges)completeUnsavedAction();});
unsavedModal.addEventListener('mousedown',e=>{if(e.target===unsavedModal)closeUnsavedDialog();});
window.addEventListener('beforeunload',e=>{if(!unsavedChanges)return;e.preventDefault();e.returnValue='';});
document.getElementById('project-name-input').addEventListener('input', (e)=>{ state.projectName=e.target.value; markUnsaved(); });
document.getElementById('btn-undo').addEventListener('click', undo);
document.getElementById('btn-redo').addEventListener('click', redo);
document.getElementById('btn-save').addEventListener('click', ()=>saveProject(true));
const exportModal=document.getElementById('export-modal');
function closeExportModal(){exportModal.classList.add('hidden');}
document.getElementById('btn-export').addEventListener('click',()=>{const defaultMode=state.blueprintOn?'blueprint':(document.body.classList.contains('dark-mode')?'dark':'light');document.querySelector(`input[name="export-mode"][value="${defaultMode}"]`).checked=true;exportModal.classList.remove('hidden');});
document.getElementById('export-close').addEventListener('click',closeExportModal);
exportModal.addEventListener('mousedown',e=>{if(e.target===exportModal)closeExportModal();});
document.getElementById('export-png').addEventListener('click',()=>{const mode=document.querySelector('input[name="export-mode"]:checked').value;closeExportModal();exportPNG(mode);});
document.getElementById('export-svg').addEventListener('click',()=>{const mode=document.querySelector('input[name="export-mode"]:checked').value;closeExportModal();exportSVGFile(mode);});
document.getElementById('blueprint-toggle').addEventListener('change',e=>{state.blueprintOn=e.target.checked;applyProjectAppearance();markUnsaved();render();});
document.getElementById('theme-toggle').addEventListener('click',()=>setDarkMode(!document.body.classList.contains('dark-mode'),true));
document.getElementById('home-theme-toggle').addEventListener('click',()=>setDarkMode(!document.body.classList.contains('dark-mode'),true));
document.querySelectorAll('.palette-option').forEach(btn=>btn.addEventListener('click',()=>{state.palette=btn.dataset.palette;applyProjectAppearance();markUnsaved();render();if(typeof window.refresh3DView==='function')window.refresh3DView();}));
document.getElementById('zoom-in').addEventListener('click', ()=>zoomBy(1.2));
document.getElementById('zoom-out').addEventListener('click', ()=>zoomBy(1/1.2));
document.getElementById('zoom-fit').addEventListener('click', ()=>{ fitView(); updateZoomLabel(); render(); });
document.getElementById('grid-toggle').addEventListener('change', (e)=>{ state.gridOn=e.target.checked; markUnsaved(); render(); });
document.getElementById('grid-spacing').addEventListener('change', (e)=>{
  const v = parseFloat(e.target.value);
  if (v>0){ state.gridSpacing = v/100; markUnsaved(); render(); }
});
document.getElementById('mirror-x-toggle').addEventListener('change', (e)=>{
  mirrorState.xActive = e.target.checked;
  if (mirrorState.xActive && mirrorState.axisX==null) mirrorState.axisX = defaultMirrorAxisX();
  render();
});
document.getElementById('mirror-y-toggle').addEventListener('change', (e)=>{
  mirrorState.yActive = e.target.checked;
  if (mirrorState.yActive && mirrorState.axisY==null) mirrorState.axisY = defaultMirrorAxisY();
  render();
});
window.addEventListener('resize', resizeSVG);

document.getElementById('btn-create-dims').addEventListener('click', ()=>{
  const w = parseMeters(document.getElementById('new-width').value) || 8;
  const h = parseMeters(document.getElementById('new-height').value) || 10;
  startNewProject();
  createRectFromDims(Math.max(1,w), Math.max(1,h));
  goToEditor();
});
document.getElementById('btn-create-manual').addEventListener('click', ()=>{
  startNewProject();
  goToEditor();
});
document.querySelectorAll('.chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.getElementById('new-width').value = chip.dataset.w;
    document.getElementById('new-height').value = chip.dataset.h;
  });
});

/* ===== Início ===== */
applyStoredTheme();
renderHomeScreen();
