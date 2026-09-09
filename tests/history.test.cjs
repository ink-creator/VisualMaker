const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../model.js');
function harness(){
  const p=M.project({name:'Casa',floors:[{}, {}, {}]});p.activeFloorId=p.floors[2].id;
  const other=M.project({name:'Praia'});
  const nodes=new Map(),node=()=>({value:'',checked:false,style:{},classList:{contains:()=>false,toggle(){},add(){},remove(){}},appendChild(){},replaceChildren(){},setAttribute(){},focus(){},showModal(){},blur(){}});
  const c={VisualMakerModel:M,state:M.editorState({projects:[p,other],activeProjectId:other.id}),history:[],historyIndex:0,
    window:{},document:{getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},querySelectorAll:()=>[],createElement:node},
    t:key=>key,genId:()=>M.id('el'),view:{},mirrorState:{},clearSelection(){},clearSmartGuides(){},clearDrafts(){},render(){},updatePropertiesPanel(){},updateZoomLabel(){},
    activeFloor:()=>M.activeFloor(c.state),floorDisplayName:(f,i)=>'Floor '+i,floorMaterialBase:()=> '#ffffff',formatMeters:n=>String(n),applyProjectAppearance(){}};
  vm.createContext(c);
  const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
  vm.runInContext(source.slice(source.indexOf('/* ===== Histórico'),source.indexOf('/* ===== Posicionamento')),c);
  c.history=[M.serialize(c.state)];
  return {c,p,other,accept:()=>vm.runInContext('hierarchyDeleteAction()',c)};
}
test('undo floor deletion after project navigation restores that project and floor',()=>{
  const {c,p,accept}=harness();c.switchBoard(p.id);c.deleteActiveFloor();accept();
  assert.equal(c.state.floors.length,2);c.undo();
  assert.equal(c.state.activeProjectId,p.id);assert.equal(c.state.activeFloorId,p.activeFloorId);assert.equal(c.state.floors.length,3);
  c.redo();assert.equal(c.state.activeProjectId,p.id);assert.equal(c.state.floors.length,2);
});
test('undo project deletion restores the removed project with all its floors',()=>{
  const {c,p,other,accept}=harness();c.switchBoard(p.id);c.deleteBoard();accept();
  assert.equal(c.state.projects.length,1);assert.equal(c.state.activeProjectId,other.id);
  c.undo();assert.equal(c.state.projects.length,2);assert.equal(c.state.activeProjectId,p.id);assert.equal(c.state.floors.length,3);
});
test('adding and duplicating floors preserve original content and attachments',()=>{
  const {c,p}=harness();c.switchBoard(p.id);
  c.state.elements.push({id:'wall',type:'wall',height:2.8},{id:'door',type:'door',wallId:'wall'});c.pushHistory();
  c.addFloor(true);
  assert.equal(c.state.floors.length,4);assert.equal(c.state.elements.length,2);
  assert.notEqual(c.state.elements[0].id,'wall');assert.equal(c.state.elements[1].wallId,c.state.elements[0].id);
  assert.equal(c.state.elements[1].floorId,c.state.activeFloorId);assert.equal(c.state.elements[1].projectId,p.id);
  c.undo();assert.equal(c.state.floors.length,3);assert.equal(c.state.elements[0].id,'wall');
});
