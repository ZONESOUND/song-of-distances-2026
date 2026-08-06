# CLAUDE.md：《距離之歌》Song of Distances

這棵樹的本地規則。全域規則（身分、語言、五條鐵律）由 user memory 載入，不在這裡重述。

## 磁碟上只有這幾個位置

| 位置 | 是什麼 |
|---|---|
| `~/Documents/GitHub/song-of-distance` | 主 worktree |
| `~/Documents/GitHub/song-of-distance-2026` | git worktree，2026 改版線 |
| `~/Documents/song-of-distance-local/` | 不進 git 的本機資料（備份、截圖、憑證）|

2026-08-06 之前還有 `~/Documents/Workings/距離之歌/`（2026-01 的舊 clone，791M），獨有檔案已救出、其餘與新 repo 重複，已刪除。**不要再從別處複製出第四份工作副本。** 來歷與比對證據見 `docs/project-layout.md`。

## Firebase

- **正式站 `song-of-distance-47ab8` 一律封鎖。** `src/runtimeConfig.js` 的 `assertFirebaseAccessIsSafe()` 會在啟動時擋下，不要為了方便繞過它。
- 測試站是 `song-of-distance-testing`（Firebase 專案顯示名稱 `song-of-distance-2026`），設定寫在未進版控的 `.env.local`。
- 安全規則正本是 `firebase/database.rules.json`，用 `firebase deploy --only database` 部署。改完要讀回 `/.settings/rules` 比對，不要只看指令有沒有報錯。
- 資料庫是 Realtime Database（不是 Firestore），節點 `earthlocations`。

## presence：不要再製造卡死的 active 點

三道防線，任何一道都不能拿掉：

1. 15 秒心跳更新 `lastSeen`
2. `onDisconnect()` 伺服器端 fallback
3. `sessionPresence.js` 的 60 秒 `lastSeen` 視窗，由 `ControlPanel` 每 5 秒重算

**節點一定要先建立、才註冊 `onDisconnect`。** 安全規則要求 `newData.child('uid') === auth.uid`，對還不存在的節點註冊會被 `PERMISSION_DENIED` 擋掉，斷線 fallback 就等於不存在，瀏覽器一關那個點會永遠留在雷達上。這個順序有回歸測試鎖著（`src/data/firebaseSessionStore.test.js`），不要改回去。

## 不進 git 的東西

- `.env.local`：測試站設定
- `~/Documents/song-of-distance-local/backups/`：參與者 GPS 軌跡備份。**這是公開 repo，這類資料不可以 commit。**
- `~/Documents/song-of-distance-local/secrets/`：正式站憑證
