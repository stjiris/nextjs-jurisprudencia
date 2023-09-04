// @ts-nocheck 
import React, { useRef, useState } from 'react';
import * as d3 from 'd3';

export default function StackedBarChart({ sData }) { //, selectedTerm, onSelectedTermChange, area }) {
    const chartRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef(null);
    const colors = [
        '#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a'
      ];
    const optionLabels = [
        "Jurisprudência",
        "Área",
        "Secção",
        "Relator Nome Profissional",
        "Meio Processual",
        "Decisão",
        "Votação",
        "Descritores",
        "Tribunal de Recurso",
        "Tribunal de Recurso - Processo",
        "Área Temática",
        "Jurisprudência Estrangeira",
        "Jurisprudência Internacional",
        "Doutrina",
        "Jurisprudência Nacional",
        "Legislação Comunitária",
        "Legislação Estrangeira",
        "Legislação Nacional",
        "Referências Internacionais",
        "Referência de publicação",
        "Indicações Eventuais", 
        "Jurisprudência"
    ];  
    React.useEffect(() => {
      const data = Object.entries(sData).map(([term, value]) => ({
        term,
        counts: value.buckets.map(bucket => ({
          label: bucket.key,
          count: bucket.doc_count
        }))  
      }));
      data.sort((a, b) => {
        const indexA = optionLabels.indexOf(a.term);
        const indexB = optionLabels.indexOf(b.term);
        return indexA - indexB;
      });
      if (data && chartRef.current) {
        //const container = d3.select(chartRef.current!);
        const parentContainerWidth = chartRef.current.clientWidth;
        const margin = { top: 30, right: 200, bottom: 30, left: 200 };
        const width = parentContainerWidth / 2 - 2 * margin.left - margin.right;
        const height = 95 - margin.top - margin.bottom;
        const xDomain: any[] = [];

        // Iterate over each term in the data and calculate xDomain
        data.forEach((d: { term: any; counts: any; }, i: string | number) => {
            const term = d.term;
            const counts = d.counts;
    
            // Perform stacking for the current term
            const series = d3
                .stack()
                .keys(counts.map((d: { label: any; }) => d.label))
                .value((d: any[], key: any) => d.find((item: { label: any; }) => item.label === key).count)
                .order(d3.stackOrderNone)
                .offset(d3.stackOffsetNone)([counts]);
    
            xDomain[i] = d3.extent(series.flat(2));
        });
        const maxUpperBound = d3.max(xDomain.map(domain => domain[1]));        
            // Create the totalXScale for the horizontal bar chart using the maximum upper bound
        const totalXScale = d3
            .scaleLinear()
            .domain([maxUpperBound, 0])
            .range([margin.left - 10, 0]);       
    
        const yDomain = data.map((d: { term: any; }) => d.term);
        const numColumns = 2; 
        const totalWidth = width + margin.left + margin.right;
        const totalHeight = height * data.length + margin.top + margin.bottom;
    
        // Create the main chart container
        const mainContainer = d3
        .select(chartRef.current)
        .append("svg")
        .attr("width", totalWidth * 2 + margin.left + margin.right)
        .attr("height", totalHeight);
    
        // Adjust the positioning of the chart elements
        const container = mainContainer
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    
        data.forEach((d, i) => {
            const term = d.term;
            const counts = d.counts;
            // Stack for the current term
            const series = d3
                .stack()
                .keys(counts.map((d: { label: any; }) => d.label))
                .value((d: any[], key: any) => d.find((item: { label: any; }) => item.label === key).count)
                .order(d3.stackOrderNone)
                .offset(d3.stackOffsetNone)([counts]);
    
            const xScale = d3
                .scaleLinear()
                .domain(xDomain[i])
                .range([0, totalWidth]);
    
            const colorScale = d3.scaleOrdinal()
            .domain([...Array(10).keys()])
            .range(colors);
    
            // Create a separate container for each term
            const termContainer = container
            .append("g")
            .attr("transform", `translate(${i % 2 === 0 ? 0 : width + margin.left + margin.right}, ${Math.floor(i / 2) * height})`);
          // Event handler for totalBar mouseover
            const handleTotalBarMouseover = (event, d) => {
                const term = d3.select(event.currentTarget).attr("data-term");
            
                termContainer
                .selectAll("g")
                .style("opacity", function () {
                    return d3.select(this).attr("data-term") === term ? 1 : 0.5;
                });
            
                // Reduce opacity of the hovered totalBar
                termContainer
                .selectAll(`[data-term="${term}"] rect:last-child`)
                .style("opacity", 0.7);
            };
            
            // Event handler for totalBar mouseout
            const handleTotalBarMouseout = (event, d) => {
                const term = d3.select(event.currentTarget).attr("data-term");
            
                // Restore opacity of all bars in all groups
                termContainer.selectAll("g").style("opacity", 1);
            
                // Restore opacity of the totalBar
                termContainer
                .selectAll(`[data-term="${term}"] rect:last-child`)
                .style("opacity", 1);
            };
            const handleMouseClick = (event, d) => {
                const term = d3.select(event.currentTarget).attr("data-term");
                onSelectedTermChange(term);
            };

            const handleMousemove = (event, d: { key: any; }) => {
                if (tooltipRef.current) {
                  const { clientX, clientY } = event;
                  const tooltipNode = tooltipRef.current;
                  const boundingRect = tooltipNode.getBoundingClientRect();
                  const tooltipWidth = boundingRect.width;
                  const tooltipHeight = boundingRect.height;
                
                  // Adjust tooltip position to stay within the SVG bounds
                  const x = clientX - 125 * width; //Math.min(Math.max(clientX - tooltipWidth, 0), width - tooltipWidth);
                  const y = clientY - 2 * height; //Math.min(Math.max(clientY - tooltipHeight - 10, 0), height - tooltipHeight);
                  const parentDatum = d3.select(event.currentTarget.parentNode).datum();
                  const key = parentDatum ? parentDatum.key : '';
                  const count = parentDatum ? parentDatum[0][1] - parentDatum[0][0] : 0;
                    const scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;
                    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                    tooltipRef.current.innerHTML = `${key}: ${count}`;
                    tooltipRef.current.style.left = `${clientX - margin.left - 90}px`;
                    tooltipRef.current.style.top = `${clientY}px`;
                    tooltipRef.current.style.opacity = '1';
                }
                const term = d3.select(event.currentTarget).attr("data-term");
                termContainer
                .selectAll("g")
                .style("opacity", function () {
                    return d3.select(this).attr("data-term") === term ? 1 : 0.5;
                });
            };
            
            const handleMouseout = (event, d) => {
                const term = d3.select(event.currentTarget).attr("data-term");
            
                // Restore opacity of all bars in all groups
                termContainer.selectAll("g").style("opacity", 1);
                if (tooltipRef.current) {
                    tooltipRef.current.style.opacity = '0';
                }
            };
            // Create the bars for the current term
            const groups = termContainer
                .selectAll("g")
                .data(series)
                .join("g")
                .attr("fill", (d, i) => {
                    //if (i < 10) {
                    //  return selectedTerm === term ? colorScale(d.key) : "#F4ECCE";
                    //} else {
                      return "#F4ECCE"; // Default color for elements beyond the first 10
                    //}
                }).attr("data-term", term)
                //.on("click", handleMouseClick);
    
            groups
                .selectAll("rect")
                .data((d: any) => d)
                .join("rect")
                .attr("x", (d: any[]) => xScale(d[0]))
                .attr("y", 0)
                .attr("rx", 10)
                .attr("ry", 5)
                .attr("width", (d: any[]) => xScale(d[1]) - xScale(d[0]))
                .attr("height", height)
                .style("stroke-width", "0.5px")
                .style("stroke", "white")
                .each(function (d, i) {
                  const parentDatum = d3.select(this.parentNode).datum();
                  d.parentDatum = parentDatum;
                })
                .append("title")
                .text((d: any[]) => {
                  const key = d.parentDatum ? d.parentDatum.key : '';
                  return `${key}: ${d[1] - d[0]}`;
                })
                //.on('mousemove', handleMousemove)
                //.on('mouseout', handleMouseout);
                
            // Create the total bar for the current term
            const totalBar = termContainer
                .append("rect")
                .attr("x", i % 2 === 0 ? 0 : width + margin.left + margin.right)
                .attr("y", height - 30)
                .attr("width", totalXScale(xDomain[i][1]))
                .attr("height", 2 * height / 3)
                .attr("fill", "#b40325")
                .style("opacity", 0.6)
                .attr("transform", i % 2 === 0 ? `scale(-1, 1)` : "")
                .attr("data-term", term)
                .on("mouseover", handleTotalBarMouseover)
                .on("mouseout", handleTotalBarMouseout)
                //.on("click", handleMouseClick);
            const textXLeft = -5;   
            const textXRight = width + margin.left + margin.right + 5;   
            const textX = i % 2 === 0 ? textXLeft : textXRight;

            mainContainer.append('defs').append('clipPath')
            .attr('id', 'clip-label-left')
            .append('rect')
            .attr('x', - margin.left)
            .attr('width', margin.left)
            .attr('height', totalHeight/2);

          // Create clip-path for right column term labels
            mainContainer.append('defs').append('clipPath')
              .attr('id', 'clip-label-right')
              .append('rect')
              .attr('x', textXRight)
              .attr('width', margin.right)
              .attr('height', totalHeight/2);
            const maxLength = margin.left;
            termContainer.append('text')
            .text(term)
            .attr('x', textX)
            .attr('y', height - 14)
            .style('text-anchor', i % 2 === 0 ? 'end' : 'start')
            .style('fill', '#000')
            .attr('clip-path', i % 2 === 0 ? 'url(#clip-label-left)' : 'url(#clip-label-right)')
            .attr('pointer-events', 'none') // Prevent the clip-path from blocking mouse events
            .append('title')
            .text(term); 
            
            const lineY1 = 0;
            const lineY2 = totalHeight/2;
            const lineX = parentContainerWidth / 2 - margin.right;
            container
              .append('line')
              .attr('x1', lineX)
              .attr('y1', lineY1)
              .attr('x2', lineX)
              .attr('y2', lineY2)
              .style('stroke', 'lightgray')
              .style('stroke-width', '1');

        });
    
        
        return () => {
            d3.select(chartRef.current)
            .selectAll('svg')
            .remove();
        };
      }
    }, [sData, colors]);
  
    return (
        <div ref={chartRef} id="barchart-container">
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
              transition: 'opacity 0.3s',
              opacity: 0,
            }}
          ></div>
        </div>
      );
}
  
