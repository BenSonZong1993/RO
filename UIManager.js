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