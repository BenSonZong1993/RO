// ============================================================
//  FILE: ASPDProcessor.js
//  LAYER: processors（攻速计算）
//  依赖：JobGateway.getAspd, InventoryRepository, ItemDataGateway
//  输出：modifications.baseASPD（毫秒间隔）
//  规则：攻速数据来源为 JOB_ASPD（官方 job_aspd.yml）
// ============================================================
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[ASPDProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var ASPDProcessor = {

        process: function(char) {
            var result = {
                type: 'aspd',
                priority: 70,
                source: 'job_weapon_base',
                modifications: {},
                metadata: {}
            };

            if (!char) return this._emptyResult();

            var jobKey = char.jobKey || 'Novice';
            var agi = char.stats?.agi || 1;
            var dex = char.stats?.dex || 1;

            // ---- 1. 获取当前武器类型 ----
            var weaponType = 'None';
            if (global.InventoryRepository && global.ItemDataGateway) {
                var equipped = global.InventoryRepository.getEquipped();
                if (equipped && equipped.weapon) {
                    var def = global.ItemDataGateway.getById(equipped.weapon.templateId);
                    if (def && def.SubType) {
                        weaponType = def.SubType;
                    }
                }
            }

            // ---- 2. 从 JobGateway 获取基础攻速值（如 40, 55, ...） ----
            var aspdValue = 60; // 默认值
            if (global.JobGateway && typeof global.JobGateway.getAspd === 'function') {
                aspdValue = global.JobGateway.getAspd(jobKey, weaponType);
            } else {
                console.warn('[ASPDProcessor] JobGateway 未就绪，使用默认攻速值 60');
            }

            // ---- 3. 将攻速值转换为攻击间隔（毫秒） ----
            // 官方公式：amotion = (200 - aspeed) * 50
            // 但 BaseASPD 值（如 40）即为 aspeed 的基数，因此：
            //   baseAmotion = (80 - aspdValue) * 50
            //  空手 (aspd=40) → (80-40)*50 = 2000ms
            //  短剑 (aspd=55) → (80-55)*50 = 1250ms
            //  拳套 (aspd=0?) → (80-0)*50 = 4000ms（极慢）
            var baseAmotion = Math.max(50, (80 - aspdValue) * 50);

            // ---- 4. 应用 AGI/DEX 修正（官方 Renewal） ----
            var factor = (agi + dex / 4) / 250;
            if (factor > 0.95) factor = 0.95; // 防止超速
            var finalAmotion = Math.floor(baseAmotion * (1 - factor));
            if (finalAmotion < 50) finalAmotion = 50;

            // 计算显示值（用于调试，实际最终值由 AttributeSystem 组装）
            var baseAspeed = 200 - finalAmotion / 50;

            // ---- 5. 填充结果 ----
            result.modifications = {
                baseASPD: finalAmotion,    // 最终攻击间隔（毫秒）
                aspdPercent: 0             // 百分比加成（由后续处理器叠加）
            };
            result.metadata = {
                weaponType: weaponType,
                jobKey: jobKey,
                rawBaseASPD: aspdValue,
                baseAmotion: baseAmotion,
                factor: factor,
                finalAmotion: finalAmotion,
                baseAspeed: Math.round(baseAspeed * 10) / 10
            };

            return result;
        },

        _emptyResult: function() {
            return {
                type: 'aspd',
                priority: 70,
                source: 'empty',
                modifications: {},
                metadata: { empty: true }
            };
        }
    };

    // ---- 暴露全局（关键！） ----
    global.ASPDProcessor = ASPDProcessor;

    console.log('[ASPDProcessor] ✅ 已加载（使用 JobGateway 数据源）');
})(window);