document.addEventListener("DOMContentLoaded", () => {

/* =====================================================
   DOM
===================================================== */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("startBtn");
const countdownEl = document.getElementById("countdown");
const levelSelect = document.getElementById("levelSelect");
const levelButtons = document.querySelectorAll(".level-btn");

const shopBtn = document.getElementById("shopBtn");
const shopPanel = document.getElementById("shopPanel");
const closeShop = document.getElementById("closeShop");
const themeList = document.getElementById("themeList");
const shopOverlay = document.getElementById("shopOverlay");
const gemCount = document.getElementById("gemCount");

const levelDisplay = document.getElementById("levelDisplay");
const xpFill = document.getElementById("xpFill");

const milestonesBtn = document.getElementById("milestonesBtn");
const milestoneScreen = document.getElementById("milestoneScreen");
const milestoneList = document.getElementById("milestoneList");
const closeMilestones = document.getElementById("closeMilestones");

/* =====================================================
   CONFIG
===================================================== */

const Config = {
  roundSeconds: 45,
  entityRadius: 22,
  baseSpeed: 140,
  maxEntities: 8,

  comboTimeout: 1.2,
  hitVanishSec: 0.12,

  spawnIntervalMs: { easy: 700, medium: 500, hard: 350 },

  gemsPerScore: 100,
  xpScoreDiv: 10,
  xpDifficultyBonus: { easy: 0.7, medium: 1.0, hard: 1.4 },

  freezeMs: 800,
  spikeTimePenalty: 2
};

/* =====================================================
   STATE
===================================================== */

const State = {
  W: 0,
  H: 0,

  gameRunning: false,
  difficulty: null,

  score: 0,
  timeLeft: Config.roundSeconds,

  combo: 0,
  comboTimer: 0,

  spawnTimerMs: 0,
  spawnIntervalMs: Config.spawnIntervalMs.medium,

  playerFrozen: false,

  entities: [],
  hitEffects: [],
  floatingTexts: [],

  totalGems: parseInt(localStorage.getItem("squeeze_gems")) || 0,
  earnedGems: 0,

  playerLevel: parseInt(localStorage.getItem("squeeze_level")) || 1,
  currentXP: parseInt(localStorage.getItem("squeeze_xp")) || 0,

  claimedMilestones:
    JSON.parse(localStorage.getItem("squeeze_milestones_claimed")) || [],

  timers: {
    rafId: null,
    timeTimer: null,
    freezeTimer: null,
    countdownTimer: null
  }
};

/* =====================================================
   STORAGE
===================================================== */

const Storage = {
  saveGems() {
    localStorage.setItem("squeeze_gems", State.totalGems);
  },
  saveXP() {
    localStorage.setItem("squeeze_level", State.playerLevel);
    localStorage.setItem("squeeze_xp", State.currentXP);
  },
  saveClaimed() {
    localStorage.setItem(
      "squeeze_milestones_claimed",
      JSON.stringify(State.claimedMilestones)
    );
  }
};

/* =====================================================
   UI
===================================================== */

const UI = {
  setScore(v) { scoreEl.textContent = v; },
  setTime(v) { timeEl.textContent = v; },
  setGems(v) { gemCount.textContent = v; },

  setFrozen(isFrozen) {
    canvas.style.filter = isFrozen
      ? "grayscale(1) blur(2px)"
      : "none";
  },

  show(el) { el.classList.remove("hidden"); },
  hide(el) { el.classList.add("hidden"); }
};

/* =====================================================
   UTIL
===================================================== */

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function clearTimers() {
  const t = State.timers;
  if (t.rafId) cancelAnimationFrame(t.rafId);
  if (t.timeTimer) clearInterval(t.timeTimer);
  if (t.freezeTimer) clearTimeout(t.freezeTimer);
  if (t.countdownTimer) clearInterval(t.countdownTimer);

  t.rafId = t.timeTimer = t.freezeTimer = t.countdownTimer = null;
}

/* =====================================================
   RESIZE
===================================================== */

function resize() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();

  State.W = Math.floor(rect.width);
  State.H = Math.floor(rect.height);

  canvas.width = Math.floor(State.W * dpr);
  canvas.height = Math.floor(State.H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resize);

/* =====================================================
   XP
===================================================== */

function xpNeededForLevel(level) {
  return 100 + level * 40;
}

function addXP(amount) {
  State.currentXP += amount;

  let xpNeeded = xpNeededForLevel(State.playerLevel);

  while (State.currentXP >= xpNeeded) {
    State.currentXP -= xpNeeded;
    State.playerLevel++;
    xpNeeded = xpNeededForLevel(State.playerLevel);
  }

  Storage.saveXP();
  updateXPUI();
}

function updateXPUI() {
  levelDisplay.textContent = State.playerLevel;
  const percent =
    State.currentXP / xpNeededForLevel(State.playerLevel);
  xpFill.style.width = percent * 100 + "%";
}

/* =====================================================
   ENTITIES
===================================================== */

function getRandomType() {
  const r = Math.random();

  if (State.difficulty === "easy") return "normal";
  if (State.difficulty === "medium")
    return r < 0.7 ? "normal" : "shield";

  if (State.difficulty === "hard") {
    if (r < 0.6) return "normal";
    if (r < 0.85) return "shield";
    return "spike";
  }

  return "normal";
}

function spawnEntity() {
  const side = Math.floor(Math.random() * 4);
  const speed = Config.baseSpeed * rand(0.8, 1.2);

  let x, y, vx, vy;

  if (side === 0) {
    x = -Config.entityRadius;
    y = rand(Config.entityRadius, State.H - Config.entityRadius);
    vx = speed;
    vy = rand(-20, 20);
  } else if (side === 1) {
    x = State.W + Config.entityRadius;
    y = rand(Config.entityRadius, State.H - Config.entityRadius);
    vx = -speed;
    vy = rand(-20, 20);
  } else if (side === 2) {
    x = rand(Config.entityRadius, State.W - Config.entityRadius);
    y = -Config.entityRadius;
    vx = rand(-20, 20);
    vy = speed;
  } else {
    x = rand(Config.entityRadius, State.W - Config.entityRadius);
    y = State.H + Config.entityRadius;
    vx = rand(-20, 20);
    vy = -speed;
  }

  State.entities.push({
    x, y, vx, vy,
    r: Config.entityRadius,
    type: getRandomType(),
    hit: false,
    hitTimer: 0,
    walkPhase: Math.random() * Math.PI * 2
  });
}

/* =====================================================
   GAME LOOP
===================================================== */

let lastTs = 0;

function update(dt) {

  if (State.combo > 0) {
    State.comboTimer -= dt;
    if (State.comboTimer <= 0) {
      State.combo = 0;
      State.comboTimer = 0;
    }
  }

  for (let i = State.entities.length - 1; i >= 0; i--) {
    const e = State.entities[i];

    if (e.hit) {
      e.hitTimer -= dt;
      if (e.hitTimer <= 0) {
        State.entities.splice(i, 1);
        continue;
      }
    }

    e.x += e.vx * dt;
    e.y += e.vy * dt;
    e.walkPhase += dt * 8;

    if (
      e.x < -e.r - 20 ||
      e.x > State.W + e.r + 20 ||
      e.y < -e.r - 20 ||
      e.y > State.H + e.r + 20
    ) {
      State.entities.splice(i, 1);
    }
  }

  State.spawnTimerMs += dt * 1000;

  if (State.spawnTimerMs >= State.spawnIntervalMs) {
    State.spawnTimerMs = 0;
    if (State.entities.length < Config.maxEntities)
      spawnEntity();
  }
}

function draw() {
  ctx.clearRect(0, 0, State.W, State.H);
  ctx.fillStyle = "#151a22";
  ctx.fillRect(0, 0, State.W, State.H);

  for (const e of State.entities) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = e.type === "normal"
      ? "#ff3b30"
      : e.type === "shield"
      ? "#ffd60a"
      : "#ff006e";
    ctx.fill();
  }
}

function loop(ts) {
  if (!State.gameRunning) return;

  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
  lastTs = ts;

  update(dt);
  draw();

  State.timers.rafId = requestAnimationFrame(loop);
}

/* =====================================================
   START / END ROUND
===================================================== */

function beginRound() {

  clearTimers();

  State.score = 0;
  State.timeLeft = Config.roundSeconds;
  State.combo = 0;
  State.comboTimer = 0;
  State.spawnTimerMs = 0;
  State.entities = [];

  UI.setScore(State.score);
  UI.setTime(State.timeLeft);

  State.spawnIntervalMs =
    Config.spawnIntervalMs[State.difficulty];

  State.gameRunning = true;

  lastTs = 0;
  State.timers.rafId = requestAnimationFrame(loop);

  State.timers.timeTimer = setInterval(() => {
    State.timeLeft--;
    UI.setTime(State.timeLeft);

    if (State.timeLeft <= 0)
      endRound();
  }, 1000);
}

function calculateGems(score) {
  return Math.floor(score / Config.gemsPerScore);
}

function endRound() {

  clearTimers();
  State.gameRunning = false;

  State.earnedGems = calculateGems(State.score);
  State.totalGems += State.earnedGems;

  Storage.saveGems();

  const bonus =
    Config.xpDifficultyBonus[State.difficulty] || 1;

  const xpEarned = Math.floor(
    (State.score / Config.xpScoreDiv) * bonus
  );

  addXP(xpEarned);

  startBtn.disabled = false;
}

/* =====================================================
   INPUT
===================================================== */

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX =
    evt.touches && evt.touches[0]
      ? evt.touches[0].clientX
      : evt.clientX;
  const clientY =
    evt.touches && evt.touches[0]
      ? evt.touches[0].clientY
      : evt.clientY;

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function tryHit(x, y) {
  if (!State.gameRunning) return;

  for (let i = State.entities.length - 1; i >= 0; i--) {
    const e = State.entities[i];
    const dx = x - e.x;
    const dy = y - e.y;

    if (dx * dx + dy * dy <= e.r * e.r) {

      if (e.type === "normal") {
        State.score += 10;
        UI.setScore(State.score);
      }

      State.entities.splice(i, 1);
      return;
    }
  }
}

canvas.addEventListener("mousedown", (evt) => {
  const p = getPointerPos(evt);
  tryHit(p.x, p.y);
});

/* =====================================================
   DIFFICULTY
===================================================== */

levelButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    State.difficulty = btn.dataset.level;

    levelButtons.forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");
  });
});

/* =====================================================
   START BUTTON
===================================================== */

startBtn.addEventListener("click", () => {

  if (!State.difficulty) return;
  if (State.gameRunning) return;

  startBtn.disabled = true;
  levelSelect.classList.add("hidden");

  beginRound();
});

/* =====================================================
   INIT
===================================================== */

updateXPUI();
resize();
draw();

});
