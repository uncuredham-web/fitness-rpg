// data.js（Googleスプレッドシート連携版）

// ★ここにスプレッドシートの「ウェブに公開（CSV）」のURLを貼り付ける
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTpISKIPd1Fy1Dg1rx93MDnGFtVWxSYdzlsWQLbvXb_ZRFzRWp41YfQoJnKGtHH97sbNHcvahFfBp-U/pub?gid=0&single=true&output=csv';

// 読み込み前やオフライン時用の予備データ
let RARITIES = [
  { id: 'common', name: '古びた', multiplier: 1.0, baseWeight: 60 },
  { id: 'rare', name: '名匠の', multiplier: 1.7, baseWeight: 10 },
  { id: 'legendary', name: '【伝説の】', multiplier: 3.2, baseWeight: 1 }
];

let OPTIONS = [
  { name: '疾風の', stat: 'speed', value: 10, label: '探索効率+10%' },
  { name: '会心の', stat: 'critRate', value: 5, label: '会心率+5%' }
];

let BASE_ITEMS = {
  walking: [{ name: 'ランニングシューズ', type: 'armor', basePower: 15 }],
  stretch: [{ name: '柔軟の木刀', type: 'weapon', basePower: 15 }],
  batting: [{ name: '超反発・金属バット', type: 'weapon', basePower: 35 }]
};

/**
 * スプレッドシートから最新マスターデータを読み込む
 */
async function loadMasterDataFromSheet() {
  if (!SHEET_CSV_URL.startsWith('http')) return false;

  try {
    // キャッシュを回避して常に最新を取得
    const res = await fetch(SHEET_CSV_URL + '&t=' + Date.now());
    const csvText = await res.text();
    const lines = csvText.trim().split('\n').slice(1); // 1行目(見出し)を除外

    const newRarities = [];
    const newOptions = [];
    const newItems = { walking: [], stretch: [], batting: [] };

    lines.forEach(line => {
      // カンマ区切りをパース（前後空白や\rを除去）
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      const [category, workout, slot, name, value, extra] = cols;

      if (category === 'rarity') {
        newRarities.push({
          id: slot,
          name: name,
          multiplier: parseFloat(value) || 1.0,
          baseWeight: parseInt(extra) || 10
        });
      } else if (category === 'option') {
        newOptions.push({
          name: name,
          stat: slot,
          value: parseInt(value) || 0,
          label: extra || ''
        });
      } else if (category === 'item' && newItems[workout]) {
        newItems[workout].push({
          name: name,
          type: slot,
          basePower: parseInt(value) || 10
        });
      }
    });

    if (newRarities.length > 0) RARITIES = newRarities;
    if (newOptions.length > 0) OPTIONS = newOptions;
    if (newItems.walking.length > 0) BASE_ITEMS = newItems;

    return true;
  } catch (e) {
    console.error('スプレッドシートの読み込みに失敗しました:', e);
    return false;
  }
}
