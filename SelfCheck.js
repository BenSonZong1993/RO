// ============================================================
//  FILE: SelfCheck.js
//  LAYER: debug（启动自检；与 StatusDebug 同住 debug/ 目录，蓝图 3.3）
//  权限：无（只读检查）
//  依赖：各层全局模块（只做 typeof 检查）
//  v4.0：新增 Gateways / Repositories / CharacterContext / CloudStorageService /
//        SocialService / 三支柱 检查项；移除不存在的 FormulaRegistry 检查
// ============================================================
(function(global) {
    'use strict';

    // ----- 检查项列表 -----
    const CHECKS = [];

    function register(name, fn) {
        CHECKS.push({ name, fn });
    }

    function run() {
        console.log('[SelfCheck] 开始启动自检...');
        let allPassed = true;
        let warnings = [];

        for (const check of CHECKS) {
            try {
                const result = check.fn();
                if (result === true) {
                    console.log(`  ✅ ${check.name}`);
                } else if (result === false) {
                    console.error(`  ❌ ${check.name} 失败`);
                    allPassed = false;
                }
            } catch (e) {
                console.error(`  ❌ ${check.name} 抛出异常:`, e);
                allPassed = false;
            }
        }

        if (allPassed && warnings.length === 0) {
            console.log('[SelfCheck] ✅ 所有检查通过');
        } else if (allPassed && warnings.length > 0) {
            console.log('[SelfCheck] ⚠️ 通过但有警告:', warnings.map(w => w.msg).join('; '));
        } else {
            console.error('[SelfCheck] ❌ 存在检查失败，请修复后再启动');
        }

        return allPassed;
    }

    // ----- 预置检查项 -----

    // 1. 核心基础设施
    register('核心: EventBus', () => typeof global.EventBus !== 'undefined' ? true : 'EventBus 未加载');
    register('核心: AccessControl', () => typeof global.AccessControl !== 'undefined' ? true : 'AccessControl 未加载');
    register('核心: PersistenceManager', () => typeof global.PersistenceManager !== 'undefined' ? true : 'PersistenceManager 未加载');
    register('核心: DataCoordinator', () => typeof global.DataCoordinator !== 'undefined' ? true : 'DataCoordinator 未加载');
    register('核心: ArithmeticCore', () => typeof global.ArithmeticCore !== 'undefined' ? true : 'ArithmeticCore 未加载');
    register('核心: AttributeNormalizer', () => typeof global.AttributeNormalizer !== 'undefined' ? true : 'AttributeNormalizer 未加载');
    register('核心: ConfigProfileManager', () => typeof global.ConfigProfileManager !== 'undefined' ? true : 'ConfigProfileManager 未加载');

    // 2. 三支柱（Context / Gateway / Repository）
    register('支柱: CharacterContext', () => typeof global.CharacterContext !== 'undefined' ? true : 'CharacterContext 未加载');
    register('支柱: AttributeGateway', () => typeof global.AttributeGateway !== 'undefined' ? true : 'AttributeGateway 未加载');
    register('支柱: ItemDataGateway', () => typeof global.ItemDataGateway !== 'undefined' ? true : 'ItemDataGateway 未加载');
    register('支柱: SkillGateway', () => typeof global.SkillGateway !== 'undefined' ? true : 'SkillGateway 未加载');
    register('支柱: JobGateway', () => typeof global.JobGateway !== 'undefined' ? true : 'JobGateway 未加载');
    register('支柱: MapDataGateway', () => typeof global.MapDataGateway !== 'undefined' ? true : 'MapDataGateway 未加载');
    register('支柱: LootGateway', () => typeof global.LootGateway !== 'undefined' ? true : 'LootGateway 未加载');
    register('支柱: CharRepository', () => typeof global.CharRepository !== 'undefined' ? true : 'CharRepository 未加载');
    register('支柱: InventoryRepository', () => typeof global.InventoryRepository !== 'undefined' ? true : 'InventoryRepository 未加载');
    register('支柱: MapRepository', () => typeof global.MapRepository !== 'undefined' ? true : 'MapRepository 未加载');

    // 3. 服务层
    register('服务: CharService', () => typeof global.CharService !== 'undefined' ? true : 'CharService 未加载');
    register('服务: InventoryService', () => typeof global.InventoryService !== 'undefined' ? true : 'InventoryService 未加载');
    register('服务: EquipService', () => typeof global.EquipService !== 'undefined' ? true : 'EquipService 未加载');
    register('服务: CardService', () => typeof global.CardService !== 'undefined' ? true : 'CardService 未加载');
    register('服务: UsableService', () => typeof global.UsableService !== 'undefined' ? true : 'UsableService 未加载');
    register('服务: MaterialService', () => typeof global.MaterialService !== 'undefined' ? true : 'MaterialService 未加载');
    register('服务: RebirthService', () => typeof global.RebirthService !== 'undefined' ? true : 'RebirthService 未加载');
    register('服务: JobChangeService', () => typeof global.JobChangeService !== 'undefined' ? true : 'JobChangeService 未加载');
    register('服务: MapService', () => typeof global.MapService !== 'undefined' ? true : 'MapService 未加载');
    register('占位: CloudStorageService', () => {
        if (typeof global.CloudStorageService === 'undefined') return false;
        const m = ['save', 'load', 'saveSection', 'loadSection', 'sync', 'getRemoteVersion'];
        for (const k of m) {
            if (typeof global.CloudStorageService[k] !== 'function') return '缺少方法 ' + k;
        }
        return true;
    });
    register('占位: SocialService', () => {
        if (typeof global.SocialService === 'undefined') return false;
        const m = ['getRanking', 'getPlayerSnapshot', 'checkTeammates', 'updateMyStats'];
        for (const k of m) {
            if (typeof global.SocialService[k] !== 'function') return '缺少方法 ' + k;
        }
        return true;
    });

    // 4. 技能四层
    register('技能: SkillRuntime', () => typeof global.SkillRuntime !== 'undefined' ? true : 'SkillRuntime 未加载');
    register('技能: SkillStrategy', () => typeof global.SkillStrategy !== 'undefined' ? true : 'SkillStrategy 未加载');
    register('技能: SkillExecutor', () => typeof global.SkillExecutor !== 'undefined' ? true : 'SkillExecutor 未加载');
    register('技能: SkillScheduler', () => typeof global.SkillScheduler !== 'undefined' ? true : 'SkillScheduler 未加载');

    // 5. 数据文件
    register('数据: CharData', () => typeof global.CharData !== 'undefined' ? true : 'CharData 未加载');
    register('数据: MapData', () => typeof global.MapData !== 'undefined' ? true : 'MapData 未加载');
    
    register('数据: JobGateway', () => {
    try {
        var test = global.JobGateway && typeof global.JobGateway.getExpTable === 'function';
        if (!test) return 'JobGateway 未加载或 getExpTable 不可用';
        var novice = global.JobGateway.getExpTable('Novice');
        return (novice && novice.BaseExp && novice.BaseExp.length > 0) ? true : 'JobGateway 无法读取职业数据';
    } catch(e) {
        return 'JobGateway 异常: ' + e.message;
    }
});

    register('数据: SkillGroups', () => (global.SkillGroups && typeof global.SkillGroups === 'object' && Object.keys(global.SkillGroups).length > 0)
        ? true : 'SkillGroups 未加载或为空（技能系统不可用）');
    register('数据: ItemDataEquip', () => (global.ItemDataEquip && Array.isArray(global.ItemDataEquip) && global.ItemDataEquip.length > 0)
        ? true : 'ItemDataEquip 未加载或为空（装备数据不可用）');
    register('数据: ItemDataUsable', () => (global.ItemDataUsable && Array.isArray(global.ItemDataUsable) && global.ItemDataUsable.length > 0)
        ? true : 'ItemDataUsable 未加载或为空（消耗品数据不可用）');
    register('数据: ItemDataEtc', () => (global.ItemDataEtc && Array.isArray(global.ItemDataEtc) && global.ItemDataEtc.length > 0)
        ? true : 'ItemDataEtc 未加载或为空（材料数据不可用）');

    // 6. 控制器与战斗
    register('控制器: CharController', () => typeof global.CharController !== 'undefined' ? true : 'CharController 未加载');
    register('战斗: BattleController', () => typeof global.BattleController !== 'undefined' ? true : 'BattleController 未加载（战斗功能不可用）');

    // 7. 权限检查
    register('权限: data:char 已注册', () => {
        if (global.AccessControl) {
            const list = global.AccessControl.list();
            if (list['data:char']) return true;
            return 'data:char 操作未在 AccessControl 中注册';
        }
        return 'AccessControl 未加载，跳过权限检查';
    });

    // ----- 暴露全局 -----
    global.SelfCheck = {
        register: register,
        run: run
    };

    console.log('[SelfCheck] ✅ 已加载（v4.0，已注册 ' + CHECKS.length + ' 项检查）');
})(window);
