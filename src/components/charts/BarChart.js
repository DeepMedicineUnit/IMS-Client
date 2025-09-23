import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const BarChart = ({ 
  data,
  labels,
  title = '',
  xAxisLabel = '',
  yAxisLabel = '',
  colors = ['#4e73df'],
  height = 250
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
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1,
      }));
    } else {
      // Single dataset
      datasets = [{
        label: title,
        data: data,
        backgroundColor: colors[0],
        borderColor: colors[0],
        borderWidth: 1,
      }];
    }
    
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
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
            beginAtZero: true,
            title: {
              display: !!yAxisLabel,
              text: yAxisLabel
            },
            ticks: {
              precision: 0 // Show only integer values
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
  }, [data, labels, title, xAxisLabel, yAxisLabel, colors]);
  
  return (
    <div style={{ height: height + 'px', position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default BarChart;
