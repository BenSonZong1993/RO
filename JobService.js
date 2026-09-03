// ============================================================
//  FILE: JobService.js
//  LAYER: services（职业查询服务——JobGateway 薄门面）
//  权限：job:canChange（查询）
//  依赖：JobGateway
//  契约：getJobInfo / getJobPath / canChangeTo
//  说明：转职"执行"已迁移到 JobChangeService；本模块只做只读查询
// ============================================================
(function(global) {
    'use strict';

    function getJobInfo(jobKey) {
        return global.JobGateway ? global.JobGateway.getJobDef(jobKey) : null;
    }

    // ---- 转职路径 BFS（保持原实现） ----
    function getJobPath(currentJob, targetJob) {
        if (currentJob === targetJob) return [currentJob];
        var visited = new Set();
        var queue = [[currentJob]];
        var jobGroups = global.JobGroups || {};
        while (queue.length > 0) {
            var path = queue.shift();
            var last = path[path.length - 1];
            if (visited.has(last)) continue;
            visited.add(last);
            var def = jobGroups[last];
            if (!def) continue;
            var nextJobs = def.nextJobs || [];
            for (var i = 0; i < nextJobs.length; i++) {
                var next = nextJobs[i];
                if (next === targetJob) return path.concat([next]);
                if (!visited.has(next)) queue.push(path.concat([next]));
            }
        }
        return null;
    }

    function canChangeTo(newJobKey, char) {
        return global.JobGateway ? global.JobGateway.canChangeTo(newJobKey, char) : false;
    }

    global.JobService = {
        getJobInfo: getJobInfo,
        getJobPath: getJobPath,
        canChangeTo: canChangeTo,
        init: function() {
            console.log('[JobService] ✅ 已加载（JobGateway 薄门面，执行已归 JobChangeService）');
            return true;
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { global.JobService.init(); });
    } else {
        global.JobService.init();
    }
})(window);
