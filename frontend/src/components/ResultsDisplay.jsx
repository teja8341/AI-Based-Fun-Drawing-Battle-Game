import React from 'react';
import './ResultsDisplay.css';

// Helper to get nickname from ID (assuming players array is passed or available)
const getNickname = (playerId, players) => {
    console.log(`[getNickname] Searching for ${playerId} in players:`, players);
    const player = players.find(p => p.id === playerId);
    console.log(`[getNickname] Found player:`, player);
    return player ? player.nickname : 'Unknown Player';
};

const ResultsDisplay = ({ drawings, players, winnerId }) => {
  console.log('[ResultsDisplay] Rendering with winnerId:', winnerId);
  console.log('[ResultsDisplay] Players prop:', players);

  if (!drawings || Object.keys(drawings).length === 0) {
    return <div className="results-container"><p>No drawings submitted yet.</p></div>;
  }

  const winnerNickname = winnerId ? getNickname(winnerId, players) : null;
  console.log('[ResultsDisplay] Determined winnerNickname:', winnerNickname);

  return (
    <div className="results-container">
      <h2>Round Results</h2>
      {winnerNickname ? (
          <p className="winner-announcement">🏆 Winner: {winnerNickname}! 🏆</p>
      ) : (
          <p className="winner-announcement">No clear winner this round!</p>
      )}
      <div className="drawings-grid">
        {Object.entries(drawings).map(([playerId, drawingDataUrl]) => {
          const isWinner = playerId === winnerId;
          console.log(`[ResultsDisplay] Checking player ${playerId}, isWinner: ${isWinner}`);
          const resultClass = isWinner ? "drawing-result winner" : "drawing-result";
          return (
              <div key={playerId} className={resultClass}>
                <img src={drawingDataUrl} alt={`Drawing by ${getNickname(playerId, players)}`} />
                <p className="player-nickname">{getNickname(playerId, players)}</p>
              </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResultsDisplay; 