// @ts-nocheck
import React, { useLayoutEffect } from "react";

import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { GenericPageWithForm } from "@/components/genericPageStructure";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import Script from "next/script";
import { FormProps, withForm } from "@/components/pageWithForm";
import { useRouter } from "next/router";
import {Terms} from "@/components/SelectTerm";
import ParallelSetsChart from "@/components/ParallelSets";
import MatrixChart from "@/components/Matrix";
import AreaChart from "@/components/AreaChart";
import StackedBarChart from "@/components/StackedBar";


const ResponsiveGridLayout = WidthProvider(Responsive);

export const getServerSideProps = withForm<FormProps>(async (ctx, formProps) => {
  
  return {
    ...formProps,
  }
  
});
const MiniLayoutPreview = ({ layout, getVisualizationColor }) => {
  const totalColumns = layout.reduce((maxX, item) => Math.max(maxX, item.x + item.w), 0);
  const totalRows = layout.reduce((maxY, item) => Math.max(maxY, item.y + item.h), 0);

  const squareWidth = 30 / totalColumns;
  const squareHeight = 30 / totalRows;

  // Check if all visualizations start at the same x position
  const allStartAtSameX = layout.every((item, index, arr) => item.x === arr[0].x);

  if (allStartAtSameX) {
    return (
      <div className="mini-layout-preview">
        <div
          className="layout-preview-grid"
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {layout.map((item, index) => (
            <div
              key={item.i}
              style={{
                backgroundColor: getVisualizationColor(item.i),
                width: `${item.w * squareWidth}px`,
                height: `${item.h * squareHeight}px`,
                margin: '2px',
                cursor: 'pointer',
              }}
            />
          ))}
        </div>
      </div>
    );
  } else {
    const firstHalf = layout.slice(0, Math.ceil(layout.length / 2));
    const secondHalf = layout.slice(Math.ceil(layout.length / 2));

    return (
      <div className="mini-layout-preview">
        <div
          className="layout-preview-grid"
          style={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div className="grid-row" style={{ display: 'flex' }}>
            {firstHalf.map((item, index) => (
              <div
                key={item.i}
                style={{
                  backgroundColor: getVisualizationColor(item.i),
                  width: `${item.w * squareWidth}px`,
                  height: `${item.h * squareHeight}px`,
                  margin: '2px',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <div className="grid-row" style={{ display: 'flex' }}>
            {secondHalf.map((item, index) => (
              <div
                key={item.i}
                style={{
                  backgroundColor: getVisualizationColor(item.i),
                  width: `${item.w * squareWidth}px`,
                  height: `${item.h * squareHeight}px`,
                  margin: '2px',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }
};



export default function Dashboard(props: FormProps){
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [visualizationInstances, setVisualizationInstances] = useState([]);
  const availableVisualizationKeys = [
    { key: "matrix", color: "lightgreen" },
    { key: "parallelsets", color: "lightgray" },
    { key: "areachart", color: "lightcoral" },
    { key: "stackedbar", color: "lightblue" },
  ];

  const getVisualizationColor = (key) => {
    // Check if the key starts with the specified cases
    if (key.startsWith("stackedbar")) {
      return "lightblue";
    } else if (key.startsWith("matrix")) {
      return "lightgreen";
    } else if (key.startsWith("parallelsets")) {
      return "lightgray";
    } else if (key.startsWith("areachart")) {
      return "lightcoral";
    } else {
      return "white";
    }
  };
  

  const handleContainerResize = (width: number, height: number) => {
    setContainerWidth(width);
    setContainerHeight(height);
  };

  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState<number>(0);

  const layouts = [
    // Layout 1
    [
      { i: "parallelsets", x: 0, y: 0, w: 9, h:(2/3)* 8, minH: 3},
      { i: "stackedbar", x: 0, y: 9 , w: 10, h: 4, minH: 4},
      { i: "areachart", x: 0, y: 12, w: 9, h: 5, minH: 5 },
      { i: "matrix", x: 0, y: 18, w: 10, h: 4, minH: 3},
    ],
    [
      { i: "parallelsets", x: 0, y: 0, w: 7, h: 5, minH: 3 },
      { i: "stackedbar", x: 7, y: 0, w: 7, h: 4,  minH: 4 },
      { i: "matrix", x: 0, y: 12, w: 4, h: 3, minH: 3 },
      { i: "areachart", x: 4, y: 6, w: 9, h: 5, minH: 5  },
    ],
    [
      { i: "stackedbar", x: 0, y: 0, w: 5, h: 5, minH: 4 },
      { i: "areachart", x: 5, y: 0, w: 9, h: 5, minH: 5  },
      { i: "parallelsets", x: 0, y: 6, w: 6, h: 5, minH: 3  },
      { i: "matrix", x: 6, y: 6, w: 6, h: 5, minH: 3 },
    ],
    /*[
      { i: "matrix", x: 0, y: 0, w: 9, h: 7 },
    ],
    [
      { i: "parallelsets", x: 0, y: 0, w: 8, h: 7 },
    ],
    [
      { i: "areachart", x: 0, y: 0, w: 9, h: 7 },
    ],
    [
      { i: "stackedbar", x: 0, y: 0, w: 9, h: 7 },
    ],*/
  ];      

  const addNewVisualizationInstance = (visualizationKey) => {
    // Generate a unique key for the new visualization instance
    const uniqueKey = `${visualizationKey}_${visualizationInstances.length}`;

    // Add visualization instance to the layout
    setLayout((prevLayout) => [
      ...prevLayout,
      {
        i: uniqueKey,
        x: 0,
        y: 0,
        w: 7,
        h: 5,
        minH: 3 
      },
    ]);

    // Add the new visualization instance to the visualizationInstances array
    setVisualizationInstances((prevInstances) => [...prevInstances, uniqueKey]);
  };

  const removeVisualizationInstance = (visualizationKey) => {
    setLayout((prevLayout) => prevLayout.filter((item) => item.i !== visualizationKey));

    setVisualizationInstances((prevInstances) =>
      prevInstances.filter((key) => key !== visualizationKey)
    );
  };

  const handleAddVisualization = (selectedVisualizationKey) => {
    if (selectedVisualizationKey) {
      addNewVisualizationInstance(selectedVisualizationKey);
    }
  };

  const selectedLayout = layouts[selectedLayoutIndex];
  const [layout, setLayout] = React.useState(selectedLayout); 

  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 15, md: 10, sm: 6, xs: 4, xxs: 2 };

  const onLayoutChange = (newLayout) => {
    setLayout(newLayout);
  };

  const handleLayoutChange = (index) => {
    setSelectedLayoutIndex(index);
    setLayout(layouts[index]);
  };
  const [screenWidth, setScreenWidth] = useState(0);

  // Update the screenWidth state on window resize
  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };

    setScreenWidth(window.innerWidth);

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <GenericPageWithForm {...props}>
      <Head>
            <title>Jurisprudência STJ - Dashboard</title>
            <meta name="description" content="Permite explorar, pesquisar e filtrar os acórdãos publicados pelo Supremo Tribunal de Justiça na DGSI.pt." />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <link rel="icon" href="/favicon.ico" />
      </Head>
      <Script src="https://cdn.plot.ly/plotly-2.12.1.min.js" />
      <div>
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <label htmlFor="visualizationDropdown" className="me-2">
              Adicionar visualização:
            </label>
            <select
              id="visualizationDropdown"
              className="form-select"
              onChange={(e) => handleAddVisualization(e.target.value)}
            >
              <option value="" disabled>Escolher</option>
              {availableVisualizationKeys.map(({ key, color }) => (
                <option
                  key={key}
                  value={key}
                  style={{ backgroundColor: color, color: "white" }} // Apply the background color and set the text color to white
                >
                  {key}
                </option>
              ))}
            </select>
          </div>
          <div className="layout-selector" style={{ display: 'flex' }} >
            {layouts.map((layout, index) => (
              <div
                key={index}
                className={`layout-item ${selectedLayoutIndex === index ? 'selected' : ''}`}
                onClick={() => handleLayoutChange(index)}
              >
                <div style={{ display: 'inline-block', margin: '10px' }}>
                  <MiniLayoutPreview layout={layout} getVisualizationColor={getVisualizationColor} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={breakpoints}
          cols={cols}
          width={1600}
          onLayoutChange={onLayoutChange}
          draggableHandle=".drag-handle"
          resizableHandle=".resize-handle"
          //rowHeight={rowHeight}
        >
          {layout.map((item) => (
            <div
              key={item.i}
              className="visualization-frame"
              style={{
                border: '2px solid #ccc',
                boxShadow: '0 0 5px rgba(0, 0, 0, 0.2)',
                gridColumn: `${item.x + 1} / span ${item.w}`,
                gridRow: `${item.y + 1} / span ${item.h}`, 
              }}
            >
              <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }}>
              <button onClick={() => addNewVisualizationInstance(item.i)} className="btn btn-primary">
                  <i className="bi bi-files"></i>
                </button>
                <button onClick={() => removeVisualizationInstance(item.i)} className="btn btn-danger">
                  <i className="bi bi-trash"></i>
                </button>
              </div>
              <div
                className="drag-handle"
                style={{ background: getVisualizationColor(item.i), fontWeight: 'bold', color: 'transparent' }}
              >
                Arrastar
              </div>
              {item.i.startsWith('matrix') && <Matrix {...props} />}
              {item.i.startsWith('parallelsets') && <ParallelSets {...props}/>}
              {item.i.startsWith('areachart') && <Area {...props} />}
              {item.i.startsWith('stackedbar') && <StackedBar {...props} />}
            </div>
          ))}
        </ResponsiveGridLayout>
      </div>
    </GenericPageWithForm>  
  );
};
  

function ParallelSets(props: IndicesPageProps){
    let router = useRouter()
    let searchParams = useSearchParams(); 
    let [parallelSetsData, setParallelSetsData] = useState([]); 
    const [numOfFields, setNumOfFields] = useState(3);
    const [numOfAggregations, setNumOfAggregations] = useState(50); 
    const [selectedTerms, setSelectedTerms] = useState(["Área", "Secção", "Meio Processual", "Decisão", "Votação", "Relator Nome Profissional", "Tribunal de Recurso", "Descritores", "Área Temática"]);


    useEffect(() => {
        let abort = new AbortController();
        const queryParams = new URLSearchParams(searchParams);
        queryParams.set('numOfFields', String(numOfFields));
        queryParams.set('numOfAggregations', String(numOfAggregations));
        queryParams.set('terms', selectedTerms.join(','));
        fetch(`${router.basePath}/api/parallelsets?${queryParams.toString()}`, {signal: abort.signal})
    
          .then(response => {
            if (response.status === 200) {
              return response.json();
            } else {
                return Promise.resolve({});
            }
          })
          .then(data => {
            if (data.aggs && data.aggs.buckets) {
              setParallelSetsData(data.aggs.buckets);
            } else {
              setParallelSetsData([]);
            }
          })
          .catch(error => {
            console.log(error);
          });
    },[searchParams, router.basePath, numOfFields, numOfAggregations, selectedTerms])
    const boxWidth = `calc((100% - ${(numOfFields - 1) * 8}px) / ${numOfFields})`;
    const containerStyle = { margin: "0 8px", overflow: 'hidden' };

    return  (
        <div style={containerStyle}>
          <div>
            <div>
              <input
                type="range"
                min="2"
                max="10"
                value={numOfFields}
                onChange={(event) => setNumOfFields(parseInt(event.target.value, 10))}
              />
              <span>{numOfFields}</span>
            </div>
            <div>
            <select value={numOfAggregations} onChange={(event) => setNumOfAggregations(parseInt(event.target.value, 10))}>
              <option value="20">20</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="150">150</option>
              <option value="10000">Todos</option>
            </select>
          <div style={{ display: "flex" }}>
            {Array.from({ length: numOfFields }, (_, index) => (
              <div key={index} style={{ width: boxWidth, marginLeft: index > 0 ? "8px" : "0" }}>
                <select
                  value={selectedTerms[index]}
                  onChange={(event) => {
                    const newSelectedTerms = [...selectedTerms];
                    newSelectedTerms[index] = event.target.value;
                    setSelectedTerms(newSelectedTerms);
                  }}
                >
                  <Terms/>
                </select>
              </div>
            ))}
          </div>
          </div>
            {parallelSetsData.length > 0 && (<div style={{ flex: 1, marginLeft: "25px", marginRight: "25px" }}>
              <ParallelSetsChart 
                parallelSetsData={parallelSetsData} 
                numOfFields={numOfFields} 
                numOfAggregations={numOfAggregations}
              />
            </div>
            )}
          </div>   
        </div>     
      );
}

function Matrix(props: IndicesPageProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [matrixData, setMatrixData] = useState({});
    const [selectedTermMatrix1, setSelectedTermMatrix1] = useState("Área");
    const [selectedTermMatrix2, setSelectedTermMatrix2] = useState("Secção");
    const wrapperRef = useRef(null);
 
    useEffect(() => {
      let abort = new AbortController();
      const queryParams = new URLSearchParams(searchParams);
      queryParams.set('termMatrix1', selectedTermMatrix1);
      queryParams.set('termMatrix2', selectedTermMatrix2);
      fetch(`${router.basePath}/api/matrix?${queryParams.toString()}`, { signal: abort.signal })
        .then(response => {
          if (response.status === 200) {
            return response.json();
          } else {
            return Promise.resolve({});
          }
        })
        .then(setMatrixData)
        .catch(error => {
          console.log(error);
        });
    }, [searchParams, router.basePath, selectedTermMatrix1, selectedTermMatrix2]);
  
    return (
      <div style={{ overflow: 'hidden'}}>
        <select value={selectedTermMatrix1} onChange={(event) => setSelectedTermMatrix1(event.target.value)}>
          <Terms/>
        </select>

        <select value={selectedTermMatrix2} onChange={(event) => setSelectedTermMatrix2(event.target.value)}>
          <Terms/>
        </select>
          {Object.keys(matrixData).length > 0 && <MatrixChart data={matrixData} />}
      </div>
    );
}

function Area(props: IndicesPageProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [AreaChartData, setAreaChartData] = useState({});
  const [selectedTermAreaChart, setSelectedTermAreaChart] = useState("Área");  

  const dashboardContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let abort = new AbortController();
    const queryParams = new URLSearchParams(searchParams);
    queryParams.set('termAreaChart', selectedTermAreaChart);
    fetch(`${router.basePath}/api/areachart?${queryParams.toString()}`, { signal: abort.signal })
      .then(response => {
        if (response.status === 200) {
          return response.json();
        } else {
          return Promise.resolve({});
        }
      })
      .then(setAreaChartData)
      .catch(error => {
        console.log(error);
      });
  }, [searchParams, router.basePath, selectedTermAreaChart]);

  return (
    <div ref={dashboardContainerRef} style={{ overflow: 'hidden' }} >
      <div style={{ position: 'relative'}}>
          <select
            value={selectedTermAreaChart}
            onChange={(event) => setSelectedTermAreaChart(event.target.value)}
            style={{ position: 'relative', top: '0', right: '0', margin: '16px' }}
          >
            <Terms/>
          </select>
        </div>
        {Object.keys(AreaChartData).length > 0 && (
        <AreaChart
          data={AreaChartData}
        />
      )}
    </div>
  );
} 

function StackedBar (props: IndicesProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [stackedBarData, setStackedBarData] = useState({});

  useEffect(() => {
    let abort = new AbortController();
    const queryParams = new URLSearchParams(searchParams);
    fetch(`${router.basePath}/api/stackedbar?${queryParams.toString()}`, { signal: abort.signal })
      .then(response => {
        if (response.status === 200) {
          return response.json();
        } else {
          return Promise.resolve({});
        }
      })
      .then(setStackedBarData)
      .catch(error => {
        // Handle error if necessary
        console.log(error);
      });
  }, [searchParams, router.basePath]);

  return (
    <div>
        {Object.keys(stackedBarData).length > 0 && <StackedBarChart sData={stackedBarData} />}
    </div>
  );
}



