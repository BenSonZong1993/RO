// ============================================================
//  FILE: BattleSpeedManager.js
//  LAYER: core（战斗加速档位——纯运行时状态，持久化经 DataCoordinator ui 节）
//  职责：提供 1x/2x/4x 战斗速度档位，供 init.js 游戏循环对战斗系统
//        delta 统一缩放（战斗循环 + SkillRuntime GCD/冷却/咏唱随之加速）。
//  约束：只缩放时间，禁止缩放伤害数值；档位集合配置于此，UI 只传值。
//  持久化：ui.battleSpeed / ui.compactFloat（v3 ui 节，由 init.js 接线写入）
//  依赖：无（不依赖加载顺序）
// ============================================================
(function(global) {
    'use strict';

    var ALLOWED_SPEEDS = [1, 2, 4];

    var _speed = 1;
    var _compactFloat = false;   // 简洁飘字（多段伤害聚合）开关

    function setSpeed(n) {
        var v = Number(n);
        if (ALLOWED_SPEEDS.indexOf(v) === -1) {
            console.warn('[BattleSpeedManager] 非法档位:', n, '（允许:', ALLOWED_SPEEDS.join('/'), '）');
            return false;
        }
        if (_speed === v) return true;
        _speed = v;
        console.log('[BattleSpeedManager] 战斗速度 → ' + v + 'x');
        if (global.EventBus) global.EventBus.emit('battleSpeed:changed', { speed: v });
        return true;
    }

    function getSpeed() { return _speed; }
    function getSpeeds() { return ALLOWED_SPEEDS.slice(); }

    function setCompact(on) {
        _compactFloat = !!on;
        if (global.EventBus) global.EventBus.emit('battleSpeed:changed', { speed: _speed, compact: _compactFloat });
    }
    function isCompact() { return _compactFloat; }

    // 简洁飘字判定：加速档位下自动聚合，1x 亦可手动开启
    function shouldAggregateFloatText() { return _speed > 1 || _compactFloat; }

    // 秒级 delta 缩放（战斗循环统一入口）
    function scaleDelta(seconds) { return seconds * _speed; }

    global.BattleSpeedManager = {
        setSpeed: setSpeed,
        getSpeed: getSpeed,
        getSpeeds: getSpeeds,
        setCompact: setCompact,
        isCompact: isCompact,
        shouldAggregateFloatText: shouldAggregateFloatText,
        scaleDelta: scaleDelta,
    };

    console.log('[BattleSpeedManager] ✅ 已加载（档位 1x/2x/4x，默认 1x）');
})(window);
