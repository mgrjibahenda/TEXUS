(() => {
  "use strict";

  const canvas = document.getElementById("glCanvas");
  const gl = canvas.getContext("webgl", { antialias: true, alpha: false });
  const $ = (id) => document.getElementById(id);
  const ui = {
    targetRank: $("targetRank"), bulletNow: $("bulletNow"), bulletTotal: $("bulletTotal"), playersPanel: $("playersPanel"),
    logPanel: $("logPanel"), handCards: $("handCards"), turnHint: $("turnHint"), claimCount: $("claimCount"), playBtn: $("playBtn"),
    challengeBtn: $("challengeBtn"), passBtn: $("passBtn"), newRoundBtn: $("newRoundBtn"), hideCardsBtn: $("hideCardsBtn"),
    spectatorBtn: $("spectatorBtn"), toast: $("centerToast")
  };

  if (!gl) {
    document.body.innerHTML = '<div style="padding:40px;color:white;font-family:sans-serif">你的浏览器没有开启 WebGL，无法显示真正 3D。请用最新版 Chrome/Edge，并确认硬件加速已开启。</div>';
    return;
  }

  const TAU = Math.PI * 2;
  const RANKS = ["A", "K", "Q", "Joker"];
  const TARGETS = ["ACE", "KING", "QUEEN"];
  const nameToRank = { ACE: "A", KING: "K", QUEEN: "Q" };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = (t) => 1 - Math.pow(1 - t, 3);

  const M4 = {
    identity() { return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; },
    mul(a,b){
      const o = new Array(16);
      for (let r=0;r<4;r++) for (let c=0;c<4;c++) o[c*4+r] = a[0*4+r]*b[c*4+0] + a[1*4+r]*b[c*4+1] + a[2*4+r]*b[c*4+2] + a[3*4+r]*b[c*4+3];
      return o;
    },
    translate(m, v){ const t=this.identity(); t[12]=v[0]; t[13]=v[1]; t[14]=v[2]; return this.mul(m,t); },
    scale(m, v){ const s=this.identity(); s[0]=v[0]; s[5]=v[1]; s[10]=v[2]; return this.mul(m,s); },
    rotX(m,a){ const c=Math.cos(a),s=Math.sin(a); return this.mul(m,[1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]); },
    rotY(m,a){ const c=Math.cos(a),s=Math.sin(a); return this.mul(m,[c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]); },
    rotZ(m,a){ const c=Math.cos(a),s=Math.sin(a); return this.mul(m,[c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]); },
    perspective(fovy, aspect, near, far){ const f=1/Math.tan(fovy/2), nf=1/(near-far); return [f/aspect,0,0,0, 0,f,0,0, 0,0,(far+near)*nf,-1, 0,0,(2*far*near)*nf,0]; },
    lookAt(eye, center, up){
      let zx=eye[0]-center[0], zy=eye[1]-center[1], zz=eye[2]-center[2];
      let zlen=Math.hypot(zx,zy,zz)||1; zx/=zlen; zy/=zlen; zz/=zlen;
      let xx=up[1]*zz-up[2]*zy, xy=up[2]*zx-up[0]*zz, xz=up[0]*zy-up[1]*zx;
      let xlen=Math.hypot(xx,xy,xz)||1; xx/=xlen; xy/=xlen; xz/=xlen;
      let yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      return [xx,yx,zx,0, xy,yy,zy,0, xz,yz,zz,0, -(xx*eye[0]+xy*eye[1]+xz*eye[2]), -(yx*eye[0]+yy*eye[1]+yz*eye[2]), -(zx*eye[0]+zy*eye[1]+zz*eye[2]), 1];
    }
  };

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  const vs = shader(gl.VERTEX_SHADER, `
    attribute vec3 aPos; attribute vec3 aNormal; attribute vec3 aColor;
    uniform mat4 uModel; uniform mat4 uView; uniform mat4 uProj; uniform float uTime;
    varying vec3 vNormal; varying vec3 vWorld; varying vec3 vColor;
    void main(){
      vec4 world = uModel * vec4(aPos, 1.0);
      vWorld = world.xyz; vNormal = mat3(uModel) * aNormal; vColor = aColor;
      gl_Position = uProj * uView * world;
    }
  `);
  const fs = shader(gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec3 vNormal; varying vec3 vWorld; varying vec3 vColor;
    uniform vec3 uCam; uniform float uTime;
    void main(){
      vec3 n = normalize(vNormal);
      vec3 key = normalize(vec3(-0.35, 0.75, 0.55));
      vec3 fire = vec3(3.8, 1.05 + sin(uTime*4.0)*0.08, -4.65);
      vec3 candle = vec3(-1.2, 1.25, 0.25);
      float d1 = max(dot(n, key), 0.0) * 0.48;
      float d2 = max(dot(n, normalize(fire - vWorld)), 0.0) * 2.5 / max(1.0, length(fire-vWorld)*length(fire-vWorld));
      float d3 = max(dot(n, normalize(candle - vWorld)), 0.0) * 1.8 / max(1.0, length(candle-vWorld)*length(candle-vWorld));
      float rim = pow(1.0 - max(dot(normalize(uCam-vWorld), n), 0.0), 2.0) * 0.22;
      float fog = clamp((length(uCam-vWorld)-4.0)/15.0, 0.0, 1.0);
      vec3 color = vColor * (0.24 + d1 + d2 + d3) + rim * vec3(1.0, .74, .38);
      color = mix(color, vec3(0.07,0.045,0.055), fog);
      gl_FragColor = vec4(color, 1.0);
    }
  `);
  const program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const loc = {
    aPos: gl.getAttribLocation(program, "aPos"), aNormal: gl.getAttribLocation(program, "aNormal"), aColor: gl.getAttribLocation(program, "aColor"),
    uModel: gl.getUniformLocation(program, "uModel"), uView: gl.getUniformLocation(program, "uView"), uProj: gl.getUniformLocation(program, "uProj"), uCam: gl.getUniformLocation(program, "uCam"), uTime: gl.getUniformLocation(program, "uTime")
  };

  function makeMesh(vertices) {
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    return { buffer, count: vertices.length / 9 };
  }
  function pushTri(a,b,c,color,out){
    const ux=b[0]-a[0], uy=b[1]-a[1], uz=b[2]-a[2], vx=c[0]-a[0], vy=c[1]-a[1], vz=c[2]-a[2];
    let nx=uy*vz-uz*vy, ny=uz*vx-ux*vz, nz=ux*vy-uy*vx; const l=Math.hypot(nx,ny,nz)||1; nx/=l; ny/=l; nz/=l;
    for (const p of [a,b,c]) out.push(p[0],p[1],p[2], nx,ny,nz, color[0],color[1],color[2]);
  }
  function cube(w=1,h=1,d=1,color=[1,1,1]){
    const x=w/2,y=h/2,z=d/2, v=[];
    const p=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
    [[0,1,2,3],[5,4,7,6],[4,0,3,7],[1,5,6,2],[3,2,6,7],[4,5,1,0]].forEach(f=>{ pushTri(p[f[0]],p[f[1]],p[f[2]],color,v); pushTri(p[f[0]],p[f[2]],p[f[3]],color,v); });
    return makeMesh(v);
  }
  function cyl(r=1,h=1,n=32,color=[1,1,1]){
    const v=[], y=h/2;
    for(let i=0;i<n;i++){
      const a=i/n*TAU,b=(i+1)/n*TAU, p1=[Math.cos(a)*r,-y,Math.sin(a)*r], p2=[Math.cos(b)*r,-y,Math.sin(b)*r], p3=[Math.cos(b)*r,y,Math.sin(b)*r], p4=[Math.cos(a)*r,y,Math.sin(a)*r];
      pushTri(p1,p2,p3,color,v); pushTri(p1,p3,p4,color,v); pushTri([0,y,0],p4,p3,color,v); pushTri([0,-y,0],p2,p1,color,v);
    }
    return makeMesh(v);
  }
  function sphere(r=1, lat=12, lon=24, color=[1,1,1]){
    const v=[];
    for(let i=0;i<lat;i++) for(let j=0;j<lon;j++){
      const a=i/lat*Math.PI, b=(i+1)/lat*Math.PI, c=j/lon*TAU, d=(j+1)/lon*TAU;
      const P=(u,t)=>[Math.sin(u)*Math.cos(t)*r, Math.cos(u)*r, Math.sin(u)*Math.sin(t)*r];
      pushTri(P(a,c),P(b,c),P(b,d),color,v); pushTri(P(a,c),P(b,d),P(a,d),color,v);
    }
    return makeMesh(v);
  }
  function cardMesh(color=[.95,.9,.72]) { return cube(.46,.035,.66,color); }

  const meshes = {
    floor: cube(1,1,1,[0.36,0.17,0.10]), wall: cube(1,1,1,[0.22,0.12,0.10]), darkWood: cube(1,1,1,[0.22,0.105,0.055]),
    tableTop: cyl(1, .20, 96, [0.16,0.09,0.045]), tableFelt: cyl(.90, .215, 96, [0.025,0.31,0.23]), goldRing: cyl(1.02,.075,96,[0.78,0.47,0.13]), leg: cyl(.09,1,24,[0.18,0.09,0.045]),
    chair: cube(1,1,1,[0.18,0.09,0.055]), body: sphere(.45,16,24,[0.12,0.20,0.32]), head: sphere(.20,14,20,[0.68,0.49,0.36]),
    candle: cyl(.035,.28,12,[1.0,.89,.55]), flame: sphere(.07,8,12,[1.0,.42,.08]), bottle: cyl(.06,.42,16,[0.06,.25,.16]), barrel: cyl(.35,.72,24,[0.36,.16,.07]),
    chipRed: cyl(.060,.028,24,[.76,.08,.13]), chipWhite: cyl(.060,.028,24,[.86,.84,.74]), chipGold: cyl(.060,.028,24,[.82,.56,.14]), card: cardMesh(), cardBack: cardMesh([.23,.04,.08]),
    gun: cube(.62,.13,.18,[.08,.075,.07]), metal: cyl(.18,.16,24,[.42,.40,.37]), poster: cube(.7,.02,.48,[.62,.46,.27]), window: cube(1,.04,.65,[.04,.055,.10]), ember: sphere(.018,8,8,[1,.25,.02]), smoke: sphere(.030,8,8,[.24,.24,.27])
  };

  const objects = [];
  function add(mesh, pos, scale=[1,1,1], rot=[0,0,0], name="", dynamic=null){ objects.push({mesh,pos:[...pos],scale:[...scale],rot:[...rot],name,dynamic,base:[...pos]}); }
  function room() {
    add(meshes.floor,[0,-.05,0],[11,.1,9], [0,0,0], "floor");
    add(meshes.wall,[0,2.2,-4.55],[11,4.5,.18], [0,0,0], "back wall");
    add(meshes.wall,[-5.55,2.2,0],[.18,4.5,9], [0,0,0], "left wall");
    add(meshes.wall,[5.55,2.2,0],[.18,4.5,9], [0,0,0], "right wall");
    add(meshes.darkWood,[0,4.48,0],[11,.15,9], [0,0,0], "ceiling");
    for(let i=-5;i<=5;i+=1){ add(meshes.darkWood,[i,-.0,0],[.035,.08,9.05], [0,0,0], "floor seam"); }
    for(let z=-4;z<=4;z+=1){ add(meshes.darkWood,[0,.02,z],[11,.06,.035], [0,0,0], "floor seam z"); }
    for(let x=-4.8;x<=4.8;x+=1.6) add(meshes.darkWood,[x,4.32,0],[.08,.24,9], [0,0,0], "beam");
  }
  function tavernProps() {
    add(meshes.darkWood,[3.9,.65,-3.85],[2.6,1.3,.45], [0,0,0], "bar counter");
    add(meshes.darkWood,[3.9,1.65,-4.35],[2.7,.12,.18], [0,0,0], "shelf");
    add(meshes.darkWood,[3.9,2.25,-4.35],[2.7,.12,.18], [0,0,0], "shelf2");
    for(let x=2.8;x<=5.0;x+=.36) for(let y of [1.86,2.46]) add(meshes.bottle,[x,y,-4.18],[1,1,1],[0,0,0],"bottle");
    add(meshes.window,[-3.75,2.25,-4.43],[1.45,1.7,.05],[0,0,0],"rain window");
    for(let x of [-4.2,-3.75,-3.3]) add(meshes.darkWood,[x,2.25,-4.38],[.035,1.72,.06],[0,0,0],"window frame");
    for(let y of [1.75,2.25,2.75]) add(meshes.darkWood,[-3.75,y,-4.37],[1.5,.035,.06],[0,0,0],"window frame h");
    add(meshes.darkWood,[0,3.55,0],[.07,1.55,.07],[0,0,0],"lamp chain");
    add(meshes.metal,[0,2.72,0],[1.7,.14,1.7],[Math.PI/2,0,0],"chandelier");
    for(let i=0;i<8;i++){ const a=i/8*TAU, phase=i*.83; add(meshes.candle,[Math.cos(a)*.75,2.75,Math.sin(a)*.75],[1,1.3,1],[0,0,0],"hanging candle"); add(meshes.flame,[Math.cos(a)*.75,2.96,Math.sin(a)*.75],[1,1.3,1],[0,0,0],"hanging flame", t=>({pos:[Math.cos(a)*.75,2.96+Math.sin(t*8+phase)*.004,Math.sin(a)*.75], scale:[1+Math.sin(t*10+phase)*.04,1.25+Math.sin(t*11+phase)*.06,1]})); }
    add(meshes.wall,[0,.75,-4.43],[1.45,1.1,.12],[0,0,0],"fireplace stone");
    add(meshes.ember,[0,.37,-4.25],[6,2.3,2],[0,0,0],"fire glow", t=>({scale:[6+Math.sin(t*5)*.20,2.1+Math.sin(t*6.5)*.12,2]}));
    for(let i=0;i<28;i++){ const ex=rnd(-.55,.55), ey=rnd(.24,.67), ez=-4.13+rnd(-.02,.06), phase=rnd(0,TAU), size=rnd(.42,.95); add(meshes.ember,[ex,ey,ez],[size,size*1.45,size],[0,0,0],"fire ember", t=>({pos:[ex+Math.sin(t*3+phase)*.015, ey+Math.sin(t*5+phase)*.02, ez]})); }
    for(let i=0;i<22;i++){ const bx=-4.7+rnd(-.18,.18), bz=-2.8+i*.18%1.0; add(meshes.barrel,[bx,.38,bz],[1,1,1],[Math.PI/2,0,rnd(-.1,.1)],"barrel"); }
    for(let x of [-2.5,-1.5,1.5,2.5]) add(meshes.poster,[x,2.7,-4.40],[1,1,1],[0,0,0],"wanted poster");
  }
  function gameTable() {
    // Larger table and cleaner tabletop layout: no random props crossing through each other.
    add(meshes.goldRing,[0,.76,0],[1.70,1,1.70],[0,0,0],"large brass rim");
    add(meshes.tableTop,[0,.72,0],[1.68,1,1.68],[0,0,0],"large table top");
    add(meshes.tableFelt,[0,.85,0],[1.50,1,1.50],[0,0,0],"large green felt");
    add(meshes.leg,[0,.24,0],[1.15,1,1.15],[0,0,0],"center table leg");
    for(let i=0;i<4;i++){ const a=i/4*TAU+Math.PI/4; add(meshes.leg,[Math.cos(a)*1.05,.32,Math.sin(a)*1.05],[.72,.86,.72],[0,0,0],"outer table leg"); }

    const stacks=[[-.55,.15,meshes.chipRed],[ -.35,.18,meshes.chipWhite],[-.15,.10,meshes.chipGold],[.18,.16,meshes.chipRed],[.38,.13,meshes.chipGold]];
    stacks.forEach(([x,z,chip], si)=>{ for(let j=0;j<5;j++) add(chip,[x,.99+j*.032,z],[1,1,1],[0,si*.3,0],"neat chip stack"); });

    add(meshes.gun,[.88,1.035,-.10],[.92,.92,.92],[0,.18,0],"revolver body");
    add(meshes.metal,[.68,1.045,-.10],[.85,.85,.85],[Math.PI/2,0,.16],"revolver cylinder", t=>({rot:[Math.PI/2,0,.16+t*.25]}));
    for(let i=0;i<5;i++) add(meshes.cardBack,[-.72+i*.055,1.025,-.52+i*.012],[.92,.92,.92],[0,.12+i*.035,0],"tidy discard pile");

    for(const x of [-1.22,1.22]){ add(meshes.candle,[x,1.06,.74],[.9,1.1,.9],[0,0,0],"edge candle"); add(meshes.flame,[x,1.24,.74],[.9,1.2,.9],[0,0,0],"edge flame", t=>({scale:[.9+Math.sin(t*9+x)*.03,1.2+Math.sin(t*13+x)*.08,.9]})); }
  }
  function players3D() {
    const names=["你","Raven","Doc","Viper"];
    for(let i=0;i<4;i++){
      const a=i/4*TAU+Math.PI/2, x=Math.cos(a)*2.90, z=Math.sin(a)*2.90;
      add(meshes.chair,[x,.35,z],[.95,.22,.95],[0,-a,0],"chair"); add(meshes.chair,[x,.93,z+.18*Math.sin(a)],[.95,1.0,.18],[0,-a,0],"chair back");
      add(meshes.body,[x,.98,z],[.8,1.0,.55],[0,-a,0],names[i]+" body", t=>({pos:[x,.98+Math.sin(t*2+i)*.015,z]}));
      add(meshes.head,[x,1.55,z],[1,1,1],[0,0,0],names[i]+" head", t=>({pos:[x,1.55+Math.sin(t*2+i)*.012,z]}));
      for(let c=0;c<4;c++){ const off=(c-1.5)*.15; const inX=x-Math.cos(a)*.36, inZ=z-Math.sin(a)*.36; add(meshes.cardBack,[inX+Math.cos(a+Math.PI/2)*off,1.18,inZ+Math.sin(a+Math.PI/2)*off],[.70,.70,.70],[0,-a,0],names[i]+" table cards"); }
    }
  }
  function ambience() {
    // Controlled particles: smoke stays above fireplace; tiny dust motes stay subtle.
    for(let i=0;i<24;i++){
      const ox=rnd(-.42,.42), oz=rnd(-.04,.04), phase=rnd(0,TAU), size=rnd(.38,.75);
      add(meshes.smoke,[ox,1.05,-4.12+oz],[size,size*1.35,size],[0,0,0],"fireplace smoke", t=>({
        pos:[ox+Math.sin(t*.55+phase)*.10, 1.05+((t*.18+i*.13)%1.75), -4.12+oz],
        scale:[size*(1+((t*.18+i*.13)%1.75)*.35), size*1.35, size*(1+((t*.18+i*.13)%1.75)*.35)]
      }));
    }
    for(let i=0;i<45;i++){
      const x=rnd(-4.8,4.8), z=rnd(-3.8,3.2), y=rnd(.5,3.8), phase=rnd(0,TAU), size=rnd(.08,.18);
      add(meshes.ember,[x,y,z],[size,size,size],[0,0,0],"small dust mote", t=>({pos:[x+Math.sin(t*.35+phase)*.08, y+Math.sin(t*.22+phase)*.05, z+Math.cos(t*.31+phase)*.08]}));
    }
  }
  room(); tavernProps(); gameTable(); players3D(); ambience();

  let yaw = 0.02, pitch = 0.48, dist = 7.8, target = [0,.95,0], dragging=false, lastX=0,lastY=0;
  canvas.addEventListener("pointerdown", e=>{dragging=true; lastX=e.clientX; lastY=e.clientY; canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener("pointerup", ()=>dragging=false);
  canvas.addEventListener("pointermove", e=>{ if(!dragging) return; yaw -= (e.clientX-lastX)*0.006; pitch = clamp(pitch + (e.clientY-lastY)*0.004, .15, 1.25); lastX=e.clientX; lastY=e.clientY; });
  canvas.addEventListener("wheel", e=>{ e.preventDefault(); dist=clamp(dist+e.deltaY*.006,3.7,10.5); }, {passive:false});

  function modelMatrix(o, t){
    let p=o.pos, s=o.scale, r=o.rot;
    if(o.dynamic){ const d=o.dynamic(t)||{}; p=d.pos||p; s=d.scale||s; r=d.rot||r; }
    let m=M4.identity(); m=M4.translate(m,p); m=M4.rotX(m,r[0]); m=M4.rotY(m,r[1]); m=M4.rotZ(m,r[2]); m=M4.scale(m,s); return m;
  }
  function drawMesh(mesh, model){
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    const stride = 9*4;
    gl.enableVertexAttribArray(loc.aPos); gl.vertexAttribPointer(loc.aPos,3,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(loc.aNormal); gl.vertexAttribPointer(loc.aNormal,3,gl.FLOAT,false,stride,3*4);
    gl.enableVertexAttribArray(loc.aColor); gl.vertexAttribPointer(loc.aColor,3,gl.FLOAT,false,stride,6*4);
    gl.uniformMatrix4fv(loc.uModel,false,new Float32Array(model));
    gl.drawArrays(gl.TRIANGLES,0,mesh.count);
  }
  function resize(){ const dpr=Math.min(devicePixelRatio||1,2); const w=Math.floor(canvas.clientWidth*dpr), h=Math.floor(canvas.clientHeight*dpr); if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h; gl.viewport(0,0,w,h);} }
  function render(ms){
    const t=ms*.001; resize(); gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.clearColor(.035,.025,.03,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const eye=[Math.sin(yaw)*Math.cos(pitch)*dist, Math.sin(pitch)*dist+1.0, Math.cos(yaw)*Math.cos(pitch)*dist];
    const view=M4.lookAt(eye,target,[0,1,0]); const proj=M4.perspective(48*Math.PI/180, canvas.width/canvas.height, .05, 80);
    gl.uniformMatrix4fv(loc.uView,false,new Float32Array(view)); gl.uniformMatrix4fv(loc.uProj,false,new Float32Array(proj)); gl.uniform3fv(loc.uCam,new Float32Array(eye)); gl.uniform1f(loc.uTime,t);
    objects.forEach(o=>drawMesh(o.mesh, modelMatrix(o,t)));
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const state = { round:0, target:"QUEEN", bullet:1, chamber:6, current:0, lastPlay:null, hidden:false, selected:new Set(), players:[] };
  function makeDeck(){ const deck=[]; for(const r of RANKS) for(let i=0;i<5;i++) deck.push(r); return deck.sort(()=>Math.random()-.5); }
  function toast(msg){ ui.toast.textContent=msg; ui.toast.classList.add("show"); clearTimeout(toast.t); toast.t=setTimeout(()=>ui.toast.classList.remove("show"),1300); }
  function log(msg,type=""){ const div=document.createElement("div"); div.className=`log ${type}`; div.textContent=msg; ui.logPanel.appendChild(div); }
  function newRound(){
    const deck=makeDeck(); state.round++; state.target=TARGETS[Math.floor(Math.random()*TARGETS.length)]; state.bullet=1; state.chamber=6; state.current=0; state.lastPlay=null; state.selected.clear();
    const names=["你","Raven","Doc","Viper"]; state.players=names.map((n,i)=>({name:n, chips:i===3?1000:980, hand:deck.splice(0,5), alive:true, status:i===0?"轮到你":"等待", show:false}));
    ui.logPanel.innerHTML=""; log(`第 ${state.round} 局开始。目标牌是 ${state.target}。`); toast("酒馆开局"); renderUI();
  }
  function renderUI(){
    ui.targetRank.textContent=state.target; ui.bulletNow.textContent=state.bullet; ui.bulletTotal.textContent=state.chamber;
    ui.playersPanel.innerHTML="";
    state.players.forEach((p,i)=>{ const card=document.createElement("div"); card.className="playerCard"+(i===state.current?" active":""); card.innerHTML=`<div class="playerTop"><span>${p.name}</span><span>${p.chips}</span></div><div class="playerMeta">手牌 ${p.hand.length} · ${p.status}</div><div class="meter"><i style="width:${clamp(p.chips/10,5,100)}%"></i></div>`; ui.playersPanel.appendChild(card); });
    ui.turnHint.textContent = state.current===0 ? "轮到你：选择 1–3 张牌，可以真出也可以诈唬。" : `${state.players[state.current].name} 正在思考……`;
    ui.handCards.innerHTML="";
    state.players[0].hand.forEach((r,idx)=>{ const c=document.createElement("div"); c.className="card"+(state.hidden?" hidden":"")+(state.selected.has(idx)?" selected":""); c.innerHTML=`<span class="corner">✦</span><span class="rank">${r}</span><span class="corner">${r}</span>`; c.onclick=()=>{ if(state.current!==0) return; state.selected.has(idx)?state.selected.delete(idx):state.selected.add(idx); if(state.selected.size>3){ const first=[...state.selected][0]; state.selected.delete(first); } renderUI(); }; ui.handCards.appendChild(c); });
    ui.playBtn.disabled = state.current!==0 || state.selected.size===0; ui.challengeBtn.disabled=!state.lastPlay || state.lastPlay.player===0; ui.passBtn.disabled=state.current!==0;
  }
  function targetRank(){ return nameToRank[state.target]; }
  function spinPenalty(playerIndex){
    const hit = Math.random() < state.bullet / state.chamber; const p=state.players[playerIndex];
    state.bullet = hit ? 1 : state.bullet + 1;
    if(hit){ p.chips=Math.max(0,p.chips-220); p.status="中弹，损失筹码"; log(`${p.name} 扳机落下：砰！损失 220 筹码。`,"bad"); toast("砰！轮盘惩罚"); }
    else { p.status="空膛逃过一劫"; log(`${p.name} 扳机落下：空膛。下一次更危险。`,"good"); toast("咔哒……空膛"); }
  }
  function nextTurn(){ state.current=(state.current+1)%4; state.players.forEach((p,i)=>p.status=i===state.current?"思考中":"等待"); renderUI(); if(state.current!==0) setTimeout(aiMove, 700+rnd(250,850)); }
  function playerPlay(){
    const picks=[...state.selected].sort((a,b)=>b-a); const actual=picks.map(i=>state.players[0].hand[i]); picks.forEach(i=>state.players[0].hand.splice(i,1));
    const claim=parseInt(ui.claimCount.value,10); state.lastPlay={player:0, actual, claim, target:state.target}; state.selected.clear();
    log(`你推出 ${actual.length} 张牌，并声明全是 ${state.target}。`); toast("你已声明"); if(state.players[0].hand.length===0) log("你已经出完手牌，其他人最后可以质疑。","good"); nextTurn();
  }
  function aiMove(){
    const ai=state.players[state.current];
    if(state.lastPlay && Math.random()<.24){ challenge(state.current); return; }
    const n=Math.min(ai.hand.length, Math.ceil(rnd(.3,3.0))); const actual=ai.hand.splice(0,n); state.lastPlay={player:state.current, actual, claim:n, target:state.target};
    log(`${ai.name} 推出 ${n} 张牌，并冷静声明全是 ${state.target}。`); toast(`${ai.name} 声明出牌`);
    if(ai.hand.length===0){ log(`${ai.name} 手牌已空。你可以质疑，或观察让他赢下本局。`,"bad"); state.current=0; state.players.forEach((p,i)=>p.status=i===0?"最后决定":"等待"); renderUI(); return; }
    nextTurn();
  }
  function challenge(challenger=0){
    if(!state.lastPlay) return; const lp=state.lastPlay; const liar = lp.actual.some(r => r!==targetRank() && r!=="Joker"); const accused=lp.player; const loser = liar ? accused : challenger;
    log(`${state.players[challenger].name} 质疑 ${state.players[accused].name}。翻开：${lp.actual.join(", ")}。`, liar?"good":"bad");
    if(liar) log(`${state.players[accused].name} 说谎被抓。`,"bad"); else log(`质疑失败，声明成立。`,"bad");
    spinPenalty(loser); state.lastPlay=null; state.current=(loser+1)%4; renderUI(); if(state.current!==0) setTimeout(aiMove, 900);
  }
  function pass(){
    if(state.lastPlay && state.players[state.lastPlay.player].hand.length===0){ const win=state.players[state.lastPlay.player]; win.chips+=260; win.status="赢下本局"; log(`${win.name} 出完最后一手且无人成功质疑，赢下本局 +260。`,"good"); toast(`${win.name} 赢下本局`); setTimeout(newRound,1200); return; }
    log("你选择观察，酒馆气氛更紧张。"); nextTurn();
  }
  ui.playBtn.onclick=playerPlay; ui.challengeBtn.onclick=()=>challenge(0); ui.passBtn.onclick=pass; ui.newRoundBtn.onclick=newRound; ui.hideCardsBtn.onclick=()=>{state.hidden=!state.hidden; renderUI();};
  ui.spectatorBtn.onclick=()=>toast("拖动画面旋转，滚轮缩放。目标：判断对手是否谎称目标牌。Joker 可当目标牌。");
  newRound();
})();
