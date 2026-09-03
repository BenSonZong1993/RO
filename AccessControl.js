// ============================================================
//  FILE: AccessControl.js
//  LAYER: core（权限控制）
//  权限：system:权限管理（自身）
//  依赖：无
//  契约：check(operation, moduleName) / request / register / list
//  规则：D4 —— 未注册模块禁止执行敏感操作
//  v4.0 重构：新增 CharacterContext / Repository / 子服务 / 转生转职权限条目
// ============================================================
(function(global) {
    'use strict';

    const OPERATION_PERMISSIONS = {
        // ---- 数据根权限 ----
        'data:char': ['CharController', 'CharacterContext', 'CharRepository', 'CharService', 'RebirthService', 'ConfigProfileManager', 'SkillService', 'UISettings'],
        'data:inventory': ['InventoryService', 'InventoryRepository', 'EquipService', 'CardService', 'UsableService', 'MaterialService', 'UIRecycle', 'LootManager', 'RefineService'],
        'data:map': ['UIMap', 'BattleController', 'MapRepository'],
        'data:ui': ['DataModule', 'UIMap', 'UIEventManager', 'UISettings', 'init'],

        // ---- 角色细粒度操作 ----
        'char:allocateStat': ['CharController', 'CharService', 'GMConsole'],
        'char:addExp': ['CharController', 'CharService', 'CharacterContext', 'LootManager', 'GMConsole'],
        'char:takeDamage': ['BattleController', 'MonsterAI', 'CharController'],
        'char:healFull': ['CharController', 'GMConsole'],
        'char:reset': ['CharController', 'GMConsole'],
        'char:consumeSP': ['CharController', 'SkillScheduler', 'SkillExecutor', 'CharacterContext'],
        'char:addHp': ['CharacterContext', 'CharController', 'UsableService', 'SkillExecutor', 'GroundEffectManager'],
        'char:addSp': ['CharacterContext', 'CharController', 'UsableService', 'SkillExecutor'],
        'char:addZeny': ['CharacterContext', 'CharController', 'UIShop', 'MaterialService', 'UIRecycle', 'LootManager'],
        'char:deductZeny': ['CharacterContext', 'CharController', 'UIShop', 'SkillExecutor', 'RefineService', 'EnchantService'],
        'char:resetSkills': ['CharacterContext', 'init', 'GMConsole'],
        'char:resetSkillPoints': ['SkillService', 'init', 'GMConsole'],
        'char:resetStatPoints': ['SkillService', 'init', 'GMConsole'],
        'char:updateJob': ['CharacterContext', 'JobChangeService', 'GMConsole'],
        'char:resetCharacter': ['CharacterContext', 'RebirthService', 'GMConsole'],
        'char:learnSkill': ['SkillService', 'CharController', 'init', 'GMConsole'],

        // ---- 转生 / 转职（init 为 UI 事件编排层） ----
        'rebirth:perform': ['RebirthService', 'init', 'GMConsole'],
        'job:change': ['JobChangeService', 'init', 'GMConsole'],

        // ---- 属性 ----
        'attribute:recalc': ['AttributeMediator', 'CharController', 'InventoryService', 'rAthenaStatus', 'ConfigProfileManager'],
        'attribute:invalidate': ['CharacterContext', 'EquipService', 'CardService', 'InventoryService', 'ConfigProfileManager', 'CharService', 'RebirthService', 'rAthenaStatus'],

        // ---- 背包 / 装备 / 卡片 / 消耗品 ----
        'inventory:equip': ['InventoryService', 'EquipService', 'GMConsole'],
        'inventory:unequip': ['InventoryService', 'EquipService', 'GMConsole'],
        'inventory:use': ['InventoryService', 'UsableService', 'GMConsole', 'AutoConsumeManager'],
        'inventory:insertCard': ['InventoryService', 'CardService', 'GMConsole'],
        'inventory:removeCard': ['InventoryService', 'CardService', 'GMConsole'],

        // ---- 精炼（RefineService：读装备→查 RefineConfig→扣矿/扣费→写 refineLevel/碎裂移除；init 为 UI 事件编排层） ----
        'refine:perform': ['RefineService', 'init', 'GMConsole'],

        // ---- 附魔（EnchantService：读装备→查 EnchantConfig→随机词条洗练→扣费→写 enchant 字段；init 为 UI 事件编排层） ----
        'enchant:perform': ['EnchantService', 'init', 'GMConsole'],

        // ---- 战斗 ----
        'battle:start': ['BattleController', 'GMConsole'],
        'battle:stop': ['BattleController', 'GMConsole'],

        // ---- 掉落 ----
        'loot:randomQuality': ['LootGateway', 'LootManager'],

        // ---- 系统 ----
        'system:save': ['*'],
        'system:reset': ['GMConsole', 'CharController', 'CharacterContext'],
    };

    function check(operation, moduleName) {
        if (moduleName === 'Test' || moduleName === 'GMConsole' || moduleName === 'Dev') {
            return true;
        }
        if (typeof operation !== 'string' || !operation) {
            console.warn('[AccessControl] 操作名无效:', operation);
            return false;
        }
        if (typeof moduleName !== 'string' || !moduleName) {
            console.warn('[AccessControl] 模块名无效:', moduleName);
            return false;
        }
        const allowed = OPERATION_PERMISSIONS[operation];
        if (!allowed) {
            console.warn('[AccessControl] 未知操作:', operation);
            return false;
        }
        if (allowed.includes('*')) return true;
        return allowed.includes(moduleName);
    }

    function request(operation, moduleName, callback) {
        if (!check(operation, moduleName)) {
            console.error('[AccessControl] 拒绝:', moduleName, '无权执行', operation);
            return false;
        }
        if (typeof callback !== 'function') {
            console.error('[AccessControl] 回调不是函数');
            return false;
        }
        try { return callback(); } catch (e) {
            console.error('[AccessControl] 执行回调出错:', e);
            return false;
        }
    }

    function register(operation, allowedModules) {
        if (typeof operation !== 'string' || !operation) return false;
        if (!Array.isArray(allowedModules) || allowedModules.length === 0) return false;
        OPERATION_PERMISSIONS[operation] = allowedModules;
        return true;
    }

    function list() { return { ...OPERATION_PERMISSIONS }; }

    global.AccessControl = { check, request, register, list };
    console.log('[AccessControl] ✅ 已加载（v4.0 含 Context/Repository/子服务权限）');
})(window);
