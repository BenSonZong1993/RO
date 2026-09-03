// ================================================================
//  📁 js/config/MapGroups.js
//  职责：战场调度层（地图 → 模式名映射）
//  维护：策划
//  说明：只存地图列表、所属模式名称、地域倍率，不存任何刷怪数值
// ================================================================

(function(global) {
    'use strict';

    // ================================================================
    //  地图分组定义
    //  每个组包含：
    //    - mapIds：属于该组的地图ID列表
    //    - mode：指向 ConfigProfiles 中的模式名称（如 'default', 'nightmare'）
    //    - expMultiplier：该组地图的经验倍率
    //    - spawnMultiplier：该组地图的怪物数量倍率（影响全刷模式，波次模式仅用于权重）
    // ================================================================
    var MAP_GROUPS = {

        // ---- 新手区域 ----
        'newbie': {
            mapIds: [
                'prt_fild02', 'prt_fild03',
                'gef_fild01', 'gef_fild02',
                'pay_fild01', 'pay_fild02',
                'moc_fild01',
            ],
            mode: 'default',           // 使用 ConfigProfiles 中的 'default' 模式
            expMultiplier: 1.0,
            spawnMultiplier: 1.0,
        },

        // ---- 中级区域 ----
        'intermediate': {
            mapIds: [
                'moc_fild02', 'moc_fild03',
                'pay_fild03', 'pay_fild04',
                'gef_fild03', 'gef_fild04',
                'prt_fild04', 'prt_fild05',
            ],
            mode: 'default',
            expMultiplier: 1.3,
            spawnMultiplier: 1.2,
        },

        // ---- 高级区域 ----
        'advanced': {
            mapIds: [
                'gon_fild01',
                'yuno_fild01', 'yuno_fild02',
                'ein_fild01',
                'ra_fild01', 'ra_fild02',
            ],
            mode: 'event_dungeon',     // 高级地图使用活动副本模式（快速波次）
            expMultiplier: 1.6,
            spawnMultiplier: 1.4,
        },

        // ---- 地下城（高难度） ----
        'dungeon': {
            mapIds: [
                'prt_sewb1', 'prt_sewb2', 'prt_sewb3', 'prt_sewb4',
                'moc_pryd1', 'moc_pryd2', 'moc_pryd3', 'moc_pryd4', 'moc_pryd5', 'moc_pryd6',
                'pay_dun01', 'pay_dun02', 'pay_dun03',
                'gef_dun01', 'gef_dun02',
                'glast_01', 'glast_02',
            ],
            mode: 'nightmare',         // 地下城使用噩梦模式
            expMultiplier: 2.0,
            spawnMultiplier: 1.6,
        },

        // ---- 沙漠区域（地形特色） ----
        'desert': {
            mapIds: [
                'moc_fild01', 'moc_fild02', 'moc_fild03',
                'moc_pryd1', 'moc_pryd2', 'moc_pryd3', 'moc_pryd4', 'moc_pryd5', 'moc_pryd6',
            ],
            mode: 'default',
            expMultiplier: 1.1,
            spawnMultiplier: 1.1,
        },

        // ---- 默认组（兜底） ----
        // 所有未在上述 mapIds 中列出的地图，自动归入此组。
        'default': {
            mapIds: [],                // 空列表，由 MapService 自动填充未分组的地图
            mode: 'default',
            expMultiplier: 1.0,
            spawnMultiplier: 1.0,
        },
    };

    // ================================================================
    //  城镇配置（仅用于 UI 显示，不影响刷怪）
    //  保留原样，未改动。
    // ================================================================
    var TOWN_MAP_CONFIG = {
        'prontera':  { chineseName: '普隆德拉', enabled: true },
        'izlude':    { chineseName: '依斯鲁得', enabled: true },
        'geffen':    { chineseName: '吉芬',     enabled: true },
        'payon':     { chineseName: '斐扬',     enabled: true },
        'morocc':    { chineseName: '梦罗克',   enabled: true },
        'aldebaran': { chineseName: '艾尔帕兰', enabled: true },
        // 其他城镇默认隐藏，可手动取消注释启用
    };

    // ================================================================
    //  暴露到全局
    // ================================================================
    global.MapGroups = MAP_GROUPS;
    global.TownMapConfig = TOWN_MAP_CONFIG;

    console.log('[MapGroups] ✅ 已加载 ' + Object.keys(MAP_GROUPS).length + ' 个分组（纯映射，无刷怪数值）');
})(window);



    // ---- 暂不开放（22 座，注释即隐藏；开放时取消注释并设 enabled: true） ----
    // 'alberta':     { chineseName: '艾尔贝塔',   enabled: false },
    // 'comodo':      { chineseName: '克魔岛',     enabled: false },
    // 'gonryun':     { chineseName: '昆仑',       enabled: false },
    // 'umbala':      { chineseName: '汶巴拉',     enabled: false },
    // 'niflheim':    { chineseName: '尼芙菲姆',   enabled: false },
    // 'louyang':     { chineseName: '洛阳',       enabled: false },
    // 'jawaii':      { chineseName: '爪哇岛',     enabled: false },
    // 'ayothaya':    { chineseName: '阿育塔雅',   enabled: false },
    // 'einbroch':    { chineseName: '艾因布罗克', enabled: false },
    // 'lighthalzen': { chineseName: '里希塔乐',   enabled: false },
    // 'rachel':      { chineseName: '拉赫',       enabled: false },
    // 'veins':       { chineseName: '菲音斯',     enabled: false },
    // 'moscovia':    { chineseName: '莫斯科比亚', enabled: false },
    // 'brazil':      { chineseName: '巴西',       enabled: false },
    // 'dewata':      { chineseName: '德瓦塔',     enabled: false },
    // 'manuk':       { chineseName: '马努克',     enabled: false },
    // 'splendide':   { chineseName: '辉煌',       enabled: false },
    // 'el_castle':   { chineseName: '艾尔城堡',   enabled: false },
    // 'yuno':        { chineseName: '朱诺',       enabled: false },
    // 'hugel':       { chineseName: '休格',       enabled: false },
    // 'xmas':        { chineseName: '圣诞村',     enabled: false },
    // 'amatsu':      { chineseName: '天津',       enabled: false },
