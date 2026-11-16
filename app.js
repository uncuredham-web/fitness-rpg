// app.js（一括入力・コンボボーナス対応版）

const STORAGE_KEY = 'hakusura_fitness_save_v1';

const DEFAULT_STATE = {
  level: 1,
  exp: 0,
  stones: 0,
  totalDistance: 0,
  buff: { rank: '未記録', critRate: 0, dropBonus: 0, active: false },
  equipped: {
    weapon: { name: '初期の木の棒', power: 10, optionLabel: 'なし' },
    armor: { name: '普段着のジャージ', power: 10, optionLabel: 'なし' },
    charm: { name: 'お守りなし', power: 5, optionLabel: 'なし' }
  }
};

let playerState = loadGame();

// 1. 前日の睡眠時間を記録
function recordSleep(hours) {
  let rank = '寝不足';
  let bonus = 0;

  if (hours >= 7.5) {
    rank = '絶好調（ぐっすり）';
    bonus = 30;
  } else if (hours >= 6.0) {
    rank = '良好';
    bonus = 15;
  }

  playerState.buff = {
    rank: rank,
    critRate: bonus,
    dropBonus: bonus,
    active: bonus > 0
  };

  saveGame();
  return {
    logs: [`💤 睡眠時間 ${hours}時間を記録！体調は【${rank}】（会心＆レア発見率 +${bonus}%）`],
    playerState: playerState
  };
}

/**
 * 2. 複数の運動をまとめて1回の冒険として実行する
 * @param {Object} inputs - { walking: 分, stretch: 分, batting: 球 }
 */
function executeDailyAdventure(inputs) {
  const { walking = 0, stretch = 0, batting = 0 } = inputs;
  const activeTypes = [];
  if (walking > 0) activeTypes.push('walking');
  if (stretch > 0) activeTypes.push('stretch');
  if (batting > 0) activeTypes.push('batting');

  if (activeTypes.length === 0) {
    return { error: 'いずれかの運動に1以上の数値を入力してください' };
  }

  const logs = [];
  const baseRarityBonus = playerState.buff.active ? Math.floor(playerState.buff.dropBonus / 3) : 0;
  const critChance = 10 + (playerState.buff.active ? playerState.buff.critRate : 0);
  const baseAtk = playerState.equipped.weapon.power + Math.floor(playerState.equipped.charm.power / 2) + (playerState.level * 5);

  let totalExpGained = 0;

  // --- A. ウォーキング処理（探索） ---
  if (walking > 0) {
    const distance = walking * 80;
    playerState.totalDistance += distance;
    const bonus = baseRarityBonus + Math.floor(walking / 10) * 2;
    logs.push(`🚶 【探索】${walking}分のウォーキングで ${distance}m 奥へ進んだ！`);
    processDrop('walking', bonus, logs);
    totalExpGained += walking * 10;
  }

  // --- B. ストレッチ処理（基礎戦闘） ---
  if (stretch > 0) {
    const hits = Math.max(1, Math.floor(stretch / 2));
    const { totalDamage, critCount } = simulateBattle(baseAtk, hits, critChance);
    const bonus = baseRarityBonus + Math.floor(stretch / 10);
    logs.push(`🧘 【戦闘】${stretch}分のストレッチ！精密な動きで ${totalDamage} ダメージ（会心 ${critCount}回）！`);
    processDrop('stretch', bonus, logs);
    totalExpGained += stretch * 10;
  }

  // --- C. バッティング処理（上位戦闘） ---
  if (batting > 0) {
    const highAtk = Math.floor(baseAtk * 1.5);
    const { totalDamage, critCount } = simulateBattle(highAtk, batting, critChance);
    const bonus = baseRarityBonus + Math.floor(batting / 10) * 3;
    logs.push(`⚾ 【強襲】${batting}球のフルスイング！圧倒的火力で ${totalDamage} ダメージ（会心 ${critCount}回）！`);
    processDrop('batting', bonus, logs);
    totalExpGained += batting * 15;
  }

  // --- D. 複数種目コンボボーナス ---
  if (activeTypes.length >= 2) {
    const comboStones = activeTypes.length * 5;
    playerState.stones += comboStones;
    totalExpGained = Math.floor(totalExpGained * 1.2); // 経験値も1.2倍
    logs.push(`🔥 【${activeTypes.length}種目コンボ達成！】ボーナスで強化石 +${comboStones}個 ＆ 獲得EXP 1.2倍！`);
  }

  // --- E. 経験値・レベルアップ判定 ---
  playerState.exp += totalExpGained;
  let nextLevelExp = playerState.level * 100;
  while (playerState.exp >= nextLevelExp) {
    playerState.level++;
    playerState.exp -= nextLevelExp;
    nextLevelExp = playerState.level * 100;
    logs.push(`🎉 レベルアップ！ Lv.${playerState.level} になった！`);
  }

  saveGame();
  return { logs: logs, playerState: playerState };
}

// ドロップ抽選と自動装備・石変換の共通処理
function processDrop(workoutType, rarityBonus, logs) {
  const droppedItem = generateRandomEquipment(workoutType, rarityBonus);
  logs.push(`　🎁 発見：【${droppedItem.fullName}】（性能: ${droppedItem.power} / ${droppedItem.optionLabel}）`);

  const currentEquip = playerState.equipped[droppedItem.type];
  if (droppedItem.power > currentEquip.power) {
    const gainedStones = Math.max(1, Math.floor(currentEquip.power / 5));
    playerState.stones += gainedStones;
    playerState.equipped[droppedItem.type] = droppedItem;
    logs.push(`　⚔️ 装備更新！古い装備は強化石 ${gainedStones}個 に変換。`);
  } else {
    const gainedStones = Math.max(1, Math.floor(droppedItem.power / 5));
    playerState.stones += gainedStones;
    logs.push(`　💎 自動で強化石 ${gainedStones}個 に変換。`);
  }
}

// 3. 強化石による装備強化
function upgradeEquipment(slot) {
  const target = playerState.equipped[slot];
  const cost = Math.max(5, Math.floor(target.power / 3));

  if (playerState.stones < cost) {
    return { error: `強化石が足りません（必要: ${cost}個 / 所持: ${playerState.stones}個）` };
  }

  playerState.stones -= cost;
  const upValue = Math.max(2, Math.floor(target.power * 0.1));
  target.power += upValue;

  saveGame();
  return {
    logs: [`🔨 強化石を ${cost}個 消費し、【${target.name}】の性能が +${upValue}（合計 ${target.power}）に上がった！`],
    playerState: playerState
  };
}

// --- 内部ヘルパー関数 ---
function simulateBattle(atk, hits, critChance) {
  let totalDamage = 0;
  let critCount = 0;
  for (let i = 0; i < hits; i++) {
    const isCrit = Math.random() * 100 < critChance;
    totalDamage += isCrit ? Math.floor(atk * 1.8) : atk;
    if (isCrit) critCount++;
  }
  return { totalDamage, critCount };
}

function generateRandomEquipment(workoutType, bonusWeight) {
  const adjustedRarities = RARITIES.map(r => {
    const bonus = (r.id === 'common') ? 0 : bonusWeight;
    return { ...r, weight: r.baseWeight + bonus };
  });

  const totalWeight = adjustedRarities.reduce((sum, r) => sum + r.weight, 0);
  let randomVal = Math.random() * totalWeight;
  let selectedRarity = adjustedRarities;

  for (const r of adjustedRarities) {
    if (randomVal < r.weight) {
      selectedRarity = r;
      break;
    }
    randomVal -= r.weight;
  }

  const baseList = BASE_ITEMS[workoutType];
  const baseItem = baseList[Math.floor(Math.random() * baseList.length)];
  const option = OPTIONS[Math.floor(Math.random() * OPTIONS.length)];

  const typeBonus = (workoutType === 'batting') ? 1.2 : 1.0;
  const variance = 0.9 + (Math.random() * 0.2);
  const finalPower = Math.floor((baseItem.basePower + playerState.level * 2) * selectedRarity.multiplier * typeBonus * variance);

  return {
    type: baseItem.type,
    name: baseItem.name,
    fullName: `${selectedRarity.name}${option.name}${baseItem.name}`,
    rarity: selectedRarity.id,
    power: finalPower,
    optionLabel: option.label
  };
}

function saveGame() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(playerState));
}

function loadGame() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : JSON.parse(JSON.stringify(DEFAULT_STATE));
}
