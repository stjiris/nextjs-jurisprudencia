import React, { useRef, useState } from 'react';
import { updateTooltipPosition } from '@/pages/dashboard';
import { pointer, select, selectAll } from 'd3-selection'
import { scaleLinear, scaleOrdinal } from 'd3-scale';
import { stack, stackOrderDescending, stackOffsetNone, area } from 'd3-shape'; 
import { axisBottom, axisLeft, axisRight, format } from 'd3';

interface DataPoint {
  x: number;
  [key: string]: number;
}
type StackedData = { key: string; data: DataPoint[] }[];
export default function AreaChart({ data, onDataSelect }: any) {
  const areachartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  React.useEffect(() => {
    const container = select(areachartContainerRef.current!);
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

      const dataValues: DataPoint[] = Object.values<DataPoint>(data);
      const xValues = dataValues.map((d) => d.x);
      const minYear = Math.min(...xValues);
      const maxYear = Math.max(...xValues);

      const xScale = scaleLinear().domain([minYear, maxYear]).range([0, innerWidth]);
      const keys = Object.keys(data[Object.keys(data)[0]]).filter((key) => key !== 'x');

      const transformedData: DataPoint[] = Object.entries(data).map(([year, values]) => {
        const { year: _, ...restValues } = values as DataPoint;
        return { ...restValues, x: Number(year) };
      });   

      const allYears = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);

      type DataByYear = { [year: number]: number[] };
      const dataByYear: DataByYear = allYears.reduce((acc: DataByYear, year: number) => {
        acc[year] = [];
        return acc;
      }, {});

      transformedData.forEach((d) => {
        dataByYear[d.year] = { ...dataByYear[d.year], ...d };
      });

      const totalCounts = transformedData.map((d) =>
        keys.reduce((total, key) => total + d[key], 0)
      );
      const yMax = Math.max(...totalCounts);

      const yPercentageScale = scaleLinear().domain([100, 0]).range([innerHeight/2, 0]);

      const yScale = scaleLinear().domain([0, yMax]).range([innerHeight/2, 0]);

      const stacks = stack()
        .keys(keys)
        .order(stackOrderDescending)
        .offset(stackOffsetNone);

      const stackedData = stacks(transformedData);
      type DataArea = {
        0: number;
        1: number;
        data: { x: number; [name: string]: number };
      };
      interface TotalDataArea {
        data: DataArea[];
        key: string;
        index: number;
      }

      const areaCount = area<DataArea>()
        .x((d) => xScale(d.data.x))
        .y0((d) => yScale(d[0]))
        .y1((d) => yScale(d[1]));

      const areaPercentage = area<DataArea>()
        .x((d) => xScale(d.data.x))
        .y0((d) => {
          const totalCount = totalCounts[d.data.x - minYear];
          return totalCount !== 0
          ? innerHeight / 2 + yPercentageScale((d[0] * 100) / totalCount)
          : innerHeight / 2; // Return a default value (e.g., innerHeight / 2) when totalCount is zero
        })        
        .y1((d) => {
          const totalCount = totalCounts[d.data.x - minYear];
          return totalCount !== 0
          ? innerHeight / 2 + yPercentageScale((d[1] * 100) / totalCount)
          : innerHeight / 2; // Return a default value (e.g., innerHeight / 2) when totalCount is zero
        })

        const colorScale: d3.ScaleOrdinal<string, string> = scaleOrdinal<string>()
        .domain(stackedData.map((d) => d.key))
        .range(colors);

      const pathGroup = svg.append('g').attr('class', 'areas');

      const countPaths = pathGroup
        .selectAll<SVGPathElement, TotalDataArea>('.area-count')
        .data(stackedData)
        .enter()
        .append('path')
        .attr('class', 'area-count')
        .transition()
        .duration(300)
        .attr('d', areaCount as any)
        .attr('fill', (d: { key: string }) => colorScale(d.key))
        .attr('stroke', 'white')
        .attr('stroke-width', 0.5);

      const percentagePaths = pathGroup
        .selectAll<SVGPathElement, TotalDataArea>('.area-percentage')
        .data(stackedData)
        .enter()
        .append('path')
        .attr('class', 'area-percentage')
        .transition()
        .duration(300)
        .attr('d', areaPercentage as any)
        .attr('fill', 'none')
        .attr('fill', (d: { key: any }) => colorScale(d.key))
        .attr('stroke', 'none');

      svg.append('g')
        .attr('transform', `translate(0, ${innerHeight/2})`)
        .call(axisBottom(xScale).tickFormat(format('.0f')))
        .selectAll('text')
        .style('text-anchor', 'end');

      svg.append('text')
        .attr('class', 'axis-label')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight/2 + 40)
        .style('text-anchor', 'middle')
        .style('text-anchor', 'middle')
        .text('Ano');

      const yAxisGroup = svg.append('g').call(axisLeft(yScale));
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
        axisRight(yPercentageScale).tickFormat(format('.0f'))
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
    const handleMousemove = (event: MouseEvent, d: any) => {
      const tooltipNode = tooltipRef.current;
      if (tooltipNode) {
        const year = Math.floor(xScale.invert(pointer(event)[0]));
        const values: DataPoint | undefined = transformedData.find((d) => d.x === year);
        if (values) {
          const tooltipContent = Object.entries(values)
            .filter(([k, v]) => k !== 'year' && v !==0)
            .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
            .join('<br>');
          tooltipNode.innerHTML = tooltipContent;  
          updateTooltipPosition(tooltipNode, event, "areachart-container");  
        }    
        verticalLine
        .attr('x1', xScale(year))
        .attr('y1', 0)
        .attr('x2', xScale(year))
        .attr('y2', innerHeight)
        .style('opacity', '1');
      }
      pathGroup
        .selectAll<SVGPathElement, TotalDataArea>('.area-count, .area-percentage')
        .style('opacity', (data) => {
          return data.key === d.key ? 1 : 0.5;
        });
    }  

    const handleMouseout = () => {
      if (tooltipRef.current) {
        tooltipRef.current.style.opacity = '0';
      }
      pathGroup.selectAll('path').style('opacity', 1);
    };

    const handleMouseClick = (event: MouseEvent, d: any) => {
      setSelectedArea(d.key);
      onDataSelect(d.key); // Pass the new search parameters
      
      pathGroup
      .selectAll<SVGPathElement, TotalDataArea>('.area-count, .area-percentage')
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
      .on('click', handleMouseClick)
      .on('mouseout', handleMouseout);

    var highlight = function (d: { key: string }) {
      selectAll('.myArea').style('opacity', 0);
      select('.myArea.' + d.key).style('opacity', 1);
    };

    var noHighlight = function () {
      selectAll('.myArea').style('opacity', 1);
    };

    const size = 20;

    const sortedKeys = stackedData.map((data) => data.key);
    
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

      function wrapText(text: string, width: number): string { 
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

      function getTextWidth(text: string): number {
        var textElement = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textElement.setAttribute('style', 'font-size: 12px');
        textElement.textContent = text;
        document.body.appendChild(textElement);
        var width = textElement.getComputedTextLength();
        document.body.removeChild(textElement);
        return width;
      }
    }

    return () => {
      select(tooltipRef.current).style('opacity', 0);
      select(areachartContainerRef.current).selectAll('svg').remove();
    };
  }, [data, selectedArea]);

  return (
    <div style={{ position: 'relative' }}>
      <div ref={areachartContainerRef} id="areachart-container" style={{ position: 'relative' }}>
        <div
          ref={tooltipRef}
          className="tooltip"
        ></div>
      </div>  
    </div>
  );
}
