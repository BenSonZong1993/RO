// ============================================================
//  FILE: RebirthService.js
//  LAYER: services（转生业务——条件检查、费用扣除、状态重置编排）
//  权限：rebirth:perform / char:resetCharacter（经 AccessControl）
//  依赖：JobGateway（条件检查唯一入口）、CharacterContext、AttributeGateway、
//        CharRepository、EventBus、RebirthConfig（经 JobGateway）
//  契约：
//    performRebirth(caller) → { success, message, rebirthCount?, bonusStatPoints? }
//  规则：REB-1 —— 禁止直接修改 char.rebirthCount；全部经本服务编排
//  行为基线：与旧 CharController.performRebirth 数值与事件完全一致
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function _fmtZeny(n) {
        if (n >= 100000000) return (n / 100000000) + '亿';
        if (n >= 10000) return (n / 10000) + '万';
        return String(n);
    }

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        console.log('[RebirthService] ✅ 已加载（转生业务服务）');
        return true;
    }

    function performRebirth(caller) {
        var bus = _bus || global.EventBus;
        var repo = global.CharRepository;

        if (!repo || !repo.getLiveRef()) return { success: false, message: '角色数据不存在' };

        if (global.AccessControl && !global.AccessControl.check('rebirth:perform', caller || 'RebirthService')) {
            return { success: false, message: '权限不足' };
        }

        // ---- 条件检查（JobGateway：配置驱动 + 失败明细） ----
        var check = global.JobGateway.checkRebirthConditions(repo.getLiveRef());
        if (!check.passed || !check.stage) {
            var first = check.failures && check.failures[0];
            var message = '已达到最终阶段，无法继续转生';
            if (check.stage && first) {
                if (first.code === 'baseLevel') message = '需要 Base Lv.' + first.required + ' 以上';
                else if (first.code === 'jobLevel') message = '需要 Job Lv.' + first.required + ' 以上';
                else if (first.code === 'zeny') message = '需要 ' + _fmtZeny(first.required) + ' Zeny';
            }
            return { success: false, message: message };
        }

        var stage = check.stage;
        var cond = stage.condition;

        // ---- 构造重置后的新状态（原子替换，背包/云存档不动） ----
        var live = repo.getLiveRef();
        var newRebirthCount = (live.rebirthCount || 0) + 1;
        var totalBonus = global.JobGateway.getBonusStatPoints(newRebirthCount);
        var newState = JSON.parse(JSON.stringify(live, function(key, value) {
            if (key === 'sc' || key === '_finalStats') return undefined;
            return value;
        }));
        newState.level = 1;
        newState.jobLevel = 1;
        newState.exp = 0;
        newState.jobExp = 0;
        newState.skillPoints = 0;
        newState.learnedSkills = {};
        newState.jobKey = stage.startJobAfter || 'Novice';
        newState.statPoints = 48 + totalBonus; // 初始 48 + 累计奖励（配置驱动）
        newState.rebirthCount = newRebirthCount;
        newState.zeny = (live.zeny || 0) - (cond.zeny || 0); // 扣除转生费用

        // ---- 原子重置（经 CharacterContext） ----
        var resetOk = global.CharacterContext
            ? global.CharacterContext.resetCharacter(newState, caller || 'RebirthService')
            : repo.replace(newState, caller || 'RebirthService');
        if (!resetOk) return { success: false, message: '重置角色失败' };

        // ---- 属性重算 ----
        if (global.AttributeGateway) {
            global.AttributeGateway.invalidate('rebirth', {}, caller || 'RebirthService');
        } else if (global.AttributeMediator) {
            global.AttributeMediator.forceRecalc();
        }

        // ---- 满血满蓝（等待重算完成后按新 finalStats 恢复） ----
        setTimeout(function() {
            var char = repo.getLiveRef();
            if (!char) return;
            var maxHp = global.AttributeGateway ? global.AttributeGateway.get('finalMaxHP', 'RebirthService') : null;
            var maxSp = global.AttributeGateway ? global.AttributeGateway.get('finalMaxSP', 'RebirthService') : null;
            if (typeof maxHp !== 'number') maxHp = char.maxHp || 100;
            if (typeof maxSp !== 'number') maxSp = char.maxSp || 50;
            global.CharRepository.update(function(c) {
                c.hp = maxHp;
                c.sp = maxSp;
            }, 'RebirthService');
            if (bus) {
                bus.emit('char:hpChanged', { hp: maxHp, maxHp: maxHp });
                bus.emit('char:spChanged', { sp: maxSp, maxSp: maxSp });
            }
            console.log('[RebirthService] ✅ 转生完成，当前转生次数:', newRebirthCount);
        }, 100);

        // ---- 广播转生事件（UISkillTree/UIJob 监听） ----
        if (bus) {
            bus.emit('char:rebirth', { result: { success: true, rebirthCount: newRebirthCount } });
        }

        return {
            success: true,
            message: '转生成功！你已成为 ' + (stage.label || '未知职业') + '，获得 ' + totalBonus + ' 额外属性点。',
            rebirthCount: newRebirthCount,
            bonusStatPoints: totalBonus,
        };
    }

    var RebirthService = { init: init, performRebirth: performRebirth };

    global.RebirthService = RebirthService;
})(window);
