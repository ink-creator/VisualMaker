/* view3d.js
   Visualização 3D sincronizada com o editor 2D.
   Renderização WebGL com depth buffer real para evitar objetos aparecendo
   através das paredes. Sem dependências externas.
   1 unidade do mundo = 1 metro. */
(function(){
  'use strict';

  const canvas=document.getElementById('canvas-3d');
  const help=document.getElementById('viewer3d-help');
  const btn2d=document.getElementById('btn-view-2d');
  const btn3d=document.getElementById('btn-view-3d');
  const resetBtn=document.getElementById('viewer3d-reset');
  const hideFrontBtn=document.getElementById('viewer3d-hide-front');
  const selectionInfo=document.getElementById('viewer3d-selection');
  if(!canvas || !btn2d || !btn3d) return;

  const gl=canvas.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false});
  if(!gl){
    btn3d.disabled=true;
    btn3d.title='O navegador não oferece suporte a WebGL.';
    return;
  }

  let mode='2d';
  let yaw=-0.72;
  let pitch=0.66;
  let distance=16;
  let target={x:0,y:0,z:1};
  let drag=null;
  let interaction=null;
  let hoverObjectId=null;
  let hideFrontWalls=false;
  let cameraInitialized=false;

  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rad=d=>d*Math.PI/180;
  const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
  const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
  const mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
  const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
  const norm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return {x:a.x/n,y:a.y/n,z:a.z/n};};
  const rotateZ=(p,a)=>{const c=Math.cos(a),s=Math.sin(a);return {x:p.x*c-p.y*s,y:p.x*s+p.y*c,z:p.z};};

  function hexToRgb01(hex){
    const h=(hex||'').trim();
    let r=205,g=208,b=210;
    if(/^#[0-9a-f]{3}$/i.test(h)){
      r=parseInt(h[1]+h[1],16);g=parseInt(h[2]+h[2],16);b=parseInt(h[3]+h[3],16);
    } else if(/^#[0-9a-f]{6}$/i.test(h)){
      r=parseInt(h.slice(1,3),16);g=parseInt(h.slice(3,5),16);b=parseInt(h.slice(5,7),16);
    }
    return [r/255,g/255,b/255];
  }
  function shadeColor(hex,factor,alpha=1){
    const c=hexToRgb01(hex);
    return [clamp(c[0]*factor,0,1),clamp(c[1]*factor,0,1),clamp(c[2]*factor,0,1),alpha];
  }
  function vary(hex,factor){
    const c=hexToRgb01(hex);
    const toHex=v=>Math.round(clamp(v,0,1)*255).toString(16).padStart(2,'0');
    return `#${toHex(c[0]*factor)}${toHex(c[1]*factor)}${toHex(c[2]*factor)}`;
  }

  function compileShader(type,source){
    const shader=gl.createShader(type);
    gl.shaderSource(shader,source);
    gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
      const msg=gl.getShaderInfoLog(shader)||'Erro ao compilar shader.';
      gl.deleteShader(shader);
      throw new Error(msg);
    }
    return shader;
  }
  function createProgram(vsSource,fsSource){
    const program=gl.createProgram();
    gl.attachShader(program,compileShader(gl.VERTEX_SHADER,vsSource));
    gl.attachShader(program,compileShader(gl.FRAGMENT_SHADER,fsSource));
    gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program)||'Erro ao criar programa WebGL.');
    return program;
  }

  const program=createProgram(`
    attribute vec3 aPosition;
    attribute vec4 aColor;
    uniform mat4 uMVP;
    varying vec4 vColor;
    void main(){
      gl_Position=uMVP*vec4(aPosition,1.0);
      vColor=aColor;
    }
  `,`
    precision mediump float;
    varying vec4 vColor;
    void main(){ gl_FragColor=vColor; }
  `);

  const aPosition=gl.getAttribLocation(program,'aPosition');
  const aColor=gl.getAttribLocation(program,'aColor');
  const uMVP=gl.getUniformLocation(program,'uMVP');
  const buffer=gl.createBuffer();
  const STRIDE=7;

  function mat4Perspective(fovy,aspect,near,far){
    const f=1/Math.tan(fovy/2),nf=1/(near-far);
    return new Float32Array([
      f/aspect,0,0,0,
      0,f,0,0,
      0,0,(far+near)*nf,-1,
      0,0,(2*far*near)*nf,0
    ]);
  }
  function mat4LookAt(eye,center,up){
    const z=norm(sub(eye,center));
    const x=norm(cross(up,z));
    const y=cross(z,x);
    return new Float32Array([
      x.x,y.x,z.x,0,
      x.y,y.y,z.y,0,
      x.z,y.z,z.z,0,
      -dot(x,eye),-dot(y,eye),-dot(z,eye),1
    ]);
  }
  function mat4Multiply(a,b){
    const out=new Float32Array(16);
    for(let c=0;c<4;c++){
      for(let r=0;r<4;r++){
        out[c*4+r]=a[0*4+r]*b[c*4+0]+a[1*4+r]*b[c*4+1]+a[2*4+r]*b[c*4+2]+a[3*4+r]*b[c*4+3];
      }
    }
    return out;
  }

  function contentBBox(){
    if(!state.elements.length) return {minX:-4,maxX:4,minY:-4,maxY:4};
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    const include=(x,y)=>{if(Number.isFinite(x)&&Number.isFinite(y)){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}};
    for(const e of state.elements){
      if('x1' in e){include(e.x1,e.y1);include(e.x2,e.y2);}
      else if(e.type==='room'){include(e.x,e.y);include(e.x+e.w,e.y+e.h);}
      else if('x' in e){const hw=(e.w||e.width||.4)/2,hh=(e.h||e.width||.4)/2;include(e.x-hw,e.y-hh);include(e.x+hw,e.y+hh);}
    }
    if(!Number.isFinite(minX)) return {minX:-4,maxX:4,minY:-4,maxY:4};
    return {minX,maxX,minY,maxY};
  }

  function markViewChanged(){
    // Movimento de câmera não entra no histórico de elementos, mas passa
    // a ser uma alteração salvável do projeto. Marcamos o projeto como
    // pendente para o aviso de saída também proteger a vista 3D.
    if(typeof markUnsaved==='function' && typeof unsavedChanges!=='undefined' && !unsavedChanges){
      markUnsaved();
    }
  }

  function resetCamera(markChanged=true){
    const b=contentBBox();
    target={x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:1.05};
    const span=Math.max(3,b.maxX-b.minX,b.maxY-b.minY);
    distance=span*1.7+4.5;
    yaw=-0.72; pitch=0.66;
    cameraInitialized=true;
    if(mode==='3d')draw();
    if(markChanged)markViewChanged();
  }

  function finiteOr(value,fallback){
    return Number.isFinite(Number(value))?Number(value):fallback;
  }

  function get3DViewState(){
    return {
      version:1,
      mode,
      camera:cameraInitialized?{
        yaw,
        pitch,
        distance,
        target:{x:target.x,y:target.y,z:target.z}
      }:null,
      hideFrontWalls:!!hideFrontWalls
    };
  }

  function restore3DViewState(saved,options){
    const opts=options||{};
    const data=saved&&typeof saved==='object'?saved:null;
    // Aceita tanto a estrutura v1 quanto uma eventual estrutura plana
    // usada durante desenvolvimento, para não quebrar projetos de teste.
    const cam=data&&(data.camera&&typeof data.camera==='object'?data.camera:
      (Number.isFinite(Number(data.yaw))?data:null));

    if(cam){
      yaw=finiteOr(cam.yaw,-0.72);
      pitch=clamp(finiteOr(cam.pitch,0.66),.12,1.45);
      distance=clamp(finiteOr(cam.distance,16),2.8,180);
      const savedTarget=cam.target&&typeof cam.target==='object'?cam.target:{};
      target={
        x:finiteOr(savedTarget.x,0),
        y:finiteOr(savedTarget.y,0),
        z:finiteOr(savedTarget.z,1)
      };
      cameraInitialized=true;
    }else{
      cameraInitialized=false;
      yaw=-0.72; pitch=0.66; distance=16; target={x:0,y:0,z:1};
    }

    hideFrontWalls=!!(data&&data.hideFrontWalls);
    updateHideFrontButton();

    if(opts.restoreMode){
      setMode(data&&data.mode==='3d'?'3d':'2d',{markChanged:false,preserveCamera:true});
    }else if(mode==='3d'){
      if(!cameraInitialized)resetCamera(false);
      else draw();
    }
  }
  function cameraEye(){
    const cp=Math.cos(pitch),sp=Math.sin(pitch);
    return {
      x:target.x+distance*cp*Math.cos(yaw),
      y:target.y+distance*cp*Math.sin(yaw),
      z:target.z+distance*sp
    };
  }


  function selectedObject(){
    const el=selectedId?getElement(selectedId):null;
    return el&&el.type==='object'?el:null;
  }
  function updateSelectionInfo(){
    if(!selectionInfo)return;
    const el=selectedObject();
    if(!el){
      selectionInfo.textContent='Nenhum objeto selecionado';
      return;
    }
    const z=objectElevation(el);
    const rot=((el.rotation||0)%360+360)%360;
    selectionInfo.textContent=`${el.label||'Objeto'} · X ${el.x.toFixed(2)} m · Y ${el.y.toFixed(2)} m · Z ${z.toFixed(2)} m · ${Math.round(rot)}°`;
  }

  function canvasRay(clientX,clientY){
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return null;
    const ndcX=((clientX-rect.left)/rect.width)*2-1;
    const ndcY=1-((clientY-rect.top)/rect.height)*2;
    const eye=cameraEye();
    const forward=norm(sub(target,eye));
    const right=norm(cross(forward,{x:0,y:0,z:1}));
    const up=norm(cross(right,forward));
    const tan=Math.tan(rad(47)/2);
    const aspect=rect.width/rect.height;
    const dir=norm(add(forward,add(mul(right,ndcX*tan*aspect),mul(up,ndcY*tan))));
    return {origin:eye,dir};
  }
  function rayPlaneZ(ray,z){
    if(!ray||Math.abs(ray.dir.z)<1e-6)return null;
    const t=(z-ray.origin.z)/ray.dir.z;
    if(t<0)return null;
    return add(ray.origin,mul(ray.dir,t));
  }
  function rotateXYInverse(v,a){
    const c=Math.cos(a),ss=Math.sin(a);
    return {x:v.x*c+v.y*ss,y:-v.x*ss+v.y*c,z:v.z};
  }
  function rayLocalBoxDistance(ray,cx,cy,z0,sx,sy,sz,rotation){
    if(!ray||sx<=0||sy<=0||sz<=0)return Infinity;
    const a=rotation||0;
    const ro=rotateXYInverse({x:ray.origin.x-cx,y:ray.origin.y-cy,z:ray.origin.z-z0-sz/2},a);
    const rd=rotateXYInverse(ray.dir,a);
    const min={x:-sx/2,y:-sy/2,z:-sz/2},max={x:sx/2,y:sy/2,z:sz/2};
    let tmin=-Infinity,tmax=Infinity;
    for(const axis of ['x','y','z']){
      const o=ro[axis],d=rd[axis];
      if(Math.abs(d)<1e-8){
        if(o<min[axis]||o>max[axis])return Infinity;
        continue;
      }
      let t1=(min[axis]-o)/d,t2=(max[axis]-o)/d;
      if(t1>t2){const tmp=t1;t1=t2;t2=tmp;}
      tmin=Math.max(tmin,t1);tmax=Math.min(tmax,t2);
      if(tmin>tmax)return Infinity;
    }
    if(tmax<0)return Infinity;
    return tmin>=0?tmin:tmax;
  }
  function objectVisualHeight(e){
    const heights={
      sofa:.92,bed:1.02,table:.82,desk:.98,toilet:.86,sink:.93,plant:1.18,
      pool:.46,tree:3.25,car:1.42,grill:1.12,fridge:1.92,stove:.98,
      counter:1.08,wardrobe:2.12,tv:.82,column:2.72,halfwall:1.08,
      slidingGate:1.9,doubleGate:1.9,pedestrianGate:1.95,pergola:2.64
    };
    return heights[e.kind]||.72;
  }
  function objectRayDistance(ray,e){
    const z=objectElevation(e),h=objectVisualHeight(e);
    const pad=Math.max(.035,Math.min(.12,Math.min(e.w||1,e.h||1)*.08));
    return rayLocalBoxDistance(ray,e.x,e.y,z,(e.w||1)+pad,(e.h||1)+pad,h,rad(e.rotation||0));
  }
  function wallRayDistance(ray,wall){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
    if(L<.02)return Infinity;
    const eye=cameraEye();
    if(shouldHideFrontWall(wall,eye))return Infinity;
    return rayLocalBoxDistance(ray,(wall.x1+wall.x2)/2,(wall.y1+wall.y2)/2,0,L,wall.thickness||.15,wall.height||2.7,Math.atan2(dy,dx));
  }
  function pickObjectAt(clientX,clientY){
    const ray=canvasRay(clientX,clientY);if(!ray)return null;
    let wallT=Infinity;
    for(const w of state.elements){
      if(w.type!=='wall')continue;
      wallT=Math.min(wallT,wallRayDistance(ray,w));
    }
    let best=null,bestT=Infinity;
    for(const e of state.elements){
      if(e.type!=='object')continue;
      const t=objectRayDistance(ray,e);
      if(t<bestT&&t<=wallT+.025){best=e;bestT=t;}
    }
    return best;
  }
  function projectWorld(p){
    const rect=canvas.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return null;
    const eye=cameraEye(),forward=norm(sub(target,eye));
    const right=norm(cross(forward,{x:0,y:0,z:1}));
    const up=norm(cross(right,forward));
    const rel=sub(p,eye),z=dot(rel,forward);
    if(z<=.03)return null;
    const tan=Math.tan(rad(47)/2),aspect=rect.width/rect.height;
    const nx=dot(rel,right)/(z*tan*aspect),ny=dot(rel,up)/(z*tan);
    return {
      x:rect.left+(nx*.5+.5)*rect.width,
      y:rect.top+(1-(ny*.5+.5))*rect.height,
      z
    };
  }
  function pointSegmentDistance(px,py,a,b){
    if(!a||!b)return Infinity;
    const dx=b.x-a.x,dy=b.y-a.y,L2=dx*dx+dy*dy;
    if(L2<1e-6)return Math.hypot(px-a.x,py-a.y);
    const t=clamp(((px-a.x)*dx+(py-a.y)*dy)/L2,0,1);
    return Math.hypot(px-(a.x+t*dx),py-(a.y+t*dy));
  }
  function gizmoGeometry(e){
    const z0=objectElevation(e),h=objectVisualHeight(e);
    const top=z0+h;
    const axisLen=clamp(Math.max(.65,Math.max(e.w||1,e.h||1)*.42),.65,1.45);
    const ringRadius=Math.max(.48,Math.hypot(e.w||1,e.h||1)/2+.18);
    return {z0,h,top,axisLen,ringRadius};
  }
  function gizmoHitAt(clientX,clientY,e){
    if(!e)return null;
    const g=gizmoGeometry(e);
    const zA=projectWorld({x:e.x,y:e.y,z:g.top+.06});
    const zB=projectWorld({x:e.x,y:e.y,z:g.top+g.axisLen});
    if(pointSegmentDistance(clientX,clientY,zA,zB)<=11)return 'elevation';

    let prev=null,best=Infinity;
    const ringZ=g.z0+.055;
    for(let i=0;i<=44;i++){
      const a=i/44*Math.PI*2;
      const p=projectWorld({x:e.x+Math.cos(a)*g.ringRadius,y:e.y+Math.sin(a)*g.ringRadius,z:ringZ});
      if(prev&&p)best=Math.min(best,pointSegmentDistance(clientX,clientY,prev,p));
      prev=p;
    }
    if(best<=10)return 'rotation';
    return null;
  }

  function moveCameraPlanar(forwardAmount,rightAmount){
    // Move o alvo e, por consequência, a câmera inteira sem alterar o ângulo.
    const fx=-Math.cos(yaw),fy=-Math.sin(yaw);
    const rx=-Math.sin(yaw),ry=Math.cos(yaw);
    target.x+=fx*forwardAmount+rx*rightAmount;
    target.y+=fy*forwardAmount+ry*rightAmount;
    cameraInitialized=true;
    draw();
    markViewChanged();
  }
  function updateHideFrontButton(){
    if(!hideFrontBtn)return;
    hideFrontBtn.textContent=hideFrontWalls?'Mostrar frente':'Ocultar frente';
    hideFrontBtn.setAttribute('aria-pressed',String(hideFrontWalls));
  }
  function shouldHideFrontWall(wall,eye){
    if(!hideFrontWalls)return false;
    const cx=(wall.x1+wall.x2)/2,cy=(wall.y1+wall.y2)/2;
    const cam2=norm({x:eye.x-target.x,y:eye.y-target.y,z:0});
    const rel={x:cx-target.x,y:cy-target.y,z:0};
    // Só paredes no lado da câmera e com face razoavelmente voltada a ela.
    if(dot(rel,cam2)<0.12)return false;
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,len=Math.hypot(dx,dy)||1;
    const normal={x:-dy/len,y:dx/len,z:0};
    const toEye=norm({x:eye.x-cx,y:eye.y-cy,z:0});
    return Math.abs(dot(normal,toEye))>.24;
  }

  function resize(){
    const r=canvas.getBoundingClientRect();
    if(r.width<2||r.height<2) return null;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const w=Math.max(2,Math.round(r.width*dpr));
    const h=Math.max(2,Math.round(r.height*dpr));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);
    return {w,h,cssW:r.width,cssH:r.height};
  }

  function addVertex(arr,p,color){arr.push(p.x,p.y,p.z,color[0],color[1],color[2],color[3]);}
  function faceNormal(a,b,c){return norm(cross(sub(b,a),sub(c,a)));}
  const LIGHT=norm({x:-.55,y:-.75,z:1.25});

  function addTriangle(mesh,a,b,c,colorHex,alpha=1,normalOverride=null){
    const n=normalOverride||faceNormal(a,b,c);
    const lit=.68+.32*Math.max(0,dot(n,LIGHT));
    const color=shadeColor(colorHex,lit,alpha);
    const targetArr=alpha<.999?mesh.transparent:mesh.opaque;
    addVertex(targetArr,a,color);addVertex(targetArr,b,color);addVertex(targetArr,c,color);
  }
  function addQuad(mesh,a,b,c,d,colorHex,alpha=1,normalOverride=null){
    addTriangle(mesh,a,b,c,colorHex,alpha,normalOverride);
    addTriangle(mesh,a,c,d,colorHex,alpha,normalOverride);
  }

  function addBox(mesh,cx,cy,cz,sx,sy,sz,colorHex,rotation=0,alpha=1){
    if(sx<=.002||sy<=.002||sz<=.002)return;
    const hx=sx/2,hy=sy/2,hz=sz/2;
    const raw=[
      {x:-hx,y:-hy,z:-hz},{x:hx,y:-hy,z:-hz},{x:hx,y:hy,z:-hz},{x:-hx,y:hy,z:-hz},
      {x:-hx,y:-hy,z:hz},{x:hx,y:-hy,z:hz},{x:hx,y:hy,z:hz},{x:-hx,y:hy,z:hz}
    ];
    const v=raw.map(p=>{const r=rotateZ(p,rotation);return {x:r.x+cx,y:r.y+cy,z:r.z+cz};});
    const nDown=rotateZ({x:0,y:0,z:-1},rotation),nUp=rotateZ({x:0,y:0,z:1},rotation);
    const nFront=rotateZ({x:0,y:-1,z:0},rotation),nRight=rotateZ({x:1,y:0,z:0},rotation),nBack=rotateZ({x:0,y:1,z:0},rotation),nLeft=rotateZ({x:-1,y:0,z:0},rotation);
    addQuad(mesh,v[0],v[3],v[2],v[1],colorHex,alpha,nDown);
    addQuad(mesh,v[4],v[5],v[6],v[7],colorHex,alpha,nUp);
    addQuad(mesh,v[0],v[1],v[5],v[4],colorHex,alpha,nFront);
    addQuad(mesh,v[1],v[2],v[6],v[5],colorHex,alpha,nRight);
    addQuad(mesh,v[2],v[3],v[7],v[6],colorHex,alpha,nBack);
    addQuad(mesh,v[3],v[0],v[4],v[7],colorHex,alpha,nLeft);
  }

  function addCylinder(mesh,cx,cy,z0,radius,height,colorHex,segments=14,alpha=1){
    if(radius<=.002||height<=.002)return;
    const z1=z0+height;
    const top={x:cx,y:cy,z:z1},bottom={x:cx,y:cy,z:z0};
    for(let i=0;i<segments;i++){
      const a0=i*Math.PI*2/segments,a1=(i+1)*Math.PI*2/segments;
      const p0={x:cx+Math.cos(a0)*radius,y:cy+Math.sin(a0)*radius,z:z0};
      const p1={x:cx+Math.cos(a1)*radius,y:cy+Math.sin(a1)*radius,z:z0};
      const q0={x:p0.x,y:p0.y,z:z1},q1={x:p1.x,y:p1.y,z:z1};
      const n=norm({x:Math.cos((a0+a1)/2),y:Math.sin((a0+a1)/2),z:0});
      addQuad(mesh,p0,p1,q1,q0,colorHex,alpha,n);
      addTriangle(mesh,top,q0,q1,colorHex,alpha,{x:0,y:0,z:1});
      addTriangle(mesh,bottom,p1,p0,colorHex,alpha,{x:0,y:0,z:-1});
    }
  }

  function addGrid(lines){
    const b=contentBBox(),pad=2;
    const minX=Math.floor(b.minX-pad),maxX=Math.ceil(b.maxX+pad),minY=Math.floor(b.minY-pad),maxY=Math.ceil(b.maxY+pad);
    const push=(a,b,color)=>{addVertex(lines,a,color);addVertex(lines,b,color);};
    for(let x=minX;x<=maxX;x++){
      const strong=x%5===0;
      push({x,y:minY,z:-.09},{x,y:maxY,z:-.09},strong?[.31,.40,.48,.25]:[.31,.40,.48,.11]);
    }
    for(let y=minY;y<=maxY;y++){
      const strong=y%5===0;
      push({x:minX,y,z:-.09},{x:maxX,y,z:-.09},strong?[.31,.40,.48,.25]:[.31,.40,.48,.11]);
    }
  }


  function addOverlayLine(mesh,a,b,color){
    addVertex(mesh.overlayLines,a,color);addVertex(mesh.overlayLines,b,color);
  }
  function addSelectionOverlay(mesh){
    const e=selectedObject();if(!e)return;
    const g=gizmoGeometry(e);
    const z0=g.z0-.025,z1=g.top+.025,w=(e.w||1)+.07,d=(e.h||1)+.07;
    const pts=[
      localXY(e,-w/2,-d/2),localXY(e,w/2,-d/2),localXY(e,w/2,d/2),localXY(e,-w/2,d/2)
    ];
    const low=pts.map(p=>({x:p.x,y:p.y,z:z0})),high=pts.map(p=>({x:p.x,y:p.y,z:z1}));
    const accent=[.18,.58,1,1],xColor=[.92,.32,.30,1],yColor=[.28,.78,.43,1],zColor=[.28,.58,1,1],ring=[1,.67,.22,1];
    for(let i=0;i<4;i++){
      addOverlayLine(mesh,low[i],low[(i+1)%4],accent);
      addOverlayLine(mesh,high[i],high[(i+1)%4],accent);
      addOverlayLine(mesh,low[i],high[i],accent);
    }

    const origin={x:e.x,y:e.y,z:g.top+.06};
    addOverlayLine(mesh,origin,{x:e.x+.72,y:e.y,z:origin.z},xColor);
    addOverlayLine(mesh,origin,{x:e.x,y:e.y+.72,z:origin.z},yColor);
    const zTop={x:e.x,y:e.y,z:g.top+g.axisLen};
    addOverlayLine(mesh,origin,zTop,zColor);
    addOverlayLine(mesh,zTop,{x:e.x-.07,y:e.y,z:zTop.z-.13},zColor);
    addOverlayLine(mesh,zTop,{x:e.x+.07,y:e.y,z:zTop.z-.13},zColor);

    const ringZ=g.z0+.055;
    let prev=null;
    for(let i=0;i<=48;i++){
      const a=i/48*Math.PI*2;
      const pt={x:e.x+Math.cos(a)*g.ringRadius,y:e.y+Math.sin(a)*g.ringRadius,z:ringZ};
      if(prev)addOverlayLine(mesh,prev,pt,ring);
      prev=pt;
    }
  }

  function wallOpenings(wall){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);
    if(L<.02)return [];
    const ux=dx/L,uy=dy/L;
    const out=[];
    for(const e of state.elements){
      const isGate=e.type==='object'&&['slidingGate','doubleGate','pedestrianGate'].includes(e.kind);
      if(e.type!=='door'&&e.type!=='window'&&!isGate)continue;
      const rx=e.x-wall.x1,ry=e.y-wall.y1;
      const along=rx*ux+ry*uy;
      const px=wall.x1+clamp(along,0,L)*ux,py=wall.y1+clamp(along,0,L)*uy;
      const dist=Math.hypot(e.x-px,e.y-py);
      if(dist>Math.max(.32,(wall.thickness||.15)*1.8))continue;
      const width=Math.min(isGate?(e.w||1):(e.width||.8),L);
      const start=clamp(along-width/2,0,L),end=clamp(along+width/2,0,L);
      if(end-start<.04)continue;
      const H=wall.height||2.7;
      const z0=(e.type==='door'||isGate)?0:clamp(e.sillHeight==null?.9:e.sillHeight,0,H-.15);
      const gateHeight=e.kind==='pedestrianGate'?1.9:1.85;
      const z1=clamp(z0+(isGate?gateHeight:(e.height||(e.type==='door'?2.1:1.2))),z0+.1,H);
      out.push({start,end,z0,z1,element:e});
    }
    return out;
  }
  function complementIntervals(holes,H){
    if(!holes.length)return [[0,H]];
    const sorted=holes.map(h=>[clamp(h[0],0,H),clamp(h[1],0,H)]).filter(h=>h[1]-h[0]>.01).sort((a,b)=>a[0]-b[0]);
    const merged=[];
    for(const h of sorted){
      if(!merged.length||h[0]>merged[merged.length-1][1]+.001)merged.push(h.slice());
      else merged[merged.length-1][1]=Math.max(merged[merged.length-1][1],h[1]);
    }
    const out=[];let cur=0;
    for(const h of merged){if(h[0]-cur>.02)out.push([cur,h[0]]);cur=Math.max(cur,h[1]);}
    if(H-cur>.02)out.push([cur,H]);
    return out;
  }
  function addWallGeometry(mesh,wall){
    const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L=Math.hypot(dx,dy);if(L<.02)return;
    const angle=Math.atan2(dy,dx),H=wall.height||2.7,T=wall.thickness||.15;
    const dark=document.body.classList.contains('dark-mode');
    const color=wall.color||(dark?vary(getPalette().room,1.18):'#F0EEE9');
    const openings=wallOpenings(wall);
    const cuts=[0,L];for(const o of openings){cuts.push(o.start,o.end);}cuts.sort((a,b)=>a-b);
    const unique=cuts.filter((v,i,a)=>i===0||Math.abs(v-a[i-1])>.002);
    const ux=dx/L,uy=dy/L;
    for(let i=0;i<unique.length-1;i++){
      const a=unique[i],b=unique[i+1],seg=b-a;if(seg<.01)continue;
      const mid=(a+b)/2;
      const active=openings.filter(o=>mid>o.start+.001&&mid<o.end-.001);
      const vertical=complementIntervals(active.map(o=>[o.z0,o.z1]),H);
      for(const [z0,z1] of vertical){
        const cx=wall.x1+ux*mid,cy=wall.y1+uy*mid;
        addBox(mesh,cx,cy,(z0+z1)/2,seg,T,z1-z0,color,angle,1);
      }
    }
  }

  function localXY(e,lx,ly){
    const a=rad(e.rotation||e.angle||0),c=Math.cos(a),s=Math.sin(a);
    return {x:e.x+lx*c-ly*s,y:e.y+lx*s+ly*c};
  }
  function objectElevation(e){const v=Number(e&&e.elevation);return Number.isFinite(v)?Math.max(0,v):0;}
  function localBox(mesh,e,lx,ly,cz,sx,sy,sz,color,alpha=1,extraAngle=0){
    const p=localXY(e,lx,ly);
    addBox(mesh,p.x,p.y,cz+objectElevation(e),sx,sy,sz,color,rad((e.rotation||e.angle||0)+extraAngle),alpha);
  }
  function localCylinder(mesh,e,lx,ly,z0,radius,height,color,segments=14,alpha=1){
    const p=localXY(e,lx,ly);addCylinder(mesh,p.x,p.y,z0+objectElevation(e),radius,height,color,segments,alpha);
  }

  function openingHiddenByFrontWall(e,eye){
    if(!hideFrontWalls)return false;
    let best=null,bestDist=Infinity;
    for(const wall of state.elements.filter(x=>x.type==='wall')){
      const dx=wall.x2-wall.x1,dy=wall.y2-wall.y1,L2=dx*dx+dy*dy;if(L2<.0001)continue;
      const t=clamp(((e.x-wall.x1)*dx+(e.y-wall.y1)*dy)/L2,0,1);
      const px=wall.x1+t*dx,py=wall.y1+t*dy,dist=Math.hypot(e.x-px,e.y-py);
      if(dist<bestDist){bestDist=dist;best=wall;}
    }
    return !!(best&&bestDist<Math.max(.34,(best.thickness||.15)*2)&&shouldHideFrontWall(best,eye));
  }
  function addOpeningPanels(mesh,eye,includeHidden=false){
    for(const e of state.elements){
      if(e.type!=='door'&&e.type!=='window')continue;
      if(!includeHidden&&openingHiddenByFrontWall(e,eye))continue;
      const h=e.height||(e.type==='door'?2.1:1.2),z0=e.type==='door'?0:(e.sillHeight==null?.9:e.sillHeight);
      const t=Math.max(.035,(e.wallThickness||.15)*.30),w=e.width||.8;
      if(e.type==='door'){
        const base=e.color||'#A56B43';
        localBox(mesh,e,0,0,z0+h/2,w,t,h,base,1);
        const inset=vary(base,.82),panelW=w*.72,panelH=h*.29;
        localBox(mesh,e,0,-t*.58,z0+h*.28,panelW,.012,panelH,inset,1);
        localBox(mesh,e,0,-t*.58,z0+h*.68,panelW,.012,panelH,inset,1);
        const knob=localXY(e,w*.31,-t*.72);
        addBox(mesh,knob.x,knob.y,z0+h*.50,.06,.035,.06,'#D1B36A',rad(e.angle||0),1);
      } else {
        const glass=e.color||'#9CC9DF',frame='#E9EFF3';
        localBox(mesh,e,0,0,z0+h/2,w,t*.52,h,glass,.34);
        const fw=Math.max(.045,Math.min(.085,w*.07)),fh=Math.max(.045,Math.min(.085,h*.08));
        localBox(mesh,e,-w/2+fw/2,0,z0+h/2,fw,t,h,frame,1);
        localBox(mesh,e,w/2-fw/2,0,z0+h/2,fw,t,h,frame,1);
        localBox(mesh,e,0,0,z0+fh/2,w,t,fh,frame,1);
        localBox(mesh,e,0,0,z0+h-fh/2,w,t,fh,frame,1);
        localBox(mesh,e,0,0,z0+h/2,w,t*.92,fw*.65,frame,1);
      }
    }
  }

  function materialBase(r){
    return typeof floorMaterialBase==='function'?floorMaterialBase(r):((r&&r.color)||getPalette().room);
  }
  function seeded01(n){const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);}
  function addRoomMaterialDetails(mesh,r,base){
    const material=r.material||'solid';if(material==='solid')return;
    const line=vary(base,document.body.classList.contains('dark-mode')?.72:.78);
    if(material==='tile'){
      const step=.6;
      for(let x=r.x+step;x<r.x+r.w-.02;x+=step)addBox(mesh,x,r.y+r.h/2,.008,.012,r.h,.012,line,0,1);
      for(let y=r.y+step;y<r.y+r.h-.02;y+=step)addBox(mesh,r.x+r.w/2,y,.008,r.w,.012,.012,line,0,1);
    }else if(material==='wood'){
      const plank=.22;
      let i=0;for(let y=r.y+plank;y<r.y+r.h-.02;y+=plank,i++){
        addBox(mesh,r.x+r.w/2,y,.008,r.w,.009,.011,line,0,1);
        const jointX=r.x+((i%2)?.33:.66)*r.w;
        addBox(mesh,jointX,y-plank/2,.009,.009,plank,.012,vary(base,.72),0,1);
      }
    }else if(material==='concrete'){
      const count=Math.min(36,Math.max(10,Math.round(r.w*r.h*.55)));
      for(let i=0;i<count;i++){
        const px=r.x+.08+seeded01(i+r.x*7+r.y*11)*(Math.max(.1,r.w-.16));
        const py=r.y+.08+seeded01(i*1.91+r.x*13-r.y*5)*(Math.max(.1,r.h-.16));
        const sz=.025+seeded01(i*2.7)*.05;
        addBox(mesh,px,py,.006,sz,sz,.009,vary(base,.74+seeded01(i*3.1)*.20),0,1);
      }
    }else if(material==='grass'){
      const area=Math.max(.2,r.w*r.h),spacing=Math.max(.42,Math.sqrt(area/150));
      let idx=0;
      for(let x=r.x+spacing*.45;x<r.x+r.w;x+=spacing){
        for(let y=r.y+spacing*.45;y<r.y+r.h;y+=spacing){
          const jx=(seeded01(idx*3.7)-.5)*spacing*.42,jy=(seeded01(idx*5.9)-.5)*spacing*.42;
          const h=.055+seeded01(idx*7.3)*.06;
          addBox(mesh,x+jx,y+jy,h/2+.003,.018,.075,h,vary(base,.66+seeded01(idx*2.2)*.22),seeded01(idx*4.4)*Math.PI,1);
          idx++;
        }
      }
    }
  }
  function addRooms(mesh){
    for(const r of state.elements.filter(e=>e.type==='room')){
      const base=materialBase(r);
      addBox(mesh,r.x+r.w/2,r.y+r.h/2,-.035,r.w,r.h,.07,base,0,1);
      addRoomMaterialDetails(mesh,r,base);
    }
  }

  function objectDefaultColor(kind){
    return ({sofa:'#78889B',bed:'#D9D3C7',table:'#A9825A',desk:'#A9825A',toilet:'#ECEFF1',sink:'#E4E9EC',plant:'#6A966D',pool:'#67B7D1',tree:'#5F8C5B',car:'#708090',grill:'#5D6166',fridge:'#D9E0E4',stove:'#5A6066',counter:'#A47B55',wardrobe:'#9A7656',tv:'#242A30',column:'#B7B9B8',halfwall:'#D2D0CA',slidingGate:'#5A6269',doubleGate:'#5D6266',pedestrianGate:'#566068',pergola:'#9B714B'})[kind]||getPalette().object;
  }

  function modelSofa(mesh,e,c){
    const w=e.w||2.1,d=e.h||.85;
    localBox(mesh,e,0,0,.17,w*.92,d*.82,.34,vary(c,.84));
    localBox(mesh,e,0,-d*.38,.53,w*.94,d*.18,.72,vary(c,.72));
    localBox(mesh,e,-w*.44,0,.43,w*.12,d*.72,.55,vary(c,.75));
    localBox(mesh,e,w*.44,0,.43,w*.12,d*.72,.55,vary(c,.75));
    localBox(mesh,e,-w*.22,d*.04,.40,w*.40,d*.53,.14,vary(c,1.08));
    localBox(mesh,e,w*.22,d*.04,.40,w*.40,d*.53,.14,vary(c,1.08));
  }
  function modelBed(mesh,e,c){
    const w=e.w||1.6,d=e.h||2;
    localBox(mesh,e,0,0,.12,w,d,.24,vary(c,.62));
    localBox(mesh,e,0,.03*d,.34,w*.94,d*.88,.26,vary(c,1.08));
    localBox(mesh,e,0,-d*.45,.58,w,.10,.86,vary(c,.70));
    localBox(mesh,e,-w*.23,-d*.30,.51,w*.39,d*.19,.12,'#F4F1EA');
    localBox(mesh,e,w*.23,-d*.30,.51,w*.39,d*.19,.12,'#F4F1EA');
    localBox(mesh,e,0,d*.18,.49,w*.91,d*.38,.055,vary(c,.82));
  }
  function modelTable(mesh,e,c){
    const w=e.w||1.5,d=e.h||.9,leg=Math.max(.055,Math.min(.11,Math.min(w,d)*.12));
    localBox(mesh,e,0,0,.74,w,d,.10,c);
    for(const sx of [-1,1])for(const sy of [-1,1])localBox(mesh,e,sx*(w/2-leg*.9),sy*(d/2-leg*.9),.36,leg,leg,.72,vary(c,.72));
  }
  function modelDesk(mesh,e,c){
    const w=e.w||1.3,d=e.h||.65;
    localBox(mesh,e,0,0,.75,w,d,.09,c);
    localBox(mesh,e,-w*.43,0,.37,w*.10,d*.78,.74,vary(c,.72));
    localBox(mesh,e,w*.43,0,.37,w*.10,d*.78,.74,vary(c,.72));
    localBox(mesh,e,w*.25,0,.56,w*.28,d*.67,.25,vary(c,.86));
    localBox(mesh,e,w*.25,-d*.35,.57,w*.20,.035,.035,'#454B52');
  }
  function modelToilet(mesh,e,c){
    const w=e.w||.65,d=e.h||.8;
    localCylinder(mesh,e,0,d*.08,.18,Math.min(w,d)*.30,.32,c,18,1);
    localCylinder(mesh,e,0,d*.08,.49,Math.min(w,d)*.31,.055,'#F7F8F8',18,1);
    localBox(mesh,e,0,-d*.31,.60,w*.70,d*.25,.58,vary(c,.96));
    localBox(mesh,e,0,d*.02,.13,w*.42,d*.38,.26,vary(c,.90));
  }
  function modelSink(mesh,e,c){
    const w=e.w||.8,d=e.h||.55;
    localBox(mesh,e,0,0,.43,w*.88,d*.88,.80,vary(c,.88));
    localBox(mesh,e,0,0,.86,w,d,.10,c);
    localBox(mesh,e,0,d*.01,.91,w*.56,d*.48,.035,'#CBD5DB');
    localBox(mesh,e,0,-d*.28,1.00,.055,.055,.24,'#8A949B');
    localBox(mesh,e,0,-d*.19,1.10,.055,.18,.055,'#8A949B');
  }
  function modelPlant(mesh,e,c){
    const w=e.w||.65,d=e.h||.65,r=Math.min(w,d)*.22;
    localCylinder(mesh,e,0,0,0,r,.34,'#A56B43',14,1);localCylinder(mesh,e,0,0,.30,.035,.36,'#6C7C56',10,1);
    const leaf=vary(c,.94);
    for(const [lx,ly,z,rr] of [[0,0,.52,.23],[w*.16,0,.62,.18],[-w*.16,0,.62,.18],[0,d*.15,.68,.17],[0,-d*.15,.66,.17]]){
      localCylinder(mesh,e,lx,ly,z,rr,.20,leaf,10,1);
    }
  }
  function modelPool(mesh,e,c){
    const w=e.w||4,d=e.h||2.4,b=.12;
    localBox(mesh,e,0,0,.015,w*.94,d*.94,.03,c,.68);
    localBox(mesh,e,0,-d/2+b/2,.055,w,b,.11,'#D8D2C7');
    localBox(mesh,e,0,d/2-b/2,.055,w,b,.11,'#D8D2C7');
    localBox(mesh,e,-w/2+b/2,0,.055,b,d,.11,'#D8D2C7');
    localBox(mesh,e,w/2-b/2,0,.055,b,d,.11,'#D8D2C7');
    for(const x of [-w*.20,0,w*.20])localBox(mesh,e,x,0,.038,.025,d*.72,.018,vary(c,1.18),.80);
  }
  function modelTree(mesh,e,c){
    const w=e.w||1.6,d=e.h||1.6,r=Math.min(w,d);
    localCylinder(mesh,e,0,0,0,.13,1.30,'#7B6248',12,1);
    for(const [lx,ly,z,rr] of [[0,0,1.05,r*.34],[w*.19,0,1.28,r*.28],[-w*.19,0,1.30,r*.28],[0,d*.18,1.48,r*.28],[0,-d*.18,1.45,r*.28],[0,0,1.70,r*.30]]){
      localCylinder(mesh,e,lx,ly,z,rr,.48,vary(c,.94+z*.03),12,1);
    }
  }
  function modelCar(mesh,e,c){
    const w=e.w||1.8,d=e.h||4.2;
    localBox(mesh,e,0,0,.31,w*.88,d*.84,.50,c);
    localBox(mesh,e,0,-d*.02,.72,w*.72,d*.39,.43,vary(c,1.05));
    localBox(mesh,e,0,-d*.23,.80,w*.60,d*.025,.27,'#344654');
    localBox(mesh,e,0,d*.18,.80,w*.60,d*.025,.27,'#344654');
    localBox(mesh,e,0,-d*.37,.43,w*.80,d*.17,.24,vary(c,.95));
    localBox(mesh,e,0,d*.36,.42,w*.80,d*.16,.22,vary(c,.92));
    for(const sx of [-1,1])for(const sy of [-1,1])localBox(mesh,e,sx*w*.46,sy*d*.27,.23,w*.11,d*.18,.36,'#272A2D');
    localBox(mesh,e,0,-d*.445,.48,w*.46,.035,.09,'#F3E6B3');
    localBox(mesh,e,0,d*.445,.47,w*.46,.035,.09,'#B44C4C');
  }
  function modelGrill(mesh,e,c){
    const w=e.w||.9,d=e.h||.75,r=Math.min(w,d)*.34;
    localCylinder(mesh,e,0,0,.55,r,.28,c,16,1);
    localCylinder(mesh,e,0,0,.82,r*.96,.035,'#33383D',16,1);
    for(const [lx,ly] of [[-w*.23,-d*.18],[w*.23,-d*.18],[0,d*.23]])localBox(mesh,e,lx,ly,.28,.055,.055,.56,'#5A6065');
    localBox(mesh,e,0,0,.91,w*.58,.035,.035,'#B8BDC1');
  }
  function modelFridge(mesh,e,c){
    const w=e.w||.9,d=e.h||.72,H=1.85;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,-d*.505,H*.57,w*.92,.025,.045,vary(c,.72));
    localBox(mesh,e,w*.32,-d*.535,H*.72,.035,.035,.42,'#8D969D');
    localBox(mesh,e,w*.32,-d*.535,H*.29,.035,.035,.42,'#8D969D');
    localBox(mesh,e,0,-d*.52,H*.77,w*.86,.018,H*.37,vary(c,1.05));
    localBox(mesh,e,0,-d*.52,H*.29,w*.86,.018,H*.48,vary(c,.98));
  }
  function modelStove(mesh,e,c){
    const w=e.w||.62,d=e.h||.66,H=.9;
    localBox(mesh,e,0,0,H*.43,w,d,H*.86,c);
    localBox(mesh,e,0,0,H*.91,w*.98,d*.98,.08,vary(c,.82));
    for(const [lx,ly] of [[-w*.22,-d*.2],[w*.22,-d*.2],[-w*.22,d*.2],[w*.22,d*.2]])localCylinder(mesh,e,lx,ly,H*.96,Math.min(w,d)*.115,.026,'#202429',14,1);
    localBox(mesh,e,0,-d*.505,H*.47,w*.72,.018,H*.42,'#272D32');
    localBox(mesh,e,0,-d*.52,H*.74,w*.72,.035,.035,'#AEB5BA');
    for(const x of [-w*.28,-w*.10,w*.10,w*.28])localCylinder(mesh,e,x,-d*.535,H*.82,.025,.035,'#D0D4D6',10,1);
  }
  function modelCounter(mesh,e,c){
    const w=e.w||1.8,d=e.h||.65,H=.92;
    localBox(mesh,e,0,0,H*.44,w*.98,d*.94,H*.84,c);
    localBox(mesh,e,0,0,H*.91,w,d,.09,vary(c,1.08));
    for(const x of [-w*.32,0,w*.32])localBox(mesh,e,x,-d*.49,H*.46,.018,.025,H*.74,vary(c,.70));
    for(const x of [-w*.16,w*.16])localBox(mesh,e,x,-d*.515,H*.54,.035,.035,.035,'#3F464C');
  }
  function modelWardrobe(mesh,e,c){
    const w=e.w||1.8,d=e.h||.6,H=2.15;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,-d*.51,H*.52,.018,.018,H*.92,vary(c,.65));
    localBox(mesh,e,-w*.035,-d*.535,H*.52,.025,.025,.20,'#B7A37D');
    localBox(mesh,e,w*.035,-d*.535,H*.52,.025,.025,.20,'#B7A37D');
    localBox(mesh,e,0,0,H*.96,w*.96,d*.96,.06,vary(c,.88));
  }
  function modelTV(mesh,e,c){
    const w=e.w||1.25,d=e.h||.12,H=.72;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,-d*.54,H*.52,w*.91,.018,H*.82,'#11171B');
    localBox(mesh,e,0,d*.20,-.08,w*.12,d*.45,.16,vary(c,.72));
    localBox(mesh,e,0,d*.36,-.15,w*.36,d*.25,.055,vary(c,.65));
  }
  function modelColumn(mesh,e,c){
    const w=e.w||.3,d=e.h||.3,H=2.7;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,0,.08,w*1.18,d*1.18,.16,vary(c,.85));
    localBox(mesh,e,0,0,H-.08,w*1.14,d*1.14,.16,vary(c,.9));
  }
  function modelHalfWall(mesh,e,c){
    const w=e.w||2,d=e.h||.16,H=1.05;
    localBox(mesh,e,0,0,H/2,w,d,H,c);
    localBox(mesh,e,0,0,H+.035,w*1.02,d*1.45,.07,vary(c,.88));
  }
  function gateBars(mesh,e,c,w,d,H,mode){
    localBox(mesh,e,0,0,.07,w,d*.9,.14,vary(c,.70));
    localBox(mesh,e,0,0,H-.06,w,d*.9,.12,vary(c,.74));
    const spacing=Math.max(.18,w/14);
    for(let x=-w/2+.11;x<w/2-.08;x+=spacing)localBox(mesh,e,x,0,H/2,.045,d*.82,H*.91,c);
    if(mode==='double'){
      localBox(mesh,e,0,-d*.04,H/2,.055,d,H*.96,vary(c,.72));
      localBox(mesh,e,-w*.25,-d*.03,H/2,w*.56,.035,.045,vary(c,.84),1,32);
      localBox(mesh,e,w*.25,-d*.03,H/2,w*.56,.035,.045,vary(c,.84),1,-32);
    }
  }
  function modelSlidingGate(mesh,e,c){
    const w=e.w||3.2,d=e.h||.16,H=1.85;gateBars(mesh,e,c,w,d,H,'sliding');
    localCylinder(mesh,e,-w*.38,d*.10,.02,.07,.08,'#252A2E',12,1);localCylinder(mesh,e,w*.38,d*.10,.02,.07,.08,'#252A2E',12,1);
    localBox(mesh,e,0,d*.65,.025,w*1.08,.05,.05,'#6D7378');
  }
  function modelDoubleGate(mesh,e,c){const w=e.w||3,d=e.h||.16,H=1.85;gateBars(mesh,e,c,w,d,H,'double');}
  function modelPedestrianGate(mesh,e,c){
    const w=e.w||.95,d=e.h||.14,H=1.9;gateBars(mesh,e,c,w,d,H,'single');
    localCylinder(mesh,e,w*.31,-d*.62,H*.52,.035,.05,'#C6A45B',10,1);
  }
  function modelPergola(mesh,e,c){
    const w=e.w||3,d=e.h||2.5,H=2.45,post=.13;
    for(const sx of [-1,1])for(const sy of [-1,1])localBox(mesh,e,sx*(w/2-post),sy*(d/2-post),H/2,post,post,H,c);
    localBox(mesh,e,0,-d/2+post,H,w,post,.16,vary(c,.9));localBox(mesh,e,0,d/2-post,H,w,post,.16,vary(c,.9));
    const beams=7;for(let i=0;i<beams;i++){const x=-w*.43+i*(w*.86/(beams-1));localBox(mesh,e,x,0,H+.09,.09,d*1.03,.12,vary(c,1.03));}
  }
  function modelGeneric(mesh,e,c){
    const w=e.w||1,d=e.h||1;
    localBox(mesh,e,0,0,.31,w,d,.62,c);
    localBox(mesh,e,0,0,.64,w*.78,d*.78,.05,vary(c,1.12));
  }

  function addObjects(mesh){
    for(const e of state.elements.filter(e=>e.type==='object')){
      const c=e.color||objectDefaultColor(e.kind);
      if(e.kind==='sofa')modelSofa(mesh,e,c);
      else if(e.kind==='bed')modelBed(mesh,e,c);
      else if(e.kind==='table')modelTable(mesh,e,c);
      else if(e.kind==='desk')modelDesk(mesh,e,c);
      else if(e.kind==='toilet')modelToilet(mesh,e,c);
      else if(e.kind==='sink')modelSink(mesh,e,c);
      else if(e.kind==='plant')modelPlant(mesh,e,c);
      else if(e.kind==='pool')modelPool(mesh,e,c);
      else if(e.kind==='tree')modelTree(mesh,e,c);
      else if(e.kind==='car')modelCar(mesh,e,c);
      else if(e.kind==='grill')modelGrill(mesh,e,c);
      else if(e.kind==='fridge')modelFridge(mesh,e,c);
      else if(e.kind==='stove')modelStove(mesh,e,c);
      else if(e.kind==='counter')modelCounter(mesh,e,c);
      else if(e.kind==='wardrobe')modelWardrobe(mesh,e,c);
      else if(e.kind==='tv')modelTV(mesh,e,c);
      else if(e.kind==='column')modelColumn(mesh,e,c);
      else if(e.kind==='halfwall')modelHalfWall(mesh,e,c);
      else if(e.kind==='slidingGate')modelSlidingGate(mesh,e,c);
      else if(e.kind==='doubleGate')modelDoubleGate(mesh,e,c);
      else if(e.kind==='pedestrianGate')modelPedestrianGate(mesh,e,c);
      else if(e.kind==='pergola')modelPergola(mesh,e,c);
      else modelGeneric(mesh,e,c);
    }
  }

  function buildScene(eye){
    const mesh={opaque:[],transparent:[],lines:[],overlayLines:[]};
    addGrid(mesh.lines);
    addRooms(mesh);
    for(const wall of state.elements.filter(e=>e.type==='wall'))if(!shouldHideFrontWall(wall,eye))addWallGeometry(mesh,wall);
    addOpeningPanels(mesh,eye);
    addObjects(mesh);
    addSelectionOverlay(mesh);
    return mesh;
  }


  /* ===== Exportação do mapa 3D =====
     O exportador usa a mesma geometria do WebGL, mas sem grade, gizmos ou
     paredes ocultadas apenas para facilitar a visualização. O resultado é
     OBJ + MTL dentro de um ZIP sem dependências externas. */
  function buildExportScene(){
    const mesh={opaque:[],transparent:[],lines:[],overlayLines:[]};
    addRooms(mesh);
    for(const wall of state.elements.filter(e=>e.type==='wall'))addWallGeometry(mesh,wall);
    addOpeningPanels(mesh,cameraEye(),true);
    addObjects(mesh);
    return mesh;
  }

  function exportBaseName(){
    let name='planta';
    try{
      if(typeof safeProjectFilename==='function')name=safeProjectFilename();
      else if(state&&state.projectName)name=String(state.projectName);
    }catch(_){/* usa nome padrão */}
    name=String(name||'planta').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\w\- ]/g,'').trim().replace(/\s+/g,'-');
    return name||'planta';
  }

  function materialInfoFromVertex(arr,offset){
    const r=clamp(arr[offset+3]||0,0,1),g=clamp(arr[offset+4]||0,0,1),b=clamp(arr[offset+5]||0,0,1),a=clamp(arr[offset+6]==null?1:arr[offset+6],0,1);
    const ri=Math.round(r*255),gi=Math.round(g*255),bi=Math.round(b*255),ai=Math.round(a*255);
    return {key:`mat_${ri}_${gi}_${bi}_${ai}`,r,g,b,a};
  }

  function meshToOBJMTL(mesh,objName,mtlFileName){
    const obj=[
      '# Visual Maker - modelo 3D',
      '# 1 unidade = 1 metro',
      `mtllib ${mtlFileName}`,
      `o ${objName}`,
      's off'
    ];
    const materials=new Map();
    let vertexIndex=1,lastMaterial='';

    const appendTriangles=arr=>{
      const triStride=STRIDE*3;
      for(let i=0;i+triStride<=arr.length;i+=triStride){
        const mat=materialInfoFromVertex(arr,i);
        if(!materials.has(mat.key))materials.set(mat.key,mat);
        if(mat.key!==lastMaterial){obj.push(`usemtl ${mat.key}`);lastMaterial=mat.key;}
        for(let v=0;v<3;v++){
          const o=i+v*STRIDE;
          const x=Number(arr[o]).toFixed(5),y=Number(arr[o+1]).toFixed(5),z=Number(arr[o+2]).toFixed(5);
          obj.push(`v ${x} ${y} ${z}`);
        }
        obj.push(`f ${vertexIndex} ${vertexIndex+1} ${vertexIndex+2}`);
        vertexIndex+=3;
      }
    };
    appendTriangles(mesh.opaque);
    appendTriangles(mesh.transparent);

    const mtl=['# Visual Maker - materiais'];
    for(const mat of materials.values()){
      const f=n=>Number(n).toFixed(6);
      mtl.push('',`newmtl ${mat.key}`,
        `Ka ${f(mat.r*.22)} ${f(mat.g*.22)} ${f(mat.b*.22)}`,
        `Kd ${f(mat.r)} ${f(mat.g)} ${f(mat.b)}`,
        'Ks 0.060000 0.060000 0.060000',
        'Ns 18.000000',
        `d ${f(mat.a)}`,
        'illum 2');
    }
    return {obj:obj.join('\n')+'\n',mtl:mtl.join('\n')+'\n'};
  }

  function crc32(bytes){
    let crc=0xFFFFFFFF;
    for(let i=0;i<bytes.length;i++){
      crc^=bytes[i];
      for(let b=0;b<8;b++)crc=(crc>>>1)^((crc&1)?0xEDB88320:0);
    }
    return (crc^0xFFFFFFFF)>>>0;
  }

  function zipDosDateTime(date){
    const year=Math.max(1980,date.getFullYear());
    return {
      time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),
      date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()
    };
  }

  function makeStoredZip(entries){
    const encoder=new TextEncoder(),now=zipDosDateTime(new Date());
    const locals=[],centrals=[];
    let offset=0,centralSize=0;
    const u16=(view,at,v)=>view.setUint16(at,v,true),u32=(view,at,v)=>view.setUint32(at,v>>>0,true);

    for(const entry of entries){
      const nameBytes=encoder.encode(entry.name),dataBytes=typeof entry.data==='string'?encoder.encode(entry.data):entry.data;
      const crc=crc32(dataBytes),local=new Uint8Array(30+nameBytes.length),lv=new DataView(local.buffer);
      u32(lv,0,0x04034b50);u16(lv,4,20);u16(lv,6,0);u16(lv,8,0);u16(lv,10,now.time);u16(lv,12,now.date);
      u32(lv,14,crc);u32(lv,18,dataBytes.length);u32(lv,22,dataBytes.length);u16(lv,26,nameBytes.length);u16(lv,28,0);
      local.set(nameBytes,30);
      locals.push(local,dataBytes);

      const central=new Uint8Array(46+nameBytes.length),cv=new DataView(central.buffer);
      u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0);u16(cv,10,0);u16(cv,12,now.time);u16(cv,14,now.date);
      u32(cv,16,crc);u32(cv,20,dataBytes.length);u32(cv,24,dataBytes.length);u16(cv,28,nameBytes.length);u16(cv,30,0);u16(cv,32,0);
      u16(cv,34,0);u16(cv,36,0);u32(cv,38,0);u32(cv,42,offset);central.set(nameBytes,46);
      centrals.push(central);centralSize+=central.length;
      offset+=local.length+dataBytes.length;
    }

    const end=new Uint8Array(22),ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50);u16(ev,4,0);u16(ev,6,0);u16(ev,8,entries.length);u16(ev,10,entries.length);
    u32(ev,12,centralSize);u32(ev,16,offset);u16(ev,20,0);
    return new Blob([...locals,...centrals,end],{type:'application/zip'});
  }

  function downloadBlob(blob,filename){
    const a=document.createElement('a'),url=URL.createObjectURL(blob);
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1500);
  }

  function standaloneViewerCamera(){
    if(cameraInitialized){
      return {yaw,pitch,distance,target:{x:target.x,y:target.y,z:target.z}};
    }
    const b=contentBBox();
    const span=Math.max(3,b.maxX-b.minX,b.maxY-b.minY);
    return {
      yaw:-0.72,
      pitch:0.66,
      distance:span*1.7+4.5,
      target:{x:(b.minX+b.maxX)/2,y:(b.minY+b.maxY)/2,z:1.05}
    };
  }

  function buildStandalone3DHTML(mesh){
    const camera=standaloneViewerCamera();
    const projectName=String((state&&state.projectName)||'Visualização 3D');
    const dark=document.body.classList.contains('dark-mode');
    const payload={
      name:projectName,
      opaque:mesh.opaque,
      transparent:mesh.transparent,
      camera,
      dark
    };
    const dataJSON=JSON.stringify(payload).replace(/<\/script/gi,'<\\/script');
    const title=projectName.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Visualização 3D</title>
<style>
  :root{color-scheme:${dark?'dark':'light'};font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  *{box-sizing:border-box}html,body{width:100%;height:100%;margin:0;overflow:hidden;background:${dark?'#1b222a':'#e3ecf2'}}
  body{position:relative}canvas{width:100%;height:100%;display:block;touch-action:none;cursor:grab}canvas.dragging{cursor:grabbing}
  .topbar{position:fixed;left:16px;right:16px;top:16px;display:flex;justify-content:space-between;align-items:flex-start;gap:12px;pointer-events:none;z-index:2}
  .card{pointer-events:auto;background:${dark?'rgba(28,35,43,.92)':'rgba(255,255,255,.92)'};color:${dark?'#eef3f7':'#1d2935'};border:1px solid ${dark?'rgba(255,255,255,.12)':'rgba(23,42,58,.14)'};box-shadow:0 10px 30px rgba(0,0,0,.14);border-radius:12px;backdrop-filter:blur(9px)}
  .title{padding:11px 14px;max-width:min(480px,70vw)}.title strong{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.title small{display:block;margin-top:3px;opacity:.66;font-size:11px}
  .actions{display:flex;gap:7px;padding:7px}.actions button{border:1px solid ${dark?'rgba(255,255,255,.12)':'rgba(23,42,58,.14)'};background:${dark?'#303a44':'#f7fafc'};color:inherit;border-radius:8px;padding:8px 11px;font:inherit;font-size:12px;cursor:pointer}.actions button:hover{filter:brightness(${dark?'1.12':'.97'})}
  .help{position:fixed;left:16px;bottom:16px;max-width:min(560px,calc(100vw - 32px));padding:10px 13px;font-size:11px;line-height:1.45;pointer-events:none;z-index:2}.help b{font-weight:650}.error{position:fixed;inset:0;display:none;place-items:center;padding:30px;text-align:center;color:#fff;background:#202830;z-index:5}.error.show{display:grid}
  @media(max-width:620px){.topbar{left:10px;right:10px;top:10px}.title small{display:none}.help{left:10px;bottom:10px}.actions button{padding:8px}.actions .wide{display:none}}
</style>
</head>
<body>
<canvas id="viewer" aria-label="Visualização 3D de ${title}"></canvas>
<div class="topbar">
  <div class="card title"><strong>${title}</strong><small>Visual Maker · visualização 3D offline</small></div>
  <div class="card actions"><button id="reset" title="Centralizar a planta">Centralizar</button><button id="theme" class="wide" title="Alternar fundo">${dark?'Fundo claro':'Fundo escuro'}</button></div>
</div>
<div class="card help"><b>Mouse:</b> arraste para orbitar · <b>Scroll:</b> zoom · <b>WASD/setas:</b> mover câmera · <b>Shift:</b> movimento rápido · <b>duplo clique:</b> centralizar</div>
<div class="error" id="error"><div><h2>Não foi possível abrir o 3D</h2><p>Este navegador não oferece suporte ao WebGL necessário para a visualização.</p></div></div>
<script id="visual-maker-data" type="application/json">${dataJSON}</script>
<script>
(()=>{
'use strict';
const DATA=JSON.parse(document.getElementById('visual-maker-data').textContent);
const canvas=document.getElementById('viewer'),error=document.getElementById('error');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false,premultipliedAlpha:false});
if(!gl){error.classList.add('show');return;}
const STRIDE=7,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=d=>d*Math.PI/180;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z}),sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),mul=(a,s)=>({x:a.x*s,y:a.y*s,z:a.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const norm=a=>{const n=Math.hypot(a.x,a.y,a.z)||1;return{x:a.x/n,y:a.y/n,z:a.z/n}};
const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
let yaw=finite(DATA.camera.yaw,-.72),pitch=finite(DATA.camera.pitch,.66),distance=finite(DATA.camera.distance,16);
let target={x:finite(DATA.camera.target.x,0),y:finite(DATA.camera.target.y,0),z:finite(DATA.camera.target.z,1)};
const initial={yaw,pitch,distance,target:{...target}};let drag=null,dark=!!DATA.dark;
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader');return s}
const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 aPosition;attribute vec4 aColor;uniform mat4 uMVP;varying vec4 vColor;void main(){gl_Position=uMVP*vec4(aPosition,1.0);vColor=aColor;}'));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec4 vColor;void main(){gl_FragColor=vColor;}'));gl.linkProgram(program);
if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'Programa WebGL');
const aPosition=gl.getAttribLocation(program,'aPosition'),aColor=gl.getAttribLocation(program,'aColor'),uMVP=gl.getUniformLocation(program,'uMVP'),buffer=gl.createBuffer();
function perspective(fovy,aspect,near,far){const f=1/Math.tan(fovy/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,(2*far*near)*nf,0])}
function lookAt(eye,center,up){const z=norm(sub(eye,center)),x=norm(cross(up,z)),y=cross(z,x);return new Float32Array([x.x,y.x,z.x,0,x.y,y.y,z.y,0,x.z,y.z,z.z,0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1])}
function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out}
function eye(){const cp=Math.cos(pitch),sp=Math.sin(pitch);return{x:target.x+distance*cp*Math.cos(yaw),y:target.y+distance*cp*Math.sin(yaw),z:target.z+distance*sp}}
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,devicePixelRatio||1),w=Math.max(2,Math.round(r.width*dpr)),h=Math.max(2,Math.round(r.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);return{w,h}}
function bind(data){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const bytes=STRIDE*4;gl.enableVertexAttribArray(aPosition);gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,bytes,0);gl.enableVertexAttribArray(aColor);gl.vertexAttribPointer(aColor,4,gl.FLOAT,false,bytes,12)}
function drawData(data){if(!data||!data.length)return;bind(data);gl.drawArrays(gl.TRIANGLES,0,data.length/STRIDE)}
function draw(){const sz=resize(),bg=dark?[.105,.133,.164,1]:[.89,.925,.945,1];document.documentElement.style.colorScheme=dark?'dark':'light';document.body.style.background=dark?'#1b222a':'#e3ecf2';gl.clearColor(...bg);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);const e=eye(),mvp=multiply(perspective(rad(47),sz.w/sz.h,.05,Math.max(250,distance*18)),lookAt(e,target,{x:0,y:0,z:1}));gl.useProgram(program);gl.uniformMatrix4fv(uMVP,false,mvp);drawData(DATA.opaque);if(DATA.transparent&&DATA.transparent.length){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);drawData(DATA.transparent);gl.depthMask(true);gl.disable(gl.BLEND)}}
function reset(){yaw=initial.yaw;pitch=initial.pitch;distance=initial.distance;target={...initial.target};draw()}
function moveCamera(forward,right){const fx=-Math.cos(yaw),fy=-Math.sin(yaw),rx=-Math.sin(yaw),ry=Math.cos(yaw);target.x+=fx*forward+rx*right;target.y+=fy*forward+ry*right;draw()}
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==1&&e.button!==2)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,yaw,pitch};canvas.classList.add('dragging');try{canvas.setPointerCapture(e.pointerId)}catch(_){}});
canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw-(e.clientX-drag.x)*.008;pitch=clamp(drag.pitch+(e.clientY-drag.y)*.006,.12,1.45);draw()});
function pointerEnd(e){drag=null;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(e.pointerId)}catch(_){}}canvas.addEventListener('pointerup',pointerEnd);canvas.addEventListener('pointercancel',pointerEnd);
canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*(e.deltaY>0?1.09:.92),2.8,180);draw()},{passive:false});canvas.addEventListener('dblclick',reset);
window.addEventListener('keydown',e=>{const key=e.key.toLowerCase(),keys=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];if(!keys.includes(key))return;e.preventDefault();const step=Math.max(.18,Math.min(1.2,distance*.032))*(e.shiftKey?2.7:1);if(key==='w'||key==='arrowup')moveCamera(step,0);else if(key==='s'||key==='arrowdown')moveCamera(-step,0);else if(key==='a'||key==='arrowleft')moveCamera(0,-step);else moveCamera(0,step)});
window.addEventListener('resize',draw);document.getElementById('reset').addEventListener('click',reset);document.getElementById('theme').addEventListener('click',e=>{dark=!dark;e.currentTarget.textContent=dark?'Fundo claro':'Fundo escuro';draw()});draw();
})();
</script>
</body>
</html>`;
  }

  function exportStandalone3DHTML(){
    const hasGeometry=state.elements.some(e=>['wall','room','door','window','object'].includes(e.type));
    if(!hasGeometry){alert('Adicione elementos à planta antes de exportar a visualização 3D.');return;}
    const mesh=buildExportScene();
    if(!mesh.opaque.length&&!mesh.transparent.length){alert('Não foi possível gerar a visualização 3D deste projeto.');return;}
    const html=buildStandalone3DHTML(mesh);
    downloadBlob(new Blob([html],{type:'text/html;charset=utf-8'}),`${exportBaseName()}-3d.html`);
  }

  function export3DModel(){
    const hasGeometry=state.elements.some(e=>['wall','room','door','window','object'].includes(e.type));
    if(!hasGeometry){alert('Adicione elementos à planta antes de exportar o modelo 3D.');return;}
    const base=exportBaseName(),objFile=`${base}-3d.obj`,mtlFile=`${base}-3d.mtl`;
    const mesh=buildExportScene();
    if(!mesh.opaque.length&&!mesh.transparent.length){alert('Não foi possível gerar a geometria 3D deste projeto.');return;}
    const files=meshToOBJMTL(mesh,`${base}-3d`,mtlFile);
    const readme=[
      'Visual Maker - exportacao 3D',
      '',
      `Abra o arquivo ${objFile} em um programa compativel com Wavefront OBJ.`,
      `Mantenha ${objFile} e ${mtlFile} na mesma pasta para preservar as cores.`,
      'Escala: 1 unidade do modelo = 1 metro.',
      '',
      'O arquivo exporta a planta completa, mesmo que paredes frontais estejam ocultas somente na visualizacao do editor.'
    ].join('\n');
    const zip=makeStoredZip([
      {name:objFile,data:files.obj},
      {name:mtlFile,data:files.mtl},
      {name:'LEIA-ME.txt',data:readme}
    ]);
    downloadBlob(zip,`${base}-3d.zip`);
  }

  function bindArray(data){
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.DYNAMIC_DRAW);
    const bytes=STRIDE*4;
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition,3,gl.FLOAT,false,bytes,0);
    gl.enableVertexAttribArray(aColor);
    gl.vertexAttribPointer(aColor,4,gl.FLOAT,false,bytes,3*4);
  }
  function drawArray(data,primitive){
    if(!data.length)return;
    bindArray(data);
    gl.drawArrays(primitive,0,data.length/STRIDE);
  }

  function draw(){
    if(mode!=='3d')return;
    const size=resize();if(!size)return;
    const dark=document.body.classList.contains('dark-mode');
    const bg=dark?[0.105,0.133,0.164,1]:[0.89,0.925,0.945,1];
    gl.clearColor(bg[0],bg[1],bg[2],bg[3]);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.disable(gl.CULL_FACE);

    const eye=cameraEye();
    const proj=mat4Perspective(rad(47),size.w/size.h,.05,Math.max(250,distance*18));
    const view=mat4LookAt(eye,target,{x:0,y:0,z:1});
    const mvp=mat4Multiply(proj,view);
    gl.useProgram(program);
    gl.uniformMatrix4fv(uMVP,false,mvp);

    const mesh=buildScene(eye);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawArray(mesh.lines,gl.LINES);
    gl.depthMask(true);
    gl.disable(gl.BLEND);

    drawArray(mesh.opaque,gl.TRIANGLES);

    if(mesh.transparent.length){
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
      gl.depthMask(false);
      drawArray(mesh.transparent,gl.TRIANGLES);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }

    // Gizmo e contorno ficam visíveis mesmo quando parte do objeto está
    // encoberta: facilita localizar e editar o item selecionado.
    if(mesh.overlayLines.length){
      gl.disable(gl.DEPTH_TEST);
      drawArray(mesh.overlayLines,gl.LINES);
      gl.enable(gl.DEPTH_TEST);
    }
    updateSelectionInfo();
  }

  function setMode(next,options){
    const opts=options||{};
    const previousMode=mode;
    mode=next==='3d'?'3d':'2d';
    const is3d=mode==='3d';
    document.body.classList.toggle('view-3d',is3d);
    canvas.classList.toggle('hidden',!is3d);
    document.getElementById('svg-canvas').classList.toggle('hidden',is3d);
    help.classList.toggle('hidden',!is3d);
    btn2d.classList.toggle('active',!is3d);btn3d.classList.toggle('active',is3d);
    btn2d.setAttribute('aria-pressed',String(!is3d));btn3d.setAttribute('aria-pressed',String(is3d));
    const status=document.getElementById('status-mode');
    if(status&&status.lastChild)status.lastChild.textContent=is3d?' Visualização 3D':(state.blueprintOn?' Modo Blueprint':' Edição normal');
    const empty=document.getElementById('empty-hint');if(empty)empty.classList.toggle('hidden',is3d||state.elements.length!==0);
    if(is3d){
      activateTool('select');
      if(!cameraInitialized)resetCamera(false);
      else draw();
    }else{
      render();
    }
    if(opts.markChanged!==false && previousMode!==mode)markViewChanged();
  }

  btn2d.addEventListener('click',()=>setMode('2d'));
  btn3d.addEventListener('click',()=>setMode('3d'));
  resetBtn.addEventListener('click',()=>resetCamera(true));
  if(hideFrontBtn)hideFrontBtn.addEventListener('click',()=>{hideFrontWalls=!hideFrontWalls;updateHideFrontButton();draw();markViewChanged();});
  function select3DObject(el){
    selectedId=el&&el.type==='object'?el.id:null;
    updatePropertiesPanel();
    updateSelectionInfo();
    draw();
  }
  function startOrbit(e){
    interaction={type:'orbit',x:e.clientX,y:e.clientY,yaw,pitch};
    canvas.classList.add('dragging');
  }
  function applyMoveSnap(el,ignoreSnap){
    if(ignoreSnap)return;
    // Para móveis, uma malha de no máximo 10 cm dá precisão sem ficar
    // "grudando" demais. Se a grade do projeto for mais fina, respeita ela.
    if(state.gridOn){
      const grid=Math.max(.01,Math.min(.10,state.gridSpacing||.10));
      el.x=Math.round(el.x/grid)*grid;
      el.y=Math.round(el.y/grid)*grid;
    }
    const threshold=.18+Math.min(.12,Math.max(el.w||1,el.h||1)*.05);
    if(typeof snapObjectIntoNearbyCorner==='function')snapObjectIntoNearbyCorner(el,threshold);
    else if(typeof snapObjectToNearestWall==='function')snapObjectToNearestWall(el,threshold,false);
  }
  function pointerInteractionChanged(i){
    if(!i||!i.original)return false;
    const el=getElement(i.id);if(!el)return false;
    return Math.abs((el.x||0)-i.original.x)>.001||
      Math.abs((el.y||0)-i.original.y)>.001||
      Math.abs((el.elevation||0)-i.original.elevation)>.001||
      Math.abs((el.rotation||0)-i.original.rotation)>.05;
  }
  function clearPointerClasses(){
    canvas.classList.remove('dragging','object-drag','gizmo-drag','rotate-drag','object-hover');
  }
  function updateHoverCursor(e){
    if(interaction)return;
    const selected=selectedObject();
    const handle=selected?gizmoHitAt(e.clientX,e.clientY,selected):null;
    let hit=null;
    if(!handle)hit=pickObjectAt(e.clientX,e.clientY);
    hoverObjectId=hit?hit.id:null;
    canvas.classList.toggle('gizmo-drag',handle==='elevation');
    canvas.classList.toggle('rotate-drag',handle==='rotation');
    canvas.classList.toggle('object-hover',!!hit&&!handle);
  }

  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('dblclick',e=>{if(!pickObjectAt(e.clientX,e.clientY))resetCamera(true);});
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='3d')return;
    if(e.button!==0&&e.button!==1&&e.button!==2)return;
    e.preventDefault();
    try{canvas.setPointerCapture(e.pointerId);}catch(_){}

    // Botão direito/meio sempre orbita, inclusive quando o cursor está sobre um móvel.
    if(e.button===1||e.button===2){startOrbit(e);return;}

    const current=selectedObject();
    const handle=current?gizmoHitAt(e.clientX,e.clientY,current):null;
    if(current&&handle==='elevation'){
      interaction={
        type:'elevation',id:current.id,startY:e.clientY,startValue:objectElevation(current),
        original:{x:current.x,y:current.y,elevation:objectElevation(current),rotation:current.rotation||0}
      };
      canvas.classList.add('gizmo-drag');return;
    }
    if(current&&handle==='rotation'){
      const g=gizmoGeometry(current),ray=canvasRay(e.clientX,e.clientY);
      const p=rayPlaneZ(ray,g.z0+.055);
      interaction={
        type:'rotation',id:current.id,
        startAngle:p?Math.atan2(p.y-current.y,p.x-current.x):0,
        startRotation:current.rotation||0,
        original:{x:current.x,y:current.y,elevation:objectElevation(current),rotation:current.rotation||0}
      };
      canvas.classList.add('rotate-drag');return;
    }

    const hit=pickObjectAt(e.clientX,e.clientY);
    if(hit){
      if(selectedId!==hit.id)select3DObject(hit);
      const planeZ=objectElevation(hit);
      const p=rayPlaneZ(canvasRay(e.clientX,e.clientY),planeZ);
      interaction={
        type:'move-object',id:hit.id,planeZ,
        offset:p?{x:hit.x-p.x,y:hit.y-p.y}:{x:0,y:0},
        original:{x:hit.x,y:hit.y,elevation:objectElevation(hit),rotation:hit.rotation||0}
      };
      canvas.classList.add('object-drag');return;
    }

    // Clique em área vazia limpa a seleção e continua servindo para orbitar.
    if(selectedId!==null){selectedId=null;updatePropertiesPanel();updateSelectionInfo();draw();}
    startOrbit(e);
  });

  canvas.addEventListener('pointermove',e=>{
    if(!interaction){updateHoverCursor(e);return;}

    if(interaction.type==='orbit'){
      // Movimento invertido em relação ao mouse: arrastar a cena para um lado
      // faz a câmera orbitar para o lado oposto.
      yaw=interaction.yaw-(e.clientX-interaction.x)*.008;
      pitch=clamp(interaction.pitch+(e.clientY-interaction.y)*.006,.12,1.45);
      draw();return;
    }

    const el=getElement(interaction.id);
    if(!el||el.type!=='object')return;

    if(interaction.type==='move-object'){
      const p=rayPlaneZ(canvasRay(e.clientX,e.clientY),interaction.planeZ);
      if(!p)return;
      el.x=p.x+interaction.offset.x;
      el.y=p.y+interaction.offset.y;
      applyMoveSnap(el,e.altKey);
      draw();return;
    }

    if(interaction.type==='elevation'){
      const sensitivity=Math.max(.0035,Math.min(.018,distance*.00085));
      let value=interaction.startValue+(interaction.startY-e.clientY)*sensitivity;
      value=clamp(value,0,12);
      if(!e.altKey){
        value=Math.round(value/.05)*.05;
        if(value<.075)value=0;
      }
      el.elevation=value;
      draw();return;
    }

    if(interaction.type==='rotation'){
      const g=gizmoGeometry(el),p=rayPlaneZ(canvasRay(e.clientX,e.clientY),g.z0+.055);
      if(!p)return;
      const angle=Math.atan2(p.y-el.y,p.x-el.x);
      let degrees=interaction.startRotation+(angle-interaction.startAngle)*180/Math.PI;
      degrees=((degrees%360)+360)%360;
      if(!e.altKey)degrees=Math.round(degrees/15)*15%360;
      el.rotation=degrees;
      draw();
    }
  });

  const endPointer=e=>{
    const finished=interaction;
    interaction=null;
    drag=null;
    clearPointerClasses();
    try{canvas.releasePointerCapture(e.pointerId);}catch(_){}
    if(finished&&finished.type!=='orbit'&&pointerInteractionChanged(finished)){
      pushHistory();
      updatePropertiesPanel();
      render();
    }else{
      if(finished&&finished.type==='orbit'){
        const changed=Math.abs(yaw-finished.yaw)>.0001||Math.abs(pitch-finished.pitch)>.0001;
        if(changed){cameraInitialized=true;markViewChanged();}
      }
      updateSelectionInfo();
      if(mode==='3d')draw();
    }
  };
  canvas.addEventListener('pointerup',endPointer);
  canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('pointerleave',e=>{if(!interaction){canvas.classList.remove('object-hover','gizmo-drag','rotate-drag');hoverObjectId=null;}});
  canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*(e.deltaY>0?1.09:.92),2.8,180);cameraInitialized=true;draw();markViewChanged();},{passive:false});
  window.addEventListener('keydown',e=>{
    if(mode!=='3d')return;
    const tag=(document.activeElement&&document.activeElement.tagName)||'';
    if(tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT')return;
    const key=e.key.toLowerCase();
    if(key==='escape'){
      e.preventDefault();e.stopImmediatePropagation();
      selectedId=null;updatePropertiesPanel();updateSelectionInfo();draw();return;
    }
    const nav=['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'];
    if(nav.includes(key)){
      e.preventDefault();e.stopImmediatePropagation();
      const step=Math.max(.18,Math.min(1.2,distance*.032))*(e.shiftKey?2.7:1);
      if(key==='w'||key==='arrowup')moveCameraPlanar(step,0);
      else if(key==='s'||key==='arrowdown')moveCameraPlanar(-step,0);
      else if(key==='a'||key==='arrowleft')moveCameraPlanar(0,-step);
      else if(key==='d'||key==='arrowright')moveCameraPlanar(0,step);
      return;
    }
    if(key==='h'){
      e.preventDefault();e.stopImmediatePropagation();hideFrontWalls=!hideFrontWalls;updateHideFrontButton();draw();markViewChanged();return;
    }
    // Evita trocar de ferramenta 2D por atalhos enquanto o canvas 3D está ativo.
    if(['q','e','r','t','y','u'].includes(key)&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
      e.preventDefault();e.stopImmediatePropagation();
    }
  },true);
  window.addEventListener('resize',()=>{if(mode==='3d')draw();});
  updateHideFrontButton();

  const export3DHTMLBtn=document.getElementById('export-3d-html');
  if(export3DHTMLBtn)export3DHTMLBtn.addEventListener('click',()=>{
    const modal=document.getElementById('export-modal');if(modal)modal.classList.add('hidden');
    exportStandalone3DHTML();
  });

  const export3DBtn=document.getElementById('export-3d');
  if(export3DBtn)export3DBtn.addEventListener('click',()=>{
    const modal=document.getElementById('export-modal');if(modal)modal.classList.add('hidden');
    export3DModel();
  });

  window.refresh3DView=()=>{if(mode==='3d')draw();};
  window.export3DModel=export3DModel;
  window.exportStandalone3DHTML=exportStandalone3DHTML;
  window.setEditorViewMode=setMode;
  window.get3DViewState=get3DViewState;
  window.restore3DViewState=restore3DViewState;
})();
