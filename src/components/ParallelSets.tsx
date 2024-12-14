import React, { useEffect, useRef, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import ResizeObserver from 'resize-observer-polyfill'; 
import { updateTooltipPosition } from '@/pages/dashboard';
import { select } from 'd3-selection'
import { scaleOrdinal } from 'd3-scale';


type DynamicDataAgg = {
  [key: string]: string | number;
};

interface SankeyNodeData {
  [key: string]: string | number;
}

interface SankeyLinkData {
  [key: string]: string | number;
}

const ParallelSets = ({ parallelSetsData, onDataSelect }: {parallelSetsData: ParallelSetsDataSource, onDataSelect: any}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  //const height = 720 - margin.top - margin.bottom;
  const containerWidthRef = useRef(containerWidth);
  const containerHeightRef = useRef(containerHeight);
  const height = 600;
  const [selectedNode, setSelectedNode] = useState(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleResize = (entries: ResizeObserverEntry[]) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      containerWidthRef.current = width;
      containerHeightRef.current = height;
    }
  };
  useEffect(() => {
    const containerElement = document.getElementById("parallelsets-container") as Element;
    const observer = new ResizeObserver(handleResize); // Use the function as the callback
    observer.observe(containerElement);
  
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const container = select(svgRef.current!);
    const width = container.node()!.clientWidth;

    let data: DynamicDataAgg[] = parallelSetsData.map(entry => {
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

      return Number(b.value) - Number(a.value);
    });
    const svg = select(svgRef.current)
    .attr("viewBox", [0, 0, width, height]);
    // Create the parallel sets chart
    const createParallelSets = () => {
      const level0Values: Set<string> = new Set();
      data.forEach((item) => level0Values.add(item.level0.toString()));
      const color = scaleOrdinal(Array.from(level0Values), [
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
      ]);
      const keys = fieldOrder.slice(0, -1);

      const handleMousemove = (event: MouseEvent, d: any) => {
        setSelectedNode(d);
        const tooltipNode = tooltipRef.current;
        if (tooltipNode) {
          // Show tooltip
          select(tooltipNode).style('opacity', 1).html(
            `<strong>${d.names.join(' → ')}</strong><pt />${d.value ? d.value.toLocaleString() : ''}`
          );
          updateTooltipPosition(tooltipNode, event, "parallelsets-container");
        }  
      };
      
    
      const handleMouseout = () => {
        setSelectedNode(null);
    
        // Reset highlighting
        svg.selectAll('.link').attr('opacity', 0.2);
        svg.selectAll('.node').attr('opacity', 1);
    
        // Hide tooltip
        select(tooltipRef.current).style('opacity', 0).style('opacity', 0);
    
      };

      const handleClick = (event: MouseEvent, d: any) => {
        onDataSelect(d.names);
      }
      const sankeyGenerator = sankey<SankeyNodeData, SankeyLinkData>()
        .nodeSort(() => 0)
        .linkSort(() => 0)
        .nodeWidth(4)
        .nodePadding(10)
        .extent([[0, 5], [width, height - 5]]);

      const graph = (data : DynamicDataAgg[]) => {
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
            const value = Number(d.value) || 1; // Ensure value is always a number
      
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
        nodes: graphData.nodes.map(d => ({ ...d })),
        links: graphData.links.map(d => ({ ...d }))
      });
      const nodeElements = svg
        .append('g')
        .selectAll('rect')
        .data(nodes)
        .join('rect')
        .attr('x', (d) => d.x0 ?? 0)
        .attr('y', (d) => d.y0 ?? 0)
        .attr('height', (d) => (d.y1 ?? 0) - (d.y0 ?? 0))
        .attr('width', (d) => (d.x1 ?? 0) - (d.x0 ?? 0))
        .attr('fill', '#69b3a2')
        .attr('opacity', 0.8);

        const linkElements = svg.append('g')
        .attr('fill', 'none')
        .selectAll('g')
        .data(links)
        .join('path')
        .attr('d', sankeyLinkHorizontal())
        .attr('stroke', (d) => color(Array.isArray(d.names) ? d.names[0] : d.names))
        .attr('stroke-width', (d) => d.width  ?? 0)
        .style('mix-blend-mode', 'multiply')
        .on('mousemove', handleMousemove)
        .on('mouseout', handleMouseout)
        .on('click', handleClick);

        const textElements = svg
        .append('g')
        .style('font', '10px sans-serif')
        .selectAll('text')
        .data(nodes)
        .join('text')
        .attr('x', (d) => (d.x0 !== undefined ? (d.x0 < width / 2 ? d.x1! + 6 : d.x0 - 6) : 0))
        .attr('y', (d) => (d.y1 !== undefined && d.y0 !== undefined ? (d.y1 + d.y0) / 2 : 0))
        .attr('dy', '0.35em')
        .attr('text-anchor', (d) => (d.x0 !== undefined && d.x0 < width / 2 ? 'start' : 'end'))
        .text((d) => (d.name !== undefined ? d.name : ''))
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
           className="tooltip"
      />
    </div>  
  );
};

export default ParallelSets;


