// ================================================================
//  📁 js/processors/EquipProcessor.js
//  职责：从 InventoryService.getEquipBonuses() 读取装备修正，输出标准化修正对象
//  站口优先级：80（高于基础，低于状态）
//  处理内容：装备基础属性 + 卡片脚本 + 装备脚本
// ================================================================
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[EquipProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var EquipProcessor = {

        /**
         * 处理装备加成
         * @param {object} equipBonuses - InventoryService.getEquipBonuses() 的返回值
         * @param {object} char - 角色对象（用于职业/等级检查，暂未使用）
         * @returns {object} 标准化修正对象
         */
        process: function(equipBonuses, char) {
            var result = {
                type: 'equip',
                priority: 80,
                source: 'equipment',
                modifications: {},
                metadata: {
                    slots: {},
                }
            };

            if (!equipBonuses || typeof equipBonuses !== 'object') {
                return result;
            }

            // ---- 1. 基础属性加成 ----
            var fields = ['str', 'agi', 'vit', 'int', 'dex', 'luk'];
            for (var i = 0; i < fields.length; i++) {
                var key = fields[i];
                if (equipBonuses[key] && equipBonuses[key] !== 0) {
                    result.modifications['stat_' + key] = (result.modifications['stat_' + key] || 0) + equipBonuses[key];
                }
            }

            // ---- 2. 战斗属性加成 ----
            var combatFields = ['atk', 'matk', 'def', 'mdef', 'maxHp', 'maxSp', 'aspd', 'hit', 'flee', 'crit', 'perfectDodge'];
            for (var i = 0; i < combatFields.length; i++) {
                var key = combatFields[i];
                if (equipBonuses[key] && equipBonuses[key] !== 0) {
                    result.modifications[key] = (result.modifications[key] || 0) + equipBonuses[key];
                }
            }

            // ---- 3. 百分比加成 ----
            var percentFields = ['atkRate', 'matkRate', 'aspdRate', 'maxHpRate', 'maxSpRate'];
            for (var i = 0; i < percentFields.length; i++) {
                var key = percentFields[i];
                if (equipBonuses[key] && equipBonuses[key] !== 0) {
                    result.modifications[key] = (result.modifications[key] || 0) + equipBonuses[key];
                }
            }

            // ---- 4. 元素属性（武器/防具） ----
            if (equipBonuses.weaponElement && equipBonuses.weaponElement !== 'Neutral') {
                result.modifications.attackElement = equipBonuses.weaponElement;
                result.modifications.attackElementLevel = equipBonuses.weaponElementLevel || 1;
                result.metadata.weaponElement = equipBonuses.weaponElement;
            }

            if (equipBonuses.armorElement && equipBonuses.armorElement !== 'Neutral') {
                result.modifications.defenseElement = equipBonuses.armorElement;
                result.modifications.defenseElementLevel = equipBonuses.armorElementLevel || 1;
                result.metadata.armorElement = equipBonuses.armorElement;
            }

            // ---- 5. 攻击范围 ----
            if (equipBonuses.attackRange && equipBonuses.attackRange > 0) {
                result.modifications.attackRange = equipBonuses.attackRange;
            }

            // ---- 6. 固咏缩减 ----
            if (equipBonuses.fixedCastReduction && equipBonuses.fixedCastReduction > 0) {
                result.modifications.fixedCastReduction = equipBonuses.fixedCastReduction;
            }

            // ---- 7. 修饰符（种族/属性/体型增伤减伤） ----
            var mods = equipBonuses.modifiers || {};
            var modifierTypes = [
                'raceAddDamage', 'raceReduceDamage',
                'elementalAddDamage', 'elementalReduceDamage',
                'sizeAddDamage', 'sizeReduceDamage',
                'statusAttackChance', 'statusResistance'
            ];
            for (var i = 0; i < modifierTypes.length; i++) {
                var type = modifierTypes[i];
                if (mods[type] && typeof mods[type] === 'object' && Object.keys(mods[type]).length > 0) {
                    if (!result.modifications.modifiers) result.modifications.modifiers = {};
                    result.modifications.modifiers[type] = mods[type];
                }
            }

            // ---- 8. 武器类型（用于战斗公式） ----
            if (equipBonuses.weaponType && equipBonuses.weaponType !== 'None') {
                result.modifications.weaponType = equipBonuses.weaponType;
                result.metadata.weaponType = equipBonuses.weaponType;
            }

            // ---- 9. 记录来源 ----
            result.metadata.sources = Object.keys(equipBonuses).filter(function(k) {
                return equipBonuses[k] !== undefined && equipBonuses[k] !== null && equipBonuses[k] !== 0;
            });

            return result;
        },

        /**
         * 空结果
         */
        _emptyResult: function() {
            return {
                type: 'equip',
                priority: 80,
                source: 'none',
                modifications: {},
                metadata: { empty: true }
            };
        }
    };

    global.EquipProcessor = EquipProcessor;
    console.log('[EquipProcessor] ✅ 已加载');

})(window);