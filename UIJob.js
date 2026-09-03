// js/ui/UIJob.js
// ============================================================
//  转职面板（v5.0：统一 UIPanel 容器）
//  依赖：UIPanel、JobGateway、CharRepository、EventBus、UIManager
// ============================================================
(function(global) {
    'use strict';

    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;
    var _jobFilter = null;
    var _isOpen = false;

    // ---- 工具函数 ----
    function getDisplayName(jobKey) {
        if (!jobKey) return '未知职业';
        var def = global.JobGateway ? global.JobGateway.getJobDef(jobKey) : null;
        return def && def.name ? def.name : jobKey;
    }

    // ---- 渲染内容（返回 HTML 字符串） ----
    function renderContent() {
        var char = global.CharRepository ? global.CharRepository.getLiveRef() : null;
        if (!char) {
            return '<p style="color:var(--panel-text-secondary);">角色数据未加载</p>';
        }

        var currentJobKey = char.jobKey || 'Novice';
        var currentDisplay = getDisplayName(currentJobKey);

        var changeable = global.JobChangeService ? global.JobChangeService.getChangeableJobs() : [];
        if (_jobFilter && Array.isArray(_jobFilter) && _jobFilter.length > 0) {
            changeable = changeable.filter(function(job) {
                return _jobFilter.indexOf(job.jobKey) !== -1;
            });
        }

        var rebirthCount = char.rebirthCount || 0;
        var stageName = global.JobGateway ? global.JobGateway.getRebirthStageName(rebirthCount) : '未知阶段';
        var bonusPoints = global.JobGateway ? global.JobGateway.getBonusStatPoints(rebirthCount) : 0;
        var totalStatPoints = 48 + bonusPoints;

        var html = '';

        // ---- 当前职业 ----
        html += `
            <div class="ro-card" style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <div style="font-size:0.85rem; color:var(--panel-text-secondary);">当前职业</div>
                    <div style="font-size:1.2rem; font-weight:700;">${currentDisplay}</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:0.85rem; color:var(--panel-text-secondary);">Lv.${char.level} / Job Lv.${char.jobLevel}</div>
                </div>
            </div>
        `;

        // ---- 转生信息 ----
        html += `
            <div class="ro-card" style="border-left:3px solid var(--panel-accent-gold, #f59e0b);">
                <div class="ro-stat-row"><span>🔄 转生次数</span><span><strong>${rebirthCount}</strong> 次</span></div>
                <div class="ro-stat-row"><span>🏷️ 阶段</span><span>${stageName}</span></div>
                <div class="ro-stat-row" style="color:var(--panel-accent-blue, #3b82f6);">
                    <span>✨ 累计奖励属性点</span>
                    <span><strong>+${bonusPoints}</strong>（总 ${totalStatPoints}）</span>
                </div>
            </div>
        `;

        if (_jobFilter) {
            html += `<p style="color:var(--panel-accent-gold, #f59e0b); font-size:0.9rem;">※ 本导师仅提供特定职业转职服务</p>`;
        }

        // ---- 可转职列表 ----
        if (!changeable || changeable.length === 0) {
            html += `<p style="color:var(--panel-text-secondary);">当前职业无可用转职目标。</p>`;
        } else {
            html += `<div style="margin-top:12px;"><strong>可转职目标</strong></div>`;
            html += `<ul style="list-style:none; padding:0; margin:8px 0 0 0;">`;
            for (var i = 0; i < changeable.length; i++) {
                var job = changeable[i];
                var jobKey = job.jobKey;
                var def = global.JobGateway ? global.JobGateway.getJobDef(jobKey) : null;
                var displayName = def ? (def.name || jobKey) : jobKey;
                var can = job.can;
                var failures = job.failures || [];

                html += `<li class="ro-card" style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:8px; padding:12px 16px;">`;
                html += `<span style="flex:1; font-weight:600;">${displayName}</span>`;
                html += `<span style="color:${can ? '#22c55e' : '#ef4444'}; font-weight:500;">${can ? '✅ 可转职' : '❌ 条件不足'}</span>`;
                if (can) {
                    html += `<button class="job-change-btn" data-job="${jobKey}" style="
                        background:var(--panel-accent-blue, #3b82f6);
                        border:none; color:#fff; padding:4px 16px; border-radius:20px;
                        cursor:pointer; font-weight:600; font-size:0.9rem;
                        transition: background 0.2s;
                    " onmouseover="this.style.background='#2563eb'" onmouseout="this.style.background='var(--panel-accent-blue, #3b82f6)'">
                        转职
                    </button>`;
                } else {
                    var detailHtml = '';
                    for (var f = 0; f < failures.length; f++) {
                        var fail = failures[f];
                        var msg = '';
                        switch (fail.code) {
                            case 'prevJobs': msg = '需要前置职业：' + fail.required; break;
                            case 'baseLevel': msg = '需要基础等级 ≥ ' + fail.required + '（当前 ' + fail.current + '）'; break;
                            case 'jobLevel': msg = '需要职业等级 ≥ ' + fail.required + '（当前 ' + fail.current + '）'; break;
                            case 'minRebirth': msg = fail.message || ('需要至少 ' + fail.required + ' 次转生（当前 ' + fail.current + ' 次）'); break;
                            default: msg = '条件不足';
                        }
                        detailHtml += `<div style="font-size:0.8rem; color:#ef4444;">• ${msg}</div>`;
                    }
                    html += `<div style="flex-basis:100%; margin-top:4px;">${detailHtml}</div>`;
                }
                html += `</li>`;
            }
            html += `</ul>`;
        }

        return html;
    }

    // ---- 打开/关闭/刷新 ----
    function open(jobFilter) {
        var UIPanel = global.UIPanel || window.UIPanel;
        if (!UIPanel) {
            console.error('[UIJob] ❌ UIPanel 未加载，无法打开转职面板。');
            alert('系统面板未就绪，请刷新页面后重试。');
            return;
        }

        _jobFilter = (Array.isArray(jobFilter) && jobFilter.length > 0) ? jobFilter.slice() : null;
        if (_isOpen) {
            refresh();
            return;
        }

        var contentHtml = renderContent();
        UIPanel.show({
            title: { icon: '👤', text: '转职' },
            content: contentHtml,
            onClose: function() {
                _isOpen = false;
            }
        });
        _isOpen = true;
        bindDelegates();
    }

    function close() {
        var UIPanel = global.UIPanel || window.UIPanel;
        if (UIPanel) UIPanel.close();
        _isOpen = false;
    }

    function refresh() {
        if (!_isOpen) return;
        var UIPanel = global.UIPanel || window.UIPanel;
        if (!UIPanel) return;
        var newHtml = renderContent();
        UIPanel.updateContent(newHtml);
        bindDelegates();
    }

    // ---- 事件委托（转职按钮） ----
    function bindDelegates() {
        var body = document.querySelector('.ro-panel-body');
        if (!body) return;
        if (body._delegateHandler) {
            body.removeEventListener('click', body._delegateHandler);
        }
        var handler = function(e) {
            var btn = e.target.closest('.job-change-btn');
            if (!btn) return;
            var jobKey = btn.dataset.job;
            if (!jobKey) return;
            if (global.EventBus) {
                global.EventBus.emit('ui:change-job', { jobKey: jobKey });
            }
        };
        body.addEventListener('click', handler);
        body._delegateHandler = handler;
    }

    // ---- 生命周期 ----
    function init() {
        if (_initialized) return;
        var UIPanel = global.UIPanel || window.UIPanel;
        if (!UIPanel) {
            console.warn('[UIJob] ⚠️ UIPanel 未就绪，延迟初始化...');
            var retry = 0;
            var interval = setInterval(function() {
                retry++;
                var UIPanel2 = global.UIPanel || window.UIPanel;
                if (UIPanel2) {
                    clearInterval(interval);
                    init();
                } else if (retry > 20) {
                    clearInterval(interval);
                    console.error('[UIJob] ❌ UIPanel 加载超时');
                }
            }, 100);
            return;
        }

        // 绑定主入口按钮
        var btn = document.getElementById('btn-change-job');
        if (btn) {
            var handler = function() { open(); };
            btn.addEventListener('click', handler);
            _domListeners.push({ el: btn, event: 'click', fn: handler });
        } else {
            console.warn('[UIJob] 未找到 #btn-change-job');
        }

        var bus = global.EventBus;
        if (bus) {
            var onJobChanged = function() { refresh(); };
            bus.on('job:changed', onJobChanged);
            _listeners.push({ event: 'job:changed', fn: onJobChanged });

            var onChangeResult = function(data) {
                if (data && data.success) {
                    alert('转职成功！');
                } else {
                    alert('转职失败：' + ((data && data.message) || '未知错误'));
                }
                refresh();
            };
            bus.on('job:change-result', onChangeResult);
            _listeners.push({ event: 'job:change-result', fn: onChangeResult });

            var onRebirth = function() { refresh(); };
            bus.on('char:rebirth', onRebirth);
            _listeners.push({ event: 'char:rebirth', fn: onRebirth });
        }

        _initialized = true;
        console.log('[UIJob] ✅ 已初始化（UIPanel 适配版）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UIJob);
        }
    }

    function dispose() {
        var bus = global.EventBus;
        if (bus) {
            for (var i = 0; i < _listeners.length; i++) {
                bus.off(_listeners[i].event, _listeners[i].fn);
            }
            _listeners = [];
        }
        for (var j = 0; j < _domListeners.length; j++) {
            var item = _domListeners[j];
            item.el.removeEventListener(item.event, item.fn);
        }
        _domListeners = [];
        close();
        _initialized = false;
        console.log('[UIJob] 已销毁');
    }

    // ---- 导出 ----
    global.UIJob = {
        name: 'UIJob',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
        refresh: refresh,
        renderContent: renderContent,
        getRebirthStageName: function(rebirthCount) {
            return global.JobGateway ? global.JobGateway.getRebirthStageName(rebirthCount) : '未知阶段';
        },
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);