// ============================================================
//  📁 js/config/MechanismSupplements.js
//  L1 - 机制补充表（批量规则）
//  用途：按条件匹配技能，批量补充字段（不覆盖已有值）
//  维护：策划可在此添加/调整规则，无需改业务代码
// ============================================================
(function(global) {
    'use strict';

    const MECHANISM_SUPPLEMENTS = [
        // ---- 弓手系：使用武器射程 ----
        {
            match: function(skillAegis) {
                return /^AC_|^HT_|^SN_|^RA_|^GS_/.test(skillAegis);
            },
            supplement: {
                RangeType: 'weapon'
            }
        },
        // ---- 法师系：默认固定射程，但可补充多段 ----
        // 法师技能已在 L0 中有 HitCount，无需补充
        // ---- 刺客系：某些技能使用武器射程 ----
        {
            match: function(skillAegis) {
                return /^AS_|^ASC_/.test(skillAegis);
            },
            supplement: {
                RangeType: 'weapon'
            }
        },
        // ---- 枪手系：使用武器射程 ----
        {
            match: function(skillAegis) {
                return /^GS_/.test(skillAegis);
            },
            supplement: {
                RangeType: 'weapon'
            }
        },
        // ---- 扩展：可在此添加更多规则 ----
    ];

    // 暴露全局
    global.MECHANISM_SUPPLEMENTS = MECHANISM_SUPPLEMENTS;
    console.log('[MechanismSupplements] ✅ 已加载 ' + MECHANISM_SUPPLEMENTS.length + ' 条机制规则');
})(window);