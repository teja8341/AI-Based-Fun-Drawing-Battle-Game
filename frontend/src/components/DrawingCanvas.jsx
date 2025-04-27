import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import './DrawingCanvas.css';

const DEFAULT_LINE_WIDTH = 5;
const ERASER_LINE_WIDTH = 20; // Eraser usually needs to be wider

const DrawingCanvas = forwardRef(({ 
    width = 600, 
    height = 400, 
    disabled = false, 
    tool = 'pen', // NEW: Accept tool prop ('pen' or 'eraser')
    lineWidth = DEFAULT_LINE_WIDTH // NEW: Accept lineWidth prop
}, ref) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [context, setContext] = useState(null);

  // Initialize or update context properties when props change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round'; // Smoother lines
    setContext(ctx);
    
    // Ensure background is white initially
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

  }, [width, height]); // Only re-init background on dimension change

  // Update context settings based on tool/lineWidth props
  useEffect(() => {
    if (!context) return;
    console.log(`[Canvas] Updating context: Tool=${tool}, LineWidth=${lineWidth}`);
    if (tool === 'eraser') {
        context.globalCompositeOperation = 'destination-out'; // Erase mode
        context.lineWidth = ERASER_LINE_WIDTH; // Use dedicated eraser width for now
        // We could potentially make eraser width configurable too
    } else {
        context.globalCompositeOperation = 'source-over'; // Pen mode
        context.lineWidth = lineWidth;
    }
    context.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : 'black'; // Eraser needs a color to draw the transparency

  }, [context, tool, lineWidth]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    getDrawingDataUrl: () => {
        if (!canvasRef.current) return null;
        return canvasRef.current.toDataURL('image/png');
    },
    clearCanvas: () => {
        if (context && canvasRef.current) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
            context.fillStyle = 'white';
            context.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  }));

  // --- Drawing Handlers ---
  const getCoords = (event) => {
    if (event.touches && event.touches.length > 0) {
        // Touch event
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            offsetX: event.touches[0].clientX - rect.left,
            offsetY: event.touches[0].clientY - rect.top
        };
    } else if (event.nativeEvent) {
        // Mouse event
        return { offsetX: event.nativeEvent.offsetX, offsetY: event.nativeEvent.offsetY };
    } else {
        // Fallback for touch move?
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top
        };
    }
};

  const startDrawing = (event) => {
    if (disabled || !context) return;
    const { offsetX, offsetY } = getCoords(event);
    context.beginPath();
    context.moveTo(offsetX, offsetY);
    setIsDrawing(true);
    event.preventDefault(); // Prevent scrolling on touch devices
  };

  const finishDrawing = (event) => {
    if (disabled || !context || !isDrawing) return;
    context.closePath();
    setIsDrawing(false);
    event?.preventDefault(); // Optional chaining for safety
  };

  const draw = (event) => {
    if (disabled || !isDrawing || !context) return;
    const { offsetX, offsetY } = getCoords(event);
    context.lineTo(offsetX, offsetY);
    context.stroke();
    event.preventDefault(); // Prevent scrolling on touch devices
  };

  const canvasClassName = disabled ? "drawing-canvas disabled" : "drawing-canvas";

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={canvasClassName}
      // Mouse Events
      onMouseDown={startDrawing}
      onMouseUp={finishDrawing}
      onMouseLeave={finishDrawing}
      onMouseMove={draw}
      // Touch Events
      onTouchStart={startDrawing}
      onTouchEnd={finishDrawing}
      onTouchCancel={finishDrawing}
      onTouchMove={draw}
    />
  );
});

export default DrawingCanvas; 