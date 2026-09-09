const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../model.js');

function storageHarness(){
  const records=new Map();
  const context={state:M.editorState({name:'Portfolio'}),VisualMakerModel:M,unsavedChanges:true,
    console:{error(){}},t:key=>key,updateSaveButton(){},flashSaveIndicator(){},alert(){},
    window:{storage:{async set(key,value){records.set(key,{value});},async get(key){return records.get(key);}}}};
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../storage.js'),'utf8'),context);
  return {context,records};
}
test('actual storage saves and loads every project and floor under one file key',async()=>{
  const {context:c,records}=storageHarness();
  const p=M.activeProject(c.state);p.floors.push(M.floor({floorSurface:{material:'wood'},height:2.8},p.id,1));p.activeFloorId=p.floors[1].id;
  p.settings.gridSpacing=.25;
  const other=M.project({name:'Praia',floors:[{elements:[{id:'text',type:'text',content:'Olá'}]}]});c.state.projects.push(other);
  c.state.activeProjectId=other.id;
  c.window.get3DViewState=()=>({mode:'3d',camera:{target:{x:1,y:2,z:3}}});
  await c.saveProject(false);const fileId=c.state.projectId;
  assert.equal(records.size,1);assert.equal(c.unsavedChanges,false);
  const saved=JSON.parse(records.get('project:'+fileId).value);
  assert.equal(saved.schemaVersion,4);assert.equal(saved.projects.length,2);
  c.state=M.editorState();assert.equal(await c.loadProjectData(fileId),true);
  assert.equal(c.state.activeProjectId,other.id);assert.equal(c.state.elements[0].content,'Olá');
  assert.equal(c.state.projects[0].activeFloorId,p.activeFloorId);
  assert.equal(c.state.projects[0].floors[1].floorSurface.material,'wood');
  assert.equal(c.state.projects[0].settings.gridSpacing,.25);
  assert.deepEqual(M.serialize(c.state),(({updatedAt,...file})=>file)(saved));
});
test('storage errors and unsupported files do not discard the current file',async()=>{
  const {context:c,records}=storageHarness();
  c.window.storage.set=async()=>{throw new Error('quota');};
  await c.saveProject(false);assert.equal(c.unsavedChanges,true);
  const current=c.state;
  records.set('project:future',{value:JSON.stringify({schemaVersion:999,projects:[{}]})});
  assert.equal(await c.loadProjectData('future'),false);assert.equal(c.state,current);
  assert.equal(await c.loadProjectData('absent'),false);assert.equal(c.state,current);
});
test('storage loads v3 files through the same migration used by JSON import',async()=>{
  const {context:c,records}=storageHarness();
  records.set('project:legacy',{value:JSON.stringify({schemaVersion:3,name:'Legacy',floors:[{id:'a'},{id:'b'}],activeFloorId:'b',elements:[{id:'w',floorId:'b',type:'wall',height:3.1}]})});
  assert.equal(await c.loadProjectData('legacy'),true);assert.equal(c.state.projects.length,2);
  assert.equal(c.state.elements[0].id,'w');assert.equal(c.state.floors[0].level,0);
});
