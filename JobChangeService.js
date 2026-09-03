// ============================================================
//  FILE: JobChangeService.js
//  LAYER: services（转职业务——条件检查 + Context 落地）
//  权限：job:change / char:updateJob（经 AccessControl）
//  依赖：JobGateway（条件检查唯一入口）、CharacterContext、CharRepository
//  契约：
//    changeJob(newJobKey, caller) → { success, message }
//    getChangeableJobs(caller)    → [{ jobKey, displayName, can, failures }]
//  规则：JOB-1 —— 禁止直接修改 char.jobKey；条件判断经 JobGateway
// ============================================================
(function(global) {
    'use strict';

    var _bus = null;

    function init(deps) {
        _bus = (deps && deps.eventBus) || global.EventBus;
        console.log('[JobChangeService] ✅ 已加载（转职业务服务）');
        return true;
    }

    function changeJob(newJobKey, caller) {
        var repo = global.CharRepository;
        if (!repo || !repo.getLiveRef()) return { success: false, message: '角色数据不存在' };

        if (global.AccessControl && !global.AccessControl.check('job:change', caller || 'JobChangeService')) {
            return { success: false, message: '权限不足' };
        }

        // ---- 条件检查（含前置职业/等级/转生次数，配置驱动） ----
        var check = global.JobGateway.checkJobChangeConditions(repo.getLiveRef(), newJobKey);
        if (!check.passed) {
var first = check.failures && check.failures[0];
var reason = '不满足转职条件';
if (first) {
    switch (first.code) {
        case 'prevJobs':
            reason = '需要前置职业: ' + first.required;
            break;
        case 'baseLevel':
            reason = '需要基础等级 ≥ ' + first.required + '（当前 ' + first.current + '）';
            break;
        case 'jobLevel':
            reason = '需要职业等级 ≥ ' + first.required + '（当前 ' + first.current + '）';
            break;
        case 'minRebirth':
            reason = first.message || '需要至少 ' + first.required + ' 次转生（当前 ' + first.current + ' 次）';
            break;
        default:
            reason = '不满足转职条件（' + first.code + '）';
    }
}

            
            return { success: false, message: reason };
        }

        // ---- 落地（经 CharacterContext：重置 Job 等级/技能点 + 重算 + 事件） ----
        var result = global.CharacterContext
            ? global.CharacterContext.updateJob(newJobKey, 'JobChangeService')
            : { success: false, message: 'CharacterContext 未加载' };

        if (result.success) {
            console.log('[JobChangeService] ✅ 转职成功:', repo.getLiveRef().jobKey, '→', newJobKey);
        }
        return result;
    }

    // ---- 可转职目标列表（供 UIJob 只读渲染） ----
    function getChangeableJobs(caller) {
        var repo = global.CharRepository;
        if (!repo || !repo.getLiveRef()) return [];
        var live = repo.getLiveRef();
        var nextJobs = global.JobGateway.getNextJobs(live.jobKey) || [];
        var result = [];
        for (var i = 0; i < nextJobs.length; i++) {
            var jobKey = nextJobs[i];
            var def = global.JobGateway.getJobDef(jobKey);
            if (!def) continue;
            var check = global.JobGateway.checkJobChangeConditions(live, jobKey);
            result.push({
                jobKey: jobKey,
                displayName: def.name || jobKey,
                can: check.passed,
                failures: check.failures || [],
                conditions: def.conditions || null,
            });
        }
        return result;
    }

    var JobChangeService = {
        init: init,
        changeJob: changeJob,
        getChangeableJobs: getChangeableJobs,
    };

    global.JobChangeService = JobChangeService;
})(window);
