const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("startBtn");
const countdownEl = document.getElementById("countdown");
const levelSelect = document.getElementById("levelSelect");
const levelButtons = document.querySelectorAll(".level-btn");

const hitEffects = [];
const floatingTexts = [];

let W = 0,
  H = 0;

function resize() {
  // “πραγματικά” pixels για καθαρότητα
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  W = Math.floor(rect.width);
  H = Math.floor(rect.height);

  canvas.width = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener("resize", resize);

levelButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    difficulty = btn.dataset.level;

    levelButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
  });
});

let score = 0;
let timeLeft = 45;
let gameRunning = false;

let playerFrozen = false;
let freezeTimer = null;

let difficulty = null; // easy | medium | hard
let timeTimer = null;
let rafId = null;

let spawnTimer = 0;
let spawnInterval = 500; // ms

let combo = 0;
let comboTimer = 0;
let comboTimeout = 1.2; // seconds
let totalGems = parseInt(localStorage.getItem("squeeze_gems")) || 0;
let earnedGems = 0;

// --- “Ανθρωπάκια” (προς το παρόν κύκλοι) ---
const entities = [];
const ENTITY_R = 22; // μέγεθος “στόχου”
const BASE_SPEED = 140; // px/sec
const MAX_ENTITIES = 8; // active entities cap

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function getRandomType() {
  const r = Math.random();

  if (difficulty === "easy") return "normal";
  if (difficulty === "medium") return r < 0.7 ? "normal" : "shield";

  if (difficulty === "hard") {
    if (r < 0.6) return "normal";
    if (r < 0.85) return "shield";
    return "spike";
  }

  return "normal";
}

function spawnEntity() {
  const side = Math.floor(Math.random() * 4);
  const speed = BASE_SPEED * rand(0.8, 1.2);

  let x, y, vx, vy;

  if (side === 0) {
    // LEFT -> RIGHT
    x = -ENTITY_R;
    y = rand(ENTITY_R, H - ENTITY_R);
    vx = speed;
    vy = rand(-20, 20);
  } else if (side === 1) {
    // RIGHT -> LEFT
    x = W + ENTITY_R;
    y = rand(ENTITY_R, H - ENTITY_R);
    vx = -speed;
    vy = rand(-20, 20);
  } else if (side === 2) {
    // TOP -> DOWN
    x = rand(ENTITY_R, W - ENTITY_R);
    y = -ENTITY_R;
    vx = rand(-20, 20);
    vy = speed;
  } else {
    // BOTTOM -> UP
    x = rand(ENTITY_R, W - ENTITY_R);
    y = H + ENTITY_R;
    vx = rand(-20, 20);
    vy = -speed;
  }

  entities.push({
  x,
  y,
  vx,
  vy,
  r: ENTITY_R,
  type: getRandomType(),
  hit: false,
  hitTimer: 0,
  walkPhase: Math.random() * Math.PI * 2
});
}

function resetEntities() {
  entities.length = 0;
}

function update(dt) {
  // ✅ Combo decay (μία φορά ανά frame)
  if (combo > 0) {
    comboTimer -= dt;
    if (comboTimer <= 0) {
      combo = 0;
      comboTimer = 0;
    }
  }

  // Κίνηση + removal
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];

    if (e.hit) {
      e.hitTimer -= dt;
      if (e.hitTimer <= 0) {
        entities.splice(i, 1);
        continue;
      }
    }

    e.x += e.vx * dt;
    e.walkPhase += dt * 8;
    e.y += e.vy * dt;

    // ✅ Αφαίρεση αν βγει εκτός οθόνης
    if (
      e.x < -e.r - 20 ||
      e.x > W + e.r + 20 ||
      e.y < -e.r - 20 ||
      e.y > H + e.r + 20
    ) {
      entities.splice(i, 1);
      continue;
    }
  }

  // Spawn rhythm (με cap)
  spawnTimer += dt * 1000;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    if (entities.length < MAX_ENTITIES) spawnEntity();
  }

  // Εγγύηση τουλάχιστον 1 normal (αγνοώντας όσα είναι ήδη hit)
  const normalCount = entities.filter((e) => e.type === "normal" && !e.hit).length;
  if (normalCount === 0 && entities.length > 0) {
    const candidates = entities.filter((e) => !e.hit);
    if (candidates.length > 0) {
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      pick.type = "normal";
    }
  }

  // Hit ring effects update
  for (let i = hitEffects.length - 1; i >= 0; i--) {
    const h = hitEffects[i];
    h.radius += 200 * dt;
    h.alpha -= 2 * dt;
    if (h.alpha <= 0) hitEffects.splice(i, 1);
  }

  // Floating texts update
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const f = floatingTexts[i];
    f.y -= 60 * dt;
    f.alpha -= 1.5 * dt;
    if (f.alpha <= 0) floatingTexts.splice(i, 1);
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // Φόντο
  ctx.fillStyle = "#151a22";
  ctx.fillRect(0, 0, W, H);

  // Entities
  // Entities
for (const e of entities) {

  let scale = 1;
  if (e.hit) scale = 1 + e.hitTimer * 6;

  // fake walk bounce
  const bounce = Math.sin(e.walkPhase) * 3;

  const bodyColor =
    e.type === "normal" ? "#ff3b30" :
    e.type === "shield" ? "#ffd60a" :
    "#ff006e";

  // SHADOW
  ctx.beginPath();
  ctx.ellipse(e.x, e.y + e.r * 0.9, e.r * 0.7, e.r * 0.25, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fill();

  ctx.save();
  ctx.translate(e.x, e.y + bounce);
  ctx.scale(scale, scale);

  // BODY
  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.roundRect(-8, -2, 16, 20, 4);
  ctx.fill();

  // HEAD
  ctx.beginPath();
  ctx.arc(0, -10, 7, 0, Math.PI * 2);
  ctx.fill();

  // LEGS
  const legOffset = Math.sin(e.walkPhase) * 4;

  ctx.beginPath();
  ctx.rect(-5, 18, 4, 8 + legOffset);
  ctx.rect(1, 18, 4, 8 - legOffset);
  ctx.fill();

  ctx.restore();
}

  // Hit rings
  for (const h of hitEffects) {
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${h.alpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // Floating texts
  ctx.textAlign = "center";
  ctx.font = "bold 18px Arial";

  for (const f of floatingTexts) {
    ctx.globalAlpha = f.alpha;
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// --- Tap detection ---
function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : evt.clientX;
  const clientY = evt.touches && evt.touches[0] ? evt.touches[0].clientY : evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function comboBreakFX() {
  hitEffects.push({
    x: W / 2,
    y: 60,
    radius: 20,
    alpha: 0.6
  });
}

function tryHit(x, y) {
  if (playerFrozen) return;

  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];

    // ✅ μην ξαναχτυπάς κάτι που ήδη “φεύγει”
    if (e.hit) continue;

    const dx = x - e.x;
    const dy = y - e.y;

    if (dx * dx + dy * dy <= e.r * e.r) {
      if (e.type === "normal") {
        combo++;
        comboTimer = comboTimeout;

        let multiplier = 1;
        if (combo >= 20) multiplier = 4;
        else if (combo >= 10) multiplier = 3;
        else if (combo >= 5) multiplier = 2;

        const gained = 10 * multiplier;

        score += gained;
        scoreEl.textContent = score;

        floatingTexts.push({
          x: e.x,
          y: e.y,
          text: multiplier > 1 ? `+${gained} x${multiplier}` : `+${gained}`,
          alpha: 1,
          color: multiplier > 1 ? "#00ffcc" : "#ffffff"
        });

        hitEffects.push({
          x: e.x,
          y: e.y,
          radius: 10,
          alpha: 1
        });

        e.hit = true;
        e.hitTimer = 0.12;
        return;
      }

      // SHIELD -> break combo
      if (e.type === "shield") {
        combo = 0;
        comboTimer = 0;
        comboBreakFX();
        return;
      }

      // SPIKE -> break combo + freeze + -2 sec
      if (e.type === "spike") {
        combo = 0;
        comboTimer = 0;
        comboBreakFX();

        activateFreeze();

        timeLeft = Math.max(0, timeLeft - 2);
        timeEl.textContent = timeLeft;

        if (timeLeft <= 0) {
          endRound();
          return;
        }
        return;
      }
    }
  }
}

function onPointerDown(evt) {
  if (!gameRunning) return;
  evt.preventDefault();
  const p = getPointerPos(evt);
  tryHit(p.x, p.y);
}

function activateFreeze() {
  playerFrozen = true;
  canvas.style.filter = "grayscale(1) blur(2px)";

  if (freezeTimer) clearTimeout(freezeTimer);

  freezeTimer = setTimeout(() => {
    playerFrozen = false;
    canvas.style.filter = "none";
  }, 800);
}

canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("touchstart", onPointerDown, { passive: false });

// --- Game loop ---
let lastTs = 0;

function loop(ts) {
  if (!gameRunning) return;

  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
  lastTs = ts;

  update(dt);
  draw();

  rafId = requestAnimationFrame(loop);
}

// --- Start with 3..2..1 ---
function startCountdownThenPlay() {
  countdownEl.classList.remove("hidden");
  let c = 3;
  countdownEl.textContent = c;

  const cd = setInterval(() => {
    c--;
    if (c <= 0) {
      clearInterval(cd);
      countdownEl.classList.add("hidden");
      beginRound();
      return;
    }
    countdownEl.textContent = c;
  }, 700);
}

function beginRound() {
  score = 0;
  timeLeft = 45;

  combo = 0;
  comboTimer = 0;

  spawnTimer = 0;

  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;

  resetEntities();
  hitEffects.length = 0;
  floatingTexts.length = 0;

  // difficulty spawn rate
  if (difficulty === "easy") spawnInterval = 700;
  if (difficulty === "medium") spawnInterval = 500;
  if (difficulty === "hard") spawnInterval = 350;

  gameRunning = true;

  lastTs = 0;
  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(loop);

  if (timeTimer) clearInterval(timeTimer);
  timeTimer = setInterval(() => {
    timeLeft--;
    timeEl.textContent = timeLeft;
    if (timeLeft <= 0) endRound();
  }, 1000);
}

function calculateGems(score) {
  return Math.floor(score / 100);
}
function endRound() {
  gameRunning = false;

  if (rafId) cancelAnimationFrame(rafId);
  if (timeTimer) clearInterval(timeTimer);

  earnedGems = calculateGems(score);
  totalGems += earnedGems;

  localStorage.setItem("squeeze_gems", totalGems);

  startBtn.disabled = false;

  setTimeout(() => {
    alert(
      "Game Over!\n" +
      "Score: " + score +
      "\nYou earned: " + earnedGems + " Gems" +
      "\nTotal Gems: " + totalGems
    );
  }, 50);
}


startBtn.addEventListener("click", () => {
  if (!difficulty) return;

  levelSelect.style.display = "none";

  if (gameRunning) return;
  startBtn.disabled = true;
  startCountdownThenPlay();
});

// init
resize();
draw();
