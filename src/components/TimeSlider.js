import React from 'react';

const TimeSlider = ({ dates, selectedDate, onChange }) => {
  const handleChange = (event) => {
    const index = parseInt(event.target.value);
    onChange(dates[index]);
  };

  const currentIndex = dates.indexOf(selectedDate);

  // Format date for display
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [month, day, year] = dateStr.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', { 
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="time-slider">
      <input
        type="range"
        min="0"
        max={dates.length - 1}
        value={currentIndex}
        onChange={handleChange}
        style={{ width: '100%' }}
      />
      <div className="dates-display">
        <div className="date-label start">{formatDate(dates[0])}</div>
        {selectedDate && (
          <div 
            className="date-label current"
            style={{
              position: 'absolute',
              left: `${(currentIndex / (dates.length - 1)) * 100}%`,
              transform: 'translateX(-50%)',
              color: '#63b3ed',
              fontWeight: 'bold'
            }}
          >
            {formatDate(selectedDate)}
          </div>
        )}
        <div className="date-label end">{formatDate(dates[dates.length - 1])}</div>
      </div>
    </div>
  );
};

export default TimeSlider;
