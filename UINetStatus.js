// ============================================================
//  FILE: UINetStatus.js
//  LAYER: ui（联网状态徽章——屏幕左下角小角标）
//  权限：无（只读展示）
//  依赖：EventBus（net:status 事件，由 CloudStorageService 发出）、UIManager
//  显示：
//    ☁️ 已连接 your-server:3000   —— 云模式（存档自动上服务器）
//    📴 离线模式                  —— 服务器不可达（本地存档，恢复后自动续传）
// ============================================================
(function(global) {
    'use strict';

    var el = null;
    var _initialized = false;

    function render(state) {
        if (!el) {
            el = document.createElement('div');
            el.id = 'net-status-badge';
            el.style.cssText = 'position:fixed; left:6px; bottom:6px; z-index:9999;' +
                'font-size:0.72rem; padding:2px 10px; border-radius:10px;' +
                'background:rgba(0,0,0,0.45); color:#cfd8dc; pointer-events:none; user-select:none;';
            (document.body || document.documentElement).appendChild(el);
        }
        if (state && state.connected) {
            var host = String(state.server || '').replace(/^https?:\/\//, '');
            el.textContent = '☁️ 已连接 ' + host;
            el.title = '云存档已启用（本地优先，自动同步）';
        } else {
            el.textContent = '📴 离线模式';
            el.title = '未连接存档服务器；本地存档游玩中，服务器恢复可达后自动同步';
        }
    }

    function init() {
        if (_initialized) return;
        if (!global.EventBus) return;
        global.EventBus.on('net:status', render);
        _initialized = true;
        console.log('[UINetStatus] ✅ 已初始化（联网状态角标）');
        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UINetStatus);
        }
    }

    function dispose() {
        if (global.EventBus) global.EventBus.off('net:status', render);
        _initialized = false;
    }

    global.UINetStatus = { name: 'UINetStatus', init: init, dispose: dispose };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
