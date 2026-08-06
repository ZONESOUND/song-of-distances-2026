# 檔案位置與 2026-08-06 的整併

寫這份是因為這個專案曾經同時存在五個磁碟位置，隔一段時間回來就分不清哪個是正本。速查版在 repo 根的 `CLAUDE.md`，這裡是完整來歷與當時的比對證據。

## 現在的位置

| 位置 | 內容 | 進 git 嗎 |
|---|---|---|
| `~/Documents/GitHub/song-of-distance` | 主 worktree | 是 |
| `~/Documents/GitHub/song-of-distance-2026` | git worktree，2026 改版線 | 是 |
| `~/Documents/song-of-distance-local/backups/` | 兩份 `earthlocations` 快照 | **否，且不可以** |
| `~/Documents/song-of-distance-local/previews/` | 2026-07-31 至 08-01 的除錯截圖 11 張 | 否 |
| `~/Documents/song-of-distance-local/secrets/` | 正式站 `song-of-distance-47ab8` 的 client config | **否，且不可以** |

備份 JSON 是參與者的 GPS 軌跡。repo 是公開的，這類資料不進版控。

兩份備份的差別：

- `firebase_backup_2026-01-25.json`：1920 筆
- `earthlocations-before-zombie-delete-20260731T095410Z.json`：1934 筆，是 2026-07-31 清除殭屍 active 點之前的快照

## 2026-08-06 刪掉了什麼，依據是什麼

刪除對象：`~/Documents/Workings/距離之歌/`，791M（其中 782M 是 `node_modules`）。裡面是一個 2026-01 的 clone，外層 branch `master`，內層巢狀 clone branch `v2-evolution`，有 11 個檔案未提交。

刪之前確認過：

1. 外層 clone 的 `origin/master..HEAD` 是空的，沒有任何未推送的 commit。
2. 巢狀 clone 未提交的 `src/App.js`、`ControlPanel.js`、`sketch.js`、`sound.js`、`firebase.js` 逐一 shasum，跟新 repo 五個分支沒有任何一個相符；但新 repo 是後代且為超集，多了 `src/data/`、`runtimeConfig`、`sessionPresence`、`soundRules`、`oscProtocol` 與整套測試。舊版本本身沒有救援價值。
3. `src/sound/` 六個音檔逐一 shasum，與新 repo **byte-identical**。二進位、不可再生，所以刪前逐檔驗過。
4. 只存在於該處的檔案先搬走（見下）。

## 搬去哪了

| 原本 | 現在 |
|---|---|
| `song-of-distance/src/AdminPanel.js`、`.css` | `legacy/2026-01/`（進 git）|
| `song-of-distance/analyze_cleanup.js`、`cleanup_active.js` | `legacy/2026-01/`（進 git）|
| `song-of-distance/firebase_backup_2026-01-25.json` | `~/Documents/song-of-distance-local/backups/` |
| `song-of-distance/src/config.js` | `~/Documents/song-of-distance-local/secrets/config.js.song-of-distance-47ab8` |
| `~/Documents/song-of-distance-backups/`（散在 Documents 根層）| `~/Documents/song-of-distance-local/backups/` |
| `~/Documents/song-of-distance-previews/`（散在 Documents 根層）| `~/Documents/song-of-distance-local/previews/` |

`legacy/2026-01/` 的四個檔案從未被任何分支提交過，放進 git 是為了確保不再弄丟。它們是 2026-01 的 CRA 版程式碼，不參與現在的 Vite build，也不要拿來當現行程式的參考。`cleanup_active.js` 是當時清除殭屍 active 點的一次性腳本：那個問題的根因已於 2026-08-06 修掉（見 `CLAUDE.md` 的 presence 段），這支腳本現在只有考古價值。

## 兩個分支、兩個 staging 專案

這是 2026-08-06 整理時才發現的重複，還沒收斂。

| 分支 | worktree | 設定來源 | 指向的 Firebase 專案 |
|---|---|---|---|
| `codex/firebase-staging` | `song-of-distance` | `.firebaserc` | `song-of-distances-staging-2026` |
| `claude/vite-sound-2026` | `song-of-distance-2026` | `.env.local` | `song-of-distance-testing`（顯示名稱 `song-of-distance-2026`）|

兩個專案都存在且 ACTIVE。專案 ID 只差一個複數 s 加後綴，很容易搞混，動手前先確認自己在哪個分支。安全規則也各有一份（前者在根目錄 `database.rules.json`，後者在 `firebase/database.rules.json`），內容相近但不完全相同：前者的 `earthlocations` 需要登入才能讀，並額外驗證 `key` 欄位。**併成一個 staging 專案的事尚未決定。**

## 測試站資料庫的待決事項

`song-of-distance-testing` 的資料庫 root 底下有 2259 筆舊軌跡，但它們不在 `earthlocations` 節點底下，而是直接掛在根層，看起來是匯入備份時匯錯層級。後果是前端讀不到（而且安全規則的根層 `.read` 是 `false`，前端本來也讀不到）。要讓舊軌跡在測試站顯示，需要把它們搬到 `/earthlocations` 底下。**尚未決定要不要搬。**
