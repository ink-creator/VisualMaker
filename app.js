/* app.js
   Estado da aplicação, histórico (desfazer/refazer), painel de
   propriedades, editor de texto embutido, zoom/pan, atalhos de
   teclado, navegação entre telas, exportação PNG e ligação de toda
   a interface. Carregado por último — depende de geometry.js,
   elements.js, render.js e storage.js. */

const svgNS = 'http://www.w3.org/2000/svg';
const svgEl = document.getElementById('svg-canvas');

/* ===== Idioma / i18n ===== */
const LANGUAGE_KEY = 'visual-maker-language';
const TRANSLATIONS = {
  'pt-BR': {
    documentTitle:'Visual Maker — Planta Baixa',
    settings:'Configurações', language:'Idioma', portuguese:'Português (Brasil)', english:'English',
    themeDark:'Ativar modo escuro', themeLight:'Ativar modo claro',
    homeEyebrow:'Ferramenta de planta baixa',
    homeSub:'Plantas baixas claras, precisas e prontas para apresentar — sem a complexidade de um software CAD.',
    newPlan:'Nova planta', width:'Largura', length:'Comprimento', createPlan:'Criar planta', or:'ou',
    buildManually:'Construir manualmente', myProjects:'Meus projetos', loading:'Carregando…',
    backProjects:'Voltar aos projetos', newProject:'Novo projeto', untitled:'Sem título',
    undo:'Desfazer', redo:'Refazer', viewMode:'Modo de visualização', blueprintMode:'Modo Blueprint',
    blueprintTitle:'Exibir todas as medidas das paredes', save:'Salvar', saveChanges:'Salvar alterações', saved:'Salvo', export:'Exportar',
    construction:'Construção', select:'Selecionar', wall:'Parede', door:'Porta', window:'Janela', room:'Cômodo',
    stair:'Escada',startFloor:'Andar inicial',endFloor:'Andar final',stepCount:'Número de degraus',riserHeight:'Altura por degrau (m)',stairType:'Tipo',straightStair:'Reta',uStair:'Em U com patamar',direction:'Direção (°)',stairDraft:'Selecione um andar superior para conectar a escada.',noDestination:'Sem destino',stairUp:'SOBE',stairDown:'DESCE',stairRiseHelp:'Altura calculada entre os pisos. A largura corresponde a cada lance.',
    dimension:'Cota', text:'Texto', library:'Biblioteca', libraryCategories:'Categorias da biblioteca', colorPalette:'Paleta de cores', canvas3DLabel:'Visualização 3D da planta',
    interior:'Interior', outdoor:'Quintal', structures:'Estruturas', projectStyle:'Estilo do projeto',
    paletteTechnical:'Técnico', paletteNatural:'Natural', paletteCoastal:'Litoral', paletteMono:'Monocromático',
    mirror:'Espelhamento', axisX:'Eixo X', axisY:'Eixo Y', leftRight:'(esq/dir)', upDown:'(cima/baixo)',
    grid:'Grade', active:'Ativa', spacing:'Espaçamento',
    floors:'Andares', floor:'Andar', groundFloor:'Térreo', upperFloor:'{count}º andar', addFloor:'Adicionar andar', duplicateFloor:'Duplicar andar', deleteFloor:'Excluir andar', deleteFloorConfirm:'Excluir o andar "{name}" e todos os elementos dele?',
    multipleSelected:'{count} selecionados', duplicateSelection:'Duplicar seleção', deleteSelection:'Excluir seleção',
    doorType:'Tipo de porta', doorSwing:'De giro', doorSliding:'De correr', hingeSide:'Dobradiça', hingeLeft:'Esquerda', hingeRight:'Direita', flipSwing:'Inverter abertura',
    windowType:'Tipo de janela', windowSliding:'De correr', windowFixed:'Fixa', windowAwning:'Basculante', flipWindow:'Inverter sentido',
    editable3d:'3D editável',
    editable3dHelp:'Use as ferramentas para criar no andar ativo · arraste para mover · pontos azuis redimensionam · botão direito orbita',
    noObjectSelected:'Nenhum elemento 3D selecionado', object:'Objeto', wallAttached:'presa à parede', hideFront:'Ocultar frente', showFront:'Mostrar frente', recenter:'Recentralizar',
    emptyHint:'Escolha a ferramenta <strong>Parede</strong> e clique no canvas para começar a desenhar.',
    typeText:'Digite o texto', normalEdit:'Edição normal', view3d:'Visualização 3D', fit:'Ajustar',
    statusHelp:'Shift + R rotaciona · Ctrl + rolagem amplia', status3dHelp:'Shift + clique: seleção múltipla · Shift + R: girar · setas: câmera · botão direito: orbitar · H: ocultar frente',
    finishProject:'Finalizar projeto', exportPlan:'Exportar planta',
    exportDescription:'Escolha a apresentação. O arquivo será gerado em alta resolução, pronto para compartilhar ou imprimir.',
    lightMode:'Modo claro', lightModeDesc:'Fundo claro usando a paleta de cores atual.',
    darkMode:'Modo escuro', darkModeDesc:'Fundo escuro usando a versão noturna da paleta.',
    blueprintDesc:'Fundo azul e medidas em todas as paredes.',
    downloadSVG:'Baixar SVG', export3DHTML:'Visualização 3D (.html)', download3D:'Baixar 3D (OBJ + MTL)', downloadPNG:'Baixar PNG',
    close:'Fechar', pendingChanges:'Alterações pendentes', saveBeforeExit:'Salvar antes de sair?',
    saveBeforeReload:'Salvar antes de atualizar?',
    unsavedExit:'Este projeto possui alterações que ainda não foram salvas. Se você sair agora, elas serão perdidas.',
    unsavedReload:'Este projeto possui alterações que ainda não foram salvas. Se você atualizar a página agora, elas serão perdidas.',
    lastEditUnsaved:'Última edição ainda não salva', keepEditing:'Continuar editando', exitWithoutSaving:'Sair sem salvar',
    reloadWithoutSaving:'Atualizar sem salvar', saveAndExit:'Salvar e sair', saveAndReload:'Salvar e atualizar',
    propertiesWall:'PAREDE', propertiesText:'TEXTO', propertiesDoor:'PORTA', propertiesWindow:'JANELA', propertiesRoom:'CÔMODO',
    propertiesDimension:'COTA', content:'Conteúdo', size:'Tamanho', bold:'Negrito', rotation:'Rotação', color:'Cor',
    thickness:'Espessura', height3d:'Altura 3D', wallColor3d:'Cor da parede no 3D', color3d:'Cor no 3D',
    sillHeight:'Altura do peitoril', angle:'Ângulo', name:'Nome', area:'Área', roomColor:'Cor do ambiente',
    floorMaterial:'Material do piso', position:'POSIÇÃO', elevation3d:'Elevação 3D', sizeAppearance:'TAMANHO E APARÊNCIA',
    depth:'Profundidade', snapWall:'Encostar parede', snapWallTitle:'Move o objeto até a parede mais próxima',
    snapFloor:'Encostar no chão', snapFloorTitle:'Zera a elevação do objeto', measure:'Medida',
    mirrorFirst:'Ative o espelhamento em X ou Y na barra lateral primeiro.', duplicate:'Duplicar', delete:'Excluir',
    addAsset:'Adicionar {name}', item:'Item',
    floor_solid:'Cor lisa', floor_wood:'Madeira', floor_tile:'Cerâmica', floor_concrete:'Concreto', floor_grass:'Grama',
    asset_sofa:'Sofá', asset_bed:'Cama', asset_table_interior:'Mesa', asset_desk:'Escrivaninha', asset_toilet:'Vaso',
    asset_sink:'Pia', asset_plant_interior:'Planta', asset_fridge:'Geladeira', asset_stove:'Fogão', asset_counter:'Balcão',
    asset_wardrobe:'Guarda-roupa', asset_tv:'TV', asset_pool:'Piscina', asset_tree:'Árvore', asset_car:'Carro',
    asset_grill:'Churrasqueira', asset_table_outdoor:'Mesa externa', asset_plant_outdoor:'Canteiro', asset_column:'Pilar',
    asset_halfwall:'Meia parede', asset_slidingGate:'Portão correr', asset_doubleGate:'Portão duplo',
    asset_pedestrianGate:'Portão social', asset_pergola:'Pergolado',
    couldNotOpenProject:'Não foi possível abrir esse projeto.',
    totalArea:'Área total {area} m²', wallCountOne:'1 parede', wallCount:'{count} paredes', doorCountOne:'1 porta', doorCount:'{count} portas', windowCountOne:'1 janela', windowCount:'{count} janelas', itemCountOne:'1 item', itemCount:'{count} itens', perimeter:'{value} m perím.', addWallBeforeExport:'Adicione ao menos uma parede antes de exportar.',
    couldNotGenerateImage:'Não foi possível gerar a imagem.', defaultFilename:'planta', suffixDark:'-escuro', suffixLight:'-claro',
    couldNotSaveProject:'Não foi possível salvar o projeto agora.', noSavedProjects:'Nenhum projeto salvo ainda. Crie o primeiro acima.',
    deleteProjectConfirm:'Excluir o projeto "{name}"?', deleteProject:'Excluir projeto',
    justNow:'agora mesmo', minutesAgo:'há {count} min', hoursAgo:'há {count} h', yesterday:'ontem', daysAgo:'há {count} dias',
    webglUnsupported:'O navegador não oferece suporte a WebGL.',
    standalone3D:'Visualização 3D', standalone3DOffline:'Visual Maker · visualização 3D offline',
    center:'Centralizar', centerTitle:'Centralizar a planta', toggleBackground:'Alternar fundo',
    lightBackground:'Fundo claro', darkBackground:'Fundo escuro',
    standaloneHelp:'<b>Mouse:</b> arraste para orbitar · <b>Scroll:</b> zoom · <b>WASD/setas:</b> mover câmera · <b>Shift:</b> movimento rápido · <b>duplo clique:</b> centralizar',
    couldNotOpen3D:'Não foi possível abrir o 3D', webglNeeded:'Este navegador não oferece suporte ao WebGL necessário para a visualização.',
    addElements3DHTML:'Adicione elementos à planta antes de exportar a visualização 3D.',
    couldNotGenerate3DHTML:'Não foi possível gerar a visualização 3D deste projeto.',
    addElements3D:'Adicione elementos à planta antes de exportar o modelo 3D.',
    couldNotGenerate3D:'Não foi possível gerar a geometria 3D deste projeto.',
    readmeTitle:'Visual Maker - exportacao 3D',
    readmeOpen:'Abra o arquivo {file} em um programa compativel com Wavefront OBJ.',
    readmeKeep:'Mantenha {obj} e {mtl} na mesma pasta para preservar as cores.',
    readmeScale:'Escala: 1 unidade do modelo = 1 metro.',
    readmeFull:'O arquivo exporta a planta completa, mesmo que paredes frontais estejam ocultas somente na visualizacao do editor.',
    readmeFilename:'LEIA-ME.txt'
  },
  en: {
    documentTitle:'Visual Maker — Floor Plan',
    settings:'Settings', language:'Language', portuguese:'Português (Brasil)', english:'English',
    themeDark:'Enable dark mode', themeLight:'Enable light mode',
    homeEyebrow:'Floor plan tool',
    homeSub:'Clear, precise floor plans ready to present — without the complexity of CAD software.',
    newPlan:'New floor plan', width:'Width', length:'Length', createPlan:'Create plan', or:'or',
    buildManually:'Build manually', myProjects:'My projects', loading:'Loading…',
    backProjects:'Back to projects', newProject:'New project', untitled:'Untitled',
    undo:'Undo', redo:'Redo', viewMode:'View mode', blueprintMode:'Blueprint Mode',
    blueprintTitle:'Show all wall measurements', save:'Save', saveChanges:'Save changes', saved:'Saved', export:'Export',
    construction:'Construction', select:'Select', wall:'Wall', door:'Door', window:'Window', room:'Room',
    stair:'Stair',startFloor:'Start floor',endFloor:'End floor',stepCount:'Number of risers',riserHeight:'Riser height (m)',stairType:'Type',straightStair:'Straight',uStair:'U-shaped with landing',direction:'Direction (°)',stairDraft:'Select an upper floor to connect the stair.',noDestination:'No destination',stairUp:'UP',stairDown:'DOWN',stairRiseHelp:'Height follows the floor levels. Width is per flight.',
    dimension:'Dimension', text:'Text', library:'Library', libraryCategories:'Library categories', colorPalette:'Color palette', canvas3DLabel:'3D floor plan view',
    interior:'Interior', outdoor:'Outdoor', structures:'Structures', projectStyle:'Project style',
    paletteTechnical:'Technical', paletteNatural:'Natural', paletteCoastal:'Coastal', paletteMono:'Monochrome',
    mirror:'Mirroring', axisX:'X axis', axisY:'Y axis', leftRight:'(left/right)', upDown:'(up/down)',
    grid:'Grid', active:'Enabled', spacing:'Spacing',
    floors:'Floors', floor:'Floor', groundFloor:'Ground floor', upperFloor:'Floor {count}', addFloor:'Add floor', duplicateFloor:'Duplicate floor', deleteFloor:'Delete floor', deleteFloorConfirm:'Delete "{name}" and every element on this floor?',
    multipleSelected:'{count} selected', duplicateSelection:'Duplicate selection', deleteSelection:'Delete selection',
    doorType:'Door type', doorSwing:'Swing', doorSliding:'Sliding', hingeSide:'Hinge', hingeLeft:'Left', hingeRight:'Right', flipSwing:'Flip swing',
    windowType:'Window type', windowSliding:'Sliding', windowFixed:'Fixed', windowAwning:'Awning', flipWindow:'Flip direction',
    editable3d:'Editable 3D',
    editable3dHelp:'Use tools to create on the active floor · drag to move · blue points resize · right button orbits',
    noObjectSelected:'No 3D element selected', object:'Object', wallAttached:'attached to wall', hideFront:'Hide front', showFront:'Show front', recenter:'Recenter',
    emptyHint:'Choose the <strong>Wall</strong> tool and click the canvas to start drawing.',
    typeText:'Type text', normalEdit:'Normal editing', view3d:'3D View', fit:'Fit',
    statusHelp:'Shift + R rotates · Ctrl + scroll zooms', status3dHelp:'Shift + click: multi-select · Shift + R: rotate · arrows: camera · right button: orbit · H: hide front',
    finishProject:'Finish project', exportPlan:'Export floor plan',
    exportDescription:'Choose the presentation style. The file will be generated in high resolution, ready to share or print.',
    lightMode:'Light mode', lightModeDesc:'Light background using the current color palette.',
    darkMode:'Dark mode', darkModeDesc:'Dark background using the night version of the palette.',
    blueprintDesc:'Blue background with measurements on every wall.',
    downloadSVG:'Download SVG', export3DHTML:'3D View (.html)', download3D:'Download 3D (OBJ + MTL)', downloadPNG:'Download PNG',
    close:'Close', pendingChanges:'Pending changes', saveBeforeExit:'Save before leaving?',
    saveBeforeReload:'Save before reloading?',
    unsavedExit:'This project has changes that have not been saved yet. If you leave now, they will be lost.',
    unsavedReload:'This project has changes that have not been saved yet. If you reload the page now, they will be lost.',
    lastEditUnsaved:'Latest edit is not saved yet', keepEditing:'Keep editing', exitWithoutSaving:'Leave without saving',
    reloadWithoutSaving:'Reload without saving', saveAndExit:'Save and leave', saveAndReload:'Save and reload',
    propertiesWall:'WALL', propertiesText:'TEXT', propertiesDoor:'DOOR', propertiesWindow:'WINDOW', propertiesRoom:'ROOM',
    propertiesDimension:'DIMENSION', content:'Content', size:'Size', bold:'Bold', rotation:'Rotation', color:'Color',
    thickness:'Thickness', height3d:'3D height', wallColor3d:'Wall color in 3D', color3d:'3D color',
    sillHeight:'Sill height', angle:'Angle', name:'Name', area:'Area', roomColor:'Room color',
    floorMaterial:'Floor material', position:'POSITION', elevation3d:'3D elevation', sizeAppearance:'SIZE & APPEARANCE',
    depth:'Depth', snapWall:'Snap to wall', snapWallTitle:'Moves the object to the nearest wall',
    snapFloor:'Place on floor', snapFloorTitle:'Resets the object elevation', measure:'Measurement',
    mirrorFirst:'Enable X or Y mirroring in the sidebar first.', duplicate:'Duplicate', delete:'Delete',
    addAsset:'Add {name}', item:'Item',
    floor_solid:'Solid color', floor_wood:'Wood', floor_tile:'Tile', floor_concrete:'Concrete', floor_grass:'Grass',
    asset_sofa:'Sofa', asset_bed:'Bed', asset_table_interior:'Table', asset_desk:'Desk', asset_toilet:'Toilet',
    asset_sink:'Sink', asset_plant_interior:'Plant', asset_fridge:'Fridge', asset_stove:'Stove', asset_counter:'Counter',
    asset_wardrobe:'Wardrobe', asset_tv:'TV', asset_pool:'Pool', asset_tree:'Tree', asset_car:'Car',
    asset_grill:'Grill', asset_table_outdoor:'Outdoor table', asset_plant_outdoor:'Planter', asset_column:'Column',
    asset_halfwall:'Half wall', asset_slidingGate:'Sliding gate', asset_doubleGate:'Double gate',
    asset_pedestrianGate:'Pedestrian gate', asset_pergola:'Pergola',
    couldNotOpenProject:'Could not open this project.',
    totalArea:'Total area {area} m²', wallCountOne:'1 wall', wallCount:'{count} walls', doorCountOne:'1 door', doorCount:'{count} doors', windowCountOne:'1 window', windowCount:'{count} windows', itemCountOne:'1 item', itemCount:'{count} items', perimeter:'{value} m perimeter', addWallBeforeExport:'Add at least one wall before exporting.',
    couldNotGenerateImage:'Could not generate the image.', defaultFilename:'floor-plan', suffixDark:'-dark', suffixLight:'-light',
    couldNotSaveProject:'Could not save the project right now.', noSavedProjects:'No saved projects yet. Create your first one above.',
    deleteProjectConfirm:'Delete the project "{name}"?', deleteProject:'Delete project',
    justNow:'just now', minutesAgo:'{count} min ago', hoursAgo:'{count} h ago', yesterday:'yesterday', daysAgo:'{count} days ago',
    webglUnsupported:'This browser does not support WebGL.',
    standalone3D:'3D View', standalone3DOffline:'Visual Maker · offline 3D view',
    center:'Center', centerTitle:'Center the floor plan', toggleBackground:'Toggle background',
    lightBackground:'Light background', darkBackground:'Dark background',
    standaloneHelp:'<b>Mouse:</b> drag to orbit · <b>Scroll:</b> zoom · <b>WASD/arrows:</b> move camera · <b>Shift:</b> fast movement · <b>double click:</b> center',
    couldNotOpen3D:'Could not open 3D', webglNeeded:'This browser does not support the WebGL required for this view.',
    addElements3DHTML:'Add elements to the floor plan before exporting the 3D view.',
    couldNotGenerate3DHTML:'Could not generate the 3D view for this project.',
    addElements3D:'Add elements to the floor plan before exporting the 3D model.',
    couldNotGenerate3D:'Could not generate the 3D geometry for this project.',
    readmeTitle:'Visual Maker - 3D export',
    readmeOpen:'Open {file} in a program compatible with Wavefront OBJ.',
    readmeKeep:'Keep {obj} and {mtl} in the same folder to preserve colors.',
    readmeScale:'Scale: 1 model unit = 1 meter.',
    readmeFull:'The exported file contains the complete floor plan, even if front walls are hidden only in the editor view.',
    readmeFilename:'README.txt'
  }
};

Object.assign(TRANSLATIONS['pt-BR'], {
  floorSettings:'Configurações do andar',
  cancel:'Cancelar',
  projects:'Projetos',project:'Projeto',projectName:'Nome do projeto',renameProject:'Renomear projeto',duplicateProject:'Duplicar projeto',copy:'cópia',
  deleteBoardConfirm:'Excluir o projeto "{name}" e todos os seus andares?',baseElevation:'Cota de base',floorHeight:'Altura do andar (m)',slabThickness:'Laje (m)',
  floorSurface:'Piso do andar',ghostFloors:'Mostrar andares inferiores (2D)',topView:'Vista superior',annotations:'Anotações',
  viewPerson:'Ver como pessoa',leavePerson:'Sair do passeio',personHelp:'WASD ou setas: andar · Shift: acelerar · Arraste para olhar · Esc: sair',
  eyeHeight:'Altura dos olhos (m)',fieldOfView:'Campo de visão (°)',
  walkControls:'Controles do passeio',walkLeft:'Andar para a esquerda',walkForward:'Andar para a frente',walkBack:'Andar para trás',walkRight:'Andar para a direita',
  importFile:'Abrir arquivo VisualMaker',exportFile:'Baixar arquivo VisualMaker',invalidFile:'Arquivo VisualMaker inválido ou de uma versão não suportada.',allFloors:'Todos os andares',floorOnly:'Somente andar ativo',surfaceHelp:'O piso usa o retângulo que envolve paredes e cômodos.'
});
Object.assign(TRANSLATIONS.en, {
  floorSettings:'Floor settings',
  cancel:'Cancel',
  projects:'Projects',project:'Project',projectName:'Project name',renameProject:'Rename project',duplicateProject:'Duplicate project',copy:'copy',
  deleteBoardConfirm:'Delete project "{name}" and all its floors?',baseElevation:'Base elevation',floorHeight:'Floor height (m)',slabThickness:'Slab (m)',
  floorSurface:'Storey floor',ghostFloors:'Show lower floors (2D)',topView:'Top view',annotations:'Annotations',
  viewPerson:'Walk inside',leavePerson:'Exit walk',personHelp:'WASD or arrows: walk · Shift: faster · Drag to look · Esc: exit',
  eyeHeight:'Eye height (m)',fieldOfView:'Field of view (°)',
  walkControls:'Walking controls',walkLeft:'Walk left',walkForward:'Walk forward',walkBack:'Walk backward',walkRight:'Walk right',
  importFile:'Open VisualMaker file',exportFile:'Download VisualMaker file',invalidFile:'Invalid VisualMaker file or unsupported version.',allFloors:'All floors',floorOnly:'Active floor only',surfaceHelp:'The floor follows the bounding rectangle of walls and rooms.'
});

let currentLanguage = 'pt-BR';

function t(key, vars){
  const table = TRANSLATIONS[currentLanguage] || TRANSLATIONS['pt-BR'];
  let value = table[key] ?? TRANSLATIONS['pt-BR'][key] ?? key;
  if(vars){
    Object.entries(vars).forEach(([name,replacement])=>{
      value = value.replaceAll(`{${name}}`, String(replacement));
    });
  }
  return value;
}
window.t = t;
window.getCurrentLanguage = ()=>currentLanguage;

function getAssetLabel(kind, category, fallback){
  const suffix = (kind==='table' || kind==='plant') ? `_${category||'interior'}` : '';
  const key = `asset_${kind}${suffix}`;
  const translated = t(key);
  return translated===key ? (fallback || t('item')) : translated;
}
window.getAssetLabel = getAssetLabel;

function localizedNumber(value, digits=2){
  return Number(value).toLocaleString(currentLanguage==='en'?'en-US':'pt-BR', {
    minimumFractionDigits:digits,
    maximumFractionDigits:digits
  });
}
window.localizedNumber = localizedNumber;

function setText(selector,key){
  const el=document.querySelector(selector);
  if(el) el.textContent=t(key);
}
function setHTML(selector,key){
  const el=document.querySelector(selector);
  if(el) el.innerHTML=t(key);
}
function setTitle(selector,key){
  document.querySelectorAll(selector).forEach(el=>{
    el.title=t(key);
    el.setAttribute('aria-label',t(key));
  });
}
function setLeadingLabel(inputId,key){
  const input=document.getElementById(inputId);
  const label=input&&input.closest('label');
  if(!label)return;
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
  if(node)node.textContent=t(key)+'\n';
}
function setInlineLabel(inputId,key){
  const input=document.getElementById(inputId);
  const label=input&&input.closest('label');
  if(!label)return;
  const node=[...label.childNodes].find(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
  if(node)node.textContent=' '+t(key)+' ';
}

function applyStaticTranslations(){
  document.documentElement.lang=currentLanguage;
  document.title=t('documentTitle');

  setText('.home-eyebrow','homeEyebrow');
  setText('.home-sub','homeSub');
  setText('.new-project-card h2','newPlan');
  setLeadingLabel('new-width','width');
  setLeadingLabel('new-height','length');
  setText('#btn-create-dims','createPlan');
  setText('.divider-or','or');
  setText('#btn-create-manual','buildManually');
  setText('.projects-section-title','myProjects');

  setTitle('#btn-home','backProjects');
  setText('#btn-undo span','undo');
  setText('#btn-redo span','redo');
  document.getElementById('btn-undo').setAttribute('aria-label',t('undo'));
  document.getElementById('btn-redo').setAttribute('aria-label',t('redo'));
  document.getElementById('blueprint-toggle').setAttribute('aria-label',t('blueprintMode'));
  const viewSwitch=document.querySelector('.view-mode-switch');if(viewSwitch)viewSwitch.setAttribute('aria-label',t('viewMode'));
  const floorSwitch=document.getElementById('floor-switch');if(floorSwitch)floorSwitch.setAttribute('aria-label',t('floors'));
  const floorSelect=document.getElementById('floor-select');if(floorSelect){floorSelect.title=t('floor');floorSelect.setAttribute('aria-label',t('floor'));}
  const floorAdd=document.getElementById('floor-add');if(floorAdd){floorAdd.title=t('addFloor');floorAdd.setAttribute('aria-label',t('addFloor'));}
  const floorDup=document.getElementById('floor-duplicate');if(floorDup){floorDup.title=t('duplicateFloor');floorDup.setAttribute('aria-label',t('duplicateFloor'));}
  const floorDelete=document.getElementById('floor-delete');if(floorDelete){floorDelete.title=t('deleteFloor');floorDelete.setAttribute('aria-label',t('deleteFloor'));}
  const blueprintLabel=document.querySelector('.blueprint-switch');if(blueprintLabel)blueprintLabel.title=t('blueprintTitle');
  setText('.blueprint-switch > span:last-child','blueprintMode');
  setText('#btn-export span','export');

  const staticTools={select:'select',wall:'wall',door:'door',window:'window',room:'room',stair:'stair',cota:'dimension',text:'text'};
  Object.entries(staticTools).forEach(([toolName,key])=>{
    const btn=document.querySelector(`.tool-btn[data-tool="${toolName}"]`);
    if(!btn)return;
    const span=btn.querySelector('span');if(span)span.textContent=t(key);
    const shortcut=btn.querySelector('kbd')?.textContent||'';
    btn.title=`${t(key)}${shortcut?` (${shortcut})`:''}`;
  });
  document.querySelectorAll('.mini-label:not([data-model-label])').forEach((el,index)=>{
    const keys=['construction','library','projectStyle','mirror','grid'];
    if(keys[index])el.textContent=t(keys[index]);
  });
  const libTabs={interior:'interior',outdoor:'outdoor',structure:'structures'};
  Object.entries(libTabs).forEach(([category,key])=>{const el=document.querySelector(`.library-tab[data-category="${category}"]`);if(el)el.textContent=t(key);});
  const libTablist=document.querySelector('.library-tabs');if(libTablist)libTablist.setAttribute('aria-label',t('libraryCategories'));
  const paletteList=document.getElementById('palette-list');if(paletteList)paletteList.setAttribute('aria-label',t('colorPalette'));
  const canvas3d=document.getElementById('canvas-3d');if(canvas3d)canvas3d.setAttribute('aria-label',t('canvas3DLabel'));
  const paletteKeys={technical:'paletteTechnical',warm:'paletteNatural',coastal:'paletteCoastal',mono:'paletteMono'};
  Object.entries(paletteKeys).forEach(([name,key])=>{const el=document.querySelector(`.palette-option[data-palette="${name}"] > span:last-child`);if(el)el.textContent=t(key);});
  setInlineLabel('mirror-x-toggle','axisX');
  setInlineLabel('mirror-y-toggle','axisY');
  const hints=document.querySelectorAll('.mirror-controls .hint');if(hints[0])hints[0].textContent=t('leftRight');if(hints[1])hints[1].textContent=t('upDown');
  setInlineLabel('grid-toggle','active');
  setLeadingLabel('grid-spacing','spacing');

  setText('#viewer3d-help strong','editable3d');
  const helpSpans=document.querySelectorAll('#viewer3d-help > div:first-child > span');
  if(helpSpans[0])helpSpans[0].textContent=t('editable3dHelp');
  if(!selectedId && helpSpans[1])helpSpans[1].textContent=t('noObjectSelected');
  setText('#viewer3d-reset','recenter');
  setHTML('#empty-hint p','emptyHint');
  const textEditor=document.getElementById('text-editor-input');if(textEditor)textEditor.placeholder=t('typeText');
  setText('#zoom-fit','fit');
  setText('.status-help','statusHelp'); const statusHelp=document.querySelector('.status-help');if(statusHelp)statusHelp.dataset.threeDHelp=t('status3dHelp');

  setText('#export-modal .dialog-kicker','finishProject');
  setText('#export-title','exportPlan');
  setText('#export-modal > .export-dialog > .dialog-copy','exportDescription');
  const exportModes=document.querySelectorAll('.export-mode');
  if(exportModes[0]){const s=exportModes[0].querySelector('strong'),d=exportModes[0].querySelector('small');if(s)s.textContent=t('lightMode');if(d)d.textContent=t('lightModeDesc');}
  if(exportModes[1]){const s=exportModes[1].querySelector('strong'),d=exportModes[1].querySelector('small');if(s)s.textContent=t('darkMode');if(d)d.textContent=t('darkModeDesc');}
  if(exportModes[2]){const s=exportModes[2].querySelector('strong'),d=exportModes[2].querySelector('small');if(s)s.textContent='Blueprint';if(d)d.textContent=t('blueprintDesc');}
  setText('#export-svg','downloadSVG');setText('#export-3d-html','export3DHTML');setText('#export-3d','download3D');setText('#export-png','downloadPNG');
  const exportClose=document.getElementById('export-close');if(exportClose)exportClose.setAttribute('aria-label',t('close'));

  setText('#unsaved-modal .dialog-kicker','pendingChanges');
  setText('.unsaved-summary span:last-child','lastEditUnsaved');
  setText('#unsaved-cancel','keepEditing');

  setText('#settings-panel .settings-title','settings');
  setText('#settings-panel label > span','language');
  const panel=document.getElementById('settings-panel');if(panel)panel.setAttribute('aria-label',t('settings'));
  const activeAssetCategory=document.querySelector('.library-tab.active')?.dataset.category||'interior';
  renderAssetLibrary(activeAssetCategory);
  const settingsClose=document.getElementById('settings-close');if(settingsClose){settingsClose.title=t('close');settingsClose.setAttribute('aria-label',t('close'));}
  setTitle('#settings-toggle,#home-settings-toggle','settings');

  updateSaveButton();
  if(typeof updateFloorControls==='function')updateFloorControls();
  applyProjectAppearance();
  setDarkMode(document.body.classList.contains('dark-mode'),false);
}

function setLanguage(language,savePreference=true){
  currentLanguage = language==='en' ? 'en' : 'pt-BR';
  document.querySelectorAll('.language-select').forEach(select=>{select.value=currentLanguage;});
  applyStaticTranslations();
  if(document.getElementById('screen-home').classList.contains('active')) renderHomeScreen();
  const activeCategory=document.querySelector('.library-tab.active')?.dataset.category||'interior';
  renderAssetLibrary(activeCategory);
  updatePropertiesPanel();
  if(typeof window.update3DLanguage==='function')window.update3DLanguage();
  if(savePreference){try{localStorage.setItem(LANGUAGE_KEY,currentLanguage);}catch(e){/* preferência não persistida */}}
}
window.setVisualMakerLanguage=setLanguage;

function applyStoredLanguage(){
  let preference='pt-BR';
  try{preference=localStorage.getItem(LANGUAGE_KEY)||'pt-BR';}catch(e){}
  currentLanguage=preference==='en'?'en':'pt-BR';
  document.querySelectorAll('.language-select').forEach(select=>{select.value=currentLanguage;});
}

/* ===== Estado global ===== */
let state = VisualMakerModel.editorState({name:t('newProject')});
let view = { pxPerMeter:60, panX:80, panY:80 };
let tool = 'select';
let selectedId = null;
let selectedIds = new Set();
let smartGuides = [];
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

/* ===== Seleção múltipla / guias inteligentes ===== */
function setSmartGuides(guides){ smartGuides=Array.isArray(guides)?guides:[]; }
function clearSmartGuides(){ smartGuides=[]; }
function getSelectionIds(){
  if(!selectedId){ selectedIds.clear(); return []; }
  if(!selectedIds.has(selectedId)) selectedIds=new Set([selectedId]);
  const valid=[];
  for(const id of selectedIds){
    const el=getElement(id);
    if(el && (typeof elementBelongsToFloor!=='function'||elementBelongsToFloor(el,state.activeFloorId)))valid.push(id);
  }
  if(!valid.includes(selectedId)){
    selectedId=valid.length?valid[valid.length-1]:null;
  }
  selectedIds=new Set(valid);
  return valid;
}
function getSelectedElements(){ return getSelectionIds().map(getElement).filter(Boolean); }
function setSingleSelection(id){
  selectedId=id||null;
  selectedIds=new Set(selectedId?[selectedId]:[]);
}
function setSelection(ids,primaryId){
  const valid=(ids||[]).filter(id=>{
    const el=getElement(id);return !!el&&(typeof elementBelongsToFloor!=='function'||elementBelongsToFloor(el,state.activeFloorId));
  });
  selectedIds=new Set(valid);
  selectedId=(primaryId&&selectedIds.has(primaryId))?primaryId:(valid.length?valid[valid.length-1]:null);
}
function clearSelection(){ selectedId=null;selectedIds.clear(); }
function toggleSelection(id){
  getSelectionIds();
  if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);
  if(selectedIds.has(id))selectedId=id;
  else if(selectedId===id)selectedId=[...selectedIds].pop()||null;
  if(!selectedIds.size)selectedId=null;
}
function elementAnchor(el){
  if(!el)return {x:0,y:0};
  if('x1' in el)return {x:(el.x1+el.x2)/2,y:(el.y1+el.y2)/2};
  if(el.type==='room')return {x:el.x+el.w/2,y:el.y+el.h/2};
  return {x:Number(el.x)||0,y:Number(el.y)||0};
}
function floorDisplayName(floor,index){
  if(floor&&floor.name)return floor.name;
  return t('floor')+' '+(index+1);
}
function activeFloor(){
  return (state.floors||[]).find(f=>f.id===state.activeFloorId)||(state.floors||[])[0]||null;
}
const palettes = {
  technical:{room:'#DCE6F2',object:'#F8FAFC',stroke:'#44566C',darkRoom:'#2B4660',darkObject:'#293642',darkStroke:'#A9BFD4'},
  warm:{room:'#E7D9C6',object:'#F4EFE7',stroke:'#875D43',darkRoom:'#584536',darkObject:'#40352E',darkStroke:'#D4B293'},
  coastal:{room:'#CFE4DF',object:'#F0F8F7',stroke:'#236C6F',darkRoom:'#28524F',darkObject:'#263B3A',darkStroke:'#83C8C2'},
  mono:{room:'#E2E2E0',object:'#FAFAF8',stroke:'#333333',darkRoom:'#3B3B39',darkObject:'#2E2E2C',darkStroke:'#C9C9C5'}
};
function getPalette(theme,paletteName=state.palette){
  const p=palettes[paletteName||'technical']||palettes.technical;
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
  solid:'floor_solid',
  wood:'floor_wood',
  tile:'floor_tile',
  concrete:'floor_concrete',
  grass:'floor_grass'
};
function floorMaterialBase(room, theme, paletteName=state.palette){
  if(room && room.color) return room.color;
  const material=(room&&room.material)||'solid';
  const dark=theme==='dark'||(theme==null&&document.body.classList.contains('dark-mode'));
  if(material==='wood') return dark?'#71543F':'#B88962';
  if(material==='tile') return dark?'#59616A':'#D8D6D0';
  if(material==='concrete') return dark?'#50555A':'#B8BAB9';
  if(material==='grass') return dark?'#3F623B':'#6F995A';
  return getPalette(theme,paletteName).room;
}

/* ===== Histórico (desfazer/refazer) ===== */
function snapshotElements(){
  return VisualMakerModel.serialize(state);
}
function restoreHistorySnapshot(snapshot){
  const sameProject=snapshot.activeProjectId===state.activeProjectId;
  const currentView=sameProject&&window.get3DViewState?window.get3DViewState():null;
  state = VisualMakerModel.editorState(snapshot, state.projectId);
  if(currentView)state.view3d=currentView;
  mirrorState={xActive:false,yActive:false,axisX:null,axisY:null,...activeProject().settings.mirror};
  syncProjectControls();
  if(window.restore3DViewState)window.restore3DViewState(state.view3d,{restoreMode:true});
}
function historyEquals(a,b){ return JSON.stringify(a||{})===JSON.stringify(b||{}); }
function syncHistoryContext(){
  // Navigation is not an undo step, but undo should return to the edited board.
  const snapshot=history[historyIndex];
  const project=snapshot?.projects.find(p=>p.id===state.activeProjectId);
  if(!project||!project.floors.some(f=>f.id===state.activeFloorId))return;
  snapshot.activeProjectId=state.activeProjectId;project.activeFloorId=state.activeFloorId;
}
function updateHistoryButtons(){
  const undoBtn=document.getElementById('btn-undo'),redoBtn=document.getElementById('btn-redo');
  if(undoBtn)undoBtn.disabled=historyIndex<=0;
  if(redoBtn)redoBtn.disabled=historyIndex<0||historyIndex>=history.length-1;
}
function pushHistory(){
  const next=snapshotElements();
  if(historyIndex>=0 && historyEquals(history[historyIndex],next)){
    updateHistoryButtons();
    return false;
  }
  history = history.slice(0, historyIndex+1);
  history.push(next);
  historyIndex = history.length-1;
  if (history.length>100){ history.shift(); historyIndex--; }
  markUnsaved();
  updateHistoryButtons();
  return true;
}
function undo(){
  if (historyIndex<=0) return;
  historyIndex--;
  restoreHistorySnapshot(history[historyIndex]);
  if(typeof ensureOpeningBindings==='function')ensureOpeningBindings();
  clearSelection(); clearSmartGuides();
  if(typeof updateFloorControls==='function')updateFloorControls();
  render(); updatePropertiesPanel(); markUnsaved(); updateHistoryButtons();
}
function redo(){
  if (historyIndex>=history.length-1) return;
  historyIndex++;
  restoreHistorySnapshot(history[historyIndex]);
  if(typeof ensureOpeningBindings==='function')ensureOpeningBindings();
  clearSelection(); clearSmartGuides();
  if(typeof updateFloorControls==='function')updateFloorControls();
  render(); updatePropertiesPanel(); markUnsaved(); updateHistoryButtons();
}
function markUnsaved(){ unsavedChanges = true; updateSaveButton(); }
function updateSaveButton(){
  const btn = document.getElementById('btn-save');
  btn.classList.toggle('unsaved', unsavedChanges);
  btn.innerHTML = `<span>${unsavedChanges ? t('saveChanges') : t('save')}</span>`;
}
function flashSaveIndicator(){
  const btn = document.getElementById('btn-save');
  btn.innerHTML = `<span>${t('saved')}</span>`;
  setTimeout(updateSaveButton, 1100);
}

/* ===== Projetos e pavimentos ===== */
function activeProject(){ return VisualMakerModel.activeProject(state); }
function projectDisplayName(project,index){ return project.name || t('project')+' '+(index+1); }
function normalizeFloors(){
  state.floors.forEach((floor,index)=>{floor.level=index;});
  if(!state.floors.some(f=>f.id===state.activeFloorId))state.activeFloorId=state.floors[0].id;
}
function updateFloorControls(){
  normalizeFloors();
  for(const [id,items,selected,label] of [
    ['project-select',state.projects,state.activeProjectId,projectDisplayName],
    ['floor-select',state.floors,state.activeFloorId,floorDisplayName]]){
    const select=document.getElementById(id);if(!select)continue;
    select.replaceChildren();
    items.forEach((item,index)=>{const opt=document.createElement('option');opt.value=item.id;opt.textContent=label(item,index);select.appendChild(opt);});
    select.value=selected;
  }
  document.getElementById('floor-delete').disabled=state.floors.length<=1;
  document.getElementById('project-delete').disabled=state.projects.length<=1;
  const f=activeFloor(),p=activeProject();
  document.getElementById('floor-height').value=f.height;
  document.getElementById('floor-slab').value=f.slabThickness;
  document.getElementById('surface-enabled').checked=f.floorSurface.enabled;
  document.getElementById('surface-material').value=f.floorSurface.material;
  document.getElementById('surface-color').value=f.floorSurface.color||floorMaterialBase(f.floorSurface);
  document.getElementById('floor-ghost').checked=!!p.settings.ghostFloors;
  const layout=VisualMakerModel.floorLayout(p).find(e=>e.floor.id===f.id);
  document.getElementById('floor-elevation').textContent=t('baseElevation')+': '+formatMeters(layout.elevation);
  document.querySelectorAll('[data-model-label]').forEach(el=>{el.textContent=t(el.dataset.modelLabel);});
  document.querySelectorAll('[data-model-title]').forEach(el=>{el.title=t(el.dataset.modelTitle);el.setAttribute('aria-label',el.title);});
}
function syncProjectControls(){
  document.getElementById('project-name-input').value=state.projectName;
  document.getElementById('grid-toggle').checked=state.gridOn;
  document.getElementById('grid-spacing').value=Math.round(state.gridSpacing*100);
  document.getElementById('blueprint-toggle').checked=!!state.blueprintOn;
  document.getElementById('mirror-x-toggle').checked=mirrorState.xActive;
  document.getElementById('mirror-y-toggle').checked=mirrorState.yActive;
  applyProjectAppearance();updateFloorControls();
}
function finishContextEditing(){
  document.getElementById('text-editor-input').blur();
  if(window.finish3DInteraction)window.finish3DInteraction();
  clearSelection();clearSmartGuides();dragInfo=null;clearDrafts();
}
function refreshContext(){
  if(typeof ensureOpeningBindings==='function')ensureOpeningBindings();
  syncProjectControls();updatePropertiesPanel();
  if(document.getElementById('screen-editor').classList.contains('active')){fitView();updateZoomLabel();}
  render();
  if(window.onActiveFloorChanged)window.onActiveFloorChanged();
}
function switchFloor(floorId){
  if(!state.floors.some(f=>f.id===floorId)||floorId===state.activeFloorId)return;
  finishContextEditing();state.activeFloorId=floorId;
  refreshContext();syncHistoryContext();markUnsaved();
}
function captureProjectView(){
  state.view2d={...view};
  activeProject().settings.mirror={...mirrorState};
  if(window.get3DViewState)state.view3d=window.get3DViewState();
}
function switchBoard(projectId,recordNavigation=true){
  if(!state.projects.some(p=>p.id===projectId)||projectId===state.activeProjectId)return;
  finishContextEditing();captureProjectView();state.activeProjectId=projectId;
  mirrorState=activeProject().settings.mirror||{xActive:false,yActive:false,axisX:null,axisY:null};
  document.getElementById('mirror-x-toggle').checked=mirrorState.xActive;
  document.getElementById('mirror-y-toggle').checked=mirrorState.yActive;
  refreshContext();
  if(state.view2d){view={...state.view2d};updateZoomLabel();render();}
  if(window.restore3DViewState)window.restore3DViewState(state.view3d,{restoreMode:true});
  if(recordNavigation)syncHistoryContext();
  markUnsaved();
}
function addBoard(duplicate=false){
  finishContextEditing();captureProjectView();
  const source=activeProject();
  const p=duplicate?VisualMakerModel.duplicateProject(source):VisualMakerModel.project();
  if(duplicate)p.name=projectDisplayName(source,state.projects.indexOf(source))+' ('+t('copy')+')';
  state.projects.push(p);switchBoard(p.id);pushHistory();
}
function renameBoard(){
  const p=activeProject(),input=document.getElementById('project-rename-input');
  input.value=projectDisplayName(p,state.projects.indexOf(p));
  input.dataset.projectId=p.id;input.classList.remove('hidden');input.focus();input.select();
}
function deleteBoard(){
  if(state.projects.length<=1)return;
  const p=activeProject();
  confirmHierarchyDelete(t('deleteBoardConfirm',{name:projectDisplayName(p,state.projects.indexOf(p))}),()=>{
    switchBoard(state.projects.find(other=>other!==p).id,false);
    state.projects=state.projects.filter(other=>other!==p);updateFloorControls();pushHistory();
  });
}
function addFloor(duplicateCurrent=false){
  finishContextEditing();
  const source=activeFloor(),floor=VisualMakerModel.floor(duplicateCurrent?source:{},state.activeProjectId,state.floors.length);
  floor.id=VisualMakerModel.id('floor');floor.name=null;
  const ids=new Map(floor.elements.map(el=>[el.id,genId()]));
  floor.elements.forEach(el=>{el.id=ids.get(el.id);el.floorId=floor.id;if(el.wallId)el.wallId=ids.get(el.wallId)||null;});
  state.floors.push(floor);state.activeFloorId=floor.id;
  refreshContext();pushHistory();
}
function deleteActiveFloor(){
  if(state.floors.length<=1)return;
  const index=state.floors.findIndex(f=>f.id===state.activeFloorId),floor=activeFloor();
  confirmHierarchyDelete(t('deleteFloorConfirm',{name:floorDisplayName(floor,index)}),()=>{
    finishContextEditing();state.floors.splice(index,1);
    state.activeFloorId=state.floors[Math.max(0,index-1)].id;
    VisualMakerModel.syncStairs(activeProject());
    refreshContext();pushHistory();
  });
}
let hierarchyDeleteAction=null;
function confirmHierarchyDelete(message,action){
  hierarchyDeleteAction=action;
  document.getElementById('hierarchy-confirm-message').textContent=message;
  document.getElementById('hierarchy-confirm').showModal();
  document.getElementById('hierarchy-cancel').focus();
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
  for(const wall of (typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements)){
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
  for(const wall of (typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements)){
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

/* ===== Operações em seleção múltipla ===== */
function duplicateCurrentSelection(){
  const source=getSelectedElements();if(!source.length)return;
  if(source.length===1){duplicateElement(source[0].id);setSingleSelection(selectedId);return;}
  const idMap=new Map(source.map(el=>[el.id,genId()]));
  const sourceIds=new Set(idMap.keys());
  const copies=source.map(el=>{
    const copy=JSON.parse(JSON.stringify(el));copy.id=idMap.get(el.id);offsetCopy(copy);
    if((copy.type==='door'||copy.type==='window')&&copy.wallId){
      copy.wallId=idMap.get(copy.wallId)||null;
      if(!copy.wallId)copy.wallT=null;
    }
    return copy;
  });
  state.elements.push(...copies);
  copies.forEach(copy=>{
    if((copy.type==='door'||copy.type==='window')&&copy.wallId){const wall=getElement(copy.wallId);if(wall)attachOpeningToWall(copy,wall,copy.wallT);}
    else if((copy.type==='door'||copy.type==='window')&&typeof bindOpeningToNearestWall==='function')bindOpeningToNearestWall(copy,.65);
  });
  setSelection(copies.map(c=>c.id),copies[copies.length-1].id);
  pushHistory();render();updatePropertiesPanel();
}
function deleteCurrentSelection(){
  const ids=new Set(getSelectionIds());if(!ids.size)return;
  const wallIds=new Set([...ids].filter(id=>getElement(id)?.type==='wall'));
  state.elements=state.elements.filter(el=>!ids.has(el.id)&&!((el.type==='door'||el.type==='window')&&wallIds.has(el.wallId)));
  clearSelection();pushHistory();render();updatePropertiesPanel();
}
function rotatePointAround(p,cx,cy,radValue){
  const dx=p.x-cx,dy=p.y-cy,c=Math.cos(radValue),s=Math.sin(radValue);
  return {x:cx+dx*c-dy*s,y:cy+dx*s+dy*c};
}
function rotateCurrentSelection(deltaDeg){
  const els=getSelectedElements();if(!els.length)return;
  if(els.length===1){rotateElement(els[0].id,deltaDeg);return;}
  const anchors=els.map(elementAnchor),cx=anchors.reduce((n,p)=>n+p.x,0)/anchors.length,cy=anchors.reduce((n,p)=>n+p.y,0)/anchors.length;
  const r=deltaDeg*Math.PI/180,selectedSet=new Set(els.map(e=>e.id));
  for(const el of els){
    if('x1' in el){
      const p1=rotatePointAround({x:el.x1,y:el.y1},cx,cy,r),p2=rotatePointAround({x:el.x2,y:el.y2},cx,cy,r);
      el.x1=p1.x;el.y1=p1.y;el.x2=p2.x;el.y2=p2.y;
    }else if(el.type==='room'){
      const center=rotatePointAround({x:el.x+el.w/2,y:el.y+el.h/2},cx,cy,r);el.x=center.x-el.w/2;el.y=center.y-el.h/2;
    }else if('x' in el){
      const p=rotatePointAround({x:el.x,y:el.y},cx,cy,r);el.x=p.x;el.y=p.y;
      if(el.type==='object'||el.type==='text'||el.type==='stair')el.rotation=((el.rotation||0)+deltaDeg)%360;
      if((el.type==='door'||el.type==='window')&&!el.wallId)el.angle=((el.angle||0)+deltaDeg)%360;
    }
  }
  for(const wall of els.filter(e=>e.type==='wall'))if(typeof syncOpeningsForWall==='function')syncOpeningsForWall(wall.id);
  for(const opening of els.filter(e=>(e.type==='door'||e.type==='window')&&!selectedSet.has(e.wallId)))if(typeof bindOpeningToNearestWall==='function')bindOpeningToNearestWall(opening,.65);
  pushHistory();render();updatePropertiesPanel();
}

/* ===== Painel de propriedades ===== */
function updatePropertiesPanel(){
  const panel = document.getElementById('properties-panel');
  const selection=getSelectedElements();
  if(selection.length>1){
    panel.classList.remove('hidden');
    panel.innerHTML=`
      <div class="prop-header">${t('multipleSelected',{count:selection.length})}</div>
      <div class="prop-actions"><button id="prop-duplicate-selection" class="btn-secondary">${t('duplicateSelection')}</button></div>
      <div class="prop-actions"><button id="prop-delete-selection" class="btn-danger">${t('deleteSelection')}</button></div>`;
    document.getElementById('prop-duplicate-selection').addEventListener('click',duplicateCurrentSelection);
    document.getElementById('prop-delete-selection').addEventListener('click',deleteCurrentSelection);
    return;
  }
  const el = selection.length?selection[0]:(selectedId ? getElement(selectedId) : null);
  if (!el){ panel.classList.add('hidden'); panel.innerHTML=''; return; }
  panel.classList.remove('hidden');

  if (el.type==='stair'){
    VisualMakerModel.syncStairs(activeProject());
    const g=VisualMakerModel.stairGeometry(el,activeProject());
    const options=(selected,onlyUpper)=>state.floors.map((f,i)=>!onlyUpper||i>g.start.index?`<option value="${escapeAttr(f.id)}" ${f.id===selected?'selected':''}>${escapeXML(floorDisplayName(f,i))}</option>`:'').join('');
    panel.innerHTML=`<div class="prop-header">${t('stair')}</div>
      <label>${t('startFloor')}<select id="prop-stair-start">${options(el.floorId,false)}</select></label>
      <label>${t('endFloor')}<select id="prop-stair-end"><option value="">${t('noDestination')}</option>${options(el.endFloorId,true)}</select></label>
      <label>${t('stairType')}<select id="prop-stair-type"><option value="straight" ${el.stairType==='straight'?'selected':''}>${t('straightStair')}</option><option value="u" ${el.stairType==='u'?'selected':''}>${t('uStair')}</option></select></label>
      <label>${t('width')}<input id="prop-stair-width" type="number" min="0.3" step="0.05" value="${el.width}"></label>
      <label>${t('length')}<input id="prop-stair-length" type="number" min="0.5" step="0.05" value="${el.length}"></label>
      <label>${t('stepCount')}<input id="prop-stair-count" type="number" min="2" max="200" step="1" value="${el.stepCount}"></label>
      <label>${t('riserHeight')}<input type="text" value="${g.valid?g.riserHeight.toFixed(4):'—'}" readonly></label>
      <label>${t('direction')}<input id="prop-stair-direction" type="number" step="15" value="${el.rotation}"></label>
      <label>${t('color')}<input id="prop-stair-color" type="color" value="${el.color||'#C6B49A'}"></label>
      <p>${t(g.valid?'stairRiseHelp':'stairDraft')}</p>
      <div class="prop-actions"><button id="prop-mirror" class="btn-secondary">${t('mirror')}</button><button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;
    const commit=()=>{VisualMakerModel.syncStairs(activeProject());pushHistory();render();updatePropertiesPanel();};
    document.getElementById('prop-stair-start').addEventListener('change',event=>{
      const target=state.floors.find(f=>f.id===event.target.value);if(!target)return;
      state.elements=state.elements.filter(e=>e.id!==el.id);target.elements.push(el);
      el.floorId=el.startFloorId=target.id;state.activeFloorId=target.id;refreshContext();setSingleSelection(el.id);commit();
    });
    document.getElementById('prop-stair-end').addEventListener('change',event=>{el.endFloorId=event.target.value||null;commit();});
    document.getElementById('prop-stair-type').addEventListener('change',event=>{el.stairType=event.target.value;commit();});
    for(const [suffix,key,min,max] of [['width','width',.3,100],['length','length',.5,1000],['count','stepCount',2,200],['direction','rotation',-36000,36000]]){
      const input=document.getElementById('prop-stair-'+suffix);
      input.addEventListener('change',()=>{const value=Number(input.value);if(input.value!==''&&Number.isFinite(value)&&value>=min&&value<=max)el[key]=value;commit();});bindEnterBlur(input);
    }
    document.getElementById('prop-stair-color').addEventListener('change',event=>{el.color=event.target.value;commit();});
  } else if (el.type==='wall'){
    const length = Math.hypot(el.x2-el.x1, el.y2-el.y1);
    let angle = Math.round(Math.atan2(el.y2-el.y1, el.x2-el.x1)*180/Math.PI);
    if (angle<0) angle += 360;
    panel.innerHTML = `
      <div class="prop-header">${t('propertiesWall')}</div>
      <label>${t('length')}<input id="prop-length" type="text" value="${escapeAttr(formatMeters(length))}"></label>
      <label>${t('thickness')}<input id="prop-thickness" type="text" value="${escapeAttr(formatMeters(el.thickness))}"></label>
      <label>${t('height3d')}<input id="prop-wall-height" type="text" value="${escapeAttr(formatMeters(el.height||2.7))}"></label>
      <label>${t('wallColor3d')}<input id="prop-wall-color" type="color" value="${el.color||'#F0EEE9'}"></label>
      <label>${t('rotation')}<input id="prop-rot-display" type="text" value="${angle}°" readonly></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">${t('mirror')}</button>
        <button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;
    const lenInput = document.getElementById('prop-length');
    lenInput.addEventListener('change', ()=>{
      const newLen = parseMeters(lenInput.value);
      if (newLen && newLen>0.02){
        const ratio = newLen/length;
        el.x2 = el.x1+(el.x2-el.x1)*ratio; el.y2 = el.y1+(el.y2-el.y1)*ratio;
        if(typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.id);
        pushHistory(); render(); updatePropertiesPanel();
      }
    });
    bindEnterBlur(lenInput);
    const thickInput = document.getElementById('prop-thickness');
    thickInput.addEventListener('change', ()=>{
      const t = parseMeters(thickInput.value);
      if (t && t>0.01){ el.thickness = t; if(typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.id); pushHistory(); render(); }
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
      <div class="prop-header">${t('propertiesText')}</div>
      <label>${t('content')}<input id="prop-content" type="text" value="${escapeAttr(el.content)}"></label>
      <label>${t('size')}<input id="prop-size" type="number" value="${el.size||16}" min="8" max="72"></label>
      <label class="check-row"><input id="prop-bold" type="checkbox" ${el.bold?'checked':''}> ${t('bold')}</label>
      <label>${t('rotation')} (°)<input id="prop-rot" type="number" value="${el.rotation||0}" step="15"></label>
      <label>${t('color')}<input id="prop-color" type="color" value="${el.color||'#1B2430'}"></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">${t('mirror')}</button>
        <button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;
    const contentInput = document.getElementById('prop-content');
    contentInput.addEventListener('change', ()=>{ el.content=contentInput.value||t('text'); pushHistory(); render(); });
    bindEnterBlur(contentInput);
    document.getElementById('prop-size').addEventListener('change', e=>{ el.size=parseFloat(e.target.value)||16; pushHistory(); render(); });
    document.getElementById('prop-bold').addEventListener('change', e=>{ el.bold=e.target.checked; pushHistory(); render(); });
    document.getElementById('prop-rot').addEventListener('change', e=>{ el.rotation=parseFloat(e.target.value)||0; pushHistory(); render(); });
    const colorInput = document.getElementById('prop-color');
    colorInput.addEventListener('input', ()=>{ el.color=colorInput.value; render(); });
    colorInput.addEventListener('change', ()=>{ pushHistory(); });
  } else if (el.type==='door' || el.type==='window'){
    const label = el.type==='door' ? t('propertiesDoor') : t('propertiesWindow');
    panel.innerHTML = `
      <div class="prop-header">${label}</div>
      ${el.type==='door'?`<label>${t('doorType')}<select id="prop-door-style"><option value="swing" ${(el.doorStyle||'swing')==='swing'?'selected':''}>${t('doorSwing')}</option><option value="sliding" ${el.doorStyle==='sliding'?'selected':''}>${t('doorSliding')}</option></select></label>`:`<label>${t('windowType')}<select id="prop-window-style"><option value="sliding" ${(el.windowStyle||'sliding')==='sliding'?'selected':''}>${t('windowSliding')}</option><option value="fixed" ${el.windowStyle==='fixed'?'selected':''}>${t('windowFixed')}</option><option value="awning" ${el.windowStyle==='awning'?'selected':''}>${t('windowAwning')}</option></select></label>`}
      ${el.type==='door'&&(el.doorStyle||'swing')==='swing'?`<label>${t('hingeSide')}<select id="prop-hinge-side"><option value="left" ${(el.hingeSide||'left')==='left'?'selected':''}>${t('hingeLeft')}</option><option value="right" ${el.hingeSide==='right'?'selected':''}>${t('hingeRight')}</option></select></label><div class="prop-actions"><button id="prop-flip-opening" class="btn-secondary">${t('flipSwing')}</button></div>`:''}
      ${el.type==='window'?`<div class="prop-actions"><button id="prop-flip-window" class="btn-secondary">${t('flipWindow')}</button></div>`:''}
      <label>${t('width')}<input id="prop-width" type="text" value="${escapeAttr(formatMeters(el.width))}"></label>
      <label>${t('height3d')}<input id="prop-opening-height" type="text" value="${escapeAttr(formatMeters(el.height||(el.type==='door'?2.1:1.2)))}"></label>
      ${el.type==='window'?`<label>${t('sillHeight')}<input id="prop-sill-height" type="text" value="${escapeAttr(formatMeters(el.sillHeight==null?0.9:el.sillHeight))}"></label>`:''}
      <label>${t('color3d')}<input id="prop-opening-color" type="color" value="${el.color||(el.type==='door'?'#A56B43':'#9CC9DF')}"></label>
      <label>${t('angle')} (°)<input id="prop-angle" type="number" value="${Math.round(el.angle||0)}" step="15" ${el.wallId?'readonly':''}></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">${t('mirror')}</button>
        <button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;
    const doorStyle=document.getElementById('prop-door-style');
    if(doorStyle)doorStyle.addEventListener('change',()=>{el.doorStyle=doorStyle.value;pushHistory();render();updatePropertiesPanel();});
    const windowStyle=document.getElementById('prop-window-style');
    if(windowStyle)windowStyle.addEventListener('change',()=>{el.windowStyle=windowStyle.value;pushHistory();render();updatePropertiesPanel();});
    const hingeSide=document.getElementById('prop-hinge-side');
    if(hingeSide)hingeSide.addEventListener('change',()=>{el.hingeSide=hingeSide.value==='right'?'right':'left';pushHistory();render();updatePropertiesPanel();});
    const flipOpening=document.getElementById('prop-flip-opening');
    if(flipOpening)flipOpening.addEventListener('click',()=>{el.swingSide=Number(el.swingSide)===-1?1:-1;pushHistory();render();updatePropertiesPanel();});
    const flipWindow=document.getElementById('prop-flip-window');
    if(flipWindow)flipWindow.addEventListener('click',()=>{el.windowSide=Number(el.windowSide)===-1?1:-1;pushHistory();render();updatePropertiesPanel();});
    const widthInput = document.getElementById('prop-width');
    widthInput.addEventListener('change', ()=>{ const w=parseMeters(widthInput.value); if (w&&w>0.1){ el.width=w; if(el.wallId&&typeof attachOpeningToWall==='function'){const wall=getElement(el.wallId);if(wall)attachOpeningToWall(el,wall,Number(el.wallT));} pushHistory(); render(); updatePropertiesPanel(); } });
    bindEnterBlur(widthInput);
    const openingHeightInput=document.getElementById('prop-opening-height');
    openingHeightInput.addEventListener('change',()=>{const h=parseMeters(openingHeightInput.value);if(h&&h>.2){el.height=h;pushHistory();render();updatePropertiesPanel();}});
    bindEnterBlur(openingHeightInput);
    const sillInput=document.getElementById('prop-sill-height');
    if(sillInput){sillInput.addEventListener('change',()=>{const h=parseMeters(sillInput.value);if(h!=null&&h>=0){el.sillHeight=h;pushHistory();render();updatePropertiesPanel();}});bindEnterBlur(sillInput);}
    const openingColor=document.getElementById('prop-opening-color');
    openingColor.addEventListener('input',()=>{el.color=openingColor.value;render();});
    openingColor.addEventListener('change',()=>pushHistory());
    document.getElementById('prop-angle').addEventListener('change', e=>{ if(el.wallId){const wall=getElement(el.wallId);if(wall&&typeof attachOpeningToWall==='function')attachOpeningToWall(el,wall,Number(el.wallT));}else el.angle=parseFloat(e.target.value)||0; pushHistory(); render(); updatePropertiesPanel(); });
  } else if (el.type==='room'){
    const area = typeof roomArea==='function'?roomArea(el):Math.abs(el.w*el.h);
    panel.innerHTML = `
      <div class="prop-header">${t('propertiesRoom')}</div>
      <label>${t('name')}<input id="prop-room-name" type="text" value="${escapeAttr(el.name)}"></label>
      <label>${t('width')}<input id="prop-room-w" type="text" value="${escapeAttr(formatMeters(el.w))}"></label>
      <label>${t('length')}<input id="prop-room-h" type="text" value="${escapeAttr(formatMeters(el.h))}"></label>
      <label>${t('area')}<input id="prop-room-area" type="text" value="${localizedNumber(area)} m²" readonly></label>
      <label>${t('roomColor')}<input id="prop-room-color" type="color" value="${floorMaterialBase(el)}"></label>
      <label>${t('floorMaterial')}<select id="prop-room-material">
        ${Object.entries(floorMaterials).map(([value,key])=>`<option value="${value}" ${(el.material||'solid')===value?'selected':''}>${t(key)}</option>`).join('')}
      </select></label>
      <div class="prop-actions">
        <button id="prop-mirror" class="btn-secondary">${t('mirror')}</button>
        <button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button>
      </div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;
    const nameInput = document.getElementById('prop-room-name');
    nameInput.addEventListener('change', ()=>{ el.name=nameInput.value||t('room'); pushHistory(); render(); });
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
      <div class="prop-header">${escapeHTML(getAssetLabel(el.kind,el.category,el.label||t('item')))}</div>
      <div class="prop-subheader">${t('position')}</div>
      <div class="prop-two-cols">
        <label>X<input id="prop-object-x" type="text" value="${escapeAttr(`${Number(el.x||0).toFixed(2)} m`)}"></label>
        <label>Y<input id="prop-object-y" type="text" value="${escapeAttr(`${Number(el.y||0).toFixed(2)} m`)}"></label>
      </div>
      <label>${t('elevation3d')}<input id="prop-elevation" type="text" value="${escapeAttr(formatMeters(el.elevation||0))}"></label>
      <label>${t('rotation')} (°)<input id="prop-rot" type="number" value="${Math.round((el.rotation||0)*100)/100}" step="15"></label>
      <div class="prop-actions prop-actions-tight">
        <button id="prop-snap-wall" class="btn-secondary" title="${t('snapWallTitle')}">${t('snapWall')}</button>
        <button id="prop-floor" class="btn-secondary" title="${t('snapFloorTitle')}">${t('snapFloor')}</button>
      </div>
      <div class="prop-subheader">${t('sizeAppearance')}</div>
      <label>${t('width')}<input id="prop-object-w" type="text" value="${escapeAttr(formatMeters(el.w))}"></label>
      <label>${t('depth')}<input id="prop-object-h" type="text" value="${escapeAttr(formatMeters(el.h))}"></label>
      <label>${t('height3d')}<input id="prop-object-height" type="text" value="${escapeAttr(formatMeters(VisualMakerModel.objectHeight(el,activeFloor())))}"></label>
      <label>${t('color')}<input id="prop-color" type="color" value="${el.color||getPalette().object}"></label>
      <div class="prop-actions"><button id="prop-mirror" class="btn-secondary">${t('mirror')}</button><button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button></div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;

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
    const objectHeightInput=document.getElementById('prop-object-height');
    objectHeightInput.addEventListener('change',()=>{const v=parseMeters(objectHeightInput.value);if(v>=.05&&v<=30){el.height=v;pushHistory();render();updatePropertiesPanel();}});bindEnterBlur(objectHeightInput);
    ow.addEventListener('change',()=>{const v=parseMeters(ow.value);if(v>.1){el.w=v;pushHistory();render();updatePropertiesPanel();}}); bindEnterBlur(ow);
    oh.addEventListener('change',()=>{const v=parseMeters(oh.value);if(v>.1){el.h=v;pushHistory();render();updatePropertiesPanel();}}); bindEnterBlur(oh);
    const oc=document.getElementById('prop-color');oc.addEventListener('input',()=>{el.color=oc.value;render();});oc.addEventListener('change',()=>pushHistory());
  } else if (el.type==='cota'){
    const length = Math.hypot(el.x2-el.x1, el.y2-el.y1);
    panel.innerHTML = `
      <div class="prop-header">${t('propertiesDimension')}</div>
      <label>${t('measure')}<input id="prop-cota-len" type="text" value="${escapeAttr(formatMeters(length))}"></label>
      <div class="prop-actions"><button id="prop-duplicate" class="btn-secondary">${t('duplicate')}</button></div>
      <div class="prop-actions"><button id="prop-delete" class="btn-danger">${t('delete')}</button></div>`;
    const lenInput = document.getElementById('prop-cota-len');
    lenInput.addEventListener('change', ()=>{
      const newLen = parseMeters(lenInput.value);
      if (newLen && newLen>0.02){
        const ratio = newLen/length;
        el.x2 = el.x1+(el.x2-el.x1)*ratio; el.y2 = el.y1+(el.y2-el.y1)*ratio;
        if(typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.id);
        pushHistory(); render(); updatePropertiesPanel();
      }
    });
    bindEnterBlur(lenInput);
  }
  const mirrorBtn = document.getElementById('prop-mirror');
  if (mirrorBtn) mirrorBtn.addEventListener('click', ()=>{
    if (!mirrorState.xActive && !mirrorState.yActive){ alert(t('mirrorFirst')); return; }
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
  const screenPt = document.body.classList.contains('view-3d')&&window.editor3DPoint?window.editor3DPoint(worldX,worldY):toScreen(worldX,worldY);
  if(!screenPt)return;
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
  if ((typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements).length===0&&!incomingStairs().length&&!VisualMakerModel.referenceFloors(activeProject()).some(f=>f.elements.length)){
    view.pxPerMeter=60; view.panX=cw/2-2.5*60; view.panY=ch/2-2.5*60; return;
  }
  const b = computeContentBBox(true);
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
  document.getElementById('canvas-3d').style.cursor=tool==='select'?'default':'crosshair';
}
function clearDrafts(){ wallDraft=null; cotaDraft=null; roomDraft=null; clearSmartGuides(); }
function activateTool(nextTool){
  window.leavePersonView?.();
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
    const btn=document.createElement('button');btn.className='asset-btn';btn.dataset.kind=asset.kind;btn.title=t('addAsset',{name:getAssetLabel(asset.kind,asset.category,asset.label)});
    btn.innerHTML=assetIcon(asset.kind)+`<span>${escapeHTML(getAssetLabel(asset.kind,asset.category,asset.label))}</span>`;
    btn.addEventListener('click',()=>{window.leavePersonView?.();selectedAssetKind=asset.kind;selectedAssetCategory=asset.category;selectedAssetLabel=asset.label;tool='object';clearDrafts();updateToolButtons();render();});
    grid.appendChild(btn);
  });
  updateToolButtons();
}
let selectedAssetCategory='interior',selectedAssetLabel=t('item');
document.querySelectorAll('.library-tab').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.library-tab').forEach(b=>b.classList.toggle('active',b===btn));renderAssetLibrary(btn.dataset.category);
}));
renderAssetLibrary('interior');

const floorSelectEl=document.getElementById('floor-select');
if(floorSelectEl)floorSelectEl.addEventListener('change',()=>switchFloor(floorSelectEl.value));
const floorAddEl=document.getElementById('floor-add');
if(floorAddEl)floorAddEl.addEventListener('click',()=>addFloor(false));
const floorDuplicateEl=document.getElementById('floor-duplicate');
if(floorDuplicateEl)floorDuplicateEl.addEventListener('click',()=>addFloor(true));
const floorDeleteEl=document.getElementById('floor-delete');
if(floorDeleteEl)floorDeleteEl.addEventListener('click',deleteActiveFloor);
document.getElementById('project-select').addEventListener('change',e=>switchBoard(e.target.value));
document.addEventListener('pointerdown',e=>{
  if(!e.target.closest('.hierarchy-settings'))document.querySelector('.hierarchy-settings').open=false;
});
document.getElementById('project-add').addEventListener('click',()=>addBoard());
document.getElementById('project-rename').addEventListener('click',renameBoard);
document.getElementById('project-rename-input').addEventListener('blur',e=>{
  const input=e.target,p=state.projects.find(p=>p.id===input.dataset.projectId);
  if(p&&input.value.trim()&&p.name!==input.value.trim()){p.name=input.value.trim();updateFloorControls();pushHistory();}
  input.classList.add('hidden');
});
document.getElementById('project-rename-input').addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.target.dataset.projectId='';e.target.blur();}
  if(e.key==='Enter'){e.preventDefault();e.target.blur();}
});
document.getElementById('project-duplicate').addEventListener('click',()=>addBoard(true));
document.getElementById('project-delete').addEventListener('click',deleteBoard);
document.getElementById('hierarchy-cancel').addEventListener('click',()=>document.getElementById('hierarchy-confirm').close());
document.getElementById('hierarchy-delete').addEventListener('click',()=>{
  const action=hierarchyDeleteAction;hierarchyDeleteAction=null;
  document.getElementById('hierarchy-confirm').close();if(action)action();
});
document.getElementById('hierarchy-confirm').addEventListener('close',()=>{hierarchyDeleteAction=null;});
for(const id of ['floor-height','floor-slab','surface-enabled','surface-material','surface-color','floor-ghost']){
  document.getElementById(id).addEventListener('change',e=>{
    const input=e.target,f=activeFloor(),p=activeProject();
    if(input.type==='number'&&!input.checkValidity()){updateFloorControls();return;}
    if(id==='floor-height'){
      const previous=f.height;f.height=Number(input.value);
      f.elements.filter(el=>el.type==='wall'&&(el.height==null||el.height===previous)).forEach(el=>{el.height=f.height;});
    }
    if(id==='floor-slab')f.slabThickness=Number(input.value);
    if(id==='surface-enabled')f.floorSurface.enabled=input.checked;
    if(id==='surface-material'){f.floorSurface.material=input.value;f.floorSurface.color=null;}
    if(id==='surface-color')f.floorSurface.color=input.value;
    if(id==='floor-ghost'){p.settings.ghostFloors=input.checked;if(input.checked){fitView();updateZoomLabel();}}
    updateFloorControls();pushHistory();render();
  });
}
updateFloorControls();

/* ===== Interação no canvas ===== */
svgEl.addEventListener('selectstart',e=>e.preventDefault());
// Shared world-space editing; both viewports supply coordinates and hit results.
function editorPointerDown(e,worldPt,hitOverride){
  const {x:sx,y:sy}=toScreen(worldPt.x,worldPt.y);

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
    let x,y,angle,thickness,wallId=null,wallT=null;
    if (nearest){ x=nearest.x; y=nearest.y; angle=Math.atan2(nearest.wall.y2-nearest.wall.y1, nearest.wall.x2-nearest.wall.x1)*180/Math.PI; thickness=nearest.wall.thickness; wallId=nearest.wall.id; wallT=nearest.t; }
    else { x=worldPt.x; y=worldPt.y; angle=0; thickness=0.15; }
    const newEl = tool==='door' ? addDoor(x,y,angle,thickness,wallId,wallT) : addWindow(x,y,angle,thickness,wallId,wallT);
    if(nearest&&typeof attachOpeningToWall==='function')attachOpeningToWall(newEl,nearest,nearest.t);
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
  if (tool==='stair'){
    const snapped=snapPoint(worldPt.x,worldPt.y),newEl=addStair(snapped.x,snapped.y);
    addMirroredCopiesFor(newEl);setSingleSelection(newEl.id);pushHistory();tool='select';updateToolButtons();render();updatePropertiesPanel();return;
  }
  if (tool==='object'){
    const asset=assetLibrary.find(a=>a.kind===selectedAssetKind&&a.category===selectedAssetCategory) || assetLibrary.find(a=>a.kind===selectedAssetKind);
    if(asset){const snapped=snapPoint(worldPt.x,worldPt.y);const newEl=addObject(snapped.x,snapped.y,asset.kind,selectedAssetLabel,asset.category,asset.w,asset.h);newEl.elevation=asset.elevation||0;if(!e.altKey&&typeof snapObjectIntoNearbyCorner==='function')snapObjectIntoNearbyCorner(newEl,.28);selectedId=newEl.id;pushHistory();updatePropertiesPanel();render();}
    return;
  }

  // ferramenta Selecionar
  clearSmartGuides();
  const axisHit = hitOverride===undefined?hitTestMirrorAxis(sx,sy):hitOverride?.axis;
  if (axisHit && !e.shiftKey){
    dragInfo = { mode:'mirror-axis', axis:axisHit };
    return;
  }
  const hit = hitOverride===undefined?hitTest(sx,sy):hitOverride;
  if (hit){
    if(e.shiftKey && !hit.handle){
      toggleSelection(hit.id);
      dragInfo=null;
      updatePropertiesPanel();render();return;
    }

    let selection=getSelectionIds();
    if(!selection.includes(hit.id)){setSingleSelection(hit.id);selection=getSelectionIds();}
    const el = getElement(hit.id);
    if (hit.handle){
      setSingleSelection(hit.id);
      if(hit.handle.startsWith('opening-')){
        dragInfo={mode:'resize-opening',id:hit.id,edge:hit.handle.slice('opening-'.length),orig:JSON.parse(JSON.stringify(el))};
      }else if (hit.handle.startsWith('room-')){
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
    } else if(selection.length>1){
      const selectedEls=getSelectedElements();
      dragInfo={
        mode:'move-group',id:hit.id,startWorld:worldPt,
        originals:selectedEls.map(item=>JSON.parse(JSON.stringify(item))),
        selectedIds:new Set(selectedEls.map(item=>item.id)),
        anchor:elementAnchor(el)
      };
    } else {
      setSingleSelection(hit.id);
      dragInfo = { mode:'move', id:hit.id, startWorld:worldPt, orig:JSON.parse(JSON.stringify(el)) };
    }
  } else {
    if(e.shiftKey){dragInfo=null;updatePropertiesPanel();render();return;}
    clearSelection();
    dragInfo = { mode:'pan', startClientX:e.clientX, startClientY:e.clientY, startPan:{x:view.panX,y:view.panY} };
  }
  updatePropertiesPanel();
  render();
}
svgEl.addEventListener('mousedown',e=>{const r=svgEl.getBoundingClientRect();editorPointerDown(e,toWorld(e.clientX-r.left,e.clientY-r.top));});

function editorPointerMove(e,worldPt){
  const {x:sx,y:sy}=toScreen(worldPt.x,worldPt.y);

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
  } else if (dragInfo.mode==='move-group'){
    const dx0=worldPt.x-dragInfo.startWorld.x,dy0=worldPt.y-dragInfo.startWorld.y;
    const rawAnchor={x:dragInfo.anchor.x+dx0,y:dragInfo.anchor.y+dy0};
    const snapped=typeof smartSnapXY==='function'?smartSnapXY(rawAnchor.x,rawAnchor.y,dragInfo.selectedIds,{grid:state.gridOn}):rawAnchor;
    const dx=dx0+(snapped.x-rawAnchor.x),dy=dy0+(snapped.y-rawAnchor.y);
    const selectedWallIds=new Set(dragInfo.originals.filter(o=>o.type==='wall').map(o=>o.id));
    for(const orig of dragInfo.originals){
      const el=getElement(orig.id);if(!el)continue;
      if((el.type==='door'||el.type==='window')&&selectedWallIds.has(orig.wallId))continue;
      if('x1' in orig){el.x1=orig.x1+dx;el.y1=orig.y1+dy;el.x2=orig.x2+dx;el.y2=orig.y2+dy;}
      else if(orig.type==='room'){el.x=orig.x+dx;el.y=orig.y+dy;}
      else if(orig.type==='door'||orig.type==='window'){
        const px=orig.x+dx,py=orig.y+dy;
        const near=typeof findNearestWall==='function'?findNearestWall(px,py,Math.max(.55,18/view.pxPerMeter),el.width,el.floorId):null;
        if(near&&typeof attachOpeningToWall==='function')attachOpeningToWall(el,near,near.t);
        else if(orig.wallId){const wall=getElement(orig.wallId),projected=wall&&projectPointToWall(wall,px,py,el.width);if(projected)attachOpeningToWall(el,wall,projected.t);}
        else{el.x=px;el.y=py;}
      }else if('x' in orig){el.x=orig.x+dx;el.y=orig.y+dy;}
    }
    for(const wallId of selectedWallIds)if(typeof syncOpeningsForWall==='function')syncOpeningsForWall(wallId);
    render();
  } else if (dragInfo.mode==='resize-opening'){
    const el=getElement(dragInfo.id);if(!el)return;
    if(typeof resizeOpeningOnWall==='function')resizeOpeningOnWall(el,dragInfo.edge,worldPt.x,worldPt.y);
    render();
  } else if (dragInfo.mode==='move'){
    const el = getElement(dragInfo.id); if (!el) return;
    const dx = worldPt.x-dragInfo.startWorld.x, dy = worldPt.y-dragInfo.startWorld.y;
    if ('x1' in dragInfo.orig){
      let x1=dragInfo.orig.x1+dx,y1=dragInfo.orig.y1+dy;
      const snapped=typeof smartSnapXY==='function'?smartSnapXY(x1,y1,el.id,{grid:state.gridOn}):{x:x1,y:y1};
      const sx=snapped.x-x1,sy=snapped.y-y1;
      el.x1=x1+sx; el.y1=y1+sy;
      el.x2=dragInfo.orig.x2+dx+sx; el.y2=dragInfo.orig.y2+dy+sy;
      if(el.type==='wall'&&typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.id);
    } else if (el.type==='door'||el.type==='window'){
      const proposedX=dragInfo.orig.x+dx,proposedY=dragInfo.orig.y+dy;
      const near=typeof findNearestWall==='function'?findNearestWall(proposedX,proposedY,Math.max(.5,18/view.pxPerMeter),el.width):null;
      if(near&&typeof attachOpeningToWall==='function')attachOpeningToWall(el,near,near.t);
      else if(dragInfo.orig.wallId&&typeof attachOpeningToWall==='function'){
        const wall=getElement(dragInfo.orig.wallId),projected=wall&&typeof projectPointToWall==='function'?projectPointToWall(wall,proposedX,proposedY,el.width):null;
        if(projected)attachOpeningToWall(el,wall,projected.t);
      }else{
        const snapped=typeof smartSnapXY==='function'?smartSnapXY(proposedX,proposedY,el.id,{grid:state.gridOn}):{x:proposedX,y:proposedY};
        el.x=snapped.x;el.y=snapped.y;
      }
    } else if (el.type==='object'){
      const rawX=dragInfo.orig.x+dx,rawY=dragInfo.orig.y+dy;
      const snapped=typeof smartSnapObjectPosition==='function'?smartSnapObjectPosition(el,rawX,rawY,e.altKey):{x:rawX,y:rawY};
      el.x=snapped.x;el.y=snapped.y;
      if(!e.altKey&&typeof snapObjectIntoNearbyCorner==='function')snapObjectIntoNearbyCorner(el,.28);
    } else if ('x' in dragInfo.orig){
      const rawX=dragInfo.orig.x+dx,rawY=dragInfo.orig.y+dy;
      const snapped=typeof smartSnapXY==='function'?smartSnapXY(rawX,rawY,el.id,{grid:state.gridOn}):{x:rawX,y:rawY};
      el.x=snapped.x; el.y=snapped.y;
    }
    render();
  } else if (dragInfo.mode==='resize'){
    const el = getElement(dragInfo.id); if (!el) return;
    if (dragInfo.handle==='p1' || dragInfo.handle==='p2'){
      const snapped = snapPoint(worldPt.x, worldPt.y, dragInfo.id);
      if (dragInfo.handle==='p1'){ el.x1=snapped.x; el.y1=snapped.y; } else { el.x2=snapped.x; el.y2=snapped.y; }
      if(el.type==='wall'&&typeof syncOpeningsForWall==='function')syncOpeningsForWall(el.id);
    } else if (dragInfo.handle && dragInfo.handle.startsWith('room-')){
      const snapped = snapPoint(worldPt.x, worldPt.y);
      const fx=dragInfo.fixed.x, fy=dragInfo.fixed.y;
      el.x = Math.min(fx,snapped.x); el.y = Math.min(fy,snapped.y);
      el.w = Math.max(0.1, Math.abs(snapped.x-fx)); el.h = Math.max(0.1, Math.abs(snapped.y-fy));
    }
    render();
  }
}
svgEl.addEventListener('mousemove',e=>{const r=svgEl.getBoundingClientRect();editorPointerMove(e,toWorld(e.clientX-r.left,e.clientY-r.top));});

function editorPointerUp(){
  if (tool==='room' && roomDraft){
    const x=Math.min(roomDraft.startX,roomDraft.curX), y=Math.min(roomDraft.startY,roomDraft.curY);
    const w=Math.abs(roomDraft.curX-roomDraft.startX), h=Math.abs(roomDraft.curY-roomDraft.startY);
    if (w>0.15 && h>0.15){
      const newEl = addRoom(x,y,w,h,t('room'));
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
  clearSmartGuides();
  render();
}
window.addEventListener('mouseup',()=>{if(!document.body.classList.contains('view-3d'))editorPointerUp();});

svgEl.addEventListener('dblclick', (e)=>{
  if (tool!=='select') return;
  const rect = svgEl.getBoundingClientRect();
  const sx = e.clientX-rect.left, sy = e.clientY-rect.top;
  const activeElements=typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements;
  for (let i=activeElements.length-1;i>=0;i--){
    const el = activeElements[i];
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
  if(document.getElementById('hierarchy-confirm').open)return;
  if (!document.getElementById('screen-editor').classList.contains('active')) return;
  if(e.key==='Escape'&&!document.getElementById('unsaved-modal').classList.contains('hidden')){closeUnsavedDialog();return;}
  if(e.key==='Escape'&&!document.getElementById('export-modal').classList.contains('hidden')){document.getElementById('export-modal').classList.add('hidden');return;}
  const reloadShortcut=e.key==='F5'||((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='r');
  if(reloadShortcut&&unsavedChanges){e.preventDefault();closeExportModal();openUnsavedDialog('reload');return;}
  const activeTag = document.activeElement.tagName;
  if (activeTag==='INPUT' || activeTag==='TEXTAREA' || activeTag==='SELECT'){
    if (e.key==='Escape') document.activeElement.blur();
    return;
  }
  const mod = e.ctrlKey||e.metaKey;
  if (mod && e.key.toLowerCase()==='z'){ e.preventDefault(); if(e.shiftKey)redo(); else undo(); }
  else if (mod && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); }
  else if (mod && e.key.toLowerCase()==='s'){ e.preventDefault(); saveProject(true); }
  else if (mod && e.key.toLowerCase()==='c'){ const els=getSelectedElements();if(els.length===1)clipboard=JSON.parse(JSON.stringify(els[0]));else if(els.length>1)clipboard={multi:true,elements:JSON.parse(JSON.stringify(els))}; }
  else if (mod && e.key.toLowerCase()==='v'){ if (clipboard) pasteClipboard(); }
  else if (mod && e.key.toLowerCase()==='d'){ if(selectedId){e.preventDefault();duplicateCurrentSelection();} }
  else if (e.key==='Delete' || e.key==='Backspace'){ if (selectedId){ e.preventDefault(); deleteCurrentSelection(); } }
  else if (e.shiftKey && e.key.toLowerCase()==='r'){ if (selectedId) rotateCurrentSelection(90); }
  else if (!mod && !e.altKey){
    const shortcutTools={q:'select',w:'wall',e:'door',r:'window',t:'room',y:'stair',u:'cota',i:'text'};
    const nextTool=shortcutTools[e.key.toLowerCase()];
    if(nextTool){e.preventDefault();activateTool(nextTool);}
    else if (e.key==='Escape'){ activateTool('select'); }
  }
  else if (e.key==='Escape'){ clearDrafts(); tool='select'; updateToolButtons(); render(); }
});

/* ===== Navegação entre telas ===== */
function startNewProject(){
  state = VisualMakerModel.editorState({name:t('newProject')});
  clearSelection();clearSmartGuides();
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
  clearSelection();clearSmartGuides();
  normalizeFloors();updateFloorControls();
  if(typeof ensureOpeningBindings==='function')ensureOpeningBindings();
  history = [snapshotElements()]; historyIndex = 0; updateHistoryButtons();
  requestAnimationFrame(()=>{
    resizeSVG();
    if(state.view2d&&['pxPerMeter','panX','panY'].every(key=>Number.isFinite(state.view2d[key]))&&state.view2d.pxPerMeter>0)view={...state.view2d};
    else fitView();
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
  if (!ok){ alert(t('couldNotOpenProject')); return; }
  mirrorState = { xActive:false, yActive:false, axisX:null, axisY:null, ...activeProject().settings.mirror };
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
  const status=document.getElementById('status-mode');status.lastChild.textContent=state.blueprintOn?` ${t('blueprintMode')}`:` ${t('normalEdit')}`;
}
function setDarkMode(active,savePreference){
  document.body.classList.toggle('dark-mode',active);
  document.querySelectorAll('.theme-toggle').forEach(btn=>{
    btn.setAttribute('aria-pressed',String(active));
    btn.setAttribute('aria-label',active?t('themeLight'):t('themeDark'));
    btn.title=active?t('themeLight'):t('themeDark');
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
  const exportElements=[...floorSurfaceElements(),...getActiveFloorElements()].map(el=>({...el}));
  const {bg,ink,muted,room,objectFill,objectStroke}=c;
  let parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`, `<rect width="${w}" height="${h}" fill="${bg}"/>`];
  if(!blueprint){
    const defs=[];
    exportElements.filter(e=>e.type==='room'&&(e.material||'solid')!=='solid').forEach((r,i)=>{
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
  for (const el of exportElements){
    if (el.type!=='room') continue;
    const x=(el.x+ox)*ppm, y=(el.y+oy)*ppm, ww=el.w*ppm, hh=el.h*ppm;
    const roomFill=(!blueprint&&el.__exportPatternId)?`url(#${el.__exportPatternId})`:(el.color||room);
    parts.push(`<rect x="${x}" y="${y}" width="${ww}" height="${hh}" fill="${roomFill}" fill-opacity="${el.__exportPatternId?'0.82':'0.42'}"/>`);
    if(el.surfaceOnly)continue;
    parts.push(`<text x="${x+ww/2}" y="${y+hh/2-4}" text-anchor="middle" font-family="IBM Plex Sans, sans-serif" font-weight="600" font-size="${Math.max(12,ppm*0.14)}" fill="${ink}">${escapeXML(el.name)}</text>`);
    parts.push(`<text x="${x+ww/2}" y="${y+hh/2+14}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="${Math.max(10,ppm*0.11)}" fill="${muted}">${localizedNumber(el.w*el.h)} m²</text>`);
  }
  for (const el of exportElements){
    if (el.type!=='wall') continue;
    const x1=(el.x1+ox)*ppm, y1=(el.y1+oy)*ppm, x2=(el.x2+ox)*ppm, y2=(el.y2+oy)*ppm;
    parts.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="${el.thickness*ppm}" stroke-linecap="square"/>`);
  }
  for (const el of exportElements){
    if (el.type!=='door' && el.type!=='window') continue;
    const x=(el.x+ox)*ppm, y=(el.y+oy)*ppm, wpx=el.width*ppm, tpx=(el.wallThickness||0.15)*ppm;
    parts.push(`<g transform="translate(${x} ${y}) rotate(${el.angle||0})">`);
    parts.push(`<rect x="${-wpx/2}" y="${-tpx/2-1}" width="${wpx}" height="${tpx+2}" fill="${bg}"/>`);
    if (el.type==='door'){
      if((el.doorStyle||'swing')==='sliding'){
        parts.push(`<line x1="${-wpx*.48}" y1="${-tpx*.10}" x2="${wpx*.08}" y2="${-tpx*.10}" stroke="${ink}" stroke-width="2"/>`);
        parts.push(`<line x1="${-wpx*.08}" y1="${tpx*.14}" x2="${wpx*.48}" y2="${tpx*.14}" stroke="${ink}" stroke-width="2"/>`);
      }else{
        const hingeRight=el.hingeSide==='right',swing=Number(el.swingSide)===-1?-1:1,hingeX=hingeRight?wpx/2:-wpx/2,closedX=hingeRight?-wpx/2:wpx/2,openY=-wpx*swing,sweep=(hingeRight?1:0)^(swing<0?1:0);
        parts.push(`<line x1="${hingeX}" y1="0" x2="${hingeX}" y2="${openY}" stroke="${ink}" stroke-width="2"/>`);
        parts.push(`<path d="M ${hingeX} ${openY} A ${wpx} ${wpx} 0 0 ${sweep} ${closedX} 0" fill="none" stroke="${muted}" stroke-width="1" stroke-dasharray="3 3"/>`);
      }
    } else {
      parts.push(`<line x1="${-wpx/2}" y1="${-tpx/4}" x2="${wpx/2}" y2="${-tpx/4}" stroke="${muted}" stroke-width="2"/>`);
      parts.push(`<line x1="${-wpx/2}" y1="${tpx/4}" x2="${wpx/2}" y2="${tpx/4}" stroke="${muted}" stroke-width="2"/>`);
      if((el.windowStyle||'sliding')==='sliding')parts.push(`<line x1="0" y1="${-tpx*.55}" x2="0" y2="${tpx*.55}" stroke="${muted}" stroke-width="1"/>`);
      else if(el.windowStyle==='awning'){const side=Number(el.windowSide)===-1?-1:1;parts.push(`<path d="M ${-wpx*.42} 0 L 0 ${-side*Math.max(8,wpx*.18)} L ${wpx*.42} 0" fill="none" stroke="${muted}" stroke-width="1.3"/>`);}
    }
    parts.push('</g>');
  }
  for(const el of [...exportElements.filter(e=>e.type==='stair'),...incomingStairs()]){
    parts.push(stairSVG(el,activeProject(),(x,y)=>({x:(x+ox)*ppm,y:(y+oy)*ppm}),objectStroke,objectFill,el.floorId!==activeFloorId()));
  }
  for(const el of exportElements.filter(e=>e.type==='object')){
    const x=(el.x+ox)*ppm,y=(el.y+oy)*ppm,ww=(el.w||1)*ppm,hh=(el.h||1)*ppm;
    parts.push(`<g transform="translate(${x} ${y}) rotate(${el.rotation||0})"><rect x="${-ww/2}" y="${-hh/2}" width="${ww}" height="${hh}" rx="${Math.min(8,hh*.12)}" fill="${el.color||objectFill}" stroke="${objectStroke}" stroke-width="1.5"/>`);
    if(el.kind==='bed')parts.push(`<line x1="${-ww/2}" y1="${-hh*.2}" x2="${ww/2}" y2="${-hh*.2}" stroke="${objectStroke}"/><rect x="${-ww*.38}" y="${-hh*.42}" width="${ww*.32}" height="${hh*.18}" rx="3" fill="none" stroke="${objectStroke}"/><rect x="${ww*.06}" y="${-hh*.42}" width="${ww*.32}" height="${hh*.18}" rx="3" fill="none" stroke="${objectStroke}"/>`);
    else if(el.kind==='pool')parts.push(`<path d="M ${-ww*.38} -10 Q ${-ww*.18} -15 0 -10 T ${ww*.38} -10 M ${-ww*.38} 10 Q ${-ww*.18} 5 0 10 T ${ww*.38} 10" fill="none" stroke="${objectStroke}"/>`);
    else parts.push(`<line x1="${-ww*.3}" y1="0" x2="${ww*.3}" y2="0" stroke="${objectStroke}"/><line x1="0" y1="${-hh*.3}" x2="0" y2="${hh*.3}" stroke="${objectStroke}"/>`);
    parts.push('</g>');
  }
  for (const el of exportElements){
    if (el.type!=='cota') continue;
    const geo = cotaGeometry(el); if (!geo) continue;
    const ax1=(geo.a1.x+ox)*ppm, ay1=(geo.a1.y+oy)*ppm, ax2=(geo.a2.x+ox)*ppm, ay2=(geo.a2.y+oy)*ppm;
    const e1x=(el.x1+ox)*ppm, e1y=(el.y1+oy)*ppm, e2x=(el.x2+ox)*ppm, e2y=(el.y2+oy)*ppm;
    parts.push(`<line x1="${e1x}" y1="${e1y}" x2="${ax1}" y2="${ay1}" stroke="${muted}" stroke-width="1"/>`);
    parts.push(`<line x1="${e2x}" y1="${e2y}" x2="${ax2}" y2="${ay2}" stroke="${muted}" stroke-width="1"/>`);
    parts.push(`<line x1="${ax1}" y1="${ay1}" x2="${ax2}" y2="${ay2}" stroke="${muted}" stroke-width="1.2"/>`);
    parts.push(`<text x="${(ax1+ax2)/2}" y="${(ay1+ay2)/2-5}" text-anchor="middle" font-family="IBM Plex Mono, monospace" font-size="11" fill="${muted}">${escapeXML(formatMeters(geo.len))}</text>`);
  }
  if(blueprint){for(const el of exportElements.filter(e=>e.type==='wall')){const dx=el.x2-el.x1,dy=el.y2-el.y1,len=Math.hypot(dx,dy);if(len<.02)continue;const nx=-dy/len,ny=dx/len,off=.34;const x1=(el.x1+nx*off+ox)*ppm,y1=(el.y1+ny*off+oy)*ppm,x2=(el.x2+nx*off+ox)*ppm,y2=(el.y2+ny*off+oy)*ppm,ex1=(el.x1+ox)*ppm,ey1=(el.y1+oy)*ppm,ex2=(el.x2+ox)*ppm,ey2=(el.y2+oy)*ppm,mx=(x1+x2)/2,my=(y1+y2)/2,label=escapeXML(formatMeters(len));parts.push(`<line x1="${ex1}" y1="${ey1}" x2="${x1}" y2="${y1}" stroke="${muted}"/><line x1="${ex2}" y1="${ey2}" x2="${x2}" y2="${y2}" stroke="${muted}"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${muted}"/><rect x="${mx-34}" y="${my-13}" width="68" height="17" rx="2" fill="${bg}"/><text x="${mx}" y="${my}" text-anchor="middle" font-family="IBM Plex Mono,monospace" font-size="11" fill="${muted}">${label}</text>`);}}
  for (const el of exportElements){
    if (el.type!=='text') continue;
    const x=(el.x+ox)*ppm, y=(el.y+oy)*ppm;
    const isDefaultText=!el.color||String(el.color).toLowerCase()==='#1b2430';
    const textColor=blueprint?ink:((mode==='dark'&&isDefaultText)?ink:(el.color||ink));
    parts.push(`<text x="${x}" y="${y}" font-family="IBM Plex Sans, sans-serif" font-size="${el.size||16}" font-weight="${el.bold?700:400}" fill="${textColor}" transform="rotate(${el.rotation||0} ${x} ${y})">${escapeXML(el.content)}</text>`);
  }
  const totalArea = exportElements.filter(e=>e.type==='room'&&!e.surfaceOnly).reduce((s,r)=>s+r.w*r.h,0);
  const footer = totalArea>0 ? `Visual Maker · ${t('totalArea',{area:localizedNumber(totalArea)})}` : `Visual Maker · ${t('wallCount',{count:exportElements.filter(e=>e.type==='wall').length})}`;
  parts.push(`<text x="10" y="${h-10}" font-family="IBM Plex Mono, monospace" font-size="11" fill="${muted}">${escapeXML(footer)}</text>`);
  parts.push('</svg>');
  exportElements.filter(e=>e.type==='room').forEach(r=>{if('__exportPatternId' in r) delete r.__exportPatternId;});
  return parts.join('');
}
function exportPNG(mode){
  if ((typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements).length===0){ alert(t('addWallBeforeExport')); return; }
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
      const suffix=mode==='blueprint'?'-blueprint':(mode==='dark'?t('suffixDark'):t('suffixLight'));
      a.download = safeProjectFilename() + suffix + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    });
  };
  img.onerror = ()=> alert(t('couldNotGenerateImage'));
  img.src = url;
}
function safeProjectFilename(){const fallback=t('defaultFilename');return (state.projectName||fallback).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\- ]/g,'').trim()||fallback;}
function exportSVGFile(mode){
  if((typeof getActiveFloorElements==='function'?getActiveFloorElements():state.elements).length===0){alert(t('addWallBeforeExport'));return;}
  const blob=new Blob([buildExportSVG(computeContentBBox(),1.1,100,mode)],{type:'image/svg+xml;charset=utf-8'}),a=document.createElement('a');
  const suffix=mode==='blueprint'?'-blueprint':(mode==='dark'?t('suffixDark'):t('suffixLight'));
  a.href=URL.createObjectURL(blob);a.download=safeProjectFilename()+suffix+'.svg';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}

/* ===== Ligação da interface ===== */
const unsavedModal=document.getElementById('unsaved-modal');
let pendingUnsavedAction='home';
function openUnsavedDialog(action){
  pendingUnsavedAction=action;
  const isReload=action==='reload';
  document.getElementById('unsaved-title').textContent=isReload?t('saveBeforeReload'):t('saveBeforeExit');
  document.getElementById('unsaved-description').textContent=isReload?t('unsavedReload'):t('unsavedExit');
  document.getElementById('unsaved-discard').textContent=isReload?t('reloadWithoutSaving'):t('exitWithoutSaving');
  document.getElementById('unsaved-save').textContent=isReload?t('saveAndReload'):t('saveAndExit');
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
document.getElementById('export-file').addEventListener('click',()=>{
  finishContextEditing();captureProjectView();
  const blob=new Blob([JSON.stringify(VisualMakerModel.serialize(state),null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=safeProjectFilename()+'.visualmaker.json';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);closeExportModal();
});
document.getElementById('import-file').addEventListener('click',()=>document.getElementById('import-file-input').click());
document.getElementById('import-file-input').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file)return;
  try{
    const data=JSON.parse(await file.text());
    if(!data||(!Array.isArray(data.projects)&&!Array.isArray(data.elements)&&!Array.isArray(data.floors)))throw new Error('Invalid file');
    const imported=VisualMakerModel.editorState(data);
    startNewProject();state=imported;state.projectName ||= file.name.replace(/\.(visualmaker\.)?json$/i,'');
    goToEditor();
  }catch(error){console.error('VisualMaker import',error);alert(t('invalidFile'));}
  e.target.value='';
});
const exportModal=document.getElementById('export-modal');
function closeExportModal(){exportModal.classList.add('hidden');}
document.getElementById('btn-export').addEventListener('click',()=>{const defaultMode=state.blueprintOn?'blueprint':(document.body.classList.contains('dark-mode')?'dark':'light');document.querySelector(`input[name="export-mode"][value="${defaultMode}"]`).checked=true;exportModal.classList.remove('hidden');});
document.getElementById('export-close').addEventListener('click',closeExportModal);
exportModal.addEventListener('mousedown',e=>{if(e.target===exportModal)closeExportModal();});
document.getElementById('export-png').addEventListener('click',()=>{const mode=document.querySelector('input[name="export-mode"]:checked').value;closeExportModal();exportPNG(mode);});
document.getElementById('export-svg').addEventListener('click',()=>{const mode=document.querySelector('input[name="export-mode"]:checked').value;closeExportModal();exportSVGFile(mode);});
document.getElementById('blueprint-toggle').addEventListener('change',e=>{state.blueprintOn=e.target.checked;applyProjectAppearance();pushHistory();render();});
document.getElementById('theme-toggle').addEventListener('click',()=>setDarkMode(!document.body.classList.contains('dark-mode'),true));
document.getElementById('home-theme-toggle').addEventListener('click',()=>setDarkMode(!document.body.classList.contains('dark-mode'),true));
const settingsPanel=document.getElementById('settings-panel');
function openSettings(){settingsPanel.classList.remove('hidden');document.getElementById('language-select').focus();}
function closeSettings(){settingsPanel.classList.add('hidden');}
document.getElementById('settings-toggle').addEventListener('click',e=>{e.stopPropagation();settingsPanel.classList.contains('hidden')?openSettings():closeSettings();});
document.getElementById('home-settings-toggle').addEventListener('click',e=>{e.stopPropagation();settingsPanel.classList.contains('hidden')?openSettings():closeSettings();});
document.getElementById('settings-close').addEventListener('click',closeSettings);
document.getElementById('language-select').addEventListener('change',e=>setLanguage(e.target.value,true));
settingsPanel.addEventListener('mousedown',e=>e.stopPropagation());
document.addEventListener('mousedown',()=>closeSettings());

document.querySelectorAll('.palette-option').forEach(btn=>btn.addEventListener('click',()=>{state.palette=btn.dataset.palette;applyProjectAppearance();pushHistory();render();}));
document.getElementById('zoom-in').addEventListener('click', ()=>zoomBy(1.2));
document.getElementById('zoom-out').addEventListener('click', ()=>zoomBy(1/1.2));
document.getElementById('zoom-fit').addEventListener('click', ()=>{ fitView(); updateZoomLabel(); render(); });
document.getElementById('grid-toggle').addEventListener('change', (e)=>{ state.gridOn=e.target.checked; pushHistory(); render(); });
document.getElementById('grid-spacing').addEventListener('change', (e)=>{
  const v = parseFloat(e.target.value);
  if (v>0){ state.gridSpacing = v/100; pushHistory(); render(); }
});
document.getElementById('mirror-x-toggle').addEventListener('change', (e)=>{
  mirrorState.xActive = e.target.checked;
  if (mirrorState.xActive && mirrorState.axisX==null) mirrorState.axisX = defaultMirrorAxisX();
  activeProject().settings.mirror={...mirrorState};pushHistory();
  render();
});
document.getElementById('mirror-y-toggle').addEventListener('change', (e)=>{
  mirrorState.yActive = e.target.checked;
  if (mirrorState.yActive && mirrorState.axisY==null) mirrorState.axisY = defaultMirrorAxisY();
  activeProject().settings.mirror={...mirrorState};pushHistory();
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
applyStoredLanguage();
applyStaticTranslations();
applyStoredTheme();
renderHomeScreen();
