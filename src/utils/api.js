import { getCachedData, setCachedData } from './cache';

const API_BASE = 'https://disease.sh/v3/covid-19';

const parseApiDate = (dateStr) => {
  // Handle M/D/YY format
  const match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (match) {
    const [, month, day, year] = match;
    return `${month}/${day}/20${year}`;
  }

  // Handle MMDDYY format
  if (dateStr.length === 6) {
    const month = dateStr.substring(0, 2);
    const day = dateStr.substring(2, 4);
    const year = dateStr.substring(4, 6);
    return `${month}/${day}/20${year}`;
  }

  // Handle MM/DD/YYYY format
  const fullMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fullMatch) {
    const [, month, day, year] = fullMatch;
    return `${month}/${day}/${year}`;
  }

  console.warn('Unrecognized date format:', dateStr);
  return null;
};

const optimizeNumber = (num) => {
  // Round to nearest integer and ensure it's not negative
  return Math.max(0, Math.round(Number(num) || 0));
};

const processCountryData = (countryData, processedData, countryToContinent) => {
  if (!countryData.timeline?.cases || !countryData.timeline?.deaths) return;

  const countryName = countryData.country;
  const { cases, deaths } = countryData.timeline;

  // Convert timeline data to arrays and sort by date
  const timelineData = Object.entries(cases)
    .map(([date, caseCount]) => {
      const deathCount = deaths[date] || 0;
      return {
        date,
        cases: optimizeNumber(caseCount),
        deaths: optimizeNumber(deathCount)
      };
    })
    .sort((a, b) => {
      const [aMonth, aDay, aYear] = a.date.split('/').map(Number);
      const [bMonth, bDay, bYear] = b.date.split('/').map(Number);
      const aDate = new Date(2000 + aYear, aMonth - 1, aDay);
      const bDate = new Date(2000 + bYear, bMonth - 1, bDay);
      return aDate - bDate;
    });

  // Track previous values for anomaly detection
  let previousCases = 0;
  let previousDeaths = 0;
  let rollingAverageCases = 0;
  let rollingAverageDeaths = 0;
  const anomalyThreshold = 2.5; // Threshold for detecting unrealistic increases
  const smoothingWindow = 7;
  const recentCases = [];
  const recentDeaths = [];

  // Process each data point with anomaly detection
  timelineData.forEach(({ date, cases: caseCount, deaths: deathCount }, index) => {
    const formattedDate = parseApiDate(date);
    if (!formattedDate) {
      console.warn(`Invalid date format for ${countryName}:`, date);
      return;
    }

    // Update rolling averages
    recentCases.push(caseCount);
    recentDeaths.push(deathCount);
    if (recentCases.length > smoothingWindow) {
      recentCases.shift();
      recentDeaths.shift();
    }
    rollingAverageCases = recentCases.reduce((a, b) => a + b, 0) / recentCases.length;
    rollingAverageDeaths = recentDeaths.reduce((a, b) => a + b, 0) / recentDeaths.length;

    // Check for anomalies
    let validatedCases = caseCount;
    let validatedDeaths = deathCount;

    if (index > 0) {
      // Check for unrealistic increases
      const caseIncrease = caseCount - previousCases;
      const deathIncrease = deathCount - previousDeaths;
      const expectedMaxCaseIncrease = rollingAverageCases * anomalyThreshold;
      const expectedMaxDeathIncrease = rollingAverageDeaths * anomalyThreshold;

      // If increase is unrealistic, use rolling average instead
      if (caseIncrease > expectedMaxCaseIncrease) {
        validatedCases = previousCases + (rollingAverageCases * 1.1); // Allow slight increase
        console.warn(`Anomaly detected for ${countryName} on ${formattedDate}: Cases increased by ${caseIncrease}, expected max ${expectedMaxCaseIncrease}`);
      }
      if (deathIncrease > expectedMaxDeathIncrease) {
        validatedDeaths = previousDeaths + (rollingAverageDeaths * 1.1);
      }

      // Handle data corrections (negative changes)
      if (caseIncrease < 0) validatedCases = previousCases;
      if (deathIncrease < 0) validatedDeaths = previousDeaths;
    }

    // Store processed data
    processedData.dates.add(formattedDate);
    if (!processedData.cases[formattedDate]) {
      processedData.cases[formattedDate] = {};
    }
    if (!processedData.deaths[formattedDate]) {
      processedData.deaths[formattedDate] = {};
    }

    processedData.cases[formattedDate][countryName] = validatedCases;
    processedData.deaths[formattedDate][countryName] = validatedDeaths;

    // Update previous values
    previousCases = validatedCases;
    previousDeaths = validatedDeaths;
  });

  // Add country to region
  const continent = countryToContinent[countryName];
  if (continent && processedData.regions[continent]) {
    processedData.regions[continent].push(countryName);
  }
};

const fetchWithTimeout = async (url, options = {}, timeout = 10000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
  } finally {
    clearTimeout(id);
  }
};

const processFilters = (processedData, filters) => {
  if (!filters || filters.length === 0) return processedData;

  filters.forEach(filter => {
    switch (filter.type) {
      case 'DATE_RANGE':
        processedData.dates = processedData.dates.filter(date => {
          const [month, day, year] = date.split('/').map(Number);
          const dateObj = new Date(year, month - 1, day);
          return dateObj >= new Date(filter.startDate) && dateObj <= new Date(filter.endDate);
        });
        break;
      case 'REGION':
        const allowedCountries = filter.regions.flatMap(
          region => processedData.regions[region] || []
        );
        Object.keys(processedData.cases).forEach(date => {
          processedData.cases[date] = Object.fromEntries(
            Object.entries(processedData.cases[date]).filter(
              ([country]) => allowedCountries.includes(country)
            )
          );
        });
        Object.keys(processedData.deaths).forEach(date => {
          processedData.deaths[date] = Object.fromEntries(
            Object.entries(processedData.deaths[date]).filter(
              ([country]) => allowedCountries.includes(country)
            )
          );
        });
        break;
      case 'CASE_THRESHOLD':
        const { minCases } = filter;
        processedData.dates.forEach(date => {
          processedData.cases[date] = Object.fromEntries(
            Object.entries(processedData.cases[date]).filter(
              ([, cases]) => cases >= minCases
            )
          );
        });
        break;
      default:
        console.warn('Unknown filter type:', filter.type);
        break;
    }
  });

  return processedData;
};

// Country name mappings for API consistency
const COUNTRY_NAME_MAPPINGS = {
  "British Virgin Islands": "Virgin Islands (British)",
  "Brunei": "Brunei Darussalam",
  "Burma": "Myanmar",
  "Congo": "Congo (Brazzaville)",
  "Congo (Kinshasa)": "Congo (Democratic Republic)",
  "Cote d'Ivoire": "Côte d'Ivoire",
  "Czechia": "Czech Republic",
  "Eswatini": "Swaziland",
  "Falkland Islands": "Falkland Islands (Malvinas)",
  "Faroe Islands": "Faeroe Islands",
  "Holy See": "Vatican City",
  "Iran": "Iran (Islamic Republic of)",
  "Korea, South": "South Korea",
  "Laos": "Lao People's Democratic Republic",
  "Libya": "Libyan Arab Jamahiriya",
  "Macao": "Macau",
  "Macedonia": "North Macedonia",
  "Moldova": "Moldova (Republic of)",
  "Palestinian Territory": "Palestine",
  "Russia": "Russian Federation",
  "S. Korea": "South Korea",
  "Saint Kitts and Nevis": "Saint Kitts & Nevis",
  "Saint Vincent and the Grenadines": "Saint Vincent & Grenadines",
  "Syria": "Syrian Arab Republic",
  "Taiwan": "Taiwan, Province of China",
  "Tanzania": "Tanzania, United Republic of",
  "Timor-Leste": "East Timor",
  "UAE": "United Arab Emirates",
  "UK": "United Kingdom",
  "US": "United States of America",
  "USA": "United States of America",
  "Venezuela": "Venezuela (Bolivarian Republic)",
  "Vietnam": "Viet Nam"
};

const getApiCountryName = (displayName) => {
  return COUNTRY_NAME_MAPPINGS[displayName] || displayName;
};

const getDisplayCountryName = (apiName) => {
  const reverseMapping = Object.entries(COUNTRY_NAME_MAPPINGS)
    .find(([_, value]) => value === apiName);
  return reverseMapping ? reverseMapping[0] : apiName;
};

const fetchCovidData = async (filters = []) => {
  try {
    // Try to get cached data first
    const cachedData = getCachedData('covidData');
    if (cachedData) {
      console.log('Using cached data');
      return processFilters(cachedData, filters);
    }

    console.log('Fetching fresh data from API');

    // Fetch historical data for all countries
    const historicalData = await fetchWithTimeout(
      `${API_BASE}/historical?lastdays=730`
    );

    // Log raw data for debugging
    console.log('Raw historical data sample:', 
      historicalData.slice(0, 2).map(country => ({
        country: country.country,
        timelineLength: Object.keys(country.timeline?.cases || {}).length,
        lastDate: Object.keys(country.timeline?.cases || {}).pop(),
        recentCases: Object.entries(country.timeline?.cases || {})
          .slice(-5)
          .map(([date, cases]) => ({ date, cases }))
      }))
    );

    // Fetch current data for countries
    const countriesData = await fetchWithTimeout(
      `${API_BASE}/countries?sort=cases`
    );

    // Process the data into our required format
    const processedData = {
      dates: new Set(),
      cases: {},
      deaths: {},
      regions: {}
    };

    // Create a mapping of country names to continents
    const countryToContinent = {};
    countriesData.forEach(country => {
      if (country.continent) {
        const displayName = getDisplayCountryName(country.country);
        countryToContinent[displayName] = country.continent;
        if (!processedData.regions[country.continent]) {
          processedData.regions[country.continent] = [];
        }
        processedData.regions[country.continent].push(displayName);
      }
    });

    // Process historical data for each country
    historicalData.forEach(countryData => {
      if (!countryData.timeline?.cases || !countryData.timeline?.deaths) {
        console.warn(`Missing timeline data for ${countryData.country}`);
        return;
      }

      const displayName = getDisplayCountryName(countryData.country);
      const timeline = countryData.timeline;

      // Debug data for specific dates
      if (displayName === "USA" || displayName === "United States of America") {
        console.log('USA Timeline data:', {
          country: displayName,
          dataPoints: Object.keys(timeline.cases).length,
          march2023Data: Object.entries(timeline.cases)
            .filter(([date]) => date.startsWith('3/') && date.endsWith('/23'))
            .map(([date, cases]) => ({ date, cases })),
          recent: Object.entries(timeline.cases)
            .slice(-30)
            .map(([date, cases]) => ({ date, cases }))
        });
      }

      // Process each date in the timeline
      let lastValidCases = 0;
      let lastValidDate = null;
      
      Object.entries(timeline.cases).forEach(([date, cases]) => {
        const formattedDate = parseApiDate(date);
        if (!formattedDate) return;

        // Check for unrealistic increases
        if (lastValidDate) {
          const timeDiff = new Date(formattedDate) - new Date(lastValidDate);
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
          const increase = cases - lastValidCases;
          const dailyIncrease = increase / Math.max(1, daysDiff);

          // If daily increase is more than 100% of previous total, it's likely an error
          if (dailyIncrease > lastValidCases) {
            console.warn(`Suspicious increase for ${displayName} on ${formattedDate}:`, {
              increase,
              dailyIncrease,
              previousTotal: lastValidCases
            });
            return; // Skip this data point
          }
        }

        processedData.dates.add(formattedDate);

        // Initialize data structures for this date if needed
        if (!processedData.cases[formattedDate]) {
          processedData.cases[formattedDate] = {};
          processedData.deaths[formattedDate] = {};
        }

        // Only update if the new value is valid
        if (cases >= lastValidCases) {
          processedData.cases[formattedDate][displayName] = cases;
          processedData.deaths[formattedDate][displayName] = timeline.deaths[date] || 0;
          lastValidCases = cases;
          lastValidDate = formattedDate;
        } else {
          // Use last valid value if current value is invalid
          processedData.cases[formattedDate][displayName] = lastValidCases;
          processedData.deaths[formattedDate][displayName] = processedData.deaths[lastValidDate]?.[displayName] || 0;
        }
      });
    }); 

    // Convert dates Set to sorted Array
    processedData.dates = Array.from(processedData.dates)
      .map(date => {
        const [month, day, year] = date.split('/').map(Number);
        return { date, timestamp: new Date(year, month - 1, day).getTime() };
      })
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(({ date }) => date);

    // Log processed data for debugging
    if (processedData.dates.length > 0) {
      const sampleDate = processedData.dates[0];
      const sampleCountry = Object.keys(processedData.cases[sampleDate])[0];
      console.log('Processed data validation:', {
        totalDates: processedData.dates.length,
        dateRange: `${processedData.dates[0]} to ${processedData.dates[processedData.dates.length - 1]}`,
        totalCountries: Object.keys(countryToContinent).length,
        countriesWithData: Object.keys(processedData.cases[sampleDate]).length,
        sampleCountry,
        sampleData: {
          date: sampleDate,
          cases: processedData.cases[sampleDate][sampleCountry],
          deaths: processedData.deaths[sampleDate][sampleCountry]
        }
      });
    }

    // Apply filters if any
    const filteredData = processFilters(processedData, filters);

    try {
      setCachedData('covidData', filteredData);
    } catch (e) {
      console.warn('Failed to cache data:', e);
    }
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching COVID data:', error);
    throw error;
  }
};

export { fetchCovidData };
