// Headless smoke test: loads the game script from src/index.html with a stubbed DOM/canvas
// and checks the pure rules, island generation and core gameplay. Run with `npm test`.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

// --- Minimal browser stubs ---
const noop = () => {};
const fakeCtx = new Proxy({}, {
  get: (t, k) => k in t ? t[k]
    : k === 'measureText' ? () => ({ width: 50 })
    : k === 'createRadialGradient' ? () => ({ addColorStop: noop })
    : noop,
  set: (t, k, v) => { t[k] = v; return true; },
});
const mkEl = () => ({ getContext: () => fakeCtx, width: 0, height: 0, classList: { add: noop, remove: noop },
  addEventListener: noop, innerHTML: '', style: {} });
global.document = { getElementById: mkEl, createElement: mkEl };
global.window = global;
global.innerWidth = 1280; global.innerHeight = 720; global.devicePixelRatio = 1;
global.addEventListener = noop;
global.requestAnimationFrame = noop;
global.performance = { now: () => 0 };
eval(script);

const G = window.IslandGame;
const st = () => G.state;
const STEP = 1 / 60;
const monster = (x, y) => ({ x, y, dz: 0, alpha: 1, fading: false, state: 'chase', ang: 0, wanderT: 1,
  stuck: 0, detour: 0, side: 1, seed: 0 });

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('day and night are 2 minutes each', () => {
  assert.equal(G.CONFIG.NIGHT_START, 120);
  assert.equal(G.CONFIG.DAY_LENGTH - G.CONFIG.NIGHT_START, 120);
});

test('phaseInfo: day, dusk, night and dawn', () => {
  const { DAY_LENGTH: L, NIGHT_START: ns, FADE: f } = G.CONFIG;
  assert.equal(G.phaseInfo(0).isNight, false);
  assert.equal(G.phaseInfo(0).darkness, 0);
  assert.equal(G.phaseInfo(ns - f / 2).darkness, 0.5);
  assert.equal(G.phaseInfo(ns + 1).isNight, true);
  assert.equal(G.phaseInfo(ns + 1).darkness, 1);
  assert.equal(G.phaseInfo(L - 1).dawn, true);
});

test('updateHunger: drain, sprint and starvation', () => {
  const d = G.CONFIG.HUNGER_DRAIN;
  assert.ok(Math.abs(G.updateHunger(100, 3, false).hunger - (100 - 3 * d)) < 1e-9);
  assert.ok(Math.abs(G.updateHunger(100, 3, true).hunger - (100 - 3 * d * G.CONFIG.SPRINT_HUNGER_MULT)) < 1e-9);
  assert.deepEqual(G.updateHunger(1, 6, false), { hunger: G.CONFIG.HUNGER_AFTER_STARVE, starved: true });
  assert.ok(G.CONFIG.MAX_HUNGER / d <= 150, 'a full stomach lasts at most 2.5 minutes');
});

test('applyLifeLoss: game over only on the last life', () => {
  assert.deepEqual(G.applyLifeLoss(2), { lives: 1, gameOver: false });
  assert.deepEqual(G.applyLifeLoss(1), { lives: 0, gameOver: true });
});

test('generateIsland: 200 seeds produce valid, reachable islands', () => {
  for (let s = 0; s < 200; s++) {
    const w = G.generateIsland(s * 1000 + 7);
    const reachable = (x, y) => w.reach[Math.floor(y) * w.N + Math.floor(x)] === 1;
    assert.equal(w.portals.length, G.CONFIG.PORTAL_PAIRS * 2, `seed ${s}: portal count`);
    for (const p of w.portals) assert.ok(reachable(p.x, p.y), `seed ${s}: portal unreachable`);
    assert.ok(reachable(w.grove.x, w.grove.y), `seed ${s}: grove unreachable`);
    assert.ok(reachable(w.cave.x, w.cave.y), `seed ${s}: cave unreachable`);
    assert.ok(reachable(w.wreck.x, w.wreck.y), `seed ${s}: wreck unreachable`);
    assert.ok(w.bushes.length > 0 && w.palms.length > 0, `seed ${s}: no food sources`);
  }
});

test('simulation: several days and nights run without errors', () => {
  G.newGame(42); G.startPlay();
  st().timeScale = 20;
  let maxMonsters = 0;
  for (let i = 0; i < 60 * 60 * 3 && st().mode === 'play'; i++) {
    st().interactQueued = i % 20 === 0;
    G.update(STEP);
    if (i % 30 === 0) G.render(STEP);
    maxMonsters = Math.max(maxMonsters, st().monsters.length);
  }
  assert.ok(st().day >= 5, `reached day ${st().day}`);
  assert.ok(maxMonsters > 0, 'monsters spawned at night');
});

test('portals teleport to their partner', () => {
  G.newGame(7); G.startPlay();
  const pt = st().world.portals[0];
  Object.assign(st().player, { x: pt.x, y: pt.y });
  st().interactQueued = true;
  G.update(STEP);
  assert.ok(Math.hypot(st().player.x - pt.partner.x, st().player.y - pt.partner.y) < 0.01);
});

test('secrets and the hidden portal can be discovered', () => {
  G.newGame(7); G.startPlay();
  const w = st().world, p = st().player;
  Object.assign(p, { x: w.grove.x + 0.5, y: w.grove.y + 0.5 }); G.update(STEP);
  Object.assign(p, { x: w.cave.x + 0.5, y: w.cave.y + 0.5 }); G.update(STEP);
  Object.assign(p, { x: w.wreck.x, y: w.wreck.y }); st().interactQueued = true; G.update(STEP);
  assert.deepEqual(st().secrets, { grove: true, cave: true, wreck: true });
  assert.equal(st().wreckOpened, true);
  const hidden = w.portals.find(q => q.hidden);
  assert.equal(hidden.discovered, false);
  Object.assign(p, { x: hidden.x + 1, y: hidden.y }); G.update(STEP);
  assert.ok(hidden.discovered && hidden.partner.discovered);
});

test('monsters cannot hurt the player in the cave', () => {
  G.newGame(7); G.startPlay();
  const w = st().world, p = st().player;
  Object.assign(p, { x: w.cave.x + 0.5, y: w.cave.y + 0.5 });
  st().monsters = [monster(p.x, p.y + 0.3)];
  G.update(STEP);
  assert.equal(p.lives, G.CONFIG.START_LIVES);
});

test('a monster catch costs a life, and the last life ends the game', () => {
  G.newGame(7); G.startPlay();
  const w = st().world, p = st().player, k = w.spawnTiles[0];
  Object.assign(p, { x: k % w.N + 0.5, y: Math.floor(k / w.N) + 0.5 });
  st().monsters = [monster(p.x, p.y)];
  G.update(STEP);
  assert.equal(p.lives, G.CONFIG.START_LIVES - 1);
  assert.equal(p.x, w.start.x, 'respawned on the beach');

  Object.assign(p, { x: k % w.N + 0.5, y: Math.floor(k / w.N) + 0.5, lives: 1, invuln: 0 });
  st().monsters = [monster(p.x, p.y)];
  G.update(STEP);
  assert.equal(st().mode, 'over');
});

test('surviving the night opens a white portal that leads to a new island', () => {
  G.newGame(7); G.startPlay();
  const p = st().player, oldWorld = st().world;
  st().t = G.CONFIG.DAY_LENGTH - 0.001;
  G.update(STEP);
  const ep = st().exitPortal;
  assert.ok(ep, 'exit portal spawned at dawn');
  const d = Math.hypot(ep.x - p.x, ep.y - p.y);
  assert.ok(d >= G.CONFIG.EXIT_PORTAL_DIST[0] && d <= G.CONFIG.EXIT_PORTAL_DIST[1] + 1, `portal distance ${d}`);

  Object.assign(p, { x: ep.x, y: ep.y, lives: 6, hunger: 40 });
  st().secrets.grove = true;
  st().interactQueued = true;
  G.update(STEP);
  assert.notEqual(st().world, oldWorld, 'new island generated');
  assert.equal(st().island, 2);
  assert.equal(st().exitPortal, null);
  assert.equal(p.lives, 6, 'lives carry over');
  assert.ok(p.hunger > 39, 'hunger carries over');
  assert.equal(st().secrets.grove, false, 'secrets reset per island');
  assert.equal(p.x, st().world.start.x);
});

test('the white portal fades at nightfall if unused', () => {
  G.newGame(7); G.startPlay();
  st().t = G.CONFIG.DAY_LENGTH - 0.001;
  G.update(STEP);
  assert.ok(st().exitPortal);
  st().t = G.CONFIG.NIGHT_START - 0.001;
  G.update(STEP);
  assert.equal(st().exitPortal, null);
});

// --- Gamepad ---
const mkPad = (axes = [0, 0], down = []) => ({ connected: true, axes,
  buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: down.includes(i) })) });
const setPads = pad => { Object.defineProperty(global, 'navigator', { value: { getGamepads: () => [pad] }, configurable: true }); };

test('readPad: deadzone, stick, D-pad and buttons', () => {
  assert.deepEqual([G.readPad(mkPad([0.1, -0.1])).sx, G.readPad(mkPad([0.1, -0.1])).sy], [0, 0]);
  const r = G.readPad(mkPad([0.8, -0.6], [1, 14]));
  assert.equal(r.sx, 0.8 - 1); assert.equal(r.sy, -0.6);
  assert.equal(r.sprint, true); assert.equal(r.interact, false);
  assert.equal(G.readPad(mkPad([0, 0], [13])).sy, 1);
  assert.equal(G.readPad(mkPad([0, 0], [0])).interact, true);
  assert.equal(G.readPad(mkPad([0, 0], [9])).pause, true);
});

test('gamepad: stick moves the player, A interacts once, Start pauses and resumes', () => {
  G.newGame(7); G.startPlay();
  const p = st().player, x0 = p.x, y0 = p.y;
  setPads(mkPad([0, 0], [])); G.pollGamepad(); // clear previous button state
  setPads(mkPad([1, 0])); G.pollGamepad();
  for (let i = 0; i < 20; i++) G.update(STEP);
  assert.ok(Math.hypot(p.x - x0, p.y - y0) > 0.1, 'player moved');
  setPads(mkPad([0, 0], [0])); G.pollGamepad();
  assert.equal(st().interactQueued, true);
  st().interactQueued = false; G.pollGamepad();
  assert.equal(st().interactQueued, false, 'held button does not retrigger');
  setPads(mkPad([0, 0], [9])); G.pollGamepad();
  assert.equal(st().mode, 'paused');
  setPads(mkPad()); G.pollGamepad();
  setPads(mkPad([0, 0], [9])); G.pollGamepad();
  assert.equal(st().mode, 'play');
  assert.equal(G.padInput.sx, 0);
});

test('gamepad: no controller connected is harmless', () => {
  setPads(null); G.pollGamepad();
  assert.deepEqual([G.padInput.sx, G.padInput.sy, G.padInput.sprint], [0, 0, false]);
});

// --- Touch ---
test('touchStick: deadzone, direction and clamped magnitude', () => {
  const R = G.CONFIG.TOUCH_STICK_RADIUS;
  assert.deepEqual(G.touchStick(2, 2), { sx: 0, sy: 0 });
  assert.deepEqual(G.touchStick(R, 0), { sx: 1, sy: 0 });
  const far = G.touchStick(0, -R * 5);
  assert.equal(far.sx, 0); assert.equal(far.sy, -1);
  const half = G.touchStick(R / 2, R / 2); // 45 degrees, length 0.5 of the way... clamped to <= 1
  assert.ok(Math.hypot(half.sx, half.sy) <= 1 && half.sx === half.sy && half.sx > 0);
});

test('touch: stick input moves the player and resetTouch stops it', () => {
  setPads(null);
  G.newGame(7); G.startPlay();
  const p = st().player, x0 = p.x, y0 = p.y;
  Object.assign(G.touchInput, G.touchStick(60, 0));
  for (let i = 0; i < 20; i++) G.update(STEP);
  assert.ok(Math.hypot(p.x - x0, p.y - y0) > 0.1, 'player moved');
  G.resetTouch();
  assert.deepEqual([G.touchInput.sx, G.touchInput.sy, G.touchInput.sprint], [0, 0, false]);
  const x1 = p.x, y1 = p.y;
  G.update(STEP);
  assert.equal(Math.hypot(p.x - x1, p.y - y1), 0, 'player stopped');
});

test('touch: sprint flag makes the player faster', () => {
  const run = sprint => {
    G.newGame(7); G.startPlay();
    const p = st().player; Object.assign(p, { x: st().world.start.x, y: st().world.start.y });
    Object.assign(G.touchInput, { sx: 0, sy: 1, sprint });
    const x0 = p.x, y0 = p.y;
    for (let i = 0; i < 10; i++) G.update(STEP);
    G.resetTouch();
    return Math.hypot(p.x - x0, p.y - y0);
  };
  assert.ok(run(true) > run(false));
});

test('musicMix: equal-power crossfade between day and night', () => {
  const d = G.musicMix(0), n = G.musicMix(1), h = G.musicMix(0.5);
  assert.ok(Math.abs(d.day - 1) < 1e-9 && Math.abs(d.night) < 1e-9);
  assert.ok(Math.abs(n.night - 1) < 1e-9 && Math.abs(n.day) < 1e-9);
  assert.ok(Math.abs(h.day ** 2 + h.night ** 2 - 1) < 1e-9);
});

test('chaseIntensity: only chasing monsters count, and closer is more intense', () => {
  const p = { x: 10, y: 10 }, m = (x, state, fading = false) => ({ x, y: 10, state, fading });
  assert.equal(G.chaseIntensity([], p), 0);
  assert.equal(G.chaseIntensity([m(12, 'wander'), m(11, 'chase', true)], p), 0);
  const far = G.chaseIntensity([m(18, 'chase')], p), near = G.chaseIntensity([m(11.5, 'chase')], p);
  assert.ok(far >= 0.4 && near > far && near <= 1);
  assert.equal(G.chaseIntensity([m(18, 'chase'), m(11.5, 'chase')], p), near); // the nearest chaser decides
});

test('music: silent without Web Audio, and the day/night layers follow the darkness', () => {
  G.newGame(3); G.startPlay(); // no AudioContext in this environment: must be harmless
  assert.equal(G.music.ctx, null);
  G.musicUpdate('play', 0);

  let oscillators = 0;
  const param = () => ({ value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, setTargetAtTime(v) { this.value = v; } });
  const node = () => ({ connect: noop, gain: param(), delayTime: param() });
  global.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { return node(); }
    createDelay() { return node(); }
    createOscillator() { oscillators++; return { ...node(), frequency: { exponentialRampToValueAtTime: noop }, detune: {}, start: noop, stop: noop }; }
    createBiquadFilter() { return { ...node(), frequency: {} }; }
    resume() {}
  };
  try {
    G.musicStart();
    assert.ok(G.music.ctx);
    G.music.ctx.currentTime = 1;
    G.musicUpdate('play', 0); // full day
    assert.ok(G.music.layers.day.bus.gain.value > 0.99 && G.music.layers.night.bus.gain.value < 0.01);
    assert.ok(oscillators > 0);
    G.music.ctx.currentTime = 2;
    G.musicUpdate('play', 1); // full night
    assert.ok(G.music.layers.night.bus.gain.value > 0.99 && G.music.layers.day.bus.gain.value < 0.01);

    G.music.ctx.currentTime = 3;
    for (let i = 0; i < 60; i++) { G.music.ctx.currentTime += 0.05; G.musicUpdate('play', 1, 1); } // being chased
    assert.ok(G.music.tension > 0.9 && G.music.layers.chase.bus.gain.value > 0.9);
    assert.ok(G.music.layers.night.bus.gain.value < 0.7); // night pad steps back
    for (let i = 0; i < 400; i++) { G.music.ctx.currentTime += 0.05; G.musicUpdate('play', 1, 0); } // escaped
    assert.ok(G.music.tension < 0.05);

    const full = G.music.master.gain.value;
    G.musicUpdate('paused', 1);
    assert.ok(G.music.master.gain.value < full); // ducked while paused
    const wasMuted = G.music.muted;
    G.toggleMute(); // muted: no new notes, master gain 0
    const count = oscillators;
    G.music.ctx.currentTime = 30;
    G.musicUpdate('play', 1);
    assert.equal(G.music.master.gain.value, wasMuted ? full : 0);
    if (!wasMuted) assert.equal(oscillators, count);
    G.toggleMute();
  } finally { delete global.AudioContext; G.music.ctx = null; G.music.layers = {}; }
});

test('sound effects: eating, portals, secrets, monster hits and the white portal each play a sound', () => {
  const audio = { osc: 0, noise: 0 };
  const param = () => ({ value: 0, setValueAtTime: noop, linearRampToValueAtTime: noop, setTargetAtTime: noop });
  const node = () => ({ connect: noop, gain: param(), delayTime: param() });
  global.AudioContext = class {
    constructor() { this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createGain() { return node(); }
    createDelay() { return node(); }
    createBiquadFilter() { return { ...node(), frequency: {} }; }
    createOscillator() { audio.osc++; return { ...node(), frequency: { exponentialRampToValueAtTime: noop }, detune: {}, start: noop, stop: noop }; }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() { audio.noise++; return { ...node(), start: noop, stop: noop }; }
    resume() {}
  };
  const tonesIn = name => G.SFX[name].filter(r => r[1] !== 'noise').length;
  const played = (action, name) => { // run the action and check how many oscillators it started
    const before = audio.osc;
    action();
    assert.equal(audio.osc - before, tonesIn(name), `${name}: ${audio.osc - before} tones`);
  };
  try {
    G.newGame(7); G.startPlay();
    const w = st().world, p = st().player;
    G.musicUpdate('play', 0); // schedule some music first so the counts below start from a known point
    audio.osc = 0;

    Object.assign(p, { x: w.start.x, y: w.start.y });
    st().items.push({ x: p.x, y: p.y, kind: 'berry' });
    st().interactQueued = true;
    played(() => G.update(STEP), 'eat');

    const pt = w.portals[0];
    Object.assign(p, { x: pt.x, y: pt.y, portalCd: 0 });
    st().interactQueued = true;
    played(() => G.update(STEP), 'portal');

    Object.assign(p, { x: w.cave.x + 0.5, y: w.cave.y + 0.5 });
    played(() => G.update(STEP), 'secret');

    const k = w.spawnTiles[0];
    Object.assign(p, { x: k % w.N + 0.5, y: Math.floor(k / w.N) + 0.5, invuln: 0 });
    st().monsters = [monster(p.x, p.y)];
    const noise = audio.noise;
    played(() => G.update(STEP), 'hit');
    assert.equal(audio.noise - noise, 1, 'hit also plays a noise burst');

    Object.assign(p, { hunger: 0.001 });
    played(() => G.update(STEP), 'starve');

    st().t = G.CONFIG.DAY_LENGTH - 0.001;
    played(() => G.update(STEP), 'reveal');
    const ep = st().exitPortal;
    Object.assign(p, { x: ep.x, y: ep.y });
    st().interactQueued = true;
    played(() => G.update(STEP), 'exit');

    G.toggleMute(); // muted: no sound effects
    const before = audio.osc;
    G.sfx('eat'); G.sfx('nonexistent');
    assert.equal(audio.osc, before);
    G.toggleMute();
  } finally { delete global.AudioContext; G.music.ctx = null; G.music.layers = {}; G.music.sfx = null; }
});

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
