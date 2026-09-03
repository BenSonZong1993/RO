// ============================================================
//  📁 js/config/UIConfig.js
//  功能：全局用户界面与视觉表现配置中心（完整嵌套版）
//  说明：所有“看起来怎么样”的参数在此集中管理
//  涵盖：特效飘字、画布渲染、战斗统计面板等
//  维护：策划/美术可在此调整颜色、动画速度、刷新频率等
//  ============================================================
//  ═════════════════════════════════════════════════════════════
//  【配表字段说明】（图形化工具可解析此注释区块）
//  ═════════════════════════════════════════════════════════════
//  ┌──────────────────────────────────────────────────────────────┐
//  │ 一级节点         二级节点         类型    说明              │
//  ├──────────────────────────────────────────────────────────────┤
//  │ effects          damageNumbers    object  伤害数字特效参数  │
//  │                  expNumbers       object  经验飘字参数      │
//  │                  lootTexts        object  掉落拾取文字      │
//  │                  skillNames       object  技能名称飘字      │
//  │                  interruptTexts   object  打断文字特效      │
//  │ render.PLAYER    radius           number  玩家绘制半径(px)  │
//  │                  bodyGrad         object  身体渐变          │
//  │                  headGrad         object  头部渐变          │
//  │                  visualScale      number  玩家视觉放大倍数  │
//  │                  barWidth/Height  number  血条尺寸          │
//  │ render.MONSTER   radius           number  怪物绘制半径(px)  │
//  │                  eyeOffsetX/Y     number  眼睛偏移          │
//  │                  barWidth/Height  number  血条尺寸          │
//  │ render.SKILL_BAR width/height    number  技能条尺寸        │
//  │                  castVariableColor string 变咏颜色          │
//  │                  castFixedColor   string  固咏颜色          │
//  │                  cooldownColor    string  冷却颜色          │
//  │ panels.battleStats refreshInterval number  统计刷新间隔(秒) │
//  └──────────────────────────────────────────────────────────────┘
//  ============================================================

(function(global) {
    'use strict';

    // ---------- 核心配表 ----------
    var UI_CONFIG = {

        // ============================================================
        //  1. 战斗特效（飘字/伤害数字）
        //  作用：控制战斗时各种飘字特效的视觉表现
        //  说明：所有时间单位均为“秒”，位移单位为“像素”
        // ============================================================
        effects: {

            // ----- 1.1 伤害数字 -----
            // 功能：怪物/玩家受到伤害时跳出的数字动画
            damageNumbers: {
                lifetime: 1.0,                    // 数字存活总时长（秒），控制淡出时机
                riseSpeed: 150,                   // 数字向上飘动速度（像素/秒）
                fadeStartRatio: 0.4,              // 开始淡出的时间点（占 lifetime 比例，0.4 表示 40% 处开始淡出）
                fontSize: 54,                     // 字体大小（像素）
                font: 'bold 54px monospace',      // 字体样式，需与 fontSize 匹配
                strokeWidth: 3,                   // 文字描边宽度（像素），用于增强可读性
                strokeColor: '#000000',           // 描边颜色，黑色描边使文字在任何背景都清晰
                critColor: '#ffaa00',             // 暴击伤害数字颜色（金黄色）
                normalColor: '#ffffff',           // 普通伤害数字颜色（白色）
                shadowBlur: 12,                   // 阴影模糊程度（像素），0 为无阴影
            },

            // ----- 1.2 经验飘字 -----
            // 功能：获得经验值时在屏幕右侧显示的经验信息（包含基础经验与职业加成）
            expNumbers: {
                riseDuration: 2.2,                // 经验文字上升动画总时长（秒）
                riseDistance: 130,                // 上升总高度（像素）
                maxCount: 5,                      // 同时显示的经验飘字最大数量（超出后旧的立即消失）
                fadeStartRatio: 0.55,             // 开始淡出的时间点（占 riseDuration 比例）
                baseOffsetX: 150,                 // 基础 X 轴偏移（从屏幕右边缘往左，正值向左）
                baseOffsetY: -30,                 // 基础 Y 轴偏移（从屏幕顶部往下，负值向上）
                randomOffsetX: 128,                // X 轴随机偏移范围（在 baseOffsetX 基础上上下浮动）
                randomOffsetY: 64,                // Y 轴随机偏移范围
                spacing: 55,                      // 多条经验飘字之间的垂直间距（像素）
                fontSize: 36,                     // 字体大小
                padding: 8,                       // 文字背景框内边距（像素）
                lineHeightRatio: 1.3,             // 行高比例（相对于字体大小）
                boxBgAlpha: 0.7,                  // 背景框不透明度（0-1，0 完全透明，1 完全不透明）
                boxRadius: 6,                     // 背景框圆角半径（像素）
                baseColor: '#FFD700',             // 基础经验文字颜色（金色）
                jobColor: '#87CEEB',              // 职业加成经验文字颜色（天蓝色）
                positionX: 0.85,                  // X 轴初始位置（屏幕宽度比例，0.85 表示右侧 85% 处）
                shadowBlur: 10,                   // 阴影模糊程度
            },

            // ----- 1.3 掉落拾取文字 -----
            // 功能：拾取掉落物时显示的物品名称提示
            lootTexts: {
                riseDuration: 2.8,                // 上升动画总时长（秒）
                riseDistance: 110,                // 上升总高度（像素）
                maxCount: 4,                      // 同时显示的最大数量
                fadeStartRatio: 0.45,             // 开始淡出的时间点（占 riseDuration 比例）
                baseOffsetX: 160,                 // 基础 X 偏移（从屏幕左边缘往右？实际由 positionX 决定，此为微调值）
                baseOffsetY: 70,                  // 基础 Y 偏移（从屏幕顶部向下）
                randomOffsetX: 64,                // X 随机偏移
                randomOffsetY: 32,                // Y 随机偏移
                spacing: 55,                      // 多条物品提示间的垂直间距
                font: 'bold 28px monospace',      // 字体样式
                bgAlpha: 0.5,                     // 背景透明度
                borderColor: '#FFD700',           // 背景边框颜色
                textColor: '#FFD700',             // 文字颜色
                shadowBlur: 8,                    // 阴影模糊
                padding: 10,                      // 内边距
                height: 42,                       // 单条提示框高度（像素）
                positionX: 0.6,                   // X 初始位置（屏幕宽度比例，0.6 表示中间偏左）
                positionY: 0.4,                   // Y 初始位置（屏幕高度比例，0.4 表示中部偏上）
            },

            // ----- 1.4 技能名称飘字 -----
            // 功能：使用技能时在角色头顶显示技能名称
            skillNames: {
                duration: 1.2,                    // 显示总时长（秒）
                riseSpeed: 80,                    // 上升速度（像素/秒）
                fontSize: 32,                     // 字体大小
                font: 'bold 32px Arial, sans-serif', // 字体样式
                color: '#FFFFFF',                 // 文字颜色（白色）
                shadowBlur: 10,                   // 阴影模糊
            },

            // ----- 1.5 打断文字 -----
            // 功能：技能被成功打断时显示的警告文字
            interruptTexts: {
                duration: 1.5,                    // 显示总时长（秒）
                riseSpeed: 120,                   // 上升速度（像素/秒）
                fontSize: 40,                     // 字体大小（较大，醒目）
                font: 'bold 40px Arial, sans-serif', // 字体样式
                color: '#FF0000',                 // 文字颜色（红色）
                shadowBlur: 12,                   // 阴影模糊
                shadowColor: 'rgba(0,0,0,0.9)',   // 阴影颜色（深黑色）
            },
        },

        // ============================================================
        //  2. 画布渲染（CanvasRenderer）—— 嵌套结构与 DEFAULT_CONFIG 对齐
        //  功能：定义游戏中各类实体（玩家、怪物、队友等）的绘制参数
        //  注意：此部分与 CanvasRenderer 内部默认配置保持一致，修改后需测试渲染效果
        // ============================================================
        render: {

            // ---- 玩家外观 ----
            // 描述：玩家角色在地图上的视觉表现（圆形身体 + 头部 + 武器）
            PLAYER: {
                radius: 24,                       // 玩家身体半径（像素），也是整体缩放基准
                bodyGrad: {                       // 身体渐变颜色（从亮到暗模拟立体感）
                    light: '#4B8DF1',             // 渐变亮色（浅蓝）
                    mid: '#3B82F6',               // 渐变中间色（标准蓝）
                    dark: '#3171EC',              // 渐变暗色（深蓝）
                },
                headGrad: {                       // 头部渐变颜色
                    light: '#F2FFF2',             // 亮色（极浅绿，接近白）
                    mid: '#F8F8F8',               // 中间色（极浅灰）
                    dark: '#F0F0F0',              // 暗色（浅灰）
                },
                weaponLengthRatio: 1.2,           // 武器长度与身体半径的比例（1.2 表示武器长度为半径的 1.2 倍）
                weaponAngleDeg: 30,               // 武器默认倾斜角度（度，0 为水平向右）
                weaponLineWidth: 4,               // 武器线条宽度（像素）
                weaponColor: '#FFFFFF',           // 武器颜色（白色）
                shadowAlpha: 0.3,                 // 角色投影的不透明度（0-1）
                barWidth: 54,                     // 玩家头顶血条宽度（像素）
                barHeight: 10,                    // 玩家头顶血条高度（像素）
                barYOffset: 37,                   // 血条相对角色中心的垂直偏移（向下为正）
                visualScale: 0.95,                 // 整体视觉缩放系数（0.9 表示缩小 10%）
            },

            // ---- 性别人形模板（玩家与队友佣兵共用；男=默认蓝 24px，女=红粉 22px 略小） ----
            GENDER: {
                male: {                           // 男性角色模板
                    radius: 24,                   // 身体半径
                    bodyGrad: {                   // 身体渐变（蓝色系）
                        light: '#4B8DF1',
                        mid: '#3B82F6',
                        dark: '#3171EC',
                    },
                },
                female: {                         // 女性角色模板
                    radius: 22,                   // 身体半径（比男性稍小）
                    bodyGrad: {                   // 身体渐变（粉红色系）
                        light: '#F2A2BA',
                        mid: '#E56A90',
                        dark: '#C94F79',
                    },
                },
            },

            // ---- 队友佣兵外观（复用 GENDER 人形模板；行为/站位配置见 ConfigProfiles.PartnerConfig） ----
            PARTNER: {
                allyRingColor: 'rgba(120,220,150,0.85)',   // 友军描边颜色（绿色半透明，用于区分敌我）
                nameTagColor: '#eafff0',                   // 队友名字标签颜色（浅绿色）
                barWidth: 64,                              // 队友血条宽度（像素）
                barHeight: 8,                              // 队友血条高度（像素）
            },

            // ---- 怪物外观 ----
            // 描述：怪物在地图上的视觉表现（圆形身体 + 眼睛 + 血条）
            MONSTER: {
                radius: 24,                       // 怪物身体半径（像素），与玩家相同保证视觉平衡
                eyeOffsetX: 0.35,                 // 眼睛水平偏移比例（相对于半径，0.35 表示位于右前方）
                eyeOffsetY: -0.2,                 // 眼睛垂直偏移比例（负值向上）
                eyeRadiusRatio: 0.08,             // 眼睛半径与身体半径的比例（0.08 即 8%）
                barWidth: 64,                     // 怪物头顶血条宽度（像素）
                barHeight: 10,                    // 怪物头顶血条高度（像素）
                barYOffset: 18,                   // 血条相对怪物中心的垂直偏移（向下为正）
                hpTextFont: 'bold 16px Arial, sans-serif',   // HP 数值文字字体
                nameTextFont: 'bold 18px Arial, sans-serif', // 怪物名称文字字体
                shadowAlpha: 0.3,                 // 怪物投影不透明度
                hpTextColor: '#FFFFFF',           // HP 数值文字颜色（白色）
                nameTextColor: '#FFD700',         // 怪物名称文字颜色（金色）
            },

            // ---- 地形 ----
            TERRAIN: {
                tileSize: RO_CONSTANTS.TILE_BASE_SIZE, // 每个地图瓦片的尺寸（像素），引用全局常量
                seed: 42,                         // 随机地形生成种子（固定值保证地图可复现）
                useExternalTerrain: true,         // 是否使用外部加载的地形数据（true 则忽略 seed）
            },

            // ---- 技能状态条 ----
            // 功能：显示在角色下方的技能施法/冷却状态条
            SKILL_BAR: {
                width: 180,                       // 技能条整体宽度（像素）
                height: 28,                       // 单个状态条高度（像素）
                yOffset: 144,                      // 技能条相对于角色中心的垂直偏移（向下为正）
                extraYOffset: 5,                  // 多条状态条之间的额外垂直间距
                fontSize: 18,                     // 状态条内文字字体大小
                cornerRadius: 8,                  // 状态条圆角半径（像素）
                bgAlpha: 0.75,                    // 状态条背景不透明度（0-1）
                castVariableColor: '#FF8C00',     // 变咏（可变咏唱）状态条颜色（橙色）
                castFixedColor: '#FFD700',        // 固咏（固定咏唱）状态条颜色（金色）
                cooldownColor: '#FF3333',         // 冷却状态条颜色（红色）
                gcdColor: '#4A90D9',              // 公共冷却（GCD）状态条颜色（蓝色）
                textColor: '#FFFFFF',             // 状态条内文字颜色（白色）
                textShadow: 'rgba(0,0,0,0.9)',    // 状态条内文字阴影颜色
                padding: 4,                       // 状态条内边距（像素）
                gap: 6,                          // 不同状态条之间的水平间距（像素）
                labelFontSizeRatio: 0.7,          // 标签文字大小与主文字大小的比例
                showLabelOnBar: false,            // 是否在状态条上直接显示标签文字（如“变咏”“冷却”）
                labels: {                         // 各状态条对应的标签文字（当 showLabelOnBar 为 true 时生效）
                    castVariable: '变咏',
                    castFixed: '固咏',
                    cooldown: '冷却',
                    gcd: '共延',
                },
                gcd: {                            // GCD 状态条的额外配置（覆盖通用配置）
                    color: '#4A90D9',             // GCD 状态条颜色（同 gcdColor，此处独立便于微调）
                    // 可添加 height, width 等覆盖通用配置
                }
            },

            // ---- HUD（玩家头顶状态） ----
            // 功能：玩家头顶显示的名称、HP/SP 条等
            HUD: {
                nameFont: '16px Arial, sans-serif',        // 玩家名称字体
                nameColor: '#FFFFFF',                      // 玩家名称颜色
                hpBarWidth: 250,                           // HP 条宽度（像素）
                hpBarHeight: 20.5,                         // HP 条高度（像素）
                hpBarRadius: 8,                            // HP 条圆角半径
                hpColor: '#fb665b',                        // HP 条填充颜色（红色）
                spColor: '#665bfb',                        // SP 条填充颜色（蓝紫色）
                barBgAlpha: 0.1,                           // HP/SP 条背景不透明度
                strokeAlpha: 0.2,                          // HP/SP 条描边不透明度
                highlightTopAlpha: 0.2,                    // HP/SP 条顶部高光不透明度（模拟立体感）
                highlightBottomAlpha: 0.08,                // HP/SP 条底部阴影不透明度
                valueFont: 'bold 12px Arial, sans-serif',  // HP/SP 数值文字字体
                valueColor: '#FFFFFF',                     // HP/SP 数值文字颜色
                nameShadow: 'rgba(0,0,0,0.5)',             // 名称文字阴影颜色
                valueShadow: 'rgba(0,0,0,0.8)',            // 数值文字阴影颜色
                yNameOffset: 0,                            // 名称文字相对角色中心的垂直偏移
                yHpBarOffset: 20,                          // HP 条相对角色中心的垂直偏移
                spGap: 6,                                  // HP 条与 SP 条之间的垂直间距（像素）
            },

            // ---- 攻击范围因子（逻辑用，保留） ----
            PLAYER_ATTACK_RANGE_FACTOR: 2.5,    // 玩家攻击范围 = 玩家半径 × 此因子
            MONSTER_ATTACK_RANGE_FACTOR: 1.5,   // 怪物攻击范围 = 怪物半径 × 此因子

            // ---- 基础视口尺寸 ----
            TILE_BASE_SIZE: RO_CONSTANTS.TILE_BASE_SIZE, // 瓦片基础尺寸（像素），引用全局常量
            TILE_MIN_SIZE: 32,                            // 地图缩放时瓦片最小尺寸（像素）
            TILE_MAX_SIZE: RO_CONSTANTS.TILE_BASE_SIZE,   // 瓦片最大尺寸（默认等于基础尺寸，可放大）
            BASE_VIEW_WIDTH: 1920,                        // 设计基准视口宽度（用于适配计算）
            BASE_VIEW_HEIGHT: 1080,                       // 设计基准视口高度
        },

        // ============================================================
        //  3. UI 面板
        //  功能：各类游戏内面板的配置（战斗统计、背包、技能树等）
        // ============================================================
        panels: {

            // ----- 战斗统计面板 -----
            battleStats: {
                refreshInterval: 1.0,                // 统计数据刷新间隔（秒），影响面板更新频率
                expBarLowColor: '#FF4444',           // 经验条低值颜色（红色，表示经验较少）
                expBarMidColor: '#FFAA00',           // 经验条中值颜色（橙色，表示经验中等）
                expBarHighColor: '#44FF44',          // 经验条高值颜色（绿色，表示经验接近满）
                showDecimal: false,                  // 是否显示小数（如击杀数、伤害等）
                showDetailedExp: true,               // 是否显示详细经验数值（如“1234/2000”）
                killCounterFormat: 'int',            // 击杀数显示格式（'int' 表示整数，可改为 'float' 等）
            },

            // ----- 背包面板 -----
            inventory: {
                autoRefresh: true,                   // 是否自动刷新背包内容
                refreshDelay: 300,                   // 自动刷新延迟（毫秒）
            },

            // ----- 技能树面板 -----
            skillTree: {
                autoRefresh: true,                   // 是否自动刷新技能树状态
                refreshDelay: 200,                   // 自动刷新延迟（毫秒）
            },
        },

        // ============================================================
        //  4. 通用 UI 行为
        //  功能：与具体面板无关的全局 UI 设置
        // ============================================================
        ui: {
            tooltipDelay: 500,                       // 鼠标悬停后显示提示框的延迟（毫秒）
            notificationDuration: 3000,              // 系统通知显示时长（毫秒）
            maxNotifications: 5,                     // 同时显示的最大通知数量
        },
    };

    // 将配置对象暴露为全局变量 UIConfig
    global.UIConfig = UI_CONFIG;

    // 控制台输出加载信息，便于调试确认
    console.log('[UIConfig] ✅ 已加载（完整嵌套版，与 CanvasRenderer 对齐）');
    console.log('[UIConfig] 📋 包含: effects, render.PLAYER/MONSTER/SKILL_BAR/HUD, panels');

})(window);