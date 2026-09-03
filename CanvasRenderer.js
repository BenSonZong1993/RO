// ================================================================
//  📁 js/render/CanvasRenderer.js
//  版本：v11.6（淡色提示 + 缩短显示时间）
// ================================================================

window.CanvasRenderer = (() => {
    'use strict';

    // ============================================================
    //  ★★★ 用户配置区（调这里解决黑边/闪烁） ★★★
    // ============================================================
    const ZOOM_CONFIG = {
        // 自适应开关：true = 根据缩放动态调整额外瓦片数；false = 使用固定值
        autoAdjustExtra: true,

        // 当缩放为 1.0 时的基础额外行列数（自适应模式下有效）
        // 缩放越小，实际额外数 = ceil(extraBase / zoom)
        extraBase: 3,

        // ★ 最小额外行列数（防止放大时过少导致黑边）
        // 建议设置为 2~4，根据你的屏幕和瓦片大小调整
        minExtra: 4,

        // 固定模式的额外行列数（当 autoAdjustExtra = false 时使用）
        fixedExtraCols: 4,
        fixedExtraRows: 4,

        // 起始偏移（瓦片数），通常为负值，向左/上偏移
        startOffsetX: -2,
        startOffsetY: -2,

        // 强制瓦片大小（0 = 自动）
        forceTileSize: 0,
    };
    // ============================================================

    let _canvas = null;
    let _ctx = null;
    let _dpr = 1;
    let _logicWidth = 0;
    let _logicHeight = 0;
    let _viewWidth = 0;
    let _viewHeight = 0;
    let _worldOffsetX = 0;
    let _worldOffsetY = 0;
    let _currentMapId = '';
    let _currentTileSize = 512;
    let _browserZoom = 1;
    let _playerRadius = 24;
    let _monsterRadius = 24;
    let _playerVisualScale = 1;
    let _terrainCache = {};

    let _cameraZoom = 1.0;
    const ZOOM_MIN = 0.5;
    const ZOOM_MAX = 2.0;
    const ZOOM_STEP = 0.1;
    let _lastTouchDist = 0;

    let _zoomNotifyEndTime = 0;
    let _tipEndTime = 0;
    let _hasShownTip = false;

    // ------------------------------------
    function _getConfig() {
        return window.RenderConfig || window.UIConfig?.render || null;
    }

    function _loadPlayerRadius(cfg) {
        const p = cfg?.PLAYER || {};
        const base = p.radius || 24;
        const scale = p.visualScale || 1.0;
        _playerRadius = base * scale;
        _playerVisualScale = scale;
        if (_playerRadius < 1) _playerRadius = 1;
    }

    function _loadMonsterRadius(cfg) {
        const m = cfg?.MONSTER || {};
        _monsterRadius = m.radius || 24;
        if (_monsterRadius < 1) _monsterRadius = 1;
    }

    function _getBrowserZoom() {
        if (window.visualViewport && typeof window.visualViewport.scale === 'number') {
            return window.visualViewport.scale;
        }
        if (window.outerWidth > 0) {
            return window.innerWidth / window.outerWidth;
        }
        return 1;
    }

    function _getTerrainForMap(mapId) {
        if (!mapId) return 'field';
        if (_terrainCache[mapId]) return _terrainCache[mapId];
        let terrain = 'field';
        if (window.MapDataGateway && typeof window.MapDataGateway.getTerrain === 'function') {
            const t = window.MapDataGateway.getTerrain(mapId);
            if (t) terrain = t;
        }
        _terrainCache[mapId] = terrain;
        return terrain;
    }

    function _updateTileTexture(mapId) {
        if (!mapId) return;
        if (window.TerrainGenerator && typeof window.TerrainGenerator.getTileTexture === 'function') {
            try {
                const tex = window.TerrainGenerator.getTileTexture(mapId);
                if (tex) {
                    window.__RO_TILE_CANVAS = tex;
                    return;
                }
            } catch (_) {}
        }
        if (window.TerrainTemplates && typeof window.TerrainTemplates.generateTile === 'function') {
            try {
                const tex = window.TerrainTemplates.generateTile(mapId, _currentTileSize);
                if (tex) {
                    window.__RO_TILE_CANVAS = tex;
                    return;
                }
            } catch (_) {}
        }
        const canvas = document.createElement('canvas');
        canvas.width = _currentTileSize;
        canvas.height = _currentTileSize;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(0, 0, _currentTileSize, _currentTileSize);
        window.__RO_TILE_CANVAS = canvas;
    }

    function _calcTileSize() {
        if (ZOOM_CONFIG.forceTileSize > 0) {
            return ZOOM_CONFIG.forceTileSize;
        }
        _browserZoom = _getBrowserZoom();
        let newSize = 512;
        if (_browserZoom < 1) {
            const increase = 1 - _browserZoom;
            newSize = Math.round(512 * (1 + increase));
        }
        if (newSize < 128) newSize = 128;
        if (newSize > 2048) newSize = 2048;
        return newSize;
    }

    // ★ 缩放反馈显示 1 秒
    function _applyZoom(delta) {
        let newZoom = _cameraZoom + delta;
        newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, newZoom));
        if (newZoom !== _cameraZoom) {
            _cameraZoom = newZoom;
            _zoomNotifyEndTime = performance.now() + 500; // 1 秒
            console.log('[CanvasRenderer] 摄像机缩放:', _cameraZoom.toFixed(2));
        }
    }

    function _bindZoomEvents() {
        if (!_canvas) return;
        _canvas.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
                _applyZoom(delta);
            }
        }, { passive: false });

        _canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                _lastTouchDist = Math.sqrt(dx * dx + dy * dy);
            }
        }, { passive: true });

        _canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (_lastTouchDist > 0) {
                    const delta = dist - _lastTouchDist;
                    if (Math.abs(delta) > 3) {
                        const zoomDelta = delta > 0 ? ZOOM_STEP : -ZOOM_STEP;
                        _applyZoom(zoomDelta);
                        _lastTouchDist = dist;
                    }
                }
            }
        }, { passive: false });

        _canvas.addEventListener('touchend', () => {
            _lastTouchDist = 0;
        }, { passive: true });
    }

    // ---------- 公开接口 ----------
    function init(canvas) {
        _canvas = canvas;
        _ctx = canvas.getContext('2d');
        _dpr = window.devicePixelRatio || 1;
        const cfg = _getConfig();
        _loadPlayerRadius(cfg);
        _loadMonsterRadius(cfg);
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        _bindZoomEvents();

        // ★ 首次提示显示 2 秒
        if (!_hasShownTip) {
            _tipEndTime = performance.now() + 3250;
            _hasShownTip = true;
        }
        return true;
    }

    function resizeCanvas() {
        if (!_canvas) return;
        const parent = _canvas.parentElement;
        if (!parent) return;
        const rect = parent.getBoundingClientRect();
        _viewWidth = Math.max(1, Math.floor(rect.width));
        _viewHeight = Math.max(1, Math.floor(rect.height));
        _logicWidth = _viewWidth;
        _logicHeight = _viewHeight;
        _canvas.width = Math.round(_logicWidth * _dpr);
        _canvas.height = Math.round(_logicHeight * _dpr);
        _canvas.style.width = _viewWidth + 'px';
        _canvas.style.height = _viewHeight + 'px';
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.scale(_dpr, _dpr);

        const cfg = _getConfig();
        _loadPlayerRadius(cfg);
        _loadMonsterRadius(cfg);

        const newTileSize = _calcTileSize();
        if (newTileSize !== _currentTileSize) {
            _currentTileSize = newTileSize;
            if (_currentMapId) {
                _updateTileTexture(_currentMapId);
            }
        }
    }

    function setBackground(mapId) {
        _currentMapId = mapId;
        _terrainCache = {};
        _updateTileTexture(mapId);
        if (!_hasShownTip) {
            _tipEndTime = performance.now() + 2000;
            _hasShownTip = true;
        }
    }

    function updateBackgroundOffset(worldX, worldY) {
        _worldOffsetX = worldX - _logicWidth / 2;
        _worldOffsetY = worldY - _logicHeight / 2;
    }

    function getCanvasSize() { return { width: _logicWidth, height: _logicHeight }; }
    function getBackgroundSize() { return { width: 1e8, height: 1e8 }; }
    function getPlayerPosition() { return { x: _logicWidth / 2, y: _logicHeight / 2 }; }
    function getPlayerRadius() { return _playerRadius; }
    function getMonsterRadius() { return _monsterRadius; }
    function getTileSize() { return _currentTileSize; }
    function getBrowserZoom() { return _browserZoom; }
    function getCameraZoom() { return _cameraZoom; }

    function getPlayerAttackRange() {
        const cfg = _getConfig();
        const factor = cfg?.playerAttackRangeFactor || 1.5;
        return _playerRadius * factor;
    }

    function getMonsterAttackRange() {
        const cfg = _getConfig();
        const factor = cfg?.monsterAttackRangeFactor || 1.0;
        return _monsterRadius * factor;
    }

    // ---------- 渲染 ----------
    function updateAndRender(state) {
        if (state && state.playerPos) {
            updateBackgroundOffset(state.playerPos.x, state.playerPos.y);
        }
        render(state);
    }

    function render(state) {
        if (_logicWidth < 1 || _logicHeight < 1) {
            resizeCanvas();
            if (_logicWidth < 1 || _logicHeight < 1) return;
        }
        if (!_ctx) return;

        const ctx = _ctx;
        const w = _logicWidth;
        const h = _logicHeight;
        const cfg = _getConfig();
        const offX = _worldOffsetX;
        const offY = _worldOffsetY;
        const margin = 50;
        const now = performance.now();

        ctx.clearRect(0, 0, w, h);
        ctx.imageSmoothingEnabled = false;

        // ========== 世界空间 ==========
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(_cameraZoom, _cameraZoom);
        ctx.translate(-w / 2, -h / 2);

        // --- 1. 地形 ---
        const tileCanvas = window.__RO_TILE_CANVAS;
        if (tileCanvas && cfg?.TERRAIN?.drawTerrain !== false) {
            const tileSize = _currentTileSize;
            const zoom = _cameraZoom;
            const worldViewWidth = w / zoom;
            const worldViewHeight = h / zoom;
            const viewLeft = offX;
            const viewTop = offY;

            let extraCols, extraRows;
            if (ZOOM_CONFIG.autoAdjustExtra) {
                const base = ZOOM_CONFIG.extraBase;
                const minExtra = ZOOM_CONFIG.minExtra;
                extraCols = Math.max(minExtra, Math.ceil(base / zoom));
                extraRows = Math.max(minExtra, Math.ceil(base / zoom));
            } else {
                extraCols = ZOOM_CONFIG.fixedExtraCols;
                extraRows = ZOOM_CONFIG.fixedExtraRows;
            }

            const startX = Math.floor(viewLeft / tileSize) * tileSize + ZOOM_CONFIG.startOffsetX * tileSize;
            const startY = Math.floor(viewTop / tileSize) * tileSize + ZOOM_CONFIG.startOffsetY * tileSize;
            const cols = Math.ceil(worldViewWidth / tileSize) + extraCols;
            const rows = Math.ceil(worldViewHeight / tileSize) + extraRows;

            for (let i = 0; i < cols; i++) {
                for (let j = 0; j < rows; j++) {
                    const wx = startX + i * tileSize;
                    const wy = startY + j * tileSize;
                    const dx = wx - viewLeft;
                    const dy = wy - viewTop;
                    ctx.drawImage(tileCanvas, dx, dy, tileSize, tileSize);
                }
            }
        }

        // --- 2. 怪物 ---
        if (state.monsters && window.EntityRenderer) {
            for (const m of state.monsters) {
                if (m.alive === false) continue;
                const sx = m.x - offX;
                const sy = m.y - offY;
                if (sx < -margin || sx > w + margin || sy < -margin || sy > h + margin) continue;
                window.EntityRenderer.drawMonster(ctx, sx, sy, m, cfg);
            }
        }

        // --- 3. 队友 ---
        if (state.partner && window.EntityRenderer) {
            const psx = state.partner.x - offX;
            const psy = state.partner.y - offY;
            if (psx > -margin && psx < w + margin && psy > -margin && psy < h + margin) {
                window.EntityRenderer.drawPartner(ctx, psx, psy, state.partner, cfg, _playerVisualScale);
            }
        }

        // --- 4. 玩家 ---
        if (state.player && window.EntityRenderer) {
            const px = w / 2;
            const py = h / 2;
            window.EntityRenderer.drawPlayer(ctx, px, py, state.player, cfg, _playerRadius, _playerVisualScale);
        }

        // --- 5. 世界覆盖层 ---
        if (window.OverlayRenderer) {
            if (state.damageNumbers) {
                window.OverlayRenderer.drawDamageNumbers(ctx, state.damageNumbers, offX, offY, cfg);
            }
            if (state.experienceNumbers) {
                window.OverlayRenderer.drawExperienceNumbers(ctx, state.experienceNumbers, offX, offY, cfg, _viewWidth, _viewHeight);
            }
            if (state.lootNotifications) {
                window.OverlayRenderer.drawLootNotifications(ctx, state.lootNotifications, offX, offY, cfg);
            }
            if (state.skillNames) {
                window.OverlayRenderer.drawSkillNames(ctx, state.skillNames, offX, offY, cfg);
            }
            if (state.interruptTexts) {
                window.OverlayRenderer.drawInterruptTexts(ctx, state.interruptTexts, offX, offY, cfg);
            }
            if (state.player && state.skillStatus) {
                window.OverlayRenderer.drawSkillStatus(ctx, state.player, state.skillStatus, cfg, _viewWidth, _viewHeight);
            }
        }

        // --- 6. 粒子 ---
        if (window.ParticleRenderer) {
            if (typeof window.__PARTICLE_LAST_TIME === 'undefined') {
                window.__PARTICLE_LAST_TIME = performance.now();
            }
            const delta = Math.min(now - window.__PARTICLE_LAST_TIME, 50);
            window.__PARTICLE_LAST_TIME = now;
            const terrain = _getTerrainForMap(_currentMapId);
            window.ParticleRenderer.update(delta, _logicWidth, _logicHeight, terrain);
            window.ParticleRenderer.draw(ctx, _worldOffsetX, _worldOffsetY, _logicWidth, _logicHeight, terrain);
        }

        ctx.restore();

        // ========== 屏幕空间（HUD） ==========
        if (window.OverlayRenderer) {
            if (state.player) {
                window.OverlayRenderer.drawHUD(ctx, state.player, cfg, _viewWidth, _viewHeight);
            }
            if (state.player && state.skillStatus) {
                window.OverlayRenderer.drawCooldownList(ctx, state.skillStatus, cfg, _viewWidth, _viewHeight);
            }
        }

        // ---- ★ 7. 缩放百分比反馈（半透明白色，1秒） ----
        if (now < _zoomNotifyEndTime) {
            const percent = Math.round(_cameraZoom * 100);
            // 0.3秒淡出
            const alpha = Math.min(1, (_zoomNotifyEndTime - now) / 300);
            ctx.save();
            ctx.globalAlpha = alpha * 0.75; // 半透明
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 8;
            ctx.font = 'bold 38px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.5)'; // 半透明白
            ctx.fillText(`🔍 缩放: ${percent}%`, w / 2, h / 2 - 80);
            ctx.restore();
        }

        // ---- ★ 8. 首次提示（半透明白色，2秒） ----
        // 微调 alpha * 0.5 和 fillStyle 的 alpha 值
        if (now < _tipEndTime) {
            const remaining = (_tipEndTime - now) / 1000;
            const alpha = remaining < 0.5 ? remaining / 0.5 : 1; // 最后0.5秒淡出
            ctx.save();
            ctx.globalAlpha = alpha * 0.5; // 整体半透明
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 6;
            ctx.font = '20px Arial, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            const txt = '💡 提示：按住 Ctrl + 滚轮 或 双指捏合 可缩放视角';
            const metrics = ctx.measureText(txt);
            const pad = 16;
            const barX = (w - metrics.width - pad * 2) / 2;
            const barY = h - 50;
            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(0,0,0,0.3)'; // 更淡的背景
            ctx.beginPath();
            ctx.roundRect(barX - 4, barY - 12, metrics.width + pad * 2 + 8, 36, 8);
            ctx.fill();
            ctx.shadowBlur = 6;
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillText(txt, w / 2, h - 22);
            ctx.restore();
        }
    }

    function registerTerrain(mapId, terrain) {
        _terrainCache[mapId] = terrain;
    }

    return {
        init,
        render,
        updateAndRender,
        resizeCanvas,
        getCanvasSize,
        getPlayerPosition,
        setBackground,
        updateBackgroundOffset,
        getPlayerRadius,
        getMonsterRadius,
        getBackgroundSize,
        registerTerrain,
        getTileSize,
        getBrowserZoom,
        getPlayerAttackRange,
        getMonsterAttackRange,
        getCameraZoom,
    };
})();

console.log('[CanvasRenderer] ✅ v11.6 已加载（淡色提示 + 短时显示）');