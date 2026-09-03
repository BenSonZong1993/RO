// js/processors/StatusProcessor.js
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[StatusProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var StatusProcessor = {

        process: function(sc, char) {
            var result = {
                type: 'status',
                priority: 60,
                source: 'sc.entries',
                modifications: {},
                metadata: {
                    activeCount: 0,
                    entries: [],
                }
            };

            if (!sc || typeof sc.entries !== 'object' || !sc.entries.size) {
                return result;
            }

            var SC_CONSTANTS = global.SC_CONSTANTS || {};
            var SC_NAMES = global.SC_NAMES || {};
            var STATUS_DATA = global.STATUS_DATA || [];

            function findStatusDef(statusName) {
                for (var i = 0; i < STATUS_DATA.length; i++) {
                    if (STATUS_DATA[i].Status === statusName) {
                        return STATUS_DATA[i];
                    }
                }
                return null;
            }

            for (var entry of sc.entries) {
                var type = entry[0];
                var statusEntry = entry[1];
                var statusName = SC_NAMES[type];
                if (!statusName) continue;

                var def = findStatusDef(statusName);
                if (!def) continue;

                var calcFlags = def.CalcFlags || {};
                if (Object.keys(calcFlags).length === 0) continue;

                var val1 = statusEntry.val1 || 1;

                for (var key in calcFlags) {
                    if (!calcFlags.hasOwnProperty(key)) continue;
                    var rawValue = calcFlags[key];
                    var effectiveVal = this._resolveValue(rawValue, val1, char);
                    if (effectiveVal === null) continue;
                    this._applyModification(result.modifications, key, effectiveVal, statusName);
                }

                result.metadata.activeCount++;
                result.metadata.entries.push({
                    name: statusName,
                    type: type,
                    val1: val1,
                });
            }

            return result;
        },

        _resolveValue: function(rawValue, val1, char) {
            if (typeof rawValue === 'number') return rawValue;
            // 布尔 true：数据清洗约定 = "该加成的数值取 val1"（如 Windwalk.Flee / Adrenaline.Aspd，val1=技能等级）
            if (rawValue === true) return (typeof val1 === 'number' && val1 > 0) ? val1 : 1;
            if (rawValue && typeof rawValue === 'object' && rawValue.dynamic === true) {
                try {
                    var fn = new Function('val1', 'return ' + rawValue.formula);
                    var result = fn(val1);
                    if (typeof result === 'number' && !isNaN(result)) return result;
                } catch (e) {
                    console.warn('[StatusProcessor] 动态公式解析失败:', rawValue.formula, e);
                }
                return null;
            }
            if (typeof rawValue === 'string') return rawValue; // 如元素变更
            return null;
        },

        _applyModification: function(mods, key, value, statusName) {
            var sourceTag = 'status:' + statusName;

            switch (key) {
                case 'Str': case 'Agi': case 'Vit': case 'Int': case 'Dex': case 'Luk':
                    mods['stat_' + key.toLowerCase()] = (mods['stat_' + key.toLowerCase()] || 0) + value;
                    break;
                case 'Atk': mods.atk = (mods.atk || 0) + value; break;
                case 'Matk': mods.matk = (mods.matk || 0) + value; break;
                case 'Def': mods.defPercent = (mods.defPercent || 0) + value; break;
                case 'Mdef': mods.mdefPercent = (mods.mdefPercent || 0) + value; break;
                case 'Flee':
                    if (value <= -9999) mods.flee = 0;
                    else mods.flee = (mods.flee || 0) + value;
                    break;
                case 'Hit': mods.hit = (mods.hit || 0) + value; break;
                case 'Aspd':
                    // 固定值加成（如增加5点ASPD显示值，需转换为百分比？）——这里作为固定值直接加到aspd上，但后期会转为百分比？为了简化，我们存为aspdFixed
                    mods.aspdFixed = (mods.aspdFixed || 0) + value;
                    break;
                case 'AspdPercent':
                    mods.aspdPercent = (mods.aspdPercent || 0) + value;
                    break;
                case 'MaxHP': mods.maxHp = (mods.maxHp || 0) + value; break;
                case 'MaxSP': mods.maxSp = (mods.maxSp || 0) + value; break;
                case 'Element':
                    if (typeof value === 'string') {
                        mods.element = value;
                        mods._elementSource = sourceTag;
                    }
                    break;
                case 'ElementLevel':
                    if (typeof value === 'number' && value >= 1 && value <= 4) {
                        mods.elementLevel = value;
                    }
                    break;
                default:
                    if (!mods.custom) mods.custom = {};
                    mods.custom[key + '@' + statusName] = value;
                    break;
            }

            if (!mods._sources) mods._sources = {};
            mods._sources[key] = mods._sources[key] || [];
            mods._sources[key].push(sourceTag + '=' + value);
        }
    };

    global.StatusProcessor = StatusProcessor;
    console.log('[StatusProcessor] ✅ 已加载（支持攻速百分比）');
})(window);