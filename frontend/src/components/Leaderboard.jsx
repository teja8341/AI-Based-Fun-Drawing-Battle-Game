import React from 'react';
import { getNickname } from '../utils/playerUtils';
import './Leaderboard.css'; // We'll create this CSS file next

const Leaderboard = ({ players, playerScores }) => {
  // Create an array of players with their scores, handling cases where a player might not have a score yet
  const scoredPlayers = players.map(player => ({
    ...player,
    score: playerScores[player.id] || 0
  }));

  // Sort players by score in descending order
  scoredPlayers.sort((a, b) => b.score - a.score);

  return (
    <div className="leaderboard-container">
      <h2>Overall Scores</h2>
      <ol className="leaderboard-list">
        {scoredPlayers.map((player, index) => (
          <li key={player.id} className="leaderboard-item">
            <span className="leaderboard-rank">{index + 1}.</span>
            <span className="leaderboard-nickname">{player.nickname}</span>
            <span className="leaderboard-score">{player.score} pts</span>
          </li>
        ))}
      </ol>
    </div>
  );
};

export default Leaderboard; 