const fs = require('fs');

try {
    const rawData = fs.readFileSync('earthlocations_backup.json');
    const data = JSON.parse(rawData);
    const entries = Object.entries(data);

    const now = Date.now();
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

    // 1. Identify "Old Active" nodes (Ghost sessions)
    // Condition: leave: false AND timeStamp < 1 year ago
    const oldActiveKeys = [];
    entries.forEach(([key, val]) => {
        if (val.leave === false && (now - (val.timeStamp || 0) > ONE_YEAR_MS)) {
            oldActiveKeys.push(key);
        }
    });

    console.log(`\n--- Analysis 1: Old Active Nodes (> 1 year) ---`);
    console.log(`Found ${oldActiveKeys.length} nodes that are marked 'online' but haven't updated in a year.`);

    // 2. Identify "Dense / Test" nodes
    // Logic: 
    // - Group by proximity (Clusters)
    // - Within a cluster, categorize into [Custom Name] vs [Default Name]
    // - Default Name regex: /^A\d+$/ (e.g., A123, A999) - based on ControlPanel.js getShowId logic
    // - Recommendation: Keep Custom Names. Delete Default Names if they are cluttering.

    // Helper to check for default name
    const isDefaultName = (name) => {
        if (!name) return true; // No name is treated as default/test
        return /^A\d+$/.test(name);
    }

    // Simple clustering: O(N^2) but N=3000 is fine (~9M ops, quick in Node)
    // Or we can just iterate and mark for deletion.
    // Let's use a "visited" set to avoid double counting, but we want to process all.

    const nodesToDeleteForDensity = new Set();
    const CLUSTER_THRESHOLD = 0.0005; // very close, ~50m

    // Sort entries by time (newest first) to prioritize keeping newer ones if we have to choose
    entries.sort((a, b) => (b[1].timeStamp || 0) - (a[1].timeStamp || 0));

    // We will iterate and find neighbors for each node.
    // If a node is a "Default Name" node, and it has neighbors that are "Custom Name" OR it has many "Default Name" neighbors (tests), we might want to delete it.

    // Let's refine the User's rule: "Keep only those with changed ID names" in dense areas.
    // "Sparse" default nodes might be fine? Or user implies all default nodes are tests? 
    // "Mainly removing those added for testing" implies we should be aggressive with Default Names in clusters.

    const keptNodes = []; // Just for stats

    // To do this efficiently and correctly:
    // For each node:
    //   If it has a Custom Name -> KEEP.
    //   If it has a Default Name:
    //      Check neighbors (within threshold).
    //      If neighbors exist:
    //          Mark for DELETION (because it's cluttering/overlapping).
    //      If it is ISOLATED (no neighbors):
    //          KEEP? Or delete? User said "Dense points... keep changed ID". 
    //          Implies isolated default points might be okay, or maybe delete all defaults? 
    //          Let's assume "Dense" is the trigger.

    // But wait, if I have 10 Default Names in a pile, and 0 Custom Names. 
    // User said "Basically delete additions for testing". 
    // Maybe we delete ALL Default Names in dense clusters?

    // Let's build a spatial index or just brute force since N is small.

    const processedKeys = new Set();

    entries.forEach(([key, val], i) => {
        if (processedKeys.has(key)) return;

        const hasCustomName = !isDefaultName(val.showId);

        // Find neighbors
        const neighbors = entries.filter(([nKey, nVal], j) => {
            if (i === j) return false; // self
            if (!val.lat || !val.lon || !nVal.lat || !nVal.lon) return false;
            return Math.abs(val.lat - nVal.lat) < CLUSTER_THRESHOLD &&
                Math.abs(val.lon - nVal.lon) < CLUSTER_THRESHOLD;
        });

        if (neighbors.length > 0) {
            // It is in a dense area
            if (hasCustomName) {
                // Keep custom name nodes
                keptNodes.push(key);
            } else {
                // It is a Default Name node in a dense area -> DELETE
                nodesToDeleteForDensity.add(key);
            }
        } else {
            // Isolated node. 
            // If it's a default name, do we keep it? 
            // User said "Then for overly dense points, help me keep 'changed ID names' only".
            // This implies density is the condition.
            // So isolated default nodes are kept.
            keptNodes.push(key);
        }
    });

    // Intersection check: Ensure we don't try to delete the same key twice if logic overlaps (sets handle this)
    // Also merge OldActiveKeys into the set to get a total count
    oldActiveKeys.forEach(k => nodesToDeleteForDensity.add(k));

    console.log(`\n--- Analysis 2: Density Cleanup ---`);
    console.log(`Found ${nodesToDeleteForDensity.size} total unique nodes proposed for deletion.`);
    console.log(`(Includes ${oldActiveKeys.length} old ghost nodes + dense default-name nodes)`);

    // Preview some deletions
    const keys = Array.from(nodesToDeleteForDensity);
    console.log(`\nExample nodes to delete:`);
    keys.slice(0, 5).forEach(k => {
        const item = data[k];
        console.log(` - ID: ${item.showId || 'N/A'}, Time: ${new Date(item.timeStamp).toISOString()}, Leave: ${item.leave}`);
    });

} catch (e) {
    console.error(e);
}
