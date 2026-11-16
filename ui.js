// ui.js

// ui.js の冒頭部分を変更
window.onload = async () => {
  const isUnlocked = localStorage.getItem('batting_unlocked') === 'true';
  document.getElementById('batting-unlock-check').checked = isUnlocked;
  toggleBattingLock(false);

  // スプレッドシートから最新データを読み込み
  const loaded = await loadMasterDataFromSheet();
  if (loaded) {
    addLog('☁️ スプレッドシートから最新の装備データを読み込みました！');
  }

  updateUI();
};

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
  if (res.error) {
    addLog('❌ ' + res.error);
    return;
  }

  addLog('=== 本日の冒険結果 ===');
  [...res.logs].reverse().forEach(addLog);

  setVal('walking', 0);
  setVal('stretch', 0);
  setVal('batting', 0);
  updateUI();
}

function handleUpgrade(slot) {
  const res = upgradeEquipment(slot);
  if (res.error) {
    addLog('❌ ' + res.error);
    return;
  }
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

function exportSave() {
  const json = JSON.stringify(playerState);
  navigator.clipboard.writeText(json).then(() => alert('セーブデータをコピーしました！'));
}

function importSave() {
  const json = prompt('バックアップしたJSONを貼り付けてください:');
  if (!json) return;
  try {
    playerState = JSON.parse(json);
    saveGame();
    updateUI();
    addLog('✅ セーブデータを復元しました！');
  } catch (e) {
    alert('読み込みに失敗しました。');
  }
}
