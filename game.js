import { SoundManager } from "./sound.js";
document.addEventListener("DOMContentLoaded", () => {

/* =====================================================
   SOUND SYSTEM
===================================================== */

const sound = new SoundManager();
sound.init();

const AUDIO_MANIFEST = [
  { name: "tap", url: "assets/audio/tap.mp3" },
  { name: "combo", url: "assets/audio/combo.mp3" },
  { name: "shield", url: "assets/audio/shield.mp3" },
  { name: "spike", url: "assets/audio/spike.mp3" },
  { name: "claim", url: "assets/audio/claim.mp3" },
  { name: "levelup", url: "assets/audio/levelup.mp3" },
  { name: "ambient", url: "assets/audio/ambient.mp3" }
];

sound.loadAll(AUDIO_MANIFEST);

let audioUnlocked = false;

// Mobile unlock
async function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  await sound.unlock();
  sound.startAmbient();
}
   
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
  const rankCarousel = document.getElementById("rankCarousel");
  const rankNameEl = document.getElementById("rankName");
  const rankNextEl = document.getElementById("rankNext");
  const rankProgressFill = document.getElementById("rankProgressFill");
  const rankProgressText = document.getElementById("rankProgressText");
  const closeMilestones = document.getElementById("closeMilestones");
  const endPanel = document.getElementById("endPanel");
  const endScore = document.getElementById("endScore");
  const endGems = document.getElementById("endGems");
  const endXP = document.getElementById("endXP");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const doubleBtn = document.getElementById("doubleBtn");
  const backMenuBtn = document.getElementById("backMenuBtn");
  const soundToggleBtn = document.getElementById("soundToggle");

    /* =====================================================
     PARALLAX BACKGROUND (Visual Only)
  ===================================================== */

  const bgFar = document.querySelector(".bg-far");
  const bgMid = document.querySelector(".bg-mid");
  const bgNear = document.querySelector(".bg-near");

  function applyParallax(normX, normY) {
    if (!bgFar) return;

    bgFar.style.transform  = `translate(${normX * 8}px, ${normY * 8}px)`;
    bgMid.style.transform  = `translate(${normX * 16}px, ${normY * 16}px)`;
    bgNear.style.transform = `translate(${normX * 28}px, ${normY * 28}px)`;
  }

  // Desktop mouse
  document.addEventListener("mousemove", (e) => {
    const x = (e.clientX / window.innerWidth - 0.5);
    const y = (e.clientY / window.innerHeight - 0.5);
    applyParallax(x, y);
  });

  // Mobile touch
  document.addEventListener("touchmove", (e) => {
    if (!e.touches || !e.touches[0]) return;
    const touch = e.touches[0];
    const x = (touch.clientX / window.innerWidth - 0.5);
    const y = (touch.clientY / window.innerHeight - 0.5);
    applyParallax(x, y);
  }, { passive: true });

  /* =====================================================
     CONFIG
  ===================================================== */

  const Config = {
    roundSeconds: 45,

    entityRadius: 22,
    baseSpeed: 140,
    maxEntities: 8,

    comboTimeoutSec: 1.2,

    // spawn rate by difficulty
    spawnIntervalMs: {
      easy: 700,
      medium: 500,
      hard: 350
    },

    // spike
    freezeMs: 800,
    spikeTimePenaltySec: 2,

    // economy/xp
    gemsPerScore: 100,
    xpScoreDiv: 10,
    xpDifficultyBonus: { easy: 0.7, medium: 1.0, hard: 1.4 },

    // daily/ad reward
    DAILY_REWARD_KEY: "squeeze_daily_last_claim",
    STREAK_KEY: "squeeze_daily_streak",
    AD_REWARD_AMOUNT: 60,
    AD_DAILY_KEY: "squeeze_ad_daily_count",
    AD_DAILY_DATE_KEY: "squeeze_ad_daily_date",
    AD_DAILY_LIMIT: 5,
    STREAK_REWARDS: [50, 60, 75, 90, 110, 150, 250],

    // ranks/rewards
    CLAIMED_KEY: "squeeze_rank_rewards_claimed",

    // countdown
    countdownStart: 3,
    countdownStepMs: 700
  };

  /* =====================================================
     STATE
  ===================================================== */

  const State = {
    W: 0,
    H: 0,

    // game
    score: 0,
    timeLeft: Config.roundSeconds,
    gameRunning: false,
    difficulty: null,

    // combo
    combo: 0,
    comboTimer: 0,

    // spawn
    spawnTimerMs: 0,
    spawnIntervalMs: Config.spawnIntervalMs.medium,

    // status
    playerFrozen: false,

    // visuals
    entities: [],
    hitEffects: [],
    floatingTexts: [],

    // screen shake
    shakeTime: 0,
    shakeStrength: 0,

    // economy
    totalGems: parseInt(localStorage.getItem("squeeze_gems")) || 0,
    earnedGems: 0,

    // xp
    playerLevel: parseInt(localStorage.getItem("squeeze_level")) || 1,
    currentXP: parseInt(localStorage.getItem("squeeze_xp")) || 0,

    // rank rewards claimed (store claimed reward levels)
    claimedRankRewards:
    JSON.parse(localStorage.getItem(Config.CLAIMED_KEY)) || [],

    // theme
    currentThemeKey: "classic",

    // double reward system
    roundsSinceDouble: 0,
    doubleReady: false, 
   
     timers: {
      rafId: null,
      timeTimer: null,
      freezeTimer: null,
      countdownTimer: null
    }
  };

  /* =====================================================
     THEMES
  ===================================================== */

  const themes = {
    classic: {
      name: "classic",
      bg: "#151a22",
      normal: "#ff3b30",
      shield: "#ffd60a",
      spike: "#ff006e",
      price: 0,
      unlocked: true
    },
    zombie: {
      name: "zombie",
      bg: "#0f1a12",
      normal: "#4caf50",
      shield: "#8bc34a",
      spike: "#2e7d32",
      price: 300,
      unlocked: false
    }
  };

  function getCurrentTheme() {
    return themes[State.currentThemeKey] || themes.classic;
  }

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
    saveClaimedRankRewards() {
    localStorage.setItem(
     Config.CLAIMED_KEY,
     JSON.stringify(State.claimedRankRewards)
      );
     },
     
    loadThemeUnlocks() {
      const saved = JSON.parse(localStorage.getItem("squeeze_theme_unlocks"));
      if (!saved) return;
      for (let key in saved) {
        if (themes[key]) themes[key].unlocked = saved[key];
      }
    },
    saveThemeUnlocks() {
      const data = {};
      for (let key in themes) data[key] = themes[key].unlocked;
      localStorage.setItem("squeeze_theme_unlocks", JSON.stringify(data));
    },
    loadEquippedTheme() {
      const saved = localStorage.getItem("squeeze_equipped_theme");
      if (saved && themes[saved] && themes[saved].unlocked) {
        State.currentThemeKey = saved;
      } else {
        State.currentThemeKey = "classic";
      }
    },
    saveEquippedTheme(themeKey) {
      localStorage.setItem("squeeze_equipped_theme", themeKey);
    }
  };

  /* =====================================================
     UI HELPERS
  ===================================================== */

  const UI = {
    setScore(v) {
      scoreEl.textContent = v;
    },
    setTime(v) {
      timeEl.textContent = v;
    },
    setGems(v) {
      gemCount.textContent = v;
    },
    setFrozen(isFrozen) {
      canvas.style.filter = isFrozen ? "grayscale(1) blur(2px)" : "none";
    },
    show(el) {
      el.classList.remove("hidden");
    },
    hide(el) {
      el.classList.add("hidden");
    },
    toast(text) {
      showToast(text);
    }
  };

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
     TOAST
  ===================================================== */

  function showToast(text) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add("show"), 10);

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  /* =====================================================
   XP – INFINITE SCALING SYSTEM
  ===================================================== */

  function xpNeededForLevel(level) {
  const XP_BASE = 60;
  const XP_LINEAR = 18;
  const XP_POW = 1.35;
  const XP_QUAD = 7;

  const MAX_LEVEL = 10000;
  const l = Math.max(1, Math.min(level, MAX_LEVEL));

  const powPart = Math.pow(l, XP_POW) * XP_QUAD;
  return Math.floor(XP_BASE + (l * XP_LINEAR) + powPart);
}

function updateXPUI() {
  levelDisplay.textContent = State.playerLevel;
  const percent = Math.min(
  1,
  State.currentXP / xpNeededForLevel(State.playerLevel)
);
  xpFill.style.width = percent * 100 + "%";
}

function addXP(amount) {
  State.currentXP += amount;

  let safetyCounter = 0;
  const MAX_LEVEL_UPS_PER_CALL = 50; // cap ασφαλείας

  while (
    State.currentXP >= xpNeededForLevel(State.playerLevel) &&
    safetyCounter < MAX_LEVEL_UPS_PER_CALL
  ) {
    State.currentXP -= xpNeededForLevel(State.playerLevel);
    State.playerLevel++;
    safetyCounter++;

    sound._playBuffer("levelup", { volume: 1 });
  }

  if (safetyCounter >= MAX_LEVEL_UPS_PER_CALL) {
    console.warn("XP loop safety cap triggered");
  }

  UI.toast("LEVEL UP! 🔥 Level " + State.playerLevel);

  Storage.saveXP();
  updateXPUI();
}

  /* =====================================================
     RANDOM / SPAWN
  ===================================================== */

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function getRandomType() {
    const r = Math.random();

    if (State.difficulty === "easy") return "normal";
    if (State.difficulty === "medium") return r < 0.7 ? "normal" : "shield";

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
    const R = Config.entityRadius;

    if (side === 0) {
      x = -R;
      y = rand(R, State.H - R);
      vx = speed;
      vy = rand(-20, 20);
    } else if (side === 1) {
      x = State.W + R;
      y = rand(R, State.H - R);
      vx = -speed;
      vy = rand(-20, 20);
    } else if (side === 2) {
      x = rand(R, State.W - R);
      y = -R;
      vx = rand(-20, 20);
      vy = speed;
    } else {
      x = rand(R, State.W - R);
      y = State.H + R;
      vx = rand(-20, 20);
      vy = -speed;
    }

    State.entities.push({
      x,
      y,
      vx,
      vy,
      r: R,
      type: getRandomType(),
      hit: false,
      hitTimer: 0,
      walkPhase: Math.random() * Math.PI * 2,
      spawnScale: 0,
    });
  }

  function resetEntities() {
    State.entities.length = 0;
  }

  /* =====================================================
     SHOP / ECONOMY
  ===================================================== */

   /* =====================================================
   AD DAILY CAP SYSTEM
===================================================== */

function getTodayDateString() {
  const d = new Date();
  return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}

function getAdWatchCount() {
  const today = getTodayDateString();
  const savedDate = localStorage.getItem(Config.AD_DAILY_DATE_KEY);

  if (savedDate !== today) {
    localStorage.setItem(Config.AD_DAILY_DATE_KEY, today);
    localStorage.setItem(Config.AD_DAILY_KEY, "0");
    return 0;
  }

  return parseInt(localStorage.getItem(Config.AD_DAILY_KEY)) || 0;
}

function incrementAdWatchCount() {
  const today = getTodayDateString();
  localStorage.setItem(Config.AD_DAILY_DATE_KEY, today);

  let count = getAdWatchCount();
  count++;
  localStorage.setItem(Config.AD_DAILY_KEY, count);
}
  function canClaimDailyReward() {
    const lastClaim = localStorage.getItem(Config.DAILY_REWARD_KEY);
    if (!lastClaim) return true;
    return Date.now() - parseInt(lastClaim) >= 24 * 60 * 60 * 1000;
  }

  function claimDailyReward() {
    if (!canClaimDailyReward()) return;
    sound._playBuffer("claim", { volume: 0.8 });
    let streak = parseInt(localStorage.getItem(Config.STREAK_KEY)) || 0;
    streak++;
    if (streak > 7) streak = 1;

    const reward = Config.STREAK_REWARDS[streak - 1];
    State.totalGems += reward;

    Storage.saveGems();
    localStorage.setItem(Config.DAILY_REWARD_KEY, Date.now());
    localStorage.setItem(Config.STREAK_KEY, streak);

    UI.toast("Day " + streak + " Reward: +" + reward + " 💎");
    renderShop();
  }

 function watchAdReward() {
  const count = getAdWatchCount();

  if (count >= Config.AD_DAILY_LIMIT) {
    UI.toast("Daily Ad Limit Reached 🚫");
    return;
  }

  UI.toast("Watching Ad...");

  setTimeout(() => {
    State.totalGems += Config.AD_REWARD_AMOUNT;
    Storage.saveGems();

    incrementAdWatchCount();

    UI.toast("Ad Reward: +" + Config.AD_REWARD_AMOUNT + " 💎");
    renderShop();
  }, 1500);
}

  function buyTheme(themeKey) {
    const theme = themes[themeKey];
    if (!theme) return;

    if (theme.unlocked) return;

    if (State.totalGems >= theme.price) {
      State.totalGems -= theme.price;
      theme.unlocked = true;
      Storage.saveThemeUnlocks();
      Storage.saveGems();
      UI.toast("Purchased: " + theme.name + " ✅");
    } else {
      UI.toast("Not enough gems 💎");
    }
  }

  function equipTheme(themeKey) {
    const theme = themes[themeKey];
    if (!theme) return;

    if (!theme.unlocked) {
      UI.toast("Theme locked 🔒");
      return;
    }

    State.currentThemeKey = themeKey;
    Storage.saveEquippedTheme(themeKey);
    UI.toast("Equipped: " + theme.name + " ✅");
  }

  function renderShop() {
    UI.setGems(State.totalGems);
    themeList.innerHTML = "";

    // ===== DAILY + STREAK =====
    const dailyDiv = document.createElement("div");
    dailyDiv.className = "theme-item";

    const streak = parseInt(localStorage.getItem(Config.STREAK_KEY)) || 0;

    const dailyText = document.createElement("strong");
    dailyText.textContent = "Daily Reward (Day " + (streak || 1) + ")";

    const dailyBtn = document.createElement("button");

    if (canClaimDailyReward()) {
      dailyBtn.textContent = "Claim 💎";
      dailyBtn.onclick = claimDailyReward;
    } else {
      dailyBtn.textContent = "Come back tomorrow";
      dailyBtn.disabled = true;
    }

    dailyDiv.appendChild(dailyText);
    dailyDiv.appendChild(dailyBtn);
    themeList.appendChild(dailyDiv);

    // ===== AD REWARD =====
    const adDiv = document.createElement("div");
    adDiv.className = "theme-item";

    const adText = document.createElement("strong");
    adText.textContent = "Watch Ad";

    const adBtn = document.createElement("button");

const adCount = getAdWatchCount();
const remaining = Config.AD_DAILY_LIMIT - adCount;

if (remaining > 0) {
  adBtn.textContent = "+" + Config.AD_REWARD_AMOUNT + " 💎 (" + remaining + " left)";
  adBtn.onclick = watchAdReward;
} else {
  adBtn.textContent = "No Ads Left Today";
  adBtn.disabled = true;
}

    adDiv.appendChild(adText);
    adDiv.appendChild(adBtn);
    themeList.appendChild(adDiv);

    // ===== THEMES =====
    for (let key in themes) {
      const theme = themes[key];

      const item = document.createElement("div");
      item.className = "theme-item";

      const name = document.createElement("strong");
      name.textContent = theme.name;

      const btn = document.createElement("button");

      if (!theme.unlocked) {
        btn.textContent = "Buy (" + theme.price + " 💎)";
        btn.onclick = () => {
          buyTheme(key);
          renderShop();
        };
      } else if (State.currentThemeKey === key) {
        btn.textContent = "Equipped";
        btn.disabled = true;
      } else {
        btn.textContent = "Equip";
        btn.onclick = () => {
          equipTheme(key);
          renderShop();
        };
      }

      item.appendChild(name);
      item.appendChild(btn);
      themeList.appendChild(item);
    }
  }

/* =====================================================
   RANKS + RANK REWARDS SYSTEM
===================================================== */

const RANKS = [
  { key: "lapiz",    name: "Lapiz Finger",    min: 1,    max: 50 },
  { key: "iron",     name: "Iron Finger",     min: 50,   max: 120 },
  { key: "bronze",   name: "Bronze Finger",   min: 120,  max: 250 },
  { key: "silver",   name: "Silver Finger",   min: 250,  max: 450 },
  { key: "gold",     name: "Gold Finger",     min: 450,  max: 700 },
  { key: "platinum", name: "Platinum Finger", min: 700,  max: 1000 },
  { key: "diamond",  name: "Diamond Finger",  min: 1000, max: 1500 },
  { key: "emerald",  name: "Emerald Finger",  min: 1500, max: 2200 },
  { key: "obsidian", name: "Obsidian Finger", min: 2200, max: Infinity }
];

function getCurrentRank(level) {
  return RANKS.find(r => level >= r.min && level < r.max) || RANKS[0];
}

function getRankProgress(level) {
  const r = getCurrentRank(level);
  if (!isFinite(r.max)) return 1; // Obsidian: no "next"
  const range = Math.max(1, r.max - r.min);
  return Math.max(0, Math.min(1, (level - r.min) / range));
}

function getNextRank(level) {
  const r = getCurrentRank(level);
  const idx = RANKS.findIndex(x => x.key === r.key);
  return RANKS[idx + 1] || null;
}

// Generate a small set of reward checkpoints inside the current rank.
// NOTE: We return "absolute levels" (real playerLevel), όχι stages.
function generateRankRewards(rank) {
  // Obsidian has no max -> choose a "window" of 250 levels for rewards
  const effectiveMax = isFinite(rank.max) ? rank.max : (rank.min + 250);
  const total = Math.max(1, effectiveMax - rank.min);

  // helper: turn % into absolute level (rounded) and clamp
  const at = (p) => {
    const lvl = rank.min + Math.floor(total * p);
    // clamp within [min, effectiveMax]
    return Math.max(rank.min, Math.min(effectiveMax, lvl));
  };

  return [
    { level: at(0.10), type: "gems", amount: 10 },
    { level: at(0.20), type: "gems", amount: 20 },
    { level: at(0.35), type: "gems", amount: 30 },

    { level: at(0.50), type: "humanoidSkin" },      // 1/3 idea (cosmetic)
    { level: at(0.70), type: "backgroundSkin" },    // 2/3
    { level: at(1.00), type: "fingerSkin" }         // 3/3 (prestige)
  ];
}

function rewardLabel(reward) {
  if (reward.type === "gems") return `+${reward.amount} 💎`;
  if (reward.type === "humanoidSkin") return `Humanoid Skin (Rank)`;
  if (reward.type === "backgroundSkin") return `Background Skin (Rank)`;
  if (reward.type === "fingerSkin") return `Finger Skin (Rank)`;
  return reward.type;
}

function claimRankReward(reward) {
  const lvl = reward.level;
  if (State.claimedRankRewards.includes(lvl)) return;
  if (State.playerLevel < lvl) return;

  // apply
  if (reward.type === "gems") {
    State.totalGems += reward.amount;
    Storage.saveGems();
  } else {
    // TODO later: unlock cosmetics in your cosmetics system
    // for now we just toast
  }

  State.claimedRankRewards.push(lvl);
  Storage.saveClaimedRankRewards();

  sound._playBuffer("claim", { volume: 0.8 });
  UI.toast("Reward Claimed! 🎉");

  renderRankScreen(); // refresh
}
function renderRankCarousel() {
  const carousel = document.getElementById("rankCarousel");
  if (!carousel) return;

  carousel.innerHTML = "";

  const currentRank = getCurrentRank(State.playerLevel);
  const progress = getRankProgress(State.playerLevel);

  RANKS.forEach(rank => {
    const card = document.createElement("div");
    card.className = "rank-card";

    if (rank.key === currentRank.key) {
      card.classList.add("current");
    }

    if (State.playerLevel < rank.min) {
      card.classList.add("locked");
    }

    card.innerHTML = `
      <div style="font-weight:700">${rank.name}</div>
      <div style="font-size:12px;opacity:.7">
        ${rank.min}${isFinite(rank.max) ? " - " + rank.max : "+"}
      </div>
    `;

    carousel.appendChild(card);

    if (rank.key === currentRank.key) {
      setTimeout(() => {
        card.scrollIntoView({ behavior:"smooth", inline:"center" });
      }, 50);
    }
  });

  const fill = document.getElementById("rankProgressFill");
  const text = document.getElementById("rankProgressText");

  const percent = Math.max(0, Math.min(100, Math.floor(progress * 100)));
  fill.style.width = percent + "%";
  text.textContent = percent + "%";
}
   
function renderRankScreen() {
  renderRankCarousel();
  milestoneList.innerHTML = "";

  const rank = getCurrentRank(State.playerLevel);
  const rewards = generateRankRewards(rank);

  rewards.forEach(rw => {
    const claimed = State.claimedRankRewards.includes(rw.level);
    const unlocked = State.playerLevel >= rw.level;

    const card = document.createElement("div");
    card.className = "milestone-card";

    if (claimed) card.classList.add("completed");
    else if (unlocked) card.classList.add("current");

    card.innerHTML = `
      <div><strong>Level ${rw.level}</strong></div>
      <div class="milestone-reward">${rewardLabel(rw)}</div>
    `;

    if (unlocked && !claimed) {
      const btn = document.createElement("button");
      btn.className = "claim-btn";
      btn.textContent = "Claim";
      btn.onclick = () => claimRankReward(rw);
      card.appendChild(btn);
    }

    milestoneList.appendChild(card);
  });
}

function openRanks() {
  renderRankScreen();
}

  /* =====================================================
     VFX
  ===================================================== */

  function comboBreakFX() {
    State.hitEffects.push({
      x: State.W / 2,
      y: 60,
      radius: 20,
      alpha: 0.6
    });
  }

  function activateFreeze() {
    State.playerFrozen = true;
    UI.setFrozen(true);

    if (State.timers.freezeTimer) clearTimeout(State.timers.freezeTimer);

    State.timers.freezeTimer = setTimeout(() => {
      State.playerFrozen = false;
      UI.setFrozen(false);
    }, Config.freezeMs);
  }

  /* =====================================================
     UPDATE / DRAW
  ===================================================== */

  function update(dt) {
    // combo decay
    if (State.combo > 0) {
      State.comboTimer -= dt;
      if (State.comboTimer <= 0) {
        State.combo = 0;
        State.comboTimer = 0;
      }
    }

    // movement + removal
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
      e.walkPhase += dt * 8;
      e.y += e.vy * dt;

      // spawn scale animation
      if (e.spawnScale < 1) {
        let scale = e.spawnScale !== undefined ? e.spawnScale : 1;

      if (e.hit) {
        scale = 1 + e.hitTimer * 6;
        }
      }

      if (
        e.x < -e.r - 20 ||
        e.x > State.W + e.r + 20 ||
        e.y < -e.r - 20 ||
        e.y > State.H + e.r + 20
      ) {
        State.entities.splice(i, 1);
        continue;
      }
    }

    // spawn rhythm (cap)
    State.spawnTimerMs += dt * 1000;
    if (State.spawnTimerMs >= State.spawnIntervalMs) {
      State.spawnTimerMs = 0;
      if (State.entities.length < Config.maxEntities) spawnEntity();
    }

    // guarantee at least 1 normal (ignoring hit)
    const normalCount = State.entities.filter((e) => e.type === "normal" && !e.hit).length;
    if (normalCount === 0 && State.entities.length > 0) {
      const candidates = State.entities.filter((e) => !e.hit);
      if (candidates.length > 0) {
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        pick.type = "normal";
      }
    }

    // hit rings update
    for (let i = State.hitEffects.length - 1; i >= 0; i--) {
      const h = State.hitEffects[i];
      h.radius += 200 * dt;
      h.alpha -= 2 * dt;
      if (h.alpha <= 0) State.hitEffects.splice(i, 1);
    }

    // floating texts update
    for (let i = State.floatingTexts.length - 1; i >= 0; i--) {
      const f = State.floatingTexts[i];
      f.y -= 60 * dt;
      f.alpha -= 1.5 * dt;
      if (f.alpha <= 0) State.floatingTexts.splice(i, 1);
    }
    // update screen shake
if (State.shakeTime > 0) {
  State.shakeTime -= dt;

  // smooth decay
  State.shakeStrength *= 0.92;

  if (State.shakeTime <= 0) {
    State.shakeTime = 0;
    State.shakeStrength = 0;
  }
}
  }

  function draw() {
    const theme = getCurrentTheme();

    ctx.clearRect(0, 0, State.W, State.H);
    // apply screen shake
    let offsetX = 0;
    let offsetY = 0;

    if (State.shakeTime > 0) {
      offsetX = (Math.random() - 0.5) * State.shakeStrength;
      offsetY = (Math.random() - 0.5) * State.shakeStrength;
}

ctx.save();
ctx.translate(offsetX, offsetY);
    // background
    ctx.fillStyle = theme.bg;
    ctx.fillRect(0, 0, State.W, State.H);

    // entities (humanoid)
    for (const e of State.entities) {
      let scale = 1;
      if (e.hit) scale = 1 + e.hitTimer * 6;

      const bounce = Math.sin(e.walkPhase) * 3;
      const bodyColor = theme[e.type];

      // shadow
     const shadowScale = scale;
const shadowAlpha = 0.25 * shadowScale;

      ctx.beginPath();
      ctx.ellipse(
      e.x,
      e.y + e.r * 0.9,
      e.r * 0.7 * shadowScale,
      e.r * 0.25 * shadowScale,
      0,
      0,
      Math.PI * 2
      );

      ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
      ctx.fill();

      ctx.save();
      ctx.translate(e.x, e.y + bounce);
      ctx.scale(scale, scale);

      // ===== Glow Effect =====
      if (e.type === "shield") {
      ctx.shadowColor = "#ffd60a";
      ctx.shadowBlur = 15;
      } 
      else if (e.type === "spike") {
      ctx.shadowColor = "#ff0033";
      ctx.shadowBlur = 18;
      }
      else {
      ctx.shadowColor = "rgba(255,255,255,0.15)";
      ctx.shadowBlur = 6;
      }

      // body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();

      // roundRect fallback if needed
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(-8, -2, 16, 20, 4);
      } else {
        // simple fallback: draw rounded-ish rect
        ctx.rect(-8, -2, 16, 20);
      }
      ctx.fill();

      // head
      ctx.beginPath();
      ctx.arc(0, -10, 7, 0, Math.PI * 2);
      ctx.fill();

      // zombie eyes
      if (theme.name === "zombie") {
        ctx.fillStyle = "black";
        ctx.fillRect(-3, -12, 2, 2);
        ctx.fillRect(1, -12, 2, 2);
      }

      // legs
      ctx.fillStyle = bodyColor;
      const legOffset = Math.sin(e.walkPhase) * 4;

      ctx.beginPath();
      ctx.rect(-5, 18, 4, 8 + legOffset);
      ctx.rect(1, 18, 4, 8 - legOffset);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // hit rings
    for (const h of State.hitEffects) {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${h.alpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // floating texts
    ctx.textAlign = "center";
    ctx.font = "bold 18px Arial";

    for (const f of State.floatingTexts) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* =====================================================
     INPUT / HIT DETECTION
  ===================================================== */

  function getPointerPos(evt) {
    const rect = canvas.getBoundingClientRect();
    const clientX = evt.touches && evt.touches[0] ? evt.touches[0].clientX : evt.clientX;
    const clientY = evt.touches && evt.touches[0] ? evt.touches[0].clientY : evt.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function tryHit(x, y) {
    if (State.playerFrozen) return;

    for (let i = State.entities.length - 1; i >= 0; i--) {
      const e = State.entities[i];

      if (e.hit) continue;

      const dx = x - e.x;
      const dy = y - e.y;

      if (dx * dx + dy * dy <= e.r * e.r) {
        // NORMAL
        if (e.type === "normal") {
          State.combo++;
          sound.tap(Math.min(State.combo / 20, 1));
          if (State.combo > 1) sound.combo(State.combo);
          State.comboTimer = Config.comboTimeoutSec;

          let multiplier = 1;
          if (State.combo >= 20) multiplier = 4;
          else if (State.combo >= 10) multiplier = 3;
          else if (State.combo >= 5) multiplier = 2;

          const levelBonusMultiplier = 1 + (State.playerLevel - 1) * 0.01;
          const gained = Math.floor(10 * multiplier * levelBonusMultiplier);

          State.score += gained;
          UI.setScore(State.score);

          State.floatingTexts.push({
            x: e.x,
            y: e.y,
            text: multiplier > 1 ? `+${gained} x${multiplier}` : `+${gained}`,
            alpha: 1,
            color: multiplier > 1 ? "#00ffcc" : "#ffffff"
          });

          State.hitEffects.push({
            x: e.x,
            y: e.y,
            radius: 10,
            alpha: 1
          });

          e.hit = true;
          e.hitTimer = 0.12;
          return;
        }

        // SHIELD -> break combo (no central effect)
        if (e.type === "shield") {
          sound._playBuffer("shield", { volume: 0.6 });
          State.combo = 0;
          State.comboTimer = 0;

        // μικρό hit flash μόνο στο entity
          State.hitEffects.push({
          x: e.x,
          y: e.y,
          radius: 12,
          alpha: 0.8
           });
          return;
        }

        // SPIKE -> break combo + freeze + -2 sec
          if (e.type === "spike") {
          sound._playBuffer("spike", { volume: 0.8 });
          State.combo = 0;
          State.comboTimer = 0;

        // screen shake
          State.shakeTime = 0.25;     // duration in seconds
          State.shakeStrength = 14;   // intensity

          activateFreeze();

          State.timeLeft = Math.max(0, State.timeLeft - Config.spikeTimePenaltySec);
          UI.setTime(State.timeLeft);

          if (State.timeLeft <= 0) {
            endRound();
            return;
          }
          return;
        }
      }
    }
  }

  function onPointerDown(evt) {
    if (!State.gameRunning) return;
    evt.preventDefault();
    const p = getPointerPos(evt);
    tryHit(p.x, p.y);
  }

  canvas.addEventListener("mousedown", onPointerDown);
  canvas.addEventListener("touchstart", onPointerDown, { passive: false });

  /* =====================================================
     LOOP
  ===================================================== */

  let lastTs = 0;

  function loop(ts) {
    if (!State.gameRunning) return;

    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0);
    lastTs = ts;

    update(dt);
    draw();

    State.timers.rafId = requestAnimationFrame(loop);
  }

  /* =====================================================
     ROUND FLOW
  ===================================================== */

  function startCountdownThenPlay() {
    UI.show(countdownEl);

    let c = Config.countdownStart;
    countdownEl.textContent = c;

    if (State.timers.countdownTimer) clearInterval(State.timers.countdownTimer);

    State.timers.countdownTimer = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(State.timers.countdownTimer);
        State.timers.countdownTimer = null;
        UI.hide(countdownEl);
        beginRound();
        return;
      }
      countdownEl.textContent = c;
    }, Config.countdownStepMs);
  }

  function beginRound() {
    State.score = 0;
    State.timeLeft = Config.roundSeconds;

    State.combo = 0;
    State.comboTimer = 0;

    State.spawnTimerMs = 0;

    UI.setScore(State.score);
    UI.setTime(State.timeLeft);

    resetEntities();
    State.hitEffects.length = 0;
    State.floatingTexts.length = 0;

    // difficulty spawn rate
    State.spawnIntervalMs = Config.spawnIntervalMs[State.difficulty] || Config.spawnIntervalMs.medium;

    State.gameRunning = true;

    lastTs = 0;
    if (State.timers.rafId) cancelAnimationFrame(State.timers.rafId);
    State.timers.rafId = requestAnimationFrame(loop);

    if (State.timers.timeTimer) clearInterval(State.timers.timeTimer);
    State.timers.timeTimer = setInterval(() => {
      State.timeLeft--;
      UI.setTime(State.timeLeft);
      if (State.timeLeft <= 0) endRound();
    }, 1000);
  }

  function calculateGems(score) {
  let base = Math.floor(score / Config.gemsPerScore);

  let difficultyMultiplier = 1;
  if (State.difficulty === "easy") difficultyMultiplier = 0.9;
  if (State.difficulty === "medium") difficultyMultiplier = 1.0;
  if (State.difficulty === "hard") difficultyMultiplier = 1.25;

  return Math.floor(base * difficultyMultiplier);
}

  function endRound() {
    State.gameRunning = false;

    if (State.timers.rafId) cancelAnimationFrame(State.timers.rafId);
    if (State.timers.timeTimer) clearInterval(State.timers.timeTimer);

    State.timers.rafId = null;
    State.timers.timeTimer = null;
    // ===== Double Reward Progress Logic =====
    if (!State.doubleReady) {
    State.roundsSinceDouble++;

    if (State.roundsSinceDouble >= 8) {
    State.doubleReady = true;
     }
    }
    State.earnedGems = calculateGems(State.score);
    State.totalGems += State.earnedGems;
    Storage.saveGems();

    let difficultyXPBonus = 1;
    if (State.difficulty === "easy") difficultyXPBonus = Config.xpDifficultyBonus.easy;
    if (State.difficulty === "medium") difficultyXPBonus = Config.xpDifficultyBonus.medium;
    if (State.difficulty === "hard") difficultyXPBonus = Config.xpDifficultyBonus.hard;

    const xpEarned = Math.floor((State.score / Config.xpScoreDiv) * difficultyXPBonus);
    addXP(xpEarned);

    startBtn.disabled = false;

    // Fill summary panel
    endScore.textContent = State.score;
    endGems.textContent = State.earnedGems;
    endXP.textContent = xpEarned;
    if (!State.doubleReady) {
  const remaining = 8 - State.roundsSinceDouble;
  console.log("Rounds to x2:", remaining);
}
    UI.show(endPanel);
     // ===== Double Button UI Logic =====
const adCount = getAdWatchCount();
const adsRemaining = Config.AD_DAILY_LIMIT - adCount;

if (State.doubleReady && adsRemaining > 0) {
  doubleBtn.classList.remove("hidden");
  doubleBtn.textContent = "x2 Gems (" + adsRemaining + " left)";
} else {
  doubleBtn.classList.add("hidden");
}
  }

  /* =====================================================
     EVENTS - DIFFICULTY
  ===================================================== */

  levelButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      State.difficulty = btn.dataset.level;

      levelButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

   

  /* =====================================================
     EVENTS - START
  ===================================================== */

  startBtn.addEventListener("click", async () => {
    if (!State.difficulty) return;
    levelSelect.classList.add("hidden");

    if (State.gameRunning) return;
    startBtn.disabled = true;

    if (!sound.unlocked) {
    await sound.unlock();
}

sound.startAmbient();

startCountdownThenPlay();
  });

  /* =====================================================
     EVENTS - SHOP
  ===================================================== */

  shopBtn.addEventListener("click", () => {
    renderShop();
    UI.show(shopOverlay);
    UI.show(shopPanel);
  });

  closeShop.addEventListener("click", () => {
    UI.hide(shopOverlay);
    UI.hide(shopPanel);
  });

  shopOverlay.addEventListener("click", () => {
    UI.hide(shopOverlay);
    UI.hide(shopPanel);
  });

  /* =====================================================
     EVENTS - MILESTONES
  ===================================================== */

  milestonesBtn.addEventListener("click", () => {
  openRanks();
  UI.show(milestoneScreen);
});

  closeMilestones.addEventListener("click", () => {
    UI.hide(milestoneScreen);
  });
  /* =====================================================
     EVENTS - END PANEL
  ===================================================== */
  doubleBtn.addEventListener("click", () => {
  const adCount = getAdWatchCount();

  if (adCount >= Config.AD_DAILY_LIMIT) {
    UI.toast("Daily Ad Limit Reached 🚫");
    return;
  }

  UI.toast("Watching Ad...");

  setTimeout(() => {
    State.totalGems += State.earnedGems;
    Storage.saveGems();

    incrementAdWatchCount();

    State.doubleReady = false;
    State.roundsSinceDouble = 0;

    UI.toast("Double Reward Applied! 💎💎");
    doubleBtn.classList.add("hidden");
    UI.setGems(State.totalGems);

  }, 1500);
});
   
   playAgainBtn.addEventListener("click", () => {
     UI.hide(endPanel);
  startCountdownThenPlay();
  });

  backMenuBtn.addEventListener("click", () => {
  UI.hide(endPanel);
  levelSelect.classList.remove("hidden");
  startBtn.disabled = false;
  });

   /* =====================================================
     EVENTS - SOUND
  ===================================================== */ 
  soundToggleBtn.addEventListener("click", async () => {
  const newState = !sound.isEnabled();
  sound.setEnabled(newState);

  soundToggleBtn.textContent = newState ? "🔊" : "🔇";

  if (newState) {
    if (!sound.unlocked) {
      await sound.unlock();
    }
    if (State.gameRunning) {
      sound.startAmbient();
    }
  }
});
   
  /* =====================================================
     DEBUG TOGGLE THEME
  ===================================================== */

  window.addEventListener("keydown", (e) => {
    if (e.key === "t") {
      State.currentThemeKey = State.currentThemeKey === "classic" ? "zombie" : "classic";
    }
  });

  /* =====================================================
     INIT
  ===================================================== */

  Storage.loadThemeUnlocks();
  Storage.loadEquippedTheme();

  UI.setGems(State.totalGems);
  updateXPUI();

   // 🔊 RESTORE SOUND STATE
const savedSound = localStorage.getItem("squeeze_sound");

if (savedSound === "off") {
  sound.setEnabled(false);
  soundToggleBtn.textContent = "🔇";
} else {
  soundToggleBtn.textContent = "🔊";
}
   
  resize();
  draw();

   // DEBUG GLOBAL ACCESS
window.__DEBUG = {
  State,
  xpNeededForLevel,
  addXP,
  openRanks,
  getCurrentRank,
  getRankProgress
};
});
