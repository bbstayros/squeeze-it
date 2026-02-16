const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const startBtn = document.getElementById("startBtn");
const countdownEl = document.getElementById("countdown");

let W = 0, H = 0;

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

let score = 0;
let timeLeft = 45;
let gameRunning = false;
let timeTimer = null;
let rafId = null;

// --- “Ανθρωπάκια” (προς το παρόν κύκλοι) ---
const entities = [];
const ENTITY_R = 22;       // μέγεθος “στόχου”
const BASE_SPEED = 140;    // px/sec
const MAX_ENTITIES = 8;    // ξεκινάμε χαμηλά

function rand(min, max) { return Math.random() * (max - min) + min; }

function spawnEntity() {
  // τυχαίο σημείο μέσα στα όρια
  const x = rand(ENTITY_R, W - ENTITY_R);
  const y = rand(ENTITY_R, H - ENTITY_R);

  // τυχαία διεύθυνση
  const angle = rand(0, Math.PI * 2);
  const speed = BASE_SPEED * rand(0.75, 1.15);

  entities.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: ENTITY_R,
    type: "normal" // αργότερα: shield / spike
  });
}

function resetEntities() {
  entities.length = 0;
  for (let i = 0; i < MAX_ENTITIES; i++) spawnEntity();
}

function update(dt) {
  // κίνηση + αναπήδηση στα όρια (αίσθηση “τρέχει μέσα στην οθόνη”)
  for (const e of entities) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    if (e.x < e.r) { e.x = e.r; e.vx *= -1; }
    if (e.x > W - e.r) { e.x = W - e.r; e.vx *= -1; }
    if (e.y < e.r) { e.y = e.r; e.vy *= -1; }
    if (e.y > H - e.r) { e.y = H - e.r; e.vy *= -1; }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  // φόντο “αρένα”
  ctx.fillStyle = "#151a22";
  ctx.fillRect(0, 0, W, H);

  // ζωγραφίζουμε “στόχους”
  for (const e of entities) {
    // normal = κόκκινο (προς το παρόν)
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fillStyle = (e.type === "normal") ? "#ff3b30" : "#34c759";
    ctx.fill();

    // μικρή “λάμψη” για να φαίνεται πιο game
    ctx.beginPath();
    ctx.arc(e.x - e.r * 0.25, e.y - e.r * 0.25, e.r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.fill();
  }
}

// --- Tap detection ---
function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const clientX = (evt.touches && evt.touches[0]) ? evt.touches[0].clientX : evt.clientX;
  const clientY = (evt.touches && evt.touches[0]) ? evt.touches[0].clientY : evt.clientY;
  return { x: clientX - rect.left, y: clientY - rect.top };
}

function tryHit(x, y) {
  // βρίσκουμε τον “κοντινότερο” στόχο που πατήθηκε
  for (let i = entities.length - 1; i >= 0; i--) {
    const e = entities[i];
    const dx = x - e.x, dy = y - e.y;
    if (dx*dx + dy*dy <= e.r*e.r) {
      // hit
      score += 10;
      scoreEl.textContent = score;

      // μικρό “push” για feedback
      e.vx *= 1.06;
      e.vy *= 1.06;

      return;
    }
  }
}

function onPointerDown(evt) {
  if (!gameRunning) return;
  evt.preventDefault();
  const p = getPointerPos(evt);
  tryHit(p.x, p.y);
}

canvas.addEventListener("mousedown", onPointerDown);
canvas.addEventListener("touchstart", onPointerDown, { passive: false });

// --- Game loop ---
let lastTs = 0;
function loop(ts) {
  if (!gameRunning) return;
  const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0); // clamp για σταθερότητα
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
  scoreEl.textContent = score;
  timeEl.textContent = timeLeft;

  resetEntities();

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

function endRound() {
  gameRunning = false;
  if (rafId) cancelAnimationFrame(rafId);
  if (timeTimer) clearInterval(timeTimer);

  startBtn.disabled = false;

  alert("Game Over! Score: " + score);
}

startBtn.addEventListener("click", () => {
  if (gameRunning) return;
  startBtn.disabled = true;
  startCountdownThenPlay();
});

// αρχικοποίηση
resize();
draw();
