// js/12-debug/StatusDebug.js
(function(global) {
    'use strict';

    // 测试函数（可直接复制上面的脚本体）
    global.__RO_TEST = {
        runElementDamageTest: function() {
            // 将上面脚本的整个匿名函数体复制到这里
            // 注意：去掉外层的 (function testElementDamage() { ... })()
            // 直接执行内部代码，使用 this 或闭包


    // 确保必要全局对象存在
    if (!window.ElementDB || !window.CharController || !window.InventoryService || !window.rAthena) {
        console.error('缺失必要模块，请先加载完整游戏');
        return;
    }

    var ELE_LIST = window.ELEMENT_LIST || ['Neutral','Water','Earth','Fire','Wind','Poison','Holy','Dark','Ghost','Undead'];
    // 排除 Neutral，因为不改变属性
    var testElements = ELE_LIST.filter(e => e !== 'Neutral');

    // 保存原始角色状态（便于恢复）
    var char = window.CharController.getChar();
    var originalWeaponSlot = window.InventoryService.getEquippedInfo().weapon;
    var weaponTemplateId = null; // 临时武器ID

    // 用于记录测试结果
    var results = [];

    // 辅助：创建临时武器物品
    function createTestWeapon(element) {
        var id = 90000 + Math.floor(Math.random() * 10000);
        var item = {
            Id: id,
            AegisName: 'TEMP_WEAPON_' + element,
            Name: 'Test ' + element + ' Weapon',
            Type: 'Weapon',
            SubType: 'Dagger', // 无职业限制
            EquipLevelMin: 1,
            Jobs: { All: true },
            Classes: { All: true },
            Locations: { Right_Hand: true },
            Attack: 100, // 基础攻击力
            Script: 'bonus bAtkEle,' + element + ';', // 改变攻击元素
            WeaponLevel: 1,
            Range: 1
        };
        // 添加到全局 ItemDataEquip
        if (!window.ItemDataEquip) window.ItemDataEquip = [];
        window.ItemDataEquip.push(item);
        return id;
    }

    // 辅助：生成木桩怪物
    function createTestMonster(element) {
        var id = 90000 + Math.floor(Math.random() * 10000);
        var monster = {
            Id: id,
            AegisName: 'TEST_DUMMY_' + element,
            Name: 'Dummy ' + element,
            Level: 1,
            Hp: 10000,
            Sp: 0,
            BaseExp: 0,
            JobExp: 0,
            Attack: 0,
            Attack2: 0,
            Defense: 0,
            MagicDefense: 0,
            Str: 1, Agi: 1, Vit: 1, Int: 1, Dex: 1, Luk: 1,
            AttackRange: 1,
            Size: 'Medium',
            Race: 'Formless',
            Element: element,      // 保留大写
            element: element,      // 新增小写
            ElementLevel: 1,
            Class: 'Normal',
            Drops: []
        };
        // ...
    }

    // 辅助：强制刷新UI和属性
    function refreshStats() {
        if (window.UIAttributes) window.UIAttributes.refreshAll();
        if (window.EventBus) window.EventBus.emit('char:changed');
    }

    // 逐个元素测试
    testElements.forEach(function(elem) {
        console.log('===== 测试攻击元素: ' + elem + ' =====');

        // 1. 创建临时武器
        var tempWeaponId = createTestWeapon(elem);
        var addResult = window.InventoryService.addItem(tempWeaponId, 0, 1, []);
        if (!addResult.success) {
            console.error('添加临时武器失败', addResult);
            return;
        }

        // 2. 装备武器（如果已有武器，先卸下）
        var equipped = window.InventoryService.getEquippedInfo();
        if (equipped.weapon) {
            var unequipResult = window.InventoryService.unequip('weapon');
            if (!unequipResult.success) {
                console.error('卸下原武器失败', unequipResult);
                return;
            }
        }
        var equipResult = window.InventoryService.equip('weapon', tempWeaponId, 0, []);
        if (!equipResult.success) {
            console.error('装备临时武器失败', equipResult);
            return;
        }

        // 3. 强制重新计算属性（触发 AttributeSystem）
        refreshStats();

        // 4. 生成木桩怪物
        var dummy = createTestMonster(elem);

        // 5. 获取当前攻击力（从 char._finalStats）
        var char = window.CharController.getChar();
        var final = char._finalStats || {};
        var baseAtk = final.finalATK || 100;
        var attackElem = final.attackElement || 'Neutral';

        // 6. 计算伤害（使用 rAthena.engine.calculateNormalAttackDamage）
        var damageResult = window.rAthena.engine.calculateNormalAttackDamage(char, dummy, 'Dagger');
        var damage = damageResult.damage || 0;
        var details = damageResult.details || {};

        // 7. 记录结果
        results.push({
            element: elem,
            attackElem: attackElem,
            targetElem: dummy.Element,
            baseAtk: baseAtk,
            damage: damage,
            details: details
        });

        console.log('攻击元素:', attackElem, ' 目标元素:', dummy.Element, ' 伤害:', damage, ' 详情:', details);

        // 8. 清理：卸下临时武器并删除物品（可选）
        window.InventoryService.unequip('weapon');
        // 从背包移除临时武器
        var stacks = window.InventoryService.getAllStacks(false);
        for (var i = 0; i < stacks.length; i++) {
            if (stacks[i].templateId === tempWeaponId) {
                window.InventoryService.removeItem(stacks[i].key, 1);
                break;
            }
        }
        // 从全局数据中移除临时武器定义（避免污染）
        if (window.ItemDataEquip) {
            var idx = window.ItemDataEquip.findIndex(item => item.Id === tempWeaponId);
            if (idx !== -1) window.ItemDataEquip.splice(idx, 1);
        }
        // 从 MonsterData 移除木桩
        if (window.MonsterData) {
            var mIdx = window.MonsterData.findIndex(m => m.Id === dummy.Id);
            if (mIdx !== -1) window.MonsterData.splice(mIdx, 1);
        }
        // 恢复原武器（如果有）
        if (originalWeaponSlot) {
            window.InventoryService.equip('weapon', originalWeaponSlot.templateId, originalWeaponSlot.refine, originalWeaponSlot.cards);
        }
        refreshStats();
    });

    // 输出汇总
    console.table(results);
    console.log('测试完成，共 ', results.length, ' 个元素');


        }
    };

    console.log('[StatusDebug] 测试工具已加载，使用 __RO_TEST.runElementDamageTest() 运行');
})(window);