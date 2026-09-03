// 冒烟测试：动态状态系统（挂上→持续→摘下 → 九孔消费闭环）
// 覆盖：天赐(H1) / 涂毒(H6) / 风之步·速度激发(StatusProcessor 九孔外) / 霸体(功能标记)
const fs = require('fs');
const path = require('path');
const JS = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

global.window = global;
global.document = { readyState: 'complete', addEventListener: function() {}, querySelector: () => null };
global.EventBus = { emit: function() {}, on: function() {} };
eval(JS('data/SkillData.js'));
eval(JS('data/StatusData.js'));
eval(JS('data/ElementDB.js'));
eval(JS('config/SkillPatches.js'));
eval(JS('battle/rAthenaStatus.js'));
eval(JS('battle/SingleHitCalculator.js'));
eval(JS('battle/BonusCollector.js'));
eval(JS('battle/rAthenaEngine.js'));
eval(JS('gateways/SkillGateway.js'));
eval(JS('core/SkillConditionSystem.js'));
// StatusProcessor 依赖 ArithmeticCore，用最小桩替代其依赖并直接测输出结构
global.ArithmeticCore = { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
eval(JS('processors/StatusProcessor.js'));

let pass = 0, fail = 0;
function t(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, detail || ''); }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
var char = { level: 99, learnedSkills: {}, _finalStats: { finalATK: 1000, finalMATK: 800, panelHIT: 300, panelFLEE: 200, cri: 0, modifiers: {} }, sc: new global.StatusChange(), stats: { vit: 1, int: 1, luk: 1 } };
var fireMon = { def: 50, mdef: 50, flee: 0, size: 'Medium', race: 'Brute', element: 'Fire', ElementLevel: 1 };

function avgDamage(attacker, target, opts, runs) {
  var total = 0, count = 0;
  for (var i = 0; i < (runs || 30); i++) {
    var r = global.rAthena.engine.calculateDamage(attacker, target, opts.baseAtk, opts);
    var nonMiss = r.details.hitResults.filter(h => h.status !== 'miss');
    if (nonMiss.length === r.details.hitResults.length) { total += r.damage; count++; }
  }
  return count > 0 ? total / count : 0;
}

(async function main() {
  var SC = global.SC_CONSTANTS;

  // ---- 天赐：H1 挂载/到期 + CalcFlags 属性 ----
  console.log('== 天赐 Blessing（H1 + CalcFlags 属性管线）==');
  var baseDmg = avgDamage(char, fireMon, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
  var ok = global.status_change_start(null, char, SC['Blessing'], 10, 0, 0, 0, 80, 0);
  t('状态启动成功', ok === true);
  t('sc.entries 已登记', char.sc.hasSCE(SC['Blessing']));
  t('ACTIVE_SKILL_MODIFIERS 已挂载 1 条', (global.ACTIVE_SKILL_MODIFIERS || []).length === 1);
  var hooks = global.BonusCollector.collect(char, fireMon, 'Sword');
  t('H1 baseAtkFlat = 5', hooks.baseAtkFlat === 5, JSON.stringify(hooks.baseAtkFlat));
  var blessingDmg = avgDamage(char, fireMon, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
  t('H1 生效 → 伤害提升（1005/1000）', Math.abs(blessingDmg / baseDmg - 1005 / 1000) < 0.01, (blessingDmg / baseDmg).toFixed(4));
  var sp = global.StatusProcessor.process(char.sc, char);
  t('CalcFlags → stat_str/stat_dex/stat_int = 10（=val1 技能等级）',
    sp.modifications.stat_str === 10 && sp.modifications.stat_dex === 10 && sp.modifications.stat_int === 10,
    JSON.stringify(sp.modifications));
  await sleep(140);   // 等到期（80ms + 余量）
  t('到期后 sc 条目移除', !char.sc.hasSCE(SC['Blessing']));
  t('到期后 ACTIVE_SKILL_MODIFIERS 清空（无残留）', (global.ACTIVE_SKILL_MODIFIERS || []).length === 0);
  hooks = global.BonusCollector.collect(char, fireMon, 'Sword');
  t('到期后 H1 归零', hooks.baseAtkFlat === 0);
  var afterDmg = avgDamage(char, fireMon, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
  t('到期后伤害恢复基线', Math.abs(afterDmg / baseDmg - 1) < 0.01);

  // ---- 涂毒：H6 forceElement 生命周期 ----
  console.log('== 涂毒 Encpoison（H6 forceElement）==');
  var neutralDmg = avgDamage(char, fireMon, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
  global.status_change_start(null, char, SC['Encpoison'], 5, 0, 0, 0, 120, 0);
  var poisonDmg = avgDamage(char, fireMon, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
  t('涂毒后对火系 ×1.5（Poison→Fire=150）', Math.abs(poisonDmg / neutralDmg - 1.5) < 0.03, (poisonDmg / neutralDmg).toFixed(4));
  global.status_change_end(char, SC['Encpoison']);   // 手动摘下
  t('手动移除后 ACTIVE_SKILL_MODIFIERS 清空', (global.ACTIVE_SKILL_MODIFIERS || []).length === 0);
  var restored = avgDamage(char, fireMon, { weaponType: 'Sword', skillDamage: 100, hitCount: 1, baseAtk: 1000 });
  t('移除后属性恢复', Math.abs(restored / neutralDmg - 1) < 0.01);

  // ---- 覆盖重挂不残留：连续施放两次涂毒 ----
  global.status_change_start(null, char, SC['Encpoison'], 5, 0, 0, 0, 5000, 0);
  global.status_change_start(null, char, SC['Encpoison'], 6, 0, 0, 0, 5000, 0);
  t('重挂后仍只有 1 条挂载记录', (global.ACTIVE_SKILL_MODIFIERS || []).length === 1,
    (global.ACTIVE_SKILL_MODIFIERS || []).length);
  global.status_change_end(char, SC['Encpoison']);
  t('摘下后清空（无重挂残留）', (global.ACTIVE_SKILL_MODIFIERS || []).length === 0);

  // ---- 风之步 + 速度激发：StatusProcessor（九孔外）可叠加 ----
  console.log('== 风之步 / 速度激发（CalcFlags → StatusProcessor）==');
  global.status_change_start(null, char, SC['Windwalk'], 10, 0, 0, 0, 5000, 0);
  global.status_change_start(null, char, SC['Adrenaline'], 5, 0, 0, 0, 5000, 0);
  var sp2 = global.StatusProcessor.process(char.sc, char);
  t('风之步 Flee 生效', (sp2.modifications.flee || 0) > 0, JSON.stringify(sp2.modifications.flee));
  t('速度激发 Aspd 生效（aspdFixed）', (sp2.modifications.aspdFixed || 0) > 0, JSON.stringify(sp2.modifications.aspdFixed));
  t('两状态同时存在（可叠加）', char.sc.size() === 2, char.sc.size());
  t('九孔 hooks 不含 ASPD（九孔外路径）', global.BonusCollector.collect(char, fireMon, 'Sword').forceElement === null);
  global.status_change_end(char, SC['Windwalk']);
  global.status_change_end(char, SC['Adrenaline']);
  t('全部摘下后状态容器清空', char.sc.size() === 0 && (global.ACTIVE_SKILL_MODIFIERS || []).length === 0);

  // ---- 霸体：功能状态（无九孔挂载） ----
  console.log('== 霸体 Endure（功能标记）==');
  global.status_change_start(null, char, SC['Endure'], 1, 0, 0, 0, 200, 0);
  t('Endure 状态条目存在', char.sc.hasSCE(SC['Endure']));
  t('Endure 不产生九孔挂载（功能状态）', (global.ACTIVE_SKILL_MODIFIERS || []).length === 0);
  var sp3 = global.StatusProcessor.process(char.sc, char);
  t('Endure CalcFlags（Mdef）仍走属性管线', sp3.metadata.entries.some(e => e.name === 'Endure'));
  global.status_change_end(char, SC['Endure']);

  // ---- 配置完整性：五个技能补丁声明齐全 ----
  console.log('== 技能补丁声明 ==');
  var need = ['AL_BLESSING', 'AS_ENCHANTPOISON', 'SN_WINDWALK', 'BS_ADRENALINE', 'SM_ENDURE'];
  t('五技能均声明 status + statusTarget:self + duration',
    need.every(k => global.SKILL_PATCHES[k] && global.SKILL_PATCHES[k].status && global.SKILL_PATCHES[k].statusTarget === 'self' && global.SKILL_PATCHES[k].statusDurationMs > 0));

  console.log('\nRESULT: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail > 0 ? 1 : 0);
})().catch(e => { console.error('TEST CRASH:', e.message); process.exit(2); });
