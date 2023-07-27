// @ts-nocheck 
import React, { useEffect, useRef, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import * as d3 from 'd3';

const ParallelSets = ({ parallelSetsData }) => {
  const svgRef = useRef<HTMLDivElement>(null);
  const margin = { top: 20, right: 20, bottom: 20, left: 100 };
  const width = 900; //container.node()!.clientWidth;
  //const height = 720 - margin.top - margin.bottom;
  const height = 600;
  const [selectedNode, setSelectedNode] = useState(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = d3.select(svgRef.current!);
    //const height = 600; //container.node()!.clientWidth!
    //const width = 900//container.node()!.clientWidth;

    //console.log(parallelSetsData);
    let data = Object.values(parallelSetsData).flat();
    data = parallelSetsData.map(entry => {
      const newData: { [key: string]: any } = {};
      for (let i = 0; i < entry.key.length; i++) {
        newData[`level${i}`] = entry.key[i];
      }
      newData['value'] = entry.doc_count;
      return newData;
    });
    
    const fieldOrder = Object.keys(data[0]);

    data.sort((a, b) => {
      for (let i = 0; i < fieldOrder.length; i++) {
        const field = fieldOrder[i];
        if (a[field] < b[field]) return 1;
        if (a[field] > b[field]) return -1;
      }

      return b.value - a.value;
    });
    const svg = d3.select(svgRef.current)
    .attr("viewBox", [0, 0, width, height]);
    // Create the parallel sets chart
    const createParallelSets = () => {
      const level0Values = new Set();
      data.forEach(item => {
        level0Values.add(item.level0);
      })
      const color = d3.scaleOrdinal(Array.from(level0Values), ["#da4f81", "#f1c40f", "#2ecc71", "#3498db", "#e67e22"]);
      const keys = fieldOrder.slice(0, -1);
      const handleMouseover = (event, d) => {
        setSelectedNode(d);
      
        // Highlight connected links and nodes
        const connectedLinks = svg.selectAll('.link').filter((linkData) =>
          linkData.names.includes(d.name)
        );
        const connectedNodes = svg.selectAll('.node').filter((nodeData) =>
          connectedLinks.data().some((link) => link.source === nodeData || link.target === nodeData)
        );
      
        connectedLinks.attr('opacity', 1);
        connectedNodes.attr('opacity', 1);
        const tooltipNode = tooltipRef.current;
        // Show tooltip
        d3.select(tooltipNode).style('opacity', 1).html(
          `<strong>${d.names.join(' → ')}</strong><pt />${d.value ? d.value.toLocaleString() : ''}`
        );
        tooltipNode.style.fontSize = '10px';
      
        // Update tooltip position based on mouse cursor
        const { clientX, clientY } = event;
        
        const boundingRect = tooltipNode.getBoundingClientRect();
        const tooltipWidth = boundingRect.width;
        const tooltipHeight = boundingRect.height;
      
        // Adjust tooltip position to stay within the SVG bounds
        const x = Math.min(Math.max(clientX - tooltipWidth, 0), width - tooltipWidth);
        const y = Math.min(Math.max(clientY - tooltipHeight - 10, 0), height - tooltipHeight);
      
        tooltipNode.style.left = `${x}px`;
        tooltipNode.style.top = `${y}px`;
      };
      
    
      const handleMouseout = () => {
        setSelectedNode(null);
    
        // Reset highlighting
        svg.selectAll('.link').attr('opacity', 0.2);
        svg.selectAll('.node').attr('opacity', 1);
    
        // Hide tooltip
        d3.select(tooltipRef.current).style('opacity', 0).style('opacity', 0);
    
        // Hide vertical line
        //verticalLine.style('opacity', 0);
      };
      const sankeyGenerator = sankey()
        .nodeSort(null)
        .linkSort(null)
        .nodeWidth(4)
        .nodePadding(10)
        .extent([[0, 5], [width, height - 5]]);

      const graph = (data) => {
        const nodeByKey = new Map();
        const indexByKey = new Map();
        const nodes = [];
        const links = [];

        for (const k of keys) {
          for (const d of data) {
            const key = JSON.stringify([k, d[k]]);
            if (!nodeByKey.has(key)) {
              const node = { name: d[k] };
              nodes.push(node);
              nodeByKey.set(key, node);
              indexByKey.set(key, nodes.length - 1);
            }
          }
        }

        for (let i = 1; i < keys.length; ++i) {
          const a = keys[i - 1];
          const b = keys[i];
          const prefix = keys.slice(0, i + 1);
          const linkByKey = new Map();

          for (const d of data) {
            const names = prefix.map(k => d[k]);
            const key = JSON.stringify(names);
            const value = d.value || 1;

            let link = linkByKey.get(key);
            if (link) {
              link.value += value;
              continue;
            }

            link = {
              source: indexByKey.get(JSON.stringify([a, d[a]])),
              target: indexByKey.get(JSON.stringify([b, d[b]])),
              names,
              value
            };
            links.push(link);
            linkByKey.set(key, link);
          }
        }

        return { nodes, links };
      };

      const graphData = graph(data);

      const { nodes, links } = sankeyGenerator({
        nodes: graphData.nodes.map(d => Object.assign({}, d)),
        links: graphData.links.map(d => Object.assign({}, d))
      });

      const nodeElements = svg.append('g')
        .selectAll('rect')
        .data(nodes)
        .join('rect')
        .attr('x', (d) => d.x0)
        .attr('y', (d) => d.y0)
        .attr('height', (d) => d.y1 - d.y0)
        .attr('width', (d) => d.x1 - d.x0)
        //.on('mouseover', handleMouseover)
        //.on('mouseout', handleMouseout);
         
        //.append('title')
        //.text((d) => `${d.name}\n${d.value ? d.value.toLocaleString() : ''}`);

        const linkElements = svg.append('g')
        .attr('fill', 'none')
        .selectAll('g')
        .data(links)
        .join('path')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', (d) => color(d.names[0]))
        .attr('stroke-width', (d) => d.width)
        .style('mix-blend-mode', 'multiply')
        //.on('mouseover', handleMouseover)
        //.on('mouseout', handleMouseout);
        .append('title')
        .text((d) => `${d.names.join(' → ')}\n${d.value ? d.value.toLocaleString() : ''}`);

      svg.append('g')
        .style('font', '10px sans-serif')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .attr('x', (d) => (d.x0 < width / 2 ? d.x1 + 6 : d.x0 - 6))
        .attr('y', (d) => (d.y1 + d.y0) / 2)
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => (d.x0 < width / 2 ? 'start' : 'end'))
        .text((d) => d.name)
        .append('tspan')
        .attr('fill-opacity', 0.7)
        .text((d) => `${d.value ? d.value.toLocaleString() : ''}`);
    };

    createParallelSets();
    return () => {
      // Cleanup function
      svg.selectAll('*').remove();
    };
  }, [parallelSetsData]);

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} id="parallelsets-container" style={{ position: 'relative' }}/>
      <div ref={tooltipRef}
        style={{
          position: 'absolute',
          zIndex: 1,
          backgroundColor: '#555',
          color: '#fff',
          textAlign: 'center',
          borderRadius: '6px',
          padding: '5px',
          transition: 'opacity 0.3s',
          //opacity: selectedNode ? 1 : 0.4,
          //top: selectedNode ? selectedNode.y0 : 0,
          //left: selectedNode ? selectedNode.x1 + 10 : 0,
        }}
      />
    </div>  
  );
};

export default ParallelSets;


