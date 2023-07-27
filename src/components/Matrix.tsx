// @ts-nocheck 
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';

const adjacencyMatrix = () => {
    let w = 1, h = 1, value = 1;
  
    function layout(sourceNodes: string | any[], targetNodes: string | any[], sourceMatrix: any[][]) {
      const rowCount = sourceNodes.length;
      const colCount = targetNodes.length;
      const cellSize = 20; //Math.max(w / colCount , w / rowCount);
      //console.log(cellSize);
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
            const edge = { source, target, value: v };
            resultMatrix.push(Object.assign(edge, rect));
          } else {
            resultMatrix.push(Object.assign({}, rect));
          }
        }
      }
      return resultMatrix;
    }
  
    layout.size = function (array: (string | number)[]) {
      return arguments.length ? (w = +array[0], h = +array[1], layout) : [w, h];
    }
    //layout.size = function (array) {
    //  return arguments.length ? (w = h = Math.min(+array[0], +array[1]), layout) : [w, h];
    //}
  
    return layout;
}

const highlight = (d: { target: { __data__: any; }; }) => {
    const data = d.target.__data__;
    d3.selectAll('.cell').filter(k => !(k.x === data.x || k.y === data.y)).style("opacity", .3);
  //d3.selectAll('.cell').filter(k => k.x === data.x || k.y === data.y).style("stroke", "black").style("stroke-width", 0.5);
  // Highlight source text
  d3.selectAll('text.source')
    .style("fill", function(_, i) {
      const text = d3.select(this).text();
      return text === data.source ? "black" : "grey";
    });

  // Highlight target text
  d3.selectAll('text.target')
    .style("fill", function(_, i) {
      const text = d3.select(this).text();
      return text === data.target ? "black" : "grey";
    });
  };
  

const fade = (d: any) => {
    d3.selectAll(".cell, text.source, text.target").style("opacity", 1).style("font-weight", "normal").style("font-size", "100%").style("fill", "black").style("stroke-width", 0);
    d3.select('.tooltip').style("opacity", 0);
}

const MatrixChart = ({ data }) => {
  const svgRef = useRef(null);
  const chartRef = useRef(null);
  const rowCount = data.matrix.buckets.length;
  const colCount = data.matrix.buckets[0].matrix.buckets.length;
  const cellSize = 30;
  const [chartWidth, setChartWidth] = useState(colCount * cellSize);
  const [chartHeight, setChartHeight] = useState(rowCount * cellSize);
  const reorderMatrixByCount = (matrixData: any[]) => {
    if (!matrixData || matrixData.length === 0) {
      return [[], [], []]; 
    }
    
    const terms1 = matrixData
      .map((bucket: { key: any; matrix: { doc_count: any; }; }) => ({ key: bucket.key, count: bucket.matrix.doc_count }))
      .sort((a: { count: number; }, b: { count: number; }) => b.count - a.count)
      .map((bucket: { key: any; }) => bucket.key);
  
    const allBuckets = matrixData.flatMap((bucket: { matrix: { buckets: any; }; }) => bucket.matrix.buckets);
  
    const terms2 = Array.from(new Set(allBuckets.map((bucket: { key: any; }) => bucket.key)))
      .sort((a, b) => {
        const countA = allBuckets.filter((bucket: { key: unknown; }) => bucket.key === a)[0].doc_count;
        const countB = allBuckets.filter((bucket: { key: unknown; }) => bucket.key === b)[0].doc_count;
        return countB - countA;
      });
  
    const x: any[][] = [];
    terms1.forEach((term1: any) => {
      const row: any[] = [];
  
      terms2.forEach((term2) => {
        const bucket = matrixData.find(
          (b: { key: any; matrix: { buckets: any[]; }; }) => b.key === term1 && b.matrix.buckets.find((bucket: { key: unknown; }) => bucket.key === term2)
        );
  
        const docCount = bucket ? bucket.matrix.buckets.find((bucket: { key: unknown; }) => bucket.key === term2).doc_count : 0;
  
        row.push(docCount);
      });
  
      x.push(row);
    });
    
    return [terms1, terms2, x];
  };
  

  const reorderMatrixByName = (matrixData: any[]) => {
    if (!matrixData || matrixData.length === 0) {
      return [[], [], []];
    }
  
    const terms1 = matrixData
      .map((bucket: { key: any; }) => bucket.key)
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
  
    const x: any[][] = [];
    terms1.forEach((term1: any) => {
      const row: any[] = [];
  
      terms2.forEach((term2) => {
        const bucket = matrixData.find(
          (b: { key: any; matrix: { buckets: any[]; }; }) => b.key === term1 && b.matrix.buckets.find((bucket: { key: unknown; }) => bucket.key === term2)
        );
  
        const docCount = bucket ? bucket.matrix.buckets.find((bucket: { key: unknown; }) => bucket.key === term2).doc_count : 0;
  
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
    const svg = d3.select(svgRef.current);

    if (!data || !data.matrix || !data.matrix.buckets) {
      console.error('Invalid data format');
      return;
    }

    const matrixData = data.matrix.buckets;
    if (!Array.isArray(matrixData)) {
      console.error('Invalid matrix data format');
      return;
    }

    const [terms1, terms2, x] = reorderFunction(matrixData);

    const rowCount = terms1.length;
    const colCount = terms2.length;
    // Calculate the height based on the number of rows and other factors
    const cellSize = 30;
    const chartW = colCount * cellSize;
    const chartH = rowCount * cellSize;
    const matrix = adjacencyMatrix().size([chartW, chartH]);
    const resultdata = matrix(terms1, terms2, x);
    const color = d3.scaleSequential(d3.interpolateReds)
    .domain([0,d3.max(resultdata, d => d.value)]);

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
        d3.select(this).raise();
        d3.select(this).select("text.value").style("opacity", 1);
      });
      
      cell.on("mouseout", function () {
        d3.select(this).select("text.value").style("opacity", 0);
      });

    // Add clip-path for text truncation
    chart
      .append('defs')
      .selectAll('clipPath')
      .data(resultdata.filter((d) => d.x === 0))
      .enter()
      .append('clipPath')
      .attr('id', (d, i) => `clip-source-${i}`)
      .append('rect')
      .attr('x', - margin.left)
      .attr('width', margin.left)
      .attr('height', cellSize * rowCount)

    chart
      .selectAll('text.source')
      .data(resultdata.filter((d) => d.x === 0))
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

  return     <div ref={chartRef} style={{ width: '100%', height: '100%' }} >
    <button onClick={handleReorderCount} style={getButtonStyle(reorderMatrixByCount)}>
        Ordenar por contagem
    </button>
    <button onClick={handleReorderName} style={getButtonStyle(reorderMatrixByName)}>
        Ordenar alfabéticamente
    </button>
  <svg ref={svgRef} />
</div>
};

export default MatrixChart;
