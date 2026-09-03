// ================================================================
//  FILE: SkillGateway.js
//  LAYER: gateway（技能静态数据网关——SkillData/SkillGroups/SKILL_RATIOS 唯一读取入口）
//  权限：无（静态只读数据；canLearn 为纯条件计算，无写入）
//  依赖：window.SkillData / SkillGroups / MECHANISM_SUPPLEMENTS / SKILL_PATCHES / SKILL_RATIOS
//  契约：
//    getSkillDef(skillId, level)      → object（深拷贝，已合并 L0基础+L1机制补充+L2专属补丁）
//    getRatio(skillId, level)         → number
//    getCastTime / getCooldown / getSpCost / getSplashArea / isPassive ...
//    getSkillTree(jobKey)             → object|null（职业技能树）
//    getTreeSkillDef(jobKey, skillId) → object|null（树节点定义：maxLevel/baseLevel/jobLevel/preSkills）
//    canLearn(jobKey, skillId, char, learnedSkills) → boolean
//    getMergedSkillData(skillAegis, level) → object（= getSkillDef 的缓存别名，战斗热路径用）
//  规则：S1 / GATE-1 —— 禁止直接读取 window.SkillData / SKILL_RATIOS
//  说明：原 SkillCenter v2.0 + SkillGroupManager + SkillScheduler._getMergedSkillData 合并而成
// ================================================================
(function(global) {
    'use strict';

    var SkillDataRaw = global.SkillData;

    var _skillDataCache = null;
    var _aegisIndex = null;
    var _idIndex = null;
    var _normIndex = null;   // 规范化键 → 原始键（大小写/下划线兼容）
    var _initialized = false;

    // ---- 规范化：不区分大小写、不区分下划线有无（数据兼容原则 5.1） ----
    function _normKey(name) { return String(name || '').toUpperCase().replace(/_/g, ''); }
    function _resolveAegisName(aegisName) {
        if (!_ensureLoaded()) return null;
        if (aegisName === null || aegisName === undefined) return null;
        var key = String(aegisName);
        if (_aegisIndex[key]) return key;                    // 精确命中
        return _normIndex[_normKey(key)] || null;            // 规范化回退
    }

    // ---- 合并数据缓存（原 SkillScheduler 私有缓存迁入） ----
    var _mergedCache = {};

    // ---- 用户可配置参数（原 SkillGroupManager.CONFIG） ----
    var TREE_CONFIG = { defaultMaxLevel: 1 };

    // ============================================================
    //  基础工具
    // ============================================================
    function _clone(obj) { return JSON.parse(JSON.stringify(obj)); }
    function _log(msg, data) { console.log('[SkillGateway] ' + msg, data || ''); }
    function _error(msg, data) { console.error('[SkillGateway] ' + msg, data || ''); }

    function _resolveLevelValue(data, level, valueKey) {
        valueKey = valueKey || 'Amount';
        if (data === undefined || data === null) return 0;
        if (typeof data === 'number') return data;
        if (Array.isArray(data)) {
            for (var i = 0; i < data.length; i++) {
                var item = data[i];
                if (item.Level === level) {
                    if (item[valueKey] !== undefined) return item[valueKey];
                    if (item.Time !== undefined) return item.Time;
                    if (item.Count !== undefined) return item.Count;
                    if (item.Area !== undefined) return item.Area;
                    if (item.Size !== undefined) return item.Size;
                    if (item.Max !== undefined) return item.Max;
                    return item.Value || 0;
                }
            }
            var first = data[0];
            if (first) {
                if (first[valueKey] !== undefined) return first[valueKey];
                if (first.Time !== undefined) return first.Time;
                if (first.Count !== undefined) return first.Count;
                if (first.Area !== undefined) return first.Area;
                if (first.Size !== undefined) return first.Size;
                if (first.Max !== undefined) return first.Max;
                return first.Value || 0;
            }
            return 0;
        }
        if (typeof data === 'object' && data !== null) {
            if (data[valueKey] !== undefined) return data[valueKey];
            if (data.Time !== undefined) return data.Time;
            if (data.Count !== undefined) return data.Count;
            if (data.Area !== undefined) return data.Area;
            if (data.Size !== undefined) return data.Size;
            if (data.Max !== undefined) return data.Max;
            return data.Value || 0;
        }
        return 0;
    }

    // ============================================================
    //  L0：基础数据加载（原 SkillCenter）
    // ============================================================
function _loadSkillData() {
    if (!SkillDataRaw || typeof SkillDataRaw !== 'object') {
        _error('SkillData 未加载或格式错误');
        return false;
    }
    // 如果 SkillDataRaw 是数组，需转换为对象键值对（但已知是对象，此逻辑保留）
    var dataSource = SkillDataRaw;
    if (Array.isArray(dataSource)) {
        // 将数组按 AegisName 转为对象
        var obj = {};
        for (var i = 0; i < dataSource.length; i++) {
            var item = dataSource[i];
            if (item && item.AegisName) obj[item.AegisName] = item;
        }
        dataSource = obj;
    }
    // 深拷贝（如有循环引用会失败，这里可简化，直接使用引用）
    _skillDataCache = dataSource;  // 直接使用，不克隆（避免克隆失败）
    _aegisIndex = {};
    _idIndex = {};
    _normIndex = {};   // 规范化索引（大写 + 去下划线）：兼容外部传入 'mo_tripleattack' / 'MoTripleAttack'
    for (var aegis in _skillDataCache) {
        if (_skillDataCache.hasOwnProperty(aegis)) {
            var config = _skillDataCache[aegis];
            if (config && typeof config === 'object') {
                _aegisIndex[aegis] = config;
                _normIndex[_normKey(aegis)] = aegis;
                if (config.Id !== undefined) _idIndex[config.Id] = config;
            }
        }
    }
    _log('加载完成，共 ' + Object.keys(_aegisIndex).length + ' 个技能');
    return true;
}

    function _ensureLoaded() {
        if (!_aegisIndex) {
            if (!_loadSkillData()) return false;
        }
        return true;
    }

    // ============================================================
    //  L0：查询接口（原 SkillCenter API，全部保留）
    // ============================================================
    function getSkillByAegis(aegisName) {
        if (!_ensureLoaded()) return null;
        var resolved = _resolveAegisName(aegisName);
        var config = resolved ? _aegisIndex[resolved] : null;
        return config ? _clone(config) : null;
    }

    function getSkillById(id) {
        if (!_ensureLoaded()) return null;
        var config = _idIndex[id];
        return config ? _clone(config) : null;
    }

    function getAllSkills() {
        if (!_ensureLoaded()) return {};
        return _skillDataCache ? _clone(_skillDataCache) : {};
    }

    function getSkillsByType(type) {
        var all = getAllSkills();
        var result = [];
        for (var aegis in all) {
            if (all.hasOwnProperty(aegis) && all[aegis].Type === type) result.push(all[aegis]);
        }
        return result;
    }

    function getPassiveSkills() {
        var all = getAllSkills();
        var result = [];
        for (var aegis in all) {
            if (all.hasOwnProperty(aegis) && all[aegis].Passive === true) result.push(all[aegis]);
        }
        return result;
    }

    function hasSkill(aegisName) {
        if (!_ensureLoaded()) return false;
        return !!_resolveAegisName(aegisName);
    }

    function getSkillAtLevel(aegisName, level) {
        var config = getSkillByAegis(aegisName);
        if (!config) return null;
        var maxLevel = config.MaxLevel || 1;
        var effectiveLevel = Math.min(Math.max(1, level || 1), maxLevel);

        return {
            ...config,
            _level: effectiveLevel,
            _spCost: _resolveLevelValue(config.SpCost, effectiveLevel, 'Amount'),
            _hpCost: _resolveLevelValue(config.HpCost, effectiveLevel, 'Amount'),
            _zenyCost: _resolveLevelValue(config.ZenyCost, effectiveLevel, 'Amount'),
            _apCost: _resolveLevelValue(config.ApCost, effectiveLevel, 'Amount'),
            _castTime: _resolveLevelValue(config.CastTime, effectiveLevel, 'Time'),
            _fixedCastTime: _resolveLevelValue(config.FixedCastTime, effectiveLevel, 'Time'),
            _cooldown: _resolveLevelValue(config.Cooldown, effectiveLevel, 'Time'),
            _afterCastActDelay: _resolveLevelValue(config.AfterCastActDelay, effectiveLevel, 'Time'),
            _afterCastWalkDelay: _resolveLevelValue(config.AfterCastWalkDelay, effectiveLevel, 'Time'),
            _duration1: _resolveLevelValue(config.Duration1, effectiveLevel, 'Time'),
            _duration2: _resolveLevelValue(config.Duration2, effectiveLevel, 'Time'),
            _hitCount: _resolveLevelValue(config.HitCount, effectiveLevel, 'Count'),
            _splashArea: _resolveLevelValue(config.SplashArea, effectiveLevel, 'Area'),
            _range: _resolveLevelValue(config.Range, effectiveLevel, 'Size'),
            _knockback: _resolveLevelValue(config.Knockback, effectiveLevel, 'Amount'),
            _giveAp: _resolveLevelValue(config.GiveAp, effectiveLevel, 'Amount'),
            _statusChance: _resolveLevelValue(config.StatusChance, effectiveLevel, 'Amount'),
            _ammoAmount: _resolveLevelValue(config.Requires && config.Requires.AmmoAmount, effectiveLevel, 'Amount'),
            _spiritSphereCost: _resolveLevelValue(config.Requires && config.Requires.SpiritSphereCost, effectiveLevel, 'Amount'),
        };
    }

    function getSkillRatio(aegisName, level) {
        var config = getSkillByAegis(aegisName);
        if (!config || !config.SkillRatio) return 100;
        var ratio = config.SkillRatio;
        var effectiveLevel = Math.min(Math.max(1, level || 1), config.MaxLevel || 1);
        if (ratio.Type === 'fixed') {
            var values = ratio.Values || [];
            return values[effectiveLevel - 1] || 100;
        } else if (ratio.Type === 'linear') {
            return (ratio.Base || 0) + (ratio.PerLevel || 0) * (effectiveLevel - 1);
        }
        return 100;
    }

    function getSpCost(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._spCost : 0; }
    function getHpCost(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._hpCost : 0; }
    function getZenyCost(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._zenyCost : 0; }
    function getCastTime(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._castTime : 0; }
    function getFixedCastTime(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._fixedCastTime : 0; }
    function getCooldown(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._cooldown : 0; }
    function getAfterCastActDelay(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._afterCastActDelay : 0; }
    function getAfterCastWalkDelay(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._afterCastWalkDelay : 0; }
    function getDuration(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._duration1 : 0; }
    function getHitCount(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._hitCount : 1; }
    function getSplashArea(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._splashArea : 0; }
    function getKnockback(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._knockback : 0; }
    function getStatusChance(aegisName, level) { var d = getSkillAtLevel(aegisName, level); return d ? d._statusChance : 0; }

    function getRequires(aegisName, level) {
        var config = getSkillByAegis(aegisName);
        if (!config || !config.Requires) return null;
        var req = _clone(config.Requires);
        if (level !== undefined) {
            if (req.AmmoAmount) req.AmmoAmount = _resolveLevelValue(req.AmmoAmount, level, 'Amount');
            if (req.SpiritSphereCost) req.SpiritSphereCost = _resolveLevelValue(req.SpiritSphereCost, level, 'Amount');
            if (req.HpRateCost) req.HpRateCost = _resolveLevelValue(req.HpRateCost, level, 'Amount');
            if (req.SpRateCost) req.SpRateCost = _resolveLevelValue(req.SpRateCost, level, 'Amount');
            if (req.MaxHpTrigger) req.MaxHpTrigger = _resolveLevelValue(req.MaxHpTrigger, level, 'Amount');
        }
        return req;
    }

    function getDamageFlags(aegisName) {
        var config = getSkillByAegis(aegisName);
        return config ? (config.DamageFlags ? _clone(config.DamageFlags) : null) : null;
    }
    function getFlags(aegisName) {
        var config = getSkillByAegis(aegisName);
        return config ? (config.Flags ? _clone(config.Flags) : null) : null;
    }
    function getCopyFlags(aegisName) {
        var config = getSkillByAegis(aegisName);
        return config ? (config.CopyFlags ? _clone(config.CopyFlags) : null) : null;
    }
    function getUnit(aegisName) {
        var config = getSkillByAegis(aegisName);
        return config ? (config.Unit ? _clone(config.Unit) : null) : null;
    }
    function getStatus(aegisName) {
        var config = getSkillByAegis(aegisName);
        return config ? config.Status : null;
    }
    function getApplyFlags(aegisName) {
        var config = getSkillByAegis(aegisName);
        return config ? (config.ApplyFlags ? _clone(config.ApplyFlags) : null) : null;
    }
    function getElement(aegisName, level) {
        var config = getSkillByAegis(aegisName);
        if (!config) return 'Neutral';
        var elem = config.Element;
        if (typeof elem === 'string') return elem;
        if (Array.isArray(elem)) {
            var value = _resolveLevelValue(elem, level || 1, 'Element');
            return value || 'Neutral';
        }
        return 'Neutral';
    }
    function getRange(aegisName, level) {
        var config = getSkillByAegis(aegisName);
        if (!config) return 9;
        var range = config.Range;
        if (typeof range === 'number') return range;
        if (Array.isArray(range)) return _resolveLevelValue(range, level || 1, 'Size');
        return 9;
    }

    // ============================================================
    //  合并数据（L0 基础 + L1 机制补充 + L2 专属补丁；原 SkillScheduler._getMergedSkillData）
    // ============================================================
    function getSkillDef(skillAegis, skillLevel) {
        return getMergedSkillData(skillAegis, skillLevel);
    }

    function getMergedSkillData(skillAegis, skillLevel) {
        if (!_ensureLoaded()) return null;
        // 名称规范化：外部传 'mo_tripleattack' 也能取到 MO_TRIPLEATTACK 的合并数据
        var canonical = _resolveAegisName(skillAegis);
        if (canonical) skillAegis = canonical;
        skillLevel = skillLevel || 1;
        var cacheKey = skillAegis + '|' + skillLevel;
        if (_mergedCache[cacheKey]) return _mergedCache[cacheKey];

        var skillData = null;
        var ratio = 100;

        // ---- L0：SkillCenter 标准解析 ----
        skillData = getSkillAtLevel(skillAegis, skillLevel);
        ratio = getSkillRatio(skillAegis, skillLevel) || 100;

        // ---- L0 降级：SkillData 原始结构（网关内部允许直接读取） ----
        if (!skillData) {
            var baseInfo = null;
            if (SkillDataRaw) {
                if (Array.isArray(SkillDataRaw)) {
                    for (var i = 0; i < SkillDataRaw.length; i++) {
                        if (SkillDataRaw[i].Name === skillAegis) { baseInfo = SkillDataRaw[i]; break; }
                    }
                } else if (typeof SkillDataRaw === 'object') {
                    baseInfo = SkillDataRaw[skillAegis];
                    if (!baseInfo) {
                        for (var key in SkillDataRaw) {
                            if (SkillDataRaw[key].Name === skillAegis) { baseInfo = SkillDataRaw[key]; break; }
                        }
                    }
                }
            }

            skillData = {
                _range: 1, RangeType: 'fixed', Hit: 'Single', _hitCount: 1,
                Passive: false, MaxLevel: 10, _castTime: 0, _fixedCastTime: 0,
                _cooldown: 0, _afterCastActDelay: 0,
                _spCost: (global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5,
                DamageFlags: {}, TargetType: 'Attack', Requires: null, ApplyFlags: null,
                _raw: baseInfo,
            };

            if (baseInfo) {
                if (baseInfo.Range !== undefined) skillData._range = baseInfo.Range;
                if (baseInfo.RangeType) skillData.RangeType = baseInfo.RangeType;
                if (baseInfo.Hit) skillData.Hit = baseInfo.Hit;
                if (baseInfo.HitCount !== undefined) {
                    if (Array.isArray(baseInfo.HitCount)) {
                        var hitVal = 1;
                        for (var idx = 0; idx < baseInfo.HitCount.length; idx++) {
                            var entry = baseInfo.HitCount[idx];
                            if (entry.Level === skillLevel) { hitVal = entry.Count || 1; break; }
                        }
                        if (hitVal === 1 && baseInfo.HitCount.length > 0) hitVal = baseInfo.HitCount[0].Count || 1;
                        skillData._hitCount = hitVal;
                    } else {
                        skillData._hitCount = baseInfo.HitCount;
                    }
                }
                if (baseInfo.Passive !== undefined) skillData.Passive = baseInfo.Passive;
                if (baseInfo.MaxLevel) skillData.MaxLevel = baseInfo.MaxLevel;
                if (baseInfo.DamageFlags) skillData.DamageFlags = baseInfo.DamageFlags;
                if (baseInfo.TargetType) skillData.TargetType = baseInfo.TargetType;

                skillData._castTime = _resolveLevelValue(baseInfo.CastTime, skillLevel, 'Time');
                skillData._fixedCastTime = _resolveLevelValue(baseInfo.FixedCastTime, skillLevel, 'Time');
                skillData._cooldown = _resolveLevelValue(baseInfo.Cooldown, skillLevel, 'Time');
                skillData._afterCastActDelay = _resolveLevelValue(baseInfo.AfterCastActDelay, skillLevel, 'Time');
                skillData._spCost = _resolveLevelValue(baseInfo.SpCost, skillLevel, 'Amount') || ((global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5);
                skillData._splashArea = _resolveLevelValue(baseInfo.SplashArea, skillLevel, 'Area');
            }

            // ---- SKILL_RATIOS 降级读取 ----
            if (global.SKILL_RATIOS && Array.isArray(global.SKILL_RATIOS)) {
                for (var r = 0; r < global.SKILL_RATIOS.length; r++) {
                    if (global.SKILL_RATIOS[r].skill_name === skillAegis) {
                        var ratioData = global.SKILL_RATIOS[r];
                        if (ratioData.clean_ratio) {
                            var cr = ratioData.clean_ratio;
                            if (cr.type === 'linear') {
                                ratio = (cr.base || 100) + (cr.per_level || 0) * (skillLevel - 1);
                            } else if (typeof cr.base === 'number') {
                                ratio = cr.base;
                            }
                        }
                        break;
                    }
                }
            }
        }

        // ---- 组装标准化结果 ----
        // HitCount 语义：本数据集以负数表示"N 段"（如 -8 = 8 段），取绝对值后钳制
        var rawHitCount = (typeof skillData._hitCount === 'number') ? Math.abs(skillData._hitCount) : 1;
        var result = {
            Name: skillAegis,
            Range: (typeof skillData._range === 'number') ? skillData._range : 1,
            RangeType: skillData.RangeType || 'fixed',
            Hit: (skillData.Hit === 'Multi_Hit' || skillData.Hit === 'Multi') ? 'Multi' : 'Single',
            HitCount: (rawHitCount > 0) ? Math.min(rawHitCount, 20) : 1,
            Passive: !!skillData.Passive,
            MaxLevel: skillData.MaxLevel || 10,
            CastTime: (typeof skillData._castTime === 'number') ? skillData._castTime / 1000 : 0,
            FixedCastTime: (typeof skillData._fixedCastTime === 'number') ? skillData._fixedCastTime / 1000 : 0,
            Cooldown: (typeof skillData._cooldown === 'number') ? skillData._cooldown / 1000 : 0,
            AfterCastActDelay: (typeof skillData._afterCastActDelay === 'number') ? skillData._afterCastActDelay / 1000 : 0,
            spCost: (typeof skillData._spCost === 'number') ? skillData._spCost : ((global.SKILL_CONFIG && global.SKILL_CONFIG.DEFAULT_SP_COST) || 5),
            DamageFlags: skillData.DamageFlags || {},
            Element: skillData.Element || null,        // 技能自带元素（Water/Fire/...；'Weapon'=跟随武器）
            modifiers: skillData.modifiers || null,    // ★ 加成插入点配置（H1-H9；供 BonusCollector 消费）
            TargetType: skillData.TargetType || 'Attack',
            Requires: skillData.Requires || null,
            ApplyFlags: skillData.ApplyFlags || null,
            Status: skillData.Status || null,          // 状态施加目标（如 Freeze/Stun，供执行链消费）
            StatusChance: (typeof skillData._statusChance === 'number') ? skillData._statusChance : null,
            _raw: skillData._raw || skillData,
            _cachedRatio: ratio,
            _splashArea: skillData._splashArea || 0,
            Type: skillData.Type || skillData._raw?.Type || 'Weapon',   // ← 新增这一行，传递构魔法攻击力参数
        };

        // ---- L1：机制补充 ----
        if (global.MECHANISM_SUPPLEMENTS && Array.isArray(global.MECHANISM_SUPPLEMENTS)) {
            for (var s = 0; s < global.MECHANISM_SUPPLEMENTS.length; s++) {
                var rule = global.MECHANISM_SUPPLEMENTS[s];
                if (rule.match && typeof rule.match === 'function' && rule.match(skillAegis)) {
                    var supp = rule.supplement || {};
                    for (var prop in supp) {
                        if (result[prop] === undefined || result[prop] === null) result[prop] = supp[prop];
                    }
                }
            }
        }

        // ---- L2：专属补丁 ----
        if (global.SKILL_PATCHES && global.SKILL_PATCHES[skillAegis]) {
            var patch = global.SKILL_PATCHES[skillAegis];
            for (var p in patch) result[p] = patch[p];
        }

        _mergedCache[cacheKey] = result;
        return result;
    }

    function getRatio(skillAegis, level) {
        var merged = getMergedSkillData(skillAegis, level);
        return merged ? (merged._cachedRatio || 100) : 100;
    }

    function clearMergedCache() { _mergedCache = {}; }

    // ============================================================
    //  职业技能树（原 SkillGroupManager 并入）
    // ============================================================
    var _skillGroupsCache = null;

    function _getSkillGroups() {
        if (_skillGroupsCache) return _skillGroupsCache;
        if (global.SkillGroups && typeof global.SkillGroups === 'object') {
            _skillGroupsCache = global.SkillGroups;
            return _skillGroupsCache;
        }
        console.warn('[SkillGateway] SkillGroups 未加载');
        return null;
    }

    function getSkillTree(jobKey) {
        var groups = _getSkillGroups();
        if (!groups) return null;
        return groups[jobKey] || null;
    }

    function getTreeSkillDef(jobKey, skillId) {
        var tree = getSkillTree(jobKey);
        if (!tree || !tree.skills || !Array.isArray(tree.skills)) {
            console.warn('[SkillGateway] 职业技能树无效:', jobKey);
            return null;
        }
        var skill = tree.skills.find(function(s) { return s.id === skillId; });
        if (!skill) return null;
        return {
            id: skill.id,
            maxLevel: skill.maxLevel || TREE_CONFIG.defaultMaxLevel,
            baseLevel: skill.baseLevel || 0,
            jobLevel: skill.jobLevel || 0,
            preSkills: skill.preSkills || [],
            _raw: skill,
        };
    }

    function canLearn(jobKey, skillId, char, learnedSkills, opts) {
        var def = getTreeSkillDef(jobKey, skillId);
        if (!def) return false;

        if (char.level < def.baseLevel) return false;
        // 跨职业继承：历史职业树技能跳过 JobLv 校验（旧职业 JobLv 已不存在，技能前置仍校验）
        if (!(opts && opts.skipJobLevel) && char.jobLevel < def.jobLevel) return false;

        var preSkills = def.preSkills || [];
        if (preSkills.length > 0) {
            var learned = learnedSkills || {};
            for (var i = 0; i < preSkills.length; i++) {
                var pre = preSkills[i];
                var currentLevel = learned[pre.id] || 0;
                if (currentLevel < pre.level) return false;
            }
        }

        var currentLevel = learnedSkills ? (learnedSkills[skillId] || 0) : 0;
        if (currentLevel >= def.maxLevel) return false;

        return true;
    }

    // ============================================================
    //  初始化
    // ============================================================
    function init() {
        if (_initialized) return;
        if (!_loadSkillData()) {
            _error('SkillGateway 初始化失败：技能数据未加载');
            return;
        }
        _initialized = true;
        _log('初始化完成，共 ' + Object.keys(_aegisIndex).length + ' 个技能');
    }

    var SkillGateway = {
        init: init,
        // L0 查询
        getSkillByAegis: getSkillByAegis,
        resolveAegis: _resolveAegisName,   // 技能名规范化（大小写/下划线兼容 → 原始键）
        getSkillById: getSkillById,
        getAllSkills: getAllSkills,
        getSkillsByType: getSkillsByType,
        getPassiveSkills: getPassiveSkills,
        hasSkill: hasSkill,
        getSkillAtLevel: getSkillAtLevel,
        getSkillRatio: getSkillRatio,
        getRatio: getRatio,
        getSpCost: getSpCost,
        getHpCost: getHpCost,
        getZenyCost: getZenyCost,
        getCastTime: getCastTime,
        getFixedCastTime: getFixedCastTime,
        getCooldown: getCooldown,
        getAfterCastActDelay: getAfterCastActDelay,
        getAfterCastWalkDelay: getAfterCastWalkDelay,
        getDuration: getDuration,
        getHitCount: getHitCount,
        getSplashArea: getSplashArea,
        getKnockback: getKnockback,
        getStatusChance: getStatusChance,
        getRequires: getRequires,
        getDamageFlags: getDamageFlags,
        getFlags: getFlags,
        getCopyFlags: getCopyFlags,
        getUnit: getUnit,
        getStatus: getStatus,
        getApplyFlags: getApplyFlags,
        getElement: getElement,
        getRange: getRange,
        // 合并数据
        getSkillDef: getSkillDef,
        getMergedSkillData: getMergedSkillData,
        clearMergedCache: clearMergedCache,
        // 技能树
        getSkillTree: getSkillTree,
        getTreeSkillDef: getTreeSkillDef,
        canLearn: canLearn,
        _debug: function() {
            console.log('[SkillGateway] 技能总数:', _skillDataCache ? Object.keys(_skillDataCache).length : 0,
                '合并缓存:', Object.keys(_mergedCache).length);
        },
    };

    global.SkillGateway = SkillGateway;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('[SkillGateway] ✅ 已加载（技能数据网关：L0+L1+L2 合并中心）');
})(window);
