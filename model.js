/* Canonical file model. Editor accessors are views into this tree, never copies.
   Coordinates are metres; the existing renderer uses Z as the vertical axis. */
const VisualMakerModel = (() => {
  const VERSION = 4;
  const DEFAULT_HEIGHT = 2.7;
  const DEFAULT_SLAB = .15;
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
    return clone({schemaVersion:VERSION, name:state.projectName, activeProjectId:state.activeProjectId, projects:state.projects});
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
  function duplicateProject(source) {
    const copy = clone(source); copy.id = id('project');
    const floorIds = new Map(copy.floors.map(f => [f.id,id('floor')]));
    const elementIds = new Map(copy.floors.flatMap(f => f.elements).map(e => [e.id,id('el')]));
    copy.activeFloorId = floorIds.get(copy.activeFloorId);
    for (const f of copy.floors) {
      f.id = floorIds.get(f.id);
      for (const e of f.elements) {e.id = elementIds.get(e.id); e.projectId = copy.id; e.floorId = f.id; if (e.wallId) e.wallId = elementIds.get(e.wallId) || null;}
    }
    return copy;
  }
  return {VERSION, DEFAULT_HEIGHT, DEFAULT_SLAB, clone, id, floor, project, normalize, editorState, serialize, activeProject, activeFloor, floorLayout, footprint, duplicateProject};
})();
if (typeof module !== 'undefined') module.exports = VisualMakerModel;
