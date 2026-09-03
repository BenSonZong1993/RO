// =============================================================
//  FILE: JobGroups.js (v5.0 - 私服重构版)
//  功能：职业分组定义 - 转职树（完整重构）
//  设计原则：
//    1. 每次转生（Rebirth）解锁更深一层职业链。
//    2. 基础六系（剑/法/弓/服/商/盗）0转开放，入口在 Novice。
//    3. 超级初心者、跆拳道、枪手、忍者 1转后开放，入口在 Novice_High。
//    4. 悟灵士 2转后开放（入口在 Taekwon 的 nextJobs 中）。
//    5. 性别条件：Star_Gladiator2 / Sky_Emperor2 为女性专属；Bard / Dancer 为性别专属。
//    6. 所有职业链的终点 nextJobs 为空数组。
// =============================================================
(function(global) {
    'use strict';

    const JOB_GROUPS = {

        // =============================================================
        //  0. 初心者（所有职业的起点）
        //  0转时只能转基础六系（剑士、魔法师、弓箭手、服事、商人、盗贼）。
        // =============================================================
        'Novice': {
            id: 'Novice',
            name: '初心者',
            minRebirth: 0,
            prevJobs: [],
            nextJobs: [
                'Swordman', 'Mage', 'Archer', 'Acolyte', 'Merchant', 'Thief'
            ],
            conditions: null,
        },

        // =============================================================
        //  1. 进阶初心者（转生后初始形态）
        //  1转后开放：进阶六系 + 超级初心者 + 跆拳道 + 枪手 + 忍者。
        // =============================================================
        'Novice_High': {
            id: 'Novice_High',
            name: '进阶初心者',
            minRebirth: 1,
            prevJobs: ['Novice'],
            nextJobs: [
                'Swordman_High', 'Mage_High', 'Archer_High', 'Acolyte_High',
                'Merchant_High', 'Thief_High',
                'Super_Novice',
                'Taekwon',      // 1转后开放跆拳道
                'Gunslinger',   // 1转后开放枪手
                'Ninja'         // 1转后开放忍者
            ],
            conditions: null,
        },

        // =============================================================
        //  2. 超级初心者分支（独立于常规职业路线）
        //  入口：Novice_High → Super_Novice → Super_Novice_E → Hyper_Novice
        // =============================================================
        'Super_Novice': {
            id: 'Super_Novice',
            name: '超级初心者',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Super_Novice_E'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 45 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Super_Novice_E': {
            id: 'Super_Novice_E',
            name: '超级初心者·突破',
            minRebirth: 2,
            prevJobs: ['Super_Novice'],
            nextJobs: ['Hyper_Novice'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Hyper_Novice': {
            id: 'Hyper_Novice',
            name: '终极初心者',
            minRebirth: 3,
            prevJobs: ['Super_Novice_E'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // =============================================================
        //  3. 剑士系
        //  链条：Swordman → Knight → Lord_Knight → Rune_Knight → Dragon_Knight
        //  0转开放，最终四转终点（minRebirth: 3）。
        // =============================================================
        'Swordman': {
            id: 'Swordman',
            name: '剑士',
            minRebirth: 0,
            prevJobs: ['Novice'],
            nextJobs: ['Knight', 'Crusader'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Knight': {
            id: 'Knight',
            name: '骑士',
            minRebirth: 0,
            prevJobs: ['Swordman'],
            nextJobs: ['Lord_Knight'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Lord_Knight': {
            id: 'Lord_Knight',
            name: '骑士领主',
            minRebirth: 1,
            prevJobs: ['Knight', 'Swordman_High'],
            nextJobs: ['Rune_Knight'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Rune_Knight': {
            id: 'Rune_Knight',
            name: '符文骑士',
            minRebirth: 2,
            prevJobs: ['Lord_Knight'],
            nextJobs: ['Dragon_Knight'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Dragon_Knight': {
            id: 'Dragon_Knight',
            name: '龙骑士',
            minRebirth: 3,
            prevJobs: ['Rune_Knight'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Crusader': {
            id: 'Crusader',
            name: '十字军',
            minRebirth: 0,
            prevJobs: ['Swordman'],
            nextJobs: ['Paladin'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Paladin': {
            id: 'Paladin',
            name: '圣殿十字军',
            minRebirth: 1,
            prevJobs: ['Crusader', 'Swordman_High'],
            nextJobs: ['Royal_Guard'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Royal_Guard': {
            id: 'Royal_Guard',
            name: '皇家卫士',
            minRebirth: 2,
            prevJobs: ['Paladin'],
            nextJobs: ['Imperial_Guard'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Imperial_Guard': {
            id: 'Imperial_Guard',
            name: '帝国卫士',
            minRebirth: 3,
            prevJobs: ['Royal_Guard'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 转生后剑士入口 ----------
        'Swordman_High': {
            id: 'Swordman_High',
            name: '剑士（转生）',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Lord_Knight', 'Paladin'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // =============================================================
        //  4. 魔法师系
        //  链条：Mage → Wizard → High_Wizard → Warlock → Arch_Mage
        // =============================================================
        'Mage': {
            id: 'Mage',
            name: '魔法师',
            minRebirth: 0,
            prevJobs: ['Novice'],
            nextJobs: ['Wizard', 'Sage'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Wizard': {
            id: 'Wizard',
            name: '巫师',
            minRebirth: 0,
            prevJobs: ['Mage'],
            nextJobs: ['High_Wizard'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'High_Wizard': {
            id: 'High_Wizard',
            name: '超魔导士',
            minRebirth: 1,
            prevJobs: ['Wizard', 'Mage_High'],
            nextJobs: ['Warlock'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Warlock': {
            id: 'Warlock',
            name: '大法师',
            minRebirth: 2,
            prevJobs: ['High_Wizard'],
            nextJobs: ['Arch_Mage'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Arch_Mage': {
            id: 'Arch_Mage',
            name: '梦幻法师',
            minRebirth: 3,
            prevJobs: ['Warlock'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Mage_High': {
            id: 'Mage_High',
            name: '魔法师（转生）',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['High_Wizard'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // ---------- 魔法师系·贤者分支 ----------
        'Sage': {
            id: 'Sage',
            name: '贤者',
            minRebirth: 0,
            prevJobs: ['Mage'],
            nextJobs: ['Professor'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Professor': {
            id: 'Professor',
            name: '智者',
            minRebirth: 1,
            prevJobs: ['Sage'],
            nextJobs: ['Sorcerer'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Sorcerer': {
            id: 'Sorcerer',
            name: '元素使',
            minRebirth: 2,
            prevJobs: ['Professor'],
            nextJobs: ['Elemental_Master'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Elemental_Master': {
            id: 'Elemental_Master',
            name: '元素领主',
            minRebirth: 3,
            prevJobs: ['Sorcerer'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // =============================================================
        //  5. 弓箭手系
        //  链条：Archer → Hunter → Sniper → Ranger → Windhawk
        // =============================================================
        'Archer': {
            id: 'Archer',
            name: '弓箭手',
            minRebirth: 0,
            prevJobs: ['Novice'],
            nextJobs: ['Hunter', 'Bard', 'Dancer'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Hunter': {
            id: 'Hunter',
            name: '猎人',
            minRebirth: 0,
            prevJobs: ['Archer'],
            nextJobs: ['Sniper'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Sniper': {
            id: 'Sniper',
            name: '神射手',
            minRebirth: 1,
            prevJobs: ['Hunter', 'Archer_High'],
            nextJobs: ['Ranger'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Ranger': {
            id: 'Ranger',
            name: '游侠',
            minRebirth: 2,
            prevJobs: ['Sniper'],
            nextJobs: ['Windhawk'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Windhawk': {
            id: 'Windhawk',
            name: '风鹰',
            minRebirth: 3,
            prevJobs: ['Ranger'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 弓箭手·男性分支：诗人 ----------
        'Bard': {
            id: 'Bard',
            name: '诗人',
            minRebirth: 0,
            gender: 'male',   // 仅限男性
            prevJobs: ['Archer'],
            nextJobs: ['Clown'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Clown': {
            id: 'Clown',
            name: '搞笑艺人',
            minRebirth: 1,
            gender: 'male',   // 仅限男性
            prevJobs: ['Bard', 'Archer_High'],
            nextJobs: ['Minstrel'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Minstrel': {
            id: 'Minstrel',
            name: '宫廷乐师',
            minRebirth: 2,
            gender: 'male',   // 仅限男性
            prevJobs: ['Clown'],
            nextJobs: ['Troubadour'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Troubadour': {
            id: 'Troubadour',
            name: '传音颂者',
            minRebirth: 3,
            gender: 'male',   // 仅限男性
            prevJobs: ['Minstrel'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 弓箭手·女性分支：舞娘 ----------
        'Dancer': {
            id: 'Dancer',
            name: '舞娘',
            minRebirth: 0,
            gender: 'female', // 仅限女性
            prevJobs: ['Archer'],
            nextJobs: ['Gypsy'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Gypsy': {
            id: 'Gypsy',
            name: '吉普赛',
            minRebirth: 1,
            gender: 'female', // 仅限女性
            prevJobs: ['Dancer', 'Archer_High'],
            nextJobs: ['Wanderer'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Wanderer': {
            id: 'Wanderer',
            name: '漫游舞者',
            minRebirth: 2,
            gender: 'female', // 仅限女性
            prevJobs: ['Gypsy'],
            nextJobs: ['Trouvere'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Trouvere': {
            id: 'Trouvere',
            name: '神话歌姬',
            minRebirth: 3,
            gender: 'female', // 仅限女性
            prevJobs: ['Wanderer'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 转生后弓箭手入口 ----------
        'Archer_High': {
            id: 'Archer_High',
            name: '弓箭手（转生）',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Sniper', 'Clown', 'Gypsy'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // =============================================================
        //  6. 服事系
        //  链条：Acolyte → Priest → High_Priest → Arch_Bishop → Cardinal
        // =============================================================
        'Acolyte': {
            id: 'Acolyte',
            name: '服事',
            minRebirth: 0,
            prevJobs: ['Novice'],
            nextJobs: ['Priest', 'Monk'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Priest': {
            id: 'Priest',
            name: '牧师',
            minRebirth: 0,
            prevJobs: ['Acolyte'],
            nextJobs: ['High_Priest'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'High_Priest': {
            id: 'High_Priest',
            name: '大主教（进阶）',
            minRebirth: 1,
            prevJobs: ['Priest', 'Acolyte_High'],
            nextJobs: ['Arch_Bishop'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Arch_Bishop': {
            id: 'Arch_Bishop',
            name: '大主教',
            minRebirth: 2,
            prevJobs: ['High_Priest'],
            nextJobs: ['Cardinal'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Cardinal': {
            id: 'Cardinal',
            name: '枢机主教',
            minRebirth: 3,
            prevJobs: ['Arch_Bishop'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Monk': {
            id: 'Monk',
            name: '武僧',
            minRebirth: 0,
            prevJobs: ['Acolyte'],
            nextJobs: ['Champion'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Champion': {
            id: 'Champion',
            name: '圣骑士（进阶）',
            minRebirth: 1,
            prevJobs: ['Monk', 'Acolyte_High'],
            nextJobs: ['Sura'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Sura': {
            id: 'Sura',
            name: '修罗',
            minRebirth: 2,
            prevJobs: ['Champion'],
            nextJobs: ['Inquisitor'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Inquisitor': {
            id: 'Inquisitor',
            name: '圣裁者',
            minRebirth: 3,
            prevJobs: ['Sura'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Acolyte_High': {
            id: 'Acolyte_High',
            name: '服事（转生）',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['High_Priest', 'Champion'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // =============================================================
        //  7. 商人系
        //  链条：Merchant → Blacksmith → Whitesmith → Mechanic → Meister
        // =============================================================
        'Merchant': {
            id: 'Merchant',
            name: '商人',
            minRebirth: 0,
            prevJobs: ['Novice'],
            nextJobs: ['Blacksmith', 'Alchemist'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Blacksmith': {
            id: 'Blacksmith',
            name: '铁匠',
            minRebirth: 0,
            prevJobs: ['Merchant'],
            nextJobs: ['Whitesmith'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Whitesmith': {
            id: 'Whitesmith',
            name: '神工匠',
            minRebirth: 1,
            prevJobs: ['Blacksmith', 'Merchant_High'],
            nextJobs: ['Mechanic'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Mechanic': {
            id: 'Mechanic',
            name: '机匠',
            minRebirth: 2,
            prevJobs: ['Whitesmith'],
            nextJobs: ['Meister'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Meister': {
            id: 'Meister',
            name: '机械大师',
            minRebirth: 3,
            prevJobs: ['Mechanic'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Alchemist': {
            id: 'Alchemist',
            name: '炼金术师',
            minRebirth: 0,
            prevJobs: ['Merchant'],
            nextJobs: ['Creator'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Creator': {
            id: 'Creator',
            name: '创造者',
            minRebirth: 1,
            prevJobs: ['Alchemist', 'Merchant_High'],
            nextJobs: ['Genetic'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Genetic': {
            id: 'Genetic',
            name: '基因学者',
            minRebirth: 2,
            prevJobs: ['Creator'],
            nextJobs: ['Biolo'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Biolo': {
            id: 'Biolo',
            name: '生物学家',
            minRebirth: 3,
            prevJobs: ['Genetic'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Merchant_High': {
            id: 'Merchant_High',
            name: '商人（转生）',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Whitesmith', 'Creator'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // =============================================================
        //  8. 盗贼系
        //  链条：Thief → Assassin → Assassin_Cross → Guillotine_Cross → Shadow_Cross
        // =============================================================
        'Thief': {
            id: 'Thief',
            name: '盗贼',
            minRebirth: 0,
            prevJobs: ['Novice'],
            nextJobs: ['Assassin', 'Rogue'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Assassin': {
            id: 'Assassin',
            name: '刺客',
            minRebirth: 0,
            prevJobs: ['Thief'],
            nextJobs: ['Assassin_Cross'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Assassin_Cross': {
            id: 'Assassin_Cross',
            name: '十字刺客',
            minRebirth: 1,
            prevJobs: ['Assassin', 'Thief_High'],
            nextJobs: ['Guillotine_Cross'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Guillotine_Cross': {
            id: 'Guillotine_Cross',
            name: '十字切割者',
            minRebirth: 2,
            prevJobs: ['Assassin_Cross'],
            nextJobs: ['Shadow_Cross'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Shadow_Cross': {
            id: 'Shadow_Cross',
            name: '十字影刃',
            minRebirth: 3,
            prevJobs: ['Guillotine_Cross'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Rogue': {
            id: 'Rogue',
            name: '流氓',
            minRebirth: 0,
            prevJobs: ['Thief'],
            nextJobs: ['Stalker'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Stalker': {
            id: 'Stalker',
            name: '神行太保',
            minRebirth: 1,
            prevJobs: ['Rogue', 'Thief_High'],
            nextJobs: ['Shadow_Chaser'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Shadow_Chaser': {
            id: 'Shadow_Chaser',
            name: '逐影',
            minRebirth: 2,
            prevJobs: ['Stalker'],
            nextJobs: ['Abyss_Chaser'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Abyss_Chaser': {
            id: 'Abyss_Chaser',
            name: '深渊行者',
            minRebirth: 3,
            prevJobs: ['Shadow_Chaser'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Thief_High': {
            id: 'Thief_High',
            name: '盗贼（转生）',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Assassin_Cross', 'Stalker'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // =============================================================
        //  9. 扩充系（1转后开放）
        //  包括：跆拳道 → 拳圣（男女分支） → 天帝（男女分支）
        //        枪手 → 反抗者 → 夜巡者
        //        忍者 → 隐忍/魂灵 → 隐忍·四转/魂灵·四转
        // =============================================================

        // ---------- 跆拳道分支 ----------
        'Taekwon': {
            id: 'Taekwon',
            name: '跆拳道',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Star_Gladiator', 'Star_Gladiator2'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        // 男性拳圣（默认分支）
        'Star_Gladiator': {
            id: 'Star_Gladiator',
            name: '拳圣',
            minRebirth: 1,
            gender: 'male',     // 男性专属
            prevJobs: ['Taekwon'],
            nextJobs: ['Sky_Emperor'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        // 女性拳圣（特殊分支）
        'Star_Gladiator2': {
            id: 'Star_Gladiator2',
            name: '拳圣（女性）',
            minRebirth: 1,
            gender: 'female',   // 女性专属
            prevJobs: ['Taekwon'],
            nextJobs: ['Sky_Emperor2'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        // 男性天帝（终点）
        'Sky_Emperor': {
            id: 'Sky_Emperor',
            name: '天帝',
            minRebirth: 3,
            gender: 'male',     // 男性专属
            prevJobs: ['Star_Gladiator'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // 女性天帝（终点）
        'Sky_Emperor2': {
            id: 'Sky_Emperor2',
            name: '天帝（女性）',
            minRebirth: 3,
            gender: 'female',   // 女性专属
            prevJobs: ['Star_Gladiator2'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 枪手分支 ----------
        'Gunslinger': {
            id: 'Gunslinger',
            name: '枪手',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Rebellion'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Rebellion': {
            id: 'Rebellion',
            name: '反抗者',
            minRebirth: 2,
            prevJobs: ['Gunslinger'],
            nextJobs: ['Night_Watch'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Night_Watch': {
            id: 'Night_Watch',
            name: '夜巡者',
            minRebirth: 3,
            prevJobs: ['Rebellion'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 忍者分支 ----------
        'Ninja': {
            id: 'Ninja',
            name: '忍者',
            minRebirth: 1,
            prevJobs: ['Novice_High'],
            nextJobs: ['Kagerou', 'Oboro'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Kagerou': {
            id: 'Kagerou',
            name: '影狼',
            minRebirth: 2,
            prevJobs: ['Ninja'],
            nextJobs: ['Shinkiro'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Oboro': {
            id: 'Oboro',
            name: '胧',
            minRebirth: 2,
            prevJobs: ['Ninja'],
            nextJobs: ['Shiranui'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Shinkiro': {
            id: 'Shinkiro',
            name: '流浪忍者',
            minRebirth: 3,
            prevJobs: ['Kagerou'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        'Shiranui': {
            id: 'Shiranui',
            name: '疾风忍者',
            minRebirth: 3,
            prevJobs: ['Oboro'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 悟灵士分支（2转后开放） ----------
        // 注意：Soul_Linker 的入口在 Taekwon 的 nextJobs 中，
        // 但它的 minRebirth: 2，所以玩家必须至少 2 转后才能从 Taekwon 转入。
        'Soul_Linker': {
            id: 'Soul_Linker',
            name: '悟灵士',
            minRebirth: 2,
            prevJobs: ['Taekwon'],
            nextJobs: ['Soul_Reaper', 'Soul_Ascetic'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 40 },
                ],
            },
        },

        'Soul_Reaper': {
            id: 'Soul_Reaper',
            name: '猎灵士',
            minRebirth: 2,
            prevJobs: ['Soul_Linker'],
            nextJobs: ['Spirit_Handler'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 99 },
                    { type: 'jobLevel', value: 50 },
                ],
            },
        },

        'Soul_Ascetic': {
            id: 'Soul_Ascetic',
            name: '契灵士',
            minRebirth: 3,
            prevJobs: ['Soul_Linker'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },

        // ---------- 召唤师分支（2转后开放） ----------
        // 注意：Soul_Linker 的入口在 Taekwon 的 nextJobs 中，
        // 但它的 minRebirth: 2，所以玩家必须至少 2 转后才能从 Taekwon 转入。
        'Summoner': {
            id: 'Summoner',
            name: '召唤师',
            minRebirth: 2,
            prevJobs: [],
            nextJobs: ['Spirit_Handler'],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 1 },
                    { type: 'jobLevel', value: 10 },
                ],
            },
        },

        'Spirit_Handler': {
            id: 'Spirit_Handler',
            name: '魂灵师（四转）',
            minRebirth: 3,
            prevJobs: ['Summoner'],
            nextJobs: [],
            conditions: {
                type: 'and',
                rules: [
                    { type: 'level', value: 200 },
                    { type: 'jobLevel', value: 70 },
                ],
            },
        },


// =============================================================
//  10. 官方数据合并键（用于装备/卡片职业限制显示）
//  这些键出现在 ItemData 的 Jobs 字段中，代表多个职业的复合限制。
// =============================================================

'SuperNovice': {
    id: 'SuperNovice',
    name: '超级初心者',
},

'BardDancer': {
    id: 'BardDancer',
    name: '诗人/舞娘',
},

'KagerouOboro': {
    id: 'KagerouOboro',
    name: '影狼/胧',
},

'SoulLinker': {
    id: 'SoulLinker',
    name: '悟灵士',
},

// 常见遗漏
'StarGladiator': {
    id: 'StarGladiator',
    name: '拳圣',
}


    };  // ← 修正：闭合 JOB_GROUPS 对象

    // =============================================================
    //  暴露全局
    // =============================================================
    global.JobGroups = JOB_GROUPS;
    console.log(`[JobGroups] ✅ 已加载 ${Object.keys(JOB_GROUPS).length} 个职业分组（私服重构版 v5.0）`);
})(window);