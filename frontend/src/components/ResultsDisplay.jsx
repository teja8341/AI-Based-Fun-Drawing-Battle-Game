import React from 'react';
import { getNickname } from '../utils/playerUtils';
import './ResultsDisplay.css';
import Leaderboard from './Leaderboard';

// Helper to get nickname from ID (assuming players array is passed or available)
// REMOVED LOCAL DEFINITION - using imported version
// const getNickname = (playerId, players) => {
//     console.log(`[getNickname] Searching for ${playerId} in players:`, players);
//     const player = players.find(p => p.id === playerId);
//     console.log(`[getNickname] Found player:`, player);
//     return player ? player.nickname : 'Unknown Player';
// };

// Accept `scores` and `comments` props
const ResultsDisplay = ({ 
  drawings, 
  players, 
  winnerId, // Round winner
  scores, // Round scores
  comments, 
  playerScores // NEW: Overall cumulative scores
}) => {

  const winnerNickname = winnerId ? getNickname(winnerId, players) : null;
  console.log("[ResultsDisplay] Rendering with winnerId:", winnerId, "Nickname:", winnerNickname, "Scores:", scores, "Comments:", comments, "PlayerScores:", playerScores);

  if (!drawings || Object.keys(drawings).length === 0) {
    return <div className="results-container"><p>No drawings submitted yet.</p></div>;
  }

  return (
    <div className="results-display-layout">
        {/* Left Side: Round Results */}
        <div className="results-container round-results">
            <h2>Round Results</h2>
            {winnerNickname ? (
                <p className="winner-announcement">🏆 Round Winner: {winnerNickname}! 🏆</p>
            ) : (
                <p className="winner-announcement">No clear winner this round!</p>
            )}
            <div className="drawings-grid">
                {Object.entries(drawings).map(([playerId, drawingDataUrl]) => {
                const isWinner = playerId === winnerId;
                // console.log(`[ResultsDisplay] Checking player ${playerId}, isWinner: ${isWinner}`);
                const resultClass = isWinner ? "drawing-result winner" : "drawing-result";
                const roundScore = scores ? scores[playerId] : 'N/A';
                const playerComment = comments ? comments[playerId] : '...'; // Get comment for this player
                return (
                    <div key={playerId} className={resultClass}>
                        <img src={drawingDataUrl} alt={`Drawing by ${getNickname(playerId, players)}`} />
                        <p className="player-nickname">{getNickname(playerId, players)}</p>
                        <p className="player-score">Round Score: {roundScore}</p>
                        <p className="player-comment">"{playerComment}"</p> 
                    </div>
                );
                })}
            </div>
        </div>

        {/* Right Side: Overall Leaderboard */}
        <Leaderboard players={players} playerScores={playerScores} />

    </div>
  );
};

export default ResultsDisplay; 