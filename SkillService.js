// ============================================================
//  FILE: SkillService.js
//  LAYER: services（技能业务——学习/跨树继承/重置服务编排）
//  权限：char:learnSkill / char:resetSkillPoints / char:resetStatPoints（经 AccessControl）
//  依赖：SkillGateway（树/条件唯一入口）、JobGateway（职业链）、CharRepository、
//        AttributeGateway、EventBus、ResetServiceConfig（策划费用表）
//  契约：
//    getSkillInfo(jobKey, skillId)
//    learnSkill(skillId, caller)   → 跨树学习：自动解析技能所属职业树
//    resetSkillPoints(caller)      → 技能大师：清空技能并返还已投入技能点
//    resetStatPoints(caller)       → 素质大师：属性回 1 并返还已消耗素质点
//    getResetServiceInfo(caller)   → 重置费用/免费窗口信息（供 UI 确认）
//  跨职业继承规则（RO 官方语义）：
//    转职保留 learnedSkills 与技能点池；历史职业树技能可继续加点
//    （跳过该树 JobLv 校验——旧职业 JobLv 已不存在，技能前置仍须满足）
// ============================================================
(function(global) {
    'use strict';

    function getSkillInfo(jobKey, skillId) {
        return global.SkillGateway ? global.SkillGateway.getTreeSkillDef(jobKey, skillId) : null;
    }

    // ---- 职业链（祖先 → 当前）：沿 JobGroups.prevJobs 回溯 ----
    function _buildJobChain(jobKey) {
        var chain = [];
        var cur = jobKey;
        var guard = 0;
        while (cur && guard++ < 12) {
            chain.unshift(cur);
            var prev = global.JobGateway ? global.JobGateway.getPrevJobs(cur) : [];
            cur = (prev && prev.length > 0) ? prev[0] : null;
        }
        return chain;
    }

    // ---- 解析技能所属职业树（历史树优先级低于当前树） ----
    function _resolveTreeJobKey(skillId, jobKey) {
        var chain = _buildJobChain(jobKey);
        for (var i = chain.length - 1; i >= 0; i--) {
            var def = global.SkillGateway ? global.SkillGateway.getTreeSkillDef(chain[i], skillId) : null;
            if (def) return chain[i];
        }
        return null;
    }

    function learnSkill(skillId, caller) {
        var repo = global.CharRepository;
        if (!repo || !repo.getLiveRef()) return { success: false, message: '角色不存在' };

        if (global.AccessControl && !global.AccessControl.check('char:learnSkill', caller || 'SkillService')) {
            return { success: false, message: '权限不足' };
        }

        var live = repo.getLiveRef();
        var jobKey = live.jobKey;
        if (!jobKey) return { success: false, message: '职业未知' };

        // 跨树解析：技能可能属于历史职业树（转职保留机制）
        var ownerJobKey = _resolveTreeJobKey(skillId, jobKey);
        if (!ownerJobKey) return { success: false, message: '技能不存在于当前职业链' };
        var isCurrentTree = ownerJobKey === jobKey;

        var learned = live.learnedSkills || {};
        var can = global.SkillGateway
            ? global.SkillGateway.canLearn(ownerJobKey, skillId, live, learned, { skipJobLevel: !isCurrentTree })
            : false;
        if (!can) return { success: false, message: '不满足学习条件' };

        if ((live.skillPoints || 0) <= 0) return { success: false, message: '技能点不足' };

        var skillDef = global.SkillGateway.getTreeSkillDef(ownerJobKey, skillId);
        if (!skillDef) return { success: false, message: '技能不存在' };
        if ((learned[skillId] || 0) >= skillDef.maxLevel) return { success: false, message: '技能已达最高等级' };

        var newLevel = 0;
        var changed = repo.update(function(char) {
            char.learnedSkills = char.learnedSkills || {};
            char.learnedSkills[skillId] = (char.learnedSkills[skillId] || 0) + 1;
            char.skillPoints -= 1;
            newLevel = char.learnedSkills[skillId];
        }, 'SkillService');
        if (!changed) return { success: false, message: '保存失败' };

        if (global.AttributeGateway) global.AttributeGateway.invalidate('skill', { skill: skillId }, 'SkillService');
        if (global.EventBus) {
            global.EventBus.emit('char:skillLearned', { skill: skillId, level: newLevel });
            global.EventBus.emit('char:changed', { char: repo.getLiveRef() });
        }

            // 新增：触发属性重算
    if (global.AttributeGateway && typeof global.AttributeGateway.invalidate === 'function') {
        global.AttributeGateway.invalidate('SkillService', { skillId: skillId }, 'SkillService');
    }
    if (global.AttributeMediator && typeof global.AttributeMediator.requestRecalc === 'function') {
        global.AttributeMediator.requestRecalc('SkillService');
    }
    
    // 发送事件通知 UI
    if (global.EventBus) {
        global.EventBus.emit('char:skillLearned', { skillId: skillId });
        global.EventBus.emit('char:changed', { char: global.CharRepository.getLiveRef() });
    }

        console.log('[SkillService] ✅ 学习技能:', skillId, 'Lv.' + newLevel, isCurrentTree ? '' : '（跨树继承）');
        return { success: true, message: '学习技能成功', skill: skillId, level: newLevel };
    }

    // ============================================================
    //  技能大师 / 素质大师
    //  费用与免费窗口：global.ResetServiceConfig（策划可调，默认 500 万 Zeny）
    //  免费窗口：未转生 且 Base < freeMaxBaseLevel；窗口外每次收费
    //  注意：转生路径不返还（RebirthService 原子重置已重建点数），故返还逻辑独立于此处的转生流程
    // ============================================================
    function _getResetConfig() {
        var cfg = global.ResetServiceConfig || {};
        return {
            freeMaxBaseLevel: typeof cfg.freeMaxBaseLevel === 'number' ? cfg.freeMaxBaseLevel : 50,
            skillResetZeny: typeof cfg.skillResetZeny === 'number' ? cfg.skillResetZeny : 5000000,
            statResetZeny: typeof cfg.statResetZeny === 'number' ? cfg.statResetZeny : 5000000,
        };
    }

    function _inFreeWindow(char, cfg) {
        return (char.rebirthCount || 0) === 0 && (char.level || 1) < cfg.freeMaxBaseLevel;
    }

    function _fmtZeny(n) {
        if (n >= 100000000) return (n / 100000000) + '亿';
        if (n >= 10000) return (n / 10000) + '万';
        return String(n);
    }

    function getResetServiceInfo(caller) {
        var repo = global.CharRepository;
        var live = (repo && repo.getLiveRef) ? repo.getLiveRef() : null;
        var cfg = _getResetConfig();
        var free = live ? _inFreeWindow(live, cfg) : true;
        var invested = 0;
        if (live) {
            var learned = live.learnedSkills || {};
            for (var k in learned) invested += learned[k];
        }
        return {
            free: free,
            freeMaxBaseLevel: cfg.freeMaxBaseLevel,
            skillCost: free ? 0 : cfg.skillResetZeny,
            statCost: free ? 0 : cfg.statResetZeny,
            investedSkillPoints: invested,
        };
    }

    function resetSkillPoints(caller) {
        var repo = global.CharRepository;
        if (!repo || !repo.getLiveRef()) return { success: false, message: '角色不存在' };
        if (global.AccessControl && !global.AccessControl.check('char:resetSkillPoints', caller || 'SkillService')) {
            return { success: false, message: '权限不足' };
        }

        var live = repo.getLiveRef();
        var cfg = _getResetConfig();
        var free = _inFreeWindow(live, cfg);
        var cost = free ? 0 : cfg.skillResetZeny;

        var invested = 0;
        var learned = live.learnedSkills || {};
        for (var k in learned) invested += learned[k];
        if (invested <= 0) return { success: false, message: '当前没有已投入的技能点，无需重置' };
        if (!free && (live.zeny || 0) < cost) {
            return { success: false, message: 'Zeny 不足（需要 ' + _fmtZeny(cost) + ' Zeny）' };
        }

        if (cost > 0) {
            var paid = repo.update(function(ch) { ch.zeny -= cost; }, 'SkillService');
            if (!paid) return { success: false, message: '扣费失败' };
        }
        var cleared = repo.clearSkills('SkillService');
        if (!cleared) return { success: false, message: '技能清空失败' };
        var refunded = repo.update(function(ch) {
            ch.skillPoints = (ch.skillPoints || 0) + invested;
            if (ch._autoSkillConfig) ch._autoSkillConfig.skills = [];   // 策略列表同步清空，防残留
        }, 'SkillService');
        if (!refunded) return { success: false, message: '技能点返还失败' };

        if (global.AttributeGateway) global.AttributeGateway.invalidate('resetSkills', {}, 'SkillService');
        if (global.EventBus) {
            global.EventBus.emit('char:changed', { char: repo.getLiveRef(), source: 'resetSkillPoints' });
        }
        return {
            success: true,
            message: (free ? '免费重置成功' : '重置成功（收取 ' + _fmtZeny(cost) + ' Zeny）')
                + '：已返还 ' + invested + ' 技能点',
            refunded: invested,
            cost: cost,
        };
    }

    function resetStatPoints(caller) {
        var repo = global.CharRepository;
        if (!repo || !repo.getLiveRef()) return { success: false, message: '角色不存在' };
        if (global.AccessControl && !global.AccessControl.check('char:resetStatPoints', caller || 'SkillService')) {
            return { success: false, message: '权限不足' };
        }

        var live = repo.getLiveRef();
        var cfg = _getResetConfig();
        var free = _inFreeWindow(live, cfg);
        var cost = free ? 0 : cfg.statResetZeny;

        // 返还已消耗素质点：属性从 1 升到当前值的逐级费用和（ArithmeticCore 加点曲线）
        var statKeys = (global.CharData && global.CharData.STAT_KEYS) || ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
        var refund = 0;
        for (var s = 0; s < statKeys.length; s++) {
            var cur = (live.stats && live.stats[statKeys[s]]) || 1;
            for (var v = 1; v < cur; v++) {
                var c = (global.ArithmeticCore && typeof global.ArithmeticCore.getStatPointCost === 'function')
                    ? global.ArithmeticCore.getStatPointCost(v) : v;
                refund += (typeof c === 'number' && !isNaN(c)) ? c : v;
            }
        }
        if (refund <= 0) return { success: false, message: '当前没有已消耗的素质点，无需重置' };
        if (!free && (live.zeny || 0) < cost) {
            return { success: false, message: 'Zeny 不足（需要 ' + _fmtZeny(cost) + ' Zeny）' };
        }

        var changed = repo.update(function(ch) {
            if (cost > 0) ch.zeny -= cost;
            for (var s2 = 0; s2 < statKeys.length; s2++) ch.stats[statKeys[s2]] = 1;
            ch.statPoints = (ch.statPoints || 0) + refund;
        }, 'SkillService');
        if (!changed) return { success: false, message: '重置失败' };

        if (global.AttributeGateway) global.AttributeGateway.invalidate('stat', { reset: true }, 'SkillService');
        if (global.EventBus) {
            global.EventBus.emit('char:changed', { char: repo.getLiveRef(), source: 'resetStatPoints' });
        }
        return {
            success: true,
            message: (free ? '免费重置成功' : '重置成功（收取 ' + _fmtZeny(cost) + ' Zeny）')
                + '：已返还 ' + refund + ' 素质点',
            refunded: refund,
            cost: cost,
        };
    }

    var SkillService = {
        getSkillInfo: getSkillInfo,
        learnSkill: learnSkill,
        resetSkillPoints: resetSkillPoints,
        resetStatPoints: resetStatPoints,
        getResetServiceInfo: getResetServiceInfo,
        init: function() {
            console.log('[SkillService] ✅ 已加载（跨树继承 + 重置服务）');
            return true;
        },
    };

    global.SkillService = SkillService;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { global.SkillService.init(); });
    } else {
        global.SkillService.init();
    }
})(window);
