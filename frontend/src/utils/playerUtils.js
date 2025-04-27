// Helper to get nickname from ID
export const getNickname = (playerId, players) => {
    // console.log(`[getNickname] Searching for ${playerId} in players:`, players); // Keep console log commented out for now
    if (!players || !playerId) {
        return 'Unknown';
    }
    const player = players.find(p => p.id === playerId);
    // console.log(`[getNickname] Found player:`, player);
    return player ? player.nickname : 'Unknown';
};

// Add other player-related utility functions here in the future if needed 