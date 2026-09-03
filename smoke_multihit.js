// 冒烟测试：多段结算框架（原子函数 / 引擎逐段 / 网关名称兼容 / 条件系统 / 合并 HitCount）
const fs = require('fs');
const path = require('path');
const JS = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// ---- 极简浏览器环境 ----
global.window = global;
global.console = console;
global.document = { readyState: 'complete', addEventListener: function() {}, querySelector: () => null };
global.performance = require('perf_hooks').performance;

// 静态数据（脚本内查询，不进上下文）
eval(JS('data/SkillData.js'));
eval(JS('data/ElementDB.js'));

// 核心模块
eval(JS('battle/SingleHitCalculator.js'));
eval(JS('battle/rAthenaEngine.js'));
eval(JS('gateways/SkillGateway.js'));
eval(JS('core/SkillConditionSystem.js'));

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
}

// ---- 1. 网关名称兼容 ----
console.log('== 网关名称兼容 ==');
t('精确键', !!global.SkillGateway.getSkillByAegis('AC_DOUBLE'));
t('小写', !!global.SkillGateway.getSkillByAegis('ac_double'));
t('无下划线驼峰', !!global.SkillGateway.getSkillByAegis('MoTripleAttack'));
t('resolveAegis 规范化', global.SkillGateway.resolveAegis('mo_tripleattack') === 'MO_TRIPLEATTACK');
t('hasSkill 兼容', global.SkillGateway.hasSkill('wz_stormgust'));
t('getMergedSkillData 兼容', (global.SkillGateway.getMergedSkillData('mg_firebolt', 5) || {}).HitCount === 5);

// ---- 2. 合并数据 HitCount（含数组按等级/负数段数语义） ----
console.log('== 合并 HitCount ==');
t('AC_DOUBLE 2 段', global.SkillGateway.getMergedSkillData('AC_DOUBLE', 1).HitCount === 2);
t('MG_COLDBOLT Lv10 = 10 段', global.SkillGateway.getMergedSkillData('MG_COLDBOLT', 10).HitCount === 10);
t('MG_FIREBOLT Lv3 = 3 段', global.SkillGateway.getMergedSkillData('MG_FIREBOLT', 3).HitCount === 3);
t('MO_CHAINCOMBO -4 → 4 段', global.SkillGateway.getMergedSkillData('MO_CHAINCOMBO', 3).HitCount === 4);
t('WZ_STORMGUST 1 段（数据为准）', global.SkillGateway.getMergedSkillData('WZ_STORMGUST', 10).HitCount === 1);

// ---- 3. 条件系统 ----
console.log('== 条件系统 ==');
var CS = global.SkillConditionSystem;
t('weaponSeries 命中', CS.evaluate({ type: 'weaponSeries', values: ['Knuckle'] }, { weaponType: 'Knuckle' }) === true);
t('weaponSeries 映射（双剑→Sword）', CS.evaluate('weaponSeries:Sword', { weaponType: 'Two-Handed Sword' }) === true);
t('weaponSeries 不命中', CS.evaluate('weaponSeries:Bow', { weaponType: 'Knuckle' }) === false);
t('all 组合', CS.evaluate({ all: ['weaponSeries:Knuckle', 'always'] }, { weaponType: 'Knuckle' }) === true);
t('any 组合', CS.evaluate({ any: ['weaponSeries:Bow', 'weaponType:Staff'] }, { weaponType: 'Staff' }) === true);
t('skillLearned', CS.evaluate('skillLearned:MO_TRIPLEATTACK', { char: { learnedSkills: { MO_TRIPLEATTACK: 5 } } }) === true);

// ---- 4. 引擎逐段结算 ----
console.log('== 引擎逐段结算 ==');
var attacker = { _finalStats: { finalATK: 1000, equipATK: 600, statusATK: 400, panelHIT: 300, cri: 100, modifiers: {} } };
var monster = { def: 50, mdef: 50, flee: 100, size: 'Medium', race: 'Brute', element: 'Fire', ElementLevel: 1 };

// 二连矢：物理 2 段
var r = global.rAthena.engine.calculateDamage(attacker, monster, 1000, {
  weaponType: 'Bow', skillDamage: 190, hitCount: 2, hitType: 'Multi',
});
t('二连矢返回 2 段', r.details.hitResults.length === 2, JSON.stringify(r.details.hitResults.length));
t('每段有独立 hitIndex', r.details.hitResults[0].hitIndex === 0 && r.details.hitResults[1].hitIndex === 1);
t('总伤 = 各段之和', r.damage === r.details.hitResults.reduce((a, h) => a + h.damage, 0));
t('段间可能有 miss/独立性（status 合法）', r.details.hitResults.every(h => ['hit', 'miss', 'critical_hit'].includes(h.status)));

// 冰箭 Lv10：魔法 10 段
r = global.rAthena.engine.calculateDamage(attacker, monster, 500, {
  isMagic: true, skillDamage: 150, hitCount: 10, hitType: 'Multi', attackElem: 'Water',
});
t('冰箭 Lv10 返回 10 段', r.details.hitResults.length === 10);
var nonMiss = r.details.hitResults.filter(h => h.status !== 'miss');
t('冰箭 Lv10 至少命中 1 段', nonMiss.length > 0);
t('魔法跳过体型修正', nonMiss.every(h => h.breakdown.sizeFixRatio === 100));
t('水克火 → 命中段 elementFixRatio > 100', nonMiss.every(h => h.breakdown.elementFixRatio > 100));

// 逐段暴击独立性：100% CRI + canCritical → 全段暴击
r = global.rAthena.engine.calculateDamage(attacker, monster, 1000, {
  skillDamage: 100, hitCount: 4, canCritical: true, criRate: 100, weaponType: 'Knuckle',
});
t('criRate=100 未 miss 段全暴击', r.details.hitResults.every(h => h.status === 'miss' || h.status === 'critical_hit') && r.details.hitResults.some(h => h.status === 'critical_hit'));
t('isCritical 聚合为 true', r.isCritical === true);

// 逐段暴击：0% CRI → 无暴击
r = global.rAthena.engine.calculateDamage(attacker, monster, 1000, {
  skillDamage: 100, hitCount: 4, canCritical: true, criRate: 0, weaponType: 'Knuckle',
});
t('criRate=0 无暴击', r.details.hitResults.every(h => h.status !== 'critical_hit') && r.isCritical === false);

// forceCritical（技能级预判定）仍生效：全段暴击
r = global.rAthena.engine.calculateDamage(attacker, monster, 1000, {
  skillDamage: 100, hitCount: 3, isCritical: true, criDamageBonus: 0, weaponType: 'Knuckle',
});
t('旧 isCritical 兼容（未 miss 段全暴击）', r.details.hitResults.every(h => h.status === 'miss' || h.status === 'critical_hit') && r.isCritical === true);

// 命中率钳制验证：低 HIT vs 高 FLEE 大概率出现 miss（20 段采样）
var weak = { _finalStats: { finalATK: 100, equipATK: 60, statusATK: 40, panelHIT: 0 } };
var evasive = { def: 0, flee: 9999, size: 'Small', element: 'Neutral' };
r = global.rAthena.engine.calculateDamage(weak, evasive, 100, { skillDamage: 100, hitCount: 20 });
t('极低命中出现 miss 段', r.details.hitResults.some(h => h.status === 'miss'));

// ---- 5. 原子函数直接调用（纯函数性） ----
console.log('== 原子函数 ==');
var atom = global.SingleHitCalculator.calcSingleHit;
// 命中率钳制上限 95%，单次调用可能 miss → 重试取首个命中段
function hitOnce(a, d, c) { var r; for (var i = 0; i < 50; i++) { r = atom(a, d, c); if (r.isHit) return r; } return r; }
var s1 = hitOnce({ hit: 300, equipATK: 600, statusATK: 400, finalATK: 1000 }, { flee: 0, def: 50, size: 'Medium', element: 'Neutral' }, { skillDamage: 100 });
t('原子函数返回结构', s1 && typeof s1.damage === 'number' && typeof s1.isHit === 'boolean' && typeof s1.isCritical === 'boolean');
t('原子函数带 breakdown', !!s1.breakdown && s1.breakdown.baseDamage > 0);
var mg = hitOnce({ hit: 300, finalMATK: 500, modifiers: {} }, { flee: 0, mdef: 50, element: 'Fire' }, { isMagic: true, skillDamage: 100, attackElem: 'Water' });
t('魔法路径走 MATK + mdef', mg.isHit && mg.breakdown.sizeFixRatio === 100);

console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
