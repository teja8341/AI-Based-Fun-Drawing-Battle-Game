import React from 'react';
import './CanvasToolbar.css';

const THICKNESS_OPTIONS = [2, 5, 10, 15];

const CanvasToolbar = ({ 
    onClearCanvas, 
    disabled,
    currentTool,
    onSetTool,
    currentLineWidth,
    onSetLineWidth
}) => {

  return (
    <div className="canvas-toolbar">
      {/* Tool Selection */} 
      <div className="tool-group">
          <button 
            onClick={() => onSetTool('pen')} 
            disabled={disabled}
            title="Pen"
            className={`toolbar-button tool-button ${currentTool === 'pen' ? 'active' : ''}`}
          >
            ✏️ Pen
          </button>
          <button 
            onClick={() => onSetTool('eraser')} 
            disabled={disabled}
            title="Eraser"
            className={`toolbar-button tool-button eraser-button ${currentTool === 'eraser' ? 'active' : ''}`}
          >
            Eraser
          </button>
      </div>

      {/* Thickness Selection */} 
      <div className="tool-group thickness-group">
          {THICKNESS_OPTIONS.map(width => (
              <button
                  key={width}
                  onClick={() => onSetLineWidth(width)}
                  disabled={disabled || currentTool === 'eraser'} // Disable thickness for eraser for now
                  title={`Thickness ${width}`}
                  className={`toolbar-button thickness-button ${currentLineWidth === width && currentTool === 'pen' ? 'active' : ''}`}
                  style={{ 
                      // Visual indicator for thickness (optional)
                      height: '25px', 
                      position: 'relative' 
                  }}
              >
                  <span 
                      style={{ 
                          display: 'block', 
                          width: '80%', 
                          height: `${width}px`, 
                          backgroundColor: 'black', 
                          borderRadius: `${width / 2}px`,
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)'
                      }}
                  ></span>
              </button>
          ))}
      </div>

      {/* Clear Button */} 
      <button 
        onClick={onClearCanvas}
        disabled={disabled}
        title="Clear Canvas"
        className="toolbar-button clear-button"
      >
        Clear
      </button>
    </div>
  );
};

export default CanvasToolbar; 