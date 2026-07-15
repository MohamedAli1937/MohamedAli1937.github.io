const els = {
  board: document.getElementById("board"),
  statsGrid: document.getElementById("statsGrid"),
  heatmap: document.getElementById("heatmap"),
  countInput: document.getElementById("countInput"),
  countValue: document.getElementById("countValue"),
  numbersInput: document.getElementById("numbersInput"),
  randomBtn: document.getElementById("randomBtn"),
  loadBtn: document.getElementById("loadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  stepBtn: document.getElementById("stepBtn"),
  autoBtn: document.getElementById("autoBtn"),
  pauseBtn: document.getElementById("pauseBtn"),
  speedBtns: Array.from(document.querySelectorAll(".speed-btn")),
};

const state = {
  numbers: [],
  initialNumbers: [],
  moves: 0,
  autoTimer: null,
  autoSpeedMs: 900,
  selection: [],
  autoChosenPair: null,
  lastMove: null,
  lastChangedCells: [],
  isAnimating: false,
  pendingMove: null,
  simulationComplete: false,
  prediction: null,
};

function gcd(a, b) {
  let x = a;
  let y = b;
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function lcm(a, b) {
  return (a / gcd(a, b)) * b;
}

function factorize(n) {
  const factors = {};
  let value = n;
  let p = 2;
  while (value > 1) {
    while (value % p === 0) {
      factors[p] = (factors[p] || 0) + 1;
      value = Math.floor(value / p);
    }
    p += p === 2 ? 1 : 2;
  }
  return factors;
}

function getPrimeSet(values) {
  const primes = new Set();
  values.forEach((value) => {
    Object.keys(factorize(value)).forEach((prime) => primes.add(Number(prime)));
  });
  return Array.from(primes).sort((a, b) => a - b);
}

function makePrediction(values) {
  const primes = new Set();
  values.forEach((value) => {
    Object.keys(factorize(value)).forEach((prime) => primes.add(Number(prime)));
  });

  let predictionValue = 1;

  Array.from(primes)
    .sort((a, b) => a - b)
    .forEach((prime) => {
      let exponent = null;
      values.forEach((value) => {
        const currentExponent = factorize(value)[prime] || 0;
        exponent = exponent === null ? currentExponent : gcd(exponent, currentExponent);
      });

      if (exponent > 0) {
        predictionValue *= prime ** exponent;
      }
    });

  return { value: predictionValue };
}

function getPrimaryValue(values) {
  const active = values.filter((value) => value > 1);
  return active.length === 1 ? active[0] : null;
}

function updateCountLabel() {
  els.countValue.textContent = els.countInput.value;
}

function randomBoard(count = Number(els.countInput.value)) {
  const safeCount = Math.max(2, Math.min(26, Number(count) || 8));
  const numbers = [];
  for (let i = 0; i < safeCount; i += 1) {
    numbers.push(Math.floor(Math.random() * 99) + 2);
  }
  state.initialNumbers = numbers;
  state.numbers = [...numbers];
  state.moves = 0;
  state.lastMove = null;
  state.lastChangedCells = [];
  state.selection = [];
  state.autoChosenPair = null;
  state.pendingMove = null;
  state.isAnimating = false;
  state.simulationComplete = false;
  state.prediction = makePrediction(state.initialNumbers);
  render();
}

function loadCustom() {
  const raw = els.numbersInput.value;
  const parsed = raw
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isInteger(entry) && entry > 1);
  if (parsed.length < 2) {
    return;
  }
  state.initialNumbers = parsed;
  state.numbers = [...parsed];
  state.moves = 0;
  state.lastMove = null;
  state.lastChangedCells = [];
  state.selection = [];
  state.autoChosenPair = null;
  state.pendingMove = null;
  state.isAnimating = false;
  state.simulationComplete = false;
  state.prediction = makePrediction(state.initialNumbers);
  render();
}
function choosePair() {
  const activeIndices = state.numbers.map((value, index) => (value > 1 ? index : -1)).filter((index) => index >= 0);
  if (activeIndices.length < 2) {
    return null;
  }

  if (state.selection.length === 2) {
    return state.selection;
  }

  let bestPair = null;
  let bestScore = -1;
  for (let i = 0; i < activeIndices.length; i += 1) {
    for (let j = i + 1; j < activeIndices.length; j += 1) {
      const first = activeIndices[i];
      const second = activeIndices[j];
      const score = gcd(state.numbers[first], state.numbers[second]);
      if (score > bestScore) {
        bestScore = score;
        bestPair = [first, second];
      }
    }
  }
  return bestPair;
}

function selectNumber(index) {
  if (!state.numbers[index] || state.isAnimating || state.simulationComplete) {
    return;
  }
  if (state.numbers[index] <= 1) {
    return;
  }

  if (state.selection.includes(index)) {
    state.selection = state.selection.filter((value) => value !== index);
    render();
    return;
  }

  if (state.selection.length === 0) {
    state.selection = [index];
    state.autoChosenPair = null;
    render();
    return;
  }

  if (state.selection.length === 1) {
    state.selection = [state.selection[0], index];
    state.autoChosenPair = null;
    executeMove(state.selection[0], state.selection[1]);
  }
}

function executeMove(firstIndex, secondIndex) {
  if (state.isAnimating || state.simulationComplete) {
    return false;
  }
  if (firstIndex === undefined || secondIndex === undefined) {
    return false;
  }
  if (firstIndex === secondIndex) {
    state.selection = [];
    render();
    return false;
  }
  const firstValue = state.numbers[firstIndex];
  const secondValue = state.numbers[secondIndex];
  if (firstValue <= 1 || secondValue <= 1) {
    state.selection = [];
    render();
    return false;
  }

  const gcdValue = gcd(firstValue, secondValue);
  const lcmValue = lcm(firstValue, secondValue);
  const newFirstValue = lcmValue / gcdValue;
  const newSecondValue = gcdValue;

  const lastChangedCells = [];
  const unionPrimes = new Set([
    ...Object.keys(factorize(firstValue)),
    ...Object.keys(factorize(secondValue)),
    ...Object.keys(factorize(newFirstValue)),
    ...Object.keys(factorize(newSecondValue)),
  ]);
  unionPrimes.forEach((prime) => {
    lastChangedCells.push({ prime: Number(prime), index: firstIndex });
    lastChangedCells.push({ prime: Number(prime), index: secondIndex });
  });

  state.pendingMove = {
    firstIndex,
    secondIndex,
    firstValue,
    secondValue,
    newFirstValue,
    newSecondValue,
  };
  state.lastChangedCells = lastChangedCells;
  state.selection = [];
  state.isAnimating = true;
  render();

  const delay = Math.max(120, Math.min(330, Math.round(state.autoSpeedMs * 0.28)));
  window.setTimeout(() => {
    const nextNumbers = [...state.numbers];
    nextNumbers[firstIndex] = newFirstValue;
    nextNumbers[secondIndex] = newSecondValue;
    state.numbers = nextNumbers;
    state.moves += 1;
    state.lastMove = { firstValue, secondValue, newFirstValue, newSecondValue };
    state.pendingMove = null;
    state.autoChosenPair = null;
    state.isAnimating = false;
    state.simulationComplete =
      getPrimaryValue(state.numbers) !== null && state.numbers.filter((value) => value > 1).length === 1;
    render();
  }, delay);

  return true;
}

function renderBoard() {
  els.board.innerHTML = "";
  state.numbers.forEach((value, index) => {
    const card = document.createElement("div");
    card.className = "number-card";
    if (state.numbers[index] <= 1) {
      card.classList.add("is-one");
    }
    if (state.selection.includes(index)) {
      card.classList.add(state.selection[0] === index ? "is-selected-first" : "is-selected-second");
    }
    if (state.autoChosenPair && state.autoChosenPair.includes(index)) {
      card.classList.add("is-auto-chosen");
    }
    if (state.pendingMove && (index === state.pendingMove.firstIndex || index === state.pendingMove.secondIndex)) {
      card.classList.add("is-animating");
    }
    const displayValue =
      state.pendingMove && (index === state.pendingMove.firstIndex || index === state.pendingMove.secondIndex)
        ? index === state.pendingMove.firstIndex
          ? state.pendingMove.firstValue
          : state.pendingMove.secondValue
        : value;
    card.innerHTML = `
      <span class="card-label">#${index + 1}</span>
      <span class="card-value">${displayValue}</span>
    `;
    card.addEventListener("click", () => selectNumber(index));
    els.board.appendChild(card);
  });
}

function renderStats() {
  const activeValues = state.numbers.filter((value) => value > 1);
  const predictionValue = state.prediction ? state.prediction.value : "—";

  let mExtra = "";
  const finalValue = getPrimaryValue(state.numbers);
  if (state.simulationComplete && finalValue === predictionValue) {
    mExtra = `<div class="complete-banner">Verified ✓</div>`;
  }

  const statItems = [
    { label: "Moves", value: state.moves, cls: "" },
    { label: "Numbers > 1", value: activeValues.length, cls: "" },
    { label: "M (result)", value: `<span class="accent">${predictionValue}</span>${mExtra}`, cls: "m-result" },
  ];

  els.statsGrid.innerHTML = statItems
    .map(
      (item) => `
    <div class="stat-tile ${item.cls}">
      <div class="stat-label">${item.label}</div>
      <div class="stat-value">${item.value}</div>
    </div>
  `
    )
    .join("");
}

function renderHeatmap() {
  const primes = getPrimeSet(state.numbers);
  const rows = [];
  rows.push(`<tr><th>Prime</th>${state.numbers.map((value) => `<th>${value}</th>`).join("")}</tr>`);
  primes.forEach((prime) => {
    const row = [`<tr><th>${prime}</th>`];
    state.numbers.forEach((value, index) => {
      const exponent = factorize(value)[prime] || 0;
      const changed = state.lastChangedCells.some((cell) => cell.prime === prime && cell.index === index);
      const className = `heatmap-cell ${changed ? "changed" : ""} ${exponent === 0 ? "zero" : ""}`;
      row.push(`<td class="${className}">${exponent}</td>`);
    });
    row.push(`</tr>`);
    rows.push(row.join(""));
  });
  els.heatmap.innerHTML = rows.join("");
}

function render() {
  updateCountLabel();
  renderBoard();
  renderStats();
  renderHeatmap();
}

function step() {
  if (state.isAnimating) {
    return;
  }
  if (state.selection.length === 2) {
    executeMove(state.selection[0], state.selection[1]);
  } else {
    const pair = choosePair();
    if (!pair) {
      return;
    }
    state.autoChosenPair = pair;
    render();
    executeMove(pair[0], pair[1]);
  }
}

function stopAuto() {
  if (state.autoTimer) {
    clearInterval(state.autoTimer);
    state.autoTimer = null;
  }
}

function autoPlay() {
  if (state.autoTimer) {
    return;
  }
  stopAuto();
  state.autoTimer = window.setInterval(() => {
    if (state.isAnimating) {
      return;
    }
    const pair = choosePair();
    if (!pair) {
      stopAuto();
      return;
    }
    state.autoChosenPair = pair;
    render();
    const moved = executeMove(pair[0], pair[1]);
    if (!moved) {
      stopAuto();
    }
  }, state.autoSpeedMs);
}

function setSpeed(speed) {
  state.autoSpeedMs = speed;
  els.speedBtns.forEach((btn) => {
    btn.classList.toggle("active", Number(btn.dataset.speed) === speed);
  });
  if (state.autoTimer) {
    stopAuto();
    autoPlay();
  }
}

function resetSimulation() {
  stopAuto();
  state.numbers = [...state.initialNumbers];
  state.moves = 0;
  state.lastMove = null;
  state.lastChangedCells = [];
  state.selection = [];
  state.autoChosenPair = null;
  state.pendingMove = null;
  state.isAnimating = false;
  state.simulationComplete = false;
  state.prediction = makePrediction(state.initialNumbers);
  render();
}

function bindEvents() {
  els.randomBtn.addEventListener("click", () => randomBoard(Number(els.countInput.value)));
  els.loadBtn.addEventListener("click", loadCustom);
  els.resetBtn.addEventListener("click", resetSimulation);
  els.stepBtn.addEventListener("click", step);
  els.autoBtn.addEventListener("click", autoPlay);
  els.pauseBtn.addEventListener("click", stopAuto);
  els.countInput.addEventListener("input", updateCountLabel);
  els.speedBtns.forEach((button) => {
    button.addEventListener("click", () => setSpeed(Number(button.dataset.speed)));
  });
}

function init() {
  bindEvents();
  updateCountLabel();
  randomBoard(8);
}

init();
