// 2〜9名に対応するポジションマップ定義
const POSITIONS = {
  2: ['SB', 'BB'],
  3: ['SB', 'BB', 'BTN'],
  4: ['SB', 'BB', 'CO', 'BTN'],
  5: ['SB', 'BB', 'MP', 'CO', 'BTN'],
  6: ['SB', 'BB', 'UTG', 'MP', 'CO', 'BTN'],
  7: ['SB', 'BB', 'UTG', 'MP', 'HJ', 'CO', 'BTN'],
  8: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN'],
  9: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN', 'UTG+2']
};

let historyStack = [];
let currentIndex = -1;

// Heroカード選択用
let heroCards = ['', ''];
let selectedSlot = 0;
let tempRank = '';

// ボード入力用
let currentBoardTargetStreet = '';
let targetBoardCount = 3;
let tempBoardCards = [];
let tempBoardRank = '';
let boardSelectedSlotIndex = 0;

// ベット額手入力用
let customBetStr = '2.5';

window.onload = () => { updatePositions(); };

function updatePositions() {
  const size = document.getElementById('tableSizeSelect').value;
  const select = document.getElementById('heroPosSelect');
  select.innerHTML = '';
  if (POSITIONS[size]) {
    POSITIONS[size].forEach(pos => {
      const opt = document.createElement('option');
      opt.value = pos;
      opt.textContent = pos;
      select.appendChild(opt);
    });
  }
}

// 既に使用されているカードを取得するヘルパー関数
function getUsedCards(excludeCurrentSlot = true, isBoardMode = false) {
  const used = new Set();

  if (currentIndex >= 0 && historyStack[currentIndex]) {
    historyStack[currentIndex].board.forEach(c => used.add(c));
  }

  if (!isBoardMode) {
    heroCards.forEach((c, idx) => {
      if (c && !(excludeCurrentSlot && idx === selectedSlot)) {
        used.add(c);
      }
    });
  } else {
    heroCards.forEach(c => { if (c) used.add(c); });
    tempBoardCards.forEach((c, idx) => {
      if (c && !(excludeCurrentSlot && idx === boardSelectedSlotIndex)) {
        used.add(c);
      }
    });
  }

  return used;
}

function updateSuitButtonsState(modalSelector, selectedRank, isBoardMode = false) {
  const suits = ['s', 'h', 'd', 'c'];
  const usedCards = getUsedCards(true, isBoardMode);

  suits.forEach(suit => {
    const btn = document.querySelector(`${modalSelector} .suit-${suit}`);
    if (btn) {
      if (selectedRank) {
        const targetCard = selectedRank + suit;
        if (usedCards.has(targetCard)) {
          btn.disabled = true;
          btn.style.opacity = '0.2';
          btn.style.cursor = 'not-allowed';
        } else {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        }
      } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
      }
    }
  });
}

function selectCardSlot(index) {
  selectedSlot = index;
  document.getElementById('card1').classList.toggle('active', index === 0);
  document.getElementById('card2').classList.toggle('active', index === 1);
  clearRankSelection('#setupModal');
}

function pickRank(rank) { 
  tempRank = rank;
  highlightSelectedRank('#setupModal', rank);
  updateSuitButtonsState('#setupModal', rank, false);
}

function pickSuit(suit) {
  if (!tempRank) return alert('先に数字(ランク)を選択してください');
  const cardStr = tempRank + suit.toLowerCase();
  
  const usedCards = getUsedCards(true, false);
  if (usedCards.has(cardStr)) {
    return alert(`カード ${cardStr} はすでに入力・使用されています。`);
  }

  heroCards[selectedSlot] = cardStr;
  document.getElementById(`card${selectedSlot + 1}`).textContent = cardStr;
  
  clearRankSelection('#setupModal');
  if (selectedSlot === 0) selectCardSlot(1);
  tempRank = '';
}

function pickBoardRank(rank) {
  tempBoardRank = rank;
  highlightSelectedRank('#boardModal', rank);
  updateSuitButtonsState('#boardModal', rank, true);
}

function pickBoardSuit(suit) {
  if (!tempBoardRank) return alert('先に数字(ランク)を選択してください');
  const cardStr = tempBoardRank + suit.toLowerCase();
  
  const usedCards = getUsedCards(true, true);
  if (usedCards.has(cardStr)) {
    return alert(`カード ${cardStr} はすでに入力・使用されています。`);
  }

  tempBoardCards[boardSelectedSlotIndex] = cardStr;
  document.getElementById(`boardSlot${boardSelectedSlotIndex}`).textContent = cardStr;

  clearRankSelection('#boardModal');

  if (boardSelectedSlotIndex < targetBoardCount - 1) {
    boardSelectedSlotIndex++;
    document.querySelectorAll('#boardSelectedSlots .card-slot').forEach((s, idx) => {
      s.classList.toggle('active', idx === boardSelectedSlotIndex);
    });
  }

  if (tempBoardCards.every(c => c !== '')) {
    document.getElementById('boardConfirmBtn').disabled = false;
  }
  tempBoardRank = '';
}

function highlightSelectedRank(modalSelector, rank) {
  const buttons = document.querySelectorAll(`${modalSelector} .keypad-ranks button`);
  buttons.forEach(btn => {
    if (btn.textContent === (rank === 'T' ? '10' : rank)) {
      btn.classList.add('selected');
    } else {
      btn.classList.remove('selected');
    }
  });
}

function clearRankSelection(modalSelector) {
  const buttons = document.querySelectorAll(`${modalSelector} .keypad-ranks button`);
  buttons.forEach(btn => btn.classList.remove('selected'));
  updateSuitButtonsState(modalSelector, '', modalSelector === '#boardModal');
}

function startHand() {
  if (!heroCards[0] || !heroCards[1]) return alert('Heroのハンドを2枚選択してください');
  if (heroCards[0] === heroCards[1]) return alert('同じカードを2枚選択することはできません');

  const size = parseInt(document.getElementById('tableSizeSelect').value);
  const heroPos = document.getElementById('heroPosSelect').value;

  const initialPlayers = POSITIONS[size].map((pos, idx) => ({
    seat: idx,
    position: pos,
    isHero: pos === heroPos,
    isFolded: false,
    currentBet: pos === 'SB' ? 0.5 : (pos === 'BB' ? 1.0 : 0),
    hasActed: false
  }));

  const firstTurnIndex = size === 2 ? 0 : 2 % size;

  const initialState = {
    handId: 'hand_' + Date.now(),
    heroPos: heroPos,
    heroCards: [...heroCards],
    street: 'PREFLOP',
    pot: 1.5,
    highestBet: 1.0,
    activeTurnIndex: firstTurnIndex,
    board: [],
    players: initialPlayers,
    logs: [`--- PREFLOP (Hero: ${heroPos} [${heroCards.join(' ')}]) ---`]
  };

  historyStack = [];
  currentIndex = -1;
  pushState(initialState);
  document.getElementById('setupModal').style.display = 'none';
}

function pushState(newState) {
  historyStack = historyStack.slice(0, currentIndex + 1);
  historyStack.push(JSON.parse(JSON.stringify(newState)));
  currentIndex = historyStack.length - 1;
  render();
}

function undo() {
  if (currentIndex > 0) {
    currentIndex--;
    render();
  }
}

function resetHand() {
  heroCards = ['', ''];
  document.getElementById('card1').textContent = '1枚目: ?';
  document.getElementById('card2').textContent = '2枚目: ?';
  selectCardSlot(0);
  document.getElementById('setupModal').style.display = 'flex';
}

function handleCheckCall() {
  const state = historyStack[currentIndex];
  const player = state.players[state.activeTurnIndex];
  const callAmount = state.highestBet - player.currentBet;
  
  if (callAmount === 0) {
    handleAction('CHECK', 0);
  } else {
    handleAction('CALL', callAmount);
  }
}

function handleSizingAction(multiplier) {
  const state = historyStack[currentIndex];
  if (!state) return;

  const baseBet = state.highestBet > 0 ? state.highestBet : 1.0;
  const targetAmount = Math.round(baseBet * multiplier * 10) / 10;

  const type = state.highestBet > 0 ? 'RAISE' : 'BET';
  handleAction(type, targetAmount);
}

function openCustomBetModal() {
  const state = historyStack[currentIndex];
  if (!state) return;

  const minBet = state.highestBet > 0 ? state.highestBet * 2 : 2.0;
  customBetStr = minBet.toFixed(1);
  document.getElementById('customBetValue').textContent = customBetStr;
  document.getElementById('customBetModal').style.display = 'flex';
}

function closeCustomBetModal() {
  document.getElementById('customBetModal').style.display = 'none';
}

function appendBetNum(num) {
  if (num === '.' && customBetStr.includes('.')) return;
  if (customBetStr === '0' || customBetStr === '') {
    customBetStr = num === '.' ? '0.' : num;
  } else {
    customBetStr += num;
  }
  document.getElementById('customBetValue').textContent = customBetStr;
}

function clearBetNum() {
  customBetStr = '0';
  document.getElementById('customBetValue').textContent = customBetStr;
}

function confirmCustomBet() {
  const val = parseFloat(customBetStr);
  if (isNaN(val) || val <= 0) return alert('正しいBB数を入力してください');
  
  closeCustomBetModal();
  const state = historyStack[currentIndex];
  const type = state.highestBet > 0 ? 'RAISE' : 'BET';
  handleAction(type, val);
}

function handleAction(type, amount) {
  const state = JSON.parse(JSON.stringify(historyStack[currentIndex]));
  const player = state.players[state.activeTurnIndex];

  let logMsg = '';

  if (type === 'FOLD') {
    player.isFolded = true;
    logMsg = `${player.position}: FOLD`;
  } else if (type === 'CHECK') {
    player.hasActed = true;
    logMsg = `${player.position}: CHECK`;
  } else if (type === 'CALL') {
    state.pot += amount;
    player.currentBet += amount;
    player.hasActed = true;
    logMsg = `${player.position}: CALL ${amount.toFixed(1)}BB`;
  } else if (type === 'BET' || type === 'RAISE') {
    const addAmount = amount - player.currentBet;
    state.pot += addAmount;
    player.currentBet = amount;
    state.highestBet = amount;
    player.hasActed = true;
    
    state.players.forEach(p => {
      if (!p.isFolded && p.position !== player.position) p.hasActed = false;
    });
    logMsg = `${player.position}: ${type} ${amount}BB`;
  }

  state.logs.push(logMsg);

  const activePlayers = state.players.filter(p => !p.isFolded);
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    state.street = 'FINISHED';
    state.logs.push(`--- ${winner.position} の勝利 (全員Fold) / Pot: ${state.pot.toFixed(1)}BB ---`);
    pushState(state);
    saveCurrentHandToStorage(state);
    return;
  }

  if (checkStreetComplete(state)) {
    moveToNextStreet(state);
    return;
  }

  let nextIndex = (state.activeTurnIndex + 1) % state.players.length;
  while (state.players[nextIndex].isFolded) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }
  state.activeTurnIndex = nextIndex;

  pushState(state);
}

function checkStreetComplete(state) {
  const activePlayers = state.players.filter(p => !p.isFolded);
  const allMatched = activePlayers.every(p => p.currentBet === state.highestBet);
  const allActed = activePlayers.every(p => p.hasActed);
  return allMatched && allActed;
}

function moveToNextStreet(state) {
  state.players.forEach(p => {
    p.currentBet = 0;
    p.hasActed = false;
  });
  state.highestBet = 0;

  if (state.street === 'PREFLOP') {
    openBoardModal('FLOP', 3, state);
  } else if (state.street === 'FLOP') {
    openBoardModal('TURN', 1, state);
  } else if (state.street === 'TURN') {
    openBoardModal('RIVER', 1, state);
  } else {
    state.street = 'SHOWDOWN';
    state.logs.push(`--- SHOWDOWN / 終了 ---`);
    pushState(state);
    saveCurrentHandToStorage(state);
  }
}

function openBoardModal(targetStreet, count, state) {
  currentBoardTargetStreet = targetStreet;
  targetBoardCount = count;
  tempBoardCards = new Array(count).fill('');
  boardSelectedSlotIndex = 0;

  document.getElementById('boardModalTitle').textContent = `${targetStreet} カードを選択 (${count}枚)`;

  const slotsContainer = document.getElementById('boardSelectedSlots');
  slotsContainer.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const div = document.createElement('div');
    div.className = `card-slot ${i === 0 ? 'active' : ''}`;
    div.id = `boardSlot${i}`;
    div.textContent = `${i+1}枚目: ?`;
    div.onclick = () => {
      boardSelectedSlotIndex = i;
      document.querySelectorAll('#boardSelectedSlots .card-slot').forEach((s, idx) => {
        s.classList.toggle('active', idx === i);
      });
      clearRankSelection('#boardModal');
    };
    slotsContainer.appendChild(div);
  }

  clearRankSelection('#boardModal');
  document.getElementById('boardConfirmBtn').disabled = true;
  document.getElementById('boardModal').style.display = 'flex';
  pushState(state);
}

function confirmBoardCards() {
  document.getElementById('boardModal').style.display = 'none';
  const state = JSON.parse(JSON.stringify(historyStack[currentIndex]));

  state.street = currentBoardTargetStreet;
  state.board.push(...tempBoardCards);
  state.logs.push(`--- ${currentBoardTargetStreet} [ ${tempBoardCards.join(' ')} ] (Pot: ${state.pot.toFixed(1)}BB) ---`);

  let nextTurn = 0;
  while (state.players[nextTurn].isFolded) {
    nextTurn = (nextTurn + 1) % state.players.length;
  }
  state.activeTurnIndex = nextTurn;

  pushState(state);
}

// ローカルストレージ自動保存＆最大50件ローテーション処理
function saveCurrentHandToStorage(finalState) {
  const storageKey = 'poker_hand_history';
  let history = JSON.parse(localStorage.getItem(storageKey) || '[]');

  const existingIdx = history.findIndex(h => h.id === finalState.handId);
  const now = new Date();
  const dateStr = `${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  const handData = {
    id: finalState.handId,
    timestamp: dateStr,
    heroPos: finalState.heroPos,
    heroCards: finalState.heroCards,
    pot: finalState.pot.toFixed(1),
    logs: finalState.logs,
    isFavorite: existingIdx >= 0 ? history[existingIdx].isFavorite : false
  };

  if (existingIdx >= 0) {
    history[existingIdx] = handData;
  } else {
    history.unshift(handData);
  }

  // 50件超え時にお気に入り以外の最古ハンドを削除
  if (history.length > 50) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].isFavorite) {
        history.splice(i, 1);
        if (history.length <= 50) break;
      }
    }
  }

  localStorage.setItem(storageKey, JSON.stringify(history));
}

function render() {
  const state = historyStack[currentIndex];
  if (!state) return;

  document.getElementById('streetDisplay').textContent = state.street;
  document.getElementById('potDisplay').textContent = `Pot: ${state.pot.toFixed(1)} BB`;
  document.getElementById('undoBtn').disabled = currentIndex <= 0;
  document.getElementById('boardCardsDisplay').textContent = state.board.length > 0 ? state.board.join(' ') : 'なし';

  const seatsContainer = document.getElementById('tableSeats');
  seatsContainer.innerHTML = '';
  state.players.forEach((p, idx) => {
    const div = document.createElement('div');
    div.className = `seat-card ${idx === state.activeTurnIndex && state.street !== 'FINISHED' && state.street !== 'SHOWDOWN' ? 'active' : ''} ${p.isFolded ? 'folded' : ''} ${p.isHero ? 'hero' : ''}`;
    div.innerHTML = `
      <strong>${p.position} ${p.isHero ? '(Hero)' : ''}</strong><br>
      ${p.isFolded ? 'FOLD' : (p.currentBet > 0 ? `Bet: ${p.currentBet}BB` : '待機')}
    `;
    seatsContainer.appendChild(div);
  });

  if (state.street === 'FINISHED' || state.street === 'SHOWDOWN') {
    document.getElementById('currentTurnDisplay').textContent = 'ハンド終了';
    return;
  }

  const activePlayer = state.players[state.activeTurnIndex];
  document.getElementById('currentTurnDisplay').textContent = `${activePlayer.position} ${activePlayer.isHero ? '(Hero)' : ''}`;

  const callAmount = state.highestBet - activePlayer.currentBet;
  const checkCallBtn = document.getElementById('checkCallBtn');
  if (callAmount === 0) {
    checkCallBtn.textContent = 'CHECK';
    checkCallBtn.style.background = '#0275d8';
  } else {
    checkCallBtn.textContent = `CALL (${callAmount.toFixed(1)}BB)`;
    checkCallBtn.style.background = '#f0ad4e';
  }

  const raiseBtn = document.getElementById('raiseBtn');
  if (state.highestBet > 0) {
    raiseBtn.textContent = 'RAISE (手入力)';
  } else {
    raiseBtn.textContent = 'BET (手入力)';
  }

  const logArea = document.getElementById('logArea');
  logArea.innerHTML = state.logs.join('<br>');
  logArea.scrollTop = logArea.scrollHeight;
}