// ============================================================
//  📁 js/battle/BattleEffectsManager.js
//  战斗特效管理（配表驱动版 - 修复配置源）
//  说明：视觉参数从 UIConfig 读取
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  工具函数：安全读取视觉配置（从 UIConfig）
    // ============================================================
    function _getVisualConfig() {
        // 定义完整的降级默认值（与 UIConfig.effects 结构一致）
        var defaultCfg = {
            damageNumbers: {
                lifetime: 1.0,
                riseSpeed: 150,
                fadeStartRatio: 0.4,
                fontSize: 54,
                font: 'bold 54px monospace',
                strokeWidth: 3,
                strokeColor: '#000000',
                critColor: '#ffaa00',
                normalColor: '#ffffff',
                missColor: 'rgba(200,200,200,0.95)',
                missFont: 'bold 32px monospace',
                shadowBlur: 12,
            },
            expNumbers: {
                riseDuration: 2.2,
                riseDistance: 130,
                maxCount: 5,
                fadeStartRatio: 0.55,
                baseOffsetX: 150,
                baseOffsetY: -30,
                randomOffsetX: 40,
                randomOffsetY: 15,
                spacing: 55,
                fontSize: 36,
                padding: 8,
                lineHeightRatio: 1.3,
                boxBgAlpha: 0.7,
                boxRadius: 6,
                baseColor: '#FFD700',
                jobColor: '#87CEEB',
                positionX: 0.85,
                shadowBlur: 10,
            },
            lootTexts: {
                riseDuration: 2.8,
                riseDistance: 110,
                maxCount: 4,
                fadeStartRatio: 0.45,
                baseOffsetX: 160,
                baseOffsetY: 70,
                randomOffsetX: 30,
                randomOffsetY: 15,
                spacing: 55,
                font: 'bold 28px monospace',
                bgAlpha: 0.5,
                borderColor: '#FFD700',
                textColor: '#FFD700',
                shadowBlur: 8,
                padding: 10,
                height: 42,
                positionX: 0.6,
                positionY: 0.4,
            },
            skillNames: {
                duration: 1.2,
                riseSpeed: 80,
                fontSize: 32,
                font: 'bold 32px Arial, sans-serif',
                color: '#FFFFFF',
                shadowBlur: 10,
            },
            interruptTexts: {
                duration: 1.5,
                riseSpeed: 120,
                fontSize: 40,
                font: 'bold 40px Arial, sans-serif',
                color: '#FF0000',
                shadowBlur: 12,
                shadowColor: 'rgba(0,0,0,0.9)',
            },
        };

        // 如果 UIConfig 存在，使用它并合并默认值（防止配表缺字段）
        if (global.UIConfig && global.UIConfig.effects) {
            var result = {};
            var uiEffects = global.UIConfig.effects;
            for (var section in defaultCfg) {
                if (defaultCfg.hasOwnProperty(section)) {
                    result[section] = {};
                    var cfgSection = uiEffects[section] || {};
                    for (var key in defaultCfg[section]) {
                        if (defaultCfg[section].hasOwnProperty(key)) {
                            result[section][key] = cfgSection[key] !== undefined ? cfgSection[key] : defaultCfg[section][key];
                        }
                    }
                }
            }
            return result;
        }

        console.warn('[BattleEffectsManager] UIConfig.effects 未加载，使用降级默认值');
        return defaultCfg;
    }

    // ============================================================
    //  私有状态
    // ============================================================
    var _damageNumbers = [];
    var _expQueue = [];
    var _lootQueue = [];
    var _skillNameQueue = [];
    var _interruptQueue = [];

    // ============================================================
    //  伤害数字
    // ============================================================
    function addDamage(x, y, text, isCrit, scale, delay) {
        var cfg = _getVisualConfig().damageNumbers;
        scale = scale || 1.0;
        delay = delay || 0;
        var now = performance.now();
        var scheduledTime = now + delay; // delay 单位为毫秒
        _damageNumbers.push({
            x: x,
            y: y,
            text: String(text),
            isCrit: !!isCrit,
            alpha: 1.0,
            life: cfg.lifetime,
            riseSpeed: cfg.riseSpeed,
            startY: y,
            scale: scale,
            scheduledTime: scheduledTime,
            started: false
        });
        if (_damageNumbers.length > 50) _damageNumbers.shift();
    }

    // 新增：未命中（miss）支持
    function addMiss(x, y, delay, scale) {
        var cfg = _getVisualConfig().damageNumbers;
        scale = (typeof scale === 'number') ? scale : 0.6;
        delay = delay || 0;
        var now = performance.now();
        var scheduledTime = now + delay;
        _damageNumbers.push({
            x: x,
            y: y,
            text: 'miss',
            isMiss: true,
            isCrit: false,
            alpha: 1.0,
            life: cfg.lifetime,
            riseSpeed: cfg.riseSpeed,
            startY: y,
            scale: scale,
            scheduledTime: scheduledTime,
            started: false
        });
        if (_damageNumbers.length > 60) _damageNumbers.shift();
    }

    // ============================================================
    //  经验飘字
    // ============================================================
    function addExperience(playerPos, exp, jobExp) {
        if (!playerPos) return;
        var cfg = _getVisualConfig().expNumbers;
        var index = _expQueue.length;
        var offsetX = cfg.baseOffsetX + (Math.random() - 0.5) * cfg.randomOffsetX * 2;
        var offsetY = cfg.baseOffsetY + (Math.random() - 0.5) * cfg.randomOffsetY * 2 + index * cfg.spacing;
        var speed = cfg.riseDistance / cfg.riseDuration;

        _expQueue.push({
            offsetX: offsetX,
            offsetY: offsetY,
            exp: Math.floor(exp),
            jobExp: Math.floor(jobExp),
            alpha: 1.0,
            life: cfg.riseDuration,
            riseSpeed: speed,
            startOffsetY: offsetY,
            playerX: playerPos.x,
            playerY: playerPos.y,
        });
        if (_expQueue.length > cfg.maxCount) _expQueue.shift();
    }

    // ============================================================
    //  掉落飘字
    // ============================================================
    function addLoot(playerPos, text) {
        if (!playerPos) return;
        var cfg = _getVisualConfig().lootTexts;
        var index = _lootQueue.length;
        var offsetX = cfg.baseOffsetX + (Math.random() - 0.5) * cfg.randomOffsetX * 2;
        var offsetY = cfg.baseOffsetY + (Math.random() - 0.5) * cfg.randomOffsetY * 2 + index * cfg.spacing;
        var speed = cfg.riseDistance / cfg.riseDuration;

        _lootQueue.push({
            offsetX: offsetX,
            offsetY: offsetY,
            text: String(text),
            alpha: 1.0,
            life: cfg.riseDuration,
            riseSpeed: speed,
            startOffsetY: offsetY,
            playerX: playerPos.x,
            playerY: playerPos.y,
        });
        if (_lootQueue.length > cfg.maxCount) _lootQueue.shift();
    }

    // ============================================================
    //  技能名称飘字
    // ============================================================
    function addSkillName(playerPos, skillName) {
        if (!playerPos || !skillName) return;
        var cfg = _getVisualConfig().skillNames;
        _skillNameQueue.push({
            x: playerPos.x,
            y: playerPos.y,
            text: String(skillName),
            alpha: 1.0,
            life: cfg.duration,
            riseSpeed: cfg.riseSpeed,
        });
        if (_skillNameQueue.length > 10) _skillNameQueue.shift();
    }

    // ============================================================
    //  打断飘字
    // ============================================================
    function addInterrupt(playerPos, text) {
        if (!playerPos) return;
        var cfg = _getVisualConfig().interruptTexts;
        text = text || '打断';
        _interruptQueue.push({
            x: playerPos.x,
            y: playerPos.y - 20,
            text: String(text),
            alpha: 1.0,
            life: cfg.duration,
            riseSpeed: cfg.riseSpeed,
        });
        if (_interruptQueue.length > 10) _interruptQueue.shift();
    }

    // ============================================================
    //  更新与清理
    // ============================================================
    function update(delta) {
        // 伤害数字
        for (var i = _damageNumbers.length - 1; i >= 0; i--) {
            var d = _damageNumbers[i];
            var cfg = _getVisualConfig().damageNumbers;
            // 检查是否到达预定显示时间
            if (!d.started) {
                if (performance.now() >= d.scheduledTime) {
                    d.started = true;
                    d.startTime = performance.now(); // 记录实际开始时间用于 life 倒计时
                } else {
                    continue; // 未到时间，暂不更新
                }
            }
            // 从实际开始时间计算 life
            var elapsed = (performance.now() - d.startTime) / 1000;
            d.life = cfg.lifetime - elapsed;
            if (d.life <= 0) {
                _damageNumbers.splice(i, 1);
                continue;
            }
            d.y -= d.riseSpeed * delta;
            var fadeStart = cfg.lifetime * cfg.fadeStartRatio;
            if (d.life < fadeStart) d.alpha = Math.max(0, d.life / fadeStart);
        }

        // 经验
        for (var i = _expQueue.length - 1; i >= 0; i--) {
            var e = _expQueue[i];
            var cfg = _getVisualConfig().expNumbers;
            e.life -= delta;
            var fadeStart = cfg.riseDuration * cfg.fadeStartRatio;
            if (e.life < fadeStart) e.alpha = Math.max(0, e.life / fadeStart);
            else e.alpha = 1.0;
            if (e.life <= 0) _expQueue.splice(i, 1);
        }

        // 掉落
        for (var i = _lootQueue.length - 1; i >= 0; i--) {
            var l = _lootQueue[i];
            var cfg = _getVisualConfig().lootTexts;
            l.life -= delta;
            var fadeStart = cfg.riseDuration * cfg.fadeStartRatio;
            if (l.life < fadeStart) l.alpha = Math.max(0, l.life / fadeStart);
            else l.alpha = 1.0;
            if (l.life <= 0) _lootQueue.splice(i, 1);
        }

        // 技能名称
        for (var i = _skillNameQueue.length - 1; i >= 0; i--) {
            var s = _skillNameQueue[i];
            var cfg = _getVisualConfig().skillNames;
            s.life -= delta;
            s.y -= s.riseSpeed * delta;
            var fadeStart = cfg.duration * 0.4;
            if (s.life < fadeStart) s.alpha = Math.max(0, s.life / fadeStart);
            if (s.life <= 0) _skillNameQueue.splice(i, 1);
        }

        // 打断文字
        for (var i = _interruptQueue.length - 1; i >= 0; i--) {
            var it = _interruptQueue[i];
            var cfg = _getVisualConfig().interruptTexts;
            it.life -= delta;
            it.y -= it.riseSpeed * delta;
            var fadeStart = cfg.duration * 0.4;
            if (it.life < fadeStart) it.alpha = Math.max(0, it.life / fadeStart);
            if (it.life <= 0) _interruptQueue.splice(i, 1);
        }
    }

    // ============================================================
    //  数据导出
    // ============================================================
    function getWorldData() {
        var damage = _damageNumbers
            .filter(function(d) { return d.started; })
            .map(function(d) {
                return {
                    x: d.x,
                    y: d.y,
                    text: d.text,
                    isCrit: d.isCrit,
                    isMiss: !!d.isMiss,
                    alpha: d.alpha,
                    scale: d.scale || 1.0
                };
            });

        var exp = _expQueue.map(function(e) {
            var progress = 1 - (e.life / _getVisualConfig().expNumbers.riseDuration);
            var riseOffset = e.riseSpeed * progress * _getVisualConfig().expNumbers.riseDuration;
            return {
                x: e.playerX + e.offsetX,
                y: e.playerY + e.offsetY - riseOffset,
                exp: e.exp,
                jobExp: e.jobExp,
                alpha: e.alpha
            };
        });

        var loot = _lootQueue.map(function(l) {
            var progress = 1 - (l.life / _getVisualConfig().lootTexts.riseDuration);
            var riseOffset = l.riseSpeed * progress * _getVisualConfig().lootTexts.riseDuration;
            return {
                x: l.playerX + l.offsetX,
                y: l.playerY + l.offsetY - riseOffset,
                text: l.text,
                alpha: l.alpha
            };
        });

        var skillNames = _skillNameQueue.map(function(s) {
            return {
                x: s.x,
                y: s.y,
                text: s.text,
                alpha: s.alpha
            };
        });

        var interruptTexts = _interruptQueue.map(function(it) {
            return {
                x: it.x,
                y: it.y,
                text: it.text,
                alpha: it.alpha
            };
        });

        return { damage: damage, exp: exp, loot: loot, skillNames: skillNames, interruptTexts: interruptTexts };
    }

    function clear() {
        _damageNumbers = [];
        _expQueue = [];
        _lootQueue = [];
        _skillNameQueue = [];
        _interruptQueue = [];
    }

    // ============================================================
    //  配表工具接口
    // ============================================================
    function getVisualConfig() {
        return _getVisualConfig();
    }

    // ============================================================
    //  暴露全局
    // ============================================================
    global.BattleEffectsManager = {
        addDamage: addDamage,
        addMiss: addMiss,
        addExperience: addExperience,
        addLoot: addLoot,
        addSkillName: addSkillName,
        addInterrupt: addInterrupt,
        update: update,
        getWorldData: getWorldData,
        clear: clear,
        getVisualConfig: getVisualConfig,
    };

    console.log('[BattleEffectsManager] ✅ 已加载（配表驱动版，依赖 UIConfig）');
})(window);
