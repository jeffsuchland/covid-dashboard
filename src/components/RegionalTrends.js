import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const RegionalTrends = ({ data, selectedDate }) => {
  const svgRef = useRef();
  const [selectedRegions, setSelectedRegions] = useState([
    'North America',
    'Asia',
    'Europe',
    'South America',
    'Australia-Oceania',
    'Africa'
  ]);
  const [availableRegions] = useState(Object.keys(data?.regions || {}));

  useEffect(() => {
    if (!data || !selectedDate || !selectedRegions.length) return;

    const margin = { top: 20, right: 20, bottom: 30, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Clear existing SVG
    d3.select(svgRef.current).selectAll("*").remove();

    // Create SVG
    const svg = d3.select(svgRef.current)
      .attr("viewBox", [0, 0, width + margin.left + margin.right, height + margin.top + margin.bottom])
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Process data
    const dates = data.dates;
    const regionalData = selectedRegions.map(region => ({
      region,
      values: dates.map(date => ({
        date,
        cases: d3.sum(data.regions[region].map(country => 
          data.cases[date]?.[country] || 0
        ))
      }))
    }));

    // Create scales
    const x = d3.scaleTime()
      .domain(d3.extent(dates, d => new Date(d)))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(regionalData, d => d3.max(d.values, v => v.cases))])
      .range([height, 0]);

    // Create line generator
    const line = d3.line()
      .x(d => x(new Date(d.date)))
      .y(d => y(d.cases));

    // Add X axis
    svg.append("g")
      .attr("transform", `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .style("color", "#f0f0f0");

    // Add Y axis
    svg.append("g")
      .call(d3.axisLeft(y))
      .style("color", "#f0f0f0");

    // Add lines
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    regionalData.forEach((region, i) => {
      svg.append("path")
        .datum(region.values)
        .attr("fill", "none")
        .attr("stroke", color(i))
        .attr("stroke-width", 2)
        .attr("d", line);

      // Add region name at the end of the line
      const lastValue = region.values[region.values.length - 1];
      svg.append("text")
        .attr("x", x(new Date(lastValue.date)) + 5)
        .attr("y", y(lastValue.cases))
        .attr("fill", color(i))
        .text(region.region);
    });

    // Add vertical line for selected date
    if (selectedDate) {
      svg.append("line")
        .attr("x1", x(new Date(selectedDate)))
        .attr("x2", x(new Date(selectedDate)))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#f0f0f0")
        .attr("stroke-dasharray", "4")
        .attr("stroke-width", 1);
    }
  }, [data, selectedDate, selectedRegions]);

  const handleRegionToggle = (region) => {
    setSelectedRegions(prev => 
      prev.includes(region)
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  return (
    <div className="regional-trends">
      <div className="region-selector">
        {availableRegions.map(region => (
          <button
            key={region}
            onClick={() => handleRegionToggle(region)}
            className={`region-button ${selectedRegions.includes(region) ? 'selected' : ''}`}
          >
            {region}
          </button>
        ))}
      </div>
      <div className="chart-container">
        <svg ref={svgRef} style={{ width: '100%', height: '400px' }}></svg>
      </div>
    </div>
  );
};

export default RegionalTrends;
