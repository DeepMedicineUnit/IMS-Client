import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

const PieChart = ({ 
  data, 
  labels, 
  colors = ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#858796'],
  title = '',
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
    
    chartInstance.current = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, data.length),
          hoverBackgroundColor: colors.map(color => {
            // Brighten the color a bit on hover
            const c = color.substring(1); // Remove #
            const r = parseInt(c.substring(0, 2), 16);
            const g = parseInt(c.substring(2, 4), 16);
            const b = parseInt(c.substring(4, 6), 16);
            // Lighten by 10%
            return `rgba(${Math.min(r + 20, 255)}, ${Math.min(g + 20, 255)}, ${Math.min(b + 20, 255)}, 0.9)`;
          }),
          hoverBorderColor: "rgba(234, 236, 244, 1)",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: !!title,
            text: title,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 12
            }
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
          }
        },
        cutout: '0%',
      },
    });
    
    // Cleanup on unmount
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [data, labels, colors, title]);
  
  return (
    <div style={{ height: height + 'px', position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default PieChart;
