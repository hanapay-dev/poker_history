// 定数定義
const POSITIONS_BY_SIZE = {
  2: ["SB", "BB"],
  3: ["BTN", "SB", "BB"],
  4: ["CO", "BTN", "SB", "BB"],
  5: ["MP", "CO", "BTN", "SB", "BB"],
  6: ["UTG", "MP", "CO", "BTN", "SB", "BB"],
  7: ["UTG", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
  8: ["UTG", "UTG+1", "LJ", "HJ", "CO", "BTN", "SB", "BB"],
  9: ["UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO", "BTN", "SB", "BB"]
};

const STREETS = ["PREFLOP", "FLOP", "TURN", "RIVER"];

// アプリケーション状態
let state = {
  playerCount: 6,
  positions: [],
  heroPos: "",
  heroCards: ["", ""],
  activeSlotIndex: 0,
  
  street: "PREFLOP",
  boardCards: [],
  pot: 1.5,
  currentBet: 1.0,
  lastRaiseAmount: 1.0,
  players: [],
  currentTurnIndex: 0,
  logs: [],

  // ボード選択モーダル状態
  boardSelectedCards: [],
  activeBoardSlotIndex: 0,
  tempRank: "",
  
  // テンキー入力状態
  customBetStr: "2.5",

  // 履歴ID
  handId: null
};

window.onload = () => {
  updatePositions();
  document.getElementById("setupModal").style.display = "flex";
};

// モーダル設定
function updatePositions() {
  const count = parseInt(document.getElementById("tableSizeSelect").value);
  const positions = POSITIONS_BY_SIZE[count];
  const heroSelect = document.getElementById("heroPosSelect");
  heroSelect.innerHTML = "";
  positions.forEach(pos => {
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = pos;
    heroSelect.appendChild(opt);
  });
}

function selectCardSlot(index) {
  state.activeSlotIndex = index;
  document.getElementById("card1").classList.toggle("active", index === 0);
  document.getElementById("card2").classList.toggle("active", index === 1);
}

function pickRank(rank) {
  state.tempRank = rank;
  document.querySelectorAll(".keypad-ranks button").forEach(b => {
    b.classList.toggle("selected", b.textContent === (rank === 'T' ? '10' : rank));
  });
}

function pickSuit(suit) {
  if (!state.tempRank) return;
  const cardStr = state.tempRank + suit;
  state.heroCards[state.activeSlotIndex] = cardStr;
  
  document.getElementById(`card${state.activeSlotIndex + 1}`).textContent = 
    `${state.activeSlotIndex + 1}枚目: ${formatCard(cardStr)}`;

  state.tempRank = "";
  document.querySelectorAll(".keypad-ranks button").forEach(b => b.classList.remove("selected"));

  if (state.activeSlotIndex === 0) {
    selectCardSlot(1);
  }
}

function formatCard(c) {
  if (!c) return "?";
  const rank = c[0] === 'T' ? '10' : c[0];
  const suitMap = { s: '♠', h: '♥', d: '♦', c: '♣' };
  return rank + suitMap[c[1]];
}

// ハンド開始
function startHand() {
  if (!state.heroCards[0] || !state.heroCards[1]) {
    alert("Heroのカードを2枚選択してください");
    return;
  }

  state.playerCount = parseInt(document.getElementById("tableSizeSelect").value);
  state.positions = POSITIONS_BY_SIZE[state.playerCount];
  state.heroPos = document.getElementById("heroPosSelect").value;
  state.handId = Date.now();

  state.street = "PREFLOP";
  state.boardCards = [];
  state.pot = 1.5;
  state.currentBet = 1.0;
  state.lastRaiseAmount = 1.0;
  state.logs = [];

  state.players = state.positions.map(pos => {
    let currentInPot = 0;
    if (pos === "SB") currentInPot = 0.5;
    if (pos === "BB") currentInPot = 1.0;
    return {
      pos: pos,
      isHero: pos === state.heroPos,
      isFolded: false,
      currentInPot: currentInPot
    };
  });

  if (state.playerCount === 2) {
    state.currentTurnIndex = 0; // SBから
  } else {
    const utgIndex = state.positions.indexOf("UTG");
    state.currentTurnIndex = utgIndex !== -1 ? utgIndex : 0;
  }

  document.getElementById("setupModal").style.display = "none";

  addLog(`--- New Hand (${state.playerCount}-max) ---`);
  addLog(`Hero: ${state.heroPos} [${formatCard(state.heroCards[0])} ${formatCard(state.heroCards[1])}]`);
  
  updateUI();
  saveCurrentHandToStorage();
}

// アクション処理
function handleAction(actionType, targetBet = 0) {
  const p = state.players[state.currentTurnIndex];
  let logText = `${p.pos}: ${actionType}`;

  if (actionType === 'FOLD') {
    p.isFolded = true;
  } else if (actionType === 'CHECK') {
    // 処理なし
  } else if (actionType === 'CALL') {
    const callAmount = state.currentBet - p.currentInPot;
    state.pot += callAmount;
    p.currentInPot = state.currentBet;
    logText += ` (${state.currentBet} BB)`;
  } else if (actionType === 'RAISE' || actionType === 'BET') {
    const addAmount = targetBet - p.currentInPot;
    state.pot += addAmount;
    state.lastRaiseAmount = targetBet - state.currentBet;
    state.currentBet = targetBet;
    p.currentInPot = targetBet;
    logText += ` to ${targetBet} BB`;
  } else if (actionType === 'ALL IN') {
    if (targetBet > 0) {
      const addAmount = targetBet - p.currentInPot;
      state.pot += addAmount;
      if (targetBet > state.currentBet) {
        state.lastRaiseAmount = targetBet - state.currentBet;
        state.currentBet = targetBet;
      }
      p.currentInPot = targetBet;
      logText += ` (${targetBet} BB)`;
    } else {
      logText += `!`;
    }
  }

  addLog(logText);
  nextTurn();
}

function handleCheckCall() {
  const p = state.players[state.currentTurnIndex];
  if (p.currentInPot === state.currentBet) {
    handleAction('CHECK');
  } else {
    handleAction('CALL');
  }
}

function handleSizingAction(multiplier) {
  let targetBet = 0;
  if (state.street === "PREFLOP") {
    targetBet = parseFloat((state.currentBet * multiplier).toFixed(1));
  } else {
    targetBet = parseFloat((state.pot * (multiplier / 3.0)).toFixed(1));
  }
  handleAction('RAISE', targetBet);
}

function nextTurn() {
  const activePlayers = state.players.filter(p => !p.isFolded);
  if (activePlayers.length === 1) {
    addLog(`Winner: ${activePlayers[0].pos} (Pot: ${state.pot} BB)`);
    updateUI();
    saveCurrentHandToStorage();
    return;
  }

  let nextIdx = (state.currentTurnIndex + 1) % state.playerCount;
  let loopCount = 0;
  while (state.players[nextIdx].isFolded && loopCount < state.playerCount) {
    nextIdx = (nextIdx + 1) % state.playerCount;
    loopCount++;
  }

  const isStreetOver = checkStreetCompletion(nextIdx);

  if (isStreetOver) {
    advanceStreet();
  } else {
    state.currentTurnIndex = nextIdx;
  }

  updateUI();
  saveCurrentHandToStorage();
}

function checkStreetCompletion(nextIdx) {
  const active = state.players.filter(p => !p.isFolded);
  const allMatched = active.every(p => p.currentInPot === state.currentBet);
  
  if (!allMatched) return false;

  if (state.street === "PREFLOP") {
    const bbIdx = state.positions.indexOf("BB");
    if (state.players[bbIdx].isFolded) return true;
    if (state.currentTurnIndex === bbIdx) return true;
    return false;
  }
  
  return true;
}

function advanceStreet() {
  const currentIdx = STREETS.indexOf(state.street);
  if (currentIdx === STREETS.length - 1) {
    addLog(`Showdown! Final Pot: ${state.pot} BB`);
    return;
  }

  const nextStreet = STREETS[currentIdx + 1];
  openBoardModal(nextStreet);
}

// ボード入力モーダル制御
function openBoardModal(nextStreet) {
  state.street = nextStreet;
  state.players.forEach(p => p.currentInPot = 0);
  state.currentBet = 0;
  state.lastRaiseAmount = 1.0;

  let sbIdx = state.positions.indexOf("SB");
  if (sbIdx === -1) sbIdx = 0;
  let nextIdx = sbIdx;
  while (state.players[nextIdx].isFolded) {
    nextIdx = (nextIdx + 1) % state.playerCount;
  }
  state.currentTurnIndex = nextIdx;

  const countNeeded = nextStreet === "FLOP" ? 3 : 1;
  state.boardSelectedCards = new Array(countNeeded).fill("");
  state.activeBoardSlotIndex = 0;

  document.getElementById("boardModalTitle").textContent = `${nextStreet} カード選択 (${countNeeded}枚)`;
  renderBoardSlots();
  document.getElementById("boardModal").style.display = "flex";
}

function renderBoardSlots() {
  const container = document.getElementById("boardSelectedSlots");
  container.innerHTML = "";
  state.boardSelectedCards.forEach((c, idx) => {
    const slot = document.createElement("div");
    slot.className = `card-slot ${idx === state.activeBoardSlotIndex ? 'active' : ''}`;
    slot.textContent = `${idx + 1}枚目: ${formatCard(c)}`;
    slot.onclick = () => {
      state.activeBoardSlotIndex = idx;
      renderBoardSlots();
    };
    container.appendChild(slot);
  });
  checkBoardConfirmBtn();
}

function pickBoardRank(rank) {
  state.tempRank = rank;
}

function pickBoardSuit(suit) {
  if (!state.tempRank) return;
  const cardStr = state.tempRank + suit;
  state.boardSelectedCards[state.activeBoardSlotIndex] = cardStr;
  state.tempRank = "";

  if (state.activeBoardSlotIndex < state.boardSelectedCards.length - 1) {
    state.activeBoardSlotIndex++;
  }
  renderBoardSlots();
}

function checkBoardConfirmBtn() {
  const allFilled = state.boardSelectedCards.every(c => c !== "");
  document.getElementById("boardConfirmBtn").disabled = !allFilled;
}

function confirmBoardCards() {
  state.boardCards.push(...state.boardSelectedCards);
  document.getElementById("boardModal").style.display = "none";

  const boardFormatted = state.boardCards.map(c => formatCard(c)).join(" ");
  addLog(`--- ${state.street} [${boardFormatted}] ---`);
  updateUI();
}

// テンキーモーダル制御
function openCustomBetModal() {
  const minBet = state.currentBet > 0 ? (state.currentBet + state.lastRaiseAmount) : 1.0;
  state.customBetStr = minBet.toFixed(1);
  document.getElementById("customBetValue").textContent = state.customBetStr;
  document.getElementById("customBetModal").style.display = "flex";
}

function closeCustomBetModal() {
  document.getElementById("customBetModal").style.display = "none";
}

function appendBetNum(char) {
  if (char === '.' && state.customBetStr.includes('.')) return;
  if (state.customBetStr === "0" && char !== '.') {
    state.customBetStr = char;
  } else {
    state.customBetStr += char;
  }
  document.getElementById("customBetValue").textContent = state.customBetStr;
}

function clearBetNum() {
  state.customBetStr = "0";
  document.getElementById("customBetValue").textContent = state.customBetStr;
}

function confirmCustomBet() {
  const val = parseFloat(state.customBetStr);
  if (isNaN(val) || val <= 0) {
    alert("正しい数値を入力してください");
    return;
  }
  closeCustomBetModal();
  const actionType = state.currentBet === 0 ? 'BET' : 'RAISE';
  handleAction(actionType, val);
}

// UI更新
function updateUI() {
  document.getElementById("streetDisplay").textContent = state.street;
  document.getElementById("potDisplay").textContent = `${state.pot.toFixed(1)} BB`;
  
  const boardText = state.boardCards.length > 0 
    ? state.boardCards.map(c => formatCard(c)).join(" ")
    : "なし";
  document.getElementById("boardCardsDisplay").textContent = boardText;

  const activeP = state.players[state.currentTurnIndex];
  document.getElementById("currentTurnDisplay").textContent = activeP ? activeP.pos : "--";

  const checkCallBtn = document.getElementById("checkCallBtn");
  if (activeP && activeP.currentInPot === state.currentBet) {
    checkCallBtn.textContent = "CHECK";
    checkCallBtn.className = "btn-action btn-call";
  } else {
    const toCall = state.currentBet - (activeP ? activeP.currentInPot : 0);
    checkCallBtn.textContent = `CALL (${toCall.toFixed(1)})`;
    checkCallBtn.className = "btn-action btn-call";
  }

  const seatsGrid = document.getElementById("tableSeats");
  seatsGrid.innerHTML = "";
  state.players.forEach((p, idx) => {
    const seat = document.createElement("div");
    let className = "seat-card";
    if (p.isFolded) className += " folded";
    if (idx === state.currentTurnIndex && !p.isFolded) className += " active";
    if (p.isHero) className += " hero";

    seat.className = className;
    seat.innerHTML = `
      <div><strong>${p.pos}</strong> ${p.isHero ? '(Hero)' : ''}</div>
      <div>In: ${p.currentInPot.toFixed(1)} BB</div>
    `;
    seatsGrid.appendChild(seat);
  });

  const logArea = document.getElementById("logArea");
  logArea.innerText = state.logs.join("\n");
  logArea.scrollTop = logArea.scrollHeight;
}

function addLog(text) {
  state.logs.push(text);
}

function resetHand() {
  if (confirm("現在のハンドを破棄して新規ハンドを開始しますか？")) {
    document.getElementById("setupModal").style.display = "flex";
  }
}

// ローカルストレージ保存
function saveCurrentHandToStorage() {
  if (!state.handId) return;

  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");
  const existingIdx = history.findIndex(h => h.id === state.handId);

  const handRecord = {
    id: state.handId,
    timestamp: new Date().toISOString(),
    heroPos: state.heroPos,
    heroCards: state.heroCards,
    playerCount: state.playerCount,
    logs: state.logs,
    summary: `${state.heroPos} [${formatCard(state.heroCards[0])}${formatCard(state.heroCards[1])}] | Pot: ${state.pot.toFixed(1)}BB`,
    favorite: existingIdx !== -1 ? history[existingIdx].favorite : false
  };

  if (existingIdx !== -1) {
    history[existingIdx] = handRecord;
  } else {
    history.unshift(handRecord);
  }

  localStorage.setItem("poker_hand_history", JSON.stringify(history));
}