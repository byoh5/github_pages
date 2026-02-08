const numbersEl = document.getElementById("numbers");
const generateBtn = document.getElementById("generate");
const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
const historyList = document.getElementById("historyList");
const fixedInputs = Array.from(document.querySelectorAll(".fixed-input"));

const STORAGE_KEY = "lotto_history_v1";
const REVEAL_TOTAL_MS = 5000;
const ROLL_TICK_MS = 60;
let currentNumbers = [];
let isAnimating = false;

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

function renderNumbers(nums) {
  numbersEl.innerHTML = "";
  nums.forEach((num) => {
    const span = document.createElement("span");
    span.className = "ball pop";
    span.textContent = num;
    numbersEl.appendChild(span);
  });
}

function createBallSlots() {
  numbersEl.innerHTML = "";
  for (let i = 0; i < 6; i += 1) {
    const span = document.createElement("span");
    span.className = "ball";
    span.textContent = "?";
    numbersEl.appendChild(span);
  }
}

function rollBall(el, finalNumber, duration) {
  return new Promise((resolve) => {
    const endAt = Date.now() + duration;
    el.classList.remove("pop");
    el.classList.add("rolling");

    const timer = setInterval(() => {
      if (Date.now() >= endAt) {
        clearInterval(timer);
        el.textContent = finalNumber;
        el.classList.remove("rolling");
        el.classList.add("pop");
        resolve();
        return;
      }
      el.textContent = Math.floor(Math.random() * 45) + 1;
    }, ROLL_TICK_MS);
  });
}

async function animateReveal(finalNumbers) {
  createBallSlots();
  const balls = Array.from(numbersEl.children);
  const slotDuration = Math.floor(REVEAL_TOTAL_MS / finalNumbers.length);

  for (let i = 0; i < finalNumbers.length; i += 1) {
    await rollBall(balls[i], finalNumbers[i], slotDuration);
  }
}

function parseFixedInputs() {
  const fixed = new Array(6).fill(null);
  const seen = new Set();

  for (let i = 0; i < fixedInputs.length; i += 1) {
    const raw = fixedInputs[i].value.trim();
    if (!raw) continue;
    const num = Number(raw);

    if (!Number.isInteger(num) || num < 1 || num > 45) {
      throw new Error("고정 번호는 1~45 사이의 숫자만 가능합니다.");
    }
    if (seen.has(num)) {
      throw new Error("고정 번호는 서로 다른 숫자여야 합니다.");
    }

    fixed[i] = num;
    seen.add(num);
  }

  return fixed;
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

function renderHistory() {
  const items = loadHistory();
  historyList.innerHTML = "";

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

    left.textContent = entry.numbers.join(" · ");
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
  saveBtn.disabled = disabled || currentNumbers.length !== 6;
  clearBtn.disabled = disabled;
}

generateBtn.addEventListener("click", async () => {
  if (isAnimating) return;
  let fixed;

  try {
    fixed = parseFixedInputs();
  } catch (err) {
    alert(err.message);
    return;
  }

  isAnimating = true;
  setControlsDisabled(true);

  currentNumbers = pickNumbers(fixed);
  await animateReveal(currentNumbers);

  isAnimating = false;
  saveBtn.disabled = false;
  setControlsDisabled(false);
});

saveBtn.addEventListener("click", () => {
  if (currentNumbers.length !== 6) return;
  const items = loadHistory();
  items.unshift({
    numbers: currentNumbers,
    savedAt: formatDate(new Date()),
  });
  saveHistory(items.slice(0, 20));
  renderHistory();
});

clearBtn.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
});

renderHistory();
