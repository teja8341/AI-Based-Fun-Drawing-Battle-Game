import React, { useState, useEffect, useRef } from 'react';
import './TimerDisplay.css';

const TimerDisplay = ({ endTime }) => {
  const [timeLeft, setTimeLeft] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Function to calculate time remaining
    const calculateTimeLeft = () => {
      const now = Date.now();
      const difference = endTime - now;
      // Ensure timeLeft doesn't go below 0
      return difference > 0 ? Math.ceil(difference / 1000) : 0;
    };

    // Clear any existing interval when endTime changes or component unmounts
    const clearTimerInterval = () => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    };

    if (endTime && endTime > Date.now()) {
        setTimeLeft(calculateTimeLeft()); // Initial calculation

        // Set up interval to update every second
        intervalRef.current = setInterval(() => {
            const remaining = calculateTimeLeft();
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearTimerInterval(); // Stop when time is up
            }
        }, 1000);
    } else {
        // If no valid end time or time is already up, set to 0 and clear interval
        setTimeLeft(0);
        clearTimerInterval();
    }

    // Cleanup function
    return clearTimerInterval;

  }, [endTime]); // Rerun effect if endTime changes

  // Add a class when time is low
  const timerClass = timeLeft <= 5 && timeLeft > 0 ? 'timer-display low-time' : 'timer-display';

  return (
    <div className={timerClass}>
      Timer: <span className="time-value">{timeLeft}</span>s
    </div>
  );
};

export default TimerDisplay; 