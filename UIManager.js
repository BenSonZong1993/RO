// js/ui/UIManager.js
(function(global) {
    'use strict';

    // ============================================================
    //  工具函数：节流（throttle）与防抖（debounce）
    // ============================================================
    function throttle(fn, delay) {
        let lastCall = 0;
        let timeoutId = null;
        const throttled = function(...args) {
            const now = Date.now();
            const remaining = delay - (now - lastCall);
            if (remaining <= 0) {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                lastCall = now;
                fn.apply(this, args);
            } else if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    lastCall = Date.now();
                    timeoutId = null;
                    fn.apply(this, args);
                }, remaining);
            }
        };
        throttled.cancel = function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        return throttled;
    }

    function debounce(fn, delay) {
        let timeoutId = null;
        const debounced = function(...args) {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                timeoutId = null;
                fn.apply(this, args);
            }, delay);
        };
        debounced.cancel = function() {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        };
        return debounced;
    }

    // ============================================================
    //  UI 模块管理
    // ============================================================
    const UI_MODULES = [];

    function register(module) {
        if (module && typeof module.init === 'function') {
            UI_MODULES.push(module);
        }
    }

    function initAll() {
        for (const mod of UI_MODULES) {
            try {
                mod.init();
            } catch (e) {
                console.error('[UIManager] 初始化失败:', mod, e);
            }
        }
    }

    function disposeAll() {
        let count = 0;
        for (const mod of UI_MODULES) {
            if (typeof mod.dispose === 'function') {
                try {
                    mod.dispose();
                    count++;
                } catch (e) {
                    console.error('[UIManager] dispose 失败:', mod, e);
                }
            }
        }
        console.log('[UIManager] 已清理 ' + count + ' 个模块的事件监听');
    }

    function disposeModule(moduleName) {
        for (const mod of UI_MODULES) {
            if (mod.name === moduleName) {
                if (typeof mod.dispose === 'function') {
                    mod.dispose();
                    return true;
                }
                return false;
            }
        }
        return false;
    }

    // ========== 面板单例管理（修复动态面板冲突） ==========
UIManager._panels = {};

UIManager.openPanel = function(name, createCallback) {
    // 1. 如果已存在同名面板，先销毁旧的
    if (this._panels[name]) {
        this.closePanel(name);
    }

    // 2. 创建新面板
    var panel = createCallback();
    if (!panel) return null;

    // 3. 存入缓存
    this._panels[name] = panel;

    // 4. 确保遮罩层唯一（不重复创建）
    this._ensureOverlay();

    return panel;
};

UIManager.closePanel = function(name) {
    var panel = this._panels[name];
    if (panel) {
        if (panel.parentNode) panel.parentNode.removeChild(panel);
        delete this._panels[name];
    }

    // 如果没有剩余面板，移除遮罩
    if (Object.keys(this._panels).length === 0) {
        this._removeOverlay();
    }
};

UIManager.closeAllPanels = function() {
    var names = Object.keys(this._panels);
    for (var i = 0; i < names.length; i++) {
        this.closePanel(names[i]);
    }
};

UIManager._ensureOverlay = function() {
    // 如果已有遮罩，不重复创建
    if (document.getElementById('ro-panel-overlay')) return;

    var overlay = document.createElement('div');
    overlay.id = 'ro-panel-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.zIndex = '999';
    overlay.style.pointerEvents = 'auto';

    // 点击遮罩关闭所有面板
    overlay.addEventListener('click', function() {
        UIManager.closeAllPanels();
    });

    document.body.appendChild(overlay);
};

UIManager._removeOverlay = function() {
    var overlay = document.getElementById('ro-panel-overlay');
    if (overlay) {
        overlay.parentNode.removeChild(overlay);
    }
};

    // ============================================================
    //  暴露全局
    // ============================================================
    global.UIManager = {
        register,
        initAll,
        disposeAll,
        disposeModule,
        getModules: () => UI_MODULES.slice(),
        // 工具函数
        throttle,
        debounce
    };

    console.log('[UIManager] ✅ 已加载（含 throttle / debounce 工具）');
})(window);
