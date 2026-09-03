// ============================================================
//  FILE: SkillTriggerManager.js
//  LAYER: battle（轻量管理器：技能触发反应——受击反射/受击回血/击杀触发/普攻概率触发）
//  权限：char:addHp / char:addSp（恢复经 CharacterContext 过闸）
//  依赖：EventBus、CharRepository、SKILL_PATCHES、AttributeGateway
//  职责：只监听既有事件并按 SKILL_PATCHES 配置做出反应，不改战斗核心：
//    - battle:monsterAttack → 记录最近攻击者（反射目标）
//    - battle:playerDamaged → 反射（reflectPercent）：伤害 n% 返回攻击者
//    - battle:monsterKilled → 击杀触发（onKillHealPercent：恢复 MaxHP n%）
//    - battle:playerAttack(普攻) → 概率触发（proc：二刀连击类追加打击）
//  配置来源：SKILL_PATCHES[已学技能].reflectPercent / onKillHealPercent / proc
//  生命周期：管理器无状态残留（lastAttacker 每次战斗事件刷新）
// ============================================================
(function(global) {
    'use strict';

    var _lastAttacker = null;

    // ---- 收集角色已学技能中命中的补丁字段 ----
    function _collectLearnedPatchField(char, field) {
        var results = [];
        var learned = char && char.learnedSkills;
        if (!learned || !global.SKILL_PATCHES) return results;
        for (var skillAegis in learned) {
            if (!learned.hasOwnProperty(skillAegis)) continue;
            if (!(learned[skillAegis] > 0)) continue;
            var patch = global.SKILL_PATCHES[skillAegis];
            if (patch && typeof patch[field] === 'number' && patch[field] > 0) {
                results.push({ skillAegis: skillAegis, value: patch[field] });
            }
        }
        return results;
    }

    // ---- 收集角色已学技能的 proc 配置（对象型字段，如二刀连击） ----
    function _getLearnedProc(char) {
        var learned = char && char.learnedSkills;
        if (!learned || !global.SKILL_PATCHES) return null;
        for (var skillAegis in learned) {
            if (!learned.hasOwnProperty(skillAegis)) continue;
            if (!(learned[skillAegis] > 0)) continue;
            var patch = global.SKILL_PATCHES[skillAegis];
            if (patch && patch.proc && typeof patch.proc === 'object') {
                return patch.proc;
            }
        }
        return null;
    }

    // ---- 反射：受击时把伤害 n% 返回最近攻击者 ----
    function _onPlayerDamaged(data) {
        var damage = data && data.damage;
        if (!damage || damage <= 0) return;
        var attacker = _lastAttacker;
        if (!attacker || !attacker.alive) return;

        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return;
        var reflectEntries = _collectLearnedPatchField(char, 'reflectPercent');
        if (reflectEntries.length === 0) return;

        var reflectDamage = 0;
        for (var i = 0; i < reflectEntries.length; i++) {
            reflectDamage += Math.floor(damage * reflectEntries[i].value);
        }
        if (reflectDamage <= 0) return;

        // 反射伤害复用 battle:playerAttack 非溅射路径（击杀/掉落闭环复用）
        global.EventBus.emit('battle:playerAttack', {
            target: attacker,
            damage: reflectDamage,
            isSkill: true,
            skillName: '反射',
            status: null,
            statusChance: 0,
        });
    }

    // ---- 击杀触发：恢复 MaxHP n% ----
    function _onMonsterKilled() {
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return;
        var killEntries = _collectLearnedPatchField(char, 'onKillHealPercent');
        for (var i = 0; i < killEntries.length; i++) {
            var stats = global.AttributeGateway ? global.AttributeGateway.getAll('SkillTriggerManager') : null;
            var maxHP = stats ? (stats.finalMaxHP || 100) : 100;
            var heal = Math.floor(maxHP * killEntries[i].value);
            if (heal > 0 && global.CharacterContext) {
                global.CharacterContext.restoreResource('hp', heal, 'SkillTriggerManager');
            }
        }
    }

    // ---- 普攻概率触发（proc）：二刀连击类，追加一次倍率打击 ----
    function _onNormalAttack(data) {
        if (!data || data._procDone) return;           // 防止触发链递归
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) return;
        var proc = _getLearnedProc(char);
        if (!proc || Math.random() >= (proc.chance || 0)) return;

        var extraDamage = Math.floor((data.damage || 1) * (proc.damageMultiplier || 1));
        global.EventBus.emit('battle:playerAttack', {
            target: data.target,
            damage: extraDamage,
            isSkill: false,
            skillName: proc.name || '连击',
            _procDone: true,
        });
    }

    function _init() {
        if (!global.EventBus) return;
        global.EventBus.on('battle:monsterAttack', function(data) {
            _lastAttacker = data && data.monster ? data.monster : null;
        });
        global.EventBus.on('battle:playerDamaged', _onPlayerDamaged);
        global.EventBus.on('battle:monsterKilled', function() { _onMonsterKilled(); });
        global.EventBus.on('battle:playerAttack', _onNormalAttack);
    }

    var SkillTriggerManager = {
        init: function() { return true; },   // 事件绑定已在加载时完成
        getLastAttacker: function() { return _lastAttacker; },
    };

    _init();
    global.SkillTriggerManager = SkillTriggerManager;
    console.log('[SkillTriggerManager] ✅ 已加载（受击反射/击杀触发/普攻概率触发）');
})(window);
