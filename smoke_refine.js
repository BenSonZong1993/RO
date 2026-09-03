// 冒烟测试：装备精炼（ROUND5 官方数值真实化，refine.yml Normal 档）
// 断言：getRefineBonus 官方累计 Bonus / 按物品等级取档 / +1 成功 / 材料扣除 /
//       Zeny 扣除 / 官方安全档强制成功 / 失败降级（Armor Lv2 降 3 级）/ 碎裂移除 /
//       精炼加成进 getEquipBonuses（→finalATK 接缝）
const fs = require('fs');
const path = require('path');
const JS = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

global.window = global;
global.document = { readyState: 'complete', addEventListener: function() {}, querySelector: () => null };

eval(JS('config/RefineConfig.js'));
eval(JS('core/AccessControl.js'));

// ---- 桩：ItemDataGateway（精炼只消费 getById / getDisplayName） ----
const ITEM_DEFS = {
  1101: { Id: 1101, AegisName: 'Sword', Name: 'Sword', cnName: '长剑', Type: 'Weapon', SubType: '1hSword', Attack: 50, WeaponLevel: 1 },
  1103: { Id: 1103, AegisName: 'Javelin', Name: 'Javelin', cnName: '投矛', Type: 'Weapon', SubType: '1hSpear', Attack: 60, WeaponLevel: 3 },
  2301: { Id: 2301, AegisName: 'Armor', Name: 'Armor', cnName: '铠甲', Type: 'Armor', Defense: 10, ArmorLevel: 1 },
  2302: { Id: 2302, AegisName: 'Coat', Name: 'Coat', cnName: '外套', Type: 'Armor', Defense: 12, ArmorLevel: 2 },
  1010: { Id: 1010, AegisName: 'Phracon', cnName: '铁矿石' },
  1011: { Id: 1011, AegisName: 'Emveretarcon', cnName: '铝矿石' },
  984:  { Id: 984, AegisName: 'Oridecon', cnName: '神之金属' },
  985:  { Id: 985, AegisName: 'Elunium', cnName: '铝' },
  1000331: { Id: 1000331, AegisName: 'Ethernium', cnName: '以太金属' },
};
global.ItemDataGateway = {
  getById: id => (ITEM_DEFS[id] ? JSON.parse(JSON.stringify(ITEM_DEFS[id])) : null),
  getDisplayName: id => (ITEM_DEFS[id] ? (ITEM_DEFS[id].cnName || ITEM_DEFS[id].Name) : ('#' + id)),
};

// ---- 桩：InventoryRepository（内存版，接口与真仓储对齐） ----
let _inv = null;
function resetInv() {
  _inv = {
    stacks: {
      'ore1010': { templateId: 1010, refine: 0, count: 10, cards: [] },
      'ore1011': { templateId: 1011, refine: 0, count: 10, cards: [] },
      'ore984': { templateId: 984, refine: 0, count: 10, cards: [] },
      'ore1000331': { templateId: 1000331, refine: 0, count: 10, cards: [] },
    },
    equipped: { weapon: { templateId: 1101, refine: 0, cards: [], _instanceId: 'w1' } },
  };
}
global.InventoryRepository = {
  getRaw: () => _inv,
  save: () => true,
  updateEquipped: (slot, fn) => { const e = _inv.equipped[slot]; if (!e) return false; fn(e); return true; },
  unequipEntry: slot => { const e = _inv.equipped[slot]; if (!e) return null; delete _inv.equipped[slot]; return JSON.parse(JSON.stringify(e)); },
  removeItem: (key, count) => {
    const s = _inv.stacks[key]; if (!s) return false;
    if (s.count <= count) delete _inv.stacks[key]; else s.count -= count;
    return true;
  },
  getAllStacks: () => Object.keys(_inv.stacks).map(k => ({ key: k, ..._inv.stacks[k] })),
  getStack: key => (_inv.stacks[key] ? JSON.parse(JSON.stringify(_inv.stacks[key])) : null),
};

// ---- 桩：CharacterContext（记录扣费调用） ----
let _zeny = 1000000;
let _ctxCalls = [];
global.CharacterContext = {
  deductZeny: (amount, caller) => { _ctxCalls.push(['deductZeny', amount, caller]); if (_zeny < amount) return false; _zeny -= amount; return true; },
  applyModifier: (...a) => { _ctxCalls.push(['applyModifier', a[0]]); return true; },
};

eval(JS('services/MaterialService.js'));
eval(JS('services/RefineService.js'));

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
}

// ============================================================
console.log('== 纯函数 getRefineBonus（官方 refine.yml 累计 Bonus 表）==');
var wb = RefineService.getRefineBonus(ITEM_DEFS[1101], 1);   // 武器物品等级 1
t('武器 Lv1 +1 = ATK+2 / MATK+2', wb.atk === 2 && wb.matk === 2, JSON.stringify(wb));
var wb10 = RefineService.getRefineBonus(ITEM_DEFS[1101], 10);
t('武器 Lv1 +10 = ATK+20', wb10.atk === 20, JSON.stringify(wb10));
var wb3 = RefineService.getRefineBonus(ITEM_DEFS[1103], 8);  // 武器物品等级 3
t('武器 Lv3 +8 = ATK+40', wb3.atk === 40, JSON.stringify(wb3));
var ab = RefineService.getRefineBonus(ITEM_DEFS[2301], 2);   // 防具物品等级 1
t('防具 Lv1 +2 = DEF+2 / MaxHP+0（官方无）', ab.def === 2 && ab.maxHp === 0, JSON.stringify(ab));
var ab2 = RefineService.getRefineBonus(ITEM_DEFS[2302], 10); // 防具物品等级 2
t('防具 Lv2 +10 = DEF+21.6', ab2.def === 21.6, JSON.stringify(ab2));
var zb = RefineService.getRefineBonus(ITEM_DEFS[1101], 0);
t('未精炼全 0', zb.atk === 0 && zb.maxHp === 0, JSON.stringify(zb));

console.log('== 精炼 +1（已装备武器，官方 Phracon 1 个 / 50 Zeny）==');
resetInv(); _zeny = 1000000; _ctxCalls = [];
var r1 = RefineService.refine({ slot: 'weapon' }, 'Test');
t('+1 成功', r1.success === true && r1.newLevel === 1, JSON.stringify(r1));
t('refineLevel 写入装备实例', _inv.equipped.weapon.refine === 1);
t('矿石扣除（Phracon 10→9）', _inv.stacks['ore1010'].count === 9);
t('Zeny 扣除 50（1000000→999950）', _zeny === 999950);
t('触发属性失效（applyModifier）', _ctxCalls.some(c => c[0] === 'applyModifier'));

console.log('== 官方安全档（武器 Lv1 目标 ≤7 Rate=10000 强制成功）==');
resetInv(); _zeny = 1000000;
_inv.equipped.weapon.refine = 6;
var realRandom = Math.random;
Math.random = () => 0.999999; // 若走成功率表（0.6）必失败；官方安全段必须仍成功
var r2 = RefineService.refine({ slot: 'weapon' }, 'Test');
Math.random = realRandom;
t('6→7 官方安全段强制成功', r2.success === true && r2.newLevel === 7, JSON.stringify(r2));

console.log('== 武器 Lv1 高档失败即碎（7→8，成功率 60%，Normal 档失败必碎）==');
resetInv(); _zeny = 1000000;
_inv.equipped.weapon.refine = 7;
Math.random = () => 0.9; // > 0.6 成功率 → 失败；碎裂率 1 → 必碎
var r3 = RefineService.refine({ slot: 'weapon' }, 'Test');
Math.random = realRandom;
t('7→8 失败碎裂（broken=true）', r3.success === false && r3.broken === true, JSON.stringify(r3));
t('装备实例已移除（槽位清空）', _inv.equipped.weapon === undefined);
t('失败仍扣费 50（RO 惯例）', _zeny === 1000000 - 50 && _inv.stacks['ore1010'].count === 9);

console.log('== 防具 Lv2 失败降 3 级（3→4，成功率 60%，DowngradeAmount 3）==');
resetInv(); _zeny = 1000000;
_inv.equipped.weapon = { templateId: 2302, refine: 3, cards: [], _instanceId: 'a1' };
Math.random = () => 0.9; // > 0.6 失败；碎裂率 0 → 不碎，降 3 级
var r4 = RefineService.refine({ slot: 'weapon' }, 'Test');
Math.random = realRandom;
t('3→4 失败降至 +0', r4.success === false && r4.newLevel === 0 && !r4.broken, JSON.stringify(r4));
t('Ethernium 扣 1 / Zeny 扣 50000', _inv.stacks['ore1000331'].count === 9 && _zeny === 950000);

console.log('== 武器 Lv3 按物品等级取档（5→6，成功率 60%，矿石 Oridecon / 5000 Zeny）==');
resetInv(); _zeny = 1000000;
_inv.equipped.weapon = { templateId: 1103, refine: 5, cards: [], _instanceId: 'w3' };
var realRandom5 = Math.random;
Math.random = () => 0.1; // < 0.6 成功率 → 必成功（消除测试随机性）
var r5 = RefineService.refine({ slot: 'weapon' }, 'Test');
Math.random = realRandom5;
t('Lv3 档 +1 成功（Oridecon 扣 1 / 5000 Zeny）',
  r5.success === true && _inv.stacks['ore984'].count === 9 && _zeny === 995000, JSON.stringify(r5));

console.log('== 精炼加成进 getEquipBonuses（finalATK 接缝）==');
eval(JS('services/EquipService.js'));
global.CharRepository = null; // 跳过双持分支
global.InventoryRepository.getEquipped = () => JSON.parse(JSON.stringify(_inv.equipped));
_inv.equipped.weapon = { templateId: 1101, refine: 0, cards: [], _instanceId: 'w2' };
var baseBonuses = EquipService.getEquipBonuses();
_inv.equipped.weapon.refine = 1;
var refinedBonuses = EquipService.getEquipBonuses();
t('装备基础 ATK 50，+1 精炼后 ATK = 52', baseBonuses.atk === 50 && refinedBonuses.atk === 52,
  'base=' + baseBonuses.atk + ' refined=' + refinedBonuses.atk);

console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
