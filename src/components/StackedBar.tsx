import React, { useEffect, useRef, useState } from 'react';
import { updateTooltipPosition } from '@/pages/dashboard';
import { scaleLinear } from 'd3-scale';  // Import only the scaleLinear function
import { stack, stackOrderNone, stackOffsetNone } from 'd3-shape';  // Import functions from d3-shape
import { select } from 'd3-selection'
import { extent, max } from 'd3-array'

interface TermCount {
  label: string;
  count: number;
}

interface DataItem {
  term: string;
  counts: TermCount[];
}

type Data = DataItem[];

export default function StackedBarChart({ sData, onDataSelect }: {sData: StackedBarDataSource, onDataSelect: any } ) {
    const chartRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const optionLabels = [
        "Área",
        "Secção",
        "Relator Nome Profissional",
        "Meio Processual",
        "Votação",
        "Descritores"
    ];  
    useEffect(() => {
      const data: Data = Object.entries(sData).map(([term, value]) => {
        const counts = value.buckets.map((bucket: Bucket) => ({
          label: bucket.key,
          count: bucket.doc_count,
        }));
      
        const otherCount = value.sum_other_doc_count;
        counts.push({ label: 'Outros', count: otherCount });
        return {
          term,
          counts,
        };
      });
      data.sort((a, b) => {
        const indexA = optionLabels.indexOf(a.term);
        const indexB = optionLabels.indexOf(b.term);
        return indexA - indexB;
      });
      if (data && chartRef.current) {
        //const container = d3.select(chartRef.current!);
        const parentContainerWidth = chartRef.current.clientWidth;
        // --- NEW: Dynamically set chart height ---
        const numBars = data.length;
        const minBarHeight = 32;
        const maxBarHeight = 60;
        const defaultChartHeight = 420;
        const availableHeight = chartRef.current.clientHeight || defaultChartHeight;
        let barHeight = Math.max(minBarHeight, Math.min(maxBarHeight, Math.floor((availableHeight - 60) / numBars)));
        // If there are few bars, make them bigger to fill the space
        if (numBars * maxBarHeight < availableHeight - 60) {
          barHeight = Math.floor((availableHeight - 60) / numBars);
        }
        const margin = { top: 30, right: 200, bottom: 30, left: 200 };
        const width = parentContainerWidth - 2 * margin.left - margin.right;
        const height = barHeight;
        const xDomain: any[] = [];

        // Iterate over each term in the data and calculate xDomain
        data.forEach((d: DataItem, i: number) => {
            const counts = d.counts;
    
            // Perform stacking for the current term
            const series = stack<TermCount, string>() // Define the generic types for d3.stack
            .keys(counts.map((d: TermCount) => d.label))
            .value((_, key: string) => counts.find((item) => item.label === key)?.count ?? 0)
            .order(stackOrderNone)
            .offset(stackOffsetNone)([...counts]); // Convert each element of counts into its own array        
    
            xDomain[i] = extent(series.flat(2));
        });
        const maxUpperBound = max(xDomain.map(domain => domain[1]));        
            // Create the totalXScale for the horizontal bar chart using the maximum upper bound
        const totalXScale = scaleLinear()
            .domain([maxUpperBound, 0])
            .range([margin.left - 10, 0]);       

        const totalWidth = width + margin.left + margin.right;
        const totalHeight = barHeight * data.length + margin.top + margin.bottom;
    
        // Create the main chart container
        const mainContainer = select(chartRef.current)
        .append("svg")
        .attr("width", totalWidth + margin.left + margin.right)
        .attr("height", totalHeight);
    
        // Adjust the positioning of the chart elements
        const container = mainContainer
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

        data.forEach((d: DataItem, i: number) => {
          const term = d.term;
          const counts = d.counts;

          // Stack for the current term
          const series = stack<TermCount, string>()
            .keys(counts.map((item) => item.label))
            .value((datum, key) => {
              const countData = counts.find((item) => item.label === key);
              return countData ? countData.count : 0;
            })
            .order(stackOrderNone)
            .offset(stackOffsetNone)([...counts]);
      
          const xScale = scaleLinear()
            .domain([0, max(series, (stack) => max(stack, (d) => d[1])) || 0])
            .range([0, totalWidth]);

    
            // Create a separate container for each term
            const termContainer = container
            .append("g")
            //.attr("transform", `translate(${i % 2 === 2 ? 0 : width + margin.left + margin.right}, ${Math.floor(i / 2) * height})`);
            .attr("transform", `translate(${0}, ${i * barHeight})`);
          // Event handler for totalBar mouseover
            const handleTotalBarMouseover = (event: MouseEvent | any, d: any) => {
                const term = select(event.currentTarget).attr("data-term");
            
                termContainer
                .selectAll("g")
                .style("opacity", function () {
                    return select(this).attr("data-term") === term ? 1 : 0.5;
                });
            
                // Reduce opacity of the hovered totalBar
                termContainer
                .selectAll(`[data-term="${term}"] rect:last-child`)
                .style("opacity", 0.7);
            };
            
            // Event handler for totalBar mouseout
            const handleTotalBarMouseout = (event: MouseEvent | any, d: any) => {
                const term = select(event.currentTarget).attr("data-term");
            
                // Restore opacity of all bars in all groups
                termContainer.selectAll("g").style("opacity", 1);
            
                // Restore opacity of the totalBar
                termContainer
                .selectAll(`[data-term="${term}"] rect:last-child`)
                .style("opacity", 1);
            };

            const handleMousemove = (event: MouseEvent | any, d: any) => {
                if (tooltipRef.current) {
                  const tooltipNode = tooltipRef.current;
                  // Adjust tooltip position to stay within the SVG bounds
                  const parentDatum = select(event.currentTarget.parentNode).datum() as any;
                  if (parentDatum) {
                    const key = parentDatum.key;
                    const count = parentDatum[0][1] - parentDatum[0][0];
                    tooltipNode.innerHTML = `${key}: ${count}`;
                    updateTooltipPosition(tooltipNode, event, "barchart-container");
                    /*const term = select(event.currentTarget).attr("data-term");
                    termContainer.selectAll('rect').style('opacity', function () {
                      return select(this).attr('data-term') === key ? 1 : 0.5;
                    }); */
                }  
              }
            };
            
            const handleMouseout = (event: MouseEvent | any, d: any) => {
                const term = select(event.currentTarget).attr("data-term");
            
                // Restore opacity of all bars in all groups
              //  termContainer.selectAll('rect').style('opacity', 1);
                if (tooltipRef.current) {
                    tooltipRef.current.style.opacity = '0';
                }
            };

            const handleMouseClick = (event: MouseEvent |  any, d: any) => {
              const term = select(event.currentTarget).attr("data-term");
              
              if (tooltipRef.current) {
                // Adjust tooltip position to stay within the SVG bounds
                const parentDatum = select(event.currentTarget.parentNode).datum() as any;
                if (parentDatum) {
                  const key = parentDatum.key;
                  if (key !== 'Outros'){
                    onDataSelect(term, key);
                  }  
                }
              }  
            }  
            if (totalWidth > 0) {
                // Create the bars for the current term
              const groups = termContainer
                  .selectAll("g")
                  .data(series)
                  .join("g")
                  .attr("fill", (d, i) => {
                    if (d.key === "Outros") {
                      return "lightgray"; // Set the fill color to grey for 'Outros' key
                    } else {
                      return "#F4ECCE"; // Default color for other elements
                    }
                  }).attr("data-term", term)
                  .selectAll("g")
                  .data((d) => d)
                  .join("g")
                  .attr("data-term", term)
                  .on("mousemove", handleMousemove)
                  .on("mouseout", handleMouseout)
                  .on("click", handleMouseClick)
                  .each(function (d: any) {
                      const group = select(this);
                      const data: [number, number] = d as [number, number];

                      group
                          .append("rect")
                          .attr("x", (d) => xScale(data[0]))
                          .attr("y", 0)
                          .attr("rx", 10)
                          .attr("ry", 5)
                          .attr("width", (d) => xScale(data[1]) - xScale(data[0]))
                          .attr("height", height)
                          .style("stroke-width", "0.5px")
                          .style("stroke", "white");
                          
                  });
                }      
            /* groups
                .selectAll("text")  // Select existing text elements within the groups
                .data((d) => [d])  // Create a single-element data array for each group
                .join("text")
                .text((d) => d.data.label)  // Use the label of the data point
                // ... attributes for the text label
                .attr("x", (d) => (xScale(d[1]) + xScale(d[0])) / 2)  // Position at the center of the bar
                .attr("y", height / 2)  // Adjust the y position as needed
                .style("text-anchor", "middle")  // Center-align the text horizontally
                .style("dominant-baseline", "middle")  // Center the text vertically
                .attr("visibility", function (textData) {
                    const text = textData.data.label;
                    const textWidth = getTextWidth(text); // Calculate text width using the function
                    return textWidth <= (xScale(textData[1]) - xScale(textData[0])) ? "visible" : "hidden";  // Make text visible if it fits
                })
                .attr("pointer-events", "none");*/
            // Create the total bar for the current term
            const totalBar = termContainer
                .append("rect")
                //.attr("x", i % 2 === 0 ? 0 : width + margin.left + margin.right)
                .attr("y", height - 30)
                .attr("width", totalXScale(xDomain[i][1]))
                .attr("height", 2 * height / 3)
                .attr("fill", "#b40325")
                .style("opacity", 0.6)
                .attr("transform", `scale(-1, 1)`)
                .attr("data-term", term)
                //.on("mouseover", handleTotalBarMouseover)
                //.on("mouseout", handleTotalBarMouseout)
            const textXLeft = -5;   
            const textXRight = width + margin.left + margin.right + 5;   
            const textX = textXLeft;

            mainContainer.append('defs').append('clipPath')
            .attr('id', 'clip-label-left')
            .append('rect')
            .attr('x', - margin.left)
            .attr('width', margin.left)
            .attr('height', totalHeight/2);

          // Create clip-path for right column term labels
            /*mainContainer.append('defs').append('clipPath')
              .attr('id', 'clip-label-right')
              .append('rect')
              .attr('x', textXRight)
              .attr('width', margin.right)
              .attr('height', totalHeight/2);*/
            termContainer.append('text')
            .text(term)
            .attr('x', textX)
            .attr('y', height - 14)
            .style('text-anchor', 'end')
            .style('fill', '#000')
            .attr('clip-path', 'url(#clip-label-left)')
            .attr('pointer-events', 'none') // Prevent the clip-path from blocking mouse events
            .append('title')
            .text(term); 
            
           /* const lineY1 = 0;
            const lineY2 = totalHeight/2;
            const lineX = parentContainerWidth / 2 - margin.right;
            container
              .append('line')
              .attr('x1', lineX)
              .attr('y1', lineY1)
              .attr('x2', lineX)
              .attr('y2', lineY2)
              .style('stroke', 'lightgray')
              .style('stroke-width', '1');*/

        });
    
        
        return () => {
            select(chartRef.current)
            .selectAll('svg')
            .remove();
        };
      }
    }, [sData]);
  
    return (
        <div ref={chartRef} id="barchart-container">
          <div
            ref={tooltipRef}
            className="tooltip"
          ></div>
        </div>
      );
}
  
