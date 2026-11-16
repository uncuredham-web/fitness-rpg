// ui.js（図鑑・累計記録・URL同期対応版）

window.onload = async () => {
  // 1. URLに引き継ぎデータ(?save=...)が含まれていたら自動復元
  const params = new URLSearchParams(window.location.search);
  const saveParam = params.get('save');
  if (saveParam) {
    try {
      const json = decodeURIComponent(escape(atob(saveParam)));
      playerState = JSON.parse(json);
      saveGame();
      // URLからパラメータを消してスッキリさせる
      window.history.replaceState({}, document.title, window.location.pathname);
      addLog('📲 引き継ぎURLからセーブデータを自動復元しました！');
    } catch (e) {
      addLog('❌ 引き継ぎURLの読み込みに失敗しました。');
    }
  }

  const isUnlocked = localStorage.getItem('batting_unlocked') === 'true';
  document.getElementById('batting-unlock-check').checked = isUnlocked;
  toggleBattingLock(false);

  const loaded = await loadMasterDataFromSheet();
  if (loaded) {
    addLog('☁️ スプレッドシートから最新の装備データを読み込みました！');
  }

  updateUI();
};

// 画面タブの切り替え（冒険画面 / 図鑑・記録画面）
function switchScreen(screenName) {
  document.getElementById('screen-adventure').style.display = (screenName === 'adventure') ? 'block' : 'none';
  document.getElementById('screen-record').style.display = (screenName === 'record') ? 'block' : 'none';
  
  document.getElementById('nav-adventure').classList.toggle('active', screenName === 'adventure');
  document.getElementById('nav-record').classList.toggle('active', screenName === 'record');

  if (screenName === 'record') renderRecordScreen();
}

function renderRecordScreen() {
  const s = playerState.stats;
  document.getElementById('stat-days').textContent = `${s.adventureCount} 回`;
  document.getElementById('stat-distance').textContent = `${(s.totalDistance / 1000).toFixed(2)} km (${s.walkingMin}分)`;
  document.getElementById('stat-stretch').textContent = `${s.stretchMin} 分`;
  document.getElementById('stat-batting').textContent = `${s.battingBalls} 球`;

  // 図鑑リストの描画
  const listEl = document.getElementById('catalog-list');
  document.getElementById('catalog-count').textContent = `${playerState.catalog.length} 種類発見`;
  listEl.innerHTML = '';

  if (playerState.catalog.length === 0) {
    listEl.innerHTML = '<p class="empty-msg">まだ装備を発見していません。冒険に出発しよう！</p>';
    return;
  }

  // 新しく手に入れた順に表示
  [...playerState.catalog].reverse().forEach(itemName => {
    const div = document.createElement('div');
    div.className = 'catalog-item';
    div.textContent = `🗡️ ${itemName}`;
    listEl.appendChild(div);
  });
}

function toggleBattingLock(save = true) {
  const isUnlocked = document.getElementById('batting-unlock-check').checked;
  const row = document.getElementById('row-batting');
  const label = document.getElementById('label-batting');
  const input = document.getElementById('input-batting');
  const btns = document.getElementById('btns-batting');

  if (isUnlocked) {
    row.classList.remove('locked-row');
    label.innerHTML = '⚾ バッティング <small>（上位戦闘・高レア武器）</small>';
    input.disabled = false;
    btns.style.display = 'grid';
  } else {
    row.classList.add('locked-row');
    label.innerHTML = '🔒 バッティング <small>（肩回復後に解禁）</small>';
    input.disabled = true;
    input.value = 0;
    btns.style.display = 'none';
  }
  if (save) localStorage.setItem('batting_unlocked', isUnlocked);
}

function addVal(type, val) {
  const input = document.getElementById('input-' + type);
  input.value = (parseInt(input.value) || 0) + val;
}

function setVal(type, val) {
  document.getElementById('input-' + type).value = val;
}

function handleSleep(hours) {
  const res = recordSleep(hours);
  res.logs.forEach(addLog);
  updateUI();
}

function handleDailyAdventure() {
  const inputs = {
    walking: parseInt(document.getElementById('input-walking').value) || 0,
    stretch: parseInt(document.getElementById('input-stretch').value) || 0,
    batting: parseInt(document.getElementById('input-batting').value) || 0
  };
  const res = executeDailyAdventure(inputs);
  if (res.error) { addLog('❌ ' + res.error); return; }

  addLog('=== 本日の冒険結果 ===');
  [...res.logs].reverse().forEach(addLog);
  setVal('walking', 0); setVal('stretch', 0); setVal('batting', 0);
  updateUI();
}

function handleUpgrade(slot) {
  const res = upgradeEquipment(slot);
  if (res.error) { addLog('❌ ' + res.error); return; }
  res.logs.forEach(addLog);
  updateUI();
}

function addLog(text) {
  const box = document.getElementById('log-container');
  const p = document.createElement('p');
  p.className = 'log-entry';
  p.textContent = text;
  box.prepend(p);
}

function updateUI() {
  document.getElementById('ui-level').textContent = playerState.level;
  document.getElementById('ui-exp').textContent = playerState.exp;
  document.getElementById('ui-next-exp').textContent = playerState.level * 100;
  document.getElementById('ui-stones').textContent = playerState.stones;

  const buffBadge = document.getElementById('ui-buff-badge');
  buffBadge.textContent = playerState.buff.active ? `${playerState.buff.rank} (+${playerState.buff.dropBonus}%)` : playerState.buff.rank;
  buffBadge.className = 'buff-badge ' + (playerState.buff.active ? 'active' : '');

  ['weapon', 'armor', 'charm'].forEach(slot => {
    const eq = playerState.equipped[slot];
    document.getElementById(`eq-${slot}-name`).textContent = eq.fullName || eq.name;
    document.getElementById(`eq-${slot}-opt`).textContent = `性能: ${eq.power} / ${eq.optionLabel}`;
    const cost = Math.max(5, Math.floor(eq.power / 3));
    document.getElementById(`cost-${slot}`).textContent = `${cost}石`;
  });
}

// 引き継ぎ用URLを生成してコピー
function copySyncUrl() {
  const json = JSON.stringify(playerState);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  const syncUrl = `${window.location.origin}${window.location.pathname}?save=${encoded}`;
  navigator.clipboard.writeText(syncUrl).then(() => {
    alert('引き継ぎ用URLをコピーしました！\nLINEやメモ帳に貼り付けて、別の端末でそのURLを開くとデータが同期されます。');
  });
}
function resetSaveData() {
  if (!confirm('本当にすべてのセーブデータと記録を初期化しますか？\n（この操作は取り消せません）')) {
    return;
  }
  localStorage.removeItem('hakusura_fitness_save_v2');
  localStorage.removeItem('hakusura_fitness_save_v1');
  location.reload();
}
