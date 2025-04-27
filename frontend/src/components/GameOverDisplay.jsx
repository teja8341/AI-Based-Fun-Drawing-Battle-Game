import React from 'react';
import Leaderboard from './Leaderboard';
import './GameOverDisplay.css'; // Create CSS next

const GameOverDisplay = ({ 
    winnerNicknames, 
    isTie, 
    finalScores, 
    players, 
    isHost, 
    onPlayAgain 
}) => {

    const title = isTie ? "It's a Tie!" : "Game Over!";
    const winnerText = isTie ? `Winners: ${winnerNicknames}` : `Winner: ${winnerNicknames}`;

    return (
        <div className="game-over-container">
            <h1>{title}</h1>
            <div className="winner-announcement grand-winner">
                🎉 {winnerText} 🎉
            </div>
            
            <div className="final-leaderboard-section">
                 <h3>Final Scores</h3>
                 <Leaderboard players={players} playerScores={finalScores} />
            </div>

            {isHost && (
                <button onClick={onPlayAgain} className="control-button play-again-button">
                    Play Again? (New Game)
                </button>
            )}
            {!isHost && (
                <p className="waiting-message">Waiting for host to start a new game...</p>
            )}
        </div>
    );
};

export default GameOverDisplay; 