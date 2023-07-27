
import React, { useRef, useState } from 'react';
import * as d3 from 'd3';
import type { YearCountMap } from '@/types/vis';

/*interface AreaChartProps {
  data: YearCountMap;
  onSelect: (area: string | null) => void;
  containerWidth: number;
  containerHeight: number;
}*/

export default function AreaChart({ data, containerWidth, containerHeight, onSelect }) {
  const areachartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);

  React.useEffect(() => {
    const container = d3.select(areachartContainerRef.current!);
    if (container.node()) {
      const colors = [
        '#a6cee3',
        '#1f78b4',
        '#b2df8a',
        '#33a02c',
        '#fb9a99',
        '#e31a1c',
        '#fdbf6f',
        '#ff7f00',
        '#cab2d6',
        '#6a3d9a'
      ];

      const margin = { top: 30, right: 300, bottom: 30, left: 50 };
      const width = container.node()!.clientWidth!;
      const height = 600;

  
      const innerWidth = width - margin.left - margin.right;
      const innerHeight = height - margin.top - margin.bottom;

      let svg = container
        .append('svg')
        .attr('class', 'areachart')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);

      const dataValues = Object.values(data);
      const xValues = dataValues.map((d) => d.x);
      const minYear = Math.min(...xValues);
      const maxYear = Math.max(...xValues);

      const xScale = d3.scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]);
      const keys = Object.keys(data[Object.keys(data)[0]]).filter((key) => key !== 'x');

      const transformedData = Object.entries(data).map(([year, values]) => {
        return { year: Number(year), ...values };
      });

      // Create an array of all years from minYear to maxYear
      const allYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

      // Create an object to store the data for each year, initially with empty arrays
      const dataByYear = allYears.reduce((acc, year) => {
        acc[year] = [];
        return acc;
      }, {});

      // Populate the dataByYear object with the actual data from transformedData
      transformedData.forEach((d) => {
        dataByYear[d.year] = { ...dataByYear[d.year], ...d };
      });

      // Convert the dataByYear object to an array of arrays
      const finalData = Object.values(dataByYear);

      const totalCounts = transformedData.map((d) =>
        keys.reduce((total, key) => total + d[key], 0)
      );

      const yMax = dataValues.reduce((max: number, d: { [x: string]: number }) => {
        const total = Object.keys(d).reduce((sum, key) => {
          if (key !== 'x') {
            sum += d[key];
          }
          return sum;
        }, 0);
        return Math.max(max, total);
      }, 0);

      const yPercentageScale = d3.scaleLinear().domain([100, 0]).range([innerHeight/2, 0]);

      const yScale = d3.scaleLinear().domain([0, yMax]).range([innerHeight/2, 0]);

      const stack = d3
        .stack()
        .keys(keys)
        .order(d3.stackOrderDescending)
        .offset(d3.stackOffsetNone);

      const stackedData = stack(finalData);
      const areaCount = d3
        .area()
        .x(function (d: { data: { x: any } }) {
          const x = xScale(d.data.x);
          return x;
        })
        .y0((d: any[]) => yScale(d[0]))
        .y1((d: any[]) => yScale(d[1]));

      const areaPercentage = d3
        .area()
        .x(function (d: { data: { x: any } }) {
          const x = xScale(d.data.x);
          return x;
        })
        .y0(function (d: any[]) {
          const totalCount = totalCounts[d.data.year - minYear];
          return totalCount !== 0
          ? innerHeight / 2 + yPercentageScale((d[0] * 100) / totalCount)
          : innerHeight / 2; // Return a default value (e.g., innerHeight / 2) when totalCount is zero
      })
        .y1(function (d: any[]) {
          const totalCount = totalCounts[d.data.year - minYear];
          return totalCount !== 0
          ? innerHeight / 2 + yPercentageScale((d[1] * 100) / totalCount)
          : innerHeight / 2; // Return a default value (e.g., innerHeight / 2) when totalCount is zero
      }); 

      const colorScale = d3.scaleOrdinal().domain(stackedData.map((d) => d.key)).range(colors);

      const pathGroup = svg.append('g').attr('class', 'areas');

      const countPaths = pathGroup
        .selectAll('.area-count')
        .data(stackedData)
        .enter()
        .append('path')
        .attr('class', 'area-count')
        .transition()
        .duration(300)
        .attr('d', areaCount)
        .attr('fill', (d: { key: any }) => colorScale(d.key))
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5);

      const percentagePaths = pathGroup
        .selectAll('.area-percentage')
        .data(stackedData)
        .enter()
        .append('path')
        .attr('class', 'area-percentage')
        .transition()
        .duration(300)
        .attr('d', areaPercentage)
        .attr('fill', 'none')
        .attr('fill', (d: { key: any }) => colorScale(d.key))
        .attr('stroke', 'none');

      svg.append('g')
        .attr('transform', `translate(0, ${innerHeight/2})`)
        .call(d3.axisBottom(xScale).tickFormat(d3.format('.0f')))
        .selectAll('text')
        .style('text-anchor', 'end');

      svg.append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight/2 + 40)
        .style('text-anchor', 'middle')
        .style('text-anchor', 'middle')
        .text('Ano');

      const yAxisGroup = svg.append('g').call(d3.axisLeft(yScale));
      yAxisGroup.select('.domain').remove();
      yAxisGroup.selectAll('.tick line').attr('x2', -5);
      yAxisGroup.selectAll('.tick text').attr('x', -5).attr('dy', 4).style('text-anchor', 'end');
      yAxisGroup
        .append('line')
        .attr('class', 'axis-line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', height - margin.bottom - 20)
        .style('stroke', 'black')
        .style('stroke-width', 0.5);

      yAxisGroup
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', 0)
        .attr('y', -10)
        .style('text-anchor', 'middle')
        .style('text-anchor', 'middle')
        .text('Quantidade Total')
        .style('fill', 'black');

      const yPercentageAxisGroup = svg.append('g')
      .attr('transform', `translate(0, ${innerHeight/2})`)
      .call(
        d3.axisRight(yPercentageScale).tickFormat(d3.format('.0f'))
      );
      yPercentageAxisGroup.select('.domain').remove();
      yPercentageAxisGroup.selectAll('.tick line').remove();
      yPercentageAxisGroup
        .selectAll('.tick text')
        .attr('x', -5)
        .attr('dy', 4)
        .style('text-anchor', 'end');

      const verticalLine = svg.append('line')
        .attr('class', 'vertical-line')
        .style('stroke', '#999')
        .style('stroke-width', '1px')
        .style('stroke-dasharray', '4')
        .style('opacity', '0'); 
    const handleMousemove = (event: MouseEvent, d: { key: any; data: any }) => {
      if (tooltipRef.current) {
        const year = Math.floor(xScale.invert(d3.pointer(event)[0]));
        const key = d.key;
        const values = transformedData.find((d) => d.year === year);
        const tooltipContent = Object.entries(values)
          .filter(([k, v]) => k !== 'year' && v !==0)
          .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
          .join('<br>');
        const tooltipWidth = tooltipRef.current.offsetWidth;
        const tooltipHeight = tooltipRef.current.offsetHeight;
        const tooltipX = xScale(year) + tooltipWidth + 'px';
        const tooltipY = 2 * innerHeight + tooltipHeight;//event.clientY - tooltipHeight - 10 + 'px';
        tooltipRef.current.innerHTML = tooltipContent;
        tooltipRef.current.style.left = tooltipX;
        tooltipRef.current.style.top = tooltipY;
        tooltipRef.current.style.opacity = '1';
        tooltipRef.current.style.fontSize = '10px';

            // Update vertical line position
        verticalLine
        .attr('x1', xScale(year))
        .attr('y1', 0)
        .attr('x2', xScale(year))
        .attr('y2', innerHeight)
        .style('opacity', '1');
      }
      if (selectedArea === null) {
        pathGroup
          .selectAll('.area-count, .area-percentage')
          .style('opacity', (data) => {
            return data.key === d.key ? 1 : 0.5;
          });
      }
    };

    const handleMouseout = () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '0';
      }
      if (selectedArea === null) {
        pathGroup.selectAll('path').style('opacity', 1);
      }
    };

    const handleMouseClick = (event: MouseEvent, d: { key: any }) => {
      if (selectedArea === d.key) {
        setSelectedArea(null);
        onSelect(null);
      } else {
        setSelectedArea(d.key);
        onSelect(d.key);
      }
      pathGroup
        .selectAll('path')
        .style('opacity', (data: { key: any }) => {
          if (selectedArea === null || selectedArea === data.key) {
            return 1;
          } else {
            return 0.2;
          }
        });
    };

    pathGroup
      .selectAll('path')
      .on('mousemove', handleMousemove)
      //.on('click', handleMouseClick)
      .on('mouseout', handleMouseout);

    var highlight = function (d: { key: string }) {
      d3.selectAll('.myArea').style('opacity', 0);
      d3.select('.myArea.' + d.key).style('opacity', 1);
    };

    var noHighlight = function () {
      d3.selectAll('.myArea').style('opacity', 1);
    };

    const size = 20;
    const sortedKeys = keys.slice().sort((a, b) => {
      const countA = transformedData.filter((d) => d[a] > 0).length;
      const countB = transformedData.filter((d) => d[b] > 0).length;
      return countB - countA;
    });

    const elementsToMoveToEnd = sortedKeys.filter((key) => key.startsWith('sem') || key.startsWith('«'));
    const elementsToKeepAtStart = sortedKeys.filter((key) => !key.startsWith('sem') && !key.startsWith('«'));
    const finalSortedKeys = [...elementsToKeepAtStart, ...elementsToMoveToEnd];

    svg
      .selectAll('myrect')
      .data(finalSortedKeys)
      .enter()
      .append('rect')
      .attr('x', width - margin.right)
      .attr('y', function (d: any, i: number) {
        return 10 + i * (size + 5);
      })
      .attr('width', size)
      .attr('height', size)
      .style('fill', function (d: any) {
        return colorScale(d);
      })
      .on('mouseover', function (d: { srcElement: { __data__: any } }) {
        highlight(d.srcElement.__data__);
      })
      .on('mouseleave', function (d: { srcElement: { __data__: any } }) {
        noHighlight();
      });

    svg
      .selectAll('mylabels')
      .data(finalSortedKeys)
      .enter()
      .append('text')
      .attr('x', width - margin.right + size * 1.2)
      .attr('y', function (d, i) {
        var lineHeight = size + 5;
        return (i + 1) * lineHeight;
      })
      .style('fill', function (d) {
        return colorScale(d);
      })
      .text(function (d) {
        return wrapText(d, 70);
      })
      .style('text-anchor', 'start');

      function wrapText(text, width) {
        var words = text.split(/\s+/);
        var lines = [];
        var currentLine = words[0];

        for (var i = 1; i < words.length; i++) {
          var word = words[i];
          var testLine = currentLine + ' ' + word;
          var testWidth = getTextWidth(testLine);

          if (testWidth > width) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }

        lines.push(currentLine);
        return lines.join('\n');
      }

      function getTextWidth(text) {
        var testElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        testElement.setAttribute('style', 'font-size: 12px');
        testElement.textContent = text;
        document.body.appendChild(testElement);
        var width = testElement.getComputedTextLength();
        document.body.removeChild(testElement);
        return width;
      }
    }

    return () => {
      d3.select(tooltipRef.current).style('opacity', 0);
      d3.select(areachartContainerRef.current).selectAll('svg').remove();
    };
  }, [data, selectedArea, containerWidth, containerHeight]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={areachartContainerRef} id="areachart-container" style={{ position: 'relative' }}>
        <div
          ref={tooltipRef}
          style={{
            position: 'absolute',
            zIndex: 1,
            backgroundColor: '#555',
            color: '#fff',
            textAlign: 'center',
            borderRadius: '6px',
            padding: '5px',
            transition: 'opacity 0.3s'
          }}
        ></div>
      </div>  
    </div>
  );
}
