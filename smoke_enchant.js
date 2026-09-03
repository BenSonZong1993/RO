// 冒烟测试：装备附魔官方数值（ROUND6）
// 断言：官方 qualityMult（1+Grade Bonus/100）/ 官方升阶概率按精炼取档（含 <9 兜底）/
//       品阶只升不降 + 升阶成功收 Etel 兑换价 / Zeny 扣除 / 词条均匀落城市池 /
//       等级 +1 永不降级 / getEnchantBonus 数值 / raceAdd 进 modifiers / getEquipBonuses 接缝 /
//       时装不可附魔 / 权限拒绝
const fs = require('fs');
const path = require('path');
const JS = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

global.window = global;
global.document = { readyState: 'complete', addEventListener: function() {}, querySelector: () => null };

// ---- Math.random 注入（升阶判定用） ----
let _rnd = 0.99;
const _origRandom = Math.random;
Math.random = () => _rnd;

eval(JS('config/EnchantConfig.js'));
eval(JS('core/AccessControl.js'));

// ---- 桩：ItemDataGateway ----
const ITEM_DEFS = {
  1101: { Id: 1101, AegisName: 'Sword', cnName: '长剑', Type: 'Weapon', SubType: '1hSword', Attack: 25 },
  2301: { Id: 2301, AegisName: 'Armor', cnName: '铠甲', Type: 'Armor', Defense: 10 },
  5101: { Id: 5101, AegisName: 'Costume_Hat', cnName: '时装帽', Type: 'Armor', Locations: { 'Costume_Head_Top': true } },
};
global.ItemDataGateway = {
  getById: id => (ITEM_DEFS[id] ? JSON.parse(JSON.stringify(ITEM_DEFS[id])) : null),
  getDisplayName: id => (ITEM_DEFS[id] ? (ITEM_DEFS[id].cnName || ITEM_DEFS[id].Name) : ('#' + id)),
};

// ---- 桩：InventoryRepository（内存版） ----
let _inv = null;
function resetInv() {
  _inv = {
    stacks: {},
    equipped: { weapon: { templateId: 1101, refine: 0, cards: [], _instanceId: 'w1' } },
  };
}
global.InventoryRepository = {
  getRaw: () => _inv,
  save: () => true,
  getEquipped: () => JSON.parse(JSON.stringify(_inv.equipped)),
  getStack: key => (_inv.stacks[key] ? JSON.parse(JSON.stringify(_inv.stacks[key])) : null),
  getAllStacks: () => Object.keys(_inv.stacks).map(k => ({ key: k, ..._inv.stacks[k] })),
};

// ---- 桩：CharacterContext（记录扣费） ----
let _zeny = 1000000;
global.CharacterContext = {
  deductZeny: (amount, caller) => { if (_zeny < amount) return false; _zeny -= amount; return true; },
  applyModifier: () => true,
};

eval(JS('services/EnchantService.js'));

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
}

// ============================================================
console.log('== 纯函数 getEnchantBonus（官方 qualityMult = 1 + Grade Bonus/100）==');
var b1 = EnchantService.getEnchantBonus(ITEM_DEFS[1101], { city: 'prontera', level: 10, affixId: 'str', quality: '紫' });
t('str Lv10 紫 = floor(1×10×1.3) = 13（官方 Bonus 50）', b1.attrs.str === 13, JSON.stringify(b1));
var b2 = EnchantService.getEnchantBonus(ITEM_DEFS[1101], { city: 'morroc', level: 2, affixId: 'atk', quality: '白' });
t('atk Lv2 白 = 2×2×1.0 = 4（None 无 Bonus）', b2.attrs.atk === 4, JSON.stringify(b2));
var b3 = EnchantService.getEnchantBonus(ITEM_DEFS[1101], { city: 'payon', level: 5, affixId: 'raceBrute', quality: '橙' });
t('raceBrute Lv5 橙 = floor(1×5×1.5) = 7（官方 Bonus 100）', b3.raceAddDamage.Brute === 7, JSON.stringify(b3));
var b4 = EnchantService.getEnchantBonus(ITEM_DEFS[1101], null);
t('未附魔全空', Object.keys(b4.attrs).length === 0 && Object.keys(b4.raceAddDamage).length === 0);

console.log('== 官方升阶概率表（enchantgrade.yml Chances 按精炼取档）==');
t('蓝(D)：refine5→0.10 / 10→0.20 / 12→0.60 / 17→0.70',
  EnchantConfig.getUpgradeChance('蓝', 5) === 0.10 && EnchantConfig.getUpgradeChance('蓝', 10) === 0.20 &&
  EnchantConfig.getUpgradeChance('蓝', 12) === 0.60 && EnchantConfig.getUpgradeChance('蓝', 17) === 0.70,
  JSON.stringify([EnchantConfig.getUpgradeChance('蓝', 5), EnchantConfig.getUpgradeChance('蓝', 12)]));
t('紫(C)：refine10 兜底 11 档 0.50 / 20→0.60；橙(B)：20→0.50；橙满阶无升入=0（由 Service 满阶短路）',
  EnchantConfig.getUpgradeChance('紫', 10) === 0.50 && EnchantConfig.getUpgradeChance('紫', 20) === 0.60 &&
  EnchantConfig.getUpgradeChance('橙', 20) === 0.50);

console.log('== 洗练执行（已装备武器，品阶官方升阶制）==');
resetInv(); _zeny = 1000000; _rnd = 0.99;
var r1 = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('首洗成功：等级 1、品阶保持白（rnd 0.99 > 10%）、只收基础费 1000',
  r1.success === true && r1.level === 1 && r1.affix.quality === '白' && r1.qualityChanged === false &&
  r1.cost.gradeFee === 0 && _zeny === 1000000 - 1000, JSON.stringify(r1));
t('词条写入装备实例（city/level/affixId/quality 四字段）且落在城市池内',
  _inv.equipped.weapon.enchant && typeof _inv.equipped.weapon.enchant.level === 'number' &&
  typeof _inv.equipped.weapon.enchant.affixId === 'string' && typeof _inv.equipped.weapon.enchant.quality === 'string' &&
  EnchantConfig.cityPools.prontera.includes(r1.affix.id),
  JSON.stringify(_inv.equipped.weapon.enchant));

resetInv(); _zeny = 1000000; _rnd = 0.05;
_inv.equipped.weapon.refine = 10; // 蓝阶 20% 档
var r2 = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('refine10 + rnd 0.05 → 升阶至蓝，收官方 Etel 兑换价 100000（白→蓝 = Etel_Skyblue_Jewel）',
  r2.qualityChanged === true && r2.affix.quality === '蓝' && r2.cost.gradeFee === 100000 &&
  _zeny === 1000000 - 1000 - 100000, JSON.stringify(r2) + ' zeny=' + _zeny);

resetInv(); _zeny = 1000000; _rnd = 0.05;
_inv.equipped.weapon.refine = 5; // <9 兜底 9 档（10%）
var r3 = EnchantService.enchant({ slot: 'weapon' }, 'morroc', 'Test');
t('refine5 取 Refine9 兜底档 10%，rnd 0.05 仍升阶至蓝（词条落梦罗克池）',
  r3.affix.quality === '蓝' && EnchantConfig.cityPools.morroc.includes(r3.affix.id), JSON.stringify(r3));

resetInv(); _zeny = 3000000; _rnd = 0.45;
_inv.equipped.weapon.refine = 20;
_inv.equipped.weapon.enchant = { city: 'prontera', level: 5, affixId: 'str', quality: '紫' };
var r4 = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('紫→橙（refine20 档 50%，rnd 0.45 成功），收 300000（Etel_Violet_Jewel），等级 5→6',
  r4.affix.quality === '橙' && r4.cost.gradeFee === 300000 && r4.level === 6 &&
  _zeny === 3000000 - 3500 - 300000, JSON.stringify(r4) + ' zeny=' + _zeny);

resetInv(); _zeny = 1000000; _rnd = 0.01;
_inv.equipped.weapon.enchant = { city: 'prontera', level: 5, affixId: 'str', quality: '橙' };
var r5 = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('满阶橙不再升阶、不再收品阶费（品阶只升不降）',
  r5.affix.quality === '橙' && r5.qualityChanged === false && r5.cost.gradeFee === 0 &&
  _zeny === 1000000 - 3500, JSON.stringify(r5));

resetInv(); _zeny = 1000000; _rnd = 0.99;
for (var i = 0; i < 5; i++) EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('连洗 5 次（rnd 0.99 不升阶）等级 = 5，Zeny 累扣 1000+1500+2000+2500+3000 = 10000',
  _inv.equipped.weapon.enchant.level === 5 && _zeny === 1000000 - 10000, JSON.stringify(_inv.equipped.weapon.enchant));

resetInv(); _zeny = 500; _rnd = 0.99;
var r6 = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('Zeny 不足 → 拒绝', r6.success === false && /Zeny 不足/.test(r6.message), r6.message);

console.log('== 上限与边界 ==');
resetInv();
_inv.equipped.weapon.enchant = { city: 'prontera', level: EnchantConfig.maxLevel, affixId: 'str', quality: '白' };
var rmax = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'Test');
t('已达 Lv.20 上限 → 拒绝', rmax.success === false && /上限/.test(rmax.message), rmax.message);

console.log('== 时装不可附魔 ==');
t('时装 isEnchantable = false', EnchantService.isEnchantable(ITEM_DEFS[5101]) === false);
t('武器 isEnchantable = true', EnchantService.isEnchantable(ITEM_DEFS[1101]) === true);

console.log('== 权限检查 ==');
resetInv();
var rp = EnchantService.enchant({ slot: 'weapon' }, 'prontera', 'UnknownModule');
t('未授权模块被拒绝', rp.success === false && /权限/.test(rp.message), rp.message);

console.log('== getEnchantInfo（升阶概率/费用预览）==');
resetInv();
_inv.equipped.weapon.refine = 12;
var info = EnchantService.getEnchantInfo({ slot: 'weapon' }, 'morroc');
t('info：下一阶蓝 60%（refine12）、品阶费 100000、基础费 1000、城市名梦罗克',
  info.ok === true && info.nextGradeLabel === '蓝' && info.upgradeChance === 0.60 &&
  info.gradeFee === 100000 && info.zeny === 1000 && /梦罗克/.test(info.cityName), JSON.stringify(info));

console.log('== 附魔加成进 getEquipBonuses（finalATK 接缝）==');
eval(JS('services/EquipService.js'));
global.CharRepository = null; // 跳过双持分支
global.InventoryRepository.getEquipped = () => JSON.parse(JSON.stringify(_inv.equipped));
_inv.equipped.weapon = { templateId: 1101, refine: 0, cards: [], _instanceId: 'w2' };
var baseBonuses = EquipService.getEquipBonuses();
_inv.equipped.weapon.enchant = { city: 'morroc', level: 2, affixId: 'atk', quality: '白' }; // atk +4
var encBonuses = EquipService.getEquipBonuses();
t('装备 ATK 25，附魔后 ATK = 29（25 + 2×2×1.0）', baseBonuses.atk === 25 && encBonuses.atk === 29,
  'base=' + baseBonuses.atk + ' enchanted=' + encBonuses.atk);
_inv.equipped.weapon.enchant = { city: 'payon', level: 5, affixId: 'raceBrute', quality: '橙' }; // Brute +7
var raceBonuses = EquipService.getEquipBonuses();
t('raceAdd 词条进 modifiers.raceAddDamage.Brute = 7', raceBonuses.modifiers.raceAddDamage.Brute === 7,
  JSON.stringify(raceBonuses.modifiers.raceAddDamage));

Math.random = _origRandom; // 还原随机数
console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
