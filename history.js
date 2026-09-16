let currentFilter = 'all';

window.addEventListener('DOMContentLoaded', () => {
  renderHistory();
});

function openGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.style.display = 'flex';
}

function closeGuideModal() {
  const modal = document.getElementById('guideModal');
  if (modal) modal.style.display = 'none';
}

function renderHistory() {
  const historyList = document.getElementById("historyList");
  if (!historyList) return;

  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");

  if (history.length === 0) {
    historyList.innerHTML = `<div class="empty-msg" style="text-align:center; color:#888; padding:40px;">保存された履歴はありません。</div>`;
    return;
  }

  let filtered = history;
  if (currentFilter === 'fav') {
    filtered = history.filter(h => h.favorite);
  }

  if (filtered.length === 0) {
    historyList.innerHTML = `<div class="empty-msg" style="text-align:center; color:#888; padding:40px;">お気に入りの履歴はありません。</div>`;
    return;
  }

  historyList.innerHTML = "";

  filtered.forEach(item => {
    const card = document.createElement("div");
    card.className = `history-card ${item.favorite ? 'favorite' : ''}`;

    const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString("ja-JP") : (item.date || '');
    const logsText = Array.isArray(item.logs) ? item.logs.join("\n") : '';

    card.innerHTML = `
      <div class="history-card-header">
        <span class="star-btn ${item.favorite ? 'active' : ''}" onclick="toggleFavorite(${item.id})" style="cursor:pointer; font-size:1.2rem; margin-right:8px;">${item.favorite ? '★' : '☆'}</span>
        <span class="history-summary"><strong>${item.summary || 'ハンド履歴'}</strong></span>
        <div class="card-header-actions" style="margin-left:auto; display:flex; gap:6px;">
          <button class="btn-copy-history" onclick="copyLogsFromHistory(${item.id})">コピー</button>
          <button class="btn-delete-item" onclick="deleteHistory(${item.id})">削除</button>
        </div>
      </div>
      <div class="history-date" style="font-size:0.85rem; color:#aaa; margin:4px 0;">${dateStr} ${item.playerCount ? `(${item.playerCount}-max)` : ''}</div>
      <div class="history-logs" style="white-space:pre-wrap; font-family:monospace; background:#1e1e1e; color:#ddd; padding:10px; border-radius:4px; font-size:0.85rem; line-height:1.4;">${escapeHtml(logsText)}</div>
    `;

    historyList.appendChild(card);
  });
}

function filterHistory(filterType) {
  currentFilter = filterType;
  const btnAll = document.getElementById("filterAll");
  const btnFav = document.getElementById("filterFav");
  
  if (btnAll) btnAll.classList.toggle("active", filterType === 'all');
  if (btnFav) btnFav.classList.toggle("active", filterType === 'fav');
  
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
  const history = JSON.parse(localStorage.getItem("poker_hand_history") || "[]");
  if (history.length === 0) {
    alert("削除する履歴がありません。");
    return;
  }

  if (confirm("すべての履歴を削除しますか？（復元できません）")) {
    localStorage.removeItem("poker_hand_history");
    renderHistory();
  }
}

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
  if (!str) return '';
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
}