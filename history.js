let currentFilter = 'all';

window.onload = () => {
  renderHistory();
};

function getSavedHands() {
  const data = localStorage.getItem('poker_hand_history');
  return data ? JSON.parse(data) : [];
}

function saveHands(hands) {
  localStorage.setItem('poker_hand_history', JSON.stringify(hands));
}

function filterHistory(type) {
  currentFilter = type;
  document.getElementById('filterAll').classList.toggle('active', type === 'all');
  document.getElementById('filterFav').classList.toggle('active', type === 'fav');
  renderHistory();
}

function toggleFavorite(id) {
  const hands = getSavedHands();
  const target = hands.find(h => h.id === id);
  if (target) {
    target.isFavorite = !target.isFavorite;
    saveHands(hands);
    renderHistory();
  }
}

function deleteHand(id) {
  if (!confirm('このハンド履歴を削除しますか？')) return;
  let hands = getSavedHands();
  hands = hands.filter(h => h.id !== id);
  saveHands(hands);
  renderHistory();
}

function clearAllHistory() {
  if (!confirm('お気に入り以外の履歴をすべて削除しますか？')) return;
  let hands = getSavedHands();
  hands = hands.filter(h => h.isFavorite);
  saveHands(hands);
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('historyList');
  let hands = getSavedHands();

  if (currentFilter === 'fav') {
    hands = hands.filter(h => h.isFavorite);
  }

  if (hands.length === 0) {
    container.innerHTML = '<div class="empty-msg">保存されたハンド履歴はありません。</div>';
    return;
  }

  container.innerHTML = '';
  hands.forEach(hand => {
    const card = document.createElement('div');
    card.className = `history-card ${hand.isFavorite ? 'favorite' : ''}`;
    
    const logsHtml = hand.logs.map(log => `<div>${log}</div>`).join('');

    card.innerHTML = `
      <div class="history-card-header">
        <span class="star-btn ${hand.isFavorite ? 'active' : ''}" onclick="toggleFavorite('${hand.id}')">★</span>
        <span class="history-date">${hand.timestamp}</span>
        <span class="history-summary">${hand.heroPos} [${hand.heroCards.join(' ')}] / Pot: ${hand.pot}BB</span>
        <button class="btn-delete-item" onclick="deleteHand('${hand.id}')">削除</button>
      </div>
      <div class="history-logs">
        ${logsHtml}
      </div>
    `;
    container.appendChild(card);
  });
}