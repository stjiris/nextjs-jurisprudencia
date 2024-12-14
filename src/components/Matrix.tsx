 import React, { useEffect, useRef, useState } from 'react';
import { scaleSequential } from 'd3-scale';
import { select, selectAll } from 'd3-selection'
import { max } from 'd3-array'
import { interpolateReds } from 'd3-scale-chromatic';

interface CellData {
  source: string;
  target: string;
  x: number;
  y: number;
  w: number;
  h: number;
  value?: number
}
const cellSize: number = 40;

type MatrixLayoutFn = {
  (sourceNodes: string[], targetNodes: string[], sourceMatrix: number[][]): any[];
};  
const layout: MatrixLayoutFn = (sourceNodes, targetNodes, sourceMatrix) => {
  const rowCount = sourceNodes.length;
  const colCount = targetNodes.length;
  const resultMatrix = [];
  for (let s = 0; s < rowCount; s++) {
    for (let t = 0; t < colCount; t++) {
      const v = sourceMatrix[s][t];
      const rect = {
        x: t * cellSize,
        y: s * cellSize,
        w: cellSize,
        h: cellSize
      };
      if (v > 0) {
        const source = sourceNodes[s];
        const target = targetNodes[t];
        const edge = { source, target, value: v, ...rect};
        resultMatrix.push(Object.assign(edge));
      } else {
        resultMatrix.push(Object.assign(rect));
      }
    }
  }
  return resultMatrix;
}

const highlight = (d: { target: { __data__: CellData; }; }) => {
    const data = d.target.__data__;
    selectAll<SVGElement, CellData>('.cell')
    .filter(function(k) {
      const cellData = select(this).datum() as CellData;
      return !(cellData.x === data.x || cellData.y === data.y);
    })
      .style("opacity", .3);

  selectAll('text.source')
    .style("fill", function(_, i) {
      const text = select(this).text();
      return text === data.source ? "black" : "grey";
    });

  // Highlight target text
  selectAll('text.target')
    .style("fill", function(_, i) {
      const text = select(this).text();
      return text === data.target ? "black" : "grey";
    });
  };
  

const fade = (d: any) => {
    selectAll(".cell, text.source, text.target").style("opacity", 1).style("font-weight", "normal").style("font-size", "100%").style("fill", "black").style("stroke-width", 0);
    select('.tooltip').style("opacity", 0);
}

const MatrixChart = ( { data, onDataSelect }: { data: any,  onDataSelect: any } ) => {
  const svgRef = useRef(null);
  const chartRef = useRef(null);
  const reorderMatrixByCount = (matrixData: MatrixAggregationBucket[]) => {
    if (!matrixData || matrixData.length === 0) {
      return [[], [], []]; 
    }
    
    const terms1 = matrixData
      .map((bucket) => ({ key: bucket.key, count: bucket.doc_count }))
      .sort((a, b) => b.count - a.count)
      .map((bucket) => bucket.key);
  
    const allBuckets = matrixData.flatMap((bucket) => bucket.matrix.buckets);
  
    const terms2 = Array.from(new Set(allBuckets.map((bucket) => bucket.key)))
      .sort((a, b) => {
        const countA = allBuckets.find((bucket) => bucket.key === a)?.doc_count || 0;
        const countB = allBuckets.find((bucket) => bucket.key === b)?.doc_count || 0;
        return countB - countA;
      });
  
    const x: number[][] = [];
    terms1.forEach((term1) => {
      const row: number[] = [];
  
      terms2.forEach((term2) => {
        const bucket = matrixData.find(
          (b) => b.key === term1 && b.matrix.buckets.find((bucket) => bucket.key === term2)
        );
  
        const docCount = bucket ? bucket.matrix.buckets.find((bucket) => bucket.key === term2)?.doc_count || 0 : 0;
  
        row.push(docCount);
      });
  
      x.push(row);
    });
  
    return [terms1, terms2, x];
  };
  
  const reorderMatrixByName = (matrixData: MatrixAggregationBucket[]) => {
    if (!matrixData || matrixData.length === 0) {
      return [[], [], []];
    }
    const terms1 = matrixData
      .map((bucket: { key: string; }) => bucket.key)
      .sort((a: string, b: string) => {
        if (a.startsWith('sem') && !b.startsWith('sem')) return 1;
        if (!a.startsWith('sem') && b.startsWith('sem')) return -1;
        if (a.startsWith('«') && !b.startsWith('«')) return 1;
        if (!a.startsWith('«') && b.startsWith('«')) return -1;
        return a.localeCompare(b);
      });
  
    const allBuckets = matrixData.flatMap((bucket: { matrix: { buckets: any; }; }) => bucket.matrix.buckets);
  
    const terms2 = Array.from(new Set(allBuckets.map((bucket: { key: any; }) => bucket.key))).sort((a, b) => {
      if (a.startsWith('sem') && !b.startsWith('sem')) return 1;
      if (!a.startsWith('sem') && b.startsWith('sem')) return -1;
      if (a.startsWith('«') && !b.startsWith('«')) return 1;
      if (!a.startsWith('«') && b.startsWith('«')) return -1;
      return a.localeCompare(b);
    });
  
    const x: number[][] = [];
    terms1.forEach((term1: any) => {
      const row: number[] = [];
  
      terms2.forEach((term2) => {
        const bucket = matrixData.find((b) => b.key === term1 && b.matrix.buckets.find((bucket) => bucket.key === term2));

        const docCount = bucket?.matrix.buckets.find((bucket) => bucket.key === term2)?.doc_count || 0;
    
        row.push(docCount);
      });
  
      x.push(row);
    });
  
    return [terms1, terms2, x];
  };
  
  
  const [reorderFunction, setReorderFunction] = useState(() => reorderMatrixByCount);
  const handleReorderCount = () => {
    setReorderFunction(() => reorderMatrixByCount);
  };

  const handleReorderName = () => {
    setReorderFunction(() => reorderMatrixByName);
  };

  const getButtonStyle = (buttonType: { (matrixData: any): any[]; (matrixData: any): any[]; (matrixData: any): any[]; }) => {
    return {
      padding: '8px',
      backgroundColor: 'lightgray',
      color: reorderFunction === buttonType ? 'black' : 'black',
      border: 'none',
      cursor: 'pointer',
      marginRight: '10px',
    };
  };
  useEffect(() => {
    const margin = { top: 200, right: 50, bottom: 50, left: 200 };
    const svg = select(svgRef.current);
    if (!data || !data.matrix|| !data.matrix.buckets) {
      console.error('Invalid data format');
      return;
    }

    const matrixData = data.matrix.buckets;
    if (!Array.isArray(matrixData)) {
      console.error('Invalid matrix data format');
      return;
    }

    const [terms1, terms2, x] = reorderFunction(matrixData) as [string[], string[], number[][]];;

    const rowCount = terms1.length;
    const colCount = terms2.length;
    const chartW = colCount * cellSize;
    const chartH = rowCount * cellSize;
    const resultdata = layout(terms1, terms2, x);
    const color = scaleSequential(interpolateReds)
    .domain([0,max(resultdata, d => d.value)]);

    svg.attr("width", chartW + margin.left + margin.right)
    .attr("height", chartH + margin.top + margin.bottom);

    const chart = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top})`);

    const tooltip = svg.append("g")
    .attr("class", 'tooltip')
    .style("opacity", 0)
    .style("pointer-events", 'none');

    tooltip.append("rect")
        .style("fill", 'white')
        .style("stroke", 'black');
    tooltip.append("text")
        .style("fill", 'black')
        .style("text-anchor", "middle")
        .style("dominant-baseline", "central");
    const cell = chart.selectAll("g.cell")
        .data(resultdata)
        .join("g")
        .attr("class", "cell")
        .attr("transform", (d) => `translate(${[d.x, d.y]})`);

        cell.append("rect")
        .attr("height", (d) => d.h * 0.95)
        .attr("width", (d) => d.w * 0.95)
        .style("fill", (d) => (d.value ? color(d.value) : "white"))
        .on("mouseover", highlight)
        .on("mouseout", fade);

    cell.append("text")
        .attr("class", "value")
        .attr("x", (d) => d.w / 2)
        .attr("y", (d) => d.h / 2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .style("fill", "black")
        .style("opacity", 0)
        .text((d) => (d.value ? d.value : 0));
      
      cell.on("mouseover", function () {
        select(this).raise();
        select(this).select("text.value").style("opacity", 1);
      });
      
      cell.on("mouseout", function () {
        select(this).select("text.value").style("opacity", 0);
      });

      cell.on("click", function () {
        const dataArray: any = select(this).selectAll("text.value").data()[0];
         
        if (dataArray.source && dataArray.target) {
          const sourceValue = dataArray.source;
          const targetValue = dataArray.target;
          onDataSelect(sourceValue, targetValue);
        }
      });

    // Add clip-path for text truncation
    chart
      .append('defs')
      .selectAll('clipPath')
      .data(resultdata.filter((d: { x: number; }) => d.x === 0))
      .enter()
      .append('clipPath')
      .attr('id', (d, i) => `clip-source-${i}`)
      .append('rect')
      .attr('x', - margin.left)
      .attr('width', margin.left)
      .attr('height', cellSize * rowCount)

    chart
      .selectAll('text.source')
      .data(resultdata.filter((d: { x: number; }) => d.x === 0))
      .enter()
      .append('text')
      .attr('class', 'source')
      .attr('y', (d) => d.y + d.h / 2 + 5)
      .attr('x', - margin.left + 10)
      .attr('text-anchor', 'start')
      .text((d, i) => terms1[i])
      .attr('clip-path', (d, i) => `url(#clip-source-${i})`)
      .append('title')
      .text((d, i) => terms1[i])

    chart.selectAll('text.target')
      .data(resultdata.filter((d: { y: number; }) => d.y == 0))
      .enter()
      .append("text")
      .attr("class",'target')
      .attr("transform", (d, i) => `translate(${d.x + 2}, ${-10}) rotate(-90)`)
      .attr("text-anchor", "start")
      .attr("dominant-baseline", "text-before-edge")
      .text((d,i) => terms2[i])
      .append('title')
      .text((d, i) => terms2[i]); ;

    tooltip.append("rect")
        .style("fill", 'white')
        .style("stroke", 'black');
    tooltip.append("text");

    return () => {
        svg.selectAll(".cell").remove();
        svg.selectAll("text.source").remove();
        svg.selectAll("text.target").remove();
        svg.selectAll(".cell").remove();
        svg.selectAll("text.source").remove();
        svg.selectAll("text.target").remove();
    }; 
  }, [data, reorderFunction]);

  return <div>
    <button onClick={handleReorderCount} className="apply-button">
        Ordenar por contagem
    </button>
    <button onClick={handleReorderName} className="apply-button">
        Ordenar alfabéticamente
    </button>
    <div ref={chartRef} >
      <svg ref={svgRef} />
    </div>  
</div>
};

export default MatrixChart;

