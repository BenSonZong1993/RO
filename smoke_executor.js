// 冒烟测试：SkillExecutor 全链路（带桩）——二连矢/火箭术/冰箭术/连环全身掌
const fs = require('fs');
const path = require('path');
const JS = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

global.window = global;
global.document = { readyState: 'complete', addEventListener: function() {}, querySelector: () => null };
eval(JS('data/SkillData.js'));
eval(JS('data/ElementDB.js'));
eval(JS('config/SkillPatches.js'));
eval(JS('battle/SingleHitCalculator.js'));
eval(JS('battle/rAthenaEngine.js'));
eval(JS('gateways/SkillGateway.js'));
eval(JS('core/SkillConditionSystem.js'));

// ---- 桩：上层依赖（本测试只验证执行链，不验证这些层本身） ----
global.RO_CONSTANTS = { DEFAULT_ATTACK_RANGE: 32 };
global.AttributeGateway = { getAll: () => ({ finalATK: 1000, finalMATK: 800, panelHIT: 300, cri: 100, criDamage: 0, attackElement: 'Neutral', attackElementLevel: 1 }), getCastReduction: () => 0, getAttackRange: () => 128 };
global.InventoryRepository = { getEquipped: () => ({ weapon: { templateId: 1116 } }) };   // 桩武器
global.ItemDataGateway = { getById: (id) => ({ Id: id, Weight: 50, SubType: 'Knuckle' }) };
global.CharRepository = { getLiveRef: () => global.__CHAR };
global.CharacterContext = { consumeSP: () => true };
global.SkillRuntime = { setLastSkill: () => {}, startGCD: () => {}, startCooldown: () => {}, isOnCooldown: () => false };
global.ConfigProfileManager = null;   // SkillExecutor 内部走默认值

// SkillExecutor 依赖 RO_CONSTANTS 已在其 CONFIG 默认值中使用
eval(JS('core/SkillExecutor.js'));

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
}

global.__CHAR = { level: 99, jobLevel: 50, sp: 1000, zeny: 1000000, learnedSkills: { AC_DOUBLE: 10, MG_FIREBOLT: 10, MG_COLDBOLT: 10, MO_CHAINCOMBO: 5 }, hp: 1000,
  _finalStats: { finalATK: 1000, finalMATK: 800, panelHIT: 300, panelFLEE: 200, cri: 100, criDamage: 0, attackElement: 'Neutral', attackElementLevel: 1, modifiers: {} } };
var char = global.__CHAR;
var monster = { id: 1, def: 50, mdef: 50, flee: 100, size: 'Medium', race: 'Brute', element: 'Fire', ElementLevel: 1, hp: 99999, alive: true };

// ---- 二连矢：物理 2 段 ----
var merged = global.SkillGateway.getMergedSkillData('AC_DOUBLE', 10);
var r = global.SkillExecutor.executeSkill(char, monster, 'AC_DOUBLE', merged, 1000, 0, { cooldown: 0 });
t('二连矢 action=skill', r.action === 'skill');
t('二连矢 hitCount=2', r.hitCount === 2);
t('二连矢 hitResults 为数组且 2 段', Array.isArray(r.hitResults) && r.hitResults.length === 2);
t('二连矢总伤 = 各段之和', r.damage === r.hitResults.reduce((a, h) => a + h.damage, 0));

// ---- 火箭术 Lv10：魔法（对火系怪应该打折，但结构正确） ----
merged = global.SkillGateway.getMergedSkillData('MG_FIREBOLT', 10);
r = global.SkillExecutor.executeSkill(char, monster, 'MG_FIREBOLT', merged, 800, 0, { cooldown: 0 });
t('火箭术 hitCount=10', r.hitCount === 10);
t('火箭术 hitResults 10 段', Array.isArray(r.hitResults) && r.hitResults.length === 10);
t('火箭术 isMagic 路径（elementFixRatio 存在）', r.hitResults.every(h => !h.breakdown || h.breakdown.sizeFixRatio === 100));

// ---- 冰箭术 Lv10：水克火 ----
merged = global.SkillGateway.getMergedSkillData('MG_COLDBOLT', 10);
r = global.SkillExecutor.executeSkill(char, monster, 'MG_COLDBOLT', merged, 800, 0, { cooldown: 0 });
var nonMiss = r.hitResults.filter(h => h.status !== 'miss');
t('冰箭术 hitResults 10 段', Array.isArray(r.hitResults) && r.hitResults.length === 10);
t('冰箭术水克火命中段 elementFixRatio=150', nonMiss.length > 0 && nonMiss.every(h => h.breakdown.elementFixRatio === 150));

// ---- 连环全身掌：4 段 + 名称兼容 ----
merged = global.SkillGateway.getMergedSkillData('mo_chaincombo', 3);   // 故意小写
r = global.SkillExecutor.executeSkill(char, monster, 'mo_chaincombo', merged, 1000, 0, { cooldown: 0 });
t('连环全身掌（小写传入）hitCount=4', r.hitCount === 4);
t('连环全身掌 hitResults 4 段', Array.isArray(r.hitResults) && r.hitResults.length === 4);
t('连环全身掌 skillAegis 已规范化', r.skillAegis === 'MO_CHAINCOMBO');

// ---- 条件系统覆盖段数（hitCountWhen：拳套 6 连击示例，配置驱动） ----
merged = global.SkillGateway.getMergedSkillData('AC_DOUBLE', 10);
merged.hitCountWhen = [{ condition: { type: 'weaponSeries', values: ['Knuckle'] }, hitCount: 6 }];
r = global.SkillExecutor.executeSkill(char, monster, 'AC_DOUBLE', merged, 1000, 0, { cooldown: 0 });
t('hitCountWhen 拳套 → 6 段', r.hitCount === 6 && Array.isArray(r.hitResults) && r.hitResults.length === 6);

merged.hitCountWhen = [{ condition: { type: 'weaponSeries', values: ['Bow'] }, hitCount: 5 }];
r = global.SkillExecutor.executeSkill(char, monster, 'AC_DOUBLE', merged, 1000, 0, { cooldown: 0 });
t('hitCountWhen 非拳套 → 保持基础 2 段', r.hitCount === 2);

console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
