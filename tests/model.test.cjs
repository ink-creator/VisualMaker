const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../model.js');

const wall = (id, height = 2.8) => ({id,type:'wall',x1:0,y1:0,x2:4,y2:0,height,thickness:.15});
test('legacy flat files become Project 1 / Floor 1 with safe defaults', () => {
  const state = M.editorState({name:'Old plan',elements:[wall('w'),{id:'d',type:'door',wallId:'w'}]});
  assert.equal(state.projects.length,1); assert.equal(state.floors.length,1);
  assert.equal(state.elements[1].wallId,'w');
  assert.equal(state.elements[1].projectId,state.activeProjectId);
  assert.equal(state.elements[1].floorId,state.activeFloorId);
  assert.equal(state.gridSpacing,.5); assert.equal('roof' in M.activeProject(state),false);
  assert.equal(M.floorLayout(M.activeProject(state))[0].elevation,0);
});
test('old independent floors migrate to independent projects without losing orphaned floor content', () => {
  const state=M.editorState({schemaVersion:3,activeFloorId:'b',floors:[{id:'a',name:'Casa'},{id:'b',name:'Praia'}],elements:[{...wall('a'),floorId:'a'},{...wall('b'),floorId:'b'},{...wall('orphan'),floorId:'c'},wall('missing')]});
  assert.equal(state.projects.length,3);assert.equal(M.activeProject(state).name,'Praia');
  assert.deepEqual(state.elements.map(e=>e.id),['b','missing']);
  assert.equal(state.projects.flatMap(p=>p.floors.flatMap(f=>f.elements)).length,4);
});
test('canonical active accessors cannot change another floor or project', () => {
  const state=M.editorState();const first=M.activeProject(state),f1=state.activeFloorId;
  state.elements.push(wall('first'));
  const f2=M.floor({},first.id);state.floors.push(f2);state.activeFloorId=f2.id;
  state.elements.push(wall('second'));state.elements=state.elements.filter(e=>e.id!=='second');
  state.activeFloorId=f1;assert.equal(state.elements[0].id,'first');
  const other=M.project();state.projects.push(other);state.activeProjectId=other.id;
  state.palette='coastal';state.gridSpacing=.25;state.elements.push(wall('other'));
  state.activeProjectId=first.id;
  assert.equal(state.palette,'technical');assert.equal(state.gridSpacing,.5);assert.equal(state.elements[0].id,'first');
});
test('heights accumulate wall height and next slab thickness, including tall walls', () => {
  const p=M.project({floors:[{height:2.8,elements:[wall('w',3.2)]},{height:2.8,slabThickness:.2},{height:3,slabThickness:.1}]});
  const entries=M.floorLayout(p);
  assert.ok(Math.abs(entries[1].elevation-3.4)<1e-9);
  assert.ok(Math.abs(entries[2].elevation-6.3)<1e-9);
  assert.ok(Math.abs(entries[2].top-9.3)<1e-9);
});
test('duplication deeply isolates settings, floors and remaps opening attachments', () => {
  const p=M.project({floors:[{elements:[wall('w'),{id:'d',type:'door',wallId:'w'}]}]});
  const copy=M.duplicateProject(p);const f=copy.floors[0];
  assert.notEqual(copy.id,p.id);assert.notEqual(f.id,p.floors[0].id);
  assert.equal(f.elements[1].wallId,f.elements[0].id);assert.notEqual(f.elements[0].id,'w');
  assert.equal(f.elements[1].projectId,copy.id);assert.equal(f.elements[1].floorId,f.id);
  f.elements[0].x1=5;copy.settings.palette='mono';
  assert.equal(p.floors[0].elements[0].x1,0);assert.equal(p.settings.palette,'technical');
});
test('file round trip preserves all projects, selected floors, materials, text and camera', () => {
  const p=M.project({name:'Casa',settings:{view3d:{mode:'3d',camera:{target:{x:1,y:2,z:5}}}},roof:{enabled:true},floors:[{elements:[wall('w'),{id:'text',type:'text',content:'Sala'}]},{floorSurface:{material:'wood',color:'#123456'},height:2.8}]});
  p.activeFloorId=p.floors[1].id;
  const state=M.editorState({name:'Portfolio',projects:[p,M.project({name:'Praia'})],activeProjectId:p.id});
  const saved=M.serialize(state),restored=M.editorState(JSON.parse(JSON.stringify(saved)),'saved-id');
  assert.deepEqual(M.serialize(restored),saved);assert.equal(restored.projectId,'saved-id');
  assert.equal(restored.activeFloorId,p.activeFloorId);
  assert.equal(M.activeFloor(restored).floorSurface.material,'wood');
});
test('invalid numeric defaults stay finite, future versions fail without migration', () => {
  const state=M.editorState({projects:[{settings:{gridSpacing:0},floors:[{height:-1,slabThickness:null,elements:[]}]}]});
  assert.equal(state.gridSpacing,.5);assert.equal(state.floors[0].height,M.DEFAULT_HEIGHT);
  assert.equal(state.floors[0].slabThickness,M.DEFAULT_SLAB);
  assert.throws(()=>M.editorState({schemaVersion:999,projects:[{}]}));
});
test('restoring history isolates nested camera and mirror settings from snapshots',()=>{
  const state=M.editorState({projects:[{settings:{mirror:{axisX:3},view3d:{camera:{target:{z:4}}}}}]});
  const snapshot=M.serialize(state),restored=M.editorState(snapshot);
  M.activeProject(restored).settings.mirror.axisX=9;
  restored.view3d.camera.target.z=12;
  assert.equal(snapshot.projects[0].settings.mirror.axisX,3);
  assert.equal(snapshot.projects[0].settings.view3d.camera.target.z,4);
});
test('walls missing height inherit the floor default used by 3D',()=>{
  const state=M.editorState({projects:[{floors:[{height:3.2,elements:[{id:'w',type:'wall'}]}]}]});
  assert.equal(state.elements[0].height,3.2);
});

test('files with removed roof settings still load and save without a roof',()=>{
  const state=M.editorState({projects:[{roof:{enabled:true},settings:{view3d:{showRoof:true,mode:'3d'}}}]});
  const file=M.serialize(state);
  assert.equal('roof' in file.projects[0],false);
  assert.equal('showRoof' in file.projects[0].settings.view3d,false);
  assert.equal(file.projects[0].settings.view3d.mode,'3d');
});
