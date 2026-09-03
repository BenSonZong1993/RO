// ================================================================
//  FILE: ro_ai_context.js
//  VERSION: 6.0.0 (精简骨架)
//  PURPOSE: AI 业务心智模型 —— 不存函数签名，只存架构契约与模块边界
//  USAGE: 配合 ro_data_schema.js 使用，AI 无需读具体代码即可理解业务全景
// ================================================================

(function(global) {
    'use strict';

    // =============================================================
    // 1. 项目 DNA（三支柱 + 数据流向）
    // =============================================================
    global.__RO_ARCH = {
        pillars: {
            Context: 'CharacterContext（角色状态机，HP/SP/属性/技能/职业/转生唯一写入口）',
            Gateway: 'Gateway（静态数据收费站：Skill/Item/Job/Map/Loot/Attribute，禁止直读 window.*Data）',
            Repository: 'Repository（唯一持久化读写：Char/Inventory/Map，所有写入经此落盘）'
        },
        flow: 'UI → EventBus → Controller/Service → Context/Repository → PersistenceManager(localStorage v3)',
        eventDriven: 'UI 禁止直接调用 Service，必须通过 EventBus 发事件（规则 ARCH-2）',
        skillLayers: 'Scheduler(门面) → Runtime(状态机) + Strategy(决策) + Executor(执行)，数据全经 SkillGateway'
    };

    // =============================================================
    // 2. 实体所有权（高频约束，防 AI 乱写）
    // =============================================================
    global.__RO_OWNERSHIP = {
        'char._finalStats': 'AttributeGateway 独占维护（只读），任何模块禁止直接赋值',
        'char.rebirthCount': '仅 RebirthService 写入',
        'char.jobKey': '仅 JobChangeService 写入',
        'char.learnedSkills': '仅 CharacterContext.resetSkills / SkillService.learnSkill 写入',
        'inventory.*': '仅 InventoryRepository / 子服务（Equip/Card/Usable/Material）受控写入',
        'ItemData/SkillData/MapData': '只读，且必须经对应 Gateway 访问（GATE-1）'
    };

    // =============================================================
    // 3. 核心业务模块速览（AI 知道“有这东西”即可）
    // =============================================================
    global.__RO_MODULES = {
        character: 'CharController（门面） + CharService（经验/属性点） + CharacterContext（状态）',
        battle: 'BattleController（循环） + PlayerAI/MonsterAI + rAthenaEngine（伤害）',
        skills: 'SkillScheduler + NormalAttackModifierEngine（普攻多段/双持）',
        items: 'InventoryService + EquipService + CardService + UsableService + MaterialService',
        refine: 'RefineService（官方 refine.yml 数值，支持武器/防具 1~4 级，HD/Enriched 待扩展）',
        enchant: 'EnchantService（官方 enchantgrade.yml 品阶体系，三城词条池）',
        rebirth: 'RebirthService（0~4 转，累加 statPoints）',
        jobChange: 'JobChangeService（转职，基于 JobGroups 条件树）',
        persistence: 'CloudStorageService（本地优先 + write-behind 云同步，自动降级）',
        ui: 'UIManager 管理所有面板（UIAttributes/UIInventory/UISkillTree/UIRanking 等）',
        render: 'CanvasRenderer + OverlayRenderer（飘字/冷却条/地形）'
    };

    // =============================================================
    // 4. 当前版本状态快照（避免 AI 给出过时建议）
    // =============================================================
    global.__RO_STATUS = {
        version: 'v5.0.2 + ROUND6（附魔官方化）',
        completed: [
            '属性管线（8 处理器 + AttributeMediator + Gateway）',
            '普攻多段引擎（双持拆分 / 二刀连击 / extraHits）',
            '技能四层架构（Scheduler/Runtime/Strategy/Executor）',
            '精炼真实化（RefineConfig 官方 refine.yml Normal 档）',
            '附魔真实化（EnchantConfig 官方 grade 品阶 + 三城词条池）',
            '战斗加速（1x/2x/4x） + 简洁飘字聚合',
            '转生 / 转职（条件树 + 技能继承）',
            '云同步（ZeroTier 实测通过）',
            '排行榜 + 昵称系统'
        ],
        pending: [
            'HD/Enriched 精炼档 UI 与 Service 扩展',
            '附魔宝珠槽位系统（多词条 + 催化剂）',
            'Shadow 装备精炼',
            '官方 RandomBonus（+8 起随机浮动）',
            '困难层召唤物/寻路阻挡'
        ],
        constraints: [
            '禁止在 AI 上下文/代码中读取 >100KB 静态数据文件（ItemData_*.js / SkillData.js / MonsterData.js）',
            '所有技能/物品查询走 Gateway 单条取数'
        ]
    };

    // =============================================================
    // 5. 铁律十条（AI 生成代码时必须自检）
    // =============================================================
    global.__RO_RULES = [
        { id: 'GATE-1', assert: '静态数据（Item/Skill/Map/Monster）必须经 Gateway 读取，禁止 window.*Data' },
        { id: 'CTX-1', assert: '角色 HP/SP/属性/技能/职业/转生 变更必须走 CharacterContext' },
        { id: 'REB-1', assert: '转生操作必须经 RebirthService，禁止直接改 rebirthCount' },
        { id: 'JOB-1', assert: '转职操作必须经 JobChangeService，禁止直接改 jobKey' },
        { id: 'ARCH-2', assert: 'UI 模块只能发事件，禁止直接调用 Service/Context 方法' },
        { id: 'D1', assert: '_finalStats 由 AttributeGateway 独占维护，任何模块只读' },
        { id: 'D3', assert: '持久化写入必须经 Repository → CloudStorageService，禁止 localStorage.setItem' },
        { id: 'COMBO-4', assert: '连招前置检查基于 SkillRuntime.lastSkill（绑定目标 ID，500ms 超时）' },
        { id: 'DAMAGE-1', assert: '技能基础伤害 = 攻击力 × (倍率/100)，禁止 +1 倍（会翻倍）' },
        { id: 'MDEF-1', assert: '魔法伤害必须应用目标 mdef（减免公式 mdef/(mdef+100)）' }
    ];

    // =============================================================
    // 6. 关键索引（只保留“高频入口”，不保留具体参数签名）
    // =============================================================
    global.__RO_INDEX = {
        // ---- 角色 ----
        char: 'CharController.getChar / addExp / allocateStat / takeDamage / healFull',
        context: 'CharacterContext（restoreResource / applyStatus / resetCharacter / updateJob / addZeny）',

        // ---- 查询 ----
        attribute: 'AttributeGateway.get(key) / getAll / invalidate',
        item: 'ItemDataGateway.getById / getByAegis / search / getSellPrice',
        skill: 'SkillGateway.getSkillDef / getMergedSkillData / getTreeSkillDef / canLearn',
        job: 'JobGateway.getJobDef / getNextJobs / canChangeTo / checkJobChangeConditions / getAspd / getExpTable',
        map: 'MapDataGateway.getMapById / getSpawns / getTerrain',
        loot: 'LootGateway.randomQuality / getDropRateModifier',

        // ---- 写入/业务 ----
        inventory: 'InventoryService.addItem / removeItem / equip / unequip / useItem',
        refine: 'RefineService.refine(target) / getRefineBonus / getRefineInfo',
        enchant: 'EnchantService.enchant(target, city) / getEnchantBonus / getEnchantInfo',
        rebirth: 'RebirthService.performRebirth',
        jobChange: 'JobChangeService.changeJob',

        // ---- 战斗 ----
        battle: 'BattleController.start / stop / update / getMonsters',
        damage: 'rAthenaEngine.calculateDamage（支持 isMagic 参数）',
        normalAttack: 'NormalAttackModifierEngine.process（处理 onNormalAttack 修饰）',
        skillScheduler: 'SkillScheduler.castSkill / canCast / tryAction / clearCombatState',

        // ---- 持久化 ----
        save: 'CloudStorageService.save / load / sync / getRemoteVersion',
        ui: 'UIManager.disposeAll / register / throttle',
        render: 'CanvasRenderer.updateAndRender / setBackground'
    };

    // =============================================================
    // 7. 自检（极简快速验证）
    // =============================================================
    global.__RO_SELFCHECK = function() {
        console.log('[AI Context] ✅ v6.0.0 精简骨架已加载（若属性管线未初始化，自动触发 forceRecalc）');
        if (typeof AttributeGateway !== 'undefined' && typeof AttributeGateway.getAll === 'function') {
            var stats = AttributeGateway.getAll('__RO_SELFCHECK');
            if (!stats || typeof stats.finalATK !== 'number') {
                if (typeof AttributeMediator !== 'undefined' && typeof AttributeMediator.forceRecalc === 'function') {
                    AttributeMediator.forceRecalc();
                }
            }
        }
        return true;
    };

    console.log('[AI Context] ✅ v6.0.0 精简骨架加载完成（配合 ro_data_schema.js 使用）');
})(window);