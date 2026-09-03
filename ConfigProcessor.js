// ================================================================
//  📁 js/processors/ConfigProcessor.js
//  职责：读取当前配置组修正，输出标准化修正对象
//  站口优先级：40（最高，最后被应用）
// ================================================================
(function(global) {
    'use strict';

    var ArithmeticCore = global.ArithmeticCore;
    if (!ArithmeticCore) {
        console.error('[ConfigProcessor] 依赖缺失：ArithmeticCore 未加载');
        return;
    }

    var ConfigProcessor = {

        /**
         * 处理配置组修正
         * @param {object} profile - ConfigProfileManager.getCurrentProfile() 的返回值
         * @param {object} char - 角色对象（用于上下文）
         * @returns {object} 标准化修正对象
         */
        process: function(profile, char) {
            var result = {
                type: 'config',
                priority: 40,
                source: 'config_profile',
                modifications: {},
                metadata: {
                    profileId: null,
                    profileName: null,
                }
            };

            if (!profile || typeof profile !== 'object') {
                return result;
            }

            result.metadata.profileId = profile.id || null;
            result.metadata.profileName = profile.name || null;

            // ---- 角色修正 ----
            var charMod = profile.char || {};
            if (charMod.atk && charMod.atk !== 1.0) {
                result.modifications.atkPercent = (result.modifications.atkPercent || 0) + (charMod.atk - 1) * 100;
            }
            if (charMod.def && charMod.def !== 1.0) {
                result.modifications.defPercent = (result.modifications.defPercent || 0) + (charMod.def - 1) * 100;
            }
            if (charMod.aspeed && charMod.aspeed !== 1.0) {
                result.modifications.aspdPercent = (result.modifications.aspdPercent || 0) + (charMod.aspeed - 1) * 100;
            }
            if (charMod.expGain && charMod.expGain !== 1.0) {
                result.modifications.expGainPercent = (charMod.expGain - 1) * 100;
            }
            if (charMod.hpRegen && charMod.hpRegen !== 1.0) {
                result.modifications.hpRegenPercent = (charMod.hpRegen - 1) * 100;
            }
            if (charMod.spRegen && charMod.spRegen !== 1.0) {
                result.modifications.spRegenPercent = (charMod.spRegen - 1) * 100;
            }

            // ---- 掉落修正（非属性，但放在这里便于集中管理） ----
            var dropMod = profile.drop || {};
            if (dropMod.rate && dropMod.rate !== 1.0) {
                result.modifications.dropRatePercent = (dropMod.rate - 1) * 100;
            }
            if (dropMod.amount && dropMod.amount !== 1.0) {
                result.modifications.dropAmountPercent = (dropMod.amount - 1) * 100;
            }

            // ---- 记录来源 ----
            var appliedKeys = Object.keys(charMod).filter(function(k) {
                return charMod[k] !== undefined && charMod[k] !== 1.0;
            });
            result.metadata.appliedModifiers = appliedKeys;

            return result;
        },

        _emptyResult: function() {
            return {
                type: 'config',
                priority: 40,
                source: 'none',
                modifications: {},
                metadata: { empty: true }
            };
        }
    };

    global.ConfigProcessor = ConfigProcessor;
    console.log('[ConfigProcessor] ✅ 已加载');

})(window);