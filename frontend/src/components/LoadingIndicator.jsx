import React from 'react';
import './LoadingIndicator.css';

const LoadingIndicator = ({ message = "Loading..." }) => {
  return (
    <div className="loading-container">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
};

export default LoadingIndicator; 