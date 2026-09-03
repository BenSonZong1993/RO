// js/ui/BattleButtonState.js
// 功能：根据战斗状态切换「开始挂机」/「暂停」按钮的禁用状态
// 完全独立，不修改任何现有 JS/CSS/HTML

(function(global) {
    'use strict';

    function init() {
        var startBtn = document.getElementById('btn-start-farming');
        var stopBtn = document.getElementById('btn-stop-farming');
        if (!startBtn || !stopBtn) {
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', init);
            }
            return;
        }

        // ---- 一次性注入样式（灰色蒙版效果） ----
        if (!document.getElementById('battle-btn-state-style')) {
            var style = document.createElement('style');
            style.id = 'battle-btn-state-style';
            style.textContent = `
                .map-controls button:disabled {
                    opacity: 0.5;
                    pointer-events: none;
                    filter: grayscale(0.8);
                    cursor: not-allowed;
                }
            `;
            document.head.appendChild(style);
        }

        function updateButtons(isFighting) {
            startBtn.disabled = isFighting;
            stopBtn.disabled = !isFighting;
        }

        // ---- 初始状态：未战斗 ----
        updateButtons(false);

        // ---- 监听事件 ----
        if (global.EventBus) {
            global.EventBus.on('battle:started', function() {
                updateButtons(true);
            });
            global.EventBus.on('battle:stopped', function() {
                updateButtons(false);
            });
        } else {
            // 降级：轮询 BattleController（如果暴露）
            console.warn('[BattleButtonState] EventBus 不可用，启用轮询');
            setInterval(function() {
                if (global.BattleController && typeof global.BattleController.isRunning === 'function') {
                    var running = global.BattleController.isRunning();
                    if (running !== global._lastBattleState) {
                        global._lastBattleState = running;
                        updateButtons(running);
                    }
                }
            }, 500);
        }

        console.log('[BattleButtonState] ✅ 已启动');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);