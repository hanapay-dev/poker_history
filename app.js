// --- グローバル状態管理 ---
let gameState = {
  tableSize: 6,
  heroPos: 'BTN',
  heroCards: [null, null],
  activeCardIndex: 0,
  boardCards: [],
  street: 'PREFLOP', // PREFLOP, FLOP, TURN, RIVER, SHOWDOWN, END
  pot: 1.5,
  currentBet: 1.0,
  players: [],
  currentTurnIndex: 0,
  lastAggressorIndex: -1, // アクション周回の完了判定用
  logs: []
};

// モーダル入力一時データ
let inputState = {
  boardCardsTemp: [],
  activeBoardSlot: 0,
  betMode: 'BET', // 'BET' または 'RAISE'
  betValueStr: '',
  sdPlayers: {}, // { pos: [card1, card2] } または { pos: 'MUCK' }
  sdActivePos: null,
  sdCardIndex: 0
};

const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const SUITS = ['s', 'h', 'd', 'c'];
const SUIT_SYMBOLS = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };

// ポジション定義
const POSITIONS_BY_SIZE = {
  2: ['SB', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['CO', 'BTN', 'SB', 'BB'],
  5: ['HJ', 'CO', 'BTN', 'SB', 'BB'],
  6: ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  7: ['UTG', 'UTG+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  8: ['UTG', 'UTG+1', 'UTG+2', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
  9: ['UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
};

// --- 初期化 ---
window.addEventListener('DOMContentLoaded', () => {
  updatePositions();
  selectCardSlot(0);
});

// --- 操作ガイドモーダル制御 ---
function openGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.style.display = 'flex';
}

function closeGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.style.display = 'none';
}

// --- ログ記録 ---
function log(msg) {
  gameState.logs.push(msg);
  const logBox = document.getElementById('logArea');
  if (logBox) {
    logBox.innerText = gameState.logs.join('\n');
    logBox.scrollTop = logBox.scrollHeight;
  }
}

// --- 使用済みカードの抽出 ---
function getAllUsedCards() {
  const used = new Set();
  
  // Hero Cards
  gameState.heroCards.forEach(c => c && used.add(c));
  
  // Board Cards
  gameState.boardCards.forEach(c => c && used.add(c));
  if (inputState.boardCardsTemp) {
    inputState.boardCardsTemp.forEach(c => c && used.add(c));
  }

  // Showdown Cards
  if (inputState.sdPlayers) {
    Object.values(inputState.sdPlayers).forEach(val => {
      if (Array.isArray(val)) {
        val.forEach(c => c && used.add(c));
      }
    });
  }

  return used;
}

function formatCard(cardStr) {
  if (!cardStr || cardStr === 'MUCK') return cardStr;
  const suitMap = { 'S': '♠', 'H': '♥', 'D': '♦', 'C': '♣' };
  const rank = cardStr.slice(0, -1);
  const suit = suitMap[cardStr.slice(-1)] || '';
  return `${rank}${suit}`;
}

// --- 52枚カードグリッド描画 ---
function renderCardPicker(containerId, onSelectCard, currentSelectedCard = null) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  const usedCards = getAllUsedCards();

  SUITS.forEach(s => {
    RANKS.forEach(r => {
      const cardCode = r + s.toUpperCase();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `playing-card-btn suit-${s}`;
      if (currentSelectedCard === cardCode) {
        btn.classList.add('selected');
      }

      const isUsed = usedCards.has(cardCode);
      if (isUsed) {
        btn.disabled = true;
        btn.classList.add('disabled');
      }

      const rankDisplay = r === 'T' ? '10' : r;
      btn.innerHTML = `
        <span class="card-rank-text">${rankDisplay}</span>
        <span class="card-suit-text">${SUIT_SYMBOLS[s]}</span>
      `;

      btn.onclick = () => onSelectCard(cardCode);
      container.appendChild(btn);
    });
  });
}

// --- 初期設定モーダル制御 ---
function updatePositions() {
  const size = parseInt(document.getElementById('tableSizeSelect').value);
  const heroSelect = document.getElementById('heroPosSelect');
  heroSelect.innerHTML = '';
  
  const positions = POSITIONS_BY_SIZE[size] || POSITIONS_BY_SIZE[6];
  positions.forEach(pos => {
    const opt = document.createElement('option');
    opt.value = pos;
    opt.textContent = pos;
    if (pos === 'BTN') opt.selected = true;
    heroSelect.appendChild(opt);
  });
}

function selectCardSlot(index) {
  gameState.activeCardIndex = index;
  document.getElementById('card1').classList.toggle('active', index === 0);
  document.getElementById('card2').classList.toggle('active', index === 1);

  const currentCard = gameState.heroCards[index];
  renderCardPicker('setupCardPicker', (card) => pickHeroCard(card), currentCard);
}

function pickHeroCard(card) {
  gameState.heroCards[gameState.activeCardIndex] = card;
  const slotEl = document.getElementById(`card${gameState.activeCardIndex + 1}`);
  slotEl.textContent = `${gameState.activeCardIndex + 1}枚目: ${formatCard(card)}`;

  if (gameState.activeCardIndex === 0) {
    selectCardSlot(1);
  } else {
    selectCardSlot(1);
  }

  const isBothReady = gameState.heroCards[0] !== null && gameState.heroCards[1] !== null;
  document.getElementById('setupConfirmBtn').disabled = !isBothReady;
}

// --- ハンド開始 ---
function startHand() {
  if (!gameState.heroCards[0] || !gameState.heroCards[1]) {
    alert('Heroのホールカードを2枚選択してください。');
    return;
  }

  const size = parseInt(document.getElementById('tableSizeSelect').value);
  const heroPos = document.getElementById('heroPosSelect').value;
  const positions = POSITIONS_BY_SIZE[size];

  gameState.tableSize = size;
  gameState.heroPos = heroPos;
  gameState.street = 'PREFLOP';
  gameState.pot = 1.5;
  gameState.currentBet = 1.0;
  gameState.boardCards = [];
  gameState.logs = [];

  gameState.players = positions.map(pos => ({
    pos,
    isHero: pos === heroPos,
    isFolded: false,
    isAllIn: false,
    currentInvested: pos === 'SB' ? 0.5 : pos === 'BB' ? 1.0 : 0,
    hasActed: false
  }));

  if (size === 2) {
    gameState.currentTurnIndex = 0; // SB (BTN) からスタート
  } else {
    const bbIndex = positions.indexOf('BB');
    gameState.currentTurnIndex = (bbIndex + 1) % size; // UTG からスタート
  }

  gameState.lastAggressorIndex = positions.indexOf('BB');

  document.getElementById('setupModal').style.display = 'none';
  log(`--- 新規ハンド開始 (${size}-max) ---`);
  log(`Hero: ${heroPos} [${formatCard(gameState.heroCards[0])} ${formatCard(gameState.heroCards[1])}]`);
  
  renderTable();
  updateUI();
}

// --- UI / テーブル描画 ---
function renderTable() {
  const grid = document.getElementById('tableSeats');
  grid.innerHTML = '';

  gameState.players.forEach((p, idx) => {
    const cardDiv = document.createElement('div');
    cardDiv.className = `seat-card ${p.isHero ? 'hero' : ''} ${p.isFolded ? 'folded' : ''} ${idx === gameState.currentTurnIndex && gameState.street !== 'END' ? 'active' : ''}`;
    
    let infoStr = `<strong>${p.pos}${p.isHero ? ' (Hero)' : ''}</strong>`;
    if (p.isFolded) infoStr += '<br><span style="color:#888;">FOLD</span>';
    else if (p.isAllIn) infoStr += '<br><span style="color:#d9534f;">ALL-IN</span>';
    else if (p.currentInvested > 0) infoStr += `<br>${p.currentInvested} BB`;
    
    cardDiv.innerHTML = infoStr;
    grid.appendChild(cardDiv);
  });
}

function updateUI() {
  document.getElementById('streetDisplay').textContent = gameState.street;
  document.getElementById('potDisplay').textContent = `${gameState.pot} BB`;
  document.getElementById('boardCardsDisplay').textContent = gameState.boardCards.length > 0 
    ? gameState.boardCards.map(formatCard).join(' ') 
    : 'なし';
  
  const currentP = gameState.players[gameState.currentTurnIndex];
  document.getElementById('currentTurnDisplay').textContent = (gameState.street !== 'END' && currentP) 
    ? currentP.pos 
    : '--';

  const checkCallBtn = document.getElementById('checkCallBtn');
  const betBtn = document.getElementById('betBtn');
  const raiseBtn = document.getElementById('raiseBtn');

  if (currentP) {
    const toCall = gameState.currentBet - currentP.currentInvested;
    checkCallBtn.textContent = toCall <= 0 ? 'CHECK' : `CALL (${toCall} BB)`;

    if (gameState.currentBet === 0) {
      betBtn.disabled = false;
      raiseBtn.disabled = true;
    } else {
      betBtn.disabled = true;
      raiseBtn.disabled = false;
    }
  }
}

// --- アクション処理 ---
function handleCheckCall() {
  const p = gameState.players[gameState.currentTurnIndex];
  const toCall = gameState.currentBet - p.currentInvested;
  
  if (toCall <= 0) {
    log(`${p.pos}: CHECK`);
  } else {
    p.currentInvested += toCall;
    gameState.pot += toCall;
    log(`${p.pos}: CALL (${toCall} BB)`);
  }
  
  p.hasActed = true;
  advanceTurn();
}

function handleAction(type) {
  const p = gameState.players[gameState.currentTurnIndex];
  
  if (type === 'FOLD') {
    p.isFolded = true;
    log(`${p.pos}: FOLD`);
    p.hasActed = true;
    advanceTurn();
  } else if (type === 'ALL IN') {
    const defaultVal = gameState.currentBet > 0 ? (gameState.currentBet * 2).toString() : "10";
    const inputVal = prompt(`${p.pos} の ALL IN 額 (BB) を入力してください:`, defaultVal);
    if (inputVal !== null) {
      const parsed = parseFloat(inputVal);
      if (!isNaN(parsed) && parsed > 0) {
        executeAllIn(parsed);
      }
    }
  }
}

function handleSizingAction(multiplier) {
  const raiseAmt = gameState.currentBet === 0 ? multiplier : gameState.currentBet * multiplier;
  executeBetRaise(raiseAmt);
}

function executeBetRaise(amount) {
  const p = gameState.players[gameState.currentTurnIndex];
  const diff = amount - p.currentInvested;
  
  if (diff <= 0) {
    alert('現在のベット額より大きい値を指定してください。');
    return;
  }

  p.currentInvested = amount;
  gameState.pot += diff;
  gameState.currentBet = amount;
  gameState.lastAggressorIndex = gameState.currentTurnIndex;

  gameState.players.forEach((pl, idx) => {
    if (idx !== gameState.currentTurnIndex) {
      pl.hasActed = false;
    }
  });

  p.hasActed = true;
  log(`${p.pos}: ${gameState.currentBet === amount && gameState.players.filter(x => x.currentInvested > 0).length === 1 ? 'BET' : 'RAISE'} to ${amount} BB`);

  advanceTurn();
}

function executeAllIn(amount) {
  const p = gameState.players[gameState.currentTurnIndex];
  p.isAllIn = true;
  
  const diff = amount - p.currentInvested;
  if (diff > 0) {
    gameState.pot += diff;
    p.currentInvested = amount;
  }

  if (amount > gameState.currentBet) {
    gameState.currentBet = amount;
    gameState.lastAggressorIndex = gameState.currentTurnIndex;

    gameState.players.forEach((pl, idx) => {
      if (idx !== gameState.currentTurnIndex) {
        pl.hasActed = false;
      }
    });
  }

  p.hasActed = true;
  log(`${p.pos}: ALL IN (${amount} BB)`);

  advanceTurn();
}

function advanceTurn() {
  const activePlayers = gameState.players.filter(p => !p.isFolded);
  
  if (activePlayers.length === 1) {
    log(`\n🎉 ${activePlayers[0].pos} がポット (${gameState.pot} BB) を獲得しました！`);
    gameState.street = 'END';
    saveHandToHistory();
    renderTable();
    updateUI();
    return;
  }

  const isStreetComplete = activePlayers.every(p => p.hasActed && (p.currentInvested === gameState.currentBet || p.isAllIn));

  if (isStreetComplete) {
    nextStreet();
    return;
  }

  let nextIdx = (gameState.currentTurnIndex + 1) % gameState.tableSize;
  let loopCount = 0;
  while ((gameState.players[nextIdx].isFolded || gameState.players[nextIdx].isAllIn) && loopCount < gameState.tableSize) {
    nextIdx = (nextIdx + 1) % gameState.tableSize;
    loopCount++;
  }

  gameState.currentTurnIndex = nextIdx;
  renderTable();
  updateUI();
}

function getFirstActiveIndexPostflop() {
  const size = gameState.tableSize;
  let startIdx = 0;
  if (size === 2) {
    startIdx = 1;
  } else {
    const sbIdx = gameState.players.findIndex(p => p.pos === 'SB');
    startIdx = sbIdx >= 0 ? sbIdx : 0;
  }

  for (let i = 0; i < size; i++) {
    const idx = (startIdx + i) % size;
    if (!gameState.players[idx].isFolded && !gameState.players[idx].isAllIn) {
      return idx;
    }
  }
  return 0;
}

function nextStreet() {
  gameState.players.forEach(p => {
    p.currentInvested = 0;
    p.hasActed = false;
  });
  gameState.currentBet = 0;

  if (gameState.street === 'PREFLOP') {
    gameState.street = 'FLOP';
    openBoardModal(3);
  } else if (gameState.street === 'FLOP') {
    gameState.street = 'TURN';
    openBoardModal(1);
  } else if (gameState.street === 'TURN') {
    gameState.street = 'RIVER';
    openBoardModal(1);
  } else if (gameState.street === 'RIVER') {
    gameState.street = 'SHOWDOWN';
    openShowdownModal();
  }
}

// --- ボード入力モーダル ---
function openBoardModal(count) {
  inputState.boardCardsTemp = Array(count).fill(null);
  inputState.activeBoardSlot = 0;

  document.getElementById('boardModalTitle').textContent = `${gameState.street} カード選択 (${count}枚)`;

  const container = document.getElementById('boardSelectedSlots');
  container.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const slot = document.createElement('div');
    slot.className = `card-slot ${i === 0 ? 'active' : ''}`;
    slot.id = `boardSlot_${i}`;
    slot.textContent = `${i + 1}枚目: ?`;
    slot.onclick = () => selectBoardSlot(i);
    container.appendChild(slot);
  }

  selectBoardSlot(0);
  document.getElementById('boardConfirmBtn').disabled = true;
  document.getElementById('boardModal').style.display = 'flex';
}

function selectBoardSlot(idx) {
  inputState.activeBoardSlot = idx;
  const slots = document.getElementById('boardSelectedSlots').children;
  for (let i = 0; i < slots.length; i++) {
    slots[i].classList.toggle('active', i === idx);
  }

  const currentCard = inputState.boardCardsTemp[idx];
  renderCardPicker('boardCardPicker', (card) => pickBoardCard(card), currentCard);
}

function pickBoardCard(card) {
  inputState.boardCardsTemp[inputState.activeBoardSlot] = card;
  const slot = document.getElementById(`boardSlot_${inputState.activeBoardSlot}`);
  if (slot) slot.textContent = `${inputState.activeBoardSlot + 1}枚目: ${formatCard(card)}`;

  const nextEmpty = inputState.boardCardsTemp.findIndex(c => c === null);
  if (nextEmpty !== -1) {
    selectBoardSlot(nextEmpty);
  } else {
    selectBoardSlot(inputState.activeBoardSlot);
  }

  const isAllSet = inputState.boardCardsTemp.every(c => c !== null);
  document.getElementById('boardConfirmBtn').disabled = !isAllSet;
}

function confirmBoardCards() {
  gameState.boardCards.push(...inputState.boardCardsTemp);
  log(`\n--- ${gameState.street}: [${gameState.boardCards.map(formatCard).join(' ')}] ---`);
  
  document.getElementById('boardModal').style.display = 'none';
  gameState.currentTurnIndex = getFirstActiveIndexPostflop();
  renderTable();
  updateUI();
}

// --- テンキー入力モーダル ---
function openCustomBetModal(mode) {
  inputState.betMode = mode;
  inputState.betValueStr = '';
  document.getElementById('customBetTitle').textContent = `${mode} 額を入力`;
  document.getElementById('customBetValue').textContent = '0';
  document.getElementById('customBetModal').style.display = 'flex';
}

function closeCustomBetModal() {
  document.getElementById('customBetModal').style.display = 'none';
}

function appendBetNum(num) {
  if (num === '.' && inputState.betValueStr.includes('.')) return;
  inputState.betValueStr += num;
  document.getElementById('customBetValue').textContent = inputState.betValueStr || '0';
}

function clearBetNum() {
  inputState.betValueStr = '';
  document.getElementById('customBetValue').textContent = '0';
}

function confirmCustomBet() {
  const val = parseFloat(inputState.betValueStr);
  if (!isNaN(val) && val > 0) {
    closeCustomBetModal();
    executeBetRaise(val);
  } else {
    alert('有効な数値を入力してください。');
  }
}

function confirmAllInFromModal() {
  const val = parseFloat(inputState.betValueStr);
  closeCustomBetModal();
  if (!isNaN(val) && val > 0) {
    executeAllIn(val);
  } else {
    const defaultVal = gameState.currentBet > 0 ? (gameState.currentBet * 2).toString() : "10";
    const inputVal = prompt("ALL IN の額 (BB) を入力してください:", defaultVal);
    if (inputVal !== null) {
      const parsed = parseFloat(inputVal);
      if (!isNaN(parsed) && parsed > 0) {
        executeAllIn(parsed);
      }
    }
  }
}

// --- ショーダウン入力モーダル ---
function openShowdownModal() {
  inputState.sdPlayers = {};
  const activeOpponents = gameState.players.filter(p => !p.isFolded && !p.isHero);
  
  if (activeOpponents.length === 0) {
    log(`\n🎉 Showdown: Hero の勝ち！ (ポット: ${gameState.pot} BB)`);
    gameState.street = 'END';
    saveHandToHistory();
    renderTable();
    updateUI();
    return;
  }

  const container = document.getElementById('showdownPlayersContainer');
  container.innerHTML = '';
  
  activeOpponents.forEach((p, idx) => {
    inputState.sdPlayers[p.pos] = [null, null];
    
    const div = document.createElement('div');
    div.className = `showdown-player-card ${idx === 0 ? 'active' : ''}`;
    div.id = `sdCard_${p.pos}`;
    div.onclick = () => selectSdPlayer(p.pos);
    
    div.innerHTML = `
      <div class="sd-player-header">
        <strong>${p.pos}</strong>
        <button class="btn-muck" onclick="setSdMuck(event, '${p.pos}')">MUCK</button>
      </div>
      <div class="sd-cards-info" id="sdInfo_${p.pos}">カード未選択</div>
    `;
    container.appendChild(div);
  });

  inputState.sdActivePos = activeOpponents[0].pos;
  inputState.sdCardIndex = 0;
  setupSdCardSlots();
  document.getElementById('showdownModal').style.display = 'flex';
}

function selectSdPlayer(pos) {
  inputState.sdActivePos = pos;
  inputState.sdCardIndex = 0;
  const cards = document.querySelectorAll('.showdown-player-card');
  cards.forEach(c => c.classList.remove('active'));
  const target = document.getElementById(`sdCard_${pos}`);
  if (target) target.classList.add('active');
  setupSdCardSlots();
}

function setupSdCardSlots() {
  const container = document.getElementById('showdownSelectedSlots');
  container.innerHTML = '';
  
  const currentData = inputState.sdPlayers[inputState.sdActivePos];
  if (currentData === 'MUCK') {
    container.innerHTML = '<div class="muck-notice">このプレイヤーは MUCK しました</div>';
    renderCardPicker('showdownCardPicker', () => {}, null);
    return;
  }

  for (let i = 0; i < 2; i++) {
    const slot = document.createElement('div');
    slot.className = `card-slot ${i === inputState.sdCardIndex ? 'active' : ''}`;
    slot.textContent = `${i + 1}枚目: ${currentData && currentData[i] ? formatCard(currentData[i]) : '?'}`;
    slot.onclick = () => {
      inputState.sdCardIndex = i;
      setupSdCardSlots();
    };
    container.appendChild(slot);
  }

  const currentCard = Array.isArray(currentData) ? currentData[inputState.sdCardIndex] : null;
  renderCardPicker('showdownCardPicker', (card) => pickShowdownCard(card), currentCard);
}

function setSdMuck(e, pos) {
  e.stopPropagation();
  inputState.sdPlayers[pos] = 'MUCK';
  const infoEl = document.getElementById(`sdInfo_${pos}`);
  if (infoEl) infoEl.innerHTML = '<span class="muck-tag">MUCK</span>';
  setupSdCardSlots();
}

function pickShowdownCard(card) {
  if (!inputState.sdActivePos || inputState.sdPlayers[inputState.sdActivePos] === 'MUCK') return;

  inputState.sdPlayers[inputState.sdActivePos][inputState.sdCardIndex] = card;
  const infoEl = document.getElementById(`sdInfo_${inputState.sdActivePos}`);
  const cards = inputState.sdPlayers[inputState.sdActivePos];
  if (infoEl) {
    infoEl.textContent = `${cards[0] ? formatCard(cards[0]) : '?'} ${cards[1] ? formatCard(cards[1]) : '?'}`;
  }

  inputState.sdCardIndex = (inputState.sdCardIndex + 1) % 2;
  setupSdCardSlots();
}

function confirmShowdown() {
  log('\n--- SHOWDOWN ---');
  log(`Hero [${gameState.heroPos}]: ${formatCard(gameState.heroCards[0])} ${formatCard(gameState.heroCards[1])}`);
  
  Object.keys(inputState.sdPlayers).forEach(pos => {
    const val = inputState.sdPlayers[pos];
    if (val === 'MUCK') {
      log(`${pos}: MUCK`);
    } else {
      log(`${pos}: ${val[0] ? formatCard(val[0]) : '?'} ${val[1] ? formatCard(val[1]) : '?'}`);
    }
  });

  log(`\nショーダウン終了 (最終ポット: ${gameState.pot} BB)`);
  gameState.street = 'END';
  document.getElementById('showdownModal').style.display = 'none';
  
  saveHandToHistory();
  renderTable();
  updateUI();
}

// --- リセット & 履歴連携 ---
function resetHand() {
  gameState.heroCards = [null, null];
  document.getElementById('card1').textContent = '1枚目: ?';
  document.getElementById('card2').textContent = '2枚目: ?';
  selectCardSlot(0);

  document.getElementById('setupModal').style.display = 'flex';
}

function saveHandToHistory() {
  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");
  
  const item = {
    id: Date.now(),
    timestamp: Date.now(),
    summary: `${gameState.heroPos} [${formatCard(gameState.heroCards[0])} ${formatCard(gameState.heroCards[1])}] (POT: ${gameState.pot} BB)`,
    playerCount: gameState.tableSize,
    favorite: false,
    logs: [...gameState.logs]
  };
  
  history.unshift(item);
  localStorage.setItem("poker_hand_history", JSON.stringify(history));
}