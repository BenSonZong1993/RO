// js/init.js
// ============================================================
//  启动器（v4.0：依赖装配 + 系统注册；业务逻辑全部在 Service/Context）
//  权限：system:reset / ui:* 事件编排
//  启动顺序（蓝图 3.2 / 十三）：
//    自检 → 存储适配 → 三仓储 → 角色 → 属性管线+网关挂接 → CharacterContext
//    → 服务注册 → 地图 → 事件绑定（含 ui:learn-skill / ui:reset-skills / ui:change-job
//    编排）→ 画布 → 游戏循环 → app:ready
// ============================================================
(function(global) {
    'use strict';

    var CONFIG = {
        targetRenderFPS: 60,
    };

    // ---------- 转生按钮 ----------
    function _bindRebirthButton() {
        var rebirthBtn = document.getElementById('btn-rebirth');
        if (!rebirthBtn) return;

rebirthBtn.addEventListener('click', function() {
    if (global.RebirthService && typeof global.RebirthService.performRebirth === 'function') {
        var result = global.RebirthService.performRebirth('init');
        if (result && result.success) {
            console.log('[init] ✅ 转生成功:', result.message);
        } else {
            console.warn('[init] ❌ 转生失败:', result ? result.message : '未知错误');
            Notification.alert('转生失败：' + (result ? result.message : '未知错误'), '转生');
        }
    } else {
        console.warn('[init] ❌ RebirthService.performRebirth 不可用');
    }
});

        console.log('[init] ✅ 转生按钮已绑定');
    }

    // ---------- UI 事件 → Service/Context 编排（规则 ARCH-2） ----------
    function _bindUITranslations() {
        var bus = global.EventBus;
        if (!bus) return;

        // 学习技能：UISkillTree 发事件 → SkillService 执行 → 结果回传
        bus.on('ui:learn-skill', function(data) {
            if (!data || !data.skillId) return;
            var result = global.SkillService
                ? global.SkillService.learnSkill(data.skillId, 'init')
                : { success: false, message: 'SkillService 不可用' };
            bus.emit('skill:learn-result', { skillId: data.skillId, success: result.success, message: result.message });
        });

        // 重置技能树：UISkillTree/转生流程发事件 → CharacterContext 执行
        bus.on('ui:reset-skills', function(data) {
            if (global.CharacterContext) {
                global.CharacterContext.resetSkills((data && data.source) || 'init');
            }
        });

        // 转职：UIJob 发事件 → JobChangeService 执行 → 结果回传
        bus.on('ui:change-job', function(data) {
            if (!data || !data.jobKey) return;
            var result = global.JobChangeService
                ? global.JobChangeService.changeJob(data.jobKey, 'init')
                : { success: false, message: 'JobChangeService 不可用' };
            bus.emit('job:change-result', { jobKey: data.jobKey, success: result.success, message: result.message });
        });

        // 转生事件 → 强制重算 + UI 刷新（与旧 init._bindRebirthEvents 行为一致）
        bus.on('char:rebirth', function() {
            console.log('[init] 🔄 转生事件触发，刷新 UI');
            if (global.UIJob && global.UIJob.render) global.UIJob.render();
            if (global.UIAttributes && global.UIAttributes.refreshAll) global.UIAttributes.refreshAll();
            if (global.UISkillTree && global.UISkillTree.render) global.UISkillTree.render();
            if (global.UIBattleStats && global.UIBattleStats.update) global.UIBattleStats.update();
            if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
                global.AttributeMediator.forceRecalc();
            }
        });
    }

// ---------- 图鉴按钮（导航中心 + 浮动导航条） ----------
(function bindGalleryButton() {
    var btn = document.getElementById('btn-open-dex');
    if (!btn) return;

    var retries = 0;
    function tryBind() {
        if (window.UIDexHub) {
            btn.addEventListener('click', function() {
                window.UIDexHub.open();
            });
            console.log('[init] ✅ 图鉴按钮已绑定（导航中心）');
        } else if (retries < 5) {
            retries++;
            setTimeout(tryBind, 200);
        } else {
            console.warn('[init] ❌ UIDexHub 未加载，放弃绑定');
        }
    }
    tryBind();
})();


    function boot() {
        // ===== 0. 自检 =====
        if (global.SelfCheck && typeof global.SelfCheck.run === 'function') {
            var ok = global.SelfCheck.run();
            if (!ok) console.error('[init] 自检失败，应用可能无法正常运行，但继续启动...');
        } else {
            console.warn('[init] SelfCheck 未加载，跳过启动自检');
        }

        if (!global.EventBus) {
            console.error('[init] EventBus 未加载');
            return;
        }

        // ===== 1. 存储适配与三仓储装配（蓝图 10.3：面向接口注入） =====
        if (global.CloudStorageService) {
            global.CloudStorageService.init({ adapter: global.PersistenceManager });
        }
        if (global.InventoryRepository) {
            global.InventoryRepository.init({ storage: global.CloudStorageService });
        }
        if (global.MapRepository) {
            global.MapRepository.init({ storage: global.CloudStorageService });
        }
        if (global.CharRepository) {
            global.CharRepository.init({
                storage: global.CloudStorageService,
                // 旧存档格式兼容：char.equippedItems 由背包数据同步（提供器注入，避免层间反向依赖）
                equippedProvider: function() {
                    return (global.InventoryService && typeof global.InventoryService.getEquippedInfo === 'function')
                        ? global.InventoryService.getEquippedInfo() : null;
                },
            });
        }

        // ===== 2. 角色加载 =====
        if (global.CharController && typeof global.CharController.load === 'function') {
            global.CharController.load();
            console.log('[init] 角色数据已加载');
        } else {
            console.warn('[init] CharController 未找到');
        }

        // ===== 3. 属性管线 + 网关挂接（AttributeGateway._updateCache 订阅 Mediator 回调） =====
        if (global.AttributeMediator && typeof global.AttributeMediator.init === 'function') {
            var initResult = global.AttributeMediator.init({
                configProfileManager: global.ConfigProfileManager,
                inventoryService: global.InventoryService,
                eventBus: global.EventBus,
            });
            if (initResult) {
                console.log('[init] AttributeMediator 初始化成功');
            } else {
                console.warn('[init] AttributeMediator 初始化失败');
            }
        }
        if (global.AttributeGateway && typeof global.AttributeGateway.init === 'function') {
            global.AttributeGateway.init();
        }

        // ===== 4. CharacterContext（第三支柱） =====
        if (global.CharacterContext) {
            global.CharacterContext.init({
                eventBus: global.EventBus,
                charRepository: global.CharRepository,
                inventoryRepository: global.InventoryRepository,
                mapRepository: global.MapRepository,
                attributeGateway: global.AttributeGateway,
            });
        }

        // 强制触发一次完整重算
        if (global.AttributeMediator && typeof global.AttributeMediator.forceRecalc === 'function') {
            global.AttributeMediator.forceRecalc();
        }

        // ===== 5. 地图服务 =====
        if (global.MapService && typeof global.MapService.init === 'function') {
            global.MapService.init();
            console.log('[init] MapService 已初始化');
        }

        // ===== 5.5 精炼 / 附魔服务（ROUND3/ROUND4） =====
        if (global.RefineService && typeof global.RefineService.init === 'function') {
            global.RefineService.init({ eventBus: global.EventBus });
        }
        if (global.EnchantService && typeof global.EnchantService.init === 'function') {
            global.EnchantService.init({ eventBus: global.EventBus });
        }

        // ===== 6. 事件绑定 =====
        var EventBus = global.EventBus;
        var BattleController = global.BattleController;

        EventBus.on('ui:start-farming', function() {
            var mapSelect = document.getElementById('map-select');
            var mapId = mapSelect && mapSelect.value ? mapSelect.value : 'prt_fild08';
            if (BattleController) {
                BattleController.start(mapId, { x: 400, y: 300 });
            }
        });

        EventBus.on('ui:stop-farming', function() {
            console.log('[init] 停止战斗命令收到');
            if (BattleController) {
                BattleController.stop();
                if (global.SpawnManager && typeof global.SpawnManager.reset === 'function') {
                    global.SpawnManager.reset();
                }
                if (global.CanvasRenderer) {
                    var player = global.CharRepository ? global.CharRepository.getLiveRef() : null;
                    var playerPos = BattleController ? BattleController.getPlayerPos() : { x: 400, y: 300 };
                    var finalStats = global.AttributeGateway ? global.AttributeGateway.getAll('init') : null;
                    var maxHp = finalStats ? finalStats.finalMaxHP : (player ? player.maxHp || 100 : 100);
                    var maxSp = finalStats ? finalStats.finalMaxSP : (player ? player.maxSp || 50 : 50);
                    global.CanvasRenderer.updateAndRender({
                        player: player ? {
                            name: player.name,
                            level: player.level,
                            hp: player.hp || 0,
                            maxHp: maxHp,
                            sp: player.sp || 0,
                            maxSp: maxSp,
                        } : null,
                        monsters: [],
                        damageNumbers: [],
                        experienceNumbers: [],
                        lootNotifications: [],
                        playerPos: playerPos,
                        skillStatus: null,
                        skillNames: [],
                        interruptTexts: [],
                    });
                }
                console.log('[init] 战斗已停止，画布已刷新');
            } else {
                console.warn('[init] BattleController 不可用');
            }
        });

        EventBus.on('ui:map-change', function() {
            if (BattleController && BattleController.isRunning()) {
                BattleController.stop();
            }
        });

        // 挂机状态持久化：开战/停战写 ui.autoFarming，启动时自动恢复
        // （防网络波动刷新后战斗变暂停，玩家后台空转数小时的沮丧事件）
        EventBus.on('battle:started', function() {
            if (global.DataCoordinator) global.DataCoordinator.dispatch('init', 'ui.autoFarming', true);
        });
        EventBus.on('battle:stopped', function() {
            if (global.DataCoordinator) global.DataCoordinator.dispatch('init', 'ui.autoFarming', false);
        });
        // 自动出售材料（勾选持久化：ui.autoSellEtc → LootManager 消费）
        EventBus.on('ui:auto-sell-toggle', function(data) {
            if (global.DataCoordinator) {
                global.DataCoordinator.dispatch('init', 'ui.autoSellEtc', !!(data && data.enabled));
            }
        });
        // 畏战开关（ui.fearMvp / ui.fearElite → SpawnManager 消费：MVP=Boss 类、精英=Event 类不刷新）
        EventBus.on('ui:fear-mvp-toggle', function(data) {
            if (global.DataCoordinator) {
                global.DataCoordinator.dispatch('init', 'ui.fearMvp', !!(data && data.enabled));
            }
        });
        EventBus.on('ui:fear-elite-toggle', function(data) {
            if (global.DataCoordinator) {
                global.DataCoordinator.dispatch('init', 'ui.fearElite', !!(data && data.enabled));
            }
        });

        // 重置存档

EventBus.on('ui:reset-save', async function() {
    var confirmed = await Notification.confirm('确认重置存档？', '重置确认');
    if (confirmed) {
        if (global.CharacterContext) {
            global.CharacterContext.resetCharacter(null, 'GMConsole');
        }
        if (global.InventoryRepository) global.InventoryRepository.reset('InventoryService');
        if (global.MapRepository) global.MapRepository.reset('GMConsole');
        if (global.AttributeMediator) global.AttributeMediator.forceRecalc();
        Notification.alert('存档已重置', '重置完成');
    }
});

        // ---- 背包/装备操作事件（UI → Service） ----
EventBus.on('ui:equip-item', function(data) {
    if (!data || !data.templateId) return;
    var result = InventoryService.equip(data.slots, data.templateId, data.refine || 0, data.cards || []);
    if (!result.success) {
        Notification.alert('装备失败: ' + result.message, '装备');
    } else {
        Notification.toast('✅ ' + result.message, 'success');
    }
});

EventBus.on('ui:unequip-item', function(data) {
    if (!data || !data.slot) return;
    var result = InventoryService.unequip(data.slot);
    if (!result.success) {
        Notification.alert('卸下失败: ' + result.message, '卸下');
    } else {
        Notification.toast('✅ ' + result.message, 'success');
    }
});

// ---- 精炼操作事件（ROUND3：UI → RefineService，含确认弹窗） ----
EventBus.on('ui:refine-item', async function(data) {
    if (!data || !global.RefineService) return;
    var target = data.slot ? { slot: data.slot } : { stackKey: data.stackKey };
    var info = RefineService.getRefineInfo(target);
    if (!info.ok) {
        Notification.alert(info.message, '精炼');
        return;
    }
    var oreText = info.ores.map(function(o) { return o.name + '×' + o.count; }).join('、') || '无';
    var msg = '精炼到 +' + info.targetLevel + '\n成功率：' + Math.round(info.successRate * 100) + '%'
        + '\n费用：' + info.zeny + ' Zeny\n材料：' + oreText
        + (info.safe ? '\n（安全等级内：100% 成功，失败不降级）' : '\n（失败可能降级甚至碎裂！）');
    var confirmed = await Notification.confirm(msg, '精炼确认');
    if (!confirmed) return;
    var result = RefineService.refine(target, 'init');
    if (result.success) {
        Notification.toast('✅ ' + result.message, 'success');
    } else if (result.broken) {
        Notification.alert(result.message, '精炼');
    } else {
        Notification.alert(result.message, '精炼');
    }
    EventBus.emit('inventory:changed'); // 刷新背包/装备面板显示
});

// ---- 附魔操作事件（ROUND6：三城选择弹窗 + 官方品阶升阶信息确认） ----
EventBus.on('ui:enchant-item', async function(data) {
    if (!data || !global.EnchantService) return;
    var target = data.slot ? { slot: data.slot } : { stackKey: data.stackKey };
    var city = await _chooseEnchantCity();
    if (!city) return;
    var info = EnchantService.getEnchantInfo(target, city);
    if (!info.ok) {
        Notification.alert(info.message, '附魔');
        return;
    }
    var curText = info.current ? ('当前词条：Lv.' + info.level + '「' + info.current.name + '（' + info.current.quality + '）」\n') : '当前词条：无\n';
    var gradeText = info.nextGradeLabel
        ? ('品阶升阶：' + (info.current ? info.current.quality : '白') + ' → ' + info.nextGradeLabel
            + '（官方概率 ' + Math.round(info.upgradeChance * 100) + '%，成功另收 ' + info.gradeFee + ' Zeny，失败不收）\n')
        : '';
    var msg = curText + '洗练到 Lv.' + info.nextLevel + '（' + info.cityName + '）\n'
        + '基础费用：' + info.zeny + ' Zeny\n' + gradeText
        + '词条随机重掷（等级不降级、品阶只升不降）';
    var confirmed = await Notification.confirm(msg, '附魔确认');
    if (!confirmed) return;
    var result = EnchantService.enchant(target, city, 'init');
    if (result.success) {
        Notification.toast('✅ ' + result.message, 'success');
    } else {
        Notification.alert(result.message, '附魔');
    }
    EventBus.emit('inventory:changed'); // 刷新背包/装备面板显示
});

// ---- 附魔三城选择弹窗（ROUND6：补上 ROUND4 留下的城市切换 TODO） ----
function _chooseEnchantCity() {
    return new Promise(function(resolve) {
        var cities = [
            { id: 'prontera', name: '普隆德拉', desc: '基础属性：力/敏/体/智/灵/运' },
            { id: 'morroc',   name: '梦罗克',   desc: '攻击进阶：物理攻击 / 魔法攻击' },
            { id: 'payon',    name: '斐扬',     desc: '种族增伤：动物系 / 龙族' },
        ];
        var btns = cities.map(function(c, i) {
            return '<button class="enc-city" data-city="' + c.id + '" style="display:block;width:100%;margin:' +
                (i ? '10px' : '0') + ' 0;padding:10px 14px;text-align:left;background:#f6f7fb;border:1px solid #dde1ea;' +
                'border-radius:8px;cursor:pointer;"><strong>' + c.name + '</strong><br>' +
                '<span style="font-size:0.85rem;color:#666;">' + c.desc + '</span></button>';
        }).join('');
        var overlay = UIPanel.show({
            preset: 'dialog',
            title: { icon: '🏛️', text: '选择附魔城市' },
            content: '<p style="margin:8px 0 12px;">不同城市的附魔词条池不同（等级互通）：</p>' + btns,
            onClose: function() { resolve(null); },
        });
        var retries = 0;
        (function bind() {
            var body = overlay.querySelector('.ro-panel-body');
            if (!body) { if (retries < 5) { retries++; setTimeout(bind, 100); } return; }
            var found = body.querySelectorAll('.enc-city');
            if (!found.length) { if (retries < 5) { retries++; setTimeout(bind, 100); } return; }
            found.forEach(function(btn) {
                btn.style.pointerEvents = 'auto';
                btn.onclick = function() {
                    UIPanel.close();
                    resolve(btn.getAttribute('data-city'));
                };
            });
        })();
    });
}

EventBus.on('ui:use-item', function(data) {
    if (!data || !data.stackKey) return;
    var result = InventoryService.useItem(data.stackKey);
    if (!result.success) {
        Notification.alert('使用失败: ' + result.message, '使用');
    } else {
        Notification.toast('✅ 使用成功', 'success');
    }
});

EventBus.on('ui:drop-item', function(data) {
    if (!data || !data.stackKey || data.count < 1) return;
    var ok = InventoryService.removeItem(data.stackKey, data.count);
    if (!ok) {
        Notification.alert('丢弃失败', '丢弃');
    } else {
        Notification.toast('✅ 已丢弃 ' + data.count + ' 件', 'success');
    }
});

        // ===== 7. 画布初始化 =====
        var canvas = document.getElementById('game-canvas');
        if (canvas && global.CanvasRenderer) {
            var canvasOk = global.CanvasRenderer.init(canvas);
            if (canvasOk) {
                var currentMapId = global.MapRepository
                    ? (global.MapRepository.get('currentId') || 'prt_fild08')
                    : 'prt_fild08';
                global.CanvasRenderer.setBackground(currentMapId);

                var initState = {
                    player: { name: '冒险者', hp: 100, maxHp: 100, sp: 50, maxSp: 50 },
                    monsters: [],
                    damageNumbers: [],
                    experienceNumbers: [],
                    lootNotifications: [],
                    playerPos: { x: 400, y: 300 },
                    skillStatus: null,
                    skillNames: [],
                    interruptTexts: [],
                };
                global.CanvasRenderer.updateAndRender(initState);
                console.log('[init] 画布已初始化并渲染');
            } else {
                console.error('[init] CanvasRenderer.init 失败');
            }
        } else {
            console.warn('[init] 画布或 CanvasRenderer 缺失');
        }

        // ===== 8. 游戏循环 =====
        var lastTime = 0;
        var renderAccumulator = 0;
        var renderInterval = 1 / CONFIG.targetRenderFPS;

        function gameLoop(timestamp) {
            var delta = lastTime ? Math.min((timestamp - lastTime) / 1000, 0.05) : 0.016;
            lastTime = timestamp;

            if (global.BattleController && global.BattleController.isRunning()) {
                // 战斗加速档位：统一缩放战斗系统 delta（时间维度，伤害数值不受影响）
                var speed = global.BattleSpeedManager ? global.BattleSpeedManager.getSpeed() : 1;
                var battleDelta = delta * speed;
                global.BattleController.update(battleDelta);
            }

            if (global.AutoConsumeManager && global.CharRepository) {
                var charLoop = global.CharRepository.getLiveRef();
                if (charLoop && charLoop.hp > 0) {
                    global.AutoConsumeManager.checkAndUse(charLoop);
                }
            }

            if (global.BattleEffectsManager) {
                global.BattleEffectsManager.update(global.BattleSpeedManager ? global.BattleSpeedManager.scaleDelta(delta) : delta);
            }

            if (global.SkillScheduler) {
                global.SkillScheduler.update(global.BattleSpeedManager ? global.BattleSpeedManager.scaleDelta(delta) : delta);
            }
            if (global.GroundEffectManager) {
                global.GroundEffectManager.update((global.BattleSpeedManager ? global.BattleSpeedManager.scaleDelta(delta) : delta) * 1000);
            }
            if (global.CharController && typeof global.CharController.updateRegen === 'function') {
                var isCombat = global.BattleController ? global.BattleController.isRunning() : false;
                global.CharController.updateRegen(delta, isCombat);
            }

            renderAccumulator += delta;
            if (renderAccumulator >= renderInterval) {
                renderAccumulator = 0;

                if (global.CanvasRenderer) {
                    var player = global.CharRepository ? global.CharRepository.getLiveRef() : null;
                    var monsters = global.BattleController ? global.BattleController.getMonsters() : [];
                    var playerPos = global.BattleController ? global.BattleController.getPlayerPos() : { x: 400, y: 300 };
                    var skillStatus = global.BattleController ? global.BattleController.getSkillStatus() : null;
                    var effects = global.BattleEffectsManager ? global.BattleEffectsManager.getWorldData() : { damage: [], exp: [], loot: [], skillNames: [], interruptTexts: [] };

                    var finalStats = global.AttributeGateway ? global.AttributeGateway.getAll('render') : null;
                    if (!finalStats && player && player._finalStats) finalStats = player._finalStats;
                    var maxHp = finalStats ? finalStats.finalMaxHP : 100;
                    var maxSp = finalStats ? finalStats.finalMaxSP : 50;

                    var partnerState = (global.PartnerManager && typeof global.PartnerManager.getRenderState === 'function')
                        ? global.PartnerManager.getRenderState() : null;
                    var playerWeaponDir = (global.PartnerManager && typeof global.PartnerManager.getPlayerWeaponDir === 'function')
                        ? global.PartnerManager.getPlayerWeaponDir() : 0;

                    var state = {
                        player: player ? {
                            name: player.name || '冒险者',
                            level: player.level || 1,
                            gender: player.gender,
                            hp: Math.min(player.hp || 0, maxHp),
                            maxHp: maxHp,
                            sp: Math.min(player.sp || 0, maxSp),
                            maxSp: maxSp,
                            weaponDir: playerWeaponDir,
                        } : null,
                        monsters: monsters,
                        damageNumbers: effects.damage || [],
                        experienceNumbers: effects.exp || [],
                        lootNotifications: effects.loot || [],
                        playerPos: playerPos,
                        skillStatus: skillStatus,
                        skillNames: effects.skillNames || [],
                        interruptTexts: effects.interruptTexts || [],
                        partner: partnerState,
                    };

                    global.CanvasRenderer.updateAndRender(state);
                }
            }

            requestAnimationFrame(gameLoop);
        }

        requestAnimationFrame(gameLoop);
        global.EventBus.emit('app:ready');

        // ===== 8.5 挂机状态恢复（刷新/断网后自动续战） =====
        var autoFarming = global.DataCoordinator ? global.DataCoordinator.get('ui.autoFarming') === true : false;
        if (autoFarming && BattleController && !BattleController.isRunning()) {
            var farmMapId = global.MapRepository ? (global.MapRepository.get('currentId') || 'prt_fild08') : 'prt_fild08';
            
            // +++ 城镇检测与跳转 +++
            if (global.MapFlagData && global.MapFlagData.isTown(farmMapId)) {
                console.warn('[init] 上次地图为城镇，自动切换至 prt_fild08');
                farmMapId = 'prt_fild08';
                // 更新持久化状态，避免下次刷新再读错
                if (global.MapRepository) global.MapRepository.set('currentId', farmMapId, 'init');
                if (global.DataCoordinator) global.DataCoordinator.dispatch('init', 'map.currentId', farmMapId);
                // 触发地图变更事件，让 UI 同步（画布背景、下拉框等）
                global.EventBus.emit('map:changed', { mapId: farmMapId });
            }
            
            console.log('[init] 自动恢复战斗:', farmMapId);
            BattleController.start(farmMapId, { x: 400, y: 300 });
        }

        // ===== 8.6 勾选状态恢复（自动出售材料 / 畏战MVP / 畏战精英） =====
        var autoSellChk = document.getElementById('chk-auto-sell');
        if (autoSellChk && global.DataCoordinator) {
            autoSellChk.checked = global.DataCoordinator.get('ui.autoSellEtc') === true;
        }
        var fearMvpChk = document.getElementById('chk-fear-mvp');
        if (fearMvpChk && global.DataCoordinator) {
            fearMvpChk.checked = global.DataCoordinator.get('ui.fearMvp') === true;
        }
        var fearEliteChk = document.getElementById('chk-fear-elite');
        if (fearEliteChk && global.DataCoordinator) {
            fearEliteChk.checked = global.DataCoordinator.get('ui.fearElite') === true;
        }

        // ===== 8.7 战斗加速档位 / 简洁飘字（恢复 + 接线，持久化进 v3 ui 节） =====
        var speedSel = document.getElementById('sel-battle-speed');
        var compactChk = document.getElementById('chk-compact-float');
        if (global.BattleSpeedManager && global.DataCoordinator) {
            var savedSpeed = Number(global.DataCoordinator.get('ui.battleSpeed'));
            if (global.BattleSpeedManager.setSpeed(savedSpeed)) {
                if (speedSel) speedSel.value = String(savedSpeed);
            }
            var savedCompact = global.DataCoordinator.get('ui.compactFloat') === true;
            global.BattleSpeedManager.setCompact(savedCompact);
            if (compactChk) compactChk.checked = savedCompact;

            if (speedSel) {
                speedSel.addEventListener('change', function() {
                    var v = Number(speedSel.value);
                    if (global.BattleSpeedManager.setSpeed(v)) {
                        global.DataCoordinator.dispatch('init', 'ui.battleSpeed', v);
                    }
                });
            }
            if (compactChk) {
                compactChk.addEventListener('change', function() {
                    global.BattleSpeedManager.setCompact(compactChk.checked);
                    global.DataCoordinator.dispatch('init', 'ui.compactFloat', compactChk.checked);
                });
            }
        }

        // ===== 9. Zeny 显示 =====
        function updateZenyDisplay() {
            var el = document.getElementById('zeny-total');
            if (el && typeof CharController !== 'undefined' && typeof CharController.getZeny === 'function') {
                el.textContent = CharController.getZeny();
            }
        }
        updateZenyDisplay();
        EventBus.on('char:changed', updateZenyDisplay);
        EventBus.on('inventory:changed', updateZenyDisplay);

        // ===== 10. NPC 事件 =====
EventBus.on('npc:action', async function(data) {
    var action = data.action;
    switch (action) {
        case 'changeJob':
            if (window.UIJob && typeof window.UIJob.open === 'function') {
                window.UIJob.open(data.jobFilter);
            }
            break;
        case 'openEquipShop':
            if (window.UIShop && typeof window.UIShop.open === 'function') {
                window.UIShop.open('equip');
            }
            break;
        case 'openPotionShop':
            if (window.UIShop && typeof window.UIShop.open === 'function') {
                window.UIShop.open('potion');
            }
            break;
        case 'openRecycleShop':
            if (window.UIRecycle && typeof window.UIRecycle.open === 'function') {
                window.UIRecycle.open();
            }
            break;
        case 'resetSkillPoints':
        case 'resetStatPoints': {
            if (!(window.SkillService && typeof window.SkillService.getResetServiceInfo === 'function')) break;
            var info = window.SkillService.getResetServiceInfo('init');
            var isSkill = action === 'resetSkillPoints';
            var cost = isSkill ? info.skillCost : info.statCost;
            var what = isSkill ? '清空全部技能并返还已投入技能点' : '重置全部素质属性并返还已消耗素质点';
            var confirmMsg = info.free
                ? '当前处于免费窗口（未转生且 Base < ' + info.freeMaxBaseLevel + '）。\n确认' + what + '？'
                : '本次重置将收取 ' + cost + ' Zeny。\n确认' + what + '？';
            var confirmed = await Notification.confirm(confirmMsg, '重置确认');
            if (!confirmed) break;
            var resetResult = isSkill
                ? window.SkillService.resetSkillPoints('init')
                : window.SkillService.resetStatPoints('init');
            Notification.alert(resetResult.message, '重置结果');
            break;
        }
        default:
            console.warn('未知NPC动作:', action);
    }
});

        // ===== 11. UI 翻译层绑定（ui:* → Service/Context） =====
        // 说明：设置按钮（btn-settings）已由 UISettings 模块自行绑定（昵称/云端删档面板）
        _bindUITranslations();
        _bindRebirthButton();

        // ===== 12. 消耗品面板 =====
        if (global.UIPotions && typeof global.UIPotions.init === 'function') {
            global.UIPotions.init();
        }

        // 在 boot() 函数中，所有 EventBus.on 的后面，添加：
// EventBus.on('ui:map-change', function(data) {
//     if (data && data.mapId && global.CanvasRenderer) {
//         global.CanvasRenderer.setBackground(data.mapId);
//         console.log('[init] 🗺️ 地图切换，更新画布背景:', data.mapId);
//     }
// });

        console.log('[init] 🚀 应用启动完成（v4.0 三层支柱架构，渲染帧率锁定 ' + CONFIG.targetRenderFPS + ' FPS）');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})(window);
