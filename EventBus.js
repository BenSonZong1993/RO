// js/core/EventBus.js
(function(global) {
    'use strict';

    const _listeners = new Map();

    const EventBus = {
        /**
         * 订阅事件
         * @param {string} event - 事件名称
         * @param {Function} callback - 回调函数
         */
        on: function(event, callback) {
            if (typeof event !== 'string' || typeof callback !== 'function') {
                console.warn('[EventBus] 参数无效');
                return;
            }
            if (!_listeners.has(event)) {
                _listeners.set(event, []);
            }
            _listeners.get(event).push(callback);
        },

        /**
         * 触发事件
         * @param {string} event - 事件名称
         * @param {*} data - 传递给回调的数据
         */
        emit: function(event, data) {
            if (typeof event !== 'string') return;
            const cbs = _listeners.get(event);
            if (!cbs || cbs.length === 0) return;
            // 拷贝一份，防止回调中修改监听列表
            const snapshot = cbs.slice();
            for (const cb of snapshot) {
                try {
                    cb(data);
                } catch (e) {
                    console.error('[EventBus] 回调执行错误:', e);
                }
            }
        },

        /**
         * 取消订阅
         * @param {string} event - 事件名称
         * @param {Function} [callback] - 若指定，则只移除该回调；否则移除该事件所有回调
         */
        off: function(event, callback) {
            if (typeof event !== 'string') return;
            if (!_listeners.has(event)) return;
            if (typeof callback === 'function') {
                const cbs = _listeners.get(event);
                const idx = cbs.indexOf(callback);
                if (idx !== -1) {
                    cbs.splice(idx, 1);
                }
                if (cbs.length === 0) {
                    _listeners.delete(event);
                }
            } else {
                _listeners.delete(event);
            }
        },

        /**
         * 一次性订阅（触发一次后自动取消）
         */
        once: function(event, callback) {
            if (typeof event !== 'string' || typeof callback !== 'function') return;
            const wrapper = function(data) {
                callback(data);
                EventBus.off(event, wrapper);
            };
            EventBus.on(event, wrapper);
        },

        /**
         * 清除所有监听（用于重置）
         */
        clear: function() {
            _listeners.clear();
        }
    };

    // 暴露到全局
    global.EventBus = EventBus;

    console.log('[EventBus] ✅ 已加载');
})(window);