// ============================================================
//  rAthenaStatus.js – 状态引擎核心实现（优化版 v2.1）
//  包含：启动/结束/查询状态，抗性计算，周期效果，定时器清理
//  优化：完善定时器清理、增加注释、边界保护
// ============================================================

function StatusChangeEntry(type, val1, val2, val3, val4, duration, flag) {
    this.type = type || 0;
    this.val1 = val1 || 0;
    this.val2 = val2 || 0;
    this.val3 = val3 || 0;
    this.val4 = val4 || 0;
    this.startTick = Date.now();
    this.duration = duration || 0;
    this.timer = null;           // setTimeout 句柄（到期自动结束）
    this.interval = null;        // setInterval 句柄（DOT 周期伤害）
    this.flag = flag || 0;
}

StatusChangeEntry.prototype.getRemainingMs = function() {
    if (this.duration <= 0) return -1;
    var elapsed = Date.now() - this.startTick;
    return Math.max(0, this.duration - elapsed);
};

StatusChangeEntry.prototype.getElapsedMs = function() {
    return Date.now() - this.startTick;
};

StatusChangeEntry.prototype.isExpired = function() {
    if (this.duration <= 0) return false;
    return this.getRemainingMs() <= 0;
};

function StatusChange() {
    this.entries = new Map();
    this.opt1 = 0;
    this.opt2 = 0;
    this.opt3 = 0;
    this.option = 0;
    this.cant = { move: false, cast: false, attack: false };
}

StatusChange.prototype.getSCE = function(type) {
    return this.entries.get(type) || null;
};

StatusChange.prototype.hasSCE = function(type) {
    return this.entries.has(type);
};

StatusChange.prototype.createSCE = function(type, val1, val2, val3, val4, duration, flag) {
    var entry = new StatusChangeEntry(type, val1, val2, val3, val4, duration, flag);
    this.entries.set(type, entry);
    return entry;
};

StatusChange.prototype.deleteSCE = function(type) {
    var entry = this.entries.get(type);
    if (entry) {
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.interval) clearInterval(entry.interval);
        this.entries.delete(type);
    }
};

/**
 * 清除所有状态，并清理所有定时器（包括 DOT 周期定时器）
 */
StatusChange.prototype.clear = function() {
    for (var entry of this.entries.values()) {
        if (entry.timer) clearTimeout(entry.timer);
        if (entry.interval) clearInterval(entry.interval);
    }
    this.entries.clear();
    this.opt1 = 0;
    this.opt2 = 0;
    this.opt3 = 0;
    this.cant = { move: false, cast: false, attack: false };
};

StatusChange.prototype.empty = function() {
    return this.entries.size === 0;
};

StatusChange.prototype.size = function() {
    return this.entries.size;
};

StatusChange.prototype[Symbol.iterator] = function() {
    return this.entries[Symbol.iterator]();
};

// ---------- 辅助函数 ----------
function _getStatusDef(statusName) {
    if (window.STATUS_DATA && Array.isArray(window.STATUS_DATA)) {
        for (var i = 0; i < window.STATUS_DATA.length; i++) {
            if (window.STATUS_DATA[i].Status === statusName) {
                return window.STATUS_DATA[i];
            }
        }
    }
    return null;
}
window.getStatusDef = _getStatusDef;

// ---------- 抗性计算 ----------
function status_calc_duration(bl, type, duration) {
    if (!bl || !bl.stats) return duration;
    var stats = bl.stats;
    var vit = stats.vit || 1;
    var int_ = stats.int || 1;
    var luk = stats.luk || 1;

    var statusName = window.SC_NAMES[type];
    if (!statusName) return duration;

    var def = _getStatusDef(statusName);
    if (!def) return duration;

    var opt1 = def.Opt1 || 'None';
    var resist = 0;

    // RO 经典抗性公式
    if (opt1 === 'Stone' || opt1 === 'Freeze' || opt1 === 'Stun' || opt1 === 'Sleep' || opt1 === 'Imprison') {
        resist = vit / 100;
    } else if (statusName === 'Silence' || statusName === 'Confusion' || statusName === 'Blind') {
        resist = int_ / 150;
    } else if (statusName === 'Curse' || statusName === 'Poison' || statusName === 'Bleeding' || statusName === 'Dpoison') {
        resist = luk / 150;
    }

    var reduced = duration * (1 - Math.min(resist, 0.8));
    var minDuration = def.MinDuration || 1;
    return Math.max(minDuration, reduced);
}

function status_calc_rate(bl, type, rate) {
    if (!bl || !bl.stats) return rate;
    var stats = bl.stats;
    var vit = stats.vit || 1;
    var int_ = stats.int || 1;
    var luk = stats.luk || 1;

    var statusName = window.SC_NAMES[type];
    if (!statusName) return rate;

    var def = _getStatusDef(statusName);
    if (!def) return rate;

    var opt1 = def.Opt1 || 'None';
    var resist = 0;

    if (opt1 === 'Stone' || opt1 === 'Freeze' || opt1 === 'Stun' || opt1 === 'Sleep' || opt1 === 'Imprison') {
        resist = vit / 200;
    } else if (statusName === 'Silence' || statusName === 'Confusion' || statusName === 'Blind') {
        resist = int_ / 300;
    } else if (statusName === 'Curse' || statusName === 'Poison' || statusName === 'Bleeding' || statusName === 'Dpoison') {
        resist = luk / 300;
    }

    var minRate = def.MinRate || 0;
    return Math.max(minRate, rate * (1 - Math.min(resist, 0.8)));
}

// ---------- DOT 周期效果 ----------

function _applyPeriodicEffect(bl, type, tickInterval, totalTicks) {
    if (!bl || !bl.sc) return;

    var intervalId = setInterval(function() {
        var entry = bl.sc.getSCE(type);
        if (!entry) {
            clearInterval(intervalId);
            return;
        }

        var statusName = window.SC_NAMES[type];
        var damage = 0;
        // 从 _finalStats 或 maxHp 读取（优先 _finalStats）
        var maxHp = 100;
        if (bl._finalStats && typeof bl._finalStats.finalMaxHP === 'number') {
            maxHp = bl._finalStats.finalMaxHP;
        } else if (typeof bl.maxHp === 'number') {
            maxHp = bl.maxHp;
        }

        if (statusName === 'Poison' || statusName === 'Dpoison') {
            damage = Math.max(1, Math.floor(maxHp * 0.01));
        } else if (statusName === 'Bleeding') {
            damage = Math.max(1, Math.floor(maxHp * 0.005));
        } else if (statusName === 'Burning') {
            damage = Math.max(1, Math.floor(maxHp * 0.02));
        }

        if (damage > 0) {
            var isPlayer = (bl.type === 'pc' || bl.id === 'player' || bl === window.CharController?.getChar());
            var isMonster = (bl.type === 'mob' || bl._isDummy === true || (bl.hp !== undefined && bl.maxHp !== undefined && !isPlayer));

            if (isPlayer && window.CharController) {
                window.CharController.takeDamage(damage);
            } else if (isMonster) {
                bl.hp = Math.max(0, (bl.hp || 0) - damage);
                if (window.BattleEffectsManager) {
                    window.BattleEffectsManager.addDamage(bl.x || 0, bl.y || 0, damage, false);
                }
                if (bl.hp <= 0) {
                    bl.alive = false;
                    if (window.EventBus) {
                        window.EventBus.emit('battle:monsterKilled', { monster: bl });
                    }
                }
            }
        }
    }, tickInterval);

    var entry = bl.sc.getSCE(type);
    if (entry) entry.interval = intervalId;
}

// ---------- 加成插入点（九孔）挂载 ----------
// 状态定义的 modifiers（经 STATUS_MODIFIERS 配置）→ global.ACTIVE_SKILL_MODIFIERS
// BonusCollector 消费该数组映射到 H1~H9；end/覆盖时必须移除，防止残留
function _removeStatusHookRef(entry) {
    if (!entry || !entry._hookRef) return;
    var arr = window.ACTIVE_SKILL_MODIFIERS;
    if (Array.isArray(arr)) {
        var idx = arr.indexOf(entry._hookRef);
        if (idx !== -1) arr.splice(idx, 1);
    }
    entry._hookRef = null;
}

function _attachStatusHookRef(entry, statusName, val1) {
    var cfg = window.STATUS_MODIFIERS ? window.STATUS_MODIFIERS[statusName] : null;
    if (!Array.isArray(cfg) || cfg.length === 0) return;
    if (!Array.isArray(window.ACTIVE_SKILL_MODIFIERS)) window.ACTIVE_SKILL_MODIFIERS = [];
    entry._hookRef = {
        source: statusName,
        skillLevel: val1 || 1,
        modifiers: cfg,                          // 引用共享配置，不克隆
        instanceId: 'sc_' + statusName + '_' + entry.startTick + '_' + Math.floor(Math.random() * 1e6),
    };
    window.ACTIVE_SKILL_MODIFIERS.push(entry._hookRef);
}

// ---------- 核心函数 ----------
function status_change_start(src, bl, type, val1, val2, val3, val4, duration, flag) {
    if (!bl || !bl.sc) {
        console.warn('[status_change_start] 目标无状态容器', bl);
        return false;
    }
    var sc = bl.sc;

    var statusName = window.SC_NAMES[type];
    if (!statusName) {
        console.warn('[status_change_start] 未知状态类型:', type);
        return false;
    }
    var def = _getStatusDef(statusName);

    // 互斥检查（Fail）
    if (def && def.Fail) {
        var failList = def.Fail;
        for (var failStatusName in failList) {
            if (failList[failStatusName] === true) {
                var failType = window.SC_CONSTANTS[failStatusName];
                if (failType !== undefined && sc.hasSCE(failType)) {
                    return false;
                }
            }
        }
    }

    // EndReturn 检查
    if (def && def.EndReturn) {
        var endReturnList = def.EndReturn;
        for (var retStatusName in endReturnList) {
            if (endReturnList[retStatusName] === true) {
                var retType = window.SC_CONSTANTS[retStatusName];
                if (retType !== undefined && sc.hasSCE(retType)) {
                    return false;
                }
            }
        }
    }

    // 覆盖旧状态（删除旧条目，清理timer/interval，并移除旧条目的九孔挂载）
    if (sc.hasSCE(type)) {
        _removeStatusHookRef(sc.getSCE(type));
        sc.deleteSCE(type);
    }

    // EndOnStart：结束被指定的其他状态
    if (def && def.EndOnStart) {
        var endOnStart = def.EndOnStart;
        for (var oldStatusName in endOnStart) {
            if (endOnStart[oldStatusName] === true) {
                var oldType = window.SC_CONSTANTS[oldStatusName];
                if (oldType !== undefined && sc.hasSCE(oldType)) {
                    status_change_end(bl, oldType);
                }
            }
        }
    }

    // 抗性修正
    var finalDuration = status_calc_duration(bl, type, duration || 0);

    // 创建状态条目
    var entry = sc.createSCE(type, val1, val2, val3, val4, finalDuration, flag);

    // ★ 加成插入点挂载（STATUS_MODIFIERS 配置 → ACTIVE_SKILL_MODIFIERS → BonusCollector → 九孔）
    if (statusName) _attachStatusHookRef(entry, statusName, val1);

    // 设置定时器（duration > 0）
    if (finalDuration > 0 && finalDuration < Infinity) {
        entry.timer = setTimeout(function() {
            status_change_end(bl, type);
        }, finalDuration);
    }

    // 根据 States 更新 cant
    if (def && def.States) {
        var states = def.States;
        if (states.NoMove) sc.cant.move = true;
        if (states.NoCast) sc.cant.cast = true;
        if (states.NoAttack) sc.cant.attack = true;
    }

    // 设置 Opt1/2/3
    if (def) {
        if (def.Opt1) {
            var opt1Val = window.SC_CONSTANTS[def.Opt1];
            if (opt1Val !== undefined) sc.opt1 = opt1Val;
        }
        if (def.Opt2 && Object.keys(def.Opt2).length > 0) {
            sc.opt2 = 1; // 简化，实际应位掩码
        }
        if (def.Opt3 && Object.keys(def.Opt3).length > 0) {
            sc.opt3 = 1;
        }
    }

    // DOT 周期效果
    if (def && def.Opt2) {
        var isDOT = def.Opt2.Poison || def.Opt2.Dpoison || def.Opt2.Bleeding || def.Opt2.Burning;
        if (isDOT) {
            var tickInterval = 2000;
            var totalTicks = Math.floor(finalDuration / tickInterval);
            if (totalTicks > 0) {
                _applyPeriodicEffect(bl, type, tickInterval, totalTicks);
            }
        }
    }

    // ---- 启动状态后触发属性重算 ----
    if (window.AttributeMediator && typeof window.AttributeMediator.requestRecalc === 'function') {
        window.AttributeMediator.requestRecalc('status', { type: type, action: 'start' });
    }
if (window.EventBus) {
    window.EventBus.emit('char:changed', { sc: sc, type: type });
    window.EventBus.emit('status:changed', { bl: bl, type: type, action: 'start' });
}

    return true;
}

function status_change_end(bl, type, tid) {
    if (!bl || !bl.sc) return false;
    var sc = bl.sc;
    var entry = sc.getSCE(type);
    if (!entry) return false;

    if (tid !== undefined && entry.timer !== tid) return false;

    // ★ 移除九孔挂载（先取 ref 再删条目）
    _removeStatusHookRef(entry);

    // 删除条目（自动清理 timer 和 interval）
    sc.deleteSCE(type);

    // 重新计算 cant、opt1/2/3（基于剩余状态）
    sc.cant = { move: false, cast: false, attack: false };
    sc.opt1 = 0;
    sc.opt2 = 0;
    sc.opt3 = 0;

    for (var entry of sc.entries.values()) {
        var statusName = window.SC_NAMES[entry.type];
        if (!statusName) continue;
        var def = _getStatusDef(statusName);
        if (!def) continue;

        if (def.States) {
            if (def.States.NoMove) sc.cant.move = true;
            if (def.States.NoCast) sc.cant.cast = true;
            if (def.States.NoAttack) sc.cant.attack = true;
        }
        if (def.Opt1) {
            var opt1Val = window.SC_CONSTANTS[def.Opt1];
            if (opt1Val !== undefined) sc.opt1 = opt1Val;
        }
        if (def.Opt2 && Object.keys(def.Opt2).length > 0) {
            sc.opt2 = 1;
        }
        if (def.Opt3 && Object.keys(def.Opt3).length > 0) {
            sc.opt3 = 1;
        }
    }

    if (window.EventBus) {
        window.EventBus.emit('char:changed', { sc: sc, type: type, ended: true });
        window.EventBus.emit('status:changed', { bl: bl, type: type, action: 'end' });
    }

    return true;
}

function status_get_sc(bl) {
    return bl && bl.sc ? bl.sc : null;
}

// 占位函数（兼容旧代码）
function status_change_timer(tid, bl_id, type) {}

// ---------- 全局暴露 ----------
window.StatusChangeEntry = StatusChangeEntry;
window.StatusChange = StatusChange;
window.status_change_start = status_change_start;
window.status_change_end = status_change_end;
window.status_get_sc = status_get_sc;
window.status_calc_duration = status_calc_duration;
window.status_calc_rate = status_calc_rate;
window.status_change_timer = status_change_timer;

console.log('[rAthenaStatus] ✅ 已加载（优化版 v2.1 - 定时器清理完善）');