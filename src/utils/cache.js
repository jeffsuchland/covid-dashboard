const CACHE_PREFIX = 'covid_viz_';
const CACHE_EXPIRY = 60 * 60 * 1000; // 1 hour

const compressData = (data) => {
  // Convert dates to shorter format (YYMMDD)
  const compressedData = {
    ...data,
    dates: data.dates.map(date => {
      const [month, day, year] = date.split('/').map(Number);
      return `${year.toString().slice(-2)}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;
    })
  };

  // Convert case/death numbers to deltas to save space
  ['cases', 'deaths'].forEach(metric => {
    compressedData[metric] = {};
    data.dates.forEach((date, index) => {
      compressedData[metric][compressedData.dates[index]] = {};
      Object.entries(data[metric][date]).forEach(([country, value]) => {
        if (index === 0) {
          compressedData[metric][compressedData.dates[index]][country] = value;
        } else {
          const prevDate = data.dates[index - 1];
          const prevValue = data[metric][prevDate][country] || 0;
          const delta = value - prevValue;
          if (delta !== 0) { // Only store non-zero deltas
            compressedData[metric][compressedData.dates[index]][country] = delta;
          }
        }
      });
    });
  });

  return compressedData;
};

const decompressData = (compressed) => {
  if (!compressed) return null;

  const decompressed = {
    ...compressed,
    dates: compressed.dates.map(date => {
      const year = parseInt(date.slice(0, 2)) + 2000;
      const month = parseInt(date.slice(2, 4));
      const day = parseInt(date.slice(4, 6));
      return `${month}/${day}/${year}`;
    })
  };

  // Convert deltas back to cumulative values
  ['cases', 'deaths'].forEach(metric => {
    decompressed[metric] = {};
    decompressed.dates.forEach((date, index) => {
      decompressed[metric][date] = {};
      Object.keys(compressed.regions).forEach(region => {
        compressed.regions[region].forEach(country => {
          if (index === 0) {
            decompressed[metric][date][country] = compressed[metric][compressed.dates[0]][country] || 0;
          } else {
            const prevDate = decompressed.dates[index - 1];
            decompressed[metric][date][country] = 
              (decompressed[metric][prevDate][country] || 0) +
              (compressed[metric][compressed.dates[index]][country] || 0);
          }
        });
      });
    });
  });

  return decompressed;
};

export const setCachedData = (key, data) => {
  try {
    const compressed = compressData(data);
    const item = {
      timestamp: Date.now(),
      data: compressed
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    console.warn('Cache storage quota exceeded - continuing without caching');
  }
};

export const getCachedData = (key) => {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;

    const { timestamp, data } = JSON.parse(item);
    if (Date.now() - timestamp > CACHE_EXPIRY) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }

    return decompressData(data);
  } catch (e) {
    console.warn('Error reading from cache:', e);
    return null;
  }
};

export const clearCache = (key) => {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    console.warn('Error clearing cache:', e);
  }
};
