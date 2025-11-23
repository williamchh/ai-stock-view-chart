export const Timeframe = {
    HOURLY: 'hourly',
    DAILY: 'daily',
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
};

/**
 * @param {Array<import("../stock-chart.js").StockData>} hourlyData - Array of hourly stock data.
 * @returns {Array<import("../stock-chart.js").StockData>} - Array of daily stock data aggregated from hourly data.
 */
export const aggregateToDaily = (hourlyData) => {
  if (!hourlyData || hourlyData.length === 0) return [];

  const dailyData = {};

  for (const hour of hourlyData.filter(h => h.open !== null || h.close !== null || h.high !== null || h.low !== null)) {
    const date = new Date(hour.time * 1000).toISOString().split('T')[0];
    if (!dailyData[date]) {
      dailyData[date] = {
        ...hour,
        date: date,
        open: hour.open,
        high: hour.high,
        low: hour.low,
        close: hour.close,
        timeframe: Timeframe.DAILY,
        timestamp: new Date(hour.time * 1000).getTime(),
      };
    } else {
      dailyData[date].high = Math.max(dailyData[date].high, hour.high);
      dailyData[date].low = Math.min(dailyData[date].low, hour.low);
      dailyData[date].close = hour.close;
    }
  }

  return Object.values(dailyData).sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
};


/** * Aggregates daily stock data into weekly data.
 * @param {Array<import("../stock-chart.js").StockData>} dailyData - The daily stock data to aggregate.
 * @param {Array<import("../stock-chart.js").StockData>} weeklyBases - The existing weekly bases to update.
 * @returns {Array<import("../stock-chart.js").StockData>} The aggregated weekly stock data.
 */
export const aggregateToWeekly = (dailyData, weeklyBases) => {
  if (!dailyData || dailyData.length === 0) return [];

  const weeklyData = {};
  const firstDaily = dailyData[0];
  if (!firstDaily) return [];
  const firstDay = new Date(firstDaily.time * 1000);
  let previousDay = firstDay.getDay();
  let previousYear = firstDay.getFullYear();
  let previousWeek = getWeekNumber(firstDay);

  let cnt = 1;

  const sameWeekStockbase = GetSameWeekStockbase(new Date(firstDaily.time * 1000).toISOString().split('T')[0], weeklyBases);
  if (sameWeekStockbase) {
    const sameWeekDate = new Date(sameWeekStockbase.time * 1000).toISOString().split('T')[0];
    const weekNumber = getWeekNumber(sameWeekDate);
    cnt = weekNumber.numberOfWeek;
    const _key = `${previousYear}-W${cnt.toString().padStart(2, '0')}`;
    weeklyData[_key] = {
      ...sameWeekStockbase,
      Timeframe: Timeframe.WEEKLY,
    };
  }

  for (const day of dailyData) {
    const dayStr = new Date(day.time * 1000).toISOString().split('T')[0];
    const year = new Date(dayStr).getFullYear();
    const week = getWeekNumber(dayStr);

    const dayOfWeek = new Date(dayStr).getDay();
    if (dayOfWeek < previousDay) {
      previousDay = dayOfWeek;
      cnt++;
    }
    else if (week.numberOfWeek > previousWeek.numberOfWeek) {
      previousWeek = week;
      previousDay = dayOfWeek;
      cnt++;
    }
    else {
      // previousWeek = week;
      previousDay++;
    }

    if (year !== previousYear) {
      previousYear = year;
      cnt = 1; // Reset count for new year
    }

    const weekKey = `${year}-W${cnt.toString().padStart(2, '0')}`;

    if (!weeklyData[weekKey]) {
      // find first base from weeklyBases that timestamp is same or after the current day
      const existingBase = weeklyBases.find(wb => wb.timestamp >= day.timestamp);
      const stockbase = existingBase || day;
      const stockbaseDateStr = new Date(stockbase.time * 1000).toISOString().split('T')[0]; 
      weeklyData[weekKey] = {
        ...stockbase,
        id: existingBase ? existingBase.ID : 0,
        date: stockbaseDateStr,
        open: day.open,
        high: day.high,
        low: day.low,
        close: day.close,
        timeframe: Timeframe.WEEKLY,
      };

      previousWeek = week;
    } else {

      const weekly = weeklyData[weekKey];

      // Set Open to first valid daily Open if weekly Open is missing or zero
      if (!weekly.open || weekly.open === 0) {
        weekly.open = day.open;
      }

      // Set Low to first valid daily Low if weekly Low is missing or zero
      if (!weekly.low || weekly.low === 0) {
        weekly.low = day.low;
      }

      weekly.high = Math.max(weekly.high, day.high);
      weekly.low = Math.min(weekly.low, day.low);
      weekly.close = day.close;

      weeklyData[weekKey] = weekly;
    }
  }

  return Object.values(weeklyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

/** * Aggregates daily stock data into monthly data.
 * @param {Array<import("../stock-chart.js").StockData>} dailyData - The daily stock data to aggregate.
 * @param {Array<import("../stock-chart.js").StockData>} monthlyBases - The existing monthly bases to update.
 * @returns {Array<import("../stock-chart.js").StockData>} The aggregated monthly stock data.
 */
export const aggregateToMonthly = (dailyData, monthlyBases) => {
  if (!dailyData || dailyData.length === 0) return [];

  const monthlyData = {};

  // Initialize with existing monthly bases
  for (const stock of monthlyBases) {
    stock.date = new Date(stock.time * 1000).toISOString().split('T')[0];
    const monthKey = stock.date.substring(0, 7); // YYYY-MM
    monthlyData[monthKey] = { ...stock };
  }

  const dailyRelatedMonthlyData = {};

  for (const day of dailyData) {
    day.date = new Date(day.time * 1000).toISOString().split('T')[0];
    const monthKey = day.date.substring(0, 7); // YYYY-MM

    if (!monthlyData[monthKey]) {
      // Create new monthly entry
      const existingBase = monthlyBases.find(mb => isSameMonth(mb.date, day.date));
      const stockbase = existingBase || day;
      
      monthlyData[monthKey] = {
        ...stockbase,
        ID: existingBase ? existingBase.ID : 0,
        date: existingBase ? existingBase.date : `${monthKey}-01`,
        open: day.open,
        high: day.high,
        low: day.low,
        close: day.close,
        timeframe: Timeframe.MONTHLY,
      };

      dailyRelatedMonthlyData[monthKey] = monthlyData[monthKey];
    } else {
      // Update existing monthly entry
      const monthly = monthlyData[monthKey];
      
      // Set open to first valid daily open if monthly open is missing or zero
      if (!monthly.open || monthly.open === 0) {
        monthly.open = day.open;
      }

      // Set low to first valid daily low if monthly low is missing or zero
      if (!monthly.low || monthly.low === 0) {
        monthly.low = day.low;
      }

      // Update high, low, and close as usual
      monthly.high = Math.max(monthly.high || 0, day.high);
      monthly.low = Math.min(monthly.low, day.low);
      monthly.close = day.close;

      dailyRelatedMonthlyData[monthKey] = monthly;
    }
  }

  return Object.values(dailyRelatedMonthlyData).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};


/**
 * Merges daily data with the daily group.
 * @param {Array<import("../stock-chart.js").StockData>} dailyData 
 * @param {Array<import("../stock-chart.js").StockData>} dailyGroup 
 * @return {Array<import("../stock-chart.js").StockData>} Merged daily data
 */
export const mergeWithDailyGroup = (dailyData, dailyGroup) => {
  // Create a map for O(1) lookups and track processed dates
  const dailyMap = new Map();

  dailyData.forEach(item => {
    const d = new Date(item.time * 1000).toISOString().split('T')[0];
    item.date = d; // Add Date property for easier comparison
  });

dailyGroup.forEach(item => {
    const d = new Date(item.timestamp * 1000).toISOString().split('T')[0];
    item.date = d; // Add Date property for easier comparison
  });

  // sort dailyData by date ascending
  dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Map dailyData by date for quick lookups
  dailyData.forEach(item => {
    const dateKey = new Date(item.date).getTime();
    dailyMap.set(dateKey, item);
  });

  dailyMap.forEach((dailyItem, dateKey) => {
    const groupItem = dailyGroup.findIndex(item => item.timestamp === dateKey);
    
    if (groupItem !== -1) {
      // If the date exists in the group, merge the data
      dailyGroup[groupItem] = {
        ...dailyGroup[groupItem],
        high: Math.max(dailyItem.high, dailyGroup[groupItem].high),
        low: Math.min(dailyItem.low, dailyGroup[groupItem].low),
        close: dailyItem.close,
        timeframe: Timeframe.DAILY
      };
    } else {
      // If the date does not exist in the group, add it
      dailyGroup.push({
        ...dailyItem,
        ID: 0, // Or generate one if needed
        IsBuy: null, // Reset IsBuy as per the original logic
      });
    }
  });

  return dailyGroup;
};


/**
 * Get the week number for a given date with weeks starting on Sunday.
 * Week 1 is the first week that contains January 1st.
 *
 * @param {string | Date} date - The reference date.
 * @returns {{ year: number, numberOfWeek: number }} The week number (1-53).
 */
export const getWeekNumber = (date) => {
  // Create a new Date object from the input to avoid modifying the original
  const d = new Date(date);
  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  
  const year = target.getUTCFullYear();
  const firstDayOfYear = new Date(Date.UTC(year, 0, 1));
  
  // Get the day of week for January 1st (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = firstDayOfYear.getUTCDay();
  
  // Calculate days since the start of the first Sunday-based week
  // If Jan 1st is Sunday (0), then it starts week 1
  // If Jan 1st is Monday (1), then the first Sunday is 6 days later
  const daysToFirstSunday = firstDayOfWeek === 0 ? 0 : 7 - firstDayOfWeek;
  
  // Get the date of the first Sunday of the year (start of week 1)
  const firstSunday = new Date(Date.UTC(year, 0, 1 + daysToFirstSunday));
  
  // If the target date is before the first Sunday, it belongs to the last week of previous year
  if (target.getTime() < firstSunday.getTime()) {
    // Calculate for previous year
    return getWeekNumber(new Date(Date.UTC(year - 1, 11, 31)));
  }
  
  // Calculate the difference in days from the first Sunday
  const daysDifference = Math.floor((target.getTime() - firstSunday.getTime()) / 86400000);
  
  // Week number is the number of complete weeks + 1
  const weekNumber = Math.floor(daysDifference / 7) + 1;
  
  // Check if this week extends into the next year
  const lastDayOfYear = new Date(Date.UTC(year, 11, 31));
  const lastDayOfWeek = lastDayOfYear.getUTCDay();
  const daysInLastWeek = lastDayOfWeek === 6 ? 7 : lastDayOfWeek + 1;
  
  // If we're in the last partial week that extends into next year
  if (target.getMonth() === 11 && target.getUTCDate() > (31 - daysInLastWeek) && daysInLastWeek < 4) {
    return { year: year + 1, numberOfWeek: 1 };
  }
  
  return { year: year, numberOfWeek: weekNumber };
};

/**
 * Returns the date of the same week as the given date
 * @param {string} date - The reference date.
 * @param { import("../stock-chart.js").StockData[]} stockbases - an array of weekly stockbases.
 * @return {import("../stock-chart.js").StockData} - The Stockbase object representing the same week stockbase.
 */
export const GetSameWeekStockbase = (date, stockbases) => {
    const workingDate = new Date(date);
    const { numberOfWeek: workingWeekNumber, year: workingYear } = getWeekNumber(workingDate);

    let stockbase = null;
    const total = stockbases.length;
    for (let i = 0; i < total; i++) {
        const wkStockbase = stockbases[i];
        const wkDate = new Date(wkStockbase.time * 1000);
        const { numberOfWeek: wkWeekNumber, year: wkYear } = getWeekNumber(wkDate);

        if (wkYear === workingYear && wkWeekNumber === workingWeekNumber) {
            stockbase = wkStockbase;
            break;
        }
    }

    return stockbase;
};


/**
 * Checks if two dates are in the same month.
 * @param {Date | string} date1
 * @param {Date | string} date2
 * @returns {boolean}
 */
export const isSameMonth = (date1, date2) => {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth();
};