import React from 'react';
import './GameControls.css';

const GameControls = ({ gamePhase, isHost, onStartGame, onStartNewRound }) => {

  return (
    <div className="game-controls">
      {isHost && gamePhase === 'waiting' && (
        <button onClick={onStartGame} className="control-button start-button">
          Start Game
        </button>
      )}

      {!isHost && gamePhase === 'waiting' && (
        <p className="waiting-message">Waiting for host to start the game...</p>
      )}

      {isHost && gamePhase === 'revealing' && (
        <button onClick={onStartNewRound} className="control-button new-round-button">
          Start New Round
        </button>
      )}

      {/* Add more controls as needed */}
    </div>
  );
};

export default GameControls; 