import React, { useState, useEffect } from 'react';
import WorldMap from './components/WorldMap';
import CountryDeepDive from './components/CountryDeepDive';
import TimeSlider from './components/TimeSlider';
import RegionalTrends from './components/RegionalTrends';
import GlobalMetrics from './components/GlobalMetrics';
import { fetchCovidData } from './utils/api';
import { clearCache } from './utils/cache';
import './App.css';

function App() {
  const [data, setData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = async (forceRefresh = false) => {
    try {
      setLoading(true);
      setError(null);
      
      // Clear cache if forcing refresh
      if (forceRefresh) {
        clearCache('covidData');
      }

      const covidData = await fetchCovidData();
      setData(covidData);
      
      // Set initial date to latest date
      if (!selectedDate && covidData.dates) {
        setSelectedDate(covidData.dates[covidData.dates.length - 1]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setError('Failed to load COVID-19 data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRefresh = () => {
    loadData(true);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (error) {
    return (
      <div className="error">
        <p>{error}</p>
        <button onClick={handleRefresh}>Try Again</button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="app">
      <header>
        <h1>Global Pandemic Pulse</h1>
        <button onClick={handleRefresh} className="refresh-button">
          Refresh Data
        </button>
      </header>

      <div className="app-container">
        <h1>Global COVID-19 Dashboard</h1>
        <div className="content">
          <GlobalMetrics data={data} selectedDate={selectedDate} />

          <div className="map-container">
            <WorldMap
              data={data}
              selectedDate={selectedDate}
              onSelectCountry={setSelectedCountry}
            />
            <TimeSlider
              dates={data.dates}
              selectedDate={selectedDate}
              onChange={setSelectedDate}
            />
          </div>

          <div className="data-grid">
            <div className="data-grid-item">
              {selectedCountry ? (
                <CountryDeepDive
                  country={selectedCountry}
                  data={data}
                  selectedDate={selectedDate}
                />
              ) : (
                <div className="placeholder">
                  Select a country to view detailed data
                </div>
              )}
            </div>

            <div className="data-grid-item">
              <RegionalTrends
                data={data}
                selectedDate={selectedDate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
