import React, { useEffect, useRef } from 'react';
import Chart from 'chart.js/auto';

// Plugin vẽ số lên đầu mỗi cột (trên thanh bar)
const barValuePlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx, options } = chart;
    if (!options.plugins?.barValueLabels?.display) return;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta.hidden) {
        meta.data.forEach((bar, index) => {
          const value = dataset.data[index];
          if (value == null || value === '') return;
          const label = typeof value === 'number' ? (Number.isInteger(value) ? value : value.toFixed(1)) : String(value);
          ctx.save();
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillStyle = '#374151';
          ctx.font = '12px sans-serif';
          const x = bar.x;
          const y = bar.y - 4;
          if (y > chart.scales.y.top) {
            ctx.fillText(label, x, y);
          }
          ctx.restore();
        });
      }
    });
  },
};

Chart.register(barValuePlugin);

const BarChart = ({ 
  data,
  labels,
  title = '',
  xAxisLabel = '',
  yAxisLabel = '',
  colors = ['#4e73df'],
  height = 250,
  onBarClick = null,
  showDataLabels = false
}) => {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  const buildDatasets = () => {
    if (Array.isArray(data?.[0])) {
      return data.map((dataSet, index) => ({
        label: Array.isArray(title) ? title[index] : `Dataset ${index + 1}`,
        data: dataSet,
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1,
      }));
    }
    return [{
      label: title,
      data: data || [],
      backgroundColor: colors[0],
      borderColor: colors[0],
      borderWidth: 1,
    }];
  };

  useEffect(() => {
    if (!chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');
    const flatData = Array.isArray(data?.[0])
      ? (data || []).flat().filter(v => typeof v === 'number' && !Number.isNaN(v))
      : (data || []).filter(v => typeof v === 'number' && !Number.isNaN(v));
    const dataMax = flatData.length ? Math.max(...flatData, 1) : 1;
    const yMax = showDataLabels ? Math.ceil(dataMax * 1.18) : undefined;

    // Cập nhật tại chỗ: mutate cùng mảng/object để Chart.js animate từ giá trị hiện tại → mới
    if (chartInstance.current) {
      const chart = chartInstance.current;
      const newDatasets = buildDatasets();
      // Cập nhật labels cùng tham chiếu (Chart.js dùng để so khớp)
      chart.data.labels.length = 0;
      chart.data.labels.push(...labels);
      newDatasets.forEach((ds, i) => {
        let target = chart.data.datasets[i];
        if (!target) {
          chart.data.datasets.push({ ...ds, data: [...(ds.data || [])] });
          return;
        }
        target.label = ds.label;
        target.backgroundColor = ds.backgroundColor;
        target.borderColor = ds.borderColor;
        // Mutate mảng data tại chỗ để Chart.js giữ transition từ giá trị cũ
        target.data.splice(0, target.data.length, ...(ds.data || []));
      });
      if (chart.data.datasets.length > newDatasets.length) {
        chart.data.datasets.splice(newDatasets.length);
      }
      if (chart.options.scales?.y) {
        chart.options.scales.y.max = yMax;
      }
      // 'none' = cập nhật ngay, không animate từ 0 (bar thường animate từ 0 khi dùng 'active')
      chart.update('none');
      return;
    }

    // Lần đầu: tạo chart mới
    chartInstance.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: buildDatasets(),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: {
            top: showDataLabels ? 28 : 0,
            right: 8,
            left: 8,
            bottom: 0
          }
        },
        onClick: onBarClick ? (event, elements) => {
          if (elements.length > 0) {
            const element = elements[0];
            const index = element.index;
            let value;
            if (Array.isArray(data?.[0])) {
              const datasetIndex = element.datasetIndex;
              value = data[datasetIndex][index];
            } else {
              value = data[index];
            }
            onBarClick(index, labels[index], value);
          }
        } : undefined,
        onHover: (event, elements) => {
          if (onBarClick && elements.length > 0) {
            event.native.target.style.cursor = 'pointer';
          } else if (onBarClick) {
            event.native.target.style.cursor = 'default';
          }
        },
        plugins: {
          barValueLabels: { display: showDataLabels },
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
            type: 'category',
            title: { display: !!xAxisLabel, text: xAxisLabel },
            ticks: { maxRotation: 45, minRotation: 0 }
          },
          y: {
            beginAtZero: true,
            ...(yMax != null && { max: yMax }),
            title: { display: !!yAxisLabel, text: yAxisLabel },
            ticks: { precision: 0 }
          }
        }
      },
    });
  }, [data, labels, title, xAxisLabel, yAxisLabel, colors, onBarClick, showDataLabels]);

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

export default BarChart;
