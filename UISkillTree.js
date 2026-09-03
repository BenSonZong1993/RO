// js/ui/UISkillTree.js
// ============================================================
//  技能树面板（v4.0：只读展示 + 事件驱动，规则 ARCH-2 / CTX-1）
//  权限：无（UI 只读；学习/重置经 ui:learn-skill / ui:reset-skills 事件）
//  依赖：SkillGateway（树/条件/显示名唯一入口）、CharRepository、SkillService、
//        CharController.updateAutoSkillConfig（自动技能配置合法入口）、EventBus、UIManager
//  变更（蓝图 3.2）：
//    - 学习按钮：发送 ui:learn-skill 事件（由 init.js 编排 SkillService），监听 skill:learn-result
//    - resetSkillTree：不再直接改 char，发送 ui:reset-skills 事件（CharacterContext 处理）
//    - 树/条件读取经 SkillGateway（SkillGroupManager 已并入网关）
// ============================================================
(function(global) {
    'use strict';

    var isOpen = false;
    var _listeners = [];
    var _domListeners = [];
    var _initialized = false;
    var _debouncedRender = null;

    // ---------- 工具函数：获取中文信息（经 SkillGateway） ----------
function getDisplayName(id) {
    if (!global.SkillGateway) return id;
    var def = global.SkillGateway.getSkillByAegis(id);
    if (!def) {
        var numId = parseInt(id, 10);
        if (!isNaN(numId)) {
            def = global.SkillGateway.getSkillById(numId);
        }
    }
    return (def && def.DisplayName) ? def.DisplayName : id;
}

function getDescription(id) {
    if (!global.SkillGateway) return '';
    var def = global.SkillGateway.getSkillByAegis(id);
    if (!def) {
        var numId = parseInt(id, 10);
        if (!isNaN(numId)) {
            def = global.SkillGateway.getSkillById(numId);
        }
    }
    return def ? def.Description : '';
}

    function _getChar() {
        return global.CharRepository ? global.CharRepository.getLiveRef() : null;
    }

    function _getAutoConfig() {
        var char = _getChar();
        if (!char || !char._autoSkillConfig) {
            return { skills: [], strategy: 'priority', enabled: true };
        }
        return char._autoSkillConfig;
    }

    function _saveConfig(skills, strategy, enabled) {
        if (global.CharController && typeof global.CharController.updateAutoSkillConfig === 'function') {
            global.CharController.updateAutoSkillConfig(skills, strategy, enabled);
        }
    }

    // ---------- 转生后重置技能树（事件化：规则 CTX-1） ----------
    function resetSkillTree() {
        if (global.EventBus) {
            global.EventBus.emit('ui:reset-skills', { source: 'UISkillTree' });
        }
        if (isOpen) render();
        console.log('[UISkillTree] ✅ 已发送技能树重置请求（ui:reset-skills）');
        return true;
    }



    // ---------- 职业链（祖先 → 当前）：转职保留机制的核心，沿 JobGroups.prevJobs 回溯 ----------
    function _buildJobChain(jobKey) {
        var chain = [];
        var cur = jobKey;
        var guard = 0;
        while (cur && guard++ < 12) {
            chain.unshift(cur);
            var prev = global.JobGateway ? global.JobGateway.getPrevJobs(cur) : [];
            cur = (prev && prev.length > 0) ? prev[0] : null;
        }
        return chain;
    }

    // ---------- 渲染单棵职业技能树（sectionJobKey 为该树归属职业） ----------
    function _renderSkillTable(sectionJobKey, tree, char, learned, rebirthCount, skillsInStrategy, isCurrent) {
        var html = `<table style="width:100%; border-collapse:collapse; font-size:0.9rem; background:#fafbfc;">
            <thead>
                <tr style="border-bottom:2px solid #d0d4da; background:#f0f2f5;">
                    <th style="padding:10px 8px; width:30px; text-align:center; color:#444; font-weight:600;">启用</th>
                    <th style="padding:10px 8px; text-align:left; color:#444; font-weight:600;">技能</th>
                    <th style="padding:10px 8px; text-align:center; color:#444; font-weight:600;">等级</th>
                    <th style="padding:10px 8px; text-align:center; color:#444; font-weight:600;">条件</th>
                    <th style="padding:10px 8px; text-align:center; color:#444; font-weight:600;">操作</th>
                </tr>
            </thead>
            <tbody>`;

        for (var i = 0; i < tree.skills.length; i++) {
            var skill = tree.skills[i];
            var currentLv = learned[skill.id] || 0;
            var isLearned = currentLv > 0;
            var isMax = isLearned && currentLv >= skill.maxLevel;

            // 转生次数要求（SkillGroups 数据经网关读取）
            var minRebirth = skill.minRebirth || 0;
            var rebirthLocked = rebirthCount < minRebirth;

            // 跨树继承：历史职业树跳过 JobLv 校验（技能前置与 Base 等级仍校验）
            var canLearn = global.SkillGateway ?
                global.SkillGateway.canLearn(sectionJobKey, skill.id, char, learned, { skipJobLevel: !isCurrent }) : false;
            if (rebirthLocked) canLearn = false;

var isPassive = false;
var def = null;
if (global.SkillGateway) {
    // 1. 先按 AegisName（字符串）查找
    def = global.SkillGateway.getSkillByAegis(skill.id);
    // 2. 若查不到，再尝试按数字 ID 查找
    if (!def) {
        var numId = parseInt(skill.id, 10);
        if (!isNaN(numId)) {
            def = global.SkillGateway.getSkillById(numId);
        }
    }
}
if (def && def.Passive === true) isPassive = true;

            var inStrategy = skillsInStrategy.indexOf(skill.id) !== -1;
            var displayName = getDisplayName(skill.id);
            var description = getDescription(skill.id);

var preText = (skill.preSkills && skill.preSkills.length > 0) ?
    skill.preSkills.map(function(p) {
        return getDisplayName(p.id) + ' Lv.' + p.level;
    }).join(', ') : '无';

            var lvReq = skill.baseLevel > 1 ? 'Base' + skill.baseLevel : '';
            var jobReq = skill.jobLevel > 1 ? 'Job' + skill.jobLevel : '';
            var reqText = [lvReq, jobReq].filter(Boolean).join(' ') || 'Lv.1';

            html += `<tr style="border-bottom:1px solid #e0e2e6;">`;
            html += `<td style="padding:8px 6px; text-align:center;">`;
            if (isLearned && !isPassive && !rebirthLocked) {
                html += `<input type="checkbox" class="skill-toggle" data-skill="${skill.id}" ${inStrategy ? 'checked' : ''} style="transform:scale(1.1); accent-color:#4a90d9;">`;
            } else if (isPassive && isLearned) {
                html += `<span style="color:#888; font-size:0.7rem;">被动</span>`;
            } else if (rebirthLocked) {
                html += `<span style="color:#f44336; font-size:0.7rem;" title="需要转生 ${minRebirth} 次">🔒</span>`;
            } else {
                html += `<span style="color:#ccc;">-</span>`;
            }
            html += `</td>`;

            html += `<td style="padding:8px 6px; vertical-align:middle;">
                <strong style="color:#1a1a1a; font-weight:600;">${displayName}</strong>
                ${rebirthLocked ? ` <span style="color:#f44336; font-size:0.7rem; background:#ffebee; padding:1px 6px; border-radius:3px;">需转生${minRebirth}次</span>` : ''}
                ${description ? `<br/><span style="font-size:0.8rem; color:#555; display:block; margin-top:4px; line-height:1.4; word-wrap:break-word; white-space:normal;">${description}</span>` : ''}
            </td>`;
            html += `<td style="padding:8px 6px; text-align:center; color:#333;">${currentLv}/${skill.maxLevel}</td>`;
            html += `<td style="padding:8px 6px; text-align:center; font-size:0.8rem; color:#555;">${reqText}<br/><span style="color:#888;">前置: ${preText}</span></td>`;
            html += `<td style="padding:8px 6px; text-align:center;">`;
            if (isMax) {
                html += `<span style="color:#888;">已满</span>`;
            } else if (canLearn && !rebirthLocked) {
                html += `<button class="skill-learn-btn" data-skill="${skill.id}" style="background:#4a90d9; border:none; color:#fff; padding:4px 16px; border-radius:6px; cursor:pointer; font-size:0.85rem; transition:background 0.15s;">学习</button>`;
            } else {
                html += `<span style="color:#cc4444;">✗ ${rebirthLocked ? '转生不足' : '条件不足'}</span>`;
            }
            html += `</td></tr>`;
        }
        html += `</tbody></table>`;
        return html;
    }

    // ===== 核心渲染函数 =====
    function render() {
        var content = document.getElementById('skill-tree-content');
        var jobSpan = document.getElementById('skill-tree-job');
        var pointsSpan = document.getElementById('skill-tree-points');
        var strategyList = document.getElementById('strategy-list');
        var strategySelect = document.getElementById('strategy-type');
        if (!content || !strategyList) return;

        var char = _getChar();
        if (!char) {
            content.innerHTML = '<p style="color:#999; padding:20px; text-align:center;">角色数据未加载</p>';
            strategyList.innerHTML = '';
            return;
        }

        var jobKey = char.jobKey || 'Novice';
        if (jobSpan) jobSpan.textContent = jobKey;
        if (pointsSpan) pointsSpan.textContent = char.skillPoints || 0;

        var config = _getAutoConfig();
        var skillsInStrategy = config.skills || [];
        var strategy = config.strategy || 'priority';
        if (strategySelect) strategySelect.value = strategy;

        // ---- 策略列表 ----
        var listHtml = '';
        if (skillsInStrategy.length === 0) {
            listHtml = '<span style="color:#999; font-size:0.85rem;">暂无技能，请在下方技能列表中添加。</span>';
        } else {
            skillsInStrategy.forEach(function(skillId, index) {
                var displayName = getDisplayName(skillId);
                listHtml += `
                    <div style="display:inline-flex; align-items:center; background:#ffffff; border:1px solid #d0d4da; border-radius:6px; padding:2px 8px; margin:2px; font-size:0.85rem; color:#222; box-shadow:0 1px 2px rgba(0,0,0,0.04);">
                        <span>${index+1}. ${displayName}</span>
                        <button class="strategy-btn" data-action="moveUp" data-skill="${skillId}" style="background:none; border:none; color:#888; cursor:pointer; margin-left:6px; font-size:1rem;">↑</button>
                        <button class="strategy-btn" data-action="moveDown" data-skill="${skillId}" style="background:none; border:none; color:#888; cursor:pointer; font-size:1rem;">↓</button>
                        <button class="strategy-btn" data-action="remove" data-skill="${skillId}" style="background:none; border:none; color:#cc4444; cursor:pointer; margin-left:4px; font-size:1rem;">✕</button>
                    </div>
                `;
            });
        }
        strategyList.innerHTML = listHtml;

        // ---- 技能表格（SkillGateway 唯一入口；跨职业继承：渲染整条职业链） ----
        var learned = char.learnedSkills || {};
        var rebirthCount = char.rebirthCount || 0;
        var chain = _buildJobChain(jobKey);
        if (chain.length === 0) chain = [jobKey];

        var sections = '';
        var anySection = false;
        for (var s = 0; s < chain.length; s++) {
            var sectionJobKey = chain[s];
            var sectionTree = global.SkillGateway ? global.SkillGateway.getSkillTree(sectionJobKey) : null;
            if (!sectionTree || !sectionTree.skills || sectionTree.skills.length === 0) continue;
            anySection = true;
            var isCurrent = sectionJobKey === jobKey;
            var jobDef = global.JobGateway ? global.JobGateway.getJobDef(sectionJobKey) : null;
            var sectionName = (jobDef && jobDef.name) || sectionJobKey;
            sections += '<div style="margin:12px 4px 6px 4px; font-weight:600; color:#1a1a1a; font-size:0.95rem;">'
                + '🗡️ ' + sectionName + (isCurrent ? '（当前职业）' : '（已保留·Job等级要求豁免）') + '</div>';
            sections += _renderSkillTable(sectionJobKey, sectionTree, char, learned, rebirthCount, skillsInStrategy, isCurrent);
        }
        // ---- 队伍技能（SO_PARTNER：组队存续期间可见的隐藏技能；不占学习点、不写入存档） ----
        var partySectionAdded = false;
        if (global.SocialService && typeof global.SocialService.inParty === 'function' && global.SocialService.inParty()) {
            partySectionAdded = true;
            var party = global.SocialService.getParty();
            var partnerName = (party && party.partner && party.partner.name) || '?';
            var partnerOnline = party && party.partner && party.partner.online;
            var summoned = !!(global.PartnerManager && global.PartnerManager.isSummoned());
            var expMul = (global.PartnerManager && global.PartnerManager.getExpMultiplier) ? global.PartnerManager.getExpMultiplier() : 0.75;
            sections += '<div style="margin:16px 4px 6px 4px; font-weight:600; color:#7a5c1e; font-size:0.95rem;">👥 队伍技能 · SO_PARTNER' +
                '<span style="font-weight:normal; color:#888; font-size:0.8rem;">（队友：' + partnerName + ' ' + (partnerOnline ? '🟢在线' : '⚪离线') + '）</span></div>';
            sections += '<div style="margin:0 4px 10px 4px; padding:10px 12px; background:#fdf9ef; border:1px solid #e8dcbf; border-radius:8px; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center; gap:10px;">' +
                '<div>召唤伙伴<br/><span style="color:#888; font-size:0.8rem;">将队友的快照作为佣兵召唤入场（击杀归属本方；组队期间全局经验 ×' + expMul + '）</span></div>' +
                '<button id="partner-toggle-btn" style="flex-shrink:0; background:' + (summoned ? '#8a8a8a' : '#2a7a2a') + '; border:none; color:#fff; padding:8px 16px; border-radius:6px; cursor:pointer;">' + (summoned ? '召回' : '召唤') + '</button>' +
                '</div>';
        }

        if (!anySection && !partySectionAdded) {
            content.innerHTML = '<p style="color:#999; padding:20px; text-align:center;">当前职业无可学习技能。</p>';
            return;
        }
        content.innerHTML = sections;

        // 队伍技能按钮（召唤/召回；施放入口为 PartnerManager.toggle）
        var ptBtn = document.getElementById('partner-toggle-btn');
        if (ptBtn && global.PartnerManager && typeof global.PartnerManager.toggle === 'function') {
            ptBtn.addEventListener('click', function() {
                global.PartnerManager.toggle().then(function(res) {
                    if (!res || !res.success) {
                        ptBtn.textContent = '召唤';
                        // 失败提示经 UIParty toast（partner 事件或此处兜底）
                    }
                    if (isOpen) render();
                });
            });
        }
    }

    // ===== 打开/关闭/刷新 =====
    function open() {
        if (isOpen) {
            render();
            return;
        }

        var config = _getAutoConfig();

        UIPanel.show({
            preset: 'large',
            title: { icon: '📚', text: '技能树' },
            content: `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                    <span style="font-size:0.95rem; color:#555;">剩余技能点: <strong id="skill-tree-points" style="color:#d4880f; font-weight:600;">0</strong></span>
                    <span id="skill-tree-job" style="font-weight:400; color:#666; font-size:1.2rem;">-</span>
                </div>
                <div id="strategy-config" style="background:#f5f6f8; border-radius:10px; padding:14px 16px; margin-bottom:16px; border:1px solid #e8eaee;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:6px;">
                        <span style="font-weight:600; color:#333; font-size:0.95rem;">⚙️ 自动战斗策略</span>
                        <div>
                            <label style="font-size:0.85rem; color:#555; margin-right:8px;">策略类型:</label>
                            <select id="strategy-type" style="background:#fff; color:#222; border:1px solid #ccc; border-radius:6px; padding:4px 10px; font-size:0.9rem; outline:none;">
                                <option value="priority">优先级</option>
                                <option value="round_robin">轮询</option>
                                <option value="cd_priority">冷却优先</option>
                                <option value="rotation">首发+小招</option>
                            </select>
                        </div>
                    </div>
                    <div id="strategy-list" style="display:flex; flex-wrap:wrap; gap:6px; min-height:36px; padding:6px 0; border-top:1px dashed #d0d4da; margin-top:6px;"></div>
                    <div style="font-size:0.75rem; color:#888; margin-top:6px;">💡 点击技能行中的复选框可加入/移除策略</div>
                </div>
                <div id="skill-tree-content" style="flex:1; overflow-y:auto; padding-right:4px; background:#fafbfc; border-radius:10px; border:1px solid #e8eaee; padding:6px 0; min-height:200px;"></div>
            `,
            onClose: function() {
                isOpen = false;
            }
        });

        isOpen = true;
        // 设置策略选择框的值
        var strategySelect = document.getElementById('strategy-type');
        if (strategySelect) strategySelect.value = config.strategy || 'priority';

        render();
        _bindPanelEvents();
    }

    function close() {
        UIPanel.close();
        if (isOpen) isOpen = false;
    }

    function close() {
        if (modal) modal.style.display = 'none';
        isOpen = false;
    }


        // ---------- 绑定技能树面板内部事件（委托） ----------
    function _bindPanelEvents() {
        var container = document.querySelector('.ro-panel-container');
        if (!container) return;

        // 移除旧监听（防止重复绑定）
        if (container._panelHandler) {
            container.removeEventListener('click', container._panelHandler);
            container.removeEventListener('change', container._panelChangeHandler);
        }

        var clickHandler = function(e) {
            var target = e.target;

            // 1. 学习按钮
            var learnBtn = target.closest('.skill-learn-btn');
            if (learnBtn) {
                var skillId = learnBtn.dataset.skill;
                if (skillId && global.EventBus) {
                    global.EventBus.emit('ui:learn-skill', { skillId: skillId });
                }
                return;
            }

            // 2. 自动技能复选框
            var checkbox = target.closest('.skill-toggle');
            if (checkbox) {
                var skillId = checkbox.dataset.skill;
                if (!skillId) return;
                var checked = checkbox.checked;
                var char = _getChar();
                if (!char || !char.learnedSkills || !char.learnedSkills[skillId]) {
                    checkbox.checked = !checked;
                    return;
                }
                var config = _getAutoConfig();
                var skills = config.skills.slice();
                if (checked) {
                    if (skills.indexOf(skillId) === -1) skills.push(skillId);
                } else {
                    var idx = skills.indexOf(skillId);
                    if (idx !== -1) skills.splice(idx, 1);
                }
                _saveConfig(skills, config.strategy, config.enabled);
                render();
                return;
            }

            // 3. 策略按钮（上移/下移/移除）
            var strategyBtn = target.closest('.strategy-btn');
            if (strategyBtn) {
                var action = strategyBtn.dataset.action;
                var skillId = strategyBtn.dataset.skill;
                if (!skillId) return;
                var config = _getAutoConfig();
                var skills = config.skills.slice();
                var idx = skills.indexOf(skillId);
                if (idx === -1) return;

                if (action === 'moveUp' && idx > 0) {
                    skills.splice(idx, 1);
                    skills.splice(idx - 1, 0, skillId);
                } else if (action === 'moveDown' && idx < skills.length - 1) {
                    skills.splice(idx, 1);
                    skills.splice(idx + 1, 0, skillId);
                } else if (action === 'remove') {
                    skills.splice(idx, 1);
                } else {
                    return;
                }
                _saveConfig(skills, config.strategy, config.enabled);
                render();
                return;
            }

            // 4. 伙伴召唤按钮（队伍技能中的召唤/召回）
            var partnerBtn = target.closest('#partner-toggle-btn');
            if (partnerBtn && global.PartnerManager) {
                global.PartnerManager.toggle().then(function(res) {
                    if (isOpen) render();
                });
                return;
            }
        };

        var changeHandler = function(e) {
            var target = e.target;
            if (target.id === 'strategy-type') {
                var config = _getAutoConfig();
                _saveConfig(config.skills, target.value, config.enabled);
                render();
            }
        };

        container.addEventListener('click', clickHandler);
        container.addEventListener('change', changeHandler);
        container._panelHandler = clickHandler;
        container._panelChangeHandler = changeHandler;
    }

    function init() {
        if (_initialized) return;
        _debouncedRender = global.UIManager.debounce(render.bind(this), 300);

        var btn = document.getElementById('btn-skill-tree');
        if (!btn) {
            btn = document.querySelector('[data-action="open-skill-tree"]');
        }
        if (!btn) {
            btn = document.querySelector('.btn-skill-tree');
        }
        if (btn) {
            var handler = function() { open(); };
            btn.addEventListener('click', handler);
            _domListeners.push({ el: btn, event: 'click', fn: handler });
            console.log('[UISkillTree] 按钮绑定成功');
        } else {
            console.warn('[UISkillTree] 未找到技能树按钮');
        }

        var bus = global.EventBus;
        if (bus) {
            bus.on('ui:open-skill-tree', function() { open(); });
            _listeners.push({ event: 'ui:open-skill-tree', fn: function() { open(); } });

            function onCharChanged() { if (isOpen) _debouncedRender(); }
            function onSkillLearned() { if (isOpen) _debouncedRender(); }

            // 转生事件：发送技能重置请求（CharacterContext 处理）
            function onRebirth() {
                resetSkillTree();
                if (isOpen) render();
            }

            bus.on('char:changed', onCharChanged);
            _listeners.push({ event: 'char:changed', fn: onCharChanged });

            bus.on('char:skillLearned', onSkillLearned);
            _listeners.push({ event: 'char:skillLearned', fn: onSkillLearned });

            bus.on('char:rebirth', onRebirth);
            _listeners.push({ event: 'char:rebirth', fn: onRebirth });

            // 学习结果（init.js 编排 SkillService 后回传）
            function onLearnResult(data) {
                if (data && data.success) {
                    render();
                    if (global.EventBus) {
                        global.EventBus.emit('char:changed', { char: _getChar() });
                    }
                } else {
                    alert('学习失败：' + ((data && data.message) || '未知错误'));
                }
            }
            bus.on('skill:learn-result', onLearnResult);
            _listeners.push({ event: 'skill:learn-result', fn: onLearnResult });

            // 组队状态/佣兵变化 → 刷新队伍技能段（SO_PARTNER）
            function onPartyRefresh() { if (isOpen) render(); }
            bus.on('social:state', onPartyRefresh);
            _listeners.push({ event: 'social:state', fn: onPartyRefresh });
            bus.on('partner:summoned', onPartyRefresh);
            _listeners.push({ event: 'partner:summoned', fn: onPartyRefresh });
            bus.on('partner:despawned', onPartyRefresh);
            _listeners.push({ event: 'partner:despawned', fn: onPartyRefresh });
        }

        _initialized = true;
        console.log('[UISkillTree] ✅ 已初始化（v4.0：SkillGateway + 事件驱动）');

        if (global.UIManager && typeof global.UIManager.register === 'function') {
            global.UIManager.register(global.UISkillTree);
        }
    }

    function dispose() {
        if (_debouncedRender && typeof _debouncedRender.cancel === 'function') {
            _debouncedRender.cancel();
        }

        // 移除面板内事件委托
        var container = document.querySelector('.ro-panel-container');
        if (container) {
            if (container._panelHandler) {
                container.removeEventListener('click', container._panelHandler);
                container.removeEventListener('change', container._panelChangeHandler);
                delete container._panelHandler;
                delete container._panelChangeHandler;
            }
        }

        var bus = global.EventBus;
        if (bus) {
            for (var i = 0; i < _listeners.length; i++) {
                bus.off(_listeners[i].event, _listeners[i].fn);
            }
            _listeners = [];
        }
        for (var j = 0; j < _domListeners.length; j++) {
            var item = _domListeners[j];
            item.el.removeEventListener(item.event, item.fn);
        }
        _domListeners = [];
        // 如果面板还开着，关掉
        close();
        _initialized = false;
        console.log('[UISkillTree] 事件监听已清理');
    }

    global.UISkillTree = {
        name: 'UISkillTree',
        init: init,
        dispose: dispose,
        open: open,
        close: close,
        render: render,
        resetSkillTree: resetSkillTree,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
