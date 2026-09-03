// ============================================================
//  📁 js/data/SizeFixData.js
//  体型修正数据（源自 rAthena size_fix.yml）
//  修正系数为百分比，100 表示无修正
//  支持 Pre-Renewal 和 Renewal 模式

// 如何集成到现有战斗引擎中
// 在你的 rAthenaAdapter.js 或直接在你的战斗公式调用处，使用 SizeFixData.getFix() 来获取修正值。

// 例如，在 battle_calc_weapon_attack 或 battle_calc_base_weapon_attack 中，当需要应用体型修正时，可以这样：

// javascript
// // 假设 playerUnit 有 weaponType，target 有 size
// let weaponType = playerUnit.weaponType; // 例如 'Dagger'
// let targetSize = target.size; // 'Small' / 'Medium' / 'Large'
// let isRenewal = CONFIG.RENEWAL || false; // 从配置读取
// let sizeFix = SizeFixData.getFix(weaponType, targetSize, isRenewal);
// // 然后修正伤害
// damage = Math.floor(damage * sizeFix / 100);
// ============================================================
(function(global) {
    'use strict';

    // ----- Pre-Renewal 基准数据 -----
    const PRE_SIZE_FIX = {
        'Fist':       { Small: 100, Medium: 100, Large: 100 },
        'Dagger':     { Small: 100, Medium: 75,  Large: 50 },
        '1hSword':    { Small: 75,  Medium: 100, Large: 75 },
        '2hSword':    { Small: 75,  Medium: 75,  Large: 100 },
        '1hSpear':    { Small: 75,  Medium: 75,  Large: 100 },
        '2hSpear':    { Small: 75,  Medium: 75,  Large: 100 },
        '1hAxe':      { Small: 50,  Medium: 75,  Large: 100 },
        '2hAxe':      { Small: 50,  Medium: 75,  Large: 100 },
        'Mace':       { Small: 75,  Medium: 100, Large: 100 },
        '2hMace':     { Small: 100, Medium: 100, Large: 100 },
        'Staff':      { Small: 100, Medium: 100, Large: 100 },
        'Bow':        { Small: 100, Medium: 100, Large: 75 },
        'Musical':    { Small: 75,  Medium: 100, Large: 75 },
        'Whip':       { Small: 75,  Medium: 100, Large: 100 }, // Pre默认
        'Book':       { Small: 100, Medium: 100, Large: 50 },
        'Katar':      { Small: 75,  Medium: 100, Large: 75 },
        'Revolver':   { Small: 100, Medium: 100, Large: 100 },
        'Rifle':      { Small: 100, Medium: 100, Large: 100 },
        'Gatling':    { Small: 100, Medium: 100, Large: 100 },
        'Shotgun':    { Small: 100, Medium: 100, Large: 100 },
        'Grenade':    { Small: 100, Medium: 100, Large: 100 },
        'Huuma':      { Small: 100, Medium: 100, Large: 100 },
        '2hStaff':    { Small: 100, Medium: 100, Large: 100 },
        // 新增武器类型（可能出现在 ItemData 中）
        'Knuckle':    { Small: 100, Medium: 100, Large: 100 }, // Pre默认
    };

    // ----- Renewal 覆盖数据 -----
    const RE_OVERRIDES = {
        'Knuckle':    { Large: 75 },
        'Whip':       { Large: 75 },  // 覆盖 Pre 的 Large:100
    };

    // ----- 公共接口 -----
    const SizeFixData = {
        /**
         * 获取指定武器对指定体型的修正系数
         * @param {string} weaponType - 武器类型，如 'Dagger', 'Bow'
         * @param {string} targetSize - 目标体型，'Small', 'Medium', 'Large'
         * @param {boolean} isRenewal - 是否使用 Renewal 模式
         * @returns {number} 修正系数（百分比，100为无修正）
         */
        getFix: function(weaponType, targetSize, isRenewal) {
            if (!weaponType || !targetSize) return 100;
            // 查找基础数据
            let base = PRE_SIZE_FIX[weaponType];
            if (!base) {
                // 未定义则返回100
                return 100;
            }
            let fix = { ...base };
            // 应用 Renewal 覆盖
            if (isRenewal && RE_OVERRIDES[weaponType]) {
                Object.assign(fix, RE_OVERRIDES[weaponType]);
            }
            return fix[targetSize] !== undefined ? fix[targetSize] : 100;
        },

        /**
         * 获取全部数据（可用于调试或批量处理）
         * @param {boolean} isRenewal - 是否应用 Renewal 覆盖
         * @returns {Object} 完整修正表
         */
        getAll: function(isRenewal) {
            let result = {};
            for (let key in PRE_SIZE_FIX) {
                result[key] = { ...PRE_SIZE_FIX[key] };
                if (isRenewal && RE_OVERRIDES[key]) {
                    Object.assign(result[key], RE_OVERRIDES[key]);
                }
            }
            return result;
        }
    };

    // 暴露到全局
    global.SizeFixData = SizeFixData;
    console.log('✅ SizeFixData 加载完成 (武器类型数: ' + Object.keys(PRE_SIZE_FIX).length + ')');

})(window);