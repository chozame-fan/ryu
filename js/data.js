// ちびリューのまち：きのみ・なかまになるポケモン・成長の決まりごと
// （自分で遊ぶだけのファンゲーム。絵はすべてコードで描いたデフォルメ）

const BERRIES = {
  oren:  { name: 'オレンのみ', color: '#4f86e0', light: '#9cc1ff', food: 28, desc: 'あおくて まるい。ちびリューの だいこうぶつ。' },
  momon: { name: 'モモンのみ', color: '#f08cb0', light: '#ffc6da', food: 24, desc: 'ももいろで あまい。' },
  kurabo:{ name: 'クラボのみ', color: '#e2483c', light: '#ff9a8c', food: 22, desc: 'あかくて ピリッと からい。' },
  nana:  { name: 'ナナのみ',   color: '#f2c63a', light: '#ffe68a', food: 26, desc: 'きいろくて ほくほく。' },
  chigo: { name: 'チーゴのみ', color: '#7c5cc4', light: '#b9a2ee', food: 22, desc: 'むらさきで すっぱい。' },
};
const BERRY_IDS = Object.keys(BERRIES);

// ほかのポケモンは「とりあえずいらない」（10-24 ユーザー）→ 出さない。絵のコードは art.js に残してある。
const MONS = [];

// たんけんで見つける たからもの（x,y はタイル。night＝夜だけ光る / adult＝おとなでないと行けない場所）
const TREASURES = [
  { id: 'clover', name: 'よつばの クローバー', icon: '🍀', x: 10, y: 4,  hint: 'おはなばたけの どこかに',           desc: 'みつけると いいことが ありそう。' },
  { id: 'mizu',   name: 'みずの いし',       icon: '💧', x: 23, y: 15, hint: 'もりの いけの ほとり',             desc: 'ひんやり すきとおった いし。' },
  { id: 'hono',   name: 'ほのおの いし',     icon: '🔥', x: 70, y: 13, hint: 'いわやまの ようがんの そば',       desc: 'さわると ほんのり あたたかい。' },
  { id: 'rousoku',name: 'ふしぎな ろうそく', icon: '🕯️', x: 44, y: 12, hint: 'よるの おやしきの まえで…',       desc: 'ひとりでに あおい ひが ともる。', night: 1 },
  { id: 'hoshi',  name: 'ほしの すな',       icon: '✨', x: 55, y: 46, hint: 'よるの すなはまで きらきら',       desc: 'ながれぼしの かけら らしい。', night: 1 },
  { id: 'kiba',   name: 'ドラゴンの キバ',   icon: '🦷', x: 43, y: 53, hint: 'さんばしの いちばん さき',         desc: 'りっぱな ドラゴンの おとしもの。' },
  { id: 'taiyo',  name: 'たいようの いし',   icon: '☀️', x: 75, y: 38, hint: 'いわやまの みなみの はしっこ',     desc: 'ひかりを ためこんで いる。' },
  { id: 'uroko',  name: 'ひかる うろこ',     icon: '🌈', x: 64, y: 60, hint: 'うみの むこうの しま（とべるように なったら）', desc: 'にじいろに かがやく ふしぎな うろこ。', adult: 1 },
];

// 行った場所（はじめて入ると てちょうに のる）
const PLACES = [
  { id: 'home',   name: 'ちびリューの いえ' },
  { id: 'town',   name: 'ひだまりタウン' },
  { id: 'forest', name: 'ささやきの もり' },
  { id: 'flower', name: 'おはなばたけの おか' },
  { id: 'spooky', name: 'ふるい おやしき' },
  { id: 'rocky',  name: 'ほのおの いわやま' },
  { id: 'beach',  name: 'さざなみ ビーチ' },
  { id: 'sea',    name: 'ひろい うみ' },
  { id: 'island', name: 'ふしぎな しま' },
];

const STAGES = [
  { id: 'egg',   name: 'たまご',   size: 0.9 },
  { id: 'baby',  name: 'あかちゃん', size: 0.72 },
  { id: 'child', name: 'こども',   size: 0.88 },
  { id: 'adult', name: 'おとな',   size: 1.1 },
];
// 成長に必要な「ごはんを食べている時間」（ゲーム内の分）
const GROW_AT = { child: 60 * 24 * 1.5, adult: 60 * 24 * 5 };

// 1秒でゲーム内が何分すすむか
const SPEEDS = [
  { id: 'normal', label: 'ふつう', rate: 2 },
  { id: 'fast',   label: 'はやい', rate: 8 },
  { id: 'dev',    label: 'かいはつ', rate: 60 },
];

