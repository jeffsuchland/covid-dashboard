export const filterTypes = {
  DATE_RANGE: 'dateRange',
  REGION: 'region',
  COUNTRY: 'country',
  CASE_THRESHOLD: 'caseThreshold',
  DEATH_THRESHOLD: 'deathThreshold'
};

export class DataFilter {
  static filterByDateRange(data, startDate, endDate) {
    const filteredDates = data.dates.filter(date => 
      date >= startDate && date <= endDate
    );

    return {
      ...data,
      dates: filteredDates,
      cases: Object.fromEntries(
        filteredDates.map(date => [date, data.cases[date]])
      ),
      deaths: Object.fromEntries(
        filteredDates.map(date => [date, data.deaths[date]])
      )
    };
  }

  static filterByRegion(data, selectedRegions) {
    const allowedCountries = selectedRegions.flatMap(region => 
      data.regions[region] || []
    );

    return {
      ...data,
      cases: Object.fromEntries(
        Object.entries(data.cases).map(([date, countries]) => [
          date,
          Object.fromEntries(
            Object.entries(countries).filter(([country]) => 
              allowedCountries.includes(country)
            )
          )
        ])
      ),
      deaths: Object.fromEntries(
        Object.entries(data.deaths).map(([date, countries]) => [
          date,
          Object.fromEntries(
            Object.entries(countries).filter(([country]) => 
              allowedCountries.includes(country)
            )
          )
        ])
      )
    };
  }

  static filterByCountries(data, selectedCountries) {
    return {
      ...data,
      cases: Object.fromEntries(
        Object.entries(data.cases).map(([date, countries]) => [
          date,
          Object.fromEntries(
            Object.entries(countries).filter(([country]) => 
              selectedCountries.includes(country)
            )
          )
        ])
      ),
      deaths: Object.fromEntries(
        Object.entries(data.deaths).map(([date, countries]) => [
          date,
          Object.fromEntries(
            Object.entries(countries).filter(([country]) => 
              selectedCountries.includes(country)
            )
          )
        ])
      )
    };
  }

  static filterByThreshold(data, { minCases, maxCases, minDeaths, maxDeaths }) {
    const filteredCountries = new Set();

    // Find countries that meet the criteria
    Object.values(data.cases).forEach(dateData => {
      Object.entries(dateData).forEach(([country, cases]) => {
        const deaths = data.deaths[Object.keys(data.deaths)[0]]?.[country] || 0;
        if (
          (!minCases || cases >= minCases) &&
          (!maxCases || cases <= maxCases) &&
          (!minDeaths || deaths >= minDeaths) &&
          (!maxDeaths || deaths <= maxDeaths)
        ) {
          filteredCountries.add(country);
        }
      });
    });

    return DataFilter.filterByCountries(data, Array.from(filteredCountries));
  }

  static applyFilters(data, filters = []) {
    return filters.reduce((filteredData, filter) => {
      switch (filter.type) {
        case filterTypes.DATE_RANGE:
          return DataFilter.filterByDateRange(
            filteredData,
            filter.startDate,
            filter.endDate
          );
        case filterTypes.REGION:
          return DataFilter.filterByRegion(
            filteredData,
            filter.regions
          );
        case filterTypes.COUNTRY:
          return DataFilter.filterByCountries(
            filteredData,
            filter.countries
          );
        case filterTypes.CASE_THRESHOLD:
        case filterTypes.DEATH_THRESHOLD:
          return DataFilter.filterByThreshold(
            filteredData,
            filter.thresholds
          );
        default:
          return filteredData;
      }
    }, data);
  }
}
