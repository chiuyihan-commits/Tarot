/* ==========================================================================
   ✨ 數位塔羅祭壇 - 終極效能優化版物理引擎核心 (tarot_engines_optimized.js)
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
        Bodies.rectangle(width / 2, shuffleZone.top - wallThick / 2, width * 2, wallThick, { isStatic: true, render: { visible: false } }),
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
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

let currentRealDeck = [];
function startRitual() {
    resetRitualEngineContext(); 
    isRitualActive = true;
    if (typeof BL !== 'undefined' && currentState !== 'SELECTING') BL.clear();
    
    const overlay = document.getElementById('pre-shuffle-overlay');
    overlay.classList.remove('hidden'); 
    overlay.classList.add('flex');

    setTimeout(async () => {
        overlay.classList.remove('flex'); 
        overlay.classList.add('hidden');

        currentRitualData = { 
            id: Date.now().toString(), 
            date: new Date().toLocaleString('zh-TW'), 
            question: document.getElementById('input-question').value || '無', 
            spread: currentSelectedSpread, 
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
            card.targetPos = { x: width / 2 - (i * 0.2), y: shuffleZone.centerY - (i * 0.2) };
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
    triggerHaptic();
    chaosVortexActive = true;
    chaosVortexStartTime = Date.now();
    setTimeout(() => { chaosVortexActive = false; }, 1500);
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
    const sliceSpacing = 200 / totalCards;

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
        const clickRatio = 1 - ((e.clientY - rect.top) / rect.height);

        // 抓取 35% ~ 65% 的牌
        const grabPercent = 0.35 + (Math.random() * 0.3);
        const grabCount = Math.floor(totalCards * grabPercent);

        // 確保不會一鍋端
        let startIndex = Math.floor(clickRatio * totalCards) - Math.floor(grabCount / 3);
        startIndex = Math.max(0, startIndex);
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

        if (draggedBlock.length > 0 && navigator.vibrate) navigator.vibrate(10);
    };

    container.onpointermove = (e) => {
        if (!isDraggingBlock || draggedBlock.length === 0) return;
        // ✨ 解鎖左右自由拖曳！
        lastDeltaX = e.clientX - startX;
        lastDeltaY = e.clientY - startY;
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

    // ✨ 1:1 直接對應，不用再做任何比例換算了！
    const movedCards = currentRealDeck.splice(startIndex, count);

    let insertIndex = currentRealDeck.length;
    if (Math.random() > 0.3) {
        // 依照目前的牌數，決定失誤交錯的最大張數 (78張最多錯5張，22張最多錯3張)
        const maxError = currentRealDeck.length > 30 ? 5 : 3;
        const errorOffset = Math.floor(Math.random() * maxError) + 1;
        insertIndex = Math.max(0, currentRealDeck.length - errorOffset);
    }
    currentRealDeck.splice(insertIndex, 0, ...movedCards);

    const container = document.getElementById('manual-deck-container');
    const staticCards = Array.from(container.children).filter(c => !draggedBlock.includes(c));
    const sliceSpacing = 200 / currentRealDeck.length;

    draggedBlock.forEach((child, i) => {
        child.style.transition = 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)';
        child.style.transform = `translate(0px, -220px) rotate(${Math.random() * 6 - 3}deg)`;

        setTimeout(() => {
            child.style.transform = `translate(0px, 0px) rotate(0deg)`;
            const isInterleaving = Math.random() > 0.3;

            if (isInterleaving && staticCards.length > 5) {
                const targetIdx = staticCards.length - 1 - Math.floor(Math.random() * 5);
                const targetCard = staticCards[targetIdx];
                child.style.zIndex = targetIdx + 1;
                // 動態取得間距的一半作為插隊的縫隙
                child.style.bottom = `${parseInt(targetCard.style.bottom) + (sliceSpacing / 2)}px`;
            } else {
                const topCard = staticCards[staticCards.length - 1];
                child.style.zIndex = 100 + i;
                child.style.bottom = topCard ? `${parseInt(topCard.style.bottom) + (i * sliceSpacing)}px` : `${i * sliceSpacing}px`;
            }

            if (navigator.vibrate) navigator.vibrate(5);

            if (i === draggedBlock.length - 1) {
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
    
    if (currentRitualData.spread === 'single') {
        layer.style.display = 'none';
        spreadSlots = [{ el: document.createElement('div') }];
        return;
    }
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
    const maxRadiusY = (shuffleZone.bottom - shuffleZone.top) * 0.45;

    if (currentState === 'SELECTING' && selectedCard === null && physicsFrameCount % 10 !== 0) {
        return;
    }

    const doRepulsion = (currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD');

    cards.forEach((card, index) => {
        if (card.isAnimating && card.targetPos) {
            Matter.Body.setPosition(card, { 
                x: card.position.x + (card.targetPos.x - card.position.x) * 0.18, 
                y: card.position.y + (card.targetPos.y - card.position.y) * 0.18 
            });
            if (card.targetAngle !== null) Matter.Body.setAngle(card, card.angle + (card.targetAngle - card.angle) * 0.18);
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
            let dx = card.position.x - cx;
            let dy = card.position.y - cy;
            let distRatio = Math.sqrt((dx * dx) / (maxRadiusX * maxRadiusX) + (dy * dy) / (maxRadiusY * maxRadiusY));

            if (distRatio > 0.78) {
                let pull = 0.0003 * (distRatio - 0.78);
                Matter.Body.applyForce(card, card.position, { x: -dx * pull, y: -dy * pull });
            }

            // ✨ 修復 2：刪除了強制的向心收攏，改為輕微的流體空氣阻力，讓牌洗完維持散開，等待玩家雙手捏合
            if (currentState === 'SHUFFLING_INWARD') {
                Matter.Body.applyForce(card, card.position, { x: -card.velocity.x * 0.005, y: -card.velocity.y * 0.005 });
            }

            if (window.fingerDrag && window.fingerDrag.active) {
                let fx = card.position.x - window.fingerDrag.x;
                let fy = card.position.y - window.fingerDrag.y;
                let fDistSq = fx * fx + fy * fy;

                if (fDistSq < 45000) {
                    Matter.Sleeping.set(card, false); 
                    let influence = 1 - (Math.sqrt(fDistSq) / 210);
                    let pushX = window.fingerDrag.dx * 0.000035 * influence;
                    let pushY = window.fingerDrag.dy * 0.000035 * influence;
                    
                    let swirlX = -fy * 0.000025 * influence;
                    let swirlY = fx * 0.000025 * influence;

                    Matter.Body.applyForce(card, card.position, { x: pushX + swirlX, y: pushY + swirlY });
                    Matter.Body.setAngularVelocity(card, card.angularVelocity + (pushX * fy - pushY * fx) * 0.05);
                    if (Math.random() > 0.85) card.zScore += 10;
                }
            }

            if (chaosVortexActive) {
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 5) {
                    // ✨ 修復 1：改為單一且溫和的切線推力，拔除向心力，消除物理向量對抗導致的「兩坨節點」現象
                    let speedFactor = 0.00006 * card.mass; 
                    let tangentX = -dy * speedFactor;
                    let tangentY = dx * speedFactor;

                    Matter.Body.applyForce(card, card.position, { x: tangentX, y: tangentY });
                    
                    if (physicsFrameCount % 5 === 0) {
                        card.zScore += (Math.random() - 0.2) * 5;
                        Matter.Body.setAngularVelocity(card, (Math.random() - 0.5) * 0.05);
                    }
                }
            }

            if (doRepulsion && physicsFrameCount % 2 === 0) {
                for (let k = 0; k < 3; k++) {
                    let randIdx = Math.floor(Math.random() * cards.length);
                    if (randIdx !== index) {
                        let other = cards[randIdx];
                        let rx = card.position.x - other.position.x;
                        let ry = card.position.y - other.position.y;
                        let rDistSq = rx * rx + ry * ry;
                        
                        if (rDistSq < 900 && rDistSq > 0) { 
                            let rDist = Math.sqrt(rDistSq);
                            let force = (30 - rDist) * 0.000001; 
                            Matter.Body.applyForce(card, card.position, { x: (rx / rDist) * force, y: (ry / rDist) * force });
                        }
                    }
                }
            }

            const maxVel = 18;
            if (Math.abs(card.velocity.x) > maxVel) Matter.Body.setVelocity(card, { x: Math.sign(card.velocity.x) * maxVel, y: card.velocity.y });
            if (Math.abs(card.velocity.y) > maxVel) Matter.Body.setVelocity(card, { x: card.velocity.x, y: Math.sign(card.velocity.y) * maxVel });
        }
    });

    if ((currentState === 'SHUFFLING' || currentState === 'SHUFFLING_INWARD') && physicsFrameCount % 5 === 0) {
        cards.sort((a, b) => a.zScore - b.zScore);
        cards.forEach((c, i) => c.zDepth = i);
        engine.world.bodies.sort((a, b) => (a.zScore || -99999) - (b.zScore || -99999));
    }

    if (currentState === 'FANNING') {
        let allSettled = true;
        for (let i = 0; i < cards.length; i++) {
            const card = cards[i];
            if (card.targetPos) {
                const dx = card.targetPos.x - card.position.x;
                const dy = card.targetPos.y - card.position.y;
                if (dx * dx + dy * dy > 30) { allSettled = false; break; }
            }
        }

        if (!this.fanningTimer) this.fanningTimer = Date.now();
        if (Date.now() - this.fanningTimer > 2200) allSettled = true; 

        if (allSettled) {
            this.fanningTimer = null; 
            currentState = 'SELECTING';
            
            cards.forEach(c => Matter.Body.setStatic(c, true));

            const isSingle = currentRitualData.spread === 'single';
            const drawUi = document.getElementById('draw-ui');
            if (drawUi) {
                if (isSingle) drawUi.classList.add('hidden');
                else drawUi.classList.remove('hidden'); 
            }

            if (!isSingle && typeof updateDrawButtons === 'function') updateDrawButtons();

            const spreadLayer = document.getElementById('spread-layer');
            if (spreadLayer) {
                if (isSingle) {
                    spreadLayer.style.display = 'none';
                } else {
                    spreadLayer.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2000; transition: opacity 0.5s; pointer-events: none;';
                    spreadLayer.className = cards.length === 78 ? 'radar-78' : 'radar-22';
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

                if (isSingle) {
                    globalBL.classList.add('fixed', 'left-1/2', '-translate-x-1/2', 'top-24');
                    BL.show('draw_place', '神諭即將展現...');
                    setTimeout(() => {
                        if (cards.length > 0 && drawnCount === 0) {
                            selectedCard = cards[cards.length - 1];
                            if (typeof confirmDrawCard === 'function') confirmDrawCard();
                        }
                    }, 1200);
                } else {
                    if (cards.length === 78) globalBL.classList.add('bl-78');
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
            Matter.Body.setVelocity(card, { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 });
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
    if (typeof BL !== 'undefined' && currentState !== 'SELECTING') {
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

document.getElementById('btn-gather').addEventListener('click', () => {
    if (currentState !== 'SHUFFLING' && currentState !== 'SHUFFLING_INWARD') return;
    currentState = 'GATHERING';
    clearTimeout(shuffleIdleTimer);
    if (typeof BL !== 'undefined' && currentState !== 'SELECTING') {
        BL.clear();
    }

    // ✨ 新增：隱藏下方的整個按鈕列
    document.getElementById('ritual-ui').classList.add('hidden');

    cards.forEach(card => {
        let normalizedAngle = card.angle % (2 * Math.PI);
        if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
        card.tarotData.isReversed = (normalizedAngle > Math.PI / 2) && (normalizedAngle < 3 * Math.PI / 2);

        // 【關鍵修復】：重新啟動卡牌的動畫馬達，並清空所有的亂數推力
        card.isAnimating = true;
        Matter.Body.setStatic(card, true);
        // ✨ 核心修復 2-1：收牌時重新關閉碰撞，讓卡牌可以完美重疊疊好
        if (card.collisionFilter) card.collisionFilter.group = -1;
        card.targetAngle = 0;
        card.zVelocity = 0;
        card.pressure = 0;
    });

    // 按照深度排好序，避免收牌時穿模
    cards.sort((a, b) => a.zDepth - b.zDepth);
    cards.forEach((card, i) => {
        card.targetPos = { x: width / 2 - (i * 0.2), y: shuffleZone.centerY - (i * 0.2) };
    });

    setTimeout(async () => { // ✨ callback 改為 async
        currentState = 'GATHERED';

        // ✨ 非同步讀取切牌設定
        const valCut = await DB.get('stage_cut', true);
        const doCut = valCut !== 'false' && valCut !== false;

        if (doCut) {
            document.getElementById('cut-modal').classList.remove('hidden');
            document.getElementById('cut-modal').classList.add('flex');
            BL.show('cut_1');
            cutPiles = [[...cards]];
            cutsMade = 0;
            renderCutPiles();
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

function handleCut(pileIndex, localIndex) {
    // ✨ 核心計算：要切出 N 疊，代表你需要切 (N - 1) 次
    let cutsNeeded = window.currentMaxCutPiles - 1;
    if (cutsMade >= cutsNeeded) return; 

    const pileToSplit = cutPiles[pileIndex]; 
    const bottomHalf = pileToSplit.slice(0, localIndex + 1); 
    const topHalf = pileToSplit.slice(localIndex + 1);
    
    if (topHalf.length === 0 || bottomHalf.length === 0) return; 
    
    // 將切開的兩疊插回原本的陣列位置
    cutPiles.splice(pileIndex, 1, bottomHalf, topHalf); 
    cutsMade++;

    const blEl = document.getElementById('global-breathing-light');

    if (cutsMade < cutsNeeded) {
        BL.show('cut_1'); 
        // ✨ 動態回報進度
        if (blEl) blEl.innerText = `還需切 ${cutsNeeded - cutsMade} 次`;
    } else { 
        BL.clearAction('cut_1'); 
        // ✨ 完成時的提示
        if (blEl) {
            blEl.classList.remove('hidden');
            blEl.innerText = `切牌完成！`;
        }
        setTimeout(mergePilesAndFanOut, 1000); 
    }
    renderCutPiles();
}


function mergePilesAndFanOut() {
    let newCardsOrder = cutPiles.length === 3 ? [...cutPiles[1], ...cutPiles[2], ...cutPiles[0]] : [...cards];
    document.getElementById('cut-modal').classList.add('hidden'); 
    document.getElementById('cut-modal').classList.remove('flex');
    Composite.remove(world, cards); 
    cards = newCardsOrder; 
    Composite.add(world, cards); 
    fanSpread();
}


// ✨ 電腦自動代切邏輯 (補上中斷點與憑證檢查)
async function performAutoCutAndSpread(myRitualId = null) {
    const currentToken = ritualSessionToken;
    const cutIndex = Math.floor(cards.length * (0.3 + Math.random() * 0.4));
    const topHalf = cards.slice(0, cutIndex);
    const bottomHalf = cards.slice(cutIndex);

    topHalf.forEach(c => {
        c.isAnimating = true;
        c.targetPos = { x: c.position.x, y: c.position.y - 120 };
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

    if (currentRitualData.spread === 'single') {
        return stackSpread();
    }

    const style = await DB.get('draw_style', 'full');
    if (style === 'full') { return fullSpread(); }

    currentState = 'FANNING';
    const is78 = cards.length === 78;
    const cx = width / 2;
    cards.forEach((card, index) => {
        card.isAnimating = true; 
        Matter.Body.setStatic(card, true);
        let row = 0, indexInRow = index, countInRow = cards.length;
        let radius = Math.min(width * 0.45, 180), cy = height - 130;

        if (is78) {
            row = index % 5;
            indexInRow = Math.floor(index / 5);
            countInRow = 16;

            if (row === 0) { radius = Math.min(width * 0.48, 420); cy = height - 150; }
            else if (row === 1) { radius = Math.min(width * 0.40, 340); cy = height - 120; }
            else if (row === 2) { radius = Math.min(width * 0.32, 260); cy = height - 90; }
            else if (row === 3) { radius = Math.min(width * 0.24, 180); cy = height - 60; }
            else { radius = Math.min(width * 0.16, 100); cy = height - 30; } 
        }

        const progress = countInRow > 1 ? indexInRow / (countInRow - 1) : 0;
        const angleDeg = -60 + (progress * 120);
        const angleRad = angleDeg * (Math.PI / 180);

        card.targetPos = { x: cx + Math.sin(angleRad) * radius, y: cy - Math.cos(angleRad) * radius };
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

        const progress = i / (cards.length - 1 || 1);
        const offsetX = progress * totalThicknessX;
        const offsetY = progress * totalThicknessY;

        card.targetPos = {
            x: cx - (totalThicknessX / 2) + offsetX,
            y: cy + (totalThicknessY / 2) - offsetY
        };

        const randomJitter = (Math.random() - 0.5) * 0.08 * (1 - progress * 0.8);
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
    const usableBottom = height - 65;
    const usableWidth = width * 0.99;
    const drawAreaHeight = usableBottom - usableTop;
    const leftOffset = (width - usableWidth) / 2;

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
            else if (i < 11) { rowIdx = 1; colIdx = i - 5; cardsInThisRow = 6; } 
            else if (i < 17) { rowIdx = 2; colIdx = i - 11; cardsInThisRow = 6; } 
            else { rowIdx = 3; colIdx = i - 17; cardsInThisRow = 5; }

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
            const posX = (width - usableWidth) / 2 + col * cellW + cellW / 2;
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
        if (typeof BL !== 'undefined' && currentState !== 'SELECTING') {
            BL.clear();
        }

        cards.forEach(card => {
            let normalizedAngle = card.angle % (2 * Math.PI);
            if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;
            card.tarotData.isReversed = (normalizedAngle > Math.PI / 2) && (normalizedAngle < 3 * Math.PI / 2);
            card.isAnimating = true;
            Matter.Body.setStatic(card, true);
            // ✨ 核心修復 2-2：機器人自動收牌時，也要關閉碰撞
            if (card.collisionFilter) card.collisionFilter.group = 0;
            card.targetAngle = 0;
            card.zVelocity = 0;
            card.pressure = 0;
        });

        cards.sort((a, b) => a.zDepth - b.zDepth);
        cards.forEach((card, i) => {
            card.targetPos = { x: width / 2 - (i * 0.2), y: shuffleZone.centerY - (i * 0.2) };
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
                // 🎯 核心修復：檢查的變數名稱必須是 myRitualId，而不是 myToken
                if (!isRitualActive || (currentRitualData && currentRitualData.id !== myRitualId)) {
                    return resolve();
                }

                cards.forEach(card => {
                    Matter.Body.applyForce(card, card.position, {
                        x: (Math.random() - 0.5) * 0.06,
                        y: (Math.random() - 0.5) * 0.06
                    });
                    Matter.Body.setAngularVelocity(card, (Math.random() - 0.5) * 0.3);
                });

                await this.wait(800);
            }
            resolve();
        });
    },
    wait(ms) { return new Promise(r => setTimeout(r, ms)); }
};