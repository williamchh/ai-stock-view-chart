/**
 * @fileoverview Dark theme configuration for StockChart.
 * @author H Chen
 */

const darkTheme = {
    name: 'dark',
    background: '#1A1A1A',
    chartAreaBackground: '#2C2C2C',
    gridColor: '#444444',
    textColor: '#E0E0E0',
    // Candlestick colors
    candleUp: '#66BB6A', // Light Green
    candleDown: '#EF5350', // Light Red
    candleBorderColor: '#E0E0E0', // Border color for candlesticks
    // Line chart color
    lineColor: '#64B5F6', // Light Blue
    // Crosshair color
    crosshairColor: '#BDBDBD',
    // Overlay text color
    overlayTextColor: '#E0E0E0',
    positiveColor: 'rgba(102, 187, 106, 0.8)',
    negativeColor: 'rgba(239, 83, 80, 0.8)',
    borderColorUseBodyColor: true
};

export default darkTheme;