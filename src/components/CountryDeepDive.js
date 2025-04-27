import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

const CountryDeepDive = ({ country, data, selectedDate }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();

  useEffect(() => {
    if (!country || !data || !selectedDate) return;

    // Get data for the selected country
    const countryData = {
      dates: data.dates,
      cases: data.dates.map(date => ({
        date,
        value: data.cases[date]?.[country] || 0
      })),
      deaths: data.dates.map(date => ({
        date,
        value: data.deaths[date]?.[country] || 0
      }))
    };

    // Calculate weekly changes with smoothing
    const weeklyData = countryData.dates.map((date, index) => {
      // Get data from a week ago
      const weekAgo = index >= 7 ? countryData.dates[index - 7] : null;
      
      // Get current cases/deaths and previous cases/deaths
      const currentCases = data.cases[date]?.[country] || 0;
      const previousCases = weekAgo ? (data.cases[weekAgo]?.[country] || 0) : 0;
      const currentDeaths = data.deaths[date]?.[country] || 0;
      const previousDeaths = weekAgo ? (data.deaths[weekAgo]?.[country] || 0) : 0;

      // Calculate weekly changes
      let newCases = weekAgo ? currentCases - previousCases : 0;
      let newDeaths = weekAgo ? currentDeaths - previousDeaths : 0;

      // Handle negative values (data corrections)
      if (newCases < 0) newCases = 0;
      if (newDeaths < 0) newDeaths = 0;

      // Apply moving average smoothing
      const smoothingWindow = 7;
      let smoothedCases = 0;
      let smoothedDeaths = 0;
      let validPoints = 0;

      // Calculate moving average
      for (let i = Math.max(0, index - smoothingWindow + 1); i <= index; i++) {
        const pastDate = countryData.dates[i];
        const pastWeekAgo = i >= 7 ? countryData.dates[i - 7] : null;
        
        if (pastWeekAgo) {
          const pastCases = (data.cases[pastDate]?.[country] || 0) - (data.cases[pastWeekAgo]?.[country] || 0);
          const pastDeaths = (data.deaths[pastDate]?.[country] || 0) - (data.deaths[pastWeekAgo]?.[country] || 0);
          
          if (pastCases >= 0) {
            smoothedCases += pastCases;
            validPoints++;
          }
          if (pastDeaths >= 0) {
            smoothedDeaths += pastDeaths;
          }
        }
      }

      // Calculate final smoothed values
      if (validPoints > 0) {
        smoothedCases = smoothedCases / validPoints;
        smoothedDeaths = smoothedDeaths / validPoints;
      }

      return {
        date,
        newCases: smoothedCases,
        newDeaths: smoothedDeaths
      };
    });

    // Get current metrics
    const currentCases = data.cases[selectedDate]?.[country] || 0;
    const currentDeaths = data.deaths[selectedDate]?.[country] || 0;
    const deathRate = currentCases > 0 ? (currentDeaths / currentCases * 100) : 0;

    // Get weekly changes
    const currentIndex = data.dates.indexOf(selectedDate);
    const weekAgoIndex = Math.max(0, currentIndex - 7);
    const weekAgoCases = data.cases[data.dates[weekAgoIndex]]?.[country] || 0;
    const weekAgoDeaths = data.deaths[data.dates[weekAgoIndex]]?.[country] || 0;
    const weeklyNewCases = currentCases - weekAgoCases;
    const weeklyNewDeaths = currentDeaths - weekAgoDeaths;

    // Set up the chart
    const margin = { top: 10, right: 45, bottom: 55, left: 45 };
    const containerWidth = Math.min(950, svgRef.current.parentElement.clientWidth - 40); 
    const width = containerWidth - margin.left - margin.right;
    const height = 375 - margin.top - margin.bottom;

    // Clear previous SVG
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Set up scales
    const x = d3.scaleTime()
      .domain(d3.extent(weeklyData, d => new Date(d.date)))
      .range([0, width]);

    const y1 = d3.scaleLinear()
      .domain([0, d3.max(weeklyData, d => d.newCases)])
      .range([height, 0]);

    const y2 = d3.scaleLinear()
      .domain([0, d3.max(weeklyData, d => d.newDeaths)])
      .range([height, 0]);

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x)
        .ticks(d3.timeMonth.every(2))
        .tickFormat(d3.timeFormat("%b %Y")))
      .style("color", "#f0f0f0")
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-.8em")
      .attr("dy", ".15em")
      .attr("transform", "rotate(-45)")
      .style("font-size", "10px");

    // Add Y axis for cases
    svg.append("g")
      .style("color", "#2c5282")
      .call(d3.axisLeft(y1)
        .ticks(5)
        .tickFormat(d => d3.format(".0s")(d)))
      .selectAll("text")
      .style("font-size", "10px");

    // Add Y axis for deaths
    svg.append("g")
      .attr("transform", `translate(${width}, 0)`)
      .style("color", "#e53e3e")
      .call(d3.axisRight(y2)
        .ticks(5)
        .tickFormat(d => d3.format(".0s")(d)))
      .selectAll("text")
      .style("font-size", "10px");

    // Add grid
    svg.append("g")
      .attr("class", "grid")
      .style("stroke", "rgba(255, 255, 255, 0.1)")
      .style("stroke-dasharray", "2,2")
      .call(d3.axisLeft(y1)
        .tickSize(-width)
        .tickFormat("")
      );

    // Add the lines
    const casesLine = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => y1(d.newCases));

    const deathsLine = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => y2(d.newDeaths));

    svg.append("path")
      .datum(weeklyData)
      .attr("class", "line cases")
      .attr("fill", "none")
      .attr("stroke", "#2c5282")
      .attr("stroke-width", 2)
      .attr("d", casesLine);

    svg.append("path")
      .datum(weeklyData)
      .attr("class", "line deaths")
      .attr("fill", "none")
      .attr("stroke", "#e53e3e")
      .attr("stroke-width", 2)
      .attr("d", deathsLine);

    // Add legend
    const legend = svg.append("g")
      .attr("transform", `translate(${width - 100}, 0)`);

    legend.append("circle")
      .attr("cx", 0)
      .attr("cy", 10)
      .attr("r", 6)
      .style("fill", "#2c5282");

    legend.append("circle")
      .attr("cx", 0)
      .attr("cy", 30)
      .attr("r", 6)
      .style("fill", "#e53e3e");

    legend.append("text")
      .attr("x", 10)
      .attr("y", 10)
      .attr("alignment-baseline", "middle")
      .style("font-size", "12px")
      .style("fill", "#f0f0f0")
      .text("Cases");

    legend.append("text")
      .attr("x", 10)
      .attr("y", 30)
      .attr("alignment-baseline", "middle")
      .style("font-size", "12px")
      .style("fill", "#f0f0f0")
      .text("Deaths");

    // Add vertical line for selected date
    const selectedX = x(new Date(selectedDate));
    svg.append("line")
      .attr("x1", selectedX)
      .attr("x2", selectedX)
      .attr("y1", 0)
      .attr("y2", height)
      .attr("stroke", "#f0f0f0")
      .attr("stroke-dasharray", "4")
      .attr("stroke-width", 1);

    // Update metrics display
    return () => {
      d3.select(svgRef.current).selectAll("*").remove();
    };
  }, [country, data, selectedDate]);

  if (!country || !data || !selectedDate) return null;

  // Calculate metrics
  const currentCases = data.cases[selectedDate]?.[country] || 0;
  const currentDeaths = data.deaths[selectedDate]?.[country] || 0;
  const deathRate = currentCases > 0 ? (currentDeaths / currentCases * 100) : 0;

  const currentIndex = data.dates.indexOf(selectedDate);
  const weekAgoIndex = Math.max(0, currentIndex - 7);
  const weekAgoCases = data.cases[data.dates[weekAgoIndex]]?.[country] || 0;
  const weekAgoDeaths = data.deaths[data.dates[weekAgoIndex]]?.[country] || 0;
  const weeklyNewCases = currentCases - weekAgoCases;
  const weeklyNewDeaths = currentDeaths - weekAgoDeaths;

  return (
    <div className="country-deep-dive">
      <h3>{country}</h3>
      <div className="metrics-container">
        <div className="metrics-grid">
          <div className="metric">
            <span className="label">Total Cases:</span>
            <span className="value">{currentCases.toLocaleString()}</span>
          </div>
          <div className="metric">
            <span className="label">Total Deaths:</span>
            <span className="value">{currentDeaths.toLocaleString()}</span>
          </div>
          <div className="metric">
            <span className="label">Weekly New Cases:</span>
            <span className="value">{weeklyNewCases.toLocaleString()}</span>
          </div>
          <div className="metric">
            <span className="label">Weekly New Deaths:</span>
            <span className="value">{weeklyNewDeaths.toLocaleString()}</span>
          </div>
          <div className="metric">
            <span className="label">Death Rate:</span>
            <span className="value">{deathRate.toFixed(2)}%</span>
          </div>
        </div>
      </div>
      <div className="chart-wrapper">
        <div className="chart-container">
          <svg ref={svgRef} />
        </div>
      </div>
    </div>
  );
};

export default CountryDeepDive;
