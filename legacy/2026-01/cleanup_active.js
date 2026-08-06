const fs = require('fs');
const { exec } = require('child_process');

// 1. Load CURRENT data (make sure to update this file first)
try {
    const rawData = fs.readFileSync('earthlocations_current.json');
    const data = JSON.parse(rawData);
    const entries = Object.entries(data);

    // 2. Identify nodes to delete
    // Goal: Remove Taipei nodes, or Deduplicate IDs

    // Define Taipei Bounds (Roughly)
    // North: 25.2, South: 24.9, West: 121.4, East: 121.7
    const TAIPEI_BOUNDS = {
        n: 25.2, s: 24.9, w: 121.4, e: 121.7
    };

    const isInsideTaipei = (lat, lon) => {
        return lat <= TAIPEI_BOUNDS.n && lat >= TAIPEI_BOUNDS.s &&
            lon >= TAIPEI_BOUNDS.w && lon <= TAIPEI_BOUNDS.e;
    };

    const nodesToDelete = new Set();
    const seenIDs = new Map(); // ID -> Key (to keep the latest one)

    // Sort by timestamp (DESC) so we process newest first
    entries.sort((a, b) => (b[1].timeStamp || 0) - (a[1].timeStamp || 0));

    entries.forEach(([key, val]) => {
        // Only care about "active" (leave: false) nodes?
        // User asked "why are they still online?" -> likely disconnected badly.
        // User asked to "delete Taipei nodes" OR "keep only one per ID".

        if (val.leave !== false) return; // Only process currently "online" nodes for this specific request

        // Check 1: Duplicate ID
        // Since we sorted by newest, the first time we see an ID, it's the latest. Keep it.
        // Subsequent times -> Delete.
        if (val.showId) {
            if (seenIDs.has(val.showId)) {
                nodesToDelete.add(key); // Duplicate found, delete older one
                console.log(`Marking duplicate ID for deletion: ${val.showId} (${key}) - Keeping ${seenIDs.get(val.showId)}`);
                return;
            } else {
                seenIDs.set(val.showId, key);
            }
        }

        // Check 2: Location (Taipei)
        // User asked to "help delete Taipei ones". 
        // If it's in Taipei, should we delete it even if it's the only one?
        // User said: "Can you help me delete the Taipei ones?"
        // Let's assume YES, delete all active nodes in Taipei (except maybe my own recent testing one? No, delete all).

        if (val.lat && val.lon && isInsideTaipei(val.lat, val.lon)) {
            nodesToDelete.add(key);
            console.log(`Marking Taipei node for deletion: ${val.showId} at ${val.lat},${val.lon}`);
            // If we delete it, remove from seenIDs so if there's another one outside Taipei we keep that?
            // Actually if we delete the newest one because it's in Taipei, do we want to keep an older one?
            // Probably not. 
        }
    });

    const keysToDelete = Array.from(nodesToDelete);
    console.log(`\nFound ${keysToDelete.length} active nodes to delete.`);

    if (keysToDelete.length === 0) {
        console.log("Nothing to delete.");
        process.exit(0);
    }

    // 3. Execution (Batch)
    const BATCH_SIZE = 5;
    const runBatch = async () => {
        for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
            const batch = keysToDelete.slice(i, i + BATCH_SIZE);
            const promises = batch.map(key => {
                return new Promise((resolve) => {
                    const path = `/earthlocations/${key}`;
                    const command = `npx firebase database:remove ${path} --project song-of-distance-47ab8 -f`;
                    exec(command, (error) => {
                        process.stdout.write(error ? 'x' : '.');
                        resolve();
                    });
                });
            });
            await Promise.all(promises);
        }
        console.log("\nAll done.");
    };

    runBatch();

} catch (e) {
    console.error(e);
}
