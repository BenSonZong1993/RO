// ============================================================
//  FILE: JobGateway.js (v3.1 - 增加性别检查)
//  LAYER: gateway（职业数据统一网关）
//  功能：聚合所有职业相关数据，支持性别限定转职
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  一、内部辅助工具（不变）
    // ============================================================

    function _findJobEntry(dataArray, jobKey) {
        if (!Array.isArray(dataArray)) return null;
        for (var i = 0; i < dataArray.length; i++) {
            var entry = dataArray[i];
            if (entry.Jobs && entry.Jobs[jobKey]) {
                return entry;
            }
        }
        return null;
    }

    function _clone(obj) {
        return obj ? JSON.parse(JSON.stringify(obj)) : null;
    }

    // ============================================================
    //  二、原有功能：职业定义与转职树（来自 JobGroups）
    // ============================================================

    function getJobDef(jobKey) {
        var def = (global.JobGroups || {})[jobKey] || null;
        return _clone(def);
    }

    function getPrevJobs(jobKey) {
        var def = (global.JobGroups || {})[jobKey];
        return def ? (def.prevJobs || []) : [];
    }

    function getNextJobs(jobKey) {
        var def = (global.JobGroups || {})[jobKey];
        return def ? (def.nextJobs || []) : [];
    }

    // ---- 条件树评估（内部） ----
    function _evaluateConditions(conditions, char) {
        if (!conditions) return { passed: true, failures: [] };

        var type = conditions.type || 'and';
        var rules = conditions.rules || [];
        var failures = [];

        if (type === 'and') {
            for (var i = 0; i < rules.length; i++) {
                var r = _evaluateRule(rules[i], char);
                if (!r.passed) failures.push(r);
            }
        } else if (type === 'or') {
            var anyPassed = false;
            for (var j = 0; j < rules.length; j++) {
                var r2 = _evaluateRule(rules[j], char);
                if (r2.passed) { anyPassed = true; break; }
                failures.push(r2);
            }
            if (anyPassed) failures = [];
        } else {
            console.warn('[JobGateway] 未知条件类型:', type);
            return { passed: false, failures: [{ code: 'unknown_condition_type', required: type, current: null }] };
        }
        return { passed: failures.length === 0, failures: failures };
    }

    function _evaluateRule(rule, char) {
        if (!rule || !rule.type) return { passed: true };
        switch (rule.type) {
            case 'level':
                var lv = rule.value || 0;
                return ((char.level || 0) >= lv)
                    ? { passed: true }
                    : { passed: false, code: 'baseLevel', required: lv, current: char.level || 0 };
            case 'jobLevel':
                var jlv = rule.value || 0;
                return ((char.jobLevel || 0) >= jlv)
                    ? { passed: true }
                    : { passed: false, code: 'jobLevel', required: jlv, current: char.jobLevel || 0 };
            default:
                console.warn('[JobGateway] 未知规则类型:', rule.type);
                return { passed: true };
        }
    }

    // ---- 转职条件检查（已增加性别检查） ----
    function checkJobChangeConditions(char, targetJobKey) {
        var def = (global.JobGroups || {})[targetJobKey];
        if (!def) {
            return { passed: false, failures: [{ code: 'unknown_job', required: targetJobKey, current: null }] };
        }

        var failures = [];

        // ★ 新增：性别检查
        if (def.gender) {
            var charGender = (char && char.gender) || 'male';
            if (charGender !== def.gender) {
                failures.push({
                    code: 'gender',
                    required: def.gender,
                    current: charGender,
                    message: '该职业仅限' + (def.gender === 'male' ? '男性' : '女性') + '角色转职'
                });
            }
        }

        // 1. 转生次数检查
        var minRebirth = def.minRebirth || 0;
        var currentRebirth = (char && typeof char.rebirthCount === 'number') ? char.rebirthCount : 0;
        if (currentRebirth < minRebirth) {
            failures.push({
                code: 'minRebirth',
                required: minRebirth,
                current: currentRebirth,
                message: '需要至少 ' + minRebirth + ' 次转生（当前 ' + currentRebirth + ' 次）'
            });
        }

        // 2. 前置职业检查
        var prevJobs = def.prevJobs || [];
        if (prevJobs.length > 0 && prevJobs.indexOf(char.jobKey) === -1) {
            failures.push({
                code: 'prevJobs',
                required: prevJobs.join('、'),
                current: char.jobKey || 'Novice'
            });
        }

        // 3. 条件规则树
        if (def.conditions) {
            var condResult = _evaluateConditions(def.conditions, char);
            if (!condResult.passed) {
                failures = failures.concat(condResult.failures);
            }
        }

        return { passed: failures.length === 0, failures: failures };
    }

    function canChangeTo(jobKey, char) {
        return checkJobChangeConditions(char, jobKey).passed;
    }

    // ============================================================
    //  三、转生配置（不变）
    // ============================================================

    function getRebirthStage(rebirthCount) {
        var stage = global.RebirthConfig ? global.RebirthConfig.getRebirthStage(rebirthCount) : null;
        return _clone(stage);
    }

    function getMaxRebirthStage() {
        return global.RebirthConfig ? global.RebirthConfig.getMaxRebirthStage() : 4;
    }

    function getRebirthStageName(rebirthCount) {
        var stage = getRebirthStage(rebirthCount);
        return stage ? (stage.label || '未知阶段') : '未知阶段';
    }

    function getBonusStatPoints(rebirthCount) {
        var count = Math.max(0, rebirthCount || 0);
        var total = 0;
        var configValid = false;
        for (var i = 1; i <= count; i++) {
            var stage = getRebirthStage(i);
            if (stage && typeof stage.bonusStatPoints === 'number') {
                total += stage.bonusStatPoints;
                configValid = true;
            }
        }
        if (!configValid) total = 52 * count;
        return total;
    }

    function checkRebirthConditions(char) {
        if (!char) return { passed: false, failures: [{ code: 'no_char', required: null, current: null }] };
        var stage = getRebirthStage(char.rebirthCount);
        if (!stage) {
            return { passed: false, failures: [{ code: 'max_stage', required: null, current: char.rebirthCount || 0 }] };
        }
        if (!stage.condition) {
            return { passed: false, failures: [{ code: 'final_stage', required: null, current: char.rebirthCount || 0 }] };
        }
        var cond = stage.condition;
        var failures = [];
        if (char.level < cond.baseLevel) {
            failures.push({ code: 'baseLevel', required: cond.baseLevel, current: char.level });
        }
        if (char.jobLevel < cond.jobLevel) {
            failures.push({ code: 'jobLevel', required: cond.jobLevel, current: char.jobLevel });
        }
        if ((char.zeny || 0) < cond.zeny) {
            failures.push({ code: 'zeny', required: cond.zeny, current: char.zeny || 0 });
        }
        return { passed: failures.length === 0, failures: failures, stage: stage };
    }

    // ============================================================
    //  四、独立数据源查询（不变）
    // ============================================================

    function getAspd(jobKey, weaponType) {
        var entry = _findJobEntry(global.JOB_ASPD, jobKey);
        if (!entry) {
            console.warn('[JobGateway] ⚠️ 未找到职业 ' + jobKey + ' 的攻速数据，使用默认值 60');
            return 60;
        }
        var map = entry.BaseASPD || {};
        if (map[weaponType] !== undefined) return map[weaponType];
        if (map['Fist'] !== undefined) return map['Fist'];
        if (map['None'] !== undefined) return map['None'];
        var keys = Object.keys(map);
        return keys.length > 0 ? map[keys[0]] : 60;
    }

    function getExpTable(jobKey) {
        if (!jobKey) return null;
        var data = global.JOB_EXP;
        if (!data || !Array.isArray(data)) {
            console.warn('[JobGateway] JOB_EXP 数据未加载');
            return null;
        }
        var merged = {
            BaseExp: [],
            JobExp: [],
            MaxBaseLevel: 99,
            MaxJobLevel: 50
        };
        var found = false;
        for (var i = 0; i < data.length; i++) {
            var entry = data[i];
            if (entry.Jobs && entry.Jobs[jobKey] === true) {
                found = true;
                if (Array.isArray(entry.BaseExp) && entry.BaseExp.length > 0) {
                    merged.BaseExp = entry.BaseExp;
                }
                if (Array.isArray(entry.JobExp) && entry.JobExp.length > 0) {
                    merged.JobExp = entry.JobExp;
                }
                if (typeof entry.MaxBaseLevel === 'number') {
                    merged.MaxBaseLevel = entry.MaxBaseLevel;
                }
                if (typeof entry.MaxJobLevel === 'number') {
                    merged.MaxJobLevel = entry.MaxJobLevel;
                }
            }
        }
        return found ? merged : null;
    }

    function getStatFactors(jobKey) {
        var entry = _findJobEntry(global.JOB_STATS, jobKey);
        if (!entry) {
            console.warn('[JobGateway] ⚠️ 未找到职业 ' + jobKey + ' 的统计数据，使用默认值');
            return { HpFactor: 0, SpFactor: 0, MaxWeight: 2000 };
        }
        return {
            HpFactor: entry.HpFactor || 0,
            SpFactor: entry.SpFactor || 0,
            MaxWeight: entry.MaxWeight || 2000,
        };
    }

    function getBasePoints(jobKey) {
        var entries = (global.JOB_BASEPOINTS || []).filter(function(e) {
            return e.Jobs && e.Jobs[jobKey];
        });
        if (entries.length === 0) {
            console.warn('[JobGateway] ⚠️ 未找到职业 ' + jobKey + ' 的基础属性数据');
            return { BaseHp: [], BaseSp: [], BaseAp: [] };
        }
        var result = {};
        entries.forEach(function(entry) {
            for (var key in entry) {
                if (key !== 'Jobs') {
                    result[key] = entry[key];
                }
            }
        });
        if (!result.BaseHp) result.BaseHp = [];
        if (!result.BaseSp) result.BaseSp = [];
        if (!result.BaseAp) result.BaseAp = [];
        return result;
    }

    // ============================================================
    //  五、暴露 API
    // ============================================================

    var JobGateway = {
        getJobDef: getJobDef,
        getPrevJobs: getPrevJobs,
        getNextJobs: getNextJobs,
        canChangeTo: canChangeTo,
        checkJobChangeConditions: checkJobChangeConditions,
        getRebirthStage: getRebirthStage,
        getMaxRebirthStage: getMaxRebirthStage,
        getRebirthStageName: getRebirthStageName,
        getBonusStatPoints: getBonusStatPoints,
        checkRebirthConditions: checkRebirthConditions,
        getAspd: getAspd,
        getExpTable: getExpTable,
        getStatFactors: getStatFactors,
        getBasePoints: getBasePoints,
    };

    global.JobGateway = JobGateway;
    console.log('[JobGateway] ✅ 已加载（v3.1：支持性别检查）');
})(window);