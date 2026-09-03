// js/services/ScriptParser.js（完整替换）
(function(global) {
    'use strict';

    // ============================================================
    //  原有的 parseScript / mergeModifiers 保持不变
    // ============================================================

    function parseScript(script, context) {
        if (!script || typeof script !== 'string') return {};
        const result = {
            str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0,
            atk: 0, matk: 0, def: 0, mdef: 0,
            maxHp: 0, maxSp: 0, aspd: 0,
            raceAddDamage: {}, raceReduceDamage: {},
            elementalAddDamage: {}, elementalReduceDamage: {},
            sizeAddDamage: {}, sizeReduceDamage: {},
            statusAttackChance: {}, statusResistance: {},
            hit: 0, flee: 0, crit: 0,
        };
        const lines = script.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            let match = trimmed.match(/^\s*bonus\s+(b\w+)\s*,\s*(\d+)\s*;?\s*$/);
            if (match) {
                const key = match[1];
                const value = parseInt(match[2], 10);
                const target = _mapBonusToField(key);
                if (target && result[target] !== undefined) {
                    result[target] += value;
                }
                continue;
            }
            match = trimmed.match(/^\s*bonus2\s+(b\w+)\s*,\s*(\w+)\s*,\s*(\d+)\s*;?\s*$/);
            if (match) {
                _handleBonus2(match[1], match[2], parseInt(match[3], 10), result);
                continue;
            }
            match = trimmed.match(/^\s*bonus3\s+(b\w+)\s*,\s*(\w+)\s*,\s*(\d+)\s*,\s*(\w+)\s*;?\s*$/);
            if (match) {
                _handleBonus2(match[1], match[2], parseInt(match[3], 10), result);
                continue;
            }
        }
        return result;
    }

    function _mapBonusToField(bonusKey) {
        const map = {
            'bStr': 'str', 'bAgi': 'agi', 'bVit': 'vit',
            'bInt': 'int', 'bDex': 'dex', 'bLuk': 'luk',
            'bAtk': 'atk', 'bMatk': 'matk',
            'bDef': 'def', 'bMdef': 'mdef',
            'bMaxHP': 'maxHp', 'bMaxSP': 'maxSp',
            'bAspd': 'aspd',
            'bHit': 'hit', 'bFlee': 'flee', 'bCritical': 'crit',
        };
        return map[bonusKey] || null;
    }

    function _handleBonus2(type, param, value, result) {
        const cleanParam = _normalizeParam(param);
        switch (type) {
            case 'bAddRace': result.raceAddDamage[cleanParam] = (result.raceAddDamage[cleanParam] || 0) + value; break;
            case 'bSubRace': result.raceReduceDamage[cleanParam] = (result.raceReduceDamage[cleanParam] || 0) + value; break;
            case 'bAddEle': result.elementalAddDamage[cleanParam] = (result.elementalAddDamage[cleanParam] || 0) + value; break;
            case 'bSubEle': result.elementalReduceDamage[cleanParam] = (result.elementalReduceDamage[cleanParam] || 0) + value; break;
            case 'bAddSize': result.sizeAddDamage[cleanParam] = (result.sizeAddDamage[cleanParam] || 0) + value; break;
            case 'bSubSize': result.sizeReduceDamage[cleanParam] = (result.sizeReduceDamage[cleanParam] || 0) + value; break;
            case 'bAddEff': result.statusAttackChance[cleanParam] = (result.statusAttackChance[cleanParam] || 0) + value; break;
            case 'bResEff': result.statusResistance[cleanParam] = (result.statusResistance[cleanParam] || 0) + value; break;
        }
    }

    function _normalizeParam(param) {
        const prefixMatch = param.match(/^(RC|ELE|SIZE|EFF)_/);
        if (prefixMatch) return param.substring(prefixMatch[0].length);
        return param;
    }

    function mergeModifiers(target, source) {
        if (!target || !source) return target;
        for (const key in source) {
            if (typeof source[key] === 'object' && source[key] !== null) {
                if (!target[key]) target[key] = {};
                for (const subKey in source[key]) {
                    target[key][subKey] = (target[key][subKey] || 0) + source[key][subKey];
                }
            } else if (typeof source[key] === 'number') {
                target[key] = (target[key] || 0) + source[key];
            }
        }
        return target;
    }

    // ============================================================
    //  🆕 执行物品脚本（运行时效果）
    //  修复：正确解析 "itemheal rand(45,65),0;" 格式
    // ============================================================
    function executeScript(char, script) {
        if (!char || !script || typeof script !== 'string') {
            return { success: false, message: '参数无效' };
        }

        let hpHeal = 0;
        let spHeal = 0;
        const lines = script.split('\n');

for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ---- 新增：itemheal hp, rand(min,max); ----
    let match = trimmed.match(/itemheal\s+(\d+)\s*,\s*rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
    if (match) {
        const hp = parseInt(match[1], 10);
        const minSp = parseInt(match[2], 10);
        const maxSp = parseInt(match[3], 10);
        hpHeal += hp;
        spHeal += Math.floor(Math.random() * (maxSp - minSp + 1)) + minSp;
        continue;
    }

    // ---- 原有：itemheal rand(min,max), sp; ----
    match = trimmed.match(/itemheal\s+rand\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*,\s*(\d+)\s*;?/i);
    if (match) {
        const minHp = parseInt(match[1], 10);
        const maxHp = parseInt(match[2], 10);
        const sp = parseInt(match[3], 10);
        hpHeal += Math.floor(Math.random() * (maxHp - minHp + 1)) + minHp;
        spHeal += sp;
        continue;
    }

    // ---- 原有：itemheal (hp, sp); ----
    match = trimmed.match(/itemheal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
    if (match) {
        hpHeal += parseInt(match[1], 10);
        spHeal += parseInt(match[2], 10);
        continue;
    }

    // ---- 原有：itemheal hp, sp; ----
    match = trimmed.match(/itemheal\s+(\d+)\s*,\s*(\d+)\s*;?/i);
    if (match) {
        hpHeal += parseInt(match[1], 10);
        spHeal += parseInt(match[2], 10);
        continue;
    }


            

            // ---- 4. percentheal hp%, sp%; ----
        match = trimmed.match(/percentheal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)\s*;?/i);
    if (match) {
                const hpPercent = parseInt(match[1], 10);
                const spPercent = parseInt(match[2], 10);
                let maxHp = 100, maxSp = 50;
                if (char._finalStats) {
                    maxHp = char._finalStats.finalMaxHP || 100;
                    maxSp = char._finalStats.finalMaxSP || 50;
                } else if (global.AttributeMediator && typeof global.AttributeMediator.getDerivedValue === 'function') {
                    maxHp = global.AttributeMediator.getDerivedValue('finalMaxHP') || 100;
                    maxSp = global.AttributeMediator.getDerivedValue('finalMaxSP') || 50;
                }
                hpHeal += Math.floor(maxHp * hpPercent / 100);
                spHeal += Math.floor(maxSp * spPercent / 100);
                continue;
            }

            // ---- 5. sc_start / sc_end / sc_end_all ----
            match = trimmed.match(/sc_start\s+(\w+)\s*,\s*(\d+)\s*,\s*(\d+)\s*;?/i);
            if (match) {
                const statusName = match[1];
                const durationMs = parseInt(match[2], 10);
                const val = parseInt(match[3], 10);
                const scId = global.SC_CONSTANTS ? global.SC_CONSTANTS[statusName] : null;
                if (scId !== undefined && global.status_change_start && typeof global.status_change_start === 'function') {
                    global.status_change_start(char, scId, durationMs, val);
                } else if (scId !== undefined && char.sc && typeof char.sc.setSCE === 'function') {
                    char.sc.setSCE(scId, { timer: null, val: val, tick: 0 });
                }
                continue;
            }

            match = trimmed.match(/sc_end\s+(\w+)\s*;?/i);
            if (match) {
                const statusName = match[1];
                const scId = global.SC_CONSTANTS ? global.SC_CONSTANTS[statusName] : null;
                if (scId !== undefined && global.status_change_end && typeof global.status_change_end === 'function') {
                    global.status_change_end(char, scId);
                } else if (scId !== undefined && char.sc && typeof char.sc.clearSCE === 'function') {
                    char.sc.clearSCE(scId);
                }
                continue;
            }

            if (/sc_end_all\s*;?/i.test(trimmed)) {
                if (char.sc && typeof char.sc.getAll === 'function') {
                    const all = char.sc.getAll();
                    for (const id in all) {
                        if (global.status_change_end && typeof global.status_change_end === 'function') {
                            global.status_change_end(char, parseInt(id, 10));
                        } else if (char.sc && typeof char.sc.clearSCE === 'function') {
                            char.sc.clearSCE(parseInt(id, 10));
                        }
                    }
                }
                continue;
            }
        }

        // ---- 应用 HP/SP 恢复 ----
        if (hpHeal !== 0 || spHeal !== 0) {
            if (global.CharController) {
                if (hpHeal > 0 && typeof global.CharController.addHp === 'function') {
                    global.CharController.addHp(hpHeal);
                }
                if (spHeal > 0 && typeof global.CharController.addSp === 'function') {
                    global.CharController.addSp(spHeal);
                }
            } else {
                // 降级：直接操作（但应该不会走到这里）
                if (hpHeal > 0) {
                    const maxHp = char._finalStats?.finalMaxHP || 100;
                    char.hp = Math.min((char.hp || 0) + hpHeal, maxHp);
                }
                if (spHeal > 0) {
                    const maxSp = char._finalStats?.finalMaxSP || 50;
                    char.sp = Math.min((char.sp || 0) + spHeal, maxSp);
                }
                if (global.EventBus) {
                    global.EventBus.emit('char:hpChanged', { hp: char.hp, maxHp: char._finalStats?.finalMaxHP || 100 });
                    global.EventBus.emit('char:spChanged', { sp: char.sp, maxSp: char._finalStats?.finalMaxSP || 50 });
                    global.EventBus.emit('char:changed', { char: char });
                }
                if (global.CharController && typeof global.CharController.save === 'function') {
                    global.CharController.save();
                }
            }
        }

        return { success: true, hpHeal, spHeal };
    }

    // ---- 暴露全局 ----
    global.ScriptParser = {
        parseScript: parseScript,
        mergeModifiers: mergeModifiers,
        executeScript: executeScript,
    };

    console.log('[ScriptParser] ✅ 已加载（修复 itemheal rand 解析）');
})(window);