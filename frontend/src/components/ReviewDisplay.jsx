import React from 'react';
// import PlayerNickname from './PlayerNickname'; // REMOVE THIS
import './ResultsDisplay.css'; // Can reuse the same CSS for layout

// Helper to get nickname from ID (assuming players array is passed)
const getNickname = (playerId, players) => {
    const player = players.find(p => p.id === playerId);
    return player ? player.nickname : 'Unknown Player';
};

// Update component to accept isHost and onSendForJudgement
function ReviewDisplay({ drawings, players, prompt, isHost, onSendForJudgement }) {
  // const playerMap = players.reduce((map, player) => {
  //   map[player.id] = player.nickname;
  //   return map;
  // }, {}); // REMOVE playerMap logic

  return (
    <div className="results-display review-display">
      <h2>Review Drawings for: "{prompt}"</h2>
      <p>Look at everyone's masterpieces! The host can send these to the AI for judging.</p>

      {/* Conditionally render the button for the host */}
      {isHost && (
        <div className="review-actions">
          <button onClick={onSendForJudgement} className="button primary">
            Send for Judgement
          </button>
        </div>
      )}

      <div className="drawings-grid">
        {Object.entries(drawings).map(([playerId, drawingDataUrl]) => (
          <div key={playerId} className="drawing-result">
            {/* <PlayerNickname nickname={playerMap[playerId] || 'Unknown Player'} /> REMOVE THIS */}
            {/* ADD Nickname directly */}
            <p className="player-nickname">{getNickname(playerId, players)}</p> 
            <img src={drawingDataUrl} alt={`Drawing by ${getNickname(playerId, players)}`} />
          </div>
        ))}
        {Object.keys(drawings).length === 0 && <p>No drawings were submitted.</p>}
      </div>
    </div>
  );
}

export default ReviewDisplay; 