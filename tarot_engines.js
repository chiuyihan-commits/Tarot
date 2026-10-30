/* ==========================================================================
   ✨ 數位塔羅祭壇-終極效能優化版物理引擎核心 (tarot_engines_optimized.js)
   ========================================================================== */
const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint, Events, Query } = Matter;
const engine = Engine.create({
    enableSleeping: true
});
const world = engine.world;
engine.gravity.y = 0;
engine.gravity.x = 0;

const container = document.getElementById('canvas-container');
let width = window.innerWidth;
let height = window.innerHeight;

const render = Render.create({
    element: container,
    engine: engine,
    options: {
        width: width,
        height: height,
        background: 'transparent',
        wireframes: false,
        showSleeping: false,
        pixelRatio: Math.min(window.devicePixelRatio, 2)
    }
});
Render.run(render);

const runner = Runner.create();
Runner.start(runner, engine);

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        Runner.stop(runner);
    } else {
        Runner.start(runner, engine);
    }
});

let cards = [];
let currentState = 'IDLE';
let spreadSlots = [];
let drawnCount = 0;
let selectedCard = null;
let walls = [];
let shuffleIdleTimer = null;
let drawnCardsStack = [];

let physicsFrameCount = 0;

// ✨ 效能優化：裝置偵測與動態物理降頻常數
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const ZSORT_INTERVAL = isMobile ? 15 : 5;       // Z軸排序頻率
const REPULSION_INTERVAL = isMobile ? 6 : 2;    // 排斥力場觸發頻率
const REPULSION_PAIRS = isMobile ? 15 : 30;     // 每次隨機抽樣的排斥對數

const shuffleZone = {
    x: 0,
    y: 0,
    width: width,
    height: height,
    centerX: width / 2,
    centerY: height / 2
};

function updateWalls() {
    if (walls.length > 0) Composite.remove(world, walls);

    const rect = container.getBoundingClientRect();
    width = rect.width || window.innerWidth;
    height = rect.height || window.innerHeight;

    shuffleZone.top = height * 0.05;
    shuffleZone.bottom = height * 0.85;
    shuffleZone.centerY = (shuffleZone.top + shuffleZone.bottom) / 2;
    shuffleZone.centerX = width / 2;

    const wallThick = 500;
    walls = [
        Bodies.rectangle(width / 2, shuffleZone.top-wallThick / 2, width * 2, wallThick, { isStatic: true, render: { visible: false } }),
        Bodies.rectangle(width / 2, shuffleZone.bottom + wallThick / 2, width * 2, wallThick, { isStatic: true, render: { visible: false } }),
        Bodies.rectangle(-wallThick / 2, height / 2, wallThick, height * 2, { isStatic: true, render: { visible: false } }),
        Bodies.rectangle(width + wallThick / 2, height / 2, wallThick, height * 2, { isStatic: true, render: { visible: false } })
    ];
    Composite.add(world, walls);

    if (render.options) {
        render.bounds.max.x = width;
        render.bounds.max.y = height;
        render.options.width = width;
        render.options.height = height;
        const pr = render.options.pixelRatio;
        render.canvas.width = width * pr;
        render.canvas.height = height * pr;
        render.canvas.style.width = width + 'px';
        render.canvas.style.height = height + 'px';
    }
}

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        updateWalls();
        const safeX = width / 2;
        const safeY = height / 2;
        cards.forEach(card => {
            if (card.position.x < 0 || card.position.x > width || card.position.y < 0 || card.position.y > height) {
                Matter.Body.setPosition(card, { x: safeX, y: safeY });
                Matter.Body.setVelocity(card, { x: 0, y: 0 });
            }
        });

        if (currentState === 'SELECTING' || currentState === 'FANNING') {
            if (typeof currentRitualData !== 'undefined' && currentRitualData.spread === 'single') {
                stackSpread();
            } else {
                fanSpread();
            }
        }
    }, 300);
});

function shuffleArray(array) {
    for (let i = array.length-1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

let currentRealDeck = [];
function startRitual() {
    resetRitualEngineContext();
    // ✨ 新增防呆：檢查自訂張數牌陣是否超過當前牌組大小
    if (currentSelectedSpread && currentSelectedSpread.startsWith('custom_dynamic_')) {
        const count = parseInt(currentSelectedSpread.replace('custom_dynamic_', ''));
        if (count > currentSelectedDeckSize) {
            if (typeof showToast === 'function') {
                showToast(`⚠️ 牌陣張數 (${count}張) 超過目前牌組上限 (${currentSelectedDeckSize}張)，請重新設定牌陣！`);
            }
            return;
        }
    }
    isRitualActive = true;
    if (typeof BL !== 'undefined' && (typeof currentState === 'undefined' || currentState !== 'SELECTING')) BL.clear();

    const overlay = document.getElementById('pre-shuffle-overlay');
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');

    setTimeout(async () => {
        overlay.classList.remove('flex');
        overlay.classList.add('hidden');

        // ✨ 動態抓取當前使用的牌組名稱
        const currentTheme = await DB.get('deck_theme', 'cards');
        const themeList = await DB.get('deck_theme_list', [{ name: '經典萊德偉特', id: 'cards' }, { name: '托特塔羅牌', id: 'thoth' }]);
        const themeObj = themeList.find(t => t.id === currentTheme) || themeList[0];

        currentRitualData = {
            id: Date.now().toString(),
            date: new Date().toLocaleString('zh-TW'),
            question: document.getElementById('input-question').value || '無',
            spread: currentSelectedSpread,
            mainDeckId: themeObj.id,     // ✨ 記錄主牌組 ID
            mainDeckName: themeObj.name, // ✨ 記錄主牌組名稱
            cards: [],
            notes: ''
        };

        currentRealDeck = shuffleArray(await generateBaseDeck(currentSelectedDeckSize));
        const val = await DB.get('stage_shuffle', true);
        const doShuffle = val !== 'false' && val !== false;

        if (doShuffle) {
            currentState = 'SHUFFLING';
            initManualShuffleScreen();
        } else {
            proceedToNextStage();
        }
    }, 1200);
}

async function proceedToNextStage() {
    if (typeof BL !== 'undefined') BL.clear();
    const drawUi = document.getElementById('draw-ui');
    if (drawUi) drawUi.classList.add('hidden');

    const valWash = await DB.get('stage_wash', true);
    const doWash = valWash !== 'false' && valWash !== false;
    const valCut = await DB.get('stage_cut', true);
    const doCut = valCut !== 'false' && valCut !== false;

    navTo('screen-ritual');
    setupWashUI();
    await buildSpread(currentRitualData.spread);
    await initPhysicsDeck(currentRealDeck);

    if (doWash) {
        setTimeout(() => { triggerRadialShuffle(); }, 400);
    } else {
        currentState = 'GATHERING';
        cards.forEach((card, i) => {
            Matter.Body.setStatic(card, true);
            card.targetPos = { x: width / 2-(i * 0.2), y: shuffleZone.centerY-(i * 0.2) };
            card.targetAngle = 0;
            card.isAnimating = true;
        });

        // ✨ 加上 async，才能在裡面用 await 讀取設定
        setTimeout(async () => {
            currentState = 'GATHERED';

            // ✨ 讀取你要切幾疊 (預設 3)
            window.currentMaxCutPiles = await DB.get('cut_piles_count', 3);

            if (doCut) {
                document.getElementById('cut-modal').classList.remove('hidden');
                document.getElementById('cut-modal').classList.add('flex');

                BL.show('cut_1');
                // ✨ 動態覆寫文字，告訴玩家總共要切幾疊
                const blEl = document.getElementById('global-breathing-light');
                if (blEl) blEl.innerText = `請點擊牌堆 (需切出 ${window.currentMaxCutPiles} 疊)`;

                cutPiles = [[...cards]];
                cutsMade = 0;
                renderCutPiles();
            } else {
                performAutoCutAndSpread();
            }
        }, 500);
    }
}

let chaosVortexActive = false;
let chaosVortexStartTime = 0;

function triggerChaosShuffle() {
    if (currentState !== 'SHUFFLING' && currentState !== 'SHUFFLING_INWARD') return;

    if (typeof triggerHaptic === 'function') triggerHaptic();

    chaosVortexActive = true;
    chaosVortexStartTime = Date.now();

    // ✨ 喚醒所有可能已經進入睡眠的卡牌，確保它們能接收到推力
    cards.forEach(c => Matter.Sleeping.set(c, false));

    // ✨ 優化：將原本沉重的 1500 毫秒改為 250 毫秒的「短促脈衝」，大幅降低 CPU 負載
    setTimeout(() => {
        chaosVortexActive = false;
    }, 250);
}

// ==========================================
// 手動切牌 (Overhand Shuffle) 系統
// ==========================================
let manualShuffleCount = 0;
let targetShuffleCount = 3;
let isDraggingBlock = false;
let startX = 0, startY = 0;             // 新增 startX
let lastDeltaX = 0, lastDeltaY = 0;     // 新增這兩個用來判斷有沒有拖出界外
let draggedBlock = null;

// ✨ 改成 async 函數，以等待資料庫讀取設定
async function initManualShuffleScreen() {
    navTo('screen-manual-shuffle');
    BL.show('manual_shuffle');
    manualShuffleCount = 0;

    // ✨ 從資料庫抓取目標次數，如果沒設定過就預設為 3
    targetShuffleCount = await DB.get('min_shuffle_count', 3);

    updateManualUI();

    const container = document.getElementById('manual-deck-container');
    if (!container) return;
    container.innerHTML = '';

    // ✨ 完美 1:1 對應實際牌數，並動態計算間距讓牌堆維持大約 200px 高
    const totalCards = currentRealDeck.length;
    const sliceSpacing = totalCards === 22 ? 6 : 4;

    for (let i = 0; i < totalCards; i++) {
        let cardSlice = document.createElement('div');
        // 牌數少 (22張) 時，讓切片視覺上厚一點點
        const thickness = totalCards === 22 ? 'h-[5px]' : 'h-[3px]';
        cardSlice.className = `w-full ${thickness} bg-purple-200 border-b border-purple-500 rounded-sm mb-[1px] absolute`;
        cardSlice.style.bottom = `${i * sliceSpacing}px`;
        cardSlice.style.zIndex = i;
        cardSlice.dataset.index = i;
        container.appendChild(cardSlice);
    }

    container.onpointerdown = (e) => {
        if (isDraggingBlock) return;
        isDraggingBlock = true;
        startX = e.clientX;  // 記錄 X 起點
        startY = e.clientY;  // 記錄 Y 起點
        lastDeltaX = 0;
        lastDeltaY = 0;

        const rect = container.getBoundingClientRect();
        
        // ======= 【完美融合版：鐘形曲線洗牌抓取】 =======
        let clickRatio = 1 - ((e.clientY - rect.top) / rect.height);
        if (clickRatio > 1) clickRatio = 1;
        if (clickRatio < 0) clickRatio = 0;

        // ✨ 導入鐘形曲線 (Sine Wave)：中心點為 1，兩側邊緣平滑遞減至 0
        const bellCurveFactor = Math.sin(clickRatio * Math.PI); 

        // 基礎保底抓取 10%，加上鐘形加成最多 45% (總和最高 55%)，並保留微小的隨機手感
        const grabPercent = 0.10 + (bellCurveFactor * 0.45) + (Math.random() * 0.1);
        let grabCount = Math.floor(totalCards * grabPercent);

        // ✨ 最低保底 1 張，確保邊緣依然有動作
        if (grabCount < 1) grabCount = 1;
        
        let startIndex = Math.floor(clickRatio * totalCards) - Math.floor(grabCount / 3);
        
        // ✨ 防呆修復 2：限制抓取起點的上下限！
        startIndex = Math.max(0, startIndex);
        startIndex = Math.min(totalCards-1, startIndex); // 絕對不能超過陣列最後一張牌

        const endIndex = Math.min(totalCards, startIndex + grabCount);

        draggedBlock = [];
        Array.from(container.children).forEach(child => {
            let idx = parseInt(child.dataset.index);
            if (idx >= startIndex && idx < endIndex) {
                child.style.transition = 'none';
                child.style.zIndex = '100';
                draggedBlock.push(child);
            }
        });

        // ✨ 終極防呆 3：如果因為某種神奇原因陣列還是空的，強制抓起最後一張牌！
        if (draggedBlock.length === 0 && container.lastChild) {
            const topCard = container.lastChild;
            topCard.style.transition = 'none';
            topCard.style.zIndex = '100';
            draggedBlock.push(topCard);
        }

        if (draggedBlock.length > 0 && navigator.vibrate) navigator.vibrate(10);
    };

    container.onpointermove = (e) => {
        if (!isDraggingBlock || draggedBlock.length === 0) return;
        // 解鎖左右自由拖曳！
        lastDeltaX = e.clientX-startX;
        lastDeltaY = e.clientY-startY;
        draggedBlock.forEach(child => {
            child.style.transform = `translate(${lastDeltaX}px, ${lastDeltaY}px)`;
        });
    };

    container.onpointerup = endManualDrag;
    container.onpointercancel = endManualDrag;
    container.onpointerleave = endManualDrag;
}

function endManualDrag() {
    if (!isDraggingBlock || !draggedBlock || draggedBlock.length === 0) return;
    isDraggingBlock = false;

    // ✨ 防呆機制：如果 X 和 Y 軸的拖曳距離都小於 40px，視為點擊誤觸，彈回原位
    if (Math.abs(lastDeltaX) < 40 && Math.abs(lastDeltaY) < 40) {
        draggedBlock.forEach(child => {
            child.style.transition = 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            child.style.transform = `translate(0px, 0px) rotate(0deg)`;
        });
        // 給動畫一點時間後重構，當作沒事發生
        setTimeout(() => rebuildManualDOM(), 300);
        return;
    }

    const startIndex = parseInt(draggedBlock[0].dataset.index);
    const count = draggedBlock.length;

    // 1:1 直接對應，不用再做任何比例換算了！
    const movedCards = currentRealDeck.splice(startIndex, count);

    let insertIndex = currentRealDeck.length;
    if (Math.random() > 0.3) {
        // 依照目前的牌數，決定失誤交錯的最大張數 (78張最多錯5張，22張最多錯3張)
        const maxError = currentRealDeck.length > 30 ? 5 : 3;
        const errorOffset = Math.floor(Math.random() * maxError) + 1;
        insertIndex = Math.max(0, currentRealDeck.length-errorOffset);
    }
    currentRealDeck.splice(insertIndex, 0, ...movedCards);

    const container = document.getElementById('manual-deck-container');
    const staticCards = Array.from(container.children).filter(c => !draggedBlock.includes(c));
    
    // ✨ 修復 sliceSpacing 比例尺 (與上方 init 統一)
    const sliceSpacing = currentRealDeck.length === 22 ? 6 : 4;

    draggedBlock.forEach((child, i) => {
        child.style.transition = 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        child.style.transform = `translate(0px, -240px) rotate(${Math.random() * 6-3}deg)`;
        setTimeout(() => {
            child.style.transform = `translate(0px, 0px) rotate(0deg)`;
            const isInterleaving = Math.random() > 0.3;

            if (isInterleaving && staticCards.length > 5) {
                const targetIdx = staticCards.length-1-Math.floor(Math.random() * 5);
                const targetCard = staticCards[targetIdx];
                child.style.zIndex = targetIdx + 1;
                // 動態取得間距的一半作為插隊的縫隙
                child.style.bottom = `${parseInt(targetCard.style.bottom) + (sliceSpacing / 2)}px`;
            } else {
                const topCard = staticCards[staticCards.length-1];
                child.style.zIndex = 100 + i;
                child.style.bottom = topCard ? `${parseInt(topCard.style.bottom) + (i * sliceSpacing)}px` : `${i * sliceSpacing}px`;
            }

            if (navigator.vibrate) navigator.vibrate(5);

            if (i === draggedBlock.length-1) {
                setTimeout(() => rebuildManualDOM(), 400);
            }
        }, 400);
    });

    manualShuffleCount++;
    updateManualUI();
}

function updateManualUI() {
    const countEl = document.getElementById('manual-shuffle-count');

    // ✨ 終極防呆邏輯 1：如果現在洗的次數超過目標，分母就跟著變大 (例如洗 4 次就變 4/4)
    const displayDenominator = Math.max(targetShuffleCount, manualShuffleCount);

    if (countEl) countEl.innerText = `已洗牌：${manualShuffleCount} / ${displayDenominator}`;

    const btn = document.getElementById('btn-enter-wash');
    if (!btn) return;

    if (manualShuffleCount >= targetShuffleCount) {
        btn.disabled = false;
        btn.classList.remove('opacity-30', 'cursor-not-allowed');
        btn.classList.add('opacity-100', 'animate-pulse', 'shadow-[0_0_20px_rgba(253,224,71,0.6)]');

        // ✨ 終極防呆邏輯 2：剛好達標的「那一次」，直接竄改呼吸燈文字！
        // (註：按鈕顯示是「進入展牌」，所以文字搭配按鈕)
        if (manualShuffleCount === targetShuffleCount) {
            const blEl = document.getElementById('global-breathing-light');
            if (blEl && !blEl.classList.contains('hidden')) {
                blEl.innerText = '可繼續洗牌，或點擊「進入搓牌」';
            }
        }
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-30');
        btn.classList.remove('opacity-100', 'animate-pulse', 'shadow-[0_0_20px_rgba(253,224,71,0.6)]');
    }
}

// ==========================================
// 進入實體麻將搓牌階段
// ==========================================
function setupWashUI() {
    const ritualUi = document.getElementById('ritual-ui');
    ritualUi.style.cssText = '';
    ritualUi.classList.remove('hidden');
    ritualUi.classList.add('flex');

    document.getElementById('btn-finish-shuffle').disabled = true;
    document.getElementById('btn-finish-shuffle').classList.remove('hidden');
    document.getElementById('btn-finish-shuffle').innerText = "✨ 魔法陣展開中...";

    document.getElementById('btn-gather').classList.add('hidden');

    // ✨ 切牌按鈕已經沒有存在的必要了，強制超渡它！
    const cutBtn = document.getElementById('btn-cut-fan');
    if (cutBtn) {
        cutBtn.classList.add('hidden');
        cutBtn.style.display = 'none';
    }
    const btnChaos = document.getElementById('btn-auto-chaos');
    if (btnChaos) {
        btnChaos.disabled = false;
        btnChaos.classList.remove('opacity-30', 'cursor-not-allowed', 'grayscale', 'hidden');
    }
    updateWalls();
}

// ✨ 宣告為 async
async function transitionToWash() {
    navTo('screen-ritual');
    setupWashUI();
    await buildSpread(currentRitualData.spread);

    // ✨ 加上 await 等待牌背圖片與物理實體就位
    await initPhysicsDeck(currentRealDeck);

    setTimeout(() => {
        triggerRadialShuffle();
    }, 400);
}

// ✨ 完美雷達比例修復 (必須加上 async)
async function buildSpread(type) {
    const layer = document.getElementById('spread-layer');
    layer.innerHTML = '';
    spreadSlots = [];
    drawnCount = 0;

    layer.style.cssText = 'position: absolute; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 15; pointer-events: none; opacity: 0; transition: opacity 0.5s;';

    const positions = await getSpreadPositionsPercentages(type, 'radar');
    positions.forEach((pos, idx) => {
        const el = document.createElement('div');
        el.className = 'spread-slot';
        el.style.left = pos.left;
        el.style.top = pos.top;
        el.style.transform = 'translate(-50%, -50%)';
        el.innerText = idx + 1;
        layer.appendChild(el);
        spreadSlots.push({ el: el });
    });
}

async function initPhysicsDeck(logicalDeck) {
    selectedCard = null;
    if (cards.length > 0) Composite.remove(world, cards);
    cards = [];
    currentState = 'STACKED';

    width = window.innerWidth;
    height = window.innerHeight;

    setTimeout(() => {
        if (typeof render !== 'undefined' && render) {
            render.bounds.max.x = width; render.bounds.max.y = height;
            render.options.width = width; render.options.height = height;
            const pr = render.options.pixelRatio;
            render.canvas.width = width * pr; render.canvas.height = height * pr;
            render.canvas.style.width = width + 'px'; render.canvas.style.height = height + 'px';
        }
    }, 50);

    shuffleZone.width = width;
    shuffleZone.height = height;
    shuffleZone.centerX = width / 2;
    shuffleZone.centerY = height / 2;

    const currentTheme = await DB.get('deck_theme', 'cards');
    const defaultPath = `./assets/${currentTheme}/cardback.jpg`;
    const customCardBack = await DB.get('cardback', defaultPath);

    let imgW = 300, imgH = 500;
    let useImage = true;

    await new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
            imgW = img.width || 300;
            imgH = img.height || 500;
            resolve();
        };
        img.onerror = () => {
            useImage = false;
            resolve();
        };
        img.src = customCardBack;
        if (img.complete && img.naturalWidth !== 0) {
            imgW = img.naturalWidth || 300;
            imgH = img.naturalHeight || 500;
            resolve();
        }
    });

    const baseScale = logicalDeck.length === 78 ? 0.45 : 0.75;
    const bodyW = 60 * baseScale;
    const bodyH = 105 * baseScale;
    const exactScaleX = bodyW / imgW;
    const exactScaleY = bodyH / imgH;

    const renderConfig = useImage
        ? { sprite: { texture: customCardBack, xScale: exactScaleX, yScale: exactScaleY }, fillStyle: 'transparent', strokeStyle: 'transparent', lineWidth: 0, visible: true }
        : { fillStyle: '#7c3aed', strokeStyle: '#d8b4fe', lineWidth: 2 };

    logicalDeck.forEach((data, i) => {
        const card = Bodies.rectangle(
            width / 2 + (i * 0.2), shuffleZone.centerY + (i * 0.2),
            bodyW, bodyH,
            {
                frictionAir: 0.04,
                friction: 0.02,
                restitution: 0.3,
                density: 0.002,
                isStatic: true,
                collisionFilter: { group: -1 },
                render: renderConfig
            }
        );
        Matter.Body.setAngle(card, Math.random() > 0.5 ? Math.PI : 0);
        card.tarotData = data; card.targetPos = null; card.isAnimating = false; card.isDrawn = false;
        card.zDepth = i; card.zVelocity = 0; card.pressure = 0; card.zScore = 0;
        card.imgW = imgW; card.imgH = imgH; card.baseScale = baseScale;
        card.baseSpriteScaleX = exactScaleX; card.baseSpriteScaleY = exactScaleY;
        cards.push(card);
    });
    Composite.add(world, cards);
}

/* ==========================================================================
   🌀 物理引擎核心更新週期 (銀河漩渦力場 + 統計學降頻物理排斥力場)
   ========================================================================== */
Events.on(engine, 'beforeUpdate', () => {
    physicsFrameCount++;
    const cx = width / 2;
    const cy = shuffleZone.centerY;

    const maxRadiusX = width * 0.45;
    const maxRadiusY = (shuffleZone.bottom-shuffleZone.top) * 0.45;

    if (currentState === 'SELECTING' && selectedCard === null && physicsFrameCount % 10 !== 0) {
        return;
    }

    const doRepulsion = (currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD');

    // ✨ 優化 2 & 3：將排斥力場從 forEach 抽離，改為「全域隨機抽樣」並套用「動態降頻」
    if (doRepulsion && physicsFrameCount % REPULSION_INTERVAL === 0) {
        // 限制抽樣數量，最多不超過牌數的 40% 或設定的上限
        const count = Math.min(REPULSION_PAIRS, Math.floor(cards.length * 0.4));

        for (let i = 0; i < count; i++) {
            const a = cards[Math.floor(Math.random() * cards.length)];
            const b = cards[Math.floor(Math.random() * cards.length)];

            if (a === b) continue;

            const dx = a.position.x-b.position.x;
            const dy = a.position.y-b.position.y;
            const rDistSq = dx * dx + dy * dy;

            if (rDistSq < 900 && rDistSq > 0) {
                const rDist = Math.sqrt(rDistSq);
                const force = (30-rDist) * 0.000001;
                Matter.Body.applyForce(a, a.position, { x: (dx / rDist) * force, y: (dy / rDist) * force });
            }
        }
    }

    cards.forEach((card, index) => {
        if (card.isAnimating && card.targetPos) {
            Matter.Body.setPosition(card, {
                x: card.position.x + (card.targetPos.x-card.position.x) * 0.18,
                y: card.position.y + (card.targetPos.y-card.position.y) * 0.18
            });
            if (card.targetAngle !== null) Matter.Body.setAngle(card, card.angle + (card.targetAngle-card.angle) * 0.18);
            Matter.Body.setVelocity(card, { x: 0, y: 0 });
            Matter.Body.setAngularVelocity(card, 0);
            return;
        }

        if (card.zVelocity > 0) {
            let scale = 1 + card.zVelocity;
            if (card.render.sprite && card.render.sprite.texture) {
                card.render.sprite.xScale = card.baseSpriteScaleX * scale;
                card.render.sprite.yScale = card.baseSpriteScaleY * scale;
            }
            card.zVelocity *= 0.82;
            if (card.zVelocity < 0.005) {
                card.zVelocity = 0;
                if (card.render.sprite && card.render.sprite.texture) {
                    card.render.sprite.xScale = card.baseSpriteScaleX;
                    card.render.sprite.yScale = card.baseSpriteScaleY;
                }
            }
        }

        if (currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD') {
            let dx = card.position.x-cx;
            let dy = card.position.y-cy;

            // ✨ 建立總合向量，取代瘋狂呼叫 applyForce
            let totalForceX = 0;
            let totalForceY = 0;

            // ① 外圍拉回
            let distRatio = Math.sqrt((dx * dx) / (maxRadiusX * maxRadiusX) + (dy * dy) / (maxRadiusY * maxRadiusY));
            if (distRatio > 0.78) {
                let pull = 0.0003 * (distRatio-0.78);
                totalForceX += -dx * pull;
                totalForceY += -dy * pull;
            }

            // ② SHUFFLING_INWARD 阻尼
            if (currentState === 'SHUFFLING_INWARD') {
                totalForceX += -card.velocity.x * 0.005;
                totalForceY += -card.velocity.y * 0.005;
            }

            // ③ 手指力場
            if (window.fingerDrag && window.fingerDrag.active) {
                let fx = card.position.x-window.fingerDrag.x;
                let fy = card.position.y-window.fingerDrag.y;
                let fDistSq = fx * fx + fy * fy;

                if (fDistSq < 45000) {
                    Matter.Sleeping.set(card, false);
                    let influence = 1-(Math.sqrt(fDistSq) / 210);
                    totalForceX += window.fingerDrag.dx * 0.000035 * influence;
                    totalForceY += window.fingerDrag.dy * 0.000035 * influence;

                    let swirlX = -fy * 0.000025 * influence;
                    let swirlY = fx * 0.000025 * influence;
                    totalForceX += swirlX;
                    totalForceY += swirlY;

                    Matter.Body.setAngularVelocity(card, card.angularVelocity + (totalForceX * fy-totalForceY * fx) * 0.05);
                    if (Math.random() > 0.85) card.zScore += (Math.random()-0.5) * 30;
                }
            }

            // ④ 漩渦切線力
            if (chaosVortexActive) {
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    let speedFactor = 0.00006 * card.mass;
                    totalForceX += -dy * speedFactor;
                    totalForceY += dx * speedFactor;

                    if (physicsFrameCount % 5 === 0) {
                        card.zScore += (Math.random()-0.2) * 5;
                        Matter.Body.setAngularVelocity(card, (Math.random()-0.5) * 0.05);
                    }
                }
            }

            // ✨ 最後一步：將所有計算好的力場，一次性施加給卡牌！
            if (totalForceX !== 0 || totalForceY !== 0) {
                Matter.Body.applyForce(card, card.position, { x: totalForceX, y: totalForceY });
            }

            const maxVel = 18;
            if (Math.abs(card.velocity.x) > maxVel) Matter.Body.setVelocity(card, { x: Math.sign(card.velocity.x) * maxVel, y: card.velocity.y });
            if (Math.abs(card.velocity.y) > maxVel) Matter.Body.setVelocity(card, { x: card.velocity.x, y: Math.sign(card.velocity.y) * maxVel });
        }
    });

    // ✨ 優化 1：套用動態 Z 軸降頻排序
    if ((currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD') && physicsFrameCount % ZSORT_INTERVAL === 0) {
        cards.sort((a, b) => a.zScore-b.zScore);
        cards.forEach((c, i) => c.zDepth = i);
        engine.world.bodies.sort((a, b) => (a.zScore || -99999)-(b.zScore || -99999));
    }

    if (currentState === 'FANNING') {
        let allSettled = true;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (card.targetPos) {
                const dx = card.targetPos.x-card.position.x;
                const dy = card.targetPos.y-card.position.y;
                if (dx * dx + dy * dy > 30) { allSettled = false; break; }
            }
        }

        if (!this.fanningTimer) this.fanningTimer = Date.now();
        if (Date.now()-this.fanningTimer > 2200) allSettled = true;

        if (allSettled) {
            this.fanningTimer = null;
            currentState = 'SELECTING';

            cards.forEach(c => Matter.Body.setStatic(c, true));

            // ✨ 判斷是否為單張直接抽模式
            const isSingleDirect = currentRitualData.spread === 'single' && window.singleDrawStyle === 'direct';

            const drawUi = document.getElementById('draw-ui');
            if (drawUi) {
                if (isSingleDirect) drawUi.classList.add('hidden'); // 直接抽隱藏底部按鈕
                else drawUi.classList.remove('hidden'); // 攤開抽則顯示底部按鈕
            }

            if (!isSingleDirect && typeof updateDrawButtons === 'function') updateDrawButtons();

            const spreadLayer = document.getElementById('spread-layer');
            if (spreadLayer) {
                if (isSingleDirect) {
                    spreadLayer.style.display = 'none';
                } else {
                    spreadLayer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2000; transition: opacity 0.5s; pointer-events: none;';
                    spreadLayer.className = cards.length > 30 ? 'radar-78' : 'radar-22';
                    spreadLayer.style.opacity = '1';

                    spreadSlots.forEach(s => {
                        s.el.style.border = 'none';
                        s.el.style.backgroundColor = 'rgba(107, 114, 128, 0.9)';
                        s.el.innerHTML = '';
                    });

                    if (spreadSlots[0] && spreadSlots[0].el) {
                        spreadSlots[0].el.style.backgroundColor = '#fef08a';
                        spreadSlots[0].el.style.boxShadow = '0 0 15px rgba(253, 224, 71, 0.6)';
                        spreadSlots[0].el.classList.add('animate-pulse');
                    }
                }
            }

            const globalBL = document.getElementById('global-breathing-light');
            if (globalBL) {
                globalBL.classList.remove('hidden');
                globalBL.style.cssText = '';
                globalBL.className = 'text-xl font-bold text-yellow-300 drop-shadow-md text-center whitespace-nowrap bg-black/50 px-6 py-2 rounded-full backdrop-blur-sm border border-yellow-500/30';

                if (isSingleDirect) {
                    globalBL.classList.add('fixed', 'left-1/2', '-translate-x-1/2', 'top-24');
                    BL.show('draw_place', '神諭即將展現...');
                    setTimeout(() => {
                        if (cards.length > 0 && drawnCount === 0) {
                            selectedCard = cards[cards.length-1];
                            if (typeof confirmDrawCard === 'function') confirmDrawCard();
                        }
                    }, 1200);
                } else {
                    if (cards.length > 30) globalBL.classList.add('bl-78');
                    else globalBL.classList.add('fixed', 'left-1/2', '-translate-x-1/2', 'top-24');
                    getDrawPromptText(drawnCount).then(txt => BL.show('draw_place', txt));
                }
            }
        }
    }
});

// 【更新】：華麗的隨機炸開前置動畫 (取代舊版螺旋，更適合麻將洗牌)
function triggerRadialShuffle(isAuto = false) {
    if (currentState !== 'STACKED') return;
    currentState = 'SHUFFLING';

    cards.forEach((card, i) => {
        card.isAnimating = true;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * (Math.min(width, height) * 0.22);
        card.targetPos = {
            x: width / 2 + Math.cos(angle) * dist,
            y: shuffleZone.centerY + Math.sin(angle) * dist
        };
        card.targetAngle = Math.random() * Math.PI;

        setTimeout(() => {
            card.isAnimating = false;
            Matter.Body.setStatic(card, false);
            if (card.collisionFilter) card.collisionFilter.group = -1;
            Matter.Body.setVelocity(card, { x: (Math.random()-0.5) * 4, y: (Math.random()-0.5) * 4 });
        }, 800);
    });

    if (!isAuto) BL.show('shuffle_start');
    resetShuffleIdleTimer();
}

// 需求 3：靜止 1.5 秒後的狀態切換邏輯
function resetShuffleIdleTimer() {
    clearTimeout(shuffleIdleTimer);
    BL.clearAction('shuffle_idle');
    const finishBtn = document.getElementById('btn-finish-shuffle');
    if (currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD') {
        finishBtn.disabled = true;
        finishBtn.innerText = "🙌 洗牌中...";
        shuffleIdleTimer = setTimeout(() => {
            BL.show('shuffle_idle');
            finishBtn.disabled = false;
            finishBtn.innerText = "✅ 洗牌完畢";
            finishBtn.classList.add('text-yellow-300', 'border-yellow-300');
        }, 1500);
    }
}

// 問題 2：點擊「洗牌完畢」切換為向心收攏
document.getElementById('btn-finish-shuffle').addEventListener('click', () => {
    if (currentState !== 'SHUFFLING' && currentState !== 'SHUFFLING_INWARD') return;
    clearTimeout(shuffleIdleTimer);
    if (typeof BL !== 'undefined' && (typeof currentState === 'undefined' || currentState !== 'SELECTING')) {
        BL.clear();
    }

    currentState = 'SHUFFLING_INWARD';

    document.getElementById('btn-finish-shuffle').classList.add('hidden');
    document.getElementById('btn-gather').classList.remove('hidden');
    document.getElementById('btn-gather').disabled = false;

    // ✨ 新增：把輔助搓亂按鈕反灰鎖死
    const btnChaos = document.getElementById('btn-auto-chaos');
    if (btnChaos) {
        btnChaos.disabled = true;
        btnChaos.classList.add('opacity-30', 'cursor-not-allowed', 'grayscale');
    }

    BL.show('shuffle_idle', '向心收攏');
});

// ✨ 核心修復：在這個 () 的前面補上 async！
document.getElementById('btn-gather').addEventListener('click', async () => {
    if (currentState !== 'SHUFFLING' && currentState !== 'SHUFFLING_INWARD') return;
    currentState = 'GATHERING';
    clearTimeout(shuffleIdleTimer);
    if (typeof BL !== 'undefined' && currentState !== 'SELECTING') {
        BL.clear();
    }

    document.getElementById('ritual-ui').classList.add('hidden');

    // ✨ 這裡使用了 await，所以外層一定要是 async () => 
    const currentTheme = await DB.get('deck_theme', 'cards');

    cards.forEach(card => {
        let normalizedAngle = card.angle % (2 * Math.PI);
        if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

        // 智慧判斷：如果是托特牌 (thoth)，強制為正位 (false)
        if (currentTheme === 'thoth') {
            card.tarotData.isReversed = false;
        } else {
            card.tarotData.isReversed = (normalizedAngle > Math.PI / 2) && (normalizedAngle < 3 * Math.PI / 2);
        }

        card.isAnimating = true;
        Matter.Body.setStatic(card, true);
        if (card.collisionFilter) card.collisionFilter.group = -1;
        card.targetAngle = 0;
        card.zVelocity = 0;
        card.pressure = 0;
    });

    // 按照深度排好序，避免收牌時穿模
    cards.sort((a, b) => a.zDepth-b.zDepth);
    cards.forEach((card, i) => {
        card.targetPos = { x: width / 2-(i * 0.2), y: shuffleZone.centerY-(i * 0.2) };
    });

    setTimeout(async () => { 
        currentState = 'GATHERED';

        const valCut = await DB.get('stage_cut', true);
        const doCut = valCut !== 'false' && valCut !== false;

        if (doCut) {
            await initCutModal();
        } else {
            performAutoCutAndSpread();
        }
    }, 1000);
});

let cutPiles = [];
let cutsMade = 0;
document.getElementById('btn-cut-fan').addEventListener('click', () => {
    if (currentState !== 'GATHERED') return;
    document.getElementById('cut-modal').classList.remove('hidden');
    document.getElementById('cut-modal').classList.add('flex');
    BL.show('cut_1');
    cutPiles = [[...cards]];
    cutsMade = 0;
    renderCutPiles();
});

function renderCutPiles() {
    const cutArea = document.getElementById('cut-area');
    cutArea.innerHTML = '';
    cutPiles.forEach((pile, pileIndex) => {
        const pileDiv = document.createElement('div');
        pileDiv.className = 'w-24 flex flex-col-reverse items-center transition-transform';
        pile.forEach((card, localIndex) => {
            const edge = document.createElement('div');
            edge.className = 'w-full h-[3px] bg-purple-300 hover:bg-yellow-400 hover:h-[5px] cursor-pointer transition-all mb-[1px]';
            edge.addEventListener('click', () => handleCut(pileIndex, localIndex));
            pileDiv.appendChild(edge);
        });
        cutArea.appendChild(pileDiv);
    });
}

// ✨ 初始化切牌介面
async function initCutModal() {
    window.currentMaxCutPiles = parseInt(await DB.get('cut_piles_count', 3)) || 3;
    
    document.getElementById('cut-modal').classList.remove('hidden');
    document.getElementById('cut-modal').classList.add('flex');
    
    // ✨ 將最上方的呼吸燈文字改為「憑直覺切牌」
    if (typeof BL !== 'undefined') BL.show('cut_1');
    const blEl = document.getElementById('global-breathing-light');
    if (blEl) blEl.innerText = '憑直覺切牌';
    
    cutPiles = [[...cards]];
    cutsMade = 0;
    
    let cutProgressEl = document.getElementById('cut-progress-text');
    if (!cutProgressEl) {
        cutProgressEl = document.createElement('p');
        cutProgressEl.id = 'cut-progress-text';
        cutProgressEl.className = 'absolute bottom-20 text-yellow-300 font-bold text-xl tracking-widest drop-shadow-md bg-purple-900/80 px-6 py-2 rounded-full border border-yellow-500/50';
        document.getElementById('cut-modal').appendChild(cutProgressEl);
    }
    
    // ✨ 動態計算總需切牌次數 (x = 設定堆數-1)
    const totalCuts = window.currentMaxCutPiles-1;
    cutProgressEl.innerText = `切成${window.currentMaxCutPiles}堆，已切牌：${cutsMade}/${totalCuts}`;
    
    renderCutPiles();
}

// ✨ 處理玩家點擊切牌的邏輯
function handleCut(pileIndex, localIndex) {
    if (cutPiles.length >= window.currentMaxCutPiles) return;

    const pileToSplit = cutPiles[pileIndex];
    const bottomHalf = pileToSplit.slice(0, localIndex + 1);
    const topHalf = pileToSplit.slice(localIndex + 1);

    if (topHalf.length === 0 || bottomHalf.length === 0) return;

    // 將切開的兩疊插回原本的陣列位置
    cutPiles.splice(pileIndex, 1, bottomHalf, topHalf);
    cutsMade++;

    // ✨ 立即更新畫面與進度
    renderCutPiles();
    
    // ✨ 同步更新底部的數字進度條
    const totalCuts = window.currentMaxCutPiles-1;
    const cutProgressEl = document.getElementById('cut-progress-text');
    if (cutProgressEl) cutProgressEl.innerText = `切成${window.currentMaxCutPiles}堆，已切牌：${cutsMade}/${totalCuts}`;

    const blEl = document.getElementById('global-breathing-light');

    if (cutPiles.length < window.currentMaxCutPiles) {
        // ✨ 切牌尚未完成，維持最上方的「憑直覺切牌」提示
        if (typeof BL !== 'undefined') BL.show('cut_1');
        if (blEl) blEl.innerText = '憑直覺切牌';
    } else {
        // ✨ 切牌完成！
        if (typeof BL !== 'undefined') BL.clearAction('cut_1');
        if (blEl) {
            blEl.classList.remove('hidden');
            blEl.innerText = `切牌完成！`;
        }
        setTimeout(mergePilesAndFanOut, 800);
    }
}

// ✨ 華麗的切牌收攏動畫 (動態銷毀空容器，支援 n 堆完美置中均分)
async function mergePilesAndFanOut() {
    const cutArea = document.getElementById('cut-area');
    const piles = Array.from(cutArea.children);
    
    const blEl = document.getElementById('global-breathing-light');
    if (blEl) blEl.classList.add('hidden');

    if (piles.length <= 1) {
        finishMerge();
        return;
    }

    // 依序執行：從最左邊的牌堆(i)，飛到右邊相鄰的牌堆(i+1)
    for (let i = 0; i < piles.length-1; i++) {
        const currentPile = piles[i];
        const nextPile = piles[i + 1];
        
        // 取得兩疊牌「當下」的絕對位置與尺寸 (即使剛重新置中過也能精準抓取！)
        const currentRect = currentPile.getBoundingClientRect();
        const nextRect = nextPile.getBoundingClientRect();
        
        // 精算移動距離
        const dx = nextRect.left-currentRect.left;
        const dy = -nextRect.height;
        
        // 1. 啟動飛行特效
        currentPile.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        currentPile.style.zIndex = 100 + i;
        currentPile.style.transform = `translate(${dx}px, ${dy}px)`; 
        
        // 等待飛行抵達目的地
        await new Promise(r => setTimeout(r, 300));
        
        // 2. 實體厚度轉移
        const edges = Array.from(currentPile.children);
        edges.forEach(edge => {
            nextPile.appendChild(edge);
        });
        
        // 3. ✨ 終極修復：徹底拔除已經空掉的左側牌堆！
        // 只要它一消失，Flexbox 就會瞬間將剩餘的牌堆「完美均分置中」
        currentPile.remove();
        
        // 稍微停頓 0.2 秒，讓玩家看清楚合併後，牌堆「瞬間重整排版」的儀式感
        await new Promise(r => setTimeout(r, 200));
    }

    // 等待所有牌都疊完之後，欣賞 0.4 秒最終置中於螢幕最中央的完整厚度
    setTimeout(finishMerge, 400);

    function finishMerge() {
        let newCardsOrder = [];
        // 塔羅牌邏輯：最左邊的牌疊在最上面，所以實體陣列要反轉接合
        [...cutPiles].reverse().forEach(p => newCardsOrder = [...newCardsOrder, ...p]);

        document.getElementById('cut-modal').classList.add('hidden');
        document.getElementById('cut-modal').classList.remove('flex');
        
        Matter.Composite.remove(world, cards);
        cards = newCardsOrder;
        Matter.Composite.add(world, cards);
        
        fanSpread();
    }
}

// ✨ 電腦自動代切邏輯 (補上中斷點與憑證檢查)
async function performAutoCutAndSpread(myRitualId = null) {
    const currentToken = ritualSessionToken;
    const cutIndex = Math.floor(cards.length * (0.3 + Math.random() * 0.4));
    const topHalf = cards.slice(0, cutIndex);
    const bottomHalf = cards.slice(cutIndex);

    topHalf.forEach(c => {
        c.isAnimating = true;
        c.targetPos = { x: c.position.x, y: c.position.y-120 };
        c.zScore += 1000;
    });

    await new Promise(r => setTimeout(r, 600));
    if (currentToken !== ritualSessionToken) return;

    topHalf.forEach(c => {
        c.targetPos = { x: c.position.x, y: c.position.y + 120 };
        c.zScore -= 1000;
    });

    const newCardsOrder = [...bottomHalf, ...topHalf];
    Matter.Composite.remove(world, cards);
    cards = newCardsOrder;
    Matter.Composite.add(world, cards);

    await new Promise(r => setTimeout(r, 400));
    if (currentToken !== ritualSessionToken) return;

    fanSpread();
}

async function fanSpread() {
    document.getElementById('ritual-ui').style.display = 'none';
    const ritualUi = document.getElementById('ritual-ui');
    if (ritualUi) ritualUi.classList.add('hidden');

    // ✨ 插入在這裡：單牌模式的雙重選項判斷
    if (currentRitualData.spread === 'single') {
        // 根據剛剛在視窗選擇的模式，決定要疊起來直接抽，還是平面攤開讓玩家選
        if (window.singleDrawStyle === 'direct') {
            return stackSpread();
        }
        // 若為 'spread' (攤開抽)，則跳過這個 return，讓它繼續執行下方的攤開邏輯
    }

    const style = await DB.get('draw_style', 'full');
    if (style === 'full') { return fullSpread(); }

    currentState = 'FANNING';
    
    // ✨ 這裡將原本的 === 78 放寬為 > 30，避免跨牌「抽後不放回」導致排版崩潰
    const is78 = cards.length > 30; 
    const cx = width / 2;
    
    cards.forEach((card, index) => {
        // ✨ 補上這行，確保引擎知道卡牌準備要移動了，才會有飛出去的動畫！
        card.isAnimating = true; 
        Matter.Body.setStatic(card, true);
        
        let row = 0, indexInRow = index, countInRow = cards.length;
        let radius = Math.min(width * 0.45, 180), cy = height-130;

        if (is78) {
            row = index % 5;
            indexInRow = Math.floor(index / 5);
            countInRow = 16;

            if (row === 0) { radius = Math.min(width * 0.48, 420); cy = height-150; }
            else if (row === 1) { radius = Math.min(width * 0.40, 340); cy = height-120; }
            else if (row === 2) { radius = Math.min(width * 0.32, 260); cy = height-90; }
            else if (row === 3) { radius = Math.min(width * 0.24, 180); cy = height-60; }
            else { radius = Math.min(width * 0.16, 100); cy = height-30; }
        }

        const progress = countInRow > 1 ? indexInRow / (countInRow-1) : 0;
        const angleDeg = -60 + (progress * 120);
        const angleRad = angleDeg * (Math.PI / 180);

        card.targetPos = { x: cx + Math.sin(angleRad) * radius, y: cy-Math.cos(angleRad) * radius };
        card.targetAngle = angleRad;
        card.originalPos = { ...card.targetPos };
        card.originalAngle = card.targetAngle;
    });
}

// ==========================================
// ✨ 單牌模式專屬：3D 立體真實牌堆
// ==========================================
function stackSpread() {
    currentState = 'FANNING';
    const is78 = cards.length === 78;
    width = window.innerWidth;
    height = window.innerHeight;

    if (typeof render !== 'undefined' && render) {
        render.bounds.max.x = width; render.bounds.max.y = height;
        render.options.width = width; render.options.height = height;
        const pr = render.options.pixelRatio;
        render.canvas.width = width * pr; render.canvas.height = height * pr;
        render.canvas.style.width = width + 'px'; render.canvas.style.height = height + 'px';
    }

    const cx = width / 2;
    const cy = height * 0.55;
    const targetWidth = 140;
    const baseW = 60 * (is78 ? 0.55 : 0.75);
    const scale = targetWidth / baseW;

    const totalThicknessY = 12;
    const totalThicknessX = 3;

    cards.forEach((card, i) => {
        if (card.collisionFilter) card.collisionFilter.group = -1;
        Matter.Body.setStatic(card, true);
        Matter.Body.setVelocity(card, { x: 0, y: 0 });
        card.isAnimating = true;

        const progress = i / (cards.length-1 || 1);
        const offsetX = progress * totalThicknessX;
        const offsetY = progress * totalThicknessY;

        card.targetPos = {
            x: cx-(totalThicknessX / 2) + offsetX,
            y: cy + (totalThicknessY / 2)-offsetY
        };

        const randomJitter = (Math.random()-0.5) * 0.08 * (1-progress * 0.8);
        card.targetAngle = randomJitter;
        card.originalPos = { ...card.targetPos };
        card.originalAngle = card.targetAngle;
        updateCardScale(card, scale);
    });
}

function fullSpread() {
    currentState = 'FANNING';
    const is78 = cards.length === 78;
    width = window.innerWidth;
    height = window.innerHeight;

    if (typeof render !== 'undefined' && render) {
        render.bounds.max.x = width; render.bounds.max.y = height;
        render.options.width = width; render.options.height = height;
        const pr = render.options.pixelRatio;
        render.canvas.width = width * pr; render.canvas.height = height * pr;
        render.canvas.style.width = width + 'px'; render.canvas.style.height = height + 'px';
    }

    const usableTop = is78 ? height * 0.05 : height * 0.20;
    const usableBottom = height-65;
    const usableWidth = width * 0.99;
    const drawAreaHeight = usableBottom-usableTop;
    const leftOffset = (width-usableWidth) / 2;

    let boundaryEl = document.getElementById('selection-boundary');
    if (!boundaryEl) {
        boundaryEl = document.createElement('div');
        boundaryEl.id = 'selection-boundary';
        document.body.appendChild(boundaryEl);
    }
    boundaryEl.style.top = `${usableTop}px`;
    boundaryEl.style.left = `${leftOffset}px`;
    boundaryEl.style.width = `${usableWidth}px`;
    boundaryEl.style.height = `${drawAreaHeight}px`;
    boundaryEl.style.display = 'block';

    let svgStr = '';
    if (is78) {
        const cw = usableWidth / 9;
        const ch = drawAreaHeight / 9;
        svgStr = `<svg xmlns='http://www.w3.org/2000/svg' width='${cw}' height='${ch}'><path d='M ${cw} 0 L 0 0 0 ${ch}' fill='none' stroke='rgba(216,180,254,0.15)' stroke-width='1' stroke-dasharray='3,3'/></svg>`;
    } else {
        const ch = drawAreaHeight / 4;
        svgStr = `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='${ch}'><path d='M 100 0 L 0 0' fill='none' stroke='rgba(216,180,254,0.15)' stroke-width='1' stroke-dasharray='3,3'/></svg>`;
    }
    boundaryEl.style.backgroundImage = `url("data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}")`;
    setTimeout(() => { boundaryEl.style.opacity = '1'; }, 50);

    cards.forEach(c => {
        if (c.collisionFilter) c.collisionFilter.group = -1;
        Matter.Body.setStatic(c, true);
        Matter.Body.setVelocity(c, { x: 0, y: 0 });
        c.isAnimating = true;
    });

    if (!is78) {
        const rowsCount = 4;
        const maxCols = 6;
        const cellH = drawAreaHeight / rowsCount;
        const minCellW = usableWidth / maxCols;
        const scaleRaw22 = Math.min((minCellW * 0.95) / 60, (cellH * 0.95) / 105);
        const scale = Math.min(scaleRaw22, 1.8);

        cards.forEach((card, i) => {
            let rowIdx, colIdx, cardsInThisRow;
            if (i < 5) { rowIdx = 0; colIdx = i; cardsInThisRow = 5; }
            else if (i < 11) { rowIdx = 1; colIdx = i-5; cardsInThisRow = 6; }
            else if (i < 17) { rowIdx = 2; colIdx = i-11; cardsInThisRow = 6; }
            else { rowIdx = 3; colIdx = i-17; cardsInThisRow = 5; }

            const rowCellW = usableWidth / cardsInThisRow;
            const posX = leftOffset + (colIdx * rowCellW) + (rowCellW / 2);
            const posY = usableTop + (rowIdx * cellH) + (cellH / 2);

            card.targetPos = { x: posX, y: posY };
            card.originalPos = { ...card.targetPos };
            card.originalAngle = card.targetAngle;
            updateCardScale(card, scale);
        });
    } else {
        const cols = 9;
        const rows = 9;
        const cellW = usableWidth / cols;
        const cellH = drawAreaHeight / rows;
        const scaleRaw78 = Math.min((cellW * 0.82) / 60, (cellH * 0.82) / 105);
        const scale = Math.min(scaleRaw78, 1.0);

        cards.forEach((card, i) => {
            let gridIndex = i;
            if (i >= 6) gridIndex = i + 3;

            const col = gridIndex % cols;
            const row = Math.floor(gridIndex / cols);
            const posX = (width-usableWidth) / 2 + col * cellW + cellW / 2;
            const posY = usableTop + row * cellH + cellH / 2;

            card.targetPos = { x: posX, y: posY };
            card.originalPos = { ...card.targetPos };
            updateCardScale(card, scale);
        });
    }
}

// 輔助函數：統一縮放邏輯 (✨ 終極修復版：連同物理體積一起完美縮小)
function updateCardScale(card, targetScale) {
    const targetW = 60 * targetScale;
    const targetH = 105 * targetScale;
    card.baseScaleX = targetW / card.imgW;
    card.baseScaleY = targetH / card.imgH;
    if (card.render.sprite) {
        card.render.sprite.xScale = card.baseScaleX;
        card.render.sprite.yScale = card.baseScaleY;
    }
    if (!card.currentPhysScale) {
        card.currentPhysScale = card.baseScale || 1;
    }
    const relativeScale = targetScale / card.currentPhysScale;
    Matter.Body.scale(card, relativeScale, relativeScale);
    card.currentPhysScale = targetScale;
}

async function finalizeSpread() {
    if (typeof BL !== 'undefined' && currentState !== 'SELECTING') BL.clear();
    document.getElementById('draw-ui').classList.add('hidden');

    const boundaryEl = document.getElementById('selection-boundary');
    if (boundaryEl) {
        boundaryEl.style.opacity = '0';
        setTimeout(() => { boundaryEl.style.display = 'none'; }, 800);
    }

    const spreadLayer = document.getElementById('spread-layer');
    if (spreadLayer) {
        spreadLayer.innerHTML = '';
        spreadLayer.className = '';
        spreadLayer.style.display = 'none';
        spreadLayer.style.opacity = '0';
    }

    const globalBL = document.getElementById('global-breathing-light');
    if (globalBL) {
        globalBL.style.cssText = '';
        globalBL.classList.remove('bl-78', 'bl-top-left', 'left-1/2', '-translate-x-1/2', 'top-24');
        globalBL.classList.add('left-1/2', '-translate-x-1/2', 'top-24');
    }

    // ✨ 🛑 跨牌系統攔截器 🛑 ✨
    if (typeof window.crossDrawState !== 'undefined' && window.crossDrawState.active) {
        const parentRecord = window.crossDrawState.parentRecord;
        if (!parentRecord.crossDraws) parentRecord.crossDraws = [];

        if (window.crossDrawState.type === 'single') {
            // ✨ 利用我們剛才記下的陣列，依序將抽出來的卡牌派發給指定位置！
            window.crossDrawState.slotIndices.forEach((targetSlotIdx, idx) => {
                const drawnCard = currentRitualData.cards[idx]; // 依序取出剛剛抽到的牌
                if (drawnCard) {
                    drawnCard.slotIndex = targetSlotIdx; // 覆寫為目標牌位
                    parentRecord.crossDraws.push({
                        type: 'single',
                        slotIndex: targetSlotIdx,
                        deckId: window.crossDrawState.deckId,
                        deckName: window.crossDrawState.deckName,
                        card: drawnCard
                    });
                }
            });
        } else {
            // 全陣跨牌
            const newLayerCards = currentRitualData.cards.map(c => ({
                ...c,
                slotIndex: c.slotIndex
            }));
            const layerId = parentRecord.crossDraws.filter(d => d.type === 'full').length;
            parentRecord.crossDraws.push({
                type: 'full',
                layerId: layerId,
                deckId: window.crossDrawState.deckId,
                deckName: window.crossDrawState.deckName,
                cards: newLayerCards
            });
        }

        // 還原為原本的主題設定
        if (window.crossDrawState.originalTheme) {
            await DB.set('deck_theme', window.crossDrawState.originalTheme);
        }

        // 寫回資料庫
        let history = await DB.get('history', []);
        const idx = history.findIndex(r => r.id === parentRecord.id);
        if (idx !== -1) {
            history[idx] = parentRecord;
            await DB.set('history', history);
        }

        // 將狀態權杖交還給原牌陣
        currentDetailRecord = parentRecord;
        // 如果本來就是一場還沒儲存的新儀式，也要更新回去
        if (parentRecord.id && !parentRecord.id.toString().startsWith('cross_') && parentRecord.notes !== undefined) {
            currentRitualData = parentRecord;
        }

        window.crossDrawState.active = false;

        setTimeout(() => {
            // 先渲染原本的主牌陣
            renderReadingRoom(parentRecord, false);
            
            // ✨ 修正 1：利用延遲自動觸發圖層切換與翻牌動畫
            if (window.crossDrawState.type === 'single') {
                window.crossDrawState.slotIndices.forEach((targetSlotIdx) => {
                    const supplements = parentRecord.crossDraws.filter(d => d.type === 'single' && d.slotIndex === targetSlotIdx);
                    setTimeout(() => toggleSingleSlot(null, targetSlotIdx, supplements.length), 250);
                });
            } else {
                const layerId = parentRecord.crossDraws.filter(d => d.type === 'full').length - 1;
                setTimeout(() => toggleFullSpreadLayer(layerId), 250);
            }

            if (typeof showToast === 'function') showToast('✨ 神諭已降臨！跨牌成功。');
        }, 500);

        await DeckStorage.save(currentRealDeck, currentSelectedDeckSize);
        return; // 攔截成功，終止後續的正常流程
    }
    if (currentRitualData.spread === 'single') {
        renderReadingRoom(currentRitualData, true);
    } else {
        setTimeout(() => {
            renderReadingRoom(currentRitualData, true);
        }, 500);
    }
    await DeckStorage.save(currentRealDeck, currentSelectedDeckSize);
}

/* ==========================================================================
   🎨 繪圖渲染層優化 (拔除所有浮空陰影，專注於黃色呼吸框)
   ========================================================================== */
Matter.Events.on(render, 'afterRender', function () {
    if (!['SHUFFLING', 'SHUFFLING_INWARD', 'SELECTING'].includes(currentState)) return;

    const ctx = render.context;
    const isDrawUiVisible = document.getElementById('draw-ui') && !document.getElementById('draw-ui').classList.contains('hidden');

    // (這裡原本有畫黑影的程式碼，我們已經將它徹底刪除，讓洗牌與選牌保持乾淨的 2D 質感！)

    // 🌟 獨立選牌呼吸指示圈 (僅在特定卡牌被點選且尚未按下確認時，顯示黃色呼吸框)
    if (selectedCard && !selectedCard.isDrawn && !isDrawUiVisible) {
        const time = Date.now();
        // 利用 sin 函數產生 0 到 1 之間的平滑波浪，作為呼吸節奏
        const pulse = 0.5 + 0.5 * Math.sin(time / 140);

        // 描繪被選中卡牌的邊緣路徑
        ctx.beginPath();
        ctx.moveTo(selectedCard.vertices[0].x, selectedCard.vertices[0].y);
        for (let j = 1; j < selectedCard.vertices.length; j++) {
            ctx.lineTo(selectedCard.vertices[j].x, selectedCard.vertices[j].y);
        }
        ctx.closePath();

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();

        // ✨ 強化版黃色呼吸框：結合粗細與光暈的雙重呼吸效果
        ctx.lineWidth = 2 + (1.5 * pulse); // 框線粗細會跟著呼吸微調
        ctx.strokeStyle = `rgba(253, 224, 71, ${0.6 + 0.4 * pulse})`; // 框線透明度呼吸
        ctx.shadowColor = 'rgba(253, 224, 71, 0.9)'; // 螢光黃
        ctx.shadowBlur = 15 * pulse; // 光暈擴散範圍呼吸
        ctx.stroke();

        // 完畢後立刻洗淨畫筆狀態，防止汙染下個繪圖週期
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
    }
});

const AutoBot = {
    async execute(config = { wash: true, cut: true }) {
        isRitualActive = true;
        const myRitualId = currentRitualData ? currentRitualData.id : null;
        resetRitualEngineContext(); // ✨ 啟動前強制大掃除
        isRitualActive = true;
        const myToken = ritualSessionToken; // ✨ 領取本局專屬憑證

        navTo('screen-ritual');
        setupWashUI();
        await buildSpread(currentRitualData.spread);

        const ritualUi = document.getElementById('ritual-ui');
        if (ritualUi) ritualUi.classList.add('hidden');

        // 🛡️ 終極防呆防護盾
        if (currentRealDeck instanceof Promise) {
            currentRealDeck = await currentRealDeck;
        }
        if (currentRealDeck && !Array.isArray(currentRealDeck) && Array.isArray(currentRealDeck.cards)) {
            currentRealDeck = currentRealDeck.cards;
        }
        if (!Array.isArray(currentRealDeck) || currentRealDeck.length === 0) {
            if (typeof generateBaseDeck === 'function') {
                currentRealDeck = shuffleArray(await generateBaseDeck(currentSelectedDeckSize));
            }
        }

        // ✨ 檢查點 1：如果儀式被關閉，或者 ID 已經變成新一局的 ID，立刻終止
        if (myToken !== ritualSessionToken) return;
        if (!isRitualActive || (currentRitualData && currentRitualData.id !== myRitualId)) return;

        await initPhysicsDeck(currentRealDeck);
        triggerRadialShuffle(true);

        await this.wait(1200);
        if (myToken !== ritualSessionToken) return; // ✨ 憑證檢查：如果玩家離開或開新局，立刻終止！
        if (!isRitualActive || (currentRitualData && currentRitualData.id !== myRitualId)) return;

        if (config.wash) {
            currentState = 'SHUFFLING';
            await this.simulateWash(myRitualId);
        }

        if (myToken !== ritualSessionToken) return; // ✨ 憑證檢查
        if (!isRitualActive || (currentRitualData && currentRitualData.id !== myRitualId)) return;

        currentState = 'GATHERING';
        if (typeof BL !== 'undefined' && (typeof currentState === 'undefined' || currentState !== 'SELECTING')) {
            BL.clear();
        }

        // ✨ 1. 取得當前使用的牌組主題
        const currentTheme = await DB.get('deck_theme', 'cards');

        cards.forEach(card => {
            let normalizedAngle = card.angle % (2 * Math.PI);
            if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

            // ✨ 2. 智慧判斷：如果是托特牌 (thoth)，強制為正位 (false)
            if (currentTheme === 'thoth') {
                card.tarotData.isReversed = false;
            } else {
                card.tarotData.isReversed = (normalizedAngle > Math.PI / 2) && (normalizedAngle < 3 * Math.PI / 2);
            }

            card.isAnimating = true;
            Matter.Body.setStatic(card, true);
            if (card.collisionFilter) card.collisionFilter.group = -1;
            card.targetAngle = 0;
            card.zVelocity = 0;
            card.pressure = 0;
        });

        cards.sort((a, b) => a.zDepth-b.zDepth);
        cards.forEach((card, i) => {
            card.targetPos = { x: width / 2-(i * 0.2), y: shuffleZone.centerY-(i * 0.2) };
        });

        await this.wait(1200);
        if (myToken !== ritualSessionToken) return; // ✨ 憑證檢查
        if (!isRitualActive || (currentRitualData && currentRitualData.id !== myRitualId)) return;

        currentState = 'GATHERED';

        if (config.cut) {
            await performAutoCutAndSpread(myRitualId);
        } else {
            fanSpread();
        }
    },

    // ✨ 接收 myRitualId 參數，讓搓牌迴圈在執行中也能被隨時中斷
    simulateWash(myRitualId) {
        return new Promise(async resolve => {
            for (let i = 0; i < 3; i++) {
                // 🎯 核心防線：檢查儀式是否中斷
                if (!isRitualActive || (currentRitualData && currentRitualData.id !== myRitualId)) {
                    return resolve();
                }

                cards.forEach(card => {
                    // ✨ 關鍵 1：因為我們開啟了睡眠模式，在施加推力前必須手動喚醒卡牌
                    Matter.Sleeping.set(card, false);

                    // 給予平面推力與旋轉
                    Matter.Body.applyForce(card, card.position, {
                        x: (Math.random()-0.5) * 0.06,
                        y: (Math.random()-0.5) * 0.06
                    });
                    Matter.Body.setAngularVelocity(card, (Math.random()-0.5) * 0.3);

                    // ✨ 關鍵 2：恢復 Z 軸交錯！
                    // 每次推牌時給予隨機深度變化，由系統背景的降頻排序器 (ZSORT_INTERVAL) 統一處理渲染層級
                    card.zScore += (Math.random()-0.5) * 50;
                });

                await this.wait(800);
            }
            resolve();
        });
    },
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
};