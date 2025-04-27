import React from 'react';
import './PromptDisplay.css';

const PromptDisplay = ({ prompt }) => {
  if (!prompt) {
    return null; // Don't render if there's no prompt
  }

  return (
    <div className="prompt-container">
      <span className="prompt-label">Draw:</span>
      <span className="prompt-word">{prompt}</span>
    </div>
  );
};

export default PromptDisplay; 