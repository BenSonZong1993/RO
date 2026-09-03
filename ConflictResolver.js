// ================================================================
//  📁 js/processors/ConflictResolver.js
//  职责：接收所有修正对象，按优先级排序，解决冲突
//  站口角色：最终裁决者（在组装之前）
// ================================================================
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[ConflictResolver] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var ConflictResolver = {

        /**
         * 解决所有修正对象之间的冲突
         * @param {array} results - 所有处理器的输出结果数组
         * @returns {object} 解决后的统一修正对象
         */
        resolve: function(results) {
            var resolved = {
                modifications: {},
                conflictLog: [],
                metadata: {
                    sources: [],
                }
            };

            if (!results || results.length === 0) {
                return resolved;
            }

            // ---- 1. 按优先级排序（数字小优先） ----
            var sorted = results.slice().sort(function(a, b) {
                return (a.priority || 100) - (b.priority || 100);
            });

            // ---- 2. 合并所有修改，处理冲突 ----
            var allMods = {};
            var sourceMap = {};

            for (var i = 0; i < sorted.length; i++) {
                var result = sorted[i];
                var mods = result.modifications || {};
                var source = result.type || 'unknown';

                resolved.metadata.sources.push(source);

                // 记录每个来源的原始修改
                sourceMap[source] = mods;

                // 合并到总修改集
                for (var key in mods) {
                    if (!mods.hasOwnProperty(key)) continue;
                    var value = mods[key];

                    // 特殊处理：百分比类型（percent 结尾）采用累加
                                  // 特殊处理：百分比类型（percent 结尾）采用累加，除白名单外
                    if (typeof key === 'string' && key.indexOf('Percent') !== -1 && typeof value === 'number') {
                        // 乘算白名单：这些百分比采用乘算而非加算
                        var MUL_PER_WHITELIST = ['atkMulPercent', 'matkMulPercent'];  // 可扩展
                        if (MUL_PER_WHITELIST.indexOf(key) !== -1) {
                            allMods[key] = (allMods[key] || 1) * (1 + value / 100);
                        } else {
                            allMods[key] = (allMods[key] || 0) + value;
                        }
                        continue;
                    }
                    

                    // 特殊处理：修饰符对象（raceAddDamage 等）采用深度合并
                    if (typeof key === 'string' && ['modifiers'].indexOf(key) !== -1 && typeof value === 'object') {
                        if (!allMods[key]) allMods[key] = {};
                        for (var subKey in value) {
                            if (!value.hasOwnProperty(subKey)) continue;
                            if (typeof value[subKey] === 'object') {
                                if (!allMods[key][subKey]) allMods[key][subKey] = {};
                                for (var subSubKey in value[subKey]) {
                                    if (!value[subKey].hasOwnProperty(subSubKey)) continue;
                                    allMods[key][subKey][subSubKey] = (allMods[key][subKey][subSubKey] || 0) + value[subKey][subSubKey];
                                }
                            } else {
                                allMods[key][subKey] = (allMods[key][subKey] || 0) + value[subKey];
                            }
                        }
                        continue;
                    }

                    // 特殊处理：元素属性（attackElement / defenseElement）
                    // 优先级：后出现的覆盖先出现的（因为已按优先级排序）
                    if (key === 'attackElement' || key === 'defenseElement' || key === 'element') {
                        // 如果已经存在且不是同一个来源，记录覆盖
                        if (allMods[key] && allMods[key] !== value) {
                            resolved.conflictLog.push({
                                key: key,
                                oldValue: allMods[key],
                                newValue: value,
                                source: source,
                                action: 'overwrite'
                            });
                        }
                        allMods[key] = value;
                        continue;
                    }

                    // 一般数值：累加（数值型属性如 atk, def, maxHp 等）
                    if (typeof value === 'number') {
                        allMods[key] = (allMods[key] || 0) + value;
                        continue;
                    }

                    // 字符串/其他：直接覆盖
                    if (value !== undefined && value !== null) {
                        if (allMods[key] && allMods[key] !== value) {
                            resolved.conflictLog.push({
                                key: key,
                                oldValue: allMods[key],
                                newValue: value,
                                source: source,
                                action: 'overwrite'
                            });
                        }
                        allMods[key] = value;
                    }
                }
            }

            resolved.modifications = allMods;

            // ---- 3. 添加调试信息 ----
            resolved.metadata.order = sorted.map(function(r) {
                return r.type + '(' + r.priority + ')';
            });

            return resolved;
        }
    };

    global.ConflictResolver = ConflictResolver;
    console.log('[ConflictResolver] ✅ 已加载');

})(window);