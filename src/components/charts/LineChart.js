import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const LineChart = ({ 
  data,
  labels,
  title = '',
  xAxisLabel = '',
  yAxisLabel = '',
  colors = ['#4e73df', '#1cc88a', '#f6c23e', '#e74a3b'],
  fill = false,
  height = 250,
  tension = 0.4
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  
  useEffect(() => {
    // Destroy previous chart instance if it exists
    if (chartInstance.current) {
      chartInstance.current.destroy();
    }
    
    if (!chartRef.current) return;
    
    // Create new chart
    const ctx = chartRef.current.getContext('2d');
    
    // Handle multiple datasets
    let datasets;
    if (Array.isArray(data[0])) {
      // Multiple datasets
      datasets = data.map((dataSet, index) => ({
        label: Array.isArray(title) ? title[index] : `Dataset ${index + 1}`,
        data: dataSet,
        backgroundColor: fill ? colors[index % colors.length] + '33' : colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 2,
        fill: fill,
        tension: tension,
        pointRadius: 3,
        pointBackgroundColor: colors[index % colors.length],
        pointBorderColor: "#fff",
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors[index % colors.length],
        pointHoverBorderColor: "#fff",
      }));
    } else {
      // Single dataset
      datasets = [{
        label: title,
        data: data,
        backgroundColor: fill ? colors[0] + '33' : colors[0],
        borderColor: colors[0],
        borderWidth: 2,
        fill: fill,
        tension: tension,
        pointRadius: 3,
        pointBackgroundColor: colors[0],
        pointBorderColor: "#fff",
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors[0],
        pointHoverBorderColor: "#fff",
      }];
    }
    
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: !!title && !Array.isArray(title),
            text: Array.isArray(title) ? '' : title,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          legend: {
            display: Array.isArray(data[0]), // Only show legend for multiple datasets
            position: 'top',
          },
          tooltip: {
            backgroundColor: "rgb(255,255,255)",
            bodyColor: "#858796",
            titleColor: "#6e707e",
            titleMarginBottom: 10,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            borderColor: '#dddfeb',
            borderWidth: 1,
            caretPadding: 10,
            displayColors: true,
          }
        },
        scales: {
          x: {
            title: {
              display: !!xAxisLabel,
              text: xAxisLabel
            }
          },
          y: {
            title: {
              display: !!yAxisLabel,
              text: yAxisLabel
            },
            beginAtZero: true,
            ticks: {
              precision: 0 // Show only integer values if possible
            }
          }
        }
      },
    });
    
    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, labels, title, xAxisLabel, yAxisLabel, colors, fill, tension]);
  
  return (
    <div style={{ height: height + 'px', position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default LineChart;
