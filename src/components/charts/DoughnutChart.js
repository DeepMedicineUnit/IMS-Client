import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

/**
 * Biểu đồ Doughnut (vòng tròn rỗng giữa) – phù hợp KPI nhỏ, tỉ lệ 2–5 nhóm.
 * Chart.js type: doughnut, cutout mặc định 50%.
 */
const DoughnutChart = ({
  data,
  labels,
  colors = ['#7dd3fc', '#5eead4', '#86efac', '#fcd34d', '#fda4af', '#c4b5fd'],
  title = '',
  height = 200,
  cutout = '55%',
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!chartRef.current || !data?.length) return;

    const ctx = chartRef.current.getContext('2d');

    if (chartInstance.current) {
      const chart = chartInstance.current;
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = colors.slice(0, data.length);
      chart.data.datasets[0].hoverBackgroundColor = colors.slice(0, data.length).map((c) => {
        const hex = c.replace('#', '');
        const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 25);
        const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 25);
        const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 25);
        return `rgb(${r},${g},${b})`;
      });
      chart.update('active');
      return;
    }

    chartInstance.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.slice(0, data.length),
          hoverBackgroundColor: colors.slice(0, data.length).map((c) => {
            const hex = c.replace('#', '');
            const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + 25);
            const g = Math.min(255, parseInt(hex.slice(2, 4), 16) + 25);
            const b = Math.min(255, parseInt(hex.slice(4, 6), 16) + 25);
            return `rgb(${r},${g},${b})`;
          }),
          borderWidth: 2,
          borderColor: '#fff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout,
        plugins: {
          title: {
            display: !!title,
            text: title,
            font: { size: 13, weight: 'bold' },
          },
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: 'rgba(255,255,255,0.96)',
            borderColor: '#e2e8f0',
            borderWidth: 1,
          },
        },
      },
    });
  }, [data, labels, colors, title, cutout]);

  useEffect(() => {
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, []);

  if (!data?.length) return null;
  return (
    <div style={{ height: height + 'px', position: 'relative' }}>
      <canvas ref={chartRef} />
    </div>
  );
};

export default DoughnutChart;
