// js/3-data/MapFlagData.js
// ============================================================
//  地图标记数据（源自 rAthena 地图标记系统）
//  用途：判断地图类型（城镇/副本/竞技场等），影响挂机行为
//  数据来源：npc/re/town.txt, npc/re/restricted.txt, db/map_index.txt
// ============================================================
(function(global) {
    'use strict';

    // ============================================================
    //  1. 原始数据（实际项目中应由清洗脚本生成，此处提供示例子集）
    //     完整的映射表应随 MapData.js 一并生成，本文件提供查询接口
    // ============================================================

    // ----- 城镇列表（安全区） -----
    // 来源：npc/re/town.txt
    // ============================================================
    //  城镇名单（单一事实来源）
    //  说明：所有“安全区/不打怪”的城镇地图均在此定义。
    //        UIMap 及其他模块应通过 MapFlagData.isTown() 查询，
    //        不得自行维护另一份名单。
    //  更新记录：2026-08-24 合并 UIMap 中的 yuno/hugel/xmas/amatsu
    // ============================================================
    var TOWN_MAPS = new Set([
        // ---- 基础城镇（源自官方 town.txt） ----
        'prontera',      // 普隆德拉
        'izlude',        // 依斯鲁得
        'geffen',        // 吉芬
        'payon',         // 斐扬
        'morocc',        // 梦罗克
        'alberta',       // 艾尔贝塔
        'aldebaran',     // 艾尔帕兰
        'comodo',        // 克魔岛
        'gonryun',       // 昆仑
        'umbala',        // 汶巴拉
        'niflheim',      // 尼芙菲姆
        'louyang',       // 洛阳
        'jawaii',        // 爪哇岛
        'ayothaya',      // 阿月
        'einbroch',      // 艾因布罗克
        'lighthalzen',   // 里希塔乐
        'rachel',        // 拉赫
        'veins',         // 菲音斯
        'moscovia',      // 莫斯科比亚
        'brazil',        // 巴西
        'dewata',        // 德瓦塔
        'manuk',         // 马努克
        'splendide',     // 辉煌
        'el_castle',     // 艾尔城堡（副本小镇）
        // ---- 补充城镇（源自 UIMap GROUP_CONFIG） ----
        'yuno',          // 朱诺
        'hugel',         // 田园都市
        'xmas',          // 圣诞村
        'amatsu',        // 天津
    ]);

    // ----- 限制级别映射 -----
    // 来源：npc/re/restricted.txt
    // 级别含义：1=赛道, 3=竞技场, 4=WoE:SE, 5=封印神殿, 6=副本, 7=城镇, 8=WoE:TE, 9=波次副本
    var RESTRICTED_MAPS = {
        // 副本（级别 6）
        '1@tower': 6,        // 无限塔
        '1@orcs': 6,         // 兽人副本
        '1@nyd': 6,          // 尼德霍格
        '1@cata': 5,         // 封印神殿（级别 5）
        '2@cata': 5,
        '1@def': 9,          // 波次防守（级别 9）
        '2@def': 9,
        // 竞技场（级别 3）
        'force_1-1': 3,
        'force_1-2': 3,
        'prt_are_in': 3,
        // 赛道（级别 1）
        'alde_tt02': 1,
        'turbo_n_1': 1,
        'turbo_n_2': 1,
        // WoE 城堡（级别 4 和 8）
        'schg_cas01': 4,
        'schg_cas02': 4,
        'arug_cas01': 4,
        'teg_dun01': 8,
        'teg_dun02': 8,
    };

    // ----- 地图索引（地图名 → ID） -----
    // 来源：db/map_index.txt
    // 此处仅做示例，实际生产数据应由清洗脚本完整生成
    var MAP_INDEX = {
        'prontera': 1,
        'izlude': 2,
        'geffen': 3,
        'payon': 4,
        'morocc': 5,
        'alberta': 6,
        'aldebaran': 7,
        'comodo': 8,
        'gonryun': 9,
        'umbala': 10,
        'niflheim': 11,
        'louyang': 12,
        'jawaii': 13,
        'ayothaya': 14,
        'einbroch': 15,
        'lighthalzen': 16,
        'rachel': 17,
        'veins': 18,
        'moscovia': 19,
        'brazil': 20,
        'dewata': 21,
        'manuk': 22,
        'splendide': 23,
        'el_castle': 24,
        // 野外地图（部分）
        'prt_fild01': 101,
        'prt_fild02': 102,
        'prt_fild03': 103,
        'prt_fild04': 104,
        'prt_fild05': 105,
        'prt_fild08': 108,
        'gef_fild01': 201,
        'gef_fild02': 202,
        'pay_fild01': 301,
        'moc_fild01': 401,
        'moc_fild02': 402,
        // 地下城
        'prt_sewb1': 501,
        'prt_sewb2': 502,
        'moc_pryd1': 601,
        'pay_dun01': 701,
        'gef_dun01': 801,
    };

    // ============================================================
    //  2. 查询接口（与字典定义完全一致）
    // ============================================================

    /**
     * 获取地图的数字 ID
     * @param {string} mapName - 地图标识（如 'prontera'）
     * @returns {number} 地图 ID，若不存在则返回 -1
     */
    function getMapId(mapName) {
        if (typeof mapName !== 'string' || !mapName) return -1;
        // 优先从索引查找
        if (MAP_INDEX[mapName] !== undefined) return MAP_INDEX[mapName];
        // 降级：尝试从 MapData 中查找（若已加载）
        if (global.MapData && Array.isArray(global.MapData)) {
            for (var i = 0; i < global.MapData.length; i++) {
                if (global.MapData[i].id === mapName) {
                    // 可以缓存到 MAP_INDEX 中
                    MAP_INDEX[mapName] = global.MapData[i].id;
                    return global.MapData[i].id;
                }
            }
        }
        return -1;
    }

    /**
     * 判断地图是否为城镇（安全区）
     * @param {string} mapName - 地图标识
     * @returns {boolean}
     */
    function isTown(mapName) {
        if (typeof mapName !== 'string' || !mapName) return false;
        return TOWN_MAPS.has(mapName);
    }

    /**
     * 获取地图的限制级别
     * @param {string} mapName - 地图标识
     * @returns {number} 0=无限制，6=副本，7=城镇，其他见字典定义
     */
    function getRestrictLevel(mapName) {
        if (typeof mapName !== 'string' || !mapName) return 0;
        // 优先从限制表查找
        if (RESTRICTED_MAPS[mapName] !== undefined) {
            return RESTRICTED_MAPS[mapName];
        }
        // 如果是城镇，返回 7
        if (TOWN_MAPS.has(mapName)) {
            return 7;
        }
        return 0;
    }

    /**
     * 判断地图是否受限（非普通野外）
     * @param {string} mapName - 地图标识
     * @returns {boolean}
     */
    function isRestricted(mapName) {
        return getRestrictLevel(mapName) > 0;
    }

    /**
     * 判断地图是否为副本（记忆迷宫）
     * @param {string} mapName - 地图标识
     * @returns {boolean}
     */
    function isInstance(mapName) {
        return getRestrictLevel(mapName) === 6;
    }

    /**
     * 获取所有城镇名称列表
     * @returns {string[]}
     */
    function getTownList() {
        return Array.from(TOWN_MAPS);
    }

    // ============================================================
    //  3. 暴露到全局
    // ============================================================

    global.MapFlagData = {
        getMapId: getMapId,
        isTown: isTown,
        getRestrictLevel: getRestrictLevel,
        isRestricted: isRestricted,
        isInstance: isInstance,
        getTownList: getTownList,
        // 暴露原始数据（调试用，不建议业务代码直接修改）
        _raw: {
            TOWN_MAPS: TOWN_MAPS,
            RESTRICTED_MAPS: RESTRICTED_MAPS,
            MAP_INDEX: MAP_INDEX
        }
    };

    console.log('[MapFlagData] ✅ 已加载（' + TOWN_MAPS.size + ' 个城镇，' + Object.keys(RESTRICTED_MAPS).length + ' 个受限地图）');
})(window);