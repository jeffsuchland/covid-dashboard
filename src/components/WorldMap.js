import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

// Country name mappings for map data to API data
const MAP_TO_API_NAMES = {
  "United States of America": "USA",
  "Russian Federation": "Russia",
  "United Kingdom": "UK",
  "Czech Republic": "Czechia",
  "Syrian Arab Republic": "Syria",
  "Iran (Islamic Republic of)": "Iran",
  "Viet Nam": "Vietnam",
  "Taiwan, Province of China": "Taiwan",
  "Venezuela (Bolivarian Republic)": "Venezuela",
  "Tanzania, United Republic of": "Tanzania",
  "Moldova (Republic of)": "Moldova",
  "Korea, Republic of": "S. Korea",
  "Korea, Democratic People's Republic of": "N. Korea",
  "North Korea": "N. Korea",
  "South Korea": "S. Korea",
  "Congo (Democratic Republic)": "DRC",
  "Congo (Brazzaville)": "Congo",
  "Côte d'Ivoire": "Cote d'Ivoire",
  "Central African Rep.": "Central African Republic",
  "S. Sudan": "South Sudan",
  "Bosnia and Herzegovina": "Bosnia",
  "Turkmenistan": "Turkmenistan",
  // Add common variations
  "Bosnia and Herz.": "Bosnia",
  "Bosnia and Herz": "Bosnia",
  "Democratic Republic of the Congo": "DRC",
  "Republic of the Congo": "Congo"
};

const WorldMap = ({ data, selectedDate, onSelectCountry }) => {
  const svgRef = useRef();
  const tooltipRef = useRef();
  const containerRef = useRef();
  const [error, setError] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!data || !selectedDate || !containerRef.current) {
      console.log('Missing data:', { data, selectedDate });
      return;
    }

    const loadMap = async () => {
      try {
        const container = containerRef.current;
        const containerWidth = container.clientWidth;
        const containerHeight = 500;
        const padding = 20;

        // Get container position for tooltip
        const containerRect = container.getBoundingClientRect();

        // Debug data structure
        console.log('Data structure:', {
          selectedDate,
          casesForDate: data.cases[selectedDate],
          sampleCountry: Object.keys(data.cases[selectedDate])[0],
          sampleCases: data.cases[selectedDate][Object.keys(data.cases[selectedDate])[0]]
        });

        // Clear existing SVG
        d3.select(svgRef.current).selectAll("*").remove();

        // Create SVG with explicit dimensions
        const svg = d3.select(svgRef.current)
          .attr("width", containerWidth)
          .attr("height", containerHeight);

        // Load map data
        let worldData;
        try {
          const response = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json");
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          worldData = await response.json();
        } catch (err) {
          throw new Error(`Failed to load world map data: ${err.message}`);
        }

        // Convert to GeoJSON
        const countries = topojson.feature(worldData, worldData.objects.countries);
        const filteredCountries = {
          type: "FeatureCollection",
          features: countries.features.filter(d => d.properties.name !== "Antarctica")
        };

        // Create projection
        const projection = d3.geoMercator()
          .fitSize([containerWidth, containerHeight], filteredCountries)
          .translate([containerWidth / 2, containerHeight / 2]);

        const path = d3.geoPath().projection(projection);

        // Get cases for the selected date
        const casesForDate = data.cases[selectedDate] || {};
        console.log('Cases for date:', casesForDate);
        console.log('USA data in casesForDate:', casesForDate['USA']);

        // Create color scale
        const maxCases = d3.max(Object.values(casesForDate)) || 1;
        console.log('Max cases:', maxCases);

        const colorScale = d3.scaleSequential()
          .domain([0, Math.log10(maxCases)])
          .interpolator(d3.interpolateBlues);

        // Debug all country mappings
        const countryMappings = filteredCountries.features.map(d => ({
          mapName: d.properties.name,
          apiName: MAP_TO_API_NAMES[d.properties.name] || d.properties.name,
          cases: casesForDate[MAP_TO_API_NAMES[d.properties.name] || d.properties.name]
        }));
        console.log('All country mappings:', countryMappings);

        // Draw map
        svg.selectAll("path")
          .data(filteredCountries.features)
          .join("path")
          .attr("d", path)
          .attr("fill", d => {
            const mapName = d.properties.name;
            const apiName = MAP_TO_API_NAMES[mapName] || mapName;
            const cases = casesForDate[apiName];
            
            // Debug country names and cases
            if (mapName === "United States of America" || apiName === "USA") {
              console.log('US Data Check:', { 
                mapName, 
                apiName, 
                cases,
                directCheck: casesForDate['USA'],
                hasKey: 'USA' in casesForDate
              });
            }
            
            if (!cases || cases === 0) return "#333";
            return colorScale(Math.log10(cases));
          })
          .attr("stroke", "#222")
          .attr("stroke-width", 0.5)
          .on("mouseover", (event, d) => {
            const mapName = d.properties.name;
            const apiName = MAP_TO_API_NAMES[mapName] || mapName;
            const cases = casesForDate[apiName];
            const deaths = data.deaths[selectedDate]?.[apiName];

            // Calculate tooltip position relative to container
            const mouseX = event.clientX - containerRect.left;
            const mouseY = event.clientY - containerRect.top;
            
            // Adjust tooltip position to stay within container
            const tooltipWidth = 200; // Approximate width
            const tooltipHeight = 100; // Approximate height
            const xPos = mouseX + tooltipWidth > containerWidth ? mouseX - tooltipWidth - 10 : mouseX + 10;
            const yPos = mouseY + tooltipHeight > containerHeight ? mouseY - tooltipHeight - 10 : mouseY + 10;

            setTooltipPosition({ x: xPos, y: yPos });

            d3.select(tooltipRef.current)
              .style("display", "block")
              .style("left", `${xPos}px`)
              .style("top", `${yPos}px`)
              .html(`
                <div class="tooltip-content">
                  <h3>${mapName}</h3>
                  ${cases ? 
                    `<p>Cases: ${cases.toLocaleString()}</p>
                     <p>Deaths: ${deaths?.toLocaleString() || '0'}</p>` :
                    '<p>No data available</p>'
                  }
                </div>
              `);

            d3.select(event.target)
              .attr("stroke", "#fff")
              .attr("stroke-width", 1);
          })
          .on("mouseout", (event) => {
            d3.select(tooltipRef.current).style("display", "none");
            d3.select(event.target)
              .attr("stroke", "#222")
              .attr("stroke-width", 0.5);
          })
          .on("click", (event, d) => {
            const mapName = d.properties.name;
            const apiName = MAP_TO_API_NAMES[mapName] || mapName;
            if (casesForDate[apiName]) {
              onSelectCountry(apiName);
            }
          });

        // Add legend
        const legendWidth = 250;
        const legendHeight = 10;
        const legendX = containerWidth - legendWidth - 40;
        const legendY = containerHeight - 40;

        const legendScale = d3.scaleLog()
          .domain([1, maxCases])
          .range([0, legendWidth]);

        const legendAxis = d3.axisBottom(legendScale)
          .tickValues([1, 100, 10000, 1000000])
          .tickFormat(d => {
            if (d >= 1000000) return `${d/1000000}M cases`;
            if (d >= 1000) return `${d/1000}K cases`;
            return `${d} cases`;
          });

        const defs = svg.append("defs");
        const linearGradient = defs.append("linearGradient")
          .attr("id", "legend-gradient")
          .attr("x1", "0%")
          .attr("x2", "100%")
          .attr("y1", "0%")
          .attr("y2", "0%");

        linearGradient.selectAll("stop")
          .data(d3.range(0, 1.1, 0.1))
          .enter()
          .append("stop")
          .attr("offset", d => d * 100 + "%")
          .attr("stop-color", d => d3.interpolateBlues(d));

        svg.append("rect")
          .attr("x", legendX)
          .attr("y", legendY)
          .attr("width", legendWidth)
          .attr("height", legendHeight)
          .style("fill", "url(#legend-gradient)");

        const legendGroup = svg.append("g")
          .attr("transform", `translate(${legendX},${legendY + legendHeight})`)
          .call(legendAxis)
          .style("color", "#f0f0f0");

        legendGroup.selectAll("text")
          .style("font-size", "11px")
          .attr("dy", "1.5em");

        // Add legend title
        svg.append("text")
          .attr("x", legendX)
          .attr("y", legendY - 5)
          .style("fill", "#f0f0f0")
          .style("font-size", "12px")
          .text("COVID-19 Cases");

      } catch (err) {
        console.error('Error in map rendering:', err);
        setError(err.message);
      }
    };

    loadMap();
  }, [data, selectedDate, onSelectCountry]);

  if (error) {
    return (
      <div className="error">
        <h3>Error loading map:</h3>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="world-map">
      <svg ref={svgRef}></svg>
      <div ref={tooltipRef} className="tooltip"></div>
    </div>
  );
};

export default WorldMap;
