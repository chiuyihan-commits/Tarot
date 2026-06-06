// 全域狀態控制
let isRitualActive = false; // ✨ 新增：記錄儀式是否正在進行中
let isCardRevealing = false; // 專門用來鎖定「開牌動畫」的無敵狀態

// 全域函數：開啟歷史紀錄
window.openHistoryScreen = async function () {
    await renderHistoryList(); // 先等紀錄從 DB 撈出來並渲染好
    navTo('screen-history');   // 再切換畫面，做到無縫接軌
};

// ============================================================================
// 🌟極簡還原版 (回歸手機原生行為，徹底解決閃退)
// ============================================================================
// 唯一保留的實用功能：讓使用者按下虛擬鍵盤的「Enter / 完成」時，可以正常收起鍵盤
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            document.activeElement.blur();
        }
    }
});

// ============================================================================
// 🔮 全域系統變數與設定 (Single Source of Truth)
// ============================================================================
// 全域狀態控制
let currentSelectedDeckSize = 78;
let currentSelectedSpread = 'single';
// ✨ 新增：洗牌與切牌的系統上限設定
const MAX_SHUFFLE_LIMIT = 10;
const MAX_CUT_LIMIT = 5;

const TAROT_SPREADS_CONFIG = [
    { id: 'single', name: '單牌 (1張)', icon: '🃏', desc: '解析直覺' },
    { id: 'triangle', name: '聖三角牌陣 (3張)', icon: '♻️', desc: '三張時序' },
    { id: 'five', name: '五連張牌陣 (5張)', icon: '⭐', desc: '五張時序' },
    { id: 'hexagram', name: '六芒星牌陣 (7張)', icon: '✡️', desc: '全面的事件解析' }
];

function applyDefaultSettings() {
    // --- 1. 同步牌數按鈕顯示 ---
    const deckIcon = document.getElementById('setup-deck-icon');
    const deckLabel = document.getElementById('setup-deck-label');

    if (deckIcon && deckLabel) {
        if (currentSelectedDeckSize === 22) {
            deckIcon.textContent = '🎴';
            deckLabel.textContent = '22 張 (大阿爾克那)';
        } else if (currentSelectedDeckSize === 78) {
            deckIcon.textContent = '🌌';
            deckLabel.textContent = '78 張 (完整塔羅)';
        }
    }

    // --- 2. 同步牌陣按鈕顯示 (✨ 使用全域資料庫) ---
    const spreadIcon = document.getElementById('setup-spread-icon');
    const spreadLabel = document.getElementById('setup-spread-label');

    if (spreadIcon && spreadLabel) {
        // 利用 find() 去全域陣列中尋找目前選取的牌陣
        const currentSpreadData = TAROT_SPREADS_CONFIG.find(spread => spread.id === currentSelectedSpread);

        if (currentSpreadData) {
            spreadIcon.textContent = currentSpreadData.icon;
            spreadLabel.textContent = currentSpreadData.name;
        }
    }
}

// ==========================================
// 模組 2: 呼吸燈系統 (BL Engine - Async 升級版)
// ==========================================
const BL = {
    el: null, timer: null, currentId: null,
    savedConfig: {},
    defaults: {
        'manual_shuffle': { text: '拖曳洗牌👇', mode: 'action', time: 0 },
        'shuffle_start': { text: '搓動洗牌🙌', mode: 'action', time: 0 },
        'shuffle_idle': { text: '將牌收攏/點擊收牌🤲', mode: 'action', time: 0 },
        'cut_1': { text: '第一次切牌🫳請點擊', mode: 'action', time: 0 },
        'cut_2': { text: '第二次切牌🫳請點擊', mode: 'action', time: 0 },
        'draw_place': { text: '{n} 🫳', mode: 'action', time: 0 },

        // ✨ 修改 1：原本解牌室的提示改為 time 模式，並設定 1.5 秒 (時間單位是你原本設計的秒數)
        'read_card': { text: '點擊牌面看牌義👇', mode: 'time', time: 1.5 },

        // ✨ 修改 2：新增你想要的上下三角形專屬提示
        'scroll_hint': { text: '▲ 滾動查看更多牌意 ▼', mode: 'time', time: 1.5 }
    },

    async init() {
        this.el = document.getElementById('global-breathing-light');
        this.savedConfig = await DB.get('bl_config', {});
    },

    getConfig(id) {
        // ✨ 修改 3 (最強防呆)：如果你傳入的 id 不在上面清單裡(例如直接傳一段文字)，
        // 系統會自動把它當成「顯示 1.5 秒的臨時文字」，不會報錯當機！
        return this.savedConfig[id] || this.defaults[id] || { text: id, mode: 'time', time: 1.5 };
    },

    show(id, replaceText = null) {
        this.clear(); if (!this.el) return;
        const conf = this.getConfig(id); if (conf.mode === 'none') return;

        let txt = conf.text; if (replaceText) txt = txt.replace('{n}', replaceText);
        this.el.innerText = txt;

        this.el.classList.remove('hidden');
        this.el.classList.add('pulse-anim');

        // ✨ 核心修正：將原本的 top-1/4 改為 top-[12%]，讓畫面中央完整留給物理牌堆
        this.el.classList.add('fixed', 'top-[12%]', 'left-1/2', '-translate-x-1/2', 'z-50');

        this.currentId = id;
        if (conf.mode === 'time') this.timer = setTimeout(() => { this.clear(); }, conf.time * 1000);
    },

    clearAction(id) { if (this.currentId === id && this.getConfig(id).mode === 'action') this.clear(); },

    clear() {
        clearTimeout(this.timer);
        if (this.el) {
            this.el.classList.add('hidden');
            this.el.classList.remove('pulse-anim');
            // ✨ 清除時，順便把定位 class 拔掉，保持乾淨
            this.el.classList.remove('bl-top-left', 'fixed', 'top-1/4', 'left-1/2', '-translate-x-1/2', 'z-50');
        }
        this.currentId = null;
    }
};

let breathingLightTimer = null; // 全域宣告一個計時器指針

// 找到負責顯示呼吸燈提示的函數，修改成包含自動隱藏的邏輯：
function showGlobalHint(msg) {
    const hintEl = document.getElementById('global-breathing-light');
    if (!hintEl) return;

    hintEl.innerHTML = msg;
    hintEl.classList.remove('hidden');
    hintEl.classList.add('active'); // 或是你原本顯示的 Class

    // ⚡ 核心修復：每次有新提示進來，先清除舊的計時器，避免時間錯亂
    if (breathingLightTimer) {
        clearTimeout(breathingLightTimer);
    }

    // ⚡ 設定 1.5 秒 (1500毫秒) 之後，自動淡出並隱藏
    breathingLightTimer = setTimeout(() => {
        hintEl.classList.add('hidden');
        hintEl.classList.remove('active');
    }, 1500);
}

function toggleBlTime(key) {
    const mode = document.getElementById(`bl_mode_${key}`).value;
    const timeInput = document.getElementById(`bl_time_${key}`);
    if (mode === 'time') timeInput.classList.remove('hidden');
    else timeInput.classList.add('hidden');
}

// ============================================================================
// 🌟 系統開機總管 (Master Boot Sequence)
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
    // 1. 核心服務與設定載入
    document.getElementById('draw-ui')?.classList.add('hidden');
    await syncSystemCache();
    await BL.init();
    applyStoredSettings();

    // 2. 讀取使用者偏好 (覆寫預設值)
    currentSelectedDeckSize = await DB.get('last_deck_size', 78);
    currentSelectedSpread = await DB.get('last_spread_id', 'single');

    // 3. ✨ 畫面同步渲染 (取代你原本寫死的 innerText，這會自動去抓全域設定檔)
    if (typeof applyDefaultSettings === 'function') applyDefaultSettings();
    await updateSpreadSelectDropdown();

    // 4. 其他 UI 與預載初始化
    initSettingsUI();
    if (typeof applyThemeColor === 'function') applyThemeColor();
    if (typeof initDeckThemeSelect === 'function') initDeckThemeSelect();
    if (typeof applyLockedPreferences === 'function') applyLockedPreferences();
    preloadDeckImages();

    // 5. 路由與畫面開場處理
    const isSoftReload = sessionStorage.getItem('is_soft_reload') === 'true';
    if (isSoftReload) {
        // 軟重載：瞬間進入首頁
        const splashScreen = document.getElementById('screen-splash');
        if (splashScreen) {
            splashScreen.classList.remove('active');
            splashScreen.classList.add('hidden');
        }
        navTo('screen-home', false);
        history.replaceState({ screen: 'screen-home' }, '', window.location.pathname);
        sessionStorage.removeItem('is_soft_reload');
    } else {
        // ✨ 冷啟動：呼叫全新的神聖幾何與布簾開場動畫
        if (typeof playSplashAnimation === 'function') {
            playSplashAnimation();
        } else {
            // 防呆機制：如果沒載入動畫函數，直接進首頁
            navTo('screen-home', false);
        }
    }

    // 6. 渲染歷史紀錄
    await renderHistoryList();

    // 7. 註冊瀏覽器重新整理攔截 (防止儀式中斷)
    window.addEventListener('beforeunload', (e) => {
        // 假設你的全域鎖叫做 isRitualActive，請確認變數名稱
        if (typeof isRitualActive !== 'undefined' && isRitualActive) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
});

// ==========================================
// 🃏 抽牌設定視窗 (支援手機實體返回鍵)
// ==========================================
window.openDeckModal = function () {
    // 📸 1. 推播歷史紀錄 (並附上世代護身符 sessionId)
    history.pushState({ modal: 'deck', sessionId: window.appSessionId }, '', location.hash);
    const modal = document.getElementById('modal-deck');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

window.openSpreadModal = function () {
    // 📸 1. 推播歷史紀錄 (並附上世代護身符 sessionId)
    history.pushState({ modal: 'spread', sessionId: window.appSessionId }, '', location.hash);
    const modal = document.getElementById('modal-spread');
    if (!modal) return;

    // 如果你有動態生成牌陣選單的函數，先等它跑完再顯示
    if (typeof updateSpreadSelectDropdown === 'function') {
        updateSpreadSelectDropdown().then(() => {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        });
    } else {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
};

// 給 HTML 裡的「返回」按鈕呼叫用的
window.closeSetupModal = function () {
    // 直接觸發返回鍵，交由最下方的 popstate 監聽器統一處理隱藏邏輯
    history.back();
};

async function selectDeckAndNext(size, iconText, labelText) {
    if (typeof currentRitualData !== 'undefined') {
        currentRitualData.deckSize = size;
    }
    currentSelectedDeckSize = size;

    await DB.set('last_deck_size', size);

    // ✨ 加入安全防護：先抓取元素，確定存在才替換文字！
    const labelEl = document.getElementById('setup-deck-label');
    const iconEl = document.getElementById('setup-deck-icon');

    if (labelEl) labelEl.innerText = labelText;
    if (iconEl) iconEl.innerText = iconText;

    // 關閉 Modal
    const modal = document.getElementById('modal-deck');
    if (modal) {
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
}

function handleSetupNext() {
    if (currentSelectedSpread === 'custom') {
        initCustomBuilder(); navTo('screen-custom-builder');
    } else if (currentSelectedSpread === 'single') {
        openSingleCardModal(); // ✨ 攔截進入單牌專屬視窗
    } else {
        startRitual();
    }
}

// ✨ 單牌專屬流程控制器
async function openSingleCardModal() {
    const savedState = await DeckStorage.load();
    // ✨ 核心修復：必須「有舊紀錄」且「舊紀錄的張數與你當下在首頁選的張數一模一樣」才解鎖！
    const canUseOld = savedState !== null && savedState.size === currentSelectedDeckSize;

    // 我們借用自訂的 Confirm Modal，並改寫它的內容
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('confirm-msg');

    // 注入三個按鈕
    msgEl.innerHTML = `
        <p class="mb-4 text-yellow-300 font-bold text-lg">🃏 單牌速占模式</p>
        <div class="flex flex-col gap-3">
            <button id="btn-single-old" class="magic-btn py-3 text-sm ${canUseOld ? '' : 'btn-nintendo-disabled'}" ${canUseOld ? '' : 'disabled'}>
                🔮 使用舊牌 ${canUseOld ? `(${savedState.size}張)` : '(無紀錄)'}
            </button>
            <button id="btn-single-auto" class="magic-btn py-3 text-sm border-blue-400 text-blue-200">
                🌀 自動洗牌
            </button>
            <button id="btn-single-manual" class="magic-btn py-3 text-sm border-green-400 text-green-200">
                🫳 手動洗牌
            </button>
        </div>
    `;

    document.getElementById('btn-confirm-ok').classList.add('hidden');
    document.getElementById('btn-confirm-cancel').innerText = '取消返回';
    document.getElementById('btn-confirm-cancel').onclick = () => { modal.classList.add('hidden'); };

    document.getElementById('btn-single-old').onclick = async () => {
        modal.classList.add('hidden');
        currentSelectedDeckSize = savedState.size; // 繼承舊牌大小

        // 依照儲存的 ID 與正逆位重新組裝實體牌堆
        const baseDeck = await generateBaseDeck(savedState.size);
        currentRealDeck = savedState.deck.map(savedCard => {
            let card = baseDeck.find(c => c.id === savedCard.id);
            card.isReversed = savedCard.isReversed;
            return card;
        });

        // ✨ 直接跳轉展牌 (無縫出現)
        await startSingleRitualDirectly();

        // ⚡ 核心進化：給予 800 毫秒的卡牌浮現動畫緩衝，隨即自動出牌直達解牌室！
        setTimeout(() => {
            // 確保物理世界有牌，且目前還沒有開始抽牌
            if (typeof cards !== 'undefined' && cards.length > 0) {
                // 🎯 自動鎖定實體牌堆中最上面的那張牌
                selectedCard = cards[cards.length - 1];

                // 🎯 直接觸發確認選牌，無縫傳送進解牌室
                if (typeof confirmDrawCard === 'function') {
                    confirmDrawCard();
                }
            }
        }, 800); // 800ms 的延遲能讓玩家視覺上看到牌堆成型後「瞬間抽離」的華麗動效
    };

    document.getElementById('btn-single-auto').onclick = async () => {
        modal.classList.add('hidden');
        currentRitualData = { id: Date.now().toString(), date: new Date().toLocaleString('zh-TW'), question: document.getElementById('input-question').value || '單牌速占', spread: 'single', cards: [], notes: '' };
        currentRealDeck = shuffleArray(await generateBaseDeck(currentSelectedDeckSize));
        AutoBot.execute(); // ✨ 啟動自動化機器人
    };

    document.getElementById('btn-single-manual').onclick = () => {
        modal.classList.add('hidden');
        startRitual(); // ✨ 進入正常手動流程
    };

    modal.classList.remove('hidden'); modal.classList.add('flex');
}

// 供舊牌模式直接展牌使用
async function startSingleRitualDirectly() {
    isRitualActive = true; // ✨ 補上這行，確保單牌速占也能觸發返回防護罩
    currentRitualData = { id: Date.now().toString(), date: new Date().toLocaleString('zh-TW'), question: document.getElementById('input-question').value || '單牌速占', spread: 'single', cards: [], notes: '' };
    navTo('screen-ritual');
    setupWashUI();
    buildSpread('single');
    await initPhysicsDeck(currentRealDeck);

    // 直接觸發展牌
    setTimeout(() => { fanSpread(); }, 300);
}

// 核心路由導航系統 (防鬼打牆終極版)
function navTo(screenId, pushToHistory = true) {
    // 🛡️ 1. 攔截機制：如果正在占卜中，企圖回首頁，觸發確認
    if ((currentState === 'SHUFFLING' || currentState === 'WASHING' || currentState === 'SELECTING' || currentState === 'FANNING' || currentState === 'GATHERED') && screenId === 'screen-home') {
        if (isGlobalConfirmShowing) return;
        isGlobalConfirmShowing = true;

        showConfirm('目前正在儀式中，確定要結束占卜回到首頁嗎？',
            () => { returnToHomeSafely(); },
            () => { isGlobalConfirmShowing = false; }
        );
        return;
    }

    // 🛡️ 2. 防鬼打牆機制：防止按上一頁硬闖已失效的儀式畫面
    if (!isRitualActive) {
        // 如果沒在占卜，卻企圖進入洗牌桌
        if (screenId === 'screen-ritual' || screenId === 'screen-manual-shuffle') {
            screenId = 'screen-home';
            pushToHistory = false; // 禁止把錯誤路徑推入歷史
        }
        // 如果沒在占卜，且【不是】在看阿卡西歷史紀錄，卻企圖進入解牌室
        if (screenId === 'screen-reading' && !currentViewingRecordId) {
            screenId = 'screen-home';
            pushToHistory = false;
        }
    }

    // 🧹 狀態重置：離開歷史紀錄或回到首頁時，清除歷史檢視 ID
    if (screenId === 'screen-home' || screenId === 'screen-history') {
        currentViewingRecordId = null;
    }

    // 3. 日常切換：隱藏所有畫面，只亮起目標畫面
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');

    // 4. 畫布圖層動態顯示/隱藏控制
    const canvasLayer = document.getElementById('canvas-layer');
    if (canvasLayer) {
        let keepCanvas = (screenId === 'screen-ritual');
        if (screenId === 'screen-reading' && typeof currentRitualData !== 'undefined' && currentRitualData.spread === 'single' && isRitualActive) {
            keepCanvas = true;
        }

        if (keepCanvas) {
            canvasLayer.style.display = 'block';
            canvasLayer.classList.add('active');
        } else {
            canvasLayer.style.display = 'none';
            canvasLayer.classList.remove('active');
        }
    }

    // 5. 呼吸燈與歷史紀錄推軌控制
    if (typeof BL !== 'undefined' && currentState !== 'SELECTING') BL.clear();

    if (pushToHistory) {
        history.pushState({ screen: screenId }, '', `#${screenId}`);
    } else {
        // 如果被攔截或禁止推送，改用 replaceState 靜默覆蓋掉當前錯誤的網址
        history.replaceState({ screen: screenId }, '', `#${screenId}`);
    }
}

// ✨ 升級版 showConfirm：支援第三個參數 onCancel，確保鎖定機制能完美釋放
function showConfirm(msg, onConfirm, onCancel) {
    const modal = document.getElementById('custom-confirm-modal');
    const modalBox = modal.querySelector('div');
    const msgEl = document.getElementById('confirm-msg');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    msgEl.innerText = msg;
    btnOk.classList.remove('hidden');
    btnCancel.classList.remove('hidden');
    btnCancel.style.display = 'block';
    btnOk.style.display = 'block';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modalBox.classList.replace('scale-95', 'scale-100'), 10);

    const closeModal = () => {
        const handleScaleEnd = (e) => {
            if (e.propertyName === 'transform') {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                modalBox.removeEventListener('transitionend', handleScaleEnd);
            }
        };
        modalBox.addEventListener('transitionend', handleScaleEnd);
        modalBox.classList.replace('scale-100', 'scale-95');
    };

    btnOk.onclick = () => {
        closeModal();
        if (onConfirm) onConfirm();
    };

    // ✨ 核心修復：取消時也能執行綁定的解鎖動作！
    btnCancel.onclick = () => {
        closeModal();
        if (onCancel) onCancel();
    };
}

// ============================================================================
// 📸 設定頁面專用：三向路由彈窗與快照引擎
// ============================================================================
let currentSubSettingsSnapshot = null;
let currentActiveSubModal = null;

// ✨ 1. 偏執狂專用翻譯字典
const SETTING_NAMES_DICT = {
    'set-stage-shuffle': '牌堆洗牌',
    'setting-min-shuffle': '最少洗牌次數',
    'mode-stage-shuffle': '洗牌自動化',
    'set-stage-wash': '桌面搓牌',
    'mode-stage-wash': '搓牌自動化',
    'set-stage-cut': '憑直覺切牌',
    'mode-stage-cut': '切牌自動化',
    'setting-draw-style': '抽牌風格',
    'setting-select-mode': '選牌操作模式',
    'theme-color-picker': '環境調色盤',
    'setting-deck-theme': '塔羅主題'
};

// 擷取當前視窗所有設定值的快照
function getModalInputValues(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return {};
    const inputs = modal.querySelectorAll('input:not([type="file"]), select, textarea');
    const vals = {};
    inputs.forEach(inp => {
        if (!inp.id) return;
        if (inp.type === 'checkbox') vals[inp.id] = inp.checked;
        else vals[inp.id] = inp.value;
    });
    return vals;
}

// 髒值檢測：比對現在的值和快照一不一樣
function isSubSettingsChanged() {
    if (!currentActiveSubModal || !currentSubSettingsSnapshot) return false;
    const currentVals = getModalInputValues(currentActiveSubModal);
    for (let key in currentSubSettingsSnapshot) {
        if (currentSubSettingsSnapshot[key] !== currentVals[key]) return true;
    }
    return false;
}

// 升級髒值檢測：直接回傳「變更了哪些項目」的陣列
function getChangedSettings() {
    if (!currentActiveSubModal || !currentSubSettingsSnapshot) return [];

    const currentVals = getModalInputValues(currentActiveSubModal);
    const changedItems = [];

    for (let key in currentSubSettingsSnapshot) {
        if (currentSubSettingsSnapshot[key] !== currentVals[key]) {
            changedItems.push(SETTING_NAMES_DICT[key] || '部分設定');
        }
    }
    return changedItems;
}

// 逆轉時空：把畫面和資料庫全數退回快照狀態
async function revertSubSettingsToSnapshot() {
    if (!currentActiveSubModal || !currentSubSettingsSnapshot) return;
    window.isRevertingSettings = true; // 開啟靜默模式，禁止彈出 Toast

    for (let key in currentSubSettingsSnapshot) {
        const inp = document.getElementById(key);
        if (inp) {
            if (inp.type === 'checkbox') {
                if (inp.checked !== currentSubSettingsSnapshot[key]) {
                    inp.checked = currentSubSettingsSnapshot[key];
                    inp.dispatchEvent(new Event('change')); // 觸發系統自動存回舊值
                }
            } else {
                if (inp.value !== currentSubSettingsSnapshot[key]) {
                    inp.value = currentSubSettingsSnapshot[key];
                    inp.dispatchEvent(new Event('change')); // 觸發系統自動存回舊值
                }
            }
        }
    }
    await new Promise(r => setTimeout(r, 150)); // 等待資料庫存檔完畢
    window.isRevertingSettings = false; // 解除靜默模式
}

// 三向選項彈跳視窗 (動態替換按鈕，不弄髒 HTML)
function showThreeWayConfirm(msg, onDiscard, onContinue, onSave) {
    const modal = document.getElementById('custom-confirm-modal');
    const modalBox = modal.querySelector('div');
    const msgEl = document.getElementById('confirm-msg');

    // 備份原本的雙按鈕結構
    const btnContainer = modalBox.querySelector('.flex.justify-center.gap-4');
    const originalHTML = btnContainer.innerHTML;

    msgEl.innerText = msg;

    // 植入三向按鈕
    btnContainer.innerHTML = `
        <button id="btn-3way-discard" class="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-white text-sm font-bold transition-colors">放棄</button>
        <button id="btn-3way-continue" class="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded text-white text-sm font-bold transition-colors">繼續</button>
        <button id="btn-3way-save" class="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-purple-900 rounded text-sm font-bold transition-colors">儲存</button>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => modalBox.classList.replace('scale-95', 'scale-100'), 10);

    const closeModal = () => {
        const handleScaleEnd = (e) => {
            if (e.propertyName === 'transform') {
                modal.classList.remove('flex');
                modal.classList.add('hidden');
                modalBox.removeEventListener('transitionend', handleScaleEnd);
                btnContainer.innerHTML = originalHTML; // 動畫結束後，神不知鬼不覺把按鈕還原
            }
        };
        modalBox.addEventListener('transitionend', handleScaleEnd);
        modalBox.classList.replace('scale-100', 'scale-95');
    };

    document.getElementById('btn-3way-discard').onclick = () => { closeModal(); if (onDiscard) onDiscard(); };
    document.getElementById('btn-3way-continue').onclick = () => { closeModal(); if (onContinue) onContinue(); };
    document.getElementById('btn-3way-save').onclick = () => { closeModal(); if (onSave) onSave(); };
}

// ==========================================
// ✨ 輕量提示系統 (Toast Notification)
// ==========================================
// ==========================================
// ✨ 輕量提示系統 (智慧堆疊景深版)
// ==========================================
window.isRevertingSettings = false;
window.lastToastMsg = "";   // 用來記錄上一則訊息
window.lastToastTime = 0;   // 用來記錄上一則訊息的時間

window.showToast = function (msg, duration = 3000) {
    if (window.isRevertingSettings) return;

    // 🛡️ 防禦機制 1：防洗頻 (Spam Filter)
    // 如果 500 毫秒內連續觸發「一模一樣」的訊息，直接擋掉，不讓畫面閃爍
    const now = Date.now();
    if (msg === window.lastToastMsg && now - window.lastToastTime < 500) return;
    window.lastToastMsg = msg;
    window.lastToastTime = now;

    let toastBox = document.getElementById('altar-toast-container');
    if (!toastBox) {
        toastBox = document.createElement('div');
        toastBox.id = 'altar-toast-container';
        // 注意：這裡改用 flex-col-reverse，讓新訊息出現在最下方，舊的被往上頂
        toastBox.className = 'fixed top-16 left-1/2 transform -translate-x-1/2 z-[9999] flex flex-col-reverse gap-2 items-center pointer-events-none w-full max-w-sm px-4';
        document.body.appendChild(toastBox);
    }

    // 建立新的 Toast
    const toast = document.createElement('div');
    toast.className = 'bg-black/90 border border-purple-500 text-yellow-300 px-5 py-2.5 rounded-2xl shadow-[0_0_15px_rgba(168,85,247,0.4)] text-sm font-bold tracking-widest backdrop-blur-md transition-all duration-300 transform translate-y-[-20px] opacity-0 origin-bottom';
    toast.innerText = msg;

    // 塞入容器的最前面
    toastBox.insertBefore(toast, toastBox.firstChild);

    // 觸發進場動畫 (必須等下一幀)
    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-[-20px]', 'opacity-0');
        toast.classList.add('translate-y-0', 'opacity-100');
    });

    // 🎨 核心視覺邏輯：計算所有當存活的 Toast，套用景深與淡化
    const allToasts = Array.from(toastBox.children);
    allToasts.forEach((t, index) => {
        if (index === 0) {
            // 最新的：最亮、最大
            t.style.opacity = '1';
            t.style.transform = 'scale(1) translateY(0)';
        } else if (index === 1) {
            // 第二個：稍微變暗、稍微縮小
            t.style.opacity = '0.7';
            t.style.transform = 'scale(0.95) translateY(-4px)';
        } else if (index === 2) {
            // 第三個：很暗、更小
            t.style.opacity = '0.4';
            t.style.transform = 'scale(0.9) translateY(-8px)';
        } else {
            // 第四個以上：無情強制消滅！
            t.style.opacity = '0';
            t.style.transform = 'scale(0.8) translateY(-15px)';
            setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 300);
        }
    });

    // 正常的時間到自然消滅邏輯
    setTimeout(() => {
        if (toast.parentNode) {
            toast.style.opacity = '0';
            toast.style.transform = 'scale(0.8) translateY(-15px)';
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 300); // 等待退場動畫結束後拔除 DOM
        }
    }, duration);
};

function showAlert(msg, onOk) {
    const modal = document.getElementById('custom-confirm-modal');
    const msgEl = document.getElementById('confirm-msg');
    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    // ✨ 1. 先把負責縮放動畫的內部元素抓出來存好
    const modalBox = modal.querySelector('div');

    msgEl.innerText = msg;
    btnCancel.classList.add('hidden'); // 隱藏取消按鈕
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // 保留這個 10ms 延遲，確保瀏覽器先渲染出畫面再觸發放大動畫
    setTimeout(() => modalBox.classList.replace('scale-95', 'scale-100'), 10);

    const cleanup = () => {
        // ✨ 2. 定義動畫結束時要執行的「收尾動作」
        const handleScaleEnd = (e) => {
            // 確保觸發的是 transform (縮放) 動畫結束
            if (e.propertyName === 'transform') {
                modal.classList.remove('flex');
                modal.classList.add('hidden');

                // 收尾完畢，立刻拔除這個監聽器，避免下次開啟時重複觸發
                modalBox.removeEventListener('transitionend', handleScaleEnd);
            }
        };

        // ✨ 3. 把監聽器綁定到執行縮放的 modalBox 上
        modalBox.addEventListener('transitionend', handleScaleEnd);

        // ✨ 4. 觸發 CSS 縮小動畫，取代原本的 setTimeout 200
        modalBox.classList.replace('scale-100', 'scale-95');

        // 拔除按鈕的點擊監聽 (維持你原本優良的防呆設計)
        btnOk.removeEventListener('click', okHandler);
    };

    const okHandler = () => { cleanup(); if (onOk) onOk(); };
    btnOk.addEventListener('click', okHandler);
}

function rebuildManualDOM() {
    const container = document.getElementById('manual-deck-container');
    if (!container) return;
    container.innerHTML = '';

    // ✨ 核心修正：使用當前實際牌組長度，嚴禁使用固定數值
    const totalCards = currentRealDeck.length;
    const sliceSpacing = 200 / totalCards;

    for (let i = 0; i < totalCards; i++) {
        let cardSlice = document.createElement('div');
        // 22 張時讓切片厚一點，手感較好
        const thickness = totalCards === 22 ? 'h-[5px]' : 'h-[3px]';
        cardSlice.className = `w-full ${thickness} bg-purple-200 border-b border-purple-500 rounded-sm mb-[1px] absolute`;
        cardSlice.style.bottom = `${i * sliceSpacing}px`;
        cardSlice.style.zIndex = i;
        cardSlice.dataset.index = i;
        container.appendChild(cardSlice);
    }
}

// ✨ 宣告為 async
async function initSettingsUI() {
    const blContainer = document.getElementById('breathing-settings-container');
    const select = document.getElementById('meaning-card-select');

    // ✨ 從 IndexedDB 讀取設定 (替換 localStorage)
    const drawMode = await DB.get('select_mode', 'click');
    const modeSelect = document.getElementById('setting-select-mode');
    if (modeSelect) modeSelect.value = drawMode;

    if (!blContainer || !select) return;
    blContainer.innerHTML = '';

    // 【選牌微震動開關】
    const isHapticOn = await DB.get('haptic_enabled', true);
    // ⚠️ 注意：HTML 裡面的 onchange 不能直接寫 DB.set (會報錯)，我們要把它拿出來用 addEventListener 綁定
    blContainer.innerHTML += `
        <div class="flex justify-between items-center bg-black/30 p-2 rounded mb-3 border border-yellow-500/30">
            <span class="text-yellow-300 font-bold">📳 選牌微震動回饋 (支援手機)</span>
            <input type="checkbox" id="setting-haptic-toggle" ${isHapticOn ? 'checked' : ''} class="w-5 h-5 accent-yellow-400 cursor-pointer">
        </div>
    `;

    // ✨ 新增：動態綁定震動開關的事件
    setTimeout(() => {
        document.getElementById('setting-haptic-toggle')?.addEventListener('change', async function () {
            await DB.set('haptic_enabled', this.checked);
            await syncSystemCache();
        });
    }, 100);

    // 【讀取儀式三階段的設定狀態】
    const stageShuffle = await DB.get('stage_shuffle', true);
    const minShuffle = await DB.get('min_shuffle_count', 3); // ✨ 讀取最少次數
    const stageWash = await DB.get('stage_wash', true);
    const stageCut = await DB.get('stage_cut', true);
    const minCutPiles = await DB.get('cut_piles_count', 3);

    const chkShuffle = document.getElementById('set-stage-shuffle');
    const inpMinShuffle = document.getElementById('setting-min-shuffle'); // ✨ 抓取輸入框
    const labelMinShuffle = document.getElementById('label-min-shuffle');
    const chkWash = document.getElementById('set-stage-wash');
    const chkCut = document.getElementById('set-stage-cut');
    const inpCutPiles = document.getElementById('setting-cut-piles');
    const labelCutPiles = document.getElementById('label-cut-piles');

    if (chkShuffle) {
        chkShuffle.checked = (stageShuffle !== 'false' && stageShuffle !== false);
        // ✨ 開機立刻同步任天堂灰色禁用狀態
        if (typeof toggleMinShuffleState === 'function') toggleMinShuffleState(chkShuffle.checked);
    }
    if (inpCutPiles) {
        inpCutPiles.value = minCutPiles;
        inpCutPiles.max = MAX_CUT_LIMIT; // ✨ 動態鎖死輸入框最大值
    }
    if (labelCutPiles) {
        // ✨ 動態把變數塞進 HTML 文字中！
        labelCutPiles.innerText = `↳ 切牌堆數 (2~${MAX_CUT_LIMIT}疊)`;
    }

    if (chkCut) {
        chkCut.checked = (stageCut !== 'false' && stageCut !== false);
        // ✨ 開機同步灰色狀態
        if (typeof toggleCutState === 'function') toggleCutState(chkCut.checked);
    }

    if (inpMinShuffle) {
        inpMinShuffle.value = minShuffle;
        inpMinShuffle.max = MAX_SHUFFLE_LIMIT; // ✨ 動態鎖死輸入框的最大值
    }
    if (labelMinShuffle) {
        // ✨ 動態把變數塞進 HTML 文字中！
        labelMinShuffle.innerText = `↳ 最少洗牌次數 (1~${MAX_SHUFFLE_LIMIT}次)`;
    }
    if (chkWash) chkWash.checked = (stageWash !== 'false' && stageWash !== false);
    if (chkCut) chkCut.checked = (stageCut !== 'false' && stageCut !== false);

    // 【呼吸燈設定生成邏輯】
    const savedBl = await DB.get('bl_config', {});
    Object.keys(BL.defaults).forEach(key => {
        const conf = savedBl[key] || BL.defaults[key];
        const div = document.createElement('div'); div.className = "flex justify-between items-center bg-black/30 p-2 rounded mb-2";
        div.innerHTML = `<span class="truncate w-1/2 pr-2 text-purple-200">${conf.text.replace('{n}', 'N')}</span>
            <div class="flex gap-1 w-1/2 justify-end">
                <select id="bl_mode_${key}" class="bg-purple-900 text-white rounded p-1 text-xs" onchange="toggleBlTime('${key}')">
                    <option value="action" ${conf.mode === 'action' ? 'selected' : ''}>動作結束</option><option value="continuous" ${conf.mode === 'continuous' ? 'selected' : ''}>持續</option>
                    <option value="time" ${conf.mode === 'time' ? 'selected' : ''}>計時</option><option value="none" ${conf.mode === 'none' ? 'selected' : ''}>關閉</option>
                </select>
                <input type="number" id="bl_time_${key}" value="${conf.time}" min="1" max="10" class="w-10 bg-purple-900 text-center rounded text-xs ${conf.mode === 'time' ? '' : 'hidden'}">
            </div>`;
        blContainer.appendChild(div);
    });

    select.innerHTML = '';

    // ✨ 這裡必須加上 await，因為 generateBaseDeck 已經變成非同步了
    const deck = await generateBaseDeck(78);
    deck.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.innerText = c.name.replace('\n', ' - ');
        select.appendChild(opt);
    });

    // 下拉選單切換時，讀取自訂牌義
    select.addEventListener('change', async (e) => {
        const customs = await DB.get('meanings_custom', {});
        document.getElementById('meaning-custom-input').value = customs[e.target.value] || '';
    });

    // 同步主題與牌組
    const savedTheme = await DB.get('deck_theme', 'cards');
    if (document.getElementById('setting-deck-theme')) {
        document.getElementById('setting-deck-theme').value = savedTheme;
    }

    //同步牌組
    await renderDeckThemeOptions();

    // 手動觸發一次事件，載入第一張牌的資料
    select.dispatchEvent(new Event('change'));
}

//設定切換按鈕
function switchSettingTab(tab) {
    document.querySelectorAll('.setting-tab-btn').forEach(b => { b.classList.remove('bg-purple-700'); b.classList.add('bg-purple-900'); });
    event.target.classList.remove('bg-purple-900'); event.target.classList.add('bg-purple-700');
    document.getElementById('setting-tab-ui').classList.add('hidden'); document.getElementById('setting-tab-logic').classList.add('hidden');
    document.getElementById(`setting-tab-${tab}`).classList.remove('hidden');
}

// ==========================================
// ✨ 設定頁面專屬：事件綁定器 (Event Listeners)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // 1. 綁定剛剛修改的按鈕 (等待列表渲染完再跳頁)
    window.openSpreadManager = async function () {
        await renderSpreadManageList();
        navTo('screen-spread-manage');
    };

    // 2. 綁定下拉選單與開關 (寫入 IndexedDB)
    document.getElementById('setting-draw-style')?.addEventListener('change', async (e) => {
        await DB.set('draw_style', e.target.value);
        await syncSystemCache();
    });

    document.getElementById('setting-select-mode')?.addEventListener('change', async (e) => {
        await DB.set('select_mode', e.target.value);
        await syncSystemCache();
        if (typeof updateDrawButtons === 'function') updateDrawButtons();
    });

    document.getElementById('set-stage-shuffle')?.addEventListener('change', async (e) => {
        await DB.set('stage_shuffle', e.target.checked);
        await syncSystemCache();
    });

    document.getElementById('set-stage-wash')?.addEventListener('change', async (e) => {
        await DB.set('stage_wash', e.target.checked);
        await syncSystemCache();
    });

    document.getElementById('set-stage-cut')?.addEventListener('change', async (e) => {
        await DB.set('stage_cut', e.target.checked);
        await syncSystemCache();
    });

    // 監聽主題切換
    document.getElementById('setting-deck-theme')?.addEventListener('change', async (e) => {
        await DB.set('deck_theme', e.target.value);
        // 同步更新快取 (如果你有做 SystemCache 的話)
        if (typeof syncSystemCache === 'function') await syncSystemCache();
        showToast('🎨 牌組主題已切換！下一次占卜將生效。', 3500);
    });

    // 🌟 1. 洗牌次數 (即時攔截、自動全選與失焦存檔)
    const minShuffleInput = document.getElementById('setting-min-shuffle');
    if (minShuffleInput) {
        // ✨ 新增：點擊獲得焦點時，自動全選裡面的數字 (加入 10ms 延遲以完美支援手機端)
        minShuffleInput.addEventListener('focus', (e) => {
            setTimeout(() => { e.target.select(); }, 10);
        });

        // 當使用者打字時，只要超過上限，瞬間修正並提示
        minShuffleInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (val > MAX_SHUFFLE_LIMIT) {
                e.target.value = MAX_SHUFFLE_LIMIT;
                if (typeof showToast === 'function') showToast(`⚠️ 洗牌上限為 ${MAX_SHUFFLE_LIMIT} 次`);
            }
        });

        // 當輸入框失去焦點時，檢查下限並寫入資料庫
        minShuffleInput.addEventListener('blur', async (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 3;
            if (val < 1) {
                val = 1; e.target.value = 1;
                if (typeof showToast === 'function') showToast(`⚠️ 最少需洗牌 1 次`);
            }
            await DB.set('min_shuffle_count', val);
            if (typeof syncSystemCache === 'function') await syncSystemCache();
        });
    }

    // 🌟 2. 切牌次數 (即時攔截、自動全選與失焦存檔)
    const cutPilesInput = document.getElementById('setting-cut-piles');
    if (cutPilesInput) {
        // ✨ 新增：自動全選邏輯
        cutPilesInput.addEventListener('focus', (e) => {
            setTimeout(() => { e.target.select(); }, 10);
        });

        cutPilesInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value);
            if (val > MAX_CUT_LIMIT) {
                e.target.value = MAX_CUT_LIMIT;
                if (typeof showToast === 'function') showToast(`⚠️ 切牌上限為 ${MAX_CUT_LIMIT} 疊`);
            }
        });

        cutPilesInput.addEventListener('blur', async (e) => {
            let val = parseInt(e.target.value);
            if (isNaN(val)) val = 3;
            if (val < 2) {
                val = 2; e.target.value = 2;
                if (typeof showToast === 'function') showToast(`⚠️ 最少需切 2 疊`);
            }
            await DB.set('cut_piles_count', val);
            if (typeof syncSystemCache === 'function') await syncSystemCache();
        });
    }

    // ==========================================
    // ✨ 圖片上傳轉 Base64 寫入 IndexedDB 區塊
    // ==========================================
    const setupImageUploader = (inputId, dbKey) => {
        document.getElementById(inputId)?.addEventListener('change', async function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    await DB.set(dbKey, event.target.result);
                    showToast(`✅ 圖片上傳成功！請點擊下方「套用設定」生效。`);
                } catch (err) {
                    console.error('圖片存檔失敗:', err);
                    showToast('❌ 圖片過大或存檔失敗');
                }
            };
            reader.readAsDataURL(file);
        });
    };

    // 綁定三個單張圖片的上傳按鈕
    setupImageUploader('upload-cardback', 'cardback');
    setupImageUploader('upload-bg-img', 'bg_img');
    setupImageUploader('upload-splash-anim', 'tarot_anim_splash');
    setupImageUploader('upload-desk-img', 'desk_img');

    // (註：批次上傳 78 張牌的邏輯，你原本已經寫在 upload-deck-batch 的監聽器裡了，保持原樣即可)
});

// ==========================================
// ✨ 牌組主題動態管理系統
// ==========================================

// 1. 初始化名單 (如果 DB 是空的，給予預設值)
async function getDeckThemeList() {
    const defaultList = [
        { name: '經典萊德偉特', id: 'cards' },
        { name: '托特塔羅牌', id: 'thoth' },
        { name: '二次元動漫風', id: 'anime' }
    ];
    return await DB.get('deck_theme_list', defaultList);
}

// 2. 渲染下拉選單
async function renderDeckThemeOptions() {
    const select = document.getElementById('setting-deck-theme');
    if (!select) return;

    const list = await getDeckThemeList();
    const currentTheme = await DB.get('deck_theme', 'cards');

    select.innerHTML = list.map(theme =>
        `<option value="${theme.id}" ${theme.id === currentTheme ? 'selected' : ''}>${theme.name}</option>`
    ).join('');
}

// 3. 新增自訂主題
async function addNewDeckTheme() {
    const nameInput = document.getElementById('new-theme-name');
    const idInput = document.getElementById('new-theme-id');
    const name = nameInput.value.trim();
    const id = idInput.value.trim();

    if (!name || !id) {
        showToast('請輸入完整的名稱與資料夾 ID');
        return;
    }

    let list = await getDeckThemeList();

    // 檢查是否重複
    if (list.some(t => t.id === id)) {
        showToast('此資料夾 ID 已存在');
        return;
    }

    list.push({ name, id });
    await DB.set('deck_theme_list', list);

    // 清空輸入框並刷新選單
    nameInput.value = '';
    idInput.value = '';
    await renderDeckThemeOptions();
    showToast("✅ 已新增牌組：${name}！", 4000);
}

// ==========================================
// ✨ 設定頁面子視窗控制 (智慧歷史紀錄版)
// ==========================================
function openSubSettings(modalId) {
    // 📸 1. 推播歷史紀錄 (並附上世代護身符 sessionId)
    history.pushState({ modal: 'sub-settings', sessionId: window.appSessionId }, '', location.hash);

    const overlay = document.getElementById('sub-settings-overlay');
    const allModals = document.querySelectorAll('.sub-modal');

    // 隱藏所有子視窗
    allModals.forEach(m => m.classList.add('hidden'));

    // 顯示遮罩與目標視窗
    overlay.classList.remove('hidden');
    overlay.classList.add('flex');
    document.getElementById(modalId).classList.remove('hidden');

    // 彈出動畫
    const target = document.getElementById(modalId);
    target.style.transform = 'scale(0.8)';
    target.style.opacity = '0';
    setTimeout(() => {
        target.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        target.style.transform = 'scale(1)';
        target.style.opacity = '1';
    }, 10);

    // 📸 2. 視窗打開的瞬間，拍下所有設定的快照！
    currentActiveSubModal = modalId;
    currentSubSettingsSnapshot = getModalInputValues(modalId);
}

// ✨ 核心：設定頁面關閉邏輯 (快照比對 + 精準提示版)
window.closeSubSettings = function (fromHistory = false) {
    const overlay = document.getElementById('sub-settings-overlay');
    if (!overlay || overlay.classList.contains('hidden')) return;

    // 1. 強制讓輸入框失去焦點，確保最新的輸入值能正確觸發存檔
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        document.activeElement.blur();
    }

    // 🔍 2. 進行快照比對：檢查是否有異動
    let hasChanged = false;
    if (typeof isSubSettingsChanged === 'function') {
        hasChanged = isSubSettingsChanged(); // 呼叫你原本寫好的快照判斷函數
    }

    // 3. 執行關閉
    window.forceCloseSubSettings(fromHistory);

    // ✨ 4. 根據比對結果，跳出不同的精準提示
    if (typeof showToast === 'function') {
        if (hasChanged) {
            showToast('✅ 設定已自動套用');
        } else {
            showToast('👌 設定無異動'); // 你可以改成自己喜歡的文字，如「沒有變更」
        }
    }

    // 5. 判定完畢後，安全銷毀快照
    currentSubSettingsSnapshot = null; 
};

// ✨ 外殼轉接頭 (維持不變，負責掛載防彈鋼板)
window.saveAndCloseSubSettings = function (e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation(); 
    }
    window.closeSubSettings(false);
};

// ✨ 2. 任天堂式視覺鎖定：動態禁用洗牌次數輸入框
window.toggleMinShuffleState = function (isChecked) {
    const wrapper = document.getElementById('wrapper-min-shuffle');
    const input = document.getElementById('setting-min-shuffle');
    if (!wrapper || !input) return;

    if (isChecked) {
        // 開啟：恢復色彩與互動
        wrapper.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = false;
    } else {
        // 關閉：半透明、灰階、禁止點擊
        wrapper.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = true;
    }
};

// ✨ 任天堂式視覺鎖定：切牌堆數
window.toggleCutState = function (isChecked) {
    const wrapper = document.getElementById('wrapper-cut-piles');
    const input = document.getElementById('setting-cut-piles');
    if (!wrapper || !input) return;
    if (isChecked) {
        wrapper.classList.remove('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = false;
    } else {
        wrapper.classList.add('opacity-40', 'grayscale', 'pointer-events-none');
        input.disabled = true;
    }
};

// 實際負責執行關閉動作的函數
window.forceCloseSubSettings = function (fromHistory = false) {
    const overlay = document.getElementById('sub-settings-overlay');
    if (!overlay) return;

    // 🌟 核心：先同步、無情地把視窗藏起來，斷絕 popstate 的後路
    overlay.classList.add('hidden');
    overlay.classList.remove('flex');

    // 清空記憶體快照
    currentActiveSubModal = null;
    currentSubSettingsSnapshot = null;

    // 如果是點擊按鈕關閉的，才幫忙消耗一頁歷史紀錄；如果是手機返回鍵觸發的，就不用再 back 了
    if (!fromHistory) {
        history.back();
    }
};

// ✨ 全域強制清除選取虛線框功能
function hideSelectionBoundary() {
    const el = document.getElementById('selection-boundary');
    if (!el || el.style.display === 'none') return;

    const handleBoundaryFade = (e) => {
        if (e.propertyName === 'opacity') {
            el.style.display = 'none';
            el.removeEventListener('transitionend', handleBoundaryFade);
        }
    };

    el.addEventListener('transitionend', handleBoundaryFade);
    el.style.opacity = '0';
}

let ritualSessionToken = 0; // ✨ 儀式唯一憑證，用來秒殺殭屍機器人
// ✨ 儀式環境徹底洗淨器
function resetRitualEngineContext() {
    ritualSessionToken++; // 每次呼叫就換發新憑證，舊的非同步機器人瞬間被判定無效！
    isRitualActive = false;
    currentState = 'IDLE';
    selectedCard = null;
    drawnCount = 0;
    drawnCardsStack = [];
    hideSelectionBoundary();

    // 還原按鈕原廠設定
    const btnConfirm = document.getElementById('btn-confirm-draw');
    if (btnConfirm) {
        btnConfirm.innerText = '✨ 確定選取';
        btnConfirm.classList.remove('border-green-400', 'text-green-400', 'animate-bounce');
        btnConfirm.classList.add('border-yellow-300', 'text-yellow-300');
    }

    const boundaryEl = document.getElementById('selection-boundary');
    if (boundaryEl) {
        boundaryEl.style.opacity = '0';
        boundaryEl.style.display = 'none';
    }

    // ✨ 核心修復 1：物理世界清空後，強迫瀏覽器把畫布上的墨水擦得一乾二淨，徹底消滅閃爍！
    if (world && cards && cards.length > 0) {
        Composite.remove(world, cards);
    }
    if (typeof render !== 'undefined' && render.context) {
        render.context.clearRect(0, 0, render.canvas.width, render.canvas.height);
    }
    cards = [];
}

// ==========================================
// ✨ 終極防禦：防重疊跳轉與全黑畫面修正
// ==========================================
let isGlobalConfirmShowing = false; // 全域防護鎖，防止重疊彈窗

// 💯 安全返回首頁的萬用函數
function returnToHomeSafely() {
    sessionStorage.setItem('is_soft_reload', 'true');
    isRitualActive = false;
    window.location.replace(window.location.pathname);
}

function discardRitual() {
    showConfirm('目前的占卜尚未儲存，確定要放棄並返回首頁嗎？', () => {
        isRitualActive = false;
        // ⚡ 核心優化：不切換畫面，直接原地重新載入，完全杜絕閃爍
        window.location.href = window.location.origin + window.location.pathname;
    });
}

// 覆寫 navTo 函數
const originalNavTo = window.navTo;
window.navTo = function (screenId, pushToHistory = true) { // ✨ 補上原本的第二個參數

    // 1. 防護盾攔截邏輯 (維持你原本優良的設計)
    if ((currentState === 'SHUFFLING' || currentState === 'WASHING' || currentState === 'SELECTING' || currentState === 'FANNING' || currentState === 'GATHERED') && screenId === 'screen-home') {

        if (isGlobalConfirmShowing) return;
        isGlobalConfirmShowing = true;

        // ✨ 利用升級版的 showConfirm，完美處理確認與取消
        showConfirm('目前正在儀式中，確定要結束占卜回到首頁嗎？',
            () => { returnToHomeSafely(); }, // 點確認：安全回家 (鎖會在回家函數中解開)
            () => { isGlobalConfirmShowing = false; } // 點取消：解鎖，下次才能再跳出！
        );
        return;
    }

    // 2. ✨ 核心修復：直接呼叫原本已經寫好的強大 navTo 函數！
    // 不要自己重寫 classList 操作，否則 canvasLayer 會因為缺乏 .active 而永遠隱形！
    if (typeof originalNavTo === 'function') {
        originalNavTo(screenId, pushToHistory);
    }
};

// ==========================================
// ✨ 介面主題顏色控制 (全色系支援版)
// ==========================================

// 1. 使用者在調色盤選好顏色後觸發
async function setCustomThemeColor(colorHex) {
    await DB.set('app_theme_color', colorHex); // 存入色碼，例如 #8a2be2
    applyThemeColor(colorHex);                 // 立即套用
}

// 2. 開機或切換時套用顏色
async function applyThemeColor(colorHex = null) {
    if (!colorHex) {
        // 如果沒有傳入，從資料庫抓，預設為原本的神秘紫 #1e1b4b
        colorHex = await DB.get('app_theme_color', '#1e1b4b');
    }

    // 防呆機制：相容上一版存進去的文字 (purple, blue...)
    if (colorHex === 'purple') colorHex = '#1e1b4b';
    else if (colorHex === 'blue') colorHex = '#172554';
    else if (colorHex === 'emerald') colorHex = '#064e3b';
    else if (colorHex === 'rose') colorHex = '#4c0519';

    // 同步更新 HTML 裡的調色盤顏色，讓介面狀態保持一致
    const picker = document.getElementById('theme-color-picker');
    if (picker && colorHex.startsWith('#')) {
        picker.value = colorHex;
    }

    // ✨ 魔法漸層：左上固定深色底 #0f172a，右下過渡到你選的專屬色！
    document.body.style.background = `linear-gradient(135deg, #0f172a 0%, ${colorHex} 100%)`;
    document.body.style.backgroundAttachment = 'fixed'; // 確保滾動時背景不會破圖
}

// ==========================================
// ✨ 塔羅牌面主題控制 (連動資料夾路徑)
// ==========================================
async function initDeckThemeSelect() {
    const themeSelect = document.getElementById('setting-deck-theme');
    if (!themeSelect) return;

    // 1. 定義你擁有的牌面主題 (value 必須等於 assets 裡面的資料夾名稱！)
    const themes = [
        { value: 'cards', name: '經典偉特 (預設)' },
    ];

    // 2. 把選項塞進 HTML 的下拉選單裡
    themeSelect.innerHTML = themes.map(t =>
        `<option value="${t.value}">${t.name}</option>`
    ).join('');

    // 3. 讀取目前的設定，讓選單顯示正確的項目
    const currentTheme = await DB.get('deck_theme', 'cards');
    themeSelect.value = currentTheme;

    // 4. 當使用者切換選項時，立刻存入資料庫
    themeSelect.addEventListener('change', async (e) => {
        await DB.set('deck_theme', e.target.value);
        if (typeof showAlert === 'function') {
            showAlert('🃏 牌面主題已切換！下次抽牌將套用新牌面。');
        }
    });
}

// ============================================================================
// 🛡️ 系統返回鍵 (popstate) 終極攔截器 (交通警察)
// ============================================================================
window.addEventListener('popstate', (e) => {

    // 🥇 第一優先級：絕對鎖定狀態 (開牌動畫中)
    if (typeof isCardRevealing !== 'undefined' && isCardRevealing) {
        history.pushState({ screen: 'screen-ritual' }, '', '#screen-ritual');
        if (navigator.vibrate) navigator.vibrate(20);
        return;
    }

    // 🥈 第二優先級：解牌室的「牌義解說視窗」是不是正打開著？
    const meaningModal = document.getElementById('card-meaning-modal');
    if (meaningModal && !meaningModal.classList.contains('hidden')) {
        if (typeof closeCardMeaning === 'function') {
            closeCardMeaning();
        } else {
            meaningModal.classList.add('hidden');
            meaningModal.classList.remove('flex');
        }
        return;
    }

    // 設定頁的子視窗是不是打開著？
    const subSettingsOverlay = document.getElementById('sub-settings-overlay');
    if (subSettingsOverlay && !subSettingsOverlay.classList.contains('hidden')) {
        if (typeof closeSubSettings === 'function') {
            closeSubSettings(true); // 傳入 true 告訴它這是手機返回鍵觸發的
        }
        return;
    }

    // ✨攔截抽牌設定的 Modal
    const deckModal = document.getElementById('modal-deck');
    if (deckModal && !deckModal.classList.contains('hidden')) {
        deckModal.classList.add('hidden');
        deckModal.classList.remove('flex');
        return;
    }

    const spreadModal = document.getElementById('modal-spread');
    if (spreadModal && !spreadModal.classList.contains('hidden')) {
        spreadModal.classList.add('hidden');
        spreadModal.classList.remove('flex');
        return;
    }

    // 判斷百科全書的獨立牌義編輯視窗是不是打開著？
    const dictEditModal = document.getElementById('modal-dict-edit');
    if (dictEditModal && !dictEditModal.classList.contains('hidden')) {
        if (typeof closeDictEdit === 'function') {
            closeDictEdit(true); // 傳入 true 告訴視窗這是返回鍵觸發的，不需要重複執行 history.back()
        }
        return; // 斷流，留在百科全書畫面
    }

    // 🥉 第三優先級：儀式進行中的「中斷確認」
    if (typeof isRitualActive !== 'undefined' && isRitualActive) {
        // 🛑 核心修復：強制攔截！不讓底層第二個 popstate 監聽器執行畫面切換
        e.stopImmediatePropagation();

        // 🔍 動態找出玩家現在正在哪個畫面 (解牌室還是洗牌桌？)
        const activeScreen = document.querySelector('.screen.active');
        const currentScreenId = activeScreen ? activeScreen.id : 'screen-ritual';

        // 將正確的畫面重新推回歷史紀錄，確保不會退回上一步
        history.pushState({ screen: currentScreenId, sessionId: window.appSessionId }, '', `#${currentScreenId}`);

        // 跳出確認視窗
        showConfirm('目前的占卜尚未儲存，確定要中斷並放棄紀錄嗎？',
            () => {
                // 點確定：解除儀式防護罩，直接重新載入網頁回到首頁
                isRitualActive = false;
                window.location.href = window.location.origin + window.location.pathname;
            },
            () => {
                // 點取消(繼續)：什麼都不做，因為網址與畫面都已經被我們鎖在原處了
            }
        );
        return;
    }

    // 🌟 第三優先級：正常情況下的畫面切換 (防呆終極版！)
    // 嚴格確保 screenId 絕對不會是 undefined！只要沒有正常畫面，一律安全送回首頁！
    const screenId = (e.state && e.state.screen) ? e.state.screen : 'screen-home';

    if (typeof originalNavTo === 'function') {
        originalNavTo(screenId, false);
    } else if (typeof navTo === 'function') {
        navTo(screenId, false);
    }
});

// ============================================================================
// 🛑 強制中斷儀式，清理物理引擎與戰場
// ============================================================================
function abortRitualAndGoHome() {
    console.log('🛑 啟動強制中斷：清理物理引擎與狀態...');

    // 1. 解除全域鎖定與狀態，打斷所有正在進行的邏輯
    if (typeof isRitualActive !== 'undefined') isRitualActive = false;
    currentState = 'IDLE';
    selectedCard = null;
    drawnCount = 0;
    chaosVortexActive = false;

    // 2. 清除所有可能的計時器 (避免 setTimeout 在背景偷偷觸發)
    if (typeof shuffleIdleTimer !== 'undefined' && shuffleIdleTimer) {
        clearTimeout(shuffleIdleTimer);
    }

    // 3. ✨ 核心清理：清空物理世界 (不殺死引擎，只把東西丟掉)
    if (typeof world !== 'undefined' && typeof engine !== 'undefined') {
        // 移除所有剛體 (卡牌、牆壁)
        Matter.Composite.clear(world);
        // 清除引擎內部殘留的碰撞與受力紀錄
        Matter.Engine.clear(engine);
    }

    // 4. 清空所有的資料陣列
    cards = [];
    walls = [];
    spreadSlots = [];
    cutPiles = [];

    // 5. 隱藏與重置所有 UI 圖層
    const canvasLayer = document.getElementById('canvas-layer');
    if (canvasLayer) canvasLayer.classList.remove('active');

    const spreadLayer = document.getElementById('spread-layer');
    if (spreadLayer) {
        spreadLayer.innerHTML = '';
        spreadLayer.style.display = 'none';
        spreadLayer.style.opacity = '0';
        spreadLayer.className = ''; // 清除可能殘留的 radar-22 或 radar-78 class
    }

    const drawUi = document.getElementById('draw-ui');
    const ritualUi = document.getElementById('ritual-ui');
    if (drawUi) {
        drawUi.classList.add('hidden');
        drawUi.classList.remove('pointer-events-none');
    }
    if (ritualUi) {
        ritualUi.classList.add('hidden');
        ritualUi.classList.remove('pointer-events-none');
    }

    const cutModal = document.getElementById('cut-modal');
    if (cutModal) {
        cutModal.classList.add('hidden');
        cutModal.classList.remove('flex');
    }

    const globalBL = document.getElementById('global-breathing-light');
    if (globalBL) globalBL.classList.add('hidden');

    const overlay = document.getElementById('pre-shuffle-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.classList.remove('flex');
    }

    // 6. 清除系統的對話框與呼吸燈
    if (typeof BL !== 'undefined') BL.clear();

    // 7. 更新 Session Token，直接作廢正在背景跑的 AutoBot
    if (typeof ritualSessionToken !== 'undefined') {
        ritualSessionToken = Date.now().toString();
    }

    // 8. 安全導航回首頁
    if (typeof navTo === 'function') navTo('screen-home');
}

// ==========================================
// ✨ 局部設定還原系統 (精準打擊版)
// ==========================================
window.restoreSubSettings = function (category) {
    let confirmMsg = '';

    if (category === 'op') confirmMsg = '確定要將「操作設定」還原為預設值嗎？';
    if (category === 'theme') confirmMsg = '確定要將「主題與背景」還原為預設值嗎？';
    if (category === 'card') confirmMsg = '確定要清除「自訂牌背與牌面」設定嗎？\n(牌陣設定不會受影響)';

    showConfirm(confirmMsg, async () => {
        if (category === 'op') {
            await DB.set('select_mode', 'click');
            await DB.set('draw_style', 'full');
            await DB.set('stage_shuffle', true);
            await DB.set('min_shuffle_count', 3);
            await DB.set('stage_wash', true);
            await DB.set('stage_cut', true);
            await DB.set('haptic_enabled', true);
        }
        else if (category === 'theme') {
            await DB.set('app_theme_color', '#1e1b4b');
            await DB.set('deck_theme', 'cards');
            await DB.set('bg_img', null);
            await DB.set('desk_img', null);
            await DB.set('tarot_anim_splash', null);
            // 立即還原畫面顏色
            if (typeof applyThemeColor === 'function') applyThemeColor('#1e1b4b');
        }
        else if (category === 'card') {
            await DB.set('cardback', null);
            // 這裡可以依據未來需求，加入更多關於牌面外觀的還原邏輯
        }

        // 重新讀取資料庫，將剛才還原的設定同步渲染回 HTML 介面上
        if (typeof initSettingsUI === 'function') await initSettingsUI();
        if (typeof syncSystemCache === 'function') await syncSystemCache();

        showToast('✅ 設定已還原預設值！');
    });
};

// ============================================================================
// ✨ 系統級防護：攔截並升級 navTo，支援手機實體返回鍵 (Session ID 斷尾求生版)
// ============================================================================
if (!window.hasHistoryApiUpgraded) {
    window.appSessionId = Date.now(); // ✨ 1. 初始化世代 ID

    // 確保載入時，底層有一個合法的首頁紀錄
    if (!history.state) {
        history.replaceState({ screen: 'screen-home', sessionId: window.appSessionId }, '', '#screen-home');
    }

    const originalNavTo = window.navTo;

    // 覆寫 navTo
    window.navTo = function (targetId) {
        // 🌟 核心：如果目標是「回到首頁」，執行斷尾求生！
        if (targetId === 'screen-home') {
            window.isRitualActive = false; // 清除儀式狀態
            window.appSessionId = Date.now(); // ✨ 刷新世代 ID，宣告前面的紀錄全部過期！

            if (typeof originalNavTo === 'function') {
                originalNavTo(targetId);
            } else {
                document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
                const target = document.getElementById(targetId);
                if (target) target.classList.add('active');
            }

            // 使用 replaceState (覆寫當前指針)，而不是推入新紀錄
            history.replaceState({ screen: 'screen-home', sessionId: window.appSessionId }, '', `#${targetId}`);
            return;
        }

        // 其他畫面的正常跳轉邏輯
        if (typeof originalNavTo === 'function') {
            originalNavTo(targetId);
        } else {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(targetId);
            if (target) target.classList.add('active');
        }

        // 寫入紀錄時，一併綁定當前的 Session ID
        if (history.state === null || history.state.screen !== targetId) {
            history.pushState({ screen: targetId, sessionId: window.appSessionId }, '', `#${targetId}`);
        }
    };

    window.addEventListener('popstate', (e) => {
        // 1. 攔截設定子視窗 (Priority 1)
        const overlay = document.getElementById('sub-settings-overlay');
        if (overlay && !overlay.classList.contains('hidden')) {
            if (typeof closeSubSettings === 'function') closeSubSettings(true);
            return;
        }

        // 2. 攔截百科編輯與跳出視窗 (Priority 2)
        const dictEdit = document.getElementById('modal-dict-edit');
        if (dictEdit && !dictEdit.classList.contains('hidden')) {
            if (typeof closeDictEdit === 'function') closeDictEdit();
            return;
        }
        const meaningModal = document.getElementById('card-meaning-modal');
        if (meaningModal && !meaningModal.classList.contains('hidden')) {
            meaningModal.classList.add('hidden');
            meaningModal.classList.remove('flex');
            return;
        }

        // 2.5 攔截抽牌設定 Modal
        const deckModal = document.getElementById('modal-deck');
        if (deckModal && !deckModal.classList.contains('hidden')) {
            deckModal.classList.add('hidden'); deckModal.classList.remove('flex');
            return;
        }
        const spreadModal = document.getElementById('modal-spread');
        if (spreadModal && !spreadModal.classList.contains('hidden')) {
            spreadModal.classList.add('hidden'); spreadModal.classList.remove('flex');
            return;
        }

        // 🌟 3. 歷史紀錄過期攔截器 (斷尾求生核心) 🌟
        if (e.state && e.state.sessionId && e.state.sessionId !== window.appSessionId) {
            // 系統發現這是一筆「上一輪占卜」的舊紀錄
            history.back(); // 閉著眼睛繼續往後退！
            return; // 🛑 終止 UI 渲染，確保畫面停在首頁不閃爍！
        }

        // 4. 合法的正常畫面切換渲染
        if (e.state && e.state.screen) {
            document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
            const target = document.getElementById(e.state.screen);
            if (target) target.classList.add('active');
        }
    });

    window.hasHistoryApiUpgraded = true;
}

// 🎬 華麗開場動畫劇本 (大->小聚能，小->大綻放，尺寸優化版)
window.playSplashAnimation = function() {
    const splashScreen = document.getElementById('screen-splash');
    const mandala = document.getElementById('mandala-container');
    if (!splashScreen) return;

    // ⏱️ 時間軸設定
    const DRAW_SPEED = 30;          // 每畫一個殘影的速度 (毫秒)
    const PHASE_1_FRAMES = 35;      // 階段一：往內縮聚能的數量
    const PHASE_2_FRAMES = 20;      // 階段二：往外綻放的數量
    const TOTAL_FRAMES = PHASE_1_FRAMES + PHASE_2_FRAMES; 
    
    const CRYSTAL_VIEW_TIME = 2000; // 布簾拉開後觀賞時間

    if (mandala) {
        mandala.innerHTML = ''; 
        let currentFrame = 0;

        const drawInterval = setInterval(() => {
            if (currentFrame >= TOTAL_FRAMES) {
                clearInterval(drawInterval);
                setTimeout(() => {
                    mandala.style.opacity = '0';
                    splashScreen.classList.add('curtain-open');
                }, 300);
                return;
            }

            const square = document.createElement('div');
            let scale, rotate, opacity;

            // 🌀 動畫邏輯運算 (尺寸微調)
            if (currentFrame < PHASE_1_FRAMES) {
                // 【階段一：聚能】 從 1.4 倍縮小到 0.2 倍 (不會超出螢幕了)
                scale = 1.4 - (currentFrame / PHASE_1_FRAMES) * 1.2; 
                rotate = currentFrame * 15;
                opacity = 1;
            } else {
                // 【階段二：綻放】 從 0.2 倍放大到 2.0 倍 (剛剛好填滿螢幕)
                let exFrame = currentFrame - PHASE_1_FRAMES;
                scale = 0.2 + (exFrame / PHASE_2_FRAMES) * 1.8; 
                rotate = (PHASE_1_FRAMES * 15) - (exFrame * 20); 
                opacity = 1 - (exFrame / PHASE_2_FRAMES); 
            }
            
            // ✨ 設定方形初始外觀 (將原本的 w-56 h-56 縮小為 w-40 h-40)
            square.className = 'absolute w-40 h-40 border border-yellow-300/50 transition-all ease-out';
            square.style.transitionDuration = currentFrame < PHASE_1_FRAMES ? '800ms' : '400ms';
            square.style.transform = `scale(1.4) rotate(0deg)`; // 初始比例對齊聚能第一幀
            square.style.boxShadow = '0 0 15px rgba(253, 224, 71, 0.2)'; 
            square.style.opacity = '0'; 

            mandala.appendChild(square);

            requestAnimationFrame(() => {
                square.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
                square.style.opacity = opacity;
            });

            currentFrame++;
        }, DRAW_SPEED);
    } else {
        splashScreen.classList.add('curtain-open');
    }

    // 🔮 最終幕退場
    const totalTime = (TOTAL_FRAMES * DRAW_SPEED) + 300 + CRYSTAL_VIEW_TIME;
    setTimeout(() => {
        splashScreen.style.opacity = '0';
        splashScreen.style.pointerEvents = 'none'; 
        
        setTimeout(() => {
            splashScreen.classList.remove('active');
            splashScreen.classList.add('hidden');
            if (typeof navTo === 'function') navTo('screen-home', false);
        }, 1000); 
    }, totalTime); 
};
