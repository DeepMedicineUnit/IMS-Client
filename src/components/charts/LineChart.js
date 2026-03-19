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
  
  const buildDatasets = () => {
    if (Array.isArray(data?.[0])) {
      return data.map((dataSet, index) => ({
        label: Array.isArray(title) ? title[index] : `Dataset ${index + 1}`,
        data: dataSet,
        backgroundColor: fill ? colors[index % colors.length] + '33' : colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 2,
        fill,
        tension,
        pointRadius: 3,
        pointBackgroundColor: colors[index % colors.length],
        pointBorderColor: "#fff",
        pointHoverRadius: 5,
        pointHoverBackgroundColor: colors[index % colors.length],
        pointHoverBorderColor: "#fff",
      }));
    }
    return [{
      label: title,
      data: data || [],
      backgroundColor: fill ? colors[0] + '33' : colors[0],
      borderColor: colors[0],
      borderWidth: 2,
      fill,
      tension,
      pointRadius: 3,
      pointBackgroundColor: colors[0],
      pointBorderColor: "#fff",
      pointHoverRadius: 5,
      pointHoverBackgroundColor: colors[0],
      pointHoverBorderColor: "#fff",
    }];
  };

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');

    if (chartInstance.current) {
      const chart = chartInstance.current;
      chart.data.labels = labels;
      chart.data.datasets = buildDatasets();
      chart.update('active');
      return;
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: buildDatasets(),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: !!title && !Array.isArray(title),
            text: Array.isArray(title) ? '' : title,
            font: { size: 14, weight: 'bold' }
          },
          legend: {
            display: Array.isArray(data?.[0]),
            position: 'top',
          },
          tooltip: {
            backgroundColor: "rgb(255,255,255)",
            bodyColor: "#858796",
            titleColor: "#6e707e",
            titleMarginBottom: 10,
            titleFont: { size: 14, weight: 'bold' },
            borderColor: '#dddfeb',
            borderWidth: 1,
            caretPadding: 10,
            displayColors: true,
          }
        },
        scales: {
          x: {
            title: { display: !!xAxisLabel, text: xAxisLabel }
          },
          y: {
            title: { display: !!yAxisLabel, text: yAxisLabel },
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      },
    });
  }, [data, labels, title, xAxisLabel, yAxisLabel, colors, fill, tension]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);
  
  return (
    <div style={{ height: height + 'px', position: 'relative' }}>
      <canvas ref={chartRef}></canvas>
    </div>
  );
};

export default LineChart;
