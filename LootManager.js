// js/battle/LootManager.js
// ============================================================
//  掉落与经验结算（v4.1：完整乘区链）
//  经验获得  = (怪物基础经验 + MVP经验) × monster.exp(模式) × char.expGain(模式) × 等级差惩罚(真全局)
//  Job经验   = 怪物职业经验 × monster.jobExp(模式) × char.expGain(模式) × 等级差惩罚(真全局)
//  掉率      = 基础率 × drop.rate(模式) × 品质修正(经 LootGateway, 规则 GATE-1) × 等级差惩罚(真全局)
//  权限：char:addExp（经 CharController/Context 链路）
//  依赖：ConfigProfileManager、LevelPenaltyConfig、LootGateway、InventoryService、ItemNameMap
// ============================================================
(function(global) {
    'use strict';

    function processDeath(monsterUnit, playerChar) {
        if (!monsterUnit || !monsterUnit._template) {
            console.warn('[LootManager] 无效怪物');
            return null;
        }

        const template = monsterUnit._template;

        // ----- 经验基数（unit.exp/jobExp 已由 MonsterService 应用模式因子 monster.exp/jobExp） -----
        const baseExpRaw = (typeof monsterUnit.exp === 'number' && monsterUnit.exp > 0)
            ? monsterUnit.exp : (template.baseExp || 0);
        const jobExpRaw = (typeof monsterUnit.jobExp === 'number' && monsterUnit.jobExp > 0)
            ? monsterUnit.jobExp : (template.jobExp || 0);
        const mvpExp = template.mvpExp || 0;

        // ----- 读取当前配置（图层系统） -----
        let profile = null;
        if (global.ConfigProfileManager && typeof global.ConfigProfileManager.getCurrentProfile === 'function') {
            profile = global.ConfigProfileManager.getCurrentProfile();
        }

        // ----- 角色等级与等级差惩罚（真全局，LevelPenaltyConfig） -----
        let charLevel = (playerChar && playerChar.level) || 0;
        if (!(charLevel > 0) && global.CharController && typeof global.CharController.getChar === 'function') {
            const c = global.CharController.getChar();
            charLevel = (c && c.level) || 1;
        }
        const mobLevel = monsterUnit.level || template.level || 1;
        const levelDiff = mobLevel - charLevel;
        let expPenalty = 1.0;
        let dropPenalty = 1.0;
        if (global.LevelPenalty && typeof global.LevelPenalty.getExpMultiplier === 'function') {
            expPenalty = global.LevelPenalty.getExpMultiplier(levelDiff);
            dropPenalty = global.LevelPenalty.getDropMultiplier(levelDiff);
        }

        // ----- 模式内角色经验获取因子（char.expGain） -----
        let expGainMod = 1.0;
        if (profile && profile.char && typeof profile.char.expGain === 'number') {
            expGainMod = profile.char.expGain;
        }

        // ----- 组队经验影子惩罚（队友佣兵在场即整队生效；PartyConfig 默认 0.75） -----
        let partyMod = 1.0;
        if (global.PartnerManager && typeof global.PartnerManager.getExpMultiplier === 'function') {
            partyMod = global.PartnerManager.getExpMultiplier() || 1.0;
        }

        const baseExp = Math.floor((baseExpRaw + mvpExp) * expGainMod * expPenalty * partyMod);
        const jobExp = Math.floor(jobExpRaw * expGainMod * expPenalty * partyMod);

        // 通知角色模块获得经验
        if (global.CharController && typeof global.CharController.addExp === 'function') {
            global.CharController.addExp(baseExp, jobExp);
        } else {
            console.warn('[LootManager] CharController.addExp 不可用');
        }

        // ----- 掉落结算（普通掉落 + MVP 掉落，同一乘区链） -----
        // AegisName → Id 经 ItemDataGateway（规则 GATE-1；旧直读 window.ItemNameMap 已收编）
        function _aegisToId(aegisName) {
            if (!global.ItemDataGateway || typeof global.ItemDataGateway.getByAegis !== 'function') return null;
            var def = global.ItemDataGateway.getByAegis(aegisName);
            return def ? def.Id : null;
        }

        let dropRateMod = 1.0;
        let dropAmountMod = 1.0;
        if (profile && profile.drop) {
            if (typeof profile.drop.rate === 'number') dropRateMod = profile.drop.rate;
            if (typeof profile.drop.amount === 'number') dropAmountMod = profile.drop.amount;
        }

        let qualityMod = 1.0;
        if (global.LootGateway && typeof global.LootGateway.getDropRateModifier === 'function') {
            qualityMod = global.LootGateway.getDropRateModifier('common') || 1.0;
        }

        const lootItems = [];

        // ---- 自动出售材料（ui.autoSellEtc；仅"材料"类，装备/卡片/消耗品不受影响） ----
        function _autoSellEnabled() {
            return !!(global.DataCoordinator && global.DataCoordinator.get('ui.autoSellEtc') === true);
        }
        function _findStackKeyByTemplate(templateId) {
            if (!global.InventoryRepository || typeof global.InventoryRepository.getAllStacks !== 'function') return null;
            var rows = global.InventoryRepository.getAllStacks(false);
            for (var i = 0; i < rows.length; i++) {
                if (rows[i].templateId === templateId) return rows[i].key;
            }
            return null;
        }
        function _tryAutoSell(itemId, count, itemKey) {
            if (!_autoSellEnabled()) return false;
            if (!global.ItemDataGateway || !global.MaterialService) return false;
            if (global.ItemDataGateway.getType(itemId) !== '材料') return false;
            var sellPrice = global.ItemDataGateway.getSellPrice(itemId);
            if (sellPrice <= 0) return false;
            var stackKey = _findStackKeyByTemplate(itemId);
            if (!stackKey) return false;
            var sellResult = global.MaterialService.sell(stackKey, count, sellPrice, 'LootManager');
            return !!(sellResult && sellResult.success && sellResult.zeny > 0) ? { zeny: sellResult.zeny } : false;
        }

        const rollDrops = function(drops) {
            if (!Array.isArray(drops)) return;
            for (const drop of drops) {
                const itemKey = drop.Item;
                const rate = (drop.Rate || 0) / 10000;
                const finalRate = rate * dropRateMod * qualityMod * dropPenalty;

                if (Math.random() > finalRate) continue;

                const itemId = _aegisToId(itemKey);
                if (!itemId) {
                    console.warn('[LootManager] 未知物品:', itemKey);
                    continue;
                }

                // ★ 新增：获取显示名（优先 cnName）
                let displayName = itemKey;
                if (global.ItemDataGateway && typeof global.ItemDataGateway.getDisplayName === 'function') {
                    displayName = global.ItemDataGateway.getDisplayName(itemId) || itemKey;
                }

                const count = Math.max(1, Math.floor(1 * dropAmountMod));

                if (global.InventoryService && typeof global.InventoryService.addItem === 'function') {
                    const result = global.InventoryService.addItem(itemId, 0, count);
                    if (result.success) {
                        const sold = _tryAutoSell(itemId, count, itemKey);
                        if (sold) {
                            lootItems.push(displayName + ' x' + count + '（已售' + sold.zeny + 'Z）');
                        } else {
                            lootItems.push(displayName + (count > 1 ? ' x' + count : ''));
                        }
                    } else {
                        console.warn('[LootManager] 拾取失败:', itemKey);
                    }
                } else {
                    lootItems.push(displayName + (count > 1 ? ' x' + count : ''));
                }
            }
        };

        rollDrops(template.drops);
        rollDrops(template.mvpDrops);

        // 触发事件
        if (global.EventBus) {
            global.EventBus.emit('battle:monsterKilled', {
                monsterId: template.id,
                monsterName: template.name,
                exp: baseExp,
                jobExp: jobExp,
                loot: lootItems,
                levelDiff: levelDiff,
                expMultiplier: +(expGainMod * expPenalty).toFixed(3),
                dropMultiplier: +dropPenalty.toFixed(3),
            });
        }

        return { exp: baseExp, jobExp: jobExp, loot: lootItems };
    }

    global.LootManager = {
        processDeath: processDeath
    };

    console.log('[LootManager] ✅ 已加载（v4.1：完整经验/掉落乘区链 + MVP 结算 + 等级差惩罚）');
})(window);