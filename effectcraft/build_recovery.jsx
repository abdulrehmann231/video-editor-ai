// ============================================================================
// EffectCraft (open-source After Effects clone) build script
// "Signs you're not recovered" — motion-graphics edit in the style of the
// Editing Inspiration Vault (Luis Alcantara).
//
// Run:   effectcraft-cli script build_recovery.jsx --empty
// Needs: SRC env path baked below (footage), fonts Montserrat / Space Mono / VT323.
//
// Edit structure (comp time):
//   0.00 – 47.60  source 0.00 – 47.60   (hook → reality → checklist → graph …)
//   47.60 – 55.80 source 80.30 – 88.50  (chapter card "SIGN #1" → soreness)
//
// Vault references recreated:
//   #146  mono "terminal" title card w/ dust + scramble lower box ("TOP 0.001%")
//   #196  regular+bold word reveal + Revenue/Profit progress bar ("Free cashflow")
//   #44   whip-pan motion-blur transition
//   #893  circuit node graph, nodes light up green ("BIG PROBLEM")
//   #879/#880  pop-in checklist cards ("Turning toward / away")
//   #882  B&W footage + yellow pixel caption ("I'm 17 years old")
//   #754  blurred footage, "LAZY METHODS > OTHER ALTERNATIVES" comparison
//   #924  glitch-block chapter card ("STEP 3: SELL YOUR TIME")
//   #929  bottom chapter tab with underline
// ============================================================================

var SRC = "/tmp/work/src.mp4";
var OUT = "/tmp/work/recovery.ecproj";
var W = 1920, H = 1080, FPS = 30, DUR = 55.8;
var SEG2_OFFSET = 80.3 - 47.6; // source time minus comp time for part 2

// ---------------------------------------------------------------- palette
var WHITE = [1, 1, 1], BLACK = [0, 0, 0];
var NAVY = [0.02, 0.04, 0.12];
var GREEN = [0.24, 1.0, 0.48];
var RED = [1.0, 0.2, 0.25];
var YELLOW = [1.0, 0.9, 0.0];
var INK = [0.07, 0.08, 0.11];

// ---------------------------------------------------------------- helpers
var proj = app.project;

function easeKeys(prop, infl) {
  // strong "expo-out" style ease on every key (AE graph-editor look)
  infl = infl || 80;
  var dims = 1;
  try { var v = prop.keyValue(1); if (v instanceof Array) dims = v.length; } catch (e) {}
  if (prop.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
      prop.propertyValueType === PropertyValueType.ThreeD_SPATIAL) dims = 1;
  var arr = [];
  for (var d = 0; d < dims; d++) arr.push(new KeyframeEase(0, infl));
  for (var k = 1; k <= prop.numKeys; k++) {
    try { prop.setTemporalEaseAtKey(k, arr, arr); } catch (e) {}
  }
}

// keys: [[t, v], ...]; opts.ease (influence) | opts.hold | opts.linear
function K(prop, keys, opts) {
  opts = opts || {};
  for (var i = 0; i < keys.length; i++) {
    try { prop.setValueAtTime(keys[i][0], keys[i][1]); }
    catch (e) { throw new Error("K(" + prop.name + " @" + keys[i][0] + " = " + keys[i][1] + "): " + e.message); }
  }
  if (opts.hold) {
    for (var k = 1; k <= prop.numKeys; k++)
      prop.setInterpolationTypeAtKey(k, KeyframeInterpolationType.HOLD, KeyframeInterpolationType.HOLD);
  } else if (opts.linear) {
    for (var k2 = 1; k2 <= prop.numKeys; k2++)
      prop.setInterpolationTypeAtKey(k2, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
  } else {
    easeKeys(prop, opts.ease || 80);
  }
  return prop;
}

function vadd(a, b) { var r = []; for (var i = 0; i < a.length; i++) r.push(a[i] + (b[i] || 0)); return r; }
function tr(layer, name) {
  var map = { pos: "ADBE Position", scale: "ADBE Scale", rot: "ADBE Rotate Z",
              op: "ADBE Opacity", anchor: "ADBE Anchor Point" };
  return layer.property("ADBE Transform Group").property(map[name]);
}

function span(layer, tin, tout) { layer.inPoint = tin; layer.outPoint = tout; return layer; }

// text layer. o: {font,size,color,just:"L"|"C"|"R",pos,tracking,name,leading}
function T(comp, str, o) {
  var l = comp.layers.addText(str);
  var p = l.property("ADBE Text Properties").property("ADBE Text Document");
  var d = p.value;
  d.font = o.font || "Montserrat-ExtraBold";
  d.fontSize = o.size || 80;
  d.fillColor = o.color || WHITE;
  d.applyFill = true;
  d.tracking = o.tracking || 0;
  if (o.leading) { d.autoLeading = false; d.leading = o.leading; }
  d.justification = o.just === "L" ? ParagraphJustification.LEFT_JUSTIFY :
                    o.just === "R" ? ParagraphJustification.RIGHT_JUSTIFY :
                                     ParagraphJustification.CENTER_JUSTIFY;
  p.setValue(d);
  if (o.pos) tr(l, "pos").setValue(o.pos);
  if (o.name) l.name = o.name;
  return l;
}
function srcText(l) { return l.property("ADBE Text Properties").property("ADBE Text Document"); }

// per-character / per-word reveal using a range selector (Start 0→100)
// props: {op:0, blur:[x,y], pos:[x,y], scale:[x,y], rot}
function reveal(l, t0, t1, props, basedOn, smooth) {
  var a = l.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator");
  var ap = a.property("ADBE Text Animator Properties");
  if (props.op !== undefined) ap.addProperty("ADBE Text Opacity").setValue(props.op);
  if (props.blur) ap.addProperty("ADBE Text Blur").setValue(props.blur);
  if (props.pos) ap.addProperty("ADBE Text Position 3D").setValue([props.pos[0], props.pos[1], 0]);
  if (props.scale) ap.addProperty("ADBE Text Scale 3D").setValue([props.scale[0], props.scale[1], 100]);
  if (props.rot !== undefined) ap.addProperty("ADBE Text Rotation").setValue(props.rot);
  if (props.track !== undefined) ap.addProperty("ADBE Text Tracking Amount").setValue(props.track);
  var s = a.property("ADBE Text Selectors").property(1);
  var adv = s.property("advanced");
  adv.property("basedOn").setValue(basedOn || 1);   // 1 chars, 3 words
  adv.property("shape").setValue(1);                // square
  adv.property("smoothness").setValue(smooth === undefined ? 100 : smooth);
  K(s.property("start"), [[t0, 0], [t1, 100]], { ease: 60 });
  return a;
}

// "decode / scramble" source-text expression (vault #146 look)
function scramble(l, finalStr, t0, cps) {
  cps = cps || 22;
  var f = finalStr.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  srcText(l).expression =
    'var f="' + f + '";var t0=' + t0 + ';var n=Math.floor((time-t0)*' + cps + ');' +
    'var ch="0123456789#%$@&ABCDEFGHJKLMNPQRSTUVWXYZ";var s="";' +
    'if(time<t0){s="";}else{for(var i=0;i<f.length;i++){var c=f.charAt(i);' +
    'if(c==" "||c=="\\r"){s+=c;continue;}' +
    'if(i<n-3){s+=c;}else if(i<n){seedRandom(i*13+Math.floor(time*30),true);' +
    's+=ch.charAt(Math.floor(random(ch.length)));}else{s+="";}}}s;';
}

// typewriter with blinking cursor
function typewriter(l, finalStr, t0, cps, cursor) {
  var f = finalStr.replace(/"/g, '\\"');
  srcText(l).expression =
    'var f="' + f + '";var n=Math.max(0,Math.floor((time-' + t0 + ')*' + cps + '));' +
    'var s=f.substring(0,Math.min(n,f.length));' +
    (cursor ? 's+=((Math.floor(time*3)%2==0)||n<f.length)?"_":" ";' : '') + 's;';
}

// shape layer with one group; returns {layer, group, contents}
function S(comp, name) {
  var l = comp.layers.addShape();
  l.name = name || "Shape";
  var g = l.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
  return { layer: l, group: g, c: g.property("ADBE Vectors Group") };
}
function addGroup(shp) {
  var g = shp.layer.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group");
  return { layer: shp.layer, group: g, c: g.property("ADBE Vectors Group") };
}
function rect(g, size, pos, round) {
  var r = g.c.addProperty("ADBE Vector Shape - Rect");
  r.property("ADBE Vector Rect Size").setValue(size);
  if (pos) r.property("ADBE Vector Rect Position").setValue(pos);
  if (round) r.property("ADBE Vector Rect Roundness").setValue(round);
  return r;
}
function ellipse(g, size, pos) {
  var e = g.c.addProperty("ADBE Vector Shape - Ellipse");
  e.property("ADBE Vector Ellipse Size").setValue(size);
  if (pos) e.property("ADBE Vector Ellipse Position").setValue(pos);
  return e;
}
function path(g, verts, closed) {
  var p = g.c.addProperty("ADBE Vector Shape - Group");
  var sh = new Shape(); sh.vertices = verts; sh.closed = !!closed;
  p.property("ADBE Vector Shape").setValue(sh);
  return p;
}
function fill(g, color, op) {
  var f = g.c.addProperty("ADBE Vector Graphic - Fill");
  f.property("ADBE Vector Fill Color").setValue(color);
  if (op !== undefined) f.property("ADBE Vector Fill Opacity").setValue(op);
  return f;
}
function stroke(g, color, w, round) {
  var s = g.c.addProperty("ADBE Vector Graphic - Stroke");
  s.property("ADBE Vector Stroke Color").setValue(color);
  s.property("ADBE Vector Stroke Width").setValue(w);
  if (round) { try { s.property("ADBE Vector Stroke Line Cap").setValue(2); s.property("ADBE Vector Stroke Line Join").setValue(2); } catch (e) {} }
  return s;
}
function trim(g, t0, t1, ease) {
  var t = g.c.addProperty("ADBE Vector Filter - Trim");
  K(t.property("ADBE Vector Trim End"), [[t0, 0], [t1, 100]], { ease: ease || 75 });
  return t;
}
function fx(layer, matchName) { return layer.property("ADBE Effect Parade").addProperty(matchName); }
function fxp(effect, name) { // find param by display name
  for (var i = 1; i <= effect.numProperties; i++) if (effect.property(i).name === name) return effect.property(i);
  throw new Error("no param " + name + " on " + effect.name);
}
function shadow(layer, op, dist, soft) {
  var d = fx(layer, "ADBE Drop Shadow");
  fxp(d, "Opacity").setValue(op === undefined ? 60 : op);
  fxp(d, "Distance").setValue(dist === undefined ? 4 : dist);
  fxp(d, "Softness").setValue(soft === undefined ? 18 : soft);
  return d;
}
function glow(layer, radius, intensity, threshold) {
  var g = fx(layer, "ADBE Glo2");
  fxp(g, "Glow Radius").setValue(radius || 30);
  fxp(g, "Glow Intensity").setValue(intensity || 1.2);
  fxp(g, "Glow Threshold").setValue(threshold === undefined ? 40 : threshold);
  return g;
}
// pop-in: scale overshoot + opacity, then out
function popIn(l, t, dur, from) {
  from = from || 70;
  var s = tr(l, "scale");
  s.setValueAtTime(t, [from, from]);
  s.setValueAtTime(t + dur * 0.65, [106, 106]);
  s.setValueAtTime(t + dur, [100, 100]);
  easeKeys(s, 70);
  K(tr(l, "op"), [[t, 0], [t + dur * 0.4, 100]], { ease: 50 });
}
function fadeOut(l, t, dur, dy) {
  var o = tr(l, "op");
  o.setValueAtTime(t, 100); o.setValueAtTime(t + dur, 0); easeKeys(o, 60);
}

// ============================================================================
var foot = proj.importFile(new ImportOptions(File(SRC)));
foot.name = "talking_head.mp4";
var comp = proj.items.addComp("Recovery_Edit", W, H, 1, DUR, FPS);
comp.motionBlur = true;
try { comp.shutterAngle = 270; comp.shutterPhase = -135; } catch (e) {}

// ============================================================================
// PRECOMP: "HERE'S THE REALITY" mono title card (vault #146)
// ============================================================================
function makeTerminalCard(name, line1, line2, dur, typeAt) {
  var c = proj.items.addComp(name, W, H, 1, dur, FPS);
  var bg = c.layers.addSolid(NAVY, "BG", W, H, 1);
  var r = fx(bg, "ADBE Ramp");
  r.property(1).setValue([960, 380]); r.property(2).setValue([0.06, 0.13, 0.33]);
  r.property(3).setValue([960, 1500]); r.property(4).setValue([0.0, 0.0, 0.02]);
  r.property(5).setValue(2); // radial
  var dust = c.layers.addSolid(BLACK, "Dust", W, H, 1);
  dust.blendingMode = BlendingMode.ADD;
  var pw = fx(dust, "CC Particle World");
  pw.property(1).setValue(2.5); pw.property(2).setValue(4);
  var pr = pw.property(3); pr.property(4).setValue(1.3); pr.property(5).setValue(0.8); pr.property(6).setValue(0.6);
  var ph = pw.property(4); ph.property(1).setValue(2); ph.property(2).setValue(0.04); ph.property(4).setValue(0);
  var pa = pw.property(5); pa.property(1).setValue(3); pa.property(2).setValue(0.012);
  pa.property(3).setValue(0.006); pa.property(4).setValue(100); pa.property(5).setValue(55);
  pa.property(6).setValue([1, 1, 1]); pa.property(7).setValue([0.6, 0.7, 1]);

  var t1 = T(c, "", { font: "SpaceMono-Bold", size: 64, tracking: 120, pos: [960, 520], name: "L1" });
  typewriter(t1, line1, typeAt, 18, false);
  var t2 = T(c, "", { font: "SpaceMono-Bold", size: 64, tracking: 120, pos: [960, 610], name: "L2" });
  typewriter(t2, line2, typeAt + line1.length / 18 + 0.05, 18, true);
  var layers = [t1, t2];
  for (var i = 0; i < layers.length; i++) {
    glow(layers[i], 18, 0.8, 50);
    // CRT flicker
    tr(layers[i], "op").expression = 'seedRandom(Math.floor(time*24),true); random()<0.07 ? 45 : 92 + random(8);';
  }
  // slow push-in on the whole card text
  var nul = c.layers.addNull(); nul.name = "Push";
  t1.parent = nul; t2.parent = nul;
  K(tr(nul, "scale"), [[0, [100, 100]], [dur, [106, 106]]], { linear: true });
  var vig = c.layers.addAdjustmentLayer ? null : null;
  return c;
}

// ============================================================================
// PRECOMP: circuit node graph (vault #893)
// ============================================================================
function makeGraph(dur, tOn) {
  // tOn: comp-time offset → times inside are relative to precomp start
  var c = proj.items.addComp("Recovery_Graph", W, H, 1, dur, FPS);
  var bg = c.layers.addSolid([0.03, 0.03, 0.04], "BG", W, H, 1);
  var r = fx(bg, "ADBE Ramp");
  r.property(1).setValue([960, 540]); r.property(2).setValue([0.09, 0.09, 0.11]);
  r.property(3).setValue([960, 1400]); r.property(4).setValue([0.0, 0.0, 0.0]); r.property(5).setValue(2);
  // topographic texture: fractal noise contour lines, very subtle
  var topo = c.layers.addSolid(BLACK, "Topo", W, H, 1);
  var fn = fx(topo, "ADBE Fractal Noise");
  fxp(fn, "Fractal Type").setValue(1);
  fxp(fn, "Contrast").setValue(160);
  fxp(fn, "Complexity").setValue(2);
  fxp(fn, "Evolution").expression = "time*25";
  topo.blendingMode = BlendingMode.ADD;
  tr(topo, "op").setValue(7);
  var grid = c.layers.addSolid(BLACK, "Grid", W, H, 1);
  var gfx = fx(grid, "ADBE Grid");
  fxp(gfx, "Width").setValue(80); fxp(gfx, "Height").setValue(80); fxp(gfx, "Border").setValue(1);
  fxp(gfx, "Color").setValue([1, 1, 1]);
  grid.blendingMode = BlendingMode.ADD; tr(grid, "op").setValue(6);

  var C = [960, 540];
  // node definitions: pos, label, light-up time (relative to precomp)
  var nodes = [
    { p: [420, 250], label: "TRAIN HARDER", t: 32.38 - tOn, via: [420, 540] },
    { p: [1500, 250], label: "MORE OFTEN", t: 33.38 - tOn, via: [1500, 540] },
    { p: [960, 880], label: "ADAPT", t: 34.60 - tOn, via: null },
    { p: [420, 830], label: "", t: 35.0 - tOn, via: [420, 540] },
    { p: [1500, 830], label: "", t: 35.2 - tOn, via: [1500, 540] },
    { p: [960, 170], label: "", t: 35.4 - tOn, via: null }
  ];
  var drawT = 0.35; // lines draw on at start
  for (var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var verts = n.via ? [C, n.via, n.p] : [C, n.p];
    // base (white, dim) line
    var base = S(c, "Wire " + i);
    path(base, verts, false); stroke(base, WHITE, 5, true); trim(base, drawT + i * 0.06, drawT + 0.55 + i * 0.06, 80);
    tr(base.layer, "op").setValue(55);
    tr(base.layer, "anchor").setValue([0, 0]); tr(base.layer, "pos").setValue([0, 0]);
    // green energised line
    var hot = S(c, "Wire hot " + i);
    path(hot, verts, false); stroke(hot, GREEN, 7, true); trim(hot, n.t - 0.45, n.t, 85);
    tr(hot.layer, "anchor").setValue([0, 0]); tr(hot.layer, "pos").setValue([0, 0]);
    glow(hot.layer, 25, 1.4, 30);
    // node
    var nd = S(c, "Node " + i);
    ellipse(nd, [64, 64], [0, 0]);
    var nf = fill(nd, WHITE);
    K(nf.property("ADBE Vector Fill Color"), [[n.t - 0.01, WHITE], [n.t + 0.08, GREEN]], { linear: true });
    tr(nd.layer, "pos").setValue(n.p);
    var appear = drawT + 0.45 + i * 0.06;
    var s = tr(nd.layer, "scale");
    s.setValueAtTime(appear, [0, 0]); s.setValueAtTime(appear + 0.25, [115, 115]); s.setValueAtTime(appear + 0.4, [100, 100]);
    s.setValueAtTime(n.t, [100, 100]); s.setValueAtTime(n.t + 0.12, [135, 135]); s.setValueAtTime(n.t + 0.35, [100, 100]);
    easeKeys(s, 70);
    var g = glow(nd.layer, 35, 0, 30);
    K(fxp(g, "Glow Intensity"), [[n.t - 0.01, 0.3], [n.t + 0.1, 2.0], [n.t + 0.6, 1.2]], { ease: 50 });
    // ripple ring on light-up
    var ring = S(c, "Ring " + i);
    ellipse(ring, [64, 64], [0, 0]); stroke(ring, GREEN, 4);
    tr(ring.layer, "pos").setValue(n.p);
    tr(ring.layer, "scale").expression = 'var t=Math.max(0,Math.min(1,(time-' + n.t + ')/0.7));var s=100+220*(1-Math.pow(1-t,3));[s,s];';
    tr(ring.layer, "op").expression = 'var t=(time-' + n.t + ')/0.7;(t<0||t>1)?0:100*(1-t);';
    if (n.label) {
      var lt = T(c, n.label, { font: "SpaceMono-Bold", size: 36, tracking: 80,
                               pos: [n.p[0], n.p[1] + (n.p[1] < 540 ? -60 : 78)], name: "Label " + i });
      reveal(lt, n.t - 0.15, n.t + 0.35, { op: 0, blur: [12, 12] }, 1, 100);
      K(lt.property("ADBE Text Properties").property("ADBE Text Animators").addProperty("ADBE Text Animator")
          .property("ADBE Text Animator Properties").addProperty("ADBE Text Fill Color"),
        [[n.t, WHITE]], { hold: true });
    }
  }
  // centre hub
  var hubR = S(c, "Hub ring");
  ellipse(hubR, [250, 250], [0, 0]); stroke(hubR, RED, 4);
  tr(hubR.layer, "pos").setValue(C);
  tr(hubR.layer, "rot").expression = "time*40";
  var dash = hubR.group.property("ADBE Vectors Group");
  var hub = S(c, "Hub");
  ellipse(hub, [200, 200], [0, 0]);
  var hf = fill(hub, RED);
  var tGreen = 30.64 - tOn;
  K(hf.property("ADBE Vector Fill Color"), [[tGreen, RED], [tGreen + 0.3, [0.1, 0.75, 0.35]]], { linear: true });
  K(hubR.group.property("ADBE Vectors Group").property(2).property("ADBE Vector Stroke Color"),
    [[tGreen, RED], [tGreen + 0.3, GREEN]], { linear: true });
  tr(hub.layer, "pos").setValue(C);
  var hs = tr(hub.layer, "scale");
  hs.setValueAtTime(0.05, [0, 0]); hs.setValueAtTime(0.35, [112, 112]); hs.setValueAtTime(0.5, [100, 100]);
  hs.setValueAtTime(tGreen, [100, 100]); hs.setValueAtTime(tGreen + 0.15, [118, 118]); hs.setValueAtTime(tGreen + 0.45, [100, 100]);
  easeKeys(hs, 70);
  glow(hub.layer, 60, 1.6, 20);
  K(tr(hubR.layer, "scale"), [[0.1, [0, 0]], [0.5, [100, 100]]], { ease: 80 });
  var hubT = T(c, "RECOVERY", { font: "SpaceMono-Bold", size: 34, tracking: 40, pos: [960, 552], name: "Hub label" });
  K(tr(hubT, "op"), [[0.3, 0], [0.5, 100]], { ease: 50 });
  // heartbeat pulse
  tr(hubT, "scale").expression = 'var s=100+4*Math.max(0,Math.sin(time*7));[s,s];';
  // header
  var hdr = T(c, "WHAT RECOVERY UNLOCKS", { font: "SpaceMono-Bold", size: 30, tracking: 300, pos: [960, 1010], color: [0.7, 0.7, 0.75] });
  scramble(hdr, "WHAT RECOVERY UNLOCKS", 0.4, 30);
  // vignette
  var vig = c.layers.addAdjustmentLayer ? null : null;
  return c;
}

// ============================================================================
// PRECOMP: glitch chapter card (vault #924)
// ============================================================================
function makeChapter(dur, tSign, tTitle) {
  var c = proj.items.addComp("Chapter_Sign1", W, H, 1, dur, FPS);
  var bg = c.layers.addSolid([0.1, 0.1, 0.11], "BG", W, H, 1);
  var r = fx(bg, "ADBE Ramp");
  r.property(1).setValue([960, 540]); r.property(2).setValue([0.2, 0.2, 0.21]);
  r.property(3).setValue([960, 1500]); r.property(4).setValue([0.02, 0.02, 0.02]); r.property(5).setValue(2);
  var tex = c.layers.addSolid(BLACK, "Texture", W, H, 1);
  var fn = fx(tex, "ADBE Fractal Noise");
  fxp(fn, "Contrast").setValue(120);
  fxp(fn, "Evolution").expression = "time*60";
  tex.blendingMode = BlendingMode.OVERLAY; tr(tex, "op").setValue(35);
  // slow drift / perspective feel
  K(tr(tex, "scale"), [[0, [120, 120]], [dur, [132, 132]]], { linear: true });

  // glitch blocks (random white/gray bars that flicker, then resolve)
  var blocks = S(c, "Glitch blocks");
  var seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  for (var i = 0; i < 26; i++) {
    var g = addGroup(blocks);
    rect(g, [40 + rnd() * 160, 10 + rnd() * 22], [(rnd() - 0.5) * 900, (rnd() - 0.5) * 320]);
    fill(g, rnd() > 0.3 ? WHITE : [0.6, 0.6, 0.6]);
    g.group.property("ADBE Vector Transform Group").property("ADBE Vector Group Opacity").expression =
      'seedRandom(' + i + '+Math.floor(time*20)*31,true); random()<0.55?100:0;';
  }
  tr(blocks.layer, "pos").setValue([960, 560]);
  // blocks visible 0 → 0.55, flicker off
  K(tr(blocks.layer, "op"), [[0, 100], [0.45, 100], [0.6, 0]], { linear: true });
  tr(blocks.layer, "pos").expression = 'seedRandom(Math.floor(time*20),true); value+[random(-30,30),random(-8,8)];';

  // SIGN #1 yellow tag
  var tagW = 230, tagH = 58;
  var tag = S(c, "Tag");
  rect(tag, [tagW, tagH], [0, 0], 6); fill(tag, YELLOW);
  tr(tag.layer, "pos").setValue([960, 470]);
  K(tr(tag.layer, "scale"), [[tSign, [0, 100]], [tSign + 0.25, [100, 100]]], { ease: 85 });
  var tagT = T(c, "SIGN #1", { font: "SpaceMono-Bold", size: 40, color: INK, tracking: 60, pos: [960, 484] });
  scramble(tagT, "SIGN #1", tSign + 0.1, 24);
  // title
  var title = T(c, "PERSISTENT SORENESS", { font: "Montserrat-ExtraBold", size: 96, tracking: 20, pos: [960, 600] });
  scramble(title, "PERSISTENT SORENESS", tTitle - 0.25, 34);
  K(tr(title, "op"), [[tTitle - 0.3, 0], [tTitle - 0.2, 100]], { linear: true });
  shadow(title, 50, 6, 30);
  var under = S(c, "Underline");
  path(under, [[-440, 0], [440, 0]], false); stroke(under, YELLOW, 6, true); trim(under, tTitle + 0.2, tTitle + 0.8, 85);
  tr(under.layer, "pos").setValue([960, 650]);
  // RGB-split style chromatic offset jitter on title during decode
  var chroma = fx(title, "ADBE Offset");
  fxp(chroma, "Shift Center To").expression =
    'var t=time-' + (tTitle - 0.25) + ';(t>0&&t<0.6)?(seedRandom(Math.floor(time*24),true),[960+random(-40,40),540]):[960,540];';
  // exit: motion-blurred streak to the left (like #924 last frame)
  var exitT = dur - 0.35;
  var nul = c.layers.addNull(); nul.name = "Exit";
  tag.layer.parent = nul; tagT.parent = nul; title.parent = nul; under.layer.parent = nul;
  K(tr(nul, "pos"), [[exitT, [960, 540]], [dur, [-900, 540]]], { ease: 90 });
  tag.layer.motionBlur = true; tagT.motionBlur = true; title.motionBlur = true; under.layer.motionBlur = true;
  return c;
}

// ============================================================================
// MAIN COMP
// ============================================================================

// ---- Footage A (source 0 – 47.6)
var vA = comp.layers.add(foot);
vA.name = "Footage A";
vA.startTime = 0; span(vA, 0, 47.6);
vA.motionBlur = true;
var sA = tr(vA, "scale"), pA = tr(vA, "pos");
// camera language: slow push, snap punch-ins on emphasis, reframes for graphics
var camKeys = [
  // t, scale, pos
  [0.00, 153, [960, 540]],
  [3.15, 160, [960, 560]],   // slow push during hook
  [3.20, 168, [960, 600]],   // snap: "one factor"
  [6.55, 172, [960, 600]],
  [6.60, 157, [960, 560]],   // snap back: "not your workout"
  [8.25, 159, [960, 560]],
  [8.30, 180, [960, 640]],   // snap: "RECOVERY"
  [11.45, 182, [960, 640]],
  [11.50, 192, [1160, 600]], // reframe right for checklist
  [20.45, 195, [1160, 600]],
  [20.50, 200, [960, 700]],  // punch: "cannot grow"
  [22.60, 206, [960, 700]],
  [22.65, 153, [960, 540]],  // reset
  [29.00, 156, [960, 540]],
  [36.20, 160, [960, 560]],
  [41.25, 166, [960, 560]],
  [45.10, 170, [960, 620]],  // "most guys get it wrong"
  [47.60, 178, [960, 640]]
];
for (var i = 0; i < camKeys.length; i++) {
  sA.setValueAtTime(camKeys[i][0], [camKeys[i][1], camKeys[i][1]]);
  pA.setValueAtTime(camKeys[i][0], camKeys[i][2]);
}
// whip-pan out to graph (29.0 → 29.25) and back in (36.0 → 36.2)
pA.setValueAtTime(29.0, [960, 540]); pA.setValueAtTime(29.25, [-1100, 540]);
pA.setValueAtTime(35.98, [3020, 560]); pA.setValueAtTime(36.2, [960, 560]);
for (var k = 1; k <= pA.numKeys; k++) pA.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
for (var k = 1; k <= sA.numKeys; k++) sA.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
// hide footage while the graph fills the frame (avoids the linear sweep showing under it)
K(tr(vA, "op"), [[0, 100], [29.3, 0], [35.95, 100]], { hold: true });
// subtle handheld drift so stills never feel dead
tr(vA, "rot").expression = 'wiggle(0.4,0.35)';
// B&W for "cannot grow" (vault #882)
var tint = fx(vA, "ADBE Tint");
K(fxp(tint, "Amount to Tint"), [[0, 0], [20.49, 0], [20.5, 100], [22.6, 100], [22.62, 0]], { hold: true });
// background blur + darken for comparison scene (vault #754)
var gb = fx(vA, "ADBE Gaussian Blur 2");
K(fxp(gb, "Blurriness"), [[41.25, 0], [41.7, 38], [44.75, 38], [45.15, 0]], { ease: 70 });
fxp(gb, "Repeat Edge Pixels").setValue(1);
var bc = fx(vA, "ADBE Brightness & Contrast 2");
K(fxp(bc, "Brightness"), [[41.25, 0], [41.7, -45], [44.75, -45], [45.15, 0]], { ease: 70 });
// camera shake for "cannot grow" + "get it wrong"
tr(vA, "anchor").expression =
  'var a=value; var s=0; if(time>20.5&&time<21.2) s=(21.2-time)/0.7*18; if(time>21.9&&time<22.4) s=(22.4-time)/0.5*22;' +
  'if(time>46.46&&time<46.9) s=(46.9-time)/0.44*14; seedRandom(Math.floor(time*30),true); a+[random(-s,s),random(-s,s)];';

// ---- Footage B (source 80.3 – 88.5)
var vB = comp.layers.add(foot);
vB.name = "Footage B";
vB.startTime = -SEG2_OFFSET; span(vB, 47.6, DUR);
K(tr(vB, "scale"), [[50.9, [175, 175]], [51.05, [158, 158]], [DUR, [166, 166]]], { ease: 60 });
tr(vB, "rot").expression = 'wiggle(0.4,0.35)';

// ============================================================================
// S1 — "MEN OVER 40" terminal box (vault #146)            0.40 – 3.10
// ============================================================================
(function () {
  var t0 = 0.45, tOut = 3.0;
  var boxW = 600, boxH = 150, cx = 470, cy = 560;
  var bx = S(comp, "S1 box");
  rect(bx, [boxW, boxH], [0, 0], 4);
  fill(bx, BLACK, 35);
  var bst = addGroup(bx); rect(bst, [boxW, boxH], [0, 0], 4); stroke(bst, WHITE, 3); trim(bst, t0, t0 + 0.55, 85);
  tr(bx.layer, "pos").setValue([cx, cy]);
  K(bx.group.property("ADBE Vectors Group").property(2).property("ADBE Vector Fill Opacity"), [[t0 + 0.2, 0], [t0 + 0.6, 35]], { ease: 50 });
  var a = T(comp, "", { font: "SpaceMono-Bold", size: 66, tracking: 40, just: "L", pos: [cx - boxW / 2 + 34, cy - 4], name: "S1 title" });
  scramble(a, "MEN OVER 40", t0 + 0.35, 20);
  var b = T(comp, "", { font: "SpaceMono-Bold", size: 28, tracking: 120, just: "L", pos: [cx - boxW / 2 + 36, cy + 44], name: "S1 sub" });
  typewriter(b, "TRYING TO BUILD MUSCLE", 1.6, 26, false);
  var grp = [bx.layer, a, b];
  for (var i = 0; i < grp.length; i++) {
    span(grp[i], t0, tOut + 0.3);
    shadow(grp[i], 45, 3, 14);
    var o = tr(grp[i], "op"); o.setValueAtTime(tOut, 100); o.setValueAtTime(tOut + 0.25, 0);
    K(tr(grp[i], "pos"), [[tOut, tr(grp[i], "pos").value], [tOut + 0.3, vadd(tr(grp[i], "pos").value, [-60, 0])]], { ease: 80 });
  }
})();

// ============================================================================
// S2/S3 — "One factor" → "Not your workout" → "your RECOVERY" + bar (vault #196)
// ============================================================================
(function () {
  var x0 = 150, y0 = 860;
  // "One" (regular) + "factor" (extra bold) — blur word reveal
  var one = T(comp, "One", { font: "Montserrat-Medium", size: 120, just: "L", pos: [x0, y0], name: "S2 One" });
  var factor = T(comp, "factor", { font: "Montserrat-ExtraBold", size: 120, just: "L", pos: [x0 + 270, y0], name: "S2 factor" });
  reveal(one, 3.35, 3.65, { op: 0, blur: [40, 0], pos: [0, 20] }, 1, 100);
  reveal(factor, 3.62, 4.05, { op: 0, blur: [60, 0], pos: [30, 0] }, 1, 100);
  // "make or break" micro-label
  var mob = T(comp, "", { font: "SpaceMono-Bold", size: 28, tracking: 220, just: "L", pos: [x0 + 6, y0 + 58], color: [0.85, 0.9, 1], name: "S2 sub" });
  typewriter(mob, "MAKES OR BREAKS YOUR RESULTS", 4.5, 30, false);
  var s2 = [one, factor, mob];
  for (var i = 0; i < s2.length; i++) {
    span(s2[i], 3.3, 6.75); shadow(s2[i], 55, 3, 20);
    var o = tr(s2[i], "op"); o.setValueAtTime(6.45, 100); o.setValueAtTime(6.65, 0);
  }
  // "Not your workout" with red strike-through
  var ny = T(comp, "Not your workout", { font: "Montserrat-SemiBold", size: 92, just: "L", pos: [x0, y0 - 10], name: "S3 notworkout" });
  reveal(ny, 6.6, 7.2, { op: 0, blur: [30, 0], pos: [0, 24] }, 3, 100);
  span(ny, 6.6, 9.85); shadow(ny, 55, 3, 20);
  var strike = S(comp, "S3 strike");
  path(strike, [[0, 0], [820, 0]], false); stroke(strike, RED, 10, true); trim(strike, 7.35, 7.75, 85);
  tr(strike.layer, "anchor").setValue([0, 0]); tr(strike.layer, "pos").setValue([x0 - 10, y0 - 40]);
  span(strike.layer, 6.6, 9.85);
  // the whole "not your workout" line slides up & dims when "recovery" lands
  var up = [ny, strike.layer];
  for (var j = 0; j < up.length; j++) {
    var p = tr(up[j], "pos"); var v = p.value;
    K(p, [[8.15, v], [8.45, vadd(v, [0, -120])]], { ease: 85 });
    K(tr(up[j], "op"), [[8.15, 100], [8.45, 45]], { ease: 50 });
    tr(up[j], "op").setValueAtTime(9.65, 45); tr(up[j], "op").setValueAtTime(9.85, 0);
  }
  var yr = T(comp, "It's your", { font: "Montserrat-Medium", size: 110, just: "L", pos: [x0, y0], name: "S3 itsyour" });
  var rec = T(comp, "recovery", { font: "Montserrat-ExtraBold", size: 110, just: "L", pos: [x0 + 520, y0], name: "S3 recovery" });
  reveal(yr, 8.05, 8.35, { op: 0, blur: [40, 0], pos: [0, 30] }, 3, 100);
  reveal(rec, 8.35, 8.8, { op: 0, blur: [70, 0], pos: [40, 0] }, 1, 100);
  span(yr, 8.0, 9.85); span(rec, 8.0, 9.85); shadow(yr, 55, 3, 20); shadow(rec, 55, 3, 20);
  // Workout / Recovery bar (white → green fill, like Revenue/Profit)
  var barW = 1000, barH = 22, by = y0 + 52;
  var bar = S(comp, "S3 bar");
  rect(bar, [barW, barH], [barW / 2, 0], 3); fill(bar, WHITE);
  tr(bar.layer, "anchor").setValue([0, 0]); tr(bar.layer, "pos").setValue([x0 + 4, by]);
  K(tr(bar.layer, "scale"), [[8.5, [0, 100]], [8.95, [100, 100]]], { ease: 85 });
  var gbar = S(comp, "S3 bar green");
  rect(gbar, [barW * 0.72, barH], [barW * 0.72 / 2, 0], 3); fill(gbar, GREEN);
  tr(gbar.layer, "anchor").setValue([barW * 0.72, 0]); tr(gbar.layer, "pos").setValue([x0 + 4 + barW, by]);
  K(tr(gbar.layer, "scale"), [[8.9, [0, 100]], [9.35, [100, 100]]], { ease: 85 });
  var lw = T(comp, "Workout", { font: "Montserrat-Bold", size: 17, just: "L", color: INK, pos: [x0 + 14, by + 6] });
  var lr = T(comp, "Recovery", { font: "Montserrat-Bold", size: 17, just: "R", color: INK, pos: [x0 + barW - 8, by + 6] });
  K(tr(lw, "op"), [[8.8, 0], [8.95, 100]], { linear: true });
  K(tr(lr, "op"), [[9.25, 0], [9.4, 100]], { linear: true });
  var bl = [bar.layer, gbar.layer, lw, lr];
  for (var b = 0; b < bl.length; b++) span(bl[b], 8.4, 9.85);
  shadow(bar.layer, 40, 2, 12);
  // little flying accent (the 💸 in #196 → a glowing spark sweeping the bar)
  var spark = S(comp, "S3 spark"); ellipse(spark, [16, 16], [0, 0]); fill(spark, GREEN);
  glow(spark.layer, 30, 2.5, 10);
  K(tr(spark.layer, "pos"), [[8.9, [x0 + barW, by]], [9.35, [x0 + barW * 0.28, by]]], { ease: 85 });
  span(spark.layer, 8.9, 9.5);
})();

// ============================================================================
// S4 — "HERE'S THE REALITY" mono card (vault #146)        9.88 – 11.45
// ============================================================================
(function () {
  var dur = 11.48 - 9.88;
  var card = makeTerminalCard("Card_Reality", "HERE'S", "THE REALITY", dur, 0.05);
  var l = comp.layers.add(card);
  l.startTime = 9.88; span(l, 9.88, 11.48);
  // white flash frames on in/out
  var fl = comp.layers.addSolid(WHITE, "Flash in", W, H, 1);
  span(fl, 9.86, 10.02); K(tr(fl, "op"), [[9.86, 80], [10.02, 0]], { linear: true });
})();

// ============================================================================
// S5 — "everything right in the gym" checklist cards (vault #879/#880)
// ============================================================================
(function () {
  var x = 130, tEnd = 20.42;
  var hdr = T(comp, "EVERYTHING RIGHT", { font: "SpaceMono-Bold", size: 34, tracking: 200, just: "L", pos: [x + 4, 300], name: "S5 hdr" });
  scramble(hdr, "EVERYTHING RIGHT", 11.95, 26);
  shadow(hdr, 50, 3, 14);
  var hl = S(comp, "S5 hdr line"); path(hl, [[0, 0], [520, 0]], false); stroke(hl, WHITE, 3); trim(hl, 12.2, 12.8, 80);
  tr(hl.layer, "anchor").setValue([0, 0]); tr(hl.layer, "pos").setValue([x + 4, 322]);
  var items = [
    { t: 13.96, label: "Training hard", y: 410, ok: true },
    { t: 15.04, label: "Close to failure", y: 535, ok: true },
    { t: 16.88, label: "Enough volume", y: 660, ok: true },
    { t: 18.55, label: "Recovering", y: 815, ok: false }
  ];
  var all = [hdr, hl.layer];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var cw = 520, ch = 100;
    // shape groups: first in the list draws on top (AE order) → mark, badge, card bg
    var card = S(comp, "S5 card " + i);
    var mark = card;
    if (it.ok) path(mark, [[42, 2], [53, 13], [72, -10]], false);
    else { path(mark, [[46, -10], [66, 10]], false); path(mark, [[66, -10], [46, 10]], false); }
    stroke(mark, WHITE, 7, true); trim(mark, it.t + 0.18, it.t + 0.45, 80);
    var badge = addGroup(card); ellipse(badge, [60, 60], [56, 0]); fill(badge, it.ok ? [0.12, 0.78, 0.4] : RED);
    var bgG = addGroup(card); rect(bgG, [cw, ch], [cw / 2, 0], 24); fill(bgG, it.ok ? WHITE : [1, 0.93, 0.93]);
    tr(card.layer, "anchor").setValue([0, 0]); tr(card.layer, "pos").setValue([x, it.y]);
    var lbl = T(comp, it.label, { font: "Montserrat-Bold", size: 44, just: "L", color: it.ok ? INK : [0.75, 0.05, 0.1], pos: [x + 108, it.y + 15] });
    lbl.parent = card.layer;
    // pop + slide
    var p = tr(card.layer, "pos");
    K(p, [[it.t, [x - 80, it.y]], [it.t + 0.35, [x, it.y]]], { ease: 85 });
    popIn(card.layer, it.t, 0.35, 80);
    shadow(card.layer, 45, 8, 30);
    if (!it.ok) {
      // red alert: shake + glow pulse
      p.expression = 'var s=(time>' + (it.t + 0.35) + '&&time<' + (it.t + 0.9) + ')?(' + (it.t + 0.9) + '-time)*30:0; value+[Math.sin(time*70)*s,0];';
      var rg = glow(card.layer, 40, 0, 60);
      fxp(rg, "Glow Intensity").expression = '0.6+0.4*Math.sin(time*8)';
    } else {
      // green tick on the existing cards turns grey when "recovering" fails
      K(tr(card.layer, "op"), [[18.55, 100], [18.8, 55]], { ease: 50 });
    }
    all.push(card.layer); all.push(lbl);
    span(card.layer, it.t, tEnd + 0.4);
    span(lbl, it.t, tEnd + 0.4);
  }
  // exit: staggered slide-out left
  for (var j = 0; j < all.length; j++) {
    var L = all[j];
    if (L.parent) continue;
    if (L.inPoint < 11.9) L.inPoint = 11.9;
    L.outPoint = tEnd + 0.4;
    var d = j * 0.02;
    var o = tr(L, "op");
    if (o.numKeys === 0) o.setValueAtTime(tEnd - 0.01 + d, 100);
    o.setValueAtTime(tEnd + 0.18 + d, 0);
  }
  span(hdr, 11.9, tEnd + 0.4); span(hl.layer, 12.1, tEnd + 0.4);
})();

// ============================================================================
// S6 — "your body CANNOT GROW." B&W + pixel caption (vault #882)   20.5 – 22.6
// ============================================================================
(function () {
  var cap = T(comp, "", { font: "VT323", size: 150, color: YELLOW, pos: [960, 930], name: "S6 caption" });
  srcText(cap).expression =
    'time<20.9?"your body":(time<21.9?"cannot":"GROW.");';
  span(cap, 20.52, 22.6);
  shadow(cap, 85, 6, 6);
  var s = tr(cap, "scale");
  // pop on each word change
  var ws = [20.52, 20.9, 21.9];
  for (var i = 0; i < ws.length; i++) { s.setValueAtTime(ws[i], [125, 125]); s.setValueAtTime(ws[i] + 0.12, [100, 100]); }
  easeKeys(s, 70);
  // red tint on GROW.
  var fl = fx(cap, "ADBE Fill");
  fxp(fl, "Color").expression = 'time<21.9?[1,0.9,0,1]:[1,0.25,0.25,1];';
})();

// ============================================================================
// S7 — "STEROIDS / biggest advantage" terminal lower box (vault #146)  23.6 – 28.9
// ============================================================================
(function () {
  var t0 = 23.65, tOut = 28.75;
  var cx = 1440, cy = 300, bw = 640, bh = 170;
  var bx = S(comp, "S7 box");
  rect(bx, [bw, bh], [0, 0], 4); fill(bx, BLACK, 40);
  var st = addGroup(bx); rect(st, [bw, bh], [0, 0], 4); stroke(st, WHITE, 3); trim(st, t0, t0 + 0.6, 85);
  tr(bx.layer, "pos").setValue([cx, cy]);
  var lab = T(comp, "", { font: "SpaceMono-Bold", size: 26, tracking: 200, just: "L", pos: [cx - bw / 2 + 34, cy - 40], color: [0.75, 0.82, 1] });
  typewriter(lab, "BIGGEST ADVANTAGE OF", t0 + 0.2, 30, false);
  var big = T(comp, "", { font: "SpaceMono-Bold", size: 72, tracking: 40, just: "L", pos: [cx - bw / 2 + 32, cy + 30] });
  scramble(big, "STEROIDS", 25.05, 16);
  var sub = T(comp, "", { font: "SpaceMono-Bold", size: 26, tracking: 140, just: "L", pos: [cx - bw / 2 + 34, cy + 68], color: GREEN });
  typewriter(sub, "> NOT JUST FASTER GAINS", 26.5, 24, true);
  var g = [bx.layer, lab, big, sub];
  for (var i = 0; i < g.length; i++) {
    span(g[i], t0, tOut + 0.3); shadow(g[i], 45, 3, 14);
    var o = tr(g[i], "op"); o.setValueAtTime(tOut, 100); o.setValueAtTime(tOut + 0.2, 0);
  }
  K(bx.group.property("ADBE Vectors Group").property(2).property("ADBE Vector Fill Opacity"), [[t0 + 0.2, 0], [t0 + 0.6, 40]], { ease: 50 });
})();

// ============================================================================
// S8 — whip pan into circuit graph (vault #44 + #893)         29.0 – 36.2
// ============================================================================
(function () {
  var tIn = 29.0, tOutStart = 35.98, tOut = 36.2;
  var g = makeGraph(tOut - tIn + 0.1, tIn);
  var l = comp.layers.add(g);
  l.startTime = tIn; span(l, tIn, tOut + 0.02);
  l.motionBlur = true;
  tr(l, "scale").setValue([102, 102]);
  var p = tr(l, "pos");
  p.setValueAtTime(tIn, [3020, 540]); p.setValueAtTime(tIn + 0.25, [960, 540]);
  p.setValueAtTime(tOutStart, [960, 540]); p.setValueAtTime(tOut, [-1100, 540]);
  for (var k = 1; k <= p.numKeys; k++) p.setInterpolationTypeAtKey(k, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR);
  // directional blur adjustment for the whip (extra smear beyond motion blur)
  var adj = comp.layers.addSolid(WHITE, "Whip blur", W, H, 1);
  adj.adjustmentLayer = true;
  span(adj, tIn - 0.05, tOut + 0.08);
  var db = fx(adj, "ADBE Motion Blur");
  fxp(db, "Direction").setValue(90);
  K(fxp(db, "Blur Length"), [[tIn - 0.04, 0], [tIn + 0.1, 220], [tIn + 0.3, 0], [tOutStart - 0.02, 0], [tOutStart + 0.1, 220], [tOut + 0.06, 0]], { linear: true });
})();

// ============================================================================
// S9 — "that's not the route we're taking" STEROIDS ✕ / 100% NATURAL   36.6 – 41.2
// ============================================================================
(function () {
  var x = 150, y = 330;
  var st = T(comp, "STEROIDS", { font: "Montserrat-ExtraBold", size: 84, just: "L", pos: [x, y], color: WHITE, name: "S9 steroids" });
  reveal(st, 36.55, 36.95, { op: 0, blur: [30, 0], pos: [0, 20] }, 1, 100);
  shadow(st, 55, 3, 20);
  var strike = S(comp, "S9 strike");
  path(strike, [[-10, 0], [470, 0]], false); stroke(strike, RED, 12, true); trim(strike, 37.3, 37.6, 85);
  tr(strike.layer, "anchor").setValue([0, 0]); tr(strike.layer, "pos").setValue([x, y - 28]);
  K(tr(st, "op"), [[37.5, 100], [37.8, 55]], { ease: 50 });
  // NATURAL pill
  var pill = S(comp, "S9 pill");
  rect(pill, [420, 84], [210, 0], 42); fill(pill, GREEN);
  tr(pill.layer, "anchor").setValue([0, 0]); tr(pill.layer, "pos").setValue([x, y + 80]);
  K(tr(pill.layer, "scale"), [[37.75, [0, 100]], [38.05, [100, 100]]], { ease: 85 });
  shadow(pill.layer, 45, 6, 24);
  var nt = T(comp, "100% NATURAL", { font: "Montserrat-ExtraBold", size: 42, just: "L", color: INK, pos: [x + 36, y + 95] });
  reveal(nt, 37.9, 38.2, { op: 0, pos: [0, 16] }, 1, 100);
  var g = [st, strike.layer, pill.layer, nt];
  for (var i = 0; i < g.length; i++) {
    span(g[i], 36.5, 41.25);
    var o = tr(g[i], "op"); if (o.numKeys === 0) o.setValueAtTime(40.9, 100); o.setValueAtTime(41.15, 0);
  }
  // "something important" — spark underline
  var imp = T(comp, "", { font: "SpaceMono-Bold", size: 30, tracking: 220, just: "L", pos: [x + 4, y + 200], color: [0.85, 0.9, 1] });
  typewriter(imp, "BUT IT PROVES ONE THING...", 38.9, 26, true);
  span(imp, 38.9, 41.25); shadow(imp, 50, 3, 14);
  var io = tr(imp, "op"); io.setValueAtTime(40.9, 100); io.setValueAtTime(41.15, 0);
})();

// ============================================================================
// S10 — RECOVERY ↑  =  MUSCLE ↑ comparison on blurred bg (vault #754)  41.4 – 45.0
// ============================================================================
(function () {
  var tA = 41.45, tSym = 42.75, tB = 43.1, tOut = 44.7;
  function stack(l1, l2, x, t) {
    var a = T(comp, l1, { font: "Montserrat-ExtraBold", size: 74, pos: [x, 520] });
    var b = T(comp, l2, { font: "Montserrat-ExtraBold", size: 74, pos: [x, 600] });
    reveal(a, t, t + 0.4, { op: 0, blur: [40, 0], pos: [0, 30] }, 1, 100);
    reveal(b, t + 0.12, t + 0.52, { op: 0, blur: [40, 0], pos: [0, 30] }, 1, 100);
    return [a, b];
  }
  var left = stack("BETTER", "RECOVERY", 560, tA);
  var right = stack("MORE", "MUSCLE", 1360, tB);
  var arrows = [];
  // green up-arrows next to each word
  var xs = [[560 + 268, tA + 0.5], [1360 + 228, tB + 0.5]];
  for (var i = 0; i < xs.length; i++) {
    var ar = S(comp, "S10 arrow " + i);
    path(ar, [[0, 30], [0, -30]], false); path(ar, [[-20, -10], [0, -32], [20, -10]], false);
    stroke(ar, GREEN, 9, true); trim(ar, xs[i][1], xs[i][1] + 0.3, 80);
    tr(ar.layer, "pos").setValue([xs[i][0], 575]);
    tr(ar.layer, "pos").expression = 'value+[0,-6*Math.sin((time-' + xs[i][1] + ')*6)]';
    glow(ar.layer, 20, 1.2, 30);
    arrows.push(ar.layer);
  }
  // centre chevron  >  (draws on)
  var ch = S(comp, "S10 chevron");
  path(ch, [[-26, -50], [26, 0], [-26, 50]], false); stroke(ch, WHITE, 12, true); trim(ch, tSym, tSym + 0.3, 85);
  tr(ch.layer, "pos").setValue([960, 560]);
  K(tr(ch.layer, "scale"), [[tSym, [60, 60]], [tSym + 0.3, [100, 100]]], { ease: 80 });
  var all = left.concat(right).concat(arrows).concat([ch.layer]);
  for (var j = 0; j < all.length; j++) {
    span(all[j], tA, tOut + 0.35); shadow(all[j], 50, 3, 18);
    var o = tr(all[j], "op"); o.setValueAtTime(tOut, 100); o.setValueAtTime(tOut + 0.3, 0);
  }
})();

// ============================================================================
// S11 — "most guys get it WRONG" + glitch exit                 45.1 – 47.6
// ============================================================================
(function () {
  var a = T(comp, "MOST GUYS", { font: "Montserrat-ExtraBold", size: 92, pos: [960, 860], name: "S11 most" });
  reveal(a, 45.4, 45.9, { op: 0, blur: [30, 0], pos: [0, 30] }, 3, 100);
  var b = T(comp, "GET IT WRONG", { font: "Montserrat-Black", size: 128, color: RED, pos: [960, 985], name: "S11 wrong" });
  popIn(b, 46.42, 0.3, 140);
  shadow(a, 60, 3, 20); shadow(b, 70, 4, 24);
  span(a, 45.35, 47.6); span(b, 46.42, 47.6);
  // glitch adjustment: offset jitter + mosaic flicker   47.15 – 47.62
  var gl = comp.layers.addSolid(WHITE, "Glitch", W, H, 1);
  gl.adjustmentLayer = true; span(gl, 47.15, 47.62);
  var off = fx(gl, "ADBE Offset");
  fxp(off, "Shift Center To").expression = 'seedRandom(Math.floor(time*30),true);[960+random(-260,260),540+random(-40,40)];';
  var mo = fx(gl, "ADBE Mosaic");
  fxp(mo, "Horizontal Blocks").expression = 'seedRandom(Math.floor(time*30)+5,true); random()<0.5?40:1920;';
  fxp(mo, "Vertical Blocks").expression = 'seedRandom(Math.floor(time*30)+5,true); random()<0.5?24:1080;';
})();

// ============================================================================
// S12 — chapter card "SIGN #1 / PERSISTENT SORENESS" (vault #924)   47.6 – 51.05
// ============================================================================
(function () {
  var tIn = 47.6, tOut = 51.05;
  var c = makeChapter(tOut - tIn, 80.52 - SEG2_OFFSET - tIn, 82.32 - SEG2_OFFSET - tIn);
  var l = comp.layers.add(c);
  l.startTime = tIn; span(l, tIn, tOut);
})();

// ============================================================================
// S13 — chapter tab bar (vault #929) + "not inherently bad"      51.05 – 55.8
// ============================================================================
(function () {
  var t0 = 51.2;
  var tabs = [
    { label: "01  Persistent soreness", x: 150, active: true },
    { label: "02  Sleep", x: 760, active: false },
    { label: "03  Strength stalls", x: 1150, active: false }
  ];
  for (var i = 0; i < tabs.length; i++) {
    var tb = tabs[i];
    var lt = T(comp, tb.label, { font: "Montserrat-Bold", size: 34, just: "L", pos: [tb.x, 1000], color: tb.active ? WHITE : [1, 1, 1] });
    tr(lt, "op").setValue(tb.active ? 100 : 45);
    reveal(lt, t0 + i * 0.12, t0 + 0.4 + i * 0.12, { op: 0, pos: [0, 20] }, 1, 100);
    shadow(lt, 60, 3, 14);
    span(lt, t0, DUR);
    var ul = S(comp, "S13 line " + i);
    path(ul, [[0, 0], [tb.active ? 470 : (i == 1 ? 140 : 370), 0]], false);
    stroke(ul, tb.active ? GREEN : WHITE, tb.active ? 6 : 3, true);
    tr(ul.layer, "anchor").setValue([0, 0]); tr(ul.layer, "pos").setValue([tb.x, 1024]);
    tr(ul.layer, "op").setValue(tb.active ? 100 : 35);
    trim(ul, t0 + 0.2 + i * 0.12, t0 + 0.7 + i * 0.12, 80);
    span(ul.layer, t0, DUR);
  }
  // "ISN'T INHERENTLY BAD" check pill   (src 86.56 → comp 53.86)
  var tp = 86.56 - SEG2_OFFSET;
  var pill = S(comp, "S13 pill");
  var mk = pill; path(mk, [[36, 2], [47, 13], [64, -9]], false); stroke(mk, WHITE, 7, true); trim(mk, tp + 0.2, tp + 0.45, 80);
  var bd = addGroup(pill); ellipse(bd, [62, 62], [50, 0]); fill(bd, [0.12, 0.78, 0.4]);
  var pb = addGroup(pill); rect(pb, [560, 90], [280, 0], 45); fill(pb, WHITE);
  tr(pill.layer, "anchor").setValue([0, 0]); tr(pill.layer, "pos").setValue([150, 330]);
  popIn(pill.layer, tp, 0.35, 75);
  shadow(pill.layer, 45, 8, 30);
  var ptx = T(comp, "Not inherently bad", { font: "Montserrat-Bold", size: 40, just: "L", color: INK, pos: [250, 344] });
  reveal(ptx, tp + 0.1, tp + 0.45, { op: 0, blur: [20, 0] }, 1, 100);
  span(pill.layer, tp, DUR); span(ptx, tp, DUR);
})();

// ============================================================================
// FINISHING — grain, vignette, fade
// ============================================================================
(function () {
  var fin = comp.layers.addSolid(WHITE, "Finish (grain+vignette)", W, H, 1);
  fin.adjustmentLayer = true;
  var vg = fx(fin, "CC Vignette");
  fxp(vg, "Amount").setValue(35);
  var nz = fx(fin, "ADBE Noise");
  fxp(nz, "Amount of Noise").setValue(3);
  var fade = comp.layers.addSolid(BLACK, "Fade out", W, H, 1);
  span(fade, DUR - 0.5, DUR);
  K(tr(fade, "op"), [[DUR - 0.5, 0], [DUR, 100]], { linear: true });
})();

proj.save(File(OUT));
"built " + comp.numLayers + " layers";
