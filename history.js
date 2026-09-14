let currentFilter = 'all';

window.onload = () => {
  renderHistory();
};

function renderHistory() {
  const historyList = document.getElementById("historyList");
  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");

  if (history.length === 0) {
    historyList.innerHTML = `<div class="empty-msg">保存された履歴はありません。</div>`;
    return;
  }

  let filtered = history;
  if (currentFilter === 'fav') {
    filtered = history.filter(h => h.favorite);
  }

  if (filtered.length === 0) {
    historyList.innerHTML = `<div class="empty-msg">お気に入りの履歴はありません。</div>`;
    return;
  }

  historyList.innerHTML = "";

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = `history-card ${item.favorite ? 'favorite' : ''}`;

    const dateStr = new Date(item.timestamp).toLocaleString("ja-JP");
    const logsText = item.logs.join("\n");

    card.innerHTML = `
      <div class="history-card-header">
        <span class="star-btn ${item.favorite ? 'active' : ''}" onclick="toggleFavorite(${item.id})">★</span>
        <span class="history-summary">${item.summary}</span>
        <div class="card-header-actions">
          <button class="btn-copy-history" onclick="copyLogsFromHistory(${item.id})">コピー</button>
          <button class="btn-delete-item" onclick="deleteHistory(${item.id})">削除</button>
        </div>
      </div>
      <div class="history-date">${dateStr} (${item.playerCount}-max)</div>
      <div class="history-logs">${escapeHtml(logsText)}</div>
    `;

    historyList.appendChild(card);
  });
}

function filterHistory(filterType) {
  currentFilter = filterType;
  document.getElementById("filterAll").classList.toggle("active", filterType === 'all');
  document.getElementById("filterFav").classList.toggle("active", filterType === 'fav');
  renderHistory();
}

function toggleFavorite(id) {
  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");
  const target = history.find(h => h.id === id);
  if (target) {
    target.favorite = !target.favorite;
    localStorage.setItem("poker_hand_history", JSON.stringify(history));
    renderHistory();
  }
}

function deleteHistory(id) {
  if (confirm("この履歴を削除しますか？")) {
    let history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");
    history = history.filter(h => h.id !== id);
    localStorage.setItem("poker_hand_history", JSON.stringify(history));
    renderHistory();
  }
}

function clearAllHistory() {
  if (confirm("すべての履歴を削除しますか？（復元できません）")) {
    localStorage.removeItem("poker_hand_history");
    renderHistory();
  }
}

// 履歴個別ログのコピー機能
function copyLogsFromHistory(id) {
  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");
  const target = history.find(h => h.id === id);
  
  if (target && target.logs) {
    const textToCopy = target.logs.join("\n");
    navigator.clipboard.writeText(textToCopy).then(() => {
      alert("このハンドのログをクリップボードにコピーしました！");
    }).catch(err => {
      console.error("Copy failed", err);
      alert("コピーに失敗しました");
    });
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}