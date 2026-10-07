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
  addEventListener: noop, innerHTML: '' });
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

test('phaseInfo: day, dusk, night and dawn', () => {
  assert.equal(G.phaseInfo(0).isNight, false);
  assert.equal(G.phaseInfo(0).darkness, 0);
  assert.equal(G.phaseInfo(142.5).darkness, 0.5);
  assert.equal(G.phaseInfo(200).isNight, true);
  assert.equal(G.phaseInfo(200).darkness, 1);
  assert.equal(G.phaseInfo(299).dawn, true);
});

test('updateHunger: drain, sprint and starvation', () => {
  assert.ok(Math.abs(G.updateHunger(100, 3, false).hunger - 99) < 1e-9);
  assert.ok(Math.abs(G.updateHunger(100, 3, true).hunger - 98) < 1e-9);
  assert.deepEqual(G.updateHunger(1, 6, false), { hunger: G.CONFIG.HUNGER_AFTER_STARVE, starved: true });
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

let failed = 0;
for (const { name, fn } of tests) {
  try { fn(); console.log(`ok   ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${name}\n     ${e.message}`); }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
process.exit(failed ? 1 : 0);
