// app.js（図鑑・累計記録・URL同期対応版）

const STORAGE_KEY = 'hakusura_fitness_save_v2';

const DEFAULT_STATE = {
  level: 1,
  exp: 0,
  stones: 0,
  buff: { rank: '未記録', critRate: 0, dropBonus: 0, active: false },
  equipped: {
    weapon: { name: '初期の木の棒', power: 10, optionLabel: 'なし' },
    armor: { name: '普段着のジャージ', power: 10, optionLabel: 'なし' },
    charm: { name: 'お守りなし', power: 5, optionLabel: 'なし' }
  },
  // 累計記録
  stats: {
    adventureCount: 0,
    walkingMin: 0,
    totalDistance: 0,
    stretchMin: 0,
    battingBalls: 0
  },
  // 装備図鑑（獲得したフルネームを重複なしで保存）
  catalog: []
};

let playerState = loadGame();

// 1. 睡眠記録
function recordSleep(hours) {
  let rank = '寝不足';
  let bonus = 0;
  if (hours >= 7.5) { rank = '絶好調（ぐっすり）'; bonus = 30; }
  else if (hours >= 6.0) { rank = '良好'; bonus = 15; }

  playerState.buff = { rank, critRate: bonus, dropBonus: bonus, active: bonus > 0 };
  saveGame();
  return {
    logs: [`💤 睡眠時間 ${hours}時間を記録！体調は【${rank}】（会心＆レア発見率 +${bonus}%）`],
    playerState
  };
}

// 2. 一括冒険処理
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
  playerState.stats.adventureCount += 1;

  if (walking > 0) {
    const distance = walking * 80;
    playerState.stats.walkingMin += walking;
    playerState.stats.totalDistance += distance;
    const bonus = baseRarityBonus + Math.floor(walking / 10) * 2;
    logs.push(`🚶 【探索】${walking}分のウォーキングで ${distance}m 奥へ進んだ！`);
    processDrop('walking', bonus, logs);
    totalExpGained += walking * 10;
  }

  if (stretch > 0) {
    playerState.stats.stretchMin += stretch;
    const hits = Math.max(1, Math.floor(stretch / 2));
    const { totalDamage, critCount } = simulateBattle(baseAtk, hits, critChance);
    const bonus = baseRarityBonus + Math.floor(stretch / 10);
    logs.push(`🧘 【戦闘】${stretch}分のストレッチ！精密な動きで ${totalDamage} ダメージ（会心 ${critCount}回）！`);
    processDrop('stretch', bonus, logs);
    totalExpGained += stretch * 10;
  }

  if (batting > 0) {
    playerState.stats.battingBalls += batting;
    const highAtk = Math.floor(baseAtk * 1.5);
    const { totalDamage, critCount } = simulateBattle(highAtk, batting, critChance);
    const bonus = baseRarityBonus + Math.floor(batting / 10) * 3;
    logs.push(`⚾ 【強襲】${batting}球のフルスイング！圧倒的火力で ${totalDamage} ダメージ（会心 ${critCount}回）！`);
    processDrop('batting', bonus, logs);
    totalExpGained += batting * 15;
  }

  if (activeTypes.length >= 2) {
    const comboStones = activeTypes.length * 5;
    playerState.stones += comboStones;
    totalExpGained = Math.floor(totalExpGained * 1.2);
    logs.push(`🔥 【${activeTypes.length}種目コンボ達成！】強化石 +${comboStones}個 ＆ 獲得EXP 1.2倍！`);
  }

  playerState.exp += totalExpGained;
  let nextLevelExp = playerState.level * 100;
  while (playerState.exp >= nextLevelExp) {
    playerState.level++;
    playerState.exp -= nextLevelExp;
    nextLevelExp = playerState.level * 100;
    logs.push(`🎉 レベルアップ！ Lv.${playerState.level} になった！`);
  }

  saveGame();
  return { logs, playerState };
}

function processDrop(workoutType, rarityBonus, logs) {
  const droppedItem = generateRandomEquipment(workoutType, rarityBonus);
  
  // 図鑑への新規登録判定
  const isNew = !playerState.catalog.includes(droppedItem.fullName);
  if (isNew) {
    playerState.catalog.push(droppedItem.fullName);
  }
  const newBadge = isNew ? '【✨NEW図鑑登録！】' : '';
  logs.push(`　🎁 発見：${newBadge}【${droppedItem.fullName}】（性能: ${droppedItem.power} / ${droppedItem.optionLabel}）`);

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
    playerState
  };
}

function simulateBattle(atk, hits, critChance) {
  let totalDamage = 0, critCount = 0;
  for (let i = 0; i < hits; i++) {
    const isCrit = Math.random() * 100 < critChance;
    totalDamage += isCrit ? Math.floor(atk * 1.8) : atk;
    if (isCrit) critCount++;
  }
  return { totalDamage, critCount };
}

function generateRandomEquipment(workoutType, bonusWeight) {
  const adjustedRarities = RARITIES.map(r => ({
    ...r,
    weight: r.baseWeight + ((r.id === 'common') ? 0 : bonusWeight)
  }));
  const totalWeight = adjustedRarities.reduce((sum, r) => sum + r.weight, 0);
  let randomVal = Math.random() * totalWeight;
  let selectedRarity = adjustedRarities;

  for (const r of adjustedRarities) {
    if (randomVal < r.weight) { selectedRarity = r; break; }
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
  const saved = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('hakusura_fitness_save_v1');
  if (!saved) return JSON.parse(JSON.stringify(DEFAULT_STATE));
  const parsed = JSON.parse(saved);
  // 旧バージョンからの引き継ぎ時に不足プロパティを補完
  return {
    ...DEFAULT_STATE,
    ...parsed,
    stats: { ...DEFAULT_STATE.stats, ...(parsed.stats || {}) },
    catalog: parsed.catalog || []
  };
}
