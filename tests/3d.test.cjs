const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const M=require('../model.js');

function fixture(){
  const elements=[
    {id:'w1',type:'wall',x1:0,y1:0,x2:6,y2:0,height:2.8,thickness:.15},
    {id:'w2',type:'wall',x1:6,y1:0,x2:6,y2:5,height:2.8,thickness:.15},
    {id:'w3',type:'wall',x1:6,y1:5,x2:0,y2:5,height:2.8,thickness:.15},
    {id:'w4',type:'wall',x1:0,y1:5,x2:0,y2:0,height:2.8,thickness:.15},
    {id:'d',type:'door',x:2,y:0,width:.9,height:2.1,wallId:'w1',wallT:1/3,angle:0},
    {id:'win',type:'window',x:4,y:0,width:1.2,height:1.2,sillHeight:.9,wallId:'w1',wallT:2/3,angle:0},
    {id:'sofa',type:'object',kind:'sofa',x:3,y:3,w:2.1,h:.85,rotation:0,elevation:.1},
    {id:'room',type:'room',x:.2,y:.2,w:2,h:2,name:'Sala',material:'tile'},
    {id:'txt',type:'text',x:3,y:4,content:'Teste',size:16}
  ];
  const p=M.project({name:'Casa Principal',floors:[{height:2.8,elements},{height:2.8,elements},{height:2.8,elements,floorSurface:{material:'wood'}}]});
  p.activeFloorId=p.floors[2].id;
  const other=M.duplicateProject(p);other.name='Casa de Praia';other.floors.splice(1);other.activeFloorId=other.floors[0].id;
  return M.editorState({name:'VisualMaker regression',projects:[p,other],activeProjectId:p.id});
}
function harness(state=fixture()){
  const noop=()=>{};
  const gl=new Proxy({}, {get:(_,key)=>key==='getShaderParameter'||key==='getProgramParameter'?()=>true:key.toUpperCase()===key?1:noop});
  const nodes=new Map();
  function node(){return {value:'',checked:false,textContent:'',style:{},classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},addEventListener:noop,setAttribute:noop,appendChild:noop,replaceChildren:noop,getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0,width:1000,height:800}),lastChild:{textContent:''}};}
  const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);},createElement:node,body:node(),documentElement:node()};
  const context={console,state,document,VisualMakerModel:M,selectedId:null,Math,Float32Array,Uint8Array,Blob,TextEncoder,DataView,setTimeout:noop,requestAnimationFrame:noop,
    activeProject:()=>M.activeProject(context.state),activeFloor:()=>M.activeFloor(context.state),
    getActiveFloorElements:()=>context.state.elements,getElement:id=>context.state.elements.find(e=>e.id===id),
    floorDisplayName:(f,i)=>f.name||'Andar '+(i+1),projectDisplayName:(p,i)=>p.name||'Projeto '+(i+1),
    getPalette:()=>({room:'#DCE6F2',object:'#F8FAFC',stroke:'#44566C'}),floorMaterialBase:r=>r.color||(r.material==='wood'?'#B88962':'#DCE6F2'),
    t:key=>key,formatMeters:n=>n+' m',getAssetLabel:kind=>kind,elementBelongsToFloor:(el,id)=>el.floorId===id,
    activateTool:noop,render:noop,updatePropertiesPanel:noop};
  context.window={addEventListener:noop,devicePixelRatio:1,getCurrentLanguage:()=> 'pt-BR'};
  vm.createContext(context);
  const source=fs.readFileSync(path.join(__dirname,'../view3d.js'),'utf8').replace(/\}\)\(\);\s*$/, 'window.test3d={buildExportScene,buildStandalone3DHTML,meshToOBJMTL,canvasRay,projectWorld,pickEditableAt,resetCamera,objectRayDistance};})();');
  vm.runInContext(source,context);
  return {context,api:context.window.test3d};
}
const heights=arr=>arr.filter((_,i)=>i%7===2);
test('3D mesh stacks every floor and preserves identical local opening/object geometry',()=>{
  const {context,api}=harness(),mesh=api.buildExportScene(),layout=M.floorLayout(M.activeProject(context.state));
  assert.equal(mesh.floors.length,3);
  for(let n=0;n<2;n++){
    const range=mesh.floors[n],vertices=mesh.opaque.slice(range.opaqueStart,range.opaqueEnd),zs=heights(vertices);
    assert.ok(Math.abs(Math.min(...zs)-(layout[n].elevation-.15))<1e-9);
    assert.ok(Math.abs(Math.max(...zs)-layout[n].top)<1e-9);
  }
  const a=mesh.floors[0],b=mesh.floors[1];assert.equal(a.opaqueEnd-a.opaqueStart,b.opaqueEnd-b.opaqueStart);
  for(let i=0;i<a.opaqueEnd-a.opaqueStart;i++)assert.ok(Math.abs(mesh.opaque[b.opaqueStart+i]-mesh.opaque[a.opaqueStart+i]-(i%7===2?2.95:0))<1e-8);
  assert.ok(mesh.transparent.length>0);assert.ok(Math.abs(Math.max(...heights(mesh.opaque))-8.7)<1e-9);
  assert.ok(mesh.opaque.every(Number.isFinite));assert.ok(mesh.transparent.every(Number.isFinite));
});
test('surface switch affects geometry while old roof settings are ignored',()=>{
  const {context,api}=harness(),p=M.activeProject(context.state),full=api.buildExportScene();
  p.roof={enabled:true,type:'gable',height:4};
  assert.deepEqual(api.buildExportScene().opaque,full.opaque);
  delete p.roof;
  p.floors[2].floorSurface.enabled=false;
  assert.ok(api.buildExportScene().opaque.length<full.opaque.length);
});
test('upper floor projection and picking use the same elevation and only select active elements',()=>{
  const {context,api}=harness();api.resetCamera(false);
  const sofa=context.state.elements.find(e=>e.id==='sofa');
  const point=api.projectWorld({x:sofa.x,y:sofa.y,z:.5});
  const ray=api.canvasRay(point.x,point.y);
  assert.ok(Number.isFinite(api.objectRayDistance(ray,sofa)));
  const picked=api.pickEditableAt(point.x,point.y);assert.equal(picked.id,'sofa');
  assert.equal(picked.floorId,context.state.activeFloorId);
});
test('offline HTML contains every project, storey, source data and working inline script',()=>{
  const {context,api}=harness(),html=api.buildStandalone3DHTML(api.buildExportScene());
  assert.doesNotMatch(html,/<script[^>]+src=|<link[^>]+href=/i);
  const data=JSON.parse(html.match(/<script id="visual-maker-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(data.projects.length,2);assert.equal(data.projects[0].floors.length,3);assert.equal(data.projects[1].floors.length,1);
  assert.deepEqual(data.source,M.serialize(context.state));
  assert.doesNotMatch(html,/showRoof|id="roof"|\"roof\":/);
  const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];new vm.Script(script);
  context.document.getElementById('visual-maker-data').textContent=JSON.stringify(data);context.devicePixelRatio=1;
  vm.runInContext(script,context); // Includes draw and all select bindings.
  const dir=path.join(__dirname,'.generated');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'viewer.html'),html);fs.writeFileSync(path.join(dir,'fixture.visualmaker.json'),JSON.stringify(data.source,null,2));
});
test('HTML safely serializes project names containing markup',()=>{
  const {context,api}=harness();context.state.projectName='</script><script>alert(1)</script>';
  context.state.projects[0].name=context.state.projectName;
  const html=api.buildStandalone3DHTML(api.buildExportScene());
  assert.equal((html.match(/<script>/g)||[]).length,1);
  assert.doesNotMatch(html,/<script>alert/);
});
test('OBJ includes all floors at metre scale',()=>{
  const {api}=harness(),mesh=api.buildExportScene(),result=api.meshToOBJMTL(mesh,'test','test.mtl');
  assert.ok(result.obj.includes('mtllib test.mtl'));assert.ok(result.mtl.includes('newmtl'));
  const z=result.obj.split('\n').filter(l=>l.startsWith('v ')).map(l=>Number(l.split(' ')[3]));
  assert.ok(Math.abs(Math.max(...z)-8.7)<1e-6);
});
