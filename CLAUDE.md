# CLAUDE.md：《距離之歌》Song of Distances

這棵樹的本地規則。全域規則（身分、語言、五條鐵律）由 user memory 載入，不在這裡重述。

## 磁碟上只有這幾個位置

2026-08-06 晚間分家：這條 2026 線已經獨立成自己的 GitHub repo 與自己的本機
clone，跟舊 repo 不再共用 `.git`。

| 位置 | 是什麼 | 對應的 GitHub repo |
|---|---|---|
| `~/Documents/GitHub/song-of-distance-2026` | **本檔所在**，2026 改版線，獨立 clone，branch `main` | `ZONESOUND/song-of-distances-2026` |
| `~/Documents/GitHub/song-of-distances` | 舊線，仍是含 worktree 的主 repo | `ZONESOUND/song-of-distance`（`origin`）與 `song-of-distances`（`distances`）|
| `~/Documents/song-of-distance-local/` | 不進 git 的本機資料（備份、截圖、憑證）| 無 |

**兩邊現在是完全獨立的 git 資料庫。** 分家前它們是同一個 repo 的兩個
worktree，共用同一份 index，兩個 agent session 同時工作會互相污染
（2026-08-06 實際發生過）。現在不會了，但也代表**改動不會自動同步**，要靠
remote 交換。

`~/Documents/GitHub/song-of-distances` 是當天稍早從 `song-of-distance` 改名
來的；任何寫著舊路徑的設定（例如 `.claude/launch.json`）都要跟著改。

2026-08-06 之前還有 `~/Documents/Workings/距離之歌/`（2026-01 的舊 clone，
791M），獨有檔案已救出、其餘與新 repo 重複，已刪除。**不要再從別處複製出
多餘的工作副本。** 來歷與比對證據見 `docs/project-layout.md`。

## 發佈是關著的，而且是故意的

`.github/workflows/pages.yml` 是 `on: push: branches: [main]`，而且
`configure-pages` 帶 `enablement: true`：**推上 `main` 就會自動開啟 Pages 並把
作品發佈到 `zonesound.github.io/song-of-distances-2026`。**

2026-08-06 建立這個 repo 時，第一次推送觸發的那個 run 已被手動取消，Pages
目前仍是未啟用狀態（`gh api repos/ZONESOUND/song-of-distances-2026/pages`
回 404）。在聲音經過實際試聽驗證之前，不要讓它跑完。

## Firebase

- **正式站 `song-of-distance-47ab8` 一律封鎖。** `src/runtimeConfig.js` 的 `assertFirebaseAccessIsSafe()` 會在啟動時擋下，不要為了方便繞過它。
- **目前有兩個 staging 專案，動手前先確認你在哪個分支。** 這個分支（`claude/vite-sound-2026`）用 `.env.local` 指向 `song-of-distance-testing`（Firebase 顯示名稱 `song-of-distance-2026`）；`codex/firebase-staging` 分支用 `.firebaserc` 指向 `song-of-distances-staging-2026`。兩者都存在且 ACTIVE，尚未決定要不要併成一個。
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
