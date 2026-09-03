// ============================================================
//  FILE: SkillStrategy.js
//  LAYER: core（技能四层之二：决策策略——自动技能选择）
//  修改：连招完全基于 lastSkill 的 comboNext 链，移除 comboState
// ============================================================
(function(global) {
    'use strict';

    var _userSkillConfig = {
        skills: [],
        strategy: 'priority',
        enabled: true,
    };

    var _lastSkillIndex = 0;
    var _rotationUsed = {};
    var _rotationResetNeeded = false;

    function loadFromChar(char) {
        if (!char) return;
        var config = char._autoSkillConfig;
        if (config && typeof config === 'object') {
            _userSkillConfig.skills = Array.isArray(config.skills) ? config.skills.slice() : [];
            _userSkillConfig.strategy = config.strategy || 'priority';
            _userSkillConfig.enabled = config.enabled !== undefined ? !!config.enabled : true;
        } else {
            _userSkillConfig.skills = [];
            _userSkillConfig.strategy = 'priority';
            _userSkillConfig.enabled = true;
        }
    }

    function getConfig() {
        return {
            skills: _userSkillConfig.skills.slice(),
            strategy: _userSkillConfig.strategy,
            enabled: _userSkillConfig.enabled,
        };
    }

    function isEnabled() { return _userSkillConfig.enabled; }

    function updateSkillConfig(skills, strategy, enabled) {
        if (skills !== undefined) {
            var arr = Array.isArray(skills) ? skills.slice() : [];
            var seen = {};
            var unique = [];
            for (var i = 0; i < arr.length; i++) {
                var name = arr[i];
                if (!seen[name]) {
                    seen[name] = true;
                    unique.push(name);
                }
            }
            _userSkillConfig.skills = unique;
        }
        if (strategy !== undefined) _userSkillConfig.strategy = strategy;
        if (enabled !== undefined) _userSkillConfig.enabled = !!enabled;
    }

    function resetRotation() {
        _rotationUsed = {};
        _rotationResetNeeded = false;
        _lastSkillIndex = 0;
    }

    // ============================================================
    //  策略决策（连招优先，完全基于 lastSkill 的 comboNext）
    // ============================================================
    function getNextSkill(char, canCastFn) {
        if (!_userSkillConfig.enabled) return null;
        if (typeof canCastFn !== 'function') return null;

        // ---- 连击链强制衔接（基于 lastSkill 的 comboNext） ----
        var runtime = global.SkillRuntime;
        if (runtime && typeof runtime.getLastSkill === 'function') {
            var last = runtime.getLastSkill();
            if (last) {
                var lastPatch = (global.SKILL_PATCHES && global.SKILL_PATCHES[last]) || null;
                var nextInChain = null;
                // 优先从 onNormalAttack 读取（六合拳）
                if (lastPatch && lastPatch.onNormalAttack && lastPatch.onNormalAttack.comboNext) {
                    nextInChain = lastPatch.onNormalAttack.comboNext;
                } else if (lastPatch && lastPatch.comboNext) {
                    nextInChain = lastPatch.comboNext;
                }
                if (nextInChain && canCastFn(nextInChain, char)) {
                    return nextInChain;
                }
            }
        }

        // ---- 正常策略（依赖用户技能列表） ----
        var skills = _userSkillConfig.skills.slice();
        if (!skills || skills.length === 0) return null;

        var patches = global.SKILL_PATCHES || {};
        var filteredSkills = skills.filter(function(skillId) {
            var patch = patches[skillId];
            return !(patch && patch.onNormalAttack);
        });
        if (filteredSkills.length === 0) return null;

        var strategy = _userSkillConfig.strategy || 'priority';

        if (strategy === 'priority') {
            for (var i = 0; i < filteredSkills.length; i++) {
                if (canCastFn(filteredSkills[i], char)) return filteredSkills[i];
            }
            return null;
        }

        if (strategy === 'round_robin') {
            var start = _lastSkillIndex % filteredSkills.length;
            for (var j = 0; j < filteredSkills.length; j++) {
                var idx = (start + j) % filteredSkills.length;
                if (canCastFn(filteredSkills[idx], char)) {
                    _lastSkillIndex = (idx + 1) % filteredSkills.length;
                    return filteredSkills[idx];
                }
            }
            return null;
        }

        if (strategy === 'cd_priority') {
            var best = null;
            var bestCD = Infinity;
            for (var k = 0; k < filteredSkills.length; k++) {
                if (canCastFn(filteredSkills[k], char)) {
                    var cd = global.SkillRuntime ? global.SkillRuntime.getCooldown(filteredSkills[k]) : 0;
                    if (cd < bestCD) {
                        bestCD = cd;
                        best = filteredSkills[k];
                    }
                }
            }
            return best;
        }

        if (strategy === 'rotation') {
            if (_rotationResetNeeded) {
                _rotationUsed = {};
                _rotationResetNeeded = false;
            }
            for (var m = 0; m < filteredSkills.length; m++) {
                var sk = filteredSkills[m];
                if (!_rotationUsed[sk] && canCastFn(sk, char)) {
                    _rotationUsed[sk] = true;
                    return sk;
                }
            }
            _rotationUsed = {};
            for (var n = 0; n < filteredSkills.length; n++) {
                var sk2 = filteredSkills[n];
                if (canCastFn(sk2, char)) {
                    _rotationUsed[sk2] = true;
                    return sk2;
                }
            }
            return null;
        }

        return null;
    }

    function markRotationReset() { _rotationResetNeeded = true; }

    global.SkillStrategy = {
        loadFromChar: loadFromChar,
        getConfig: getConfig,
        isEnabled: isEnabled,
        updateSkillConfig: updateSkillConfig,
        getNextSkill: getNextSkill,
        resetRotation: resetRotation,
        markRotationReset: markRotationReset,
    };

    console.log('[SkillStrategy] ✅ 已加载（技能决策策略：priority/round_robin/cd_priority/rotation）');
})(window);