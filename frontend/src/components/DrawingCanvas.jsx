import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import './DrawingCanvas.css';

const DrawingCanvas = forwardRef(({ width = 600, height = 400, disabled = false }, ref) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 5;
    setContext(ctx);
    // Set background to white initially and on clear
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

  }, [width, height]); // Rerun if dimensions change

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    getDrawingDataUrl: () => {
      if (!canvasRef.current) return null;
      return canvasRef.current.toDataURL('image/png');
    },
    clearCanvas: () => {
      if (context && canvasRef.current) {
        context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        // Redraw white background after clearing
        context.fillStyle = 'white';
        context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  }));

  // --- Drawing Handlers ---
  const startDrawing = ({ nativeEvent }) => {
    if (disabled || !context) return;
    const { offsetX, offsetY } = nativeEvent;
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    if (disabled || !context) return;
    // Only close path if drawing actually started
    if(isDrawing) {
        context.closePath();
        setIsDrawing(false);
    }
  };

  const draw = ({ nativeEvent }) => {
    if (disabled || !isDrawing || !context) return;
    const { offsetX, offsetY } = nativeEvent;
    context.lineTo(offsetX, offsetY);
    context.stroke();
  };

  const canvasClassName = disabled ? "drawing-canvas disabled" : "drawing-canvas";

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={canvasClassName}
      onMouseDown={startDrawing}
      onMouseUp={finishDrawing}
      onMouseLeave={finishDrawing} // Use onMouseLeave instead of onMouseOut
      onMouseMove={draw}
      // Add touch events for basic mobile support (can be improved)
      onTouchStart={(e) => startDrawing({ nativeEvent: e.touches[0] })}
      onTouchEnd={finishDrawing}
      onTouchCancel={finishDrawing}
      onTouchMove={(e) => draw({ nativeEvent: e.touches[0] })}
    />
  );
});

export default DrawingCanvas; 