import React, { useMemo } from 'react';
import * as d3 from 'd3';

const GlobalMetrics = ({ data, selectedDate }) => {
  const metrics = useMemo(() => {
    if (!data || !selectedDate || !data.cases || !data.deaths) return null;

    const cases = data.cases[selectedDate] || {};
    const deaths = data.deaths[selectedDate] || {};

    const totalCases = d3.sum(Object.values(cases));
    const totalDeaths = d3.sum(Object.values(deaths));

    const sortedCases = Object.entries(cases)
      .sort(([, a], [, b]) => b - a);

    return {
      totalCases: totalCases || 0,
      totalDeaths: totalDeaths || 0,
      mostAffectedCountry: sortedCases[0]?.[0] || 'No data',
      highestCases: sortedCases[0]?.[1] || 0,
      deathRate: totalCases > 0 ? (totalDeaths / totalCases) * 100 : 0
    };
  }, [data, selectedDate]);

  if (!metrics) {
    return (
      <div className="global-metrics">
        <div className="metrics-grid">
          <div className="metric-card">
            <h3>Total Global Cases</h3>
            <div className="metric-value">No data</div>
          </div>
          <div className="metric-card">
            <h3>Total Global Deaths</h3>
            <div className="metric-value">No data</div>
          </div>
          <div className="metric-card">
            <h3>Most Affected Country</h3>
            <div className="metric-value">No data</div>
          </div>
          <div className="metric-card">
            <h3>Global Death Rate</h3>
            <div className="metric-value">No data</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="global-metrics">
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Total Global Cases</h3>
          <div className="metric-value">{metrics.totalCases.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <h3>Total Global Deaths</h3>
          <div className="metric-value">{metrics.totalDeaths.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <h3>Most Affected Country</h3>
          <div className="metric-value">{metrics.mostAffectedCountry}</div>
          <div className="metric-subvalue">
            {metrics.highestCases.toLocaleString()} cases
          </div>
        </div>
        <div className="metric-card">
          <h3>Global Death Rate</h3>
          <div className="metric-value">
            {metrics.deathRate.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalMetrics;
