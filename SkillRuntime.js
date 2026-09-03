// ============================================================
//  FILE: SkillRuntime.js
//  LAYER: core（技能状态机）
//  修改：lastSkill 与目标绑定，500ms 超时自动清除
// ============================================================
(function(global) {
    'use strict';

    var _gcd = 0;
    var _gcdTotal = 0;
    var _cooldowns = {};
    var _casting = null;
    var _silenced = false;
    var _endureUntil = 0;

    // ---- 连招状态（绑定目标 + 超时） ----
    var _lastSkill = null;
    var _lastSkillTarget = null;
    var _lastSkillTime = 0;

    function setEndure(durationMs) {
        _endureUntil = Date.now() + (durationMs || 0);
    }
    function isEndured() {
        return Date.now() < _endureUntil;
    }

    function setLastSkill(skillAegis, targetId) {
        _lastSkill = skillAegis || null;
        _lastSkillTarget = targetId || null;
        _lastSkillTime = Date.now();
    }

    function getLastSkill(targetId) {
        if (!_lastSkill) return null;
        // 超时 500ms 自动清除
        if (Date.now() - _lastSkillTime > 500) {
            _lastSkill = null;
            _lastSkillTarget = null;
            return null;
        }
        // 如果传入目标ID且不匹配，则清除并返回null
        if (targetId !== undefined && targetId !== null && _lastSkillTarget !== targetId) {
            _lastSkill = null;
            _lastSkillTarget = null;
            return null;
        }
        return _lastSkill;
    }

    function getLastSkillTarget() {
        return _lastSkillTarget;
    }

    function clearCombatState() {
        _gcd = 0;
        _gcdTotal = 0;
        _cooldowns = {};
        _casting = null;
        _silenced = false;
        _endureUntil = 0;
        _lastSkill = null;
        _lastSkillTarget = null;
        _lastSkillTime = 0;
    }

    function reset() { clearCombatState(); }

    // ---- 其他原有函数（不变） ----
    function update(delta) {
        if (_gcd > 0) {
            _gcd -= delta;
            if (_gcd < 0) _gcd = 0;
        }
        for (var key in _cooldowns) {
            if (!_cooldowns.hasOwnProperty(key)) continue;
            _cooldowns[key] -= delta;
            if (_cooldowns[key] <= 0) delete _cooldowns[key];
        }
        if (_casting) {
            _casting.progress += delta;
        }
    }

    function startGCD(seconds) {
        _gcd = Math.max(_gcd, seconds || 0);
        if (_gcd > 0) _gcdTotal = _gcd;
    }

    function startCooldown(skillAegis, seconds) {
        if (!skillAegis || !(seconds > 0)) return;
        _cooldowns[skillAegis] = seconds;
    }

    function startCasting(info) {
        if (!info || !info.skillAegis) return false;
        _casting = {
            skillAegis: info.skillAegis,
            progress: 0,
            total: info.total || 0,
            fixedRatio: info.fixedRatio || 0,
            targetX: info.targetX,
            targetY: info.targetY,
            targetId: info.targetId,
        };
        return true;
    }

    function completeCasting() {
        var c = _casting;
        _casting = null;
        return c;
    }

    function interruptCast() {
        if (_casting) {
            _casting = null;
            return true;
        }
        return false;
    }

    function getCasting() { return _casting; }
    function getCastingInfo() {
        if (!_casting) return null;
        return {
            skillAegis: _casting.skillAegis,
            progress: _casting.progress,
            total: _casting.total,
            fixedRatio: _casting.fixedRatio || 0,
        };
    }

    function getGCD() { return _gcd; }
    function getGCDTotal() { return _gcdTotal; }
    function getCooldown(skillAegis) { return _cooldowns[skillAegis] || 0; }
    function isOnCooldown(skillAegis) { return (_cooldowns[skillAegis] || 0) > 0; }
    function isCasting() { return _casting !== null; }
    function isSilenced() { return _silenced; }
    function setSilenced(silenced) {
        _silenced = !!silenced;
        if (_silenced) _casting = null;
    }

    global.SkillRuntime = {
        update: update,
        startGCD: startGCD,
        startCooldown: startCooldown,
        startCasting: startCasting,
        completeCasting: completeCasting,
        interruptCast: interruptCast,
        getCasting: getCasting,
        getCastingInfo: getCastingInfo,
        getGCD: getGCD,
        getGCDTotal: getGCDTotal,
        getCooldown: getCooldown,
        isOnCooldown: isOnCooldown,
        isCasting: isCasting,
        isSilenced: isSilenced,
        setSilenced: setSilenced,
        setEndure: setEndure,
        isEndured: isEndured,
        setLastSkill: setLastSkill,
        getLastSkill: getLastSkill,
        getLastSkillTarget: getLastSkillTarget,
        clearCombatState: clearCombatState,
        reset: reset,
    };

    console.log('[SkillRuntime] ✅ 已加载（含目标绑定连招状态）');
})(window);