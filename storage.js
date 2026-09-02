/* storage.js
   Salvamento local dos projetos (via window.storage, o armazenamento
   persistente de artefatos do Claude — funciona como o localStorage
   pedido no documento, mas é o que funciona dentro do preview do
   Claude.ai) e a tela inicial "Meus projetos". */

const projectStorage = window.storage || {
  async set(key,value){ localStorage.setItem(key,value); return {key}; },
  async get(key){ const value=localStorage.getItem(key); return value==null?null:{value}; },
  async delete(key){ localStorage.removeItem(key); },
  async list(prefix){ return {keys:Object.keys(localStorage).filter(key=>key.startsWith(prefix))}; }
};

async function saveProject(showFeedback){
  if (!state.projectId) state.projectId = 'p'+Date.now();

  // A visualização 3D também faz parte do projeto. Guardamos apenas
  // dados serializáveis (câmera, alvo, modo e preferência de paredes).
  // A geometria 3D continua sendo reconstruída a partir de elements.
  const current3DView = typeof window.get3DViewState==='function'
    ? window.get3DViewState()
    : (state.view3d||null);
  state.view3d = current3DView;

  const payload = JSON.stringify({
    name:state.projectName,
    elements:state.elements,
    gridSpacing:state.gridSpacing,
    gridOn:state.gridOn,
    blueprintOn:state.blueprintOn,
    palette:state.palette,
    view3d:current3DView,
    updatedAt:Date.now()
  });
  try{
    await projectStorage.set('project:'+state.projectId, payload);
    unsavedChanges = false;
    if (showFeedback) flashSaveIndicator(); else updateSaveButton();
  } catch(err){
    console.error('Erro ao salvar projeto', err);
    if (showFeedback) alert(t('couldNotSaveProject'));
  }
}
async function listProjects(){
  try{
    const res = await projectStorage.list('project:');
    if (!res || !res.keys) return [];
    const out = [];
    for (const key of res.keys){
      try{
        const r = await projectStorage.get(key);
        if (r && r.value){
          const data = JSON.parse(r.value);
          out.push({ id:key.slice('project:'.length), name:data.name||t('untitled'), updatedAt:data.updatedAt||0 });
        }
      } catch(e){ /* registro corrompido: ignora */ }
    }
    out.sort((a,b)=>b.updatedAt-a.updatedAt);
    return out;
  } catch(err){
    console.error('Erro ao listar projetos', err);
    return [];
  }
}
async function loadProjectData(id){
  try{
    const r = await projectStorage.get('project:'+id);
    if (!r || !r.value) return false;
    const data = JSON.parse(r.value);
    state.projectId = id;
    state.projectName = data.name || t('untitled');
    state.elements = data.elements || [];
    state.gridSpacing = data.gridSpacing || 0.5;
    state.gridOn = data.gridOn!==false;
    state.blueprintOn = !!data.blueprintOn;
    state.palette = data.palette || 'technical';
    state.view3d = data.view3d || null;
    return true;
  } catch(err){
    console.error('Erro ao carregar projeto', err);
    return false;
  }
}
async function deleteProjectData(id){
  try{ await projectStorage.delete('project:'+id); return true; }
  catch(err){ console.error('Erro ao excluir projeto', err); return false; }
}

async function renderHomeScreen(){
  const listEl = document.getElementById('projects-list');
  listEl.innerHTML = `<p class="loading-text">${t('loading')}</p>`;
  const projects = await listProjects();
  if (projects.length===0){
    listEl.innerHTML = `<p class="empty-text">${t('noSavedProjects')}</p>`;
    return;
  }
  listEl.innerHTML = '';
  for (const p of projects){
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
      <div class="project-card-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11.5 12 4l9 7.5M5 10v9h5v-6h4v6h5v-9"/></svg></div>
      <div class="project-card-info">
        <div class="project-card-name">${escapeHTML(p.name)}</div>
        <div class="project-card-date">${relativeDate(p.updatedAt)}</div>
      </div>
      <button class="project-card-delete" title="${t('delete')}" aria-label="${t('deleteProject')}" data-id="${escapeAttr(p.id)}"><span></span><span></span></button>`;
    card.addEventListener('click', (e)=>{
      if (e.target.closest('.project-card-delete')) return;
      openProject(p.id);
    });
    card.querySelector('.project-card-delete').addEventListener('click', async (e)=>{
      e.stopPropagation();
      if (confirm(t('deleteProjectConfirm',{name:p.name}))){
        await deleteProjectData(p.id);
        renderHomeScreen();
      }
    });
    listEl.appendChild(card);
  }
}
