const gamesEl = document.getElementById("games");
const gameCountButtons = Array.from(document.querySelectorAll("#gameCount [data-count]"));
const generateBtn = document.getElementById("generate");
const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const fixedSlots = Array.from(document.querySelectorAll("#fixedSlots [data-slot]"));
const fixedClearBtn = document.getElementById("fixedClear");
const sheetBackdropEl = document.getElementById("numberSheet");
const sheetGridEl = document.getElementById("sheetGrid");
const sheetCloseBtn = document.getElementById("sheetClose");
const sheetDoneBtn = document.getElementById("sheetDone");
const sheetClearSlotBtn = document.getElementById("sheetClearSlot");
const sheetSubEl = document.getElementById("sheetSub");

const STORAGE_KEY = "lotto_history_v1";
const REVEAL_TOTAL_MS = 5000;
const ROLL_TICK_MS = 60;
let selectedGameCount = 5;
let currentGames = [];
let isAnimating = false;
let fixedNumbers = new Array(6).fill(null);
let activeFixedSlot = 0;

const BALL_STYLES = [
  // Same range classes used on dhlottery: 1-10, 11-20, 21-30, 31-40, 41-45.
  { range: [1, 10], className: "num-0n", colors: ["#eec173", "#e08f00"] },
  { range: [11, 20], className: "num-1n", colors: ["#73a8e8", "#0063cc"] },
  { range: [21, 30], className: "num-2n", colors: ["#e98da0", "#d8314f"] },
  { range: [31, 40], className: "num-3n", colors: ["#b0b3bf", "#6e7382"] },
  { range: [41, 45], className: "num-4n", colors: ["#89cb96", "#2c9e44"] },
];

function getBallStyle(num) {
  return BALL_STYLES.find((style) => num >= style.range[0] && num <= style.range[1]);
}

function applyBallAppearance(el, num, rolling = false, extraClasses = []) {
  const style = getBallStyle(num);
  el.className = "ball";
  if (style) {
    el.classList.add(style.className);
  }
  extraClasses.forEach((className) => el.classList.add(className));
  if (rolling) {
    el.classList.add("rolling");
  }
  el.textContent = num;
}

function pickNumbers(fixedNumbers) {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const picks = new Array(6).fill(null);
  const used = new Set();

  fixedNumbers.forEach((num, idx) => {
    if (num === null) return;
    picks[idx] = num;
    used.add(num);
  });

  const available = pool.filter((num) => !used.has(num));

  for (let i = 0; i < picks.length; i += 1) {
    if (picks[i] !== null) continue;
    const idx = Math.floor(Math.random() * available.length);
    picks[i] = available.splice(idx, 1)[0];
  }

  return picks;
}

function createGameSlots(gameCount) {
  gamesEl.innerHTML = "";
  const matrix = [];

  for (let g = 0; g < gameCount; g += 1) {
    const row = document.createElement("div");
    row.className = "game-row";

    const label = document.createElement("div");
    label.className = "game-label";
    label.textContent = `Game ${g + 1}`;

    const ballsWrap = document.createElement("div");
    ballsWrap.className = "game-balls";
    ballsWrap.setAttribute("aria-label", `Game ${g + 1} 번호`);

    const balls = [];
    for (let i = 0; i < 6; i += 1) {
      const span = document.createElement("span");
      span.className = "ball";
      span.textContent = "?";
      ballsWrap.appendChild(span);
      balls.push(span);
    }

    row.appendChild(label);
    row.appendChild(ballsWrap);
    gamesEl.appendChild(row);
    matrix.push(balls);
  }

  return matrix;
}

function rollBall(el, finalNumber, duration) {
  return new Promise((resolve) => {
    const endAt = Date.now() + duration;
    el.classList.remove("pop");

    const timer = setInterval(() => {
      if (Date.now() >= endAt) {
        clearInterval(timer);
        applyBallAppearance(el, finalNumber);
        el.classList.add("pop");
        resolve();
        return;
      }
      const rollingNum = Math.floor(Math.random() * 45) + 1;
      applyBallAppearance(el, rollingNum, true);
    }, ROLL_TICK_MS);
  });
}

async function animateRevealGames(games) {
  const ballMatrix = createGameSlots(games.length);
  const slotDuration = Math.floor(REVEAL_TOTAL_MS / 6);

  for (let pos = 0; pos < 6; pos += 1) {
    const tasks = games.map((nums, gameIndex) =>
      rollBall(ballMatrix[gameIndex][pos], nums[pos], slotDuration),
    );
    await Promise.all(tasks);
  }
}

function renderFixedSlots() {
  fixedSlots.forEach((slotBtn) => {
    const idx = Number(slotBtn.dataset.slot);
    const num = fixedNumbers[idx];

    if (num === null) {
      slotBtn.className = "ball fixed-slot";
      slotBtn.textContent = "?";
      slotBtn.setAttribute("aria-label", `${idx + 1}번째 고정 번호 선택 (비어있음)`);
      return;
    }

    applyBallAppearance(slotBtn, num, false, ["fixed-slot"]);
    slotBtn.setAttribute("aria-label", `${idx + 1}번째 고정 번호 ${num} (탭하여 변경)`);
  });
}

function updateSheetState() {
  const anyOpen = sheetBackdropEl && !sheetBackdropEl.hidden;
  document.body.classList.toggle("has-sheet", Boolean(anyOpen));
}

function closeNumberSheet() {
  if (!sheetBackdropEl) return;
  sheetBackdropEl.hidden = true;
  sheetBackdropEl.setAttribute("aria-hidden", "true");
  updateSheetState();
}

function renderNumberSheet() {
  if (!sheetGridEl) return;

  if (sheetSubEl) {
    sheetSubEl.textContent = `${activeFixedSlot + 1}번째 자리 선택`;
  }

  sheetGridEl.innerHTML = "";
  const selected = fixedNumbers[activeFixedSlot];

  for (let num = 1; num <= 45; num += 1) {
    const btn = document.createElement("button");
    btn.type = "button";
    applyBallAppearance(btn, num, false, ["pick-ball"]);

    const isUsed = fixedNumbers.includes(num) && selected !== num;
    if (isUsed) {
      btn.disabled = true;
    }
    if (selected === num) {
      btn.classList.add("is-selected");
    }

    btn.addEventListener("click", () => {
      fixedNumbers[activeFixedSlot] = num;
      renderFixedSlots();
      closeNumberSheet();
    });

    sheetGridEl.appendChild(btn);
  }
}

function openNumberSheet(slotIndex) {
  activeFixedSlot = slotIndex;
  renderNumberSheet();

  if (!sheetBackdropEl) return;
  sheetBackdropEl.hidden = false;
  sheetBackdropEl.setAttribute("aria-hidden", "false");
  updateSheetState();
}

function loadHistory() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (err) {
    return [];
  }
}

function saveHistory(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function appendGamesToHistory(games) {
  if (!games || games.length === 0) return;
  const items = loadHistory();
  const savedAt = formatDate(new Date());
  for (let i = games.length - 1; i >= 0; i -= 1) {
    items.unshift({
      numbers: games[i],
      savedAt,
    });
  }
  saveHistory(items.slice(0, 20));
}

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";

  if (clearHistoryBtn) {
    clearHistoryBtn.disabled = items.length === 0 || isAnimating;
  }

  if (items.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "저장된 번호가 없습니다.";
    historyList.appendChild(empty);
    return;
  }

  items.forEach((entry) => {
    const li = document.createElement("li");
    const left = document.createElement("span");
    const right = document.createElement("span");

    left.className = "history-numbers";
    right.className = "history-date";
    left.textContent = entry.numbers.join(" ");
    right.textContent = entry.savedAt;

    li.appendChild(left);
    li.appendChild(right);
    historyList.appendChild(li);
  });
}

function formatDate(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function setControlsDisabled(disabled) {
  generateBtn.disabled = disabled;
  gameCountButtons.forEach((btn) => {
    btn.disabled = disabled;
  });
  fixedSlots.forEach((btn) => {
    btn.disabled = disabled;
  });
  if (fixedClearBtn) {
    fixedClearBtn.disabled = disabled;
  }
  if (clearHistoryBtn) {
    clearHistoryBtn.disabled = disabled || loadHistory().length === 0;
  }
}

generateBtn.addEventListener("click", async () => {
  if (isAnimating) return;
  closeNumberSheet();
  const fixed = fixedNumbers.slice();

  isAnimating = true;
  setControlsDisabled(true);

  currentGames = Array.from({ length: selectedGameCount }, () => pickNumbers(fixed));
  await animateRevealGames(currentGames);

  appendGamesToHistory(currentGames);
  renderHistory();

  isAnimating = false;
  setControlsDisabled(false);
});

if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
  });
}

renderHistory();

function setSelectedGameCount(count) {
  selectedGameCount = count;
  gameCountButtons.forEach((btn) => {
    const isActive = Number(btn.dataset.count) === count;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

gameCountButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (isAnimating) return;
    closeNumberSheet();
    setSelectedGameCount(Number(btn.dataset.count));
    // Always reset the view when the user changes game count.
    currentGames = [];
    createGameSlots(selectedGameCount);
  });
});

setSelectedGameCount(selectedGameCount);
createGameSlots(selectedGameCount);

fixedSlots.forEach((slotBtn) => {
  slotBtn.addEventListener("click", () => {
    if (isAnimating) return;
    openNumberSheet(Number(slotBtn.dataset.slot));
  });
});

if (fixedClearBtn) {
  fixedClearBtn.addEventListener("click", () => {
    if (isAnimating) return;
    fixedNumbers = new Array(6).fill(null);
    renderFixedSlots();
    renderNumberSheet();
  });
}

if (sheetCloseBtn) {
  sheetCloseBtn.addEventListener("click", closeNumberSheet);
}

if (sheetDoneBtn) {
  sheetDoneBtn.addEventListener("click", closeNumberSheet);
}

if (sheetClearSlotBtn) {
  sheetClearSlotBtn.addEventListener("click", () => {
    fixedNumbers[activeFixedSlot] = null;
    renderFixedSlots();
    renderNumberSheet();
  });
}

if (sheetBackdropEl) {
  sheetBackdropEl.addEventListener("click", (event) => {
    if (event.target === sheetBackdropEl) {
      closeNumberSheet();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (sheetBackdropEl && !sheetBackdropEl.hidden) {
    closeNumberSheet();
  }
});

renderFixedSlots();
