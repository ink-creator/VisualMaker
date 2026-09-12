/* Canonical file model. Editor accessors are views into this tree, never copies.
   Coordinates are metres; the existing renderer uses Z as the vertical axis. */
const VisualMakerModel = (() => {
  const VERSION = 4;
  const DEFAULT_HEIGHT = 2.7;
  const DEFAULT_SLAB = .15;
  const OBJECT_HEIGHTS={sofa:.85,bed:1.05,table:.75,desk:.75,toilet:.80,sink:1.10,plant:.90,pool:.12,tree:3,car:1.45,grill:.95,fridge:1.85,stove:.90,counter:.90,wardrobe:2.15,tv:.72,column:2.7,halfwall:1.10,slidingGate:1.85,doubleGate:1.85,pedestrianGate:1.90,pergola:2.60};
  function objectHeight(e,floor){return number(e.height, e.kind==='column'?(floor?.height||2.7):(OBJECT_HEIGHTS[e.kind]||.75),.05);}
  const clone = value => JSON.parse(JSON.stringify(value));
  const id = prefix => prefix + '-' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
  const number = (value, fallback, min = 0) => value != null && value !== '' && Number.isFinite(Number(value)) && Number(value) >= min ? Number(value) : fallback;
  const settings = value => ({gridSpacing:.5, gridOn:true, blueprintOn:false, palette:'technical', view3d:null, view2d:null, ...value});
  function floor(value = {}, projectId, index = 0) {
    value = clone(value || {});
    const result = {...value, id:value.id || id('floor'), name:value.name || null, level:index,
      height:number(value.height ?? value.floorHeight, DEFAULT_HEIGHT, .1),
      slabThickness:number(value.slabThickness, DEFAULT_SLAB), settings:{...value.settings},
      floorSurface:{enabled:true, material:'solid', color:null, ...value.floorSurface},
      elements:Array.isArray(value.elements) ? clone(value.elements).filter(e => e && typeof e === 'object') : []};
    delete result.elevation; // Always derived by floorLayout, never persisted independently.
    result.elements.forEach(e => {
      e.id ||= id('el'); e.projectId = projectId; e.floorId = result.id;
      if(e.type === 'wall') e.height = number(e.height, result.height, .1);
    });
    return result;
  }
  function project(value = {}, index = 0) {
    value = clone(value || {});
    const result = {...value, id:value.id || id('project'), name:value.name || null,
      settings:settings(value.settings)};
    result.settings.gridSpacing = number(result.settings.gridSpacing, .5, .01);
    // Accept files from the short-lived roof feature without retaining it.
    delete result.roof;
    if(result.settings.view3d)delete result.settings.view3d.showRoof;
    result.floors = (Array.isArray(value.floors) && value.floors.length ? value.floors : [{}]).map((f, i) => floor(f, result.id, i));
    result.activeFloorId = result.floors.some(f => f.id === value.activeFloorId) ? value.activeFloorId : result.floors[0].id;
    syncStairs(result);
    return result;
  }
  function normalize(data = {}) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid VisualMaker file');
    if (Number(data.schemaVersion) > VERSION) throw new Error('Unsupported VisualMaker version');
    let projects;
    if (Array.isArray(data.projects) && data.projects.length) {
      projects = data.projects.map(project);
    } else {
      // Before v4, “floors” were independent boards, not stacked storeys.
      const legacy = Array.isArray(data.floors) && data.floors.length ? clone(data.floors) : [{id:'floor-1'}];
      const elements = Array.isArray(data.elements) ? data.elements : [];
      for (const e of elements) if (e?.floorId && !legacy.some(f => f.id === e.floorId)) legacy.push({id:e.floorId});
      const fallback = legacy.some(f => f.id === data.activeFloorId) ? data.activeFloorId : legacy[0].id;
      projects = legacy.map(f => project({id:id('project'), name:f.name || null, settings:settings({
        gridSpacing:data.gridSpacing, gridOn:data.gridOn !== false, blueprintOn:!!data.blueprintOn,
        palette:data.palette || 'technical', view3d:data.view3d || null}),
        floors:[{elements:elements.filter(e => e && (e.floorId || fallback) === f.id)}]}));
      data = {...data, activeProjectId:projects[Math.max(0, legacy.findIndex(f => f.id === fallback))].id};
    }
    return {schemaVersion:VERSION, name:data.name || '', projects,
      activeProjectId:projects.some(p => p.id === data.activeProjectId) ? data.activeProjectId : projects[0].id};
  }
  const activeProject = file => file.projects.find(p => p.id === file.activeProjectId) || file.projects[0];
  const activeFloor = file => {const p = activeProject(file); return p.floors.find(f => f.id === p.activeFloorId) || p.floors[0];};
  function editorState(data = {}, storageId = null) {
    const file = normalize(data);
    const result = {projectId:storageId, projectName:file.name, projects:file.projects, activeProjectId:file.activeProjectId};
    const accessor = (key, get, set) => Object.defineProperty(result, key, {get, set});
    accessor('floors', () => activeProject(result).floors, value => {activeProject(result).floors = value;});
    accessor('activeFloorId', () => activeProject(result).activeFloorId, value => {activeProject(result).activeFloorId = value;});
    accessor('elements', () => activeFloor(result).elements, value => {activeFloor(result).elements = value;});
    for (const key of Object.keys(settings())) accessor(key, () => activeProject(result).settings[key], value => {activeProject(result).settings[key] = value;});
    return result;
  }
  function serialize(state) {
    const file=clone({schemaVersion:VERSION, name:state.projectName, activeProjectId:state.activeProjectId, projects:state.projects});
    file.projects.forEach(syncStairs);
    return file;
  }
  function floorLayout(project) {
    let elevation = 0;
    return project.floors.map((floor, index) => {
      const height = Math.max(number(floor.height, DEFAULT_HEIGHT, .1), ...floor.elements.filter(e => e.type === 'wall').map(e => number(e.height, floor.height || DEFAULT_HEIGHT, .1)));
      const slabThickness = number(floor.slabThickness, DEFAULT_SLAB);
      const entry = {floor, index, elevation, height, slabThickness, top:elevation + height};
      // The next slab's upper face is the next storey's zero.
      elevation += height + number(project.floors[index + 1]?.slabThickness, DEFAULT_SLAB);
      return entry;
    });
  }
  function footprint(floor) {
    const points = floor.elements.flatMap(e => e.type === 'wall' ? [[e.x1,e.y1],[e.x2,e.y2]] : e.type === 'room' ? [[e.x,e.y],[e.x+e.w,e.y+e.h]] : []).filter(p => p.every(Number.isFinite));
    if (!points.length) return null;
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs)-x, h = Math.max(...ys)-y;
    return w > .01 && h > .01 ? {x,y,w,h} : null;
  }
  function referenceFloors(project) {
    const index=project.floors.findIndex(f=>f.id===project.activeFloorId);
    return project.settings.ghostFloors ? project.floors.slice(0,Math.max(0,index)) : [];
  }
  // The source floor owns the stair. Riser height is derived, never independent
  // of the storey layout. A missing destination leaves an editable draft.
  function syncStairs(project) {
    const layout = floorLayout(project);
    for (const source of layout) for (const e of source.floor.elements) {
      if (e.type !== 'stair') continue;
      e.startFloorId = e.floorId = source.floor.id;
      e.projectId = project.id;
      e.width = number(e.width, 1, .3);
      e.length = number(e.length, 4.2, .5);
      e.stepCount = Math.max(2, Math.min(200, Math.round(number(e.stepCount, 16, 2))));
      e.stairType = e.stairType === 'u' ? 'u' : 'straight';
      if (e.stairType === 'u') e.length = Math.max(e.length, e.width + .5);
      e.rotation = Number.isFinite(Number(e.rotation)) ? Number(e.rotation) % 360 : 0;
      e.x = Number.isFinite(Number(e.x)) ? Number(e.x) : 0;
      e.y = Number.isFinite(Number(e.y)) ? Number(e.y) : 0;
      const end = layout.find(f => f.floor.id === e.endFloorId && f.index > source.index);
      e.endFloorId = end?.floor.id || null;
      e.riserHeight = end ? (end.elevation - source.elevation) / e.stepCount : 0;
    }
  }
  function stairGeometry(e, project) {
    const width = number(e.width, 1, .3), length = number(e.length, 4.2, .5);
    const isU = e.stairType === 'u', w = width * (isU ? 2 : 1), h = isU ? Math.max(length, width + .5) : length;
    const count = Math.max(2, Math.min(200, Math.round(number(e.stepCount, 16, 2))));
    const layout = floorLayout(project), start = layout.find(f => f.floor.id === e.floorId);
    const end = layout.find(f => f.floor.id === e.endFloorId && f.index > (start?.index ?? Infinity));
    const rise = start && end ? end.elevation - start.elevation : 0, riserHeight = rise / count;
    const angle = (e.rotation || 0) * Math.PI / 180, flip = e.mirrored ? -1 : 1;
    const world = (x,y) => ({x:e.x + flip*x*Math.cos(angle)-y*Math.sin(angle), y:e.y + flip*x*Math.sin(angle)+y*Math.cos(angle)});
    let outline = [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>world(x,y));
    if (e.mirrored) outline.reverse(); // CCW polygons for the slab clipping code.
    const steps = [], path = [];
    if (!isU) {
      for (let i=0;i<count;i++) steps.push({x:0,y:-h/2+(i+.5)*h/count,w:width,h:h/count,z:(i+1)*riserHeight});
      path.push([0,-h/2],[0,h/2]);
    } else {
      const n1=Math.floor(count/2), n2=count-n1, run=h-width;
      for(let i=0;i<n1;i++) steps.push({x:-width/2,y:-h/2+(i+.5)*run/n1,w:width,h:run/n1,z:(i+1)*riserHeight});
      steps.push({x:0,y:h/2-width/2,w,h:width,z:n1*riserHeight,landing:true});
      for(let i=0;i<n2;i++) steps.push({x:width/2,y:h/2-width-(i+.5)*run/n2,w:width,h:run/n2,z:(n1+i+1)*riserHeight});
      path.push([-width/2,-h/2],[-width/2,h/2-width/2],[width/2,h/2-width/2],[width/2,-h/2]);
    }
    return {w,h,count,rise,riserHeight,start,end,valid:!!end,world,outline,steps,path:path.map(([x,y])=>world(x,y))};
  }
  function stairOpenings(project, floorId) {
    const layout=floorLayout(project), index=layout.findIndex(f=>f.floor.id===floorId);
    return project.floors.flatMap(f=>f.elements).filter(e=>e.type==='stair').map(e=>stairGeometry(e,project))
      .filter(g=>g.valid && index>g.start.index && index<=g.end.index).map(g=>g.outline);
  }
  // Split a convex polygon at an oriented line. Extra numeric vertex attributes
  // (Z, color, normals) interpolate too, allowing finish meshes to use this path.
  function clipHalfPlane(poly, a, b, inside=true) {
    const side=p=>((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x))*(inside?1:-1);
    const result=[];
    for(let i=0;i<poly.length;i++) {
      const p=poly[i],q=poly[(i+1)%poly.length],dp=side(p),dq=side(q);
      if(dp>=0) result.push(p);
      if((dp>=0)!==(dq>=0)) {
        const t=dp/(dp-dq),v={};
        for(const key of Object.keys(p)) v[key]=p[key]+(q[key]-p[key])*t;
        result.push(v);
      }
    }
    return result;
  }
  function subtractOpenings(poly, holes) {
    let pieces=[poly];
    for(const hole of holes) {
      const next=[];
      for(const piece of pieces) {
        let remaining=piece;
        for(let i=0;i<hole.length && remaining.length>=3;i++) {
          const a=hole[i],b=hole[(i+1)%hole.length],outside=clipHalfPlane(remaining,a,b,false);
          if(outside.length>=3) next.push(outside);
          remaining=clipHalfPlane(remaining,a,b,true);
        }
      }
      pieces=next;
    }
    return pieces;
  }
  function duplicateProject(source) {
    const copy = clone(source); copy.id = id('project');
    const floorIds = new Map(copy.floors.map(f => [f.id,id('floor')]));
    const elementIds = new Map(copy.floors.flatMap(f => f.elements).map(e => [e.id,id('el')]));
    copy.activeFloorId = floorIds.get(copy.activeFloorId);
    for (const f of copy.floors) {
      f.id = floorIds.get(f.id);
      for (const e of f.elements) {e.id = elementIds.get(e.id); e.projectId = copy.id; e.floorId = f.id; if (e.wallId) e.wallId = elementIds.get(e.wallId) || null; if(e.type==='stair'){e.startFloorId=f.id;e.endFloorId=floorIds.get(e.endFloorId)||null;}}
    }
    return copy;
  }
  return {VERSION, DEFAULT_HEIGHT, DEFAULT_SLAB, objectHeight, clone, id, floor, project, normalize, editorState, serialize, activeProject, activeFloor, floorLayout, footprint, referenceFloors, duplicateProject, syncStairs, stairGeometry, stairOpenings, clipHalfPlane, subtractOpenings};
})();
if (typeof module !== 'undefined') module.exports = VisualMakerModel;
