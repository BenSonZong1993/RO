// 冒烟测试：加成插入点系统（H1 熟练度 / H5 拳刃暴伤 / H8 不死特攻 / H6 涂毒强制属性 / H9 真实伤害）
const fs = require('fs');
const path = require('path');
const JS = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

global.window = global;
global.document = { readyState: 'complete', addEventListener: function() {}, querySelector: () => null };
eval(JS('data/SkillData.js'));
eval(JS('data/ElementDB.js'));
eval(JS('config/SkillPatches.js'));
eval(JS('battle/SingleHitCalculator.js'));
eval(JS('battle/BonusCollector.js'));
eval(JS('battle/rAthenaEngine.js'));
eval(JS('gateways/SkillGateway.js'));
eval(JS('core/SkillConditionSystem.js'));

global.rAthenaFormulasLoaded = true;   // 引擎命中公式已由 rAthenaFormulas 提供（此处用引擎内 fallback 等价）

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
}

function makeChar(learned, weaponSubType) {
  return {
    level: 99, sp: 999,
    learnedSkills: learned,
    _finalStats: { finalATK: 1000, finalMATK: 800, panelHIT: 300, panelFLEE: 200, cri: 0, criDamage: 0, modifiers: {} },
    __weaponSubType: weaponSubType,
  };
}
// 桩武器读取：让 _getWeaponInfo 类逻辑用 weaponSubType —— 引擎层 weaponType 由 options 传入，这里直接测引擎
var monster = { def: 50, mdef: 50, flee: 0, size: 'Medium', race: 'Brute', element: 'Neutral', ElementLevel: 1 };
var undead  = { def: 50, mdef: 50, flee: 0, size: 'Medium', race: 'Undead', element: 'Undead', ElementLevel: 1 };

// 取稳定命中段（命中率钳 95%，重试直到全部命中）
function avgDamage(attacker, target, opts, runs) {
  var total = 0, count = 0;
  for (var i = 0; i < (runs || 30); i++) {
    var r = global.rAthena.engine.calculateDamage(attacker, target, opts.baseAtk, opts);
    var nonMiss = r.details.hitResults.filter(h => h.status !== 'miss');
    if (nonMiss.length === r.details.hitResults.length) { total += r.damage; count++; }
  }
  return count > 0 ? total / count : 0;
}

// ---- H1: SM_SWORD 单手剑熟练度 ----
console.log('== H1 baseAtkFlat（单手剑熟练度）==');
var noSkill = makeChar({}, 'Sword');
var withSkill = makeChar({ SM_SWORD: 10 }, 'Sword');
var base = avgDamage(noSkill, monster, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
var buff = avgDamage(withSkill, monster, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
t('剑系武器 +40 ATK（1040/1000）', Math.abs(buff / base - 1040 / 1000) < 0.01, (buff / base).toFixed(4));
var wrongWeapon = avgDamage(makeChar({ SM_SWORD: 10 }, 'Axe'), monster, { weaponType: 'Axe', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
t('斧系武器不生效', Math.abs(wrongWeapon / base - 1) < 0.01, (wrongWeapon / base).toFixed(4));
// valuePerLevel：Lv1 = +4
var lv1 = avgDamage(makeChar({ SM_SWORD: 1 }, 'Sword'), monster, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
t('Lv1 = +4（1004/1000）', Math.abs(lv1 / base - 1004 / 1000) < 0.01, (lv1 / base).toFixed(4));

// ---- H5: AS_KATAR 拳刃暴伤 ----
console.log('== H5 critMultiplier（拳刃修炼）==');
var kataNo = makeChar({}, 'Katar');
var kataYes = makeChar({ AS_KATAR: 5 }, 'Katar');
var critOpts = { weaponType: 'Katar', skillDamage: 100, hitCount: 1, baseAtk: 1000, canCritical: true, criRate: 100, forceNoCritFail: true };
var critBase = avgDamage(kataNo, monster, critOpts);
var critBuff = avgDamage(kataYes, monster, critOpts);
t('拳刃暴击倍率 1.6/1.4', Math.abs(critBuff / critBase - 1.6 / 1.4) < 0.01, (critBuff / critBase).toFixed(4));
var swordCrit = avgDamage(makeChar({ AS_KATAR: 5 }, 'Sword'), monster, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000, canCritical: true, criRate: 100 });
t('非拳刃武器不生效', Math.abs(swordCrit / critBase - 1) < 0.01, (swordCrit / critBase).toFixed(4));

// ---- H8: PR_MAGNUS 不死特攻 ----
console.log('== H8 raceModifier（十字驱魔）==');
var magus = makeChar({ PR_MAGNUS: 5 }, 'Staff');
var vsBrute = avgDamage(magus, monster, { weaponType: 'Staff', isMagic: true, skillDamage: 100, hitCount: 1, baseAtk: 800, attackElem: 'Holy' });
var vsUndead = avgDamage(magus, undead, { weaponType: 'Staff', isMagic: true, skillDamage: 100, hitCount: 1, baseAtk: 800, attackElem: 'Holy' });
// Holy→Undead1=125%（克制表），不死系 = 2.5 倍（种族 ×2 × 元素 1.25）
t('不死系 = 种族×2 × 元素1.25 = 2.5 倍', Math.abs(vsUndead / vsBrute - 2.5) < 0.03, (vsUndead / vsBrute).toFixed(4));
var noMagusUndead = avgDamage(makeChar({}, 'Staff'), undead, { weaponType: 'Staff', isMagic: true, skillDamage: 100, hitCount: 1, baseAtk: 800, attackElem: 'Holy' });
t('未学技能仅剩元素克制（1/2 = 0.5）', Math.abs(noMagusUndead / vsUndead - 0.5) < 0.03, (noMagusUndead / vsUndead).toFixed(4));

// ---- H6: 涂毒（状态挂载 ACTIVE_SKILL_MODIFIERS） ----
console.log('== H6 forceElement（涂毒，状态挂载）==');
global.ACTIVE_SKILL_MODIFIERS = [{ source: 'AS_ENCHANTPOISON', skillLevel: 5, modifiers: [{ hook: 'forceElement', value: 'Poison' }] }];
var poisoned = makeChar({}, 'Sword');
// Poison→Fire1 = 150%（克制表）；Neutral→Fire1 = 100%
var fireTarget = { def: 50, flee: 0, size: 'Medium', race: 'Brute', element: 'Fire' };
global.ACTIVE_SKILL_MODIFIERS = [];
var neutralVsFire = avgDamage(makeChar({}, 'Sword'), fireTarget, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
global.ACTIVE_SKILL_MODIFIERS = [{ source: 'AS_ENCHANTPOISON', skillLevel: 5, modifiers: [{ hook: 'forceElement', value: 'Poison' }] }];
var poisonVsFire = avgDamage(poisoned, fireTarget, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
t('涂毒后属性强制 Poison → 对火系 ×1.5', Math.abs(poisonVsFire / neutralVsFire - 1.5) < 0.03, (poisonVsFire / neutralVsFire).toFixed(4));
global.ACTIVE_SKILL_MODIFIERS = [];

// ---- H9: trueDamage（每段直加） ----
console.log('== H9 trueDamage ==');
global.ACTIVE_SKILL_MODIFIERS = [{ source: 'TEST_TRAP', modifiers: [{ hook: 'trueDamage', value: 100 }] }];
var withTrue = avgDamage(makeChar({}, 'Sword'), monster, { weaponType: 'Sword', skillDamage: 100, hitCount: 3, baseAtk: 1000 });
global.ACTIVE_SKILL_MODIFIERS = [];
var withoutTrue = avgDamage(makeChar({}, 'Sword'), monster, { weaponType: 'Sword', skillDamage: 100, hitCount: 3, baseAtk: 1000 });
t('3 段各 +100 → 总差 300', Math.abs((withTrue - withoutTrue) - 300) < 3, (withTrue - withoutTrue).toFixed(1));

// ---- 网关 modifiers 透传（L2 补丁合并 → 引用一致） ----
console.log('== 网关 modifiers 透传 ==');
var m = global.SkillGateway.getMergedSkillData('SM_SWORD', 10);
t('补丁 modifiers 经网关透出（引用一致，收集器据此判重）', m.modifiers === global.SKILL_PATCHES.SM_SWORD.modifiers);

console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail > 0 ? 1 : 0);
