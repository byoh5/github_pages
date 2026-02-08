const numbersEl = document.getElementById("numbers");
const generateBtn = document.getElementById("generate");
const copyNumbersImageBtn = document.getElementById("copyNumbersImage");
const copyPanelImageBtn = document.getElementById("copyPanelImage");
const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
const historyList = document.getElementById("historyList");
const fixedInputs = Array.from(document.querySelectorAll(".fixed-input"));
const panelEl = document.querySelector(".panel");

const STORAGE_KEY = "lotto_history_v1";
const REVEAL_TOTAL_MS = 5000;
const ROLL_TICK_MS = 60;
let currentNumbers = [];
let isAnimating = false;

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

function renderNumbers(nums) {
  numbersEl.innerHTML = "";
  nums.forEach((num) => {
    const span = document.createElement("span");
    applyBallAppearance(span, num, false, ["pop"]);
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
  copyNumbersImageBtn.disabled = disabled || currentNumbers.length !== 6;
  copyPanelImageBtn.disabled = disabled || currentNumbers.length !== 6;
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
  copyNumbersImageBtn.disabled = false;
  copyPanelImageBtn.disabled = false;
  saveBtn.disabled = false;
  setControlsDisabled(false);
});

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function renderNumbersImage(nums) {
  const ballSize = 70;
  const gap = 14;
  const padding = 28;
  const width = padding * 2 + ballSize * nums.length + gap * (nums.length - 1);
  const height = padding * 2 + ballSize;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  drawRoundedRect(ctx, 0, 0, width, height, 20);
  ctx.fill();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  nums.forEach((num, index) => {
    const style = getBallStyle(num);
    const x = padding + index * (ballSize + gap) + ballSize / 2;
    const y = padding + ballSize / 2;

    const gradient = ctx.createRadialGradient(x - 12, y - 12, 10, x, y, ballSize / 2);
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(0.45, style.colors[0]);
    gradient.addColorStop(1, style.colors[1]);

    ctx.beginPath();
    ctx.arc(x, y, ballSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.16)";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.font = "800 26px 'Pretendard Variable', 'Pretendard', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.fillText(String(num), x, y + 3);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(num), x, y + 1);
  });

  return canvas;
}

async function copyNumbersImage() {
  if (currentNumbers.length !== 6) return;
  if (!navigator.clipboard || !window.ClipboardItem) {
    alert("이미지 복사는 최신 브라우저에서만 지원됩니다.");
    return;
  }
  if (!window.isSecureContext) {
    alert("이미지 복사를 위해서는 HTTPS 또는 로컬 환경이 필요합니다.");
    return;
  }

  const canvas = renderNumbersImage(currentNumbers);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    alert("이미지 생성에 실패했습니다.");
    return;
  }

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  alert("이미지가 클립보드에 복사되었습니다.");
}

async function capturePanelImage() {
  if (!panelEl) return;
  if (!window.html2canvas) {
    alert("전체 캡처를 위해 html2canvas가 필요합니다.");
    return;
  }
  if (!navigator.clipboard || !window.ClipboardItem) {
    alert("이미지 복사는 최신 브라우저에서만 지원됩니다.");
    return;
  }
  if (!window.isSecureContext) {
    alert("이미지 복사를 위해서는 HTTPS 또는 로컬 환경이 필요합니다.");
    return;
  }

  const canvas = await window.html2canvas(panelEl, {
    backgroundColor: "#ffffff",
    scale: 2,
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    alert("이미지 생성에 실패했습니다.");
    return;
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
  alert("전체 캡처 이미지가 클립보드에 복사되었습니다.");
}

copyNumbersImageBtn.addEventListener("click", () => {
  copyNumbersImage().catch(() => {
    alert("이미지 복사에 실패했습니다.");
  });
});

copyPanelImageBtn.addEventListener("click", () => {
  capturePanelImage().catch(() => {
    alert("전체 캡처에 실패했습니다.");
  });
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
