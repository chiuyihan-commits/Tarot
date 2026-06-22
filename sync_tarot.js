import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { firebaseConfig as defaultConfig } from "./krane_tarot_privatekey.js";

// ==========================================
// 🌌 系統初始化 (支援動態替換 API Key)
// ==========================================
let app;
let db;
let userDocRef;
window.AppState = window.AppState || { localLastSync: 0 };

// 動態初始化 Firebase 引擎
async function initFirebaseSystem() {
    // 1. 從本地資料庫讀取你在「備份中心」輸入的自訂 API Key
    const customApiKey = await localforage.getItem('tarot_firebase_api_key');

    // 2. 決定設定檔 (如果有輸入自訂 Key，就覆蓋預設檔)
    let configToUse = { ...defaultConfig };
    if (customApiKey && customApiKey.trim() !== '') {
        configToUse.apiKey = customApiKey.trim();
        console.log("🔗 使用自訂 Firebase API Key 連線");
    } else {
        console.log("🔗 使用系統內建預設 API Key 連線");
    }

    // 3. 啟動 Firebase
    if (!app) {
        app = initializeApp(configToUse);
        db = getFirestore(app);
        // ⚠️ 若未來要開放給大眾，此處的 "main_profile" 需改為使用者的 uid
        userDocRef = doc(db, "tarot_sync", "main_profile");
    }
}

// ==========================================
// ☁️ 核心上傳與下載邏輯
// ==========================================

// 一鍵上傳所有資料 (包含 Webhook 雙向拋送)
window.uploadEverything = async (allData) => {
    await initFirebaseSystem();

    try {
        // 1. 上傳至 Firebase
        await setDoc(userDocRef, {
            ...allData,
            lastSync: serverTimestamp()
        });
        AppState.localLastSync = new Date().getTime();
        if (typeof showToast === 'function') showToast("🌌 塔羅能量已成功同步至雲端！");

        // 2. 🚀 Webhook 自動拋送 (如果備份中心有設定的話)
        const webhookUrl = await localforage.getItem('tarot_webhook_url');
        if (webhookUrl && webhookUrl.trim() !== '') {
            fetch(webhookUrl.trim(), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source: 'Pocket_Tarot', timestamp: new Date().toISOString(), data: allData })
            }).then(() => {
                console.log("🚀 Webhook 資料拋接成功！");
            }).catch(e => console.error("Webhook 發送失敗", e));
        }

    } catch (e) {
        console.error("同步失敗", e);
        if (typeof showToast === 'function') showToast("❌ 同步失敗：" + e.message);
    }
};

// 雲端全機還原
window.restoreSystemFromCloud = async function () {
    await initFirebaseSystem();

    //let isOk = await new Promise((resolve) => {
    //    showConfirm("⚠️ 注意：這將使用雲端資料【完全覆蓋】目前手機上的所有紀錄與自訂牌義！\n\n確定要執行嗎？",
    //        () => resolve(true),
    //        () => resolve(false)
    //    );
    //});
    const isOk = window.confirm("⚠️ 極度危險！這將使用雲端資料【完全覆蓋】目前手機上的所有紀錄與自訂牌義！\n\n確定要執行嗎？");
    if (!isOk) return null;

    if (typeof showToast === 'function') showToast("⏳ 正在從阿卡西雲端下載資料...");

    try {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
            let data = docSnap.data();

            AppState.localLastSync = data.lastSync && typeof data.lastSync.toMillis === 'function'
                ? data.lastSync.toMillis()
                : new Date().getTime();

            // 執行還原：將雲端資料寫回 localforage
            await localforage.clear();
            for (let key in data) {
                if (key !== 'lastSync') {
                    await localforage.setItem(key, data[key]);
                }
            }

            showConfirm("✅ 雲端還原完畢！為了套用全新設定，系統即將重新啟動。", () => {
                window.location.reload();
            });
            return data;
        } else {
            showToast("❌ 雲端找不到備份紀錄。");
            return null;
        }
    } catch (e) {
        console.error("還原失敗", e);
        showToast("❌ 連線失敗，請檢查 API 授權或網路連線。");
        return null;
    }
};

// ==========================================
// 🖱️ UI 按鈕觸發器 (綁定在 Window 上讓 HTML 呼叫)
// ==========================================

window.syncToCloud = async function () {
    try {
        const keys = await localforage.keys();
        const payload = {};
        for (let key of keys) {
            // 只抓取塔羅系統本身的資料，避免抓到垃圾檔
            if (key.startsWith('tarot_')) {
                payload[key] = await localforage.getItem(key);
            }
        }
        await window.uploadEverything(payload);
    } catch (e) {
        console.error("讀取本地資料失敗：", e);
    }
};

window.handleCloudBackup = async function () {
    if (typeof BL !== 'undefined') BL.show('draw_place', '正在上傳祭壇能量...');
    await window.syncToCloud();
    if (typeof BL !== 'undefined') BL.clear();
};

window.handleCloudRestore = async function () {
    await window.restoreSystemFromCloud();
};

// ============================================================================
// 💾 備份與串接中心邏輯 (API 儲存 + 本機 ZIP 完整打包與還原)
// ============================================================================

// 1. 儲存 API 金鑰
window.saveApiKeys = async function () {
    const fbKey = document.getElementById('setting-firebase-key').value.trim();
    const webhook = document.getElementById('setting-webhook-url').value.trim();

    await DB.set('firebase_api_key', fbKey);
    await DB.set('webhook_url', webhook);

    if (typeof showToast === 'function') showToast('🔗 API 串接設定已成功儲存！');
};

// 2. 初始化 API 欄位 (在設定頁載入時呼叫)
window.loadApiKeysToUI = async function () {
    const fbKey = await DB.get('firebase_api_key', '');
    const webhook = await DB.get('webhook_url', '');

    const fbInput = document.getElementById('setting-firebase-key');
    const whInput = document.getElementById('setting-webhook-url');

    if (fbInput) fbInput.value = fbKey;
    if (whInput) whInput.value = webhook;

    // ✨ 新增：判斷金鑰狀態並更新 UI 標籤
    const statusBadge = document.getElementById('api-status-badge');
    if (statusBadge) {
        if (fbKey && fbKey.trim() !== '') {
            statusBadge.innerText = '🟢 已套用自訂金鑰';
            statusBadge.className = 'px-1.5 py-0.5 rounded bg-green-600 text-[0.6rem] text-white';
        } else if (defaultConfig && defaultConfig.apiKey) {
            statusBadge.innerText = '🔵 使用內建金鑰';
            statusBadge.className = 'px-1.5 py-0.5 rounded bg-blue-600 text-[0.6rem] text-white shadow-[0_0_8px_rgba(59,130,246,0.5)]';
        } else {
            statusBadge.innerText = '🔴 無可用金鑰';
            statusBadge.className = 'px-1.5 py-0.5 rounded bg-red-600 text-[0.6rem] text-white';
        }
    }
};

// 🚨 覆寫/擴充你原本的 initSettingsUI，讓它開啟時順便載入 API 金鑰
const originalInitSettingsUI = window.initSettingsUI;
window.initSettingsUI = async function () {
    if (typeof originalInitSettingsUI === 'function') await originalInitSettingsUI();
    await loadApiKeysToUI();
};

// 3. 📦 匯出 ZIP：掃描整個資料庫，轉 JSON 後壓縮
window.exportLocalZip = async function () {
    if (typeof JSZip === 'undefined') {
        if (typeof showToast === 'function') showToast('❌ 系統尚未載入 ZIP 模組，請檢查網路');
        return;
    }

    if (typeof showToast === 'function') showToast('📦 正在打包所有資料，請稍候...');

    try {
        const zip = new JSZip();
        const dbData = {};

        // 走訪 localforage 裡面的所有 key-value，包含 Base64 圖片
        await localforage.iterate((value, key) => {
            dbData[key] = value;
        });

        // 將整個資料庫轉為 JSON 字串
        const jsonString = JSON.stringify(dbData);

        // 把 JSON 塞進 ZIP 裡面 (使用 DEFLATE 壓縮以大幅縮小圖片體積)
        zip.file("TarotAltar_FullBackup.json", jsonString);

        // 產生檔案並觸發下載
        const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });

        const a = document.createElement('a');
        a.href = URL.createObjectURL(content);
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `TarotAltar_Backup_${dateStr}.zip`;
        a.click();
        URL.revokeObjectURL(a.href);

        if (typeof showToast === 'function') showToast('✅ 備份檔 (.zip) 已成功下載！');
    } catch (err) {
        console.error("ZIP 匯出失敗:", err);
        if (typeof showToast === 'function') showToast('❌ 打包失敗，請檢查主控台');
    }
};

// 4. 📤 匯入 ZIP：解壓縮並強行覆蓋整個資料庫
window.importLocalZip = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    if (typeof JSZip === 'undefined') {
        if (typeof showToast === 'function') showToast('❌ 系統尚未載入 ZIP 模組，請檢查網路');
        event.target.value = '';
        return;
    }

    if (typeof showConfirm === 'function') {
        showConfirm('⚠️ 極度危險操作！匯入將會「完全清除並覆蓋」您目前的所有設定、牌陣、筆記與圖片！確定要還原嗎？', async () => {

            if (typeof showToast === 'function') showToast('⏳ 正在解壓縮並還原資料...');

            try {
                const zip = new JSZip();
                const loadedZip = await zip.loadAsync(file);

                // 尋找我們專屬的 JSON 備份檔
                const jsonFile = loadedZip.file("TarotAltar_FullBackup.json");
                if (!jsonFile) {
                    if (typeof showToast === 'function') showToast('❌ 檔案格式錯誤：這不是塔羅祭壇的有效備份檔');
                    event.target.value = '';
                    return;
                }

                const jsonString = await jsonFile.async("string");
                const dbData = JSON.parse(jsonString);

                // 💣 震撼彈：清除當前所有資料
                await localforage.clear();

                // ✍️ 依序寫入備份檔中的所有資料
                for (const key in dbData) {
                    await localforage.setItem(key, dbData[key]);
                }

                if (typeof showConfirm === 'function') {
                    showConfirm('🎉 備份資料已成功還原！為了套用完整設定，系統將立即重新啟動。', () => {
                        location.reload();
                    });
                } else {
                    location.reload();
                }
            } catch (err) {
                console.error("ZIP 匯入失敗:", err);
                if (typeof showToast === 'function') showToast('❌ 還原失敗：檔案可能損毀');
            }
            event.target.value = ''; // 清空 input 讓下次還能選同一個檔案
        }, () => {
            // 取消時，清空 input
            event.target.value = '';
        });
    }
};
