import React, { createContext, useContext } from "react";

import RGL, { Layout, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { GenericPageWithForm } from "@/components/genericPageStructure";
import { useEffect, useRef, useState } from "react";
import ReactResizeDetector from 'react-resize-detector';
import { useSearchParams } from "next/navigation";
import Head from "next/head";
import Script from "next/script";
import { FormProps, withForm } from "@/components/pageWithForm";
import { NextRouter, Router, useRouter } from "next/router";
import {DahboardTerms, Terms} from "@/components/SelectTerm";
import ParallelSetsChart from "@/components/ParallelSets";
import MatrixChart from "@/components/Matrix";
import AreaChart from "@/components/AreaChart";
import StackedBarChart from "@/components/StackedBar";
import "@/types/dashboard"
import { debounce } from "debounce";

// Define the type for selected filters
type SelectedFilters = string[];

// Create a context
const SelectedFiltersContext = createContext<{ 
  selectedFilters: SelectedFilters;
  setSelectedFilters: React.Dispatch<React.SetStateAction<SelectedFilters>>;
  removeFilter: (filter: string) => void;
  applyFilters: () => void;
} | undefined>(undefined);  

// Create a provider component
export function SelectedFiltersProvider({ children }: { children: React.ReactNode }) {
  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>([]);
  const router = useRouter();
  let searchParams = useSearchParams(); 
  const removeFilter = (filter: string) => {
    setSelectedFilters((prevFilters) =>
      prevFilters.filter((prevFilter) => prevFilter !== filter)
    );
  };

  const applyFilters = () => {
    const currentSearchParams = new URLSearchParams(searchParams.toString());
    selectedFilters.forEach((filter) => {
      const [key, value] = filter.split(":");
      currentSearchParams.append(key, value);
    });

    router.replace({ search: currentSearchParams.toString() });
    setSelectedFilters([]);
  };

  return (
    <SelectedFiltersContext.Provider
      value={{ selectedFilters, setSelectedFilters, removeFilter, applyFilters }}
    >
      {children}
    </SelectedFiltersContext.Provider>
  );
}

// Custom hook to access the context
export function useSelectedFilters() {
  const context = useContext(SelectedFiltersContext);
  if (context === undefined) {
    throw new Error('useSelectedFilters must be used within a SelectedFiltersProvider');
  }
  return context;
}

function SelectedFiltersBox() {
  const { selectedFilters, removeFilter, applyFilters } = useSelectedFilters();

  const handleRemoveFilter = (filter: string) => {
    removeFilter(filter); // Call the removeFilter function to remove a filter
  };

  const handleApplyFilters = () => {
    applyFilters(); // Call the applyFilters function to apply the selected filters
  };

  return (
    <div className="selected-filters-box">
      <div className="filter-container">
        {selectedFilters.map((filter, index) => (
          <div key={index} className="filter-box">
            {filter}
            <button onClick={() => handleRemoveFilter(filter)}>X</button>
          </div>
        ))}
      </div>
      {selectedFilters.length > 0 ? (
        <button className="apply-button" onClick={handleApplyFilters}>
          Aplicar estes filtros à pesquisa global
        </button>
      ) : (
        <p>Não há filtros adicionais selecionados.</p>
      )}
    </div>
  );
};

export default function Dashboard(props: FormProps){
  /*function useLocalStorage(key: string, initialValue: LayoutItem[]) {
    const [storedValue, setStoredValue] = useState(() => {
      try {
        // Get from local storage by key
        const item = window.localStorage.getItem(key);
        // Parse stored json or return initialValue if null
        return item ? JSON.parse(item) : initialValue;
      } catch (error) {
        // If error occurs, return initialValue
        console.error('Error reading from localStorage:', error);
        return initialValue;
      }
    });
  
    // Update the local storage whenever the state changes
    useEffect(() => {
      try {
        // Serialize the state to JSON and store it in local storage
        window.localStorage.setItem(key, JSON.stringify(storedValue));
      } catch (error) {
        console.error('Error writing to localStorage:', error);
      }
    }, [key, storedValue]);
  
    return [storedValue, setStoredValue];
  } */
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(0);
  const [visualizationInstances, setVisualizationInstances] = useState<string[]>([]);
  const originalLayout = initialLayouts[0];
  const [layout, setLayout] = useState(originalLayout);

  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState<number>(0);

  const numColumns = 12;

  useEffect(() => {
    // Retrieve the layout from local storage when the component mounts
    const savedLayout = localStorage.getItem('layout');
    if (savedLayout) {
      setLayout(JSON.parse(savedLayout)); // Parse the JSON string
    }
  }, []);

  const addNewVisualizationInstance = (visualizationKey: string, targetVisualization?: string) => {
    // Generate a unique key for the new visualization instance
    const uniqueKey = `${visualizationKey}_${visualizationInstances.length}`;

    const newVisualizationInstance = {
      i: uniqueKey,
      x: 0,
      y: 0,
      w: 7,
      h: 5,
      minH: 3,
      moved: false,
      static: false
    };
  
  if (targetVisualization) {
    // If a targetVisualization is provided, add the new visualization next to it
    const targetIndex = layout.findIndex((item: LayoutItem) => item.i === targetVisualization);
    if (targetIndex !== -1) {
      layout.splice(targetIndex + 1, 0, newVisualizationInstance);
    }
  } else {
    // If no targetVisualization is provided, add the new visualization to the top
    layout.unshift(newVisualizationInstance);
  }

  setLayout([...layout]);
  setLayouts((prevLayouts: any) => {
    const updatedLayouts = [...prevLayouts];
    (updatedLayouts[selectedLayoutIndex] as LayoutItem[]) = [
      newVisualizationInstance,
      ...(updatedLayouts[selectedLayoutIndex] as LayoutItem[]),
    ];
    return updatedLayouts;
  });

  // Add the new visualization instance to the visualizationInstances array at the beginning
  setVisualizationInstances((prevInstances) => [uniqueKey, ...prevInstances]);

  };

  const removeVisualizationInstance = (visualizationKey: string) => {
    setLayout((prevLayout: LayoutItem[]) => prevLayout.filter((item: LayoutItem) => item.i !== visualizationKey));

    setVisualizationInstances((prevInstances) =>
      prevInstances.filter((key) => key !== visualizationKey)
    );
  };

  const handleAddVisualization = (selectedVisualizationKey: string) => {
    if (selectedVisualizationKey) {
      addNewVisualizationInstance(selectedVisualizationKey);
    }
  };
  

  const selectedLayout = initialLayouts[selectedLayoutIndex];
  const [layouts, setLayouts] = useState(() => getFromLS('layouts') || []);

  useEffect(() => {
    saveToLS('layouts', layouts);
  }, [layouts]);

  const isMobile = containerWidth < 768;

  const handleLayoutChange = (index: number) => {
    setSelectedLayoutIndex(index);
    setLayout(initialLayouts[index]);
  };

  const handleContainerResize = (width: number | undefined, height: number | undefined) => {
    if (width !== undefined && height !== undefined) {
      setContainerWidth(width);
      setContainerHeight(height);
    }
  };

  const handleRemoveVisualization = (visualizationKey: string) => {
  const confirmRemove = window.confirm("Deseja remover?");
  if (confirmRemove) {
    removeVisualizationInstance(visualizationKey);
  }
};

  return (
    <div ref={containerRef}>
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
                defaultValue=""
              >
                <option value="" disabled>Escolher</option>
                {availableVisualizationKeys.map(({ key, label, color }) => (
                  <option
                    key={key}
                    value={key}
                    style={{ backgroundColor: color, color: "white" }} // Apply the background color and set the text color to white
                  >
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="layout-selector" style={{ display: 'flex' }} >
              {initialLayouts.map((layout, index) => (
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
          <SelectedFiltersProvider>
            <div className="sticky-filters">
              <SelectedFiltersBox />
            </div>  
              <ReactResizeDetector 
              handleWidth 
              handleHeight onResize={handleContainerResize}>
                <div>
                  <ReactGridLayout
                    className="layout"
                    layout={selectedLayout}
                    cols={numColumns}
                    rowHeight={150}
                    width={containerWidth}
                  >
                    {layout.map((item: LayoutItem) => (
                      <div
                        key={item.i}
                        className={`visualization-frame ${isMobile ? 'mobile' : ''}`}
                      >                 
                        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1 }}>
                            <button onClick={() => addNewVisualizationInstance(item.i, item.i)} className="btn btn-primary">
                              <i className="bi bi-files"></i>
                            </button>
                            <button onClick={() => handleRemoveVisualization(item.i)} className="btn btn-danger">
                              <i className="bi bi-trash"></i>
                            </button>
                        </div>
                        <div
                          className="drag-handle"
                          style={{
                            background: getVisualizationColor(item.i),
                            fontWeight: 'bold',
                            //color: 'transparent',
                          }}
                        >
                          {`${getLabelForItem(item.i)}`}
                        </div>
                        
                        {item.i.startsWith('matrix') && <Matrix/>}
                        {item.i.startsWith('parallelsets') && <ParallelSets layout/>}
                        {item.i.startsWith('areachart') && <Area layout/>}
                        {item.i.startsWith('stackedbar') && <StackedBar layout />}
                        {!isMobile && (
                          <div
                            className="resize-handle"
                            style={{
                              background: getVisualizationColor(item.i)
                            }}
                          >
                          </div>  
                        )}      
                      </div>
                    ))}
                  </ReactGridLayout>
                </div>
              </ReactResizeDetector>
          </SelectedFiltersProvider> 
        </div>  
      </GenericPageWithForm> 
    </div>  
  );
};
  

function ParallelSets(layout: any){
    let router = useRouter();
    let searchParams = useSearchParams(); 
    const { selectedFilters, setSelectedFilters } = useSelectedFilters();
    let [parallelSetsData, setParallelSetsData] = useState([]); 
    const initialNumOfFields = router.query.numOfFields
      ? parseInt(router.query.numOfFields.toString(), 10)
      : 3;
    const [numOfFields, setNumOfFields] = useState(initialNumOfFields);
    const initialNumOfAggregations = router.query.numOfAggregations
      ? parseInt(router.query.numOfAggregations.toString(), 10)
      : 50
    const [numOfAggregations, setNumOfAggregations] = useState(initialNumOfAggregations); 
    const defaultTerms = ["Área", "Secção", "Meio Processual",  "Descritores", "Votação", "Relator Nome Profissional"];
    const initialTerms = typeof router.query.terms === 'string' ? router.query.terms.split(',') : defaultTerms;
    const [selectedTerms, setSelectedTerms] = useState(initialTerms);

    const handleDataSelect = (values: string[]) => {
      const filterStrings: string[] = [];
      for (let i = 0; i < values.length; i++) {
        const filterString = `${selectedTerms[i]}:${values[i]}`;
        filterStrings.push(filterString);
      }  
      if (filterStrings.every((filterString) => selectedFilters.includes(filterString))) {
        setSelectedFilters((prevFilters) =>
          prevFilters.filter((filter) => !filterStrings.includes(filter))
        );
      } else {
        setSelectedFilters((prevFilters) => [...prevFilters, ...filterStrings]);
      }
    }
    
    const decrementNumOfFields = () => {
      if (numOfFields > 2) {
        setNumOfFields(numOfFields - 1);
      }
    };
  
    const incrementNumOfFields = () => {
      if (numOfFields < 6) {
        setNumOfFields(numOfFields + 1);
      }
    };
    useEffect(() => {
      // Get the current URL search params
      const queryParams = new URLSearchParams(searchParams.toString());
      queryParams.set('numOfFields', String(numOfFields));
      queryParams.set('numOfAggregations', String(numOfAggregations));
      queryParams.set('terms', selectedTerms.join(','));
      router.push(
        {
          pathname: router.pathname,
          query: queryParams.toString(),
        },
        undefined,
        {
          shallow: true,
        }
      );

    }, [selectedTerms, numOfFields, numOfAggregations]);
    useEffect(() => {
        const queryParams = new URLSearchParams(searchParams.toString());
        selectedFilters.forEach((filter) => {
          const [key, value] = filter.split(':');
          queryParams.append(key, value);
        });
        queryParams.set('numOfFields', String(numOfFields));
        queryParams.set('numOfAggregations', String(numOfAggregations));
        queryParams.set('terms', selectedTerms.join(','));
        getVisualizationData("parallelsets", queryParams, router)
          .then(data => {
            if (data.aggs && data.aggs.buckets) {
              setParallelSetsData(data.aggs.buckets);
            } else {
              setParallelSetsData([]);
            }
          });
        
    },[searchParams, router.basePath, numOfFields, numOfAggregations, selectedTerms, layout, selectedFilters])
    const boxWidth = `calc((100% - ${(numOfFields - 1) * 8}px) / ${numOfFields})`;
    const containerStyle = { margin: "0 8px", overflow: 'hidden' };

    return  (
        <div style={containerStyle}>
          <div>
            <div>
              <span> Número de índices a agrupar </span>
              <button className="apply-button" onClick={decrementNumOfFields} style={{ padding: '3px 3px',  height: '24px' }} >-</button>
              <span className="visible-span">{numOfFields}</span>
              <button className="apply-button" onClick={incrementNumOfFields} style={{ padding: '3px 3px',  height: '24px'  }} >+</button>
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
                  <DahboardTerms/>
                </select>
              </div>
            ))}
          </div>
          </div>
            {parallelSetsData.length > 0 && (<div style={{ flex: 1, marginLeft: "25px", marginRight: "25px" }}>
              <ParallelSetsChart 
                parallelSetsData={parallelSetsData} onDataSelect={handleDataSelect}
              />
            </div>
            )}
          </div>   
        </div>     
      );
}

function Matrix() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { selectedFilters, setSelectedFilters } = useSelectedFilters();
    const [matrixData, setMatrixData] = useState({});
    const [selectedTermMatrix1, setSelectedTermMatrix1] = useState((router.query.termMatrix1 || "Área") as string);
    const [selectedTermMatrix2, setSelectedTermMatrix2] = useState((router.query.termMatrix2 || "Secção") as string);
    const [selected1, setSelected1] = useState("");
    const [selected2, setSelected2] = useState("");

    const handleDataSelect = (term1: string, term2: string) => {
      setSelected1(term1);
      setSelected2(term2);
      const filterStrings = [`${selectedTermMatrix1}:${term1}`, `${selectedTermMatrix2}:${term2}`];
      if (filterStrings.every((filterString) => selectedFilters.includes(filterString))) {
        // All filter strings are already selected, remove them
        setSelectedFilters((prevFilters) =>
          prevFilters.filter((filter) => !filterStrings.includes(filter))
        );
      } else {
        // At least one filter string is not selected, add them
        setSelectedFilters((prevFilters) => [...prevFilters, ...filterStrings]);
      }
    } 
    useEffect(() => {
      // Get the current URL search params
      const queryParams = new URLSearchParams(window.location.search);

      // Set or update the 'termMatrix1' and 'termMatrix2' parameters
      queryParams.set('termMatrix1', selectedTermMatrix1);
      queryParams.set('termMatrix2', selectedTermMatrix2);

      router.push(
        {
          pathname: router.pathname,
          query: queryParams.toString(),
        },
        undefined,
        {
          shallow: true,
        }
      );
    }, [selectedTermMatrix1, selectedTermMatrix2]); 
    useEffect(() => {
      const queryParams = new URLSearchParams(searchParams.toString());
      selectedFilters.forEach((filter) => {
        const [key, value] = filter.split(':');
        queryParams.append(key, value);
      });
      queryParams.set('termMatrix1', selectedTermMatrix1);
      queryParams.set('termMatrix2', selectedTermMatrix2);
      getVisualizationData("matrix", queryParams, router)
        .then((data) => {
          setMatrixData(data);
        });
    }, [searchParams, router.basePath, selectedTermMatrix1, selectedTermMatrix2, selected1, selected2, selectedFilters]);

  
    return (
      <div style={{ overflow: 'hidden'}}>
        <select value={selectedTermMatrix1} onChange={(event) => setSelectedTermMatrix1(event.target.value)}>
          <DahboardTerms/>
        </select>

        <select value={selectedTermMatrix2} onChange={(event) => setSelectedTermMatrix2(event.target.value)}>
          <DahboardTerms/>
        </select>
          {Object.keys(matrixData).length > 0 && 
          <MatrixChart data={matrixData} onDataSelect={handleDataSelect}/>}
      </div>
    );
}

function Area(layout: any) {
  const router = useRouter();
  const { selectedFilters, setSelectedFilters } = useSelectedFilters();
  const searchParams = useSearchParams();
  const [AreaChartData, setAreaChartData] = useState({});
  const [selectedTermAreaChart, setSelectedTermAreaChart] = useState(router.query.termAreaChart || "Área");  
  const [selected, setSelected] = useState("");
  const dashboardContainerRef = useRef<HTMLDivElement>(null)
  const handleDataSelect = (term: string, value: string) => {
    setSelected(term);
    const filterString = `${selectedTermAreaChart}:${term}`;

    if (selectedFilters.includes(filterString)) {
      setSelectedFilters((prevFilters) =>
        prevFilters.filter((filter) => !filterString.includes(filter))
      );
    } else {
      setSelectedFilters((prevFilters) => [...prevFilters, filterString]);
    }

  };
  useEffect(() => {
    const queryParams = new URLSearchParams(searchParams.toString());

    queryParams.set('termAreaChart', selectedTermAreaChart as string);
    router.push(
      {
        pathname: router.pathname,
        query: queryParams.toString(),
      },
      undefined,
      {
        shallow: true,
      }
    );
  }, [selectedTermAreaChart]);
  useEffect(() => {
    const queryParams = new URLSearchParams(searchParams.toString());
    selectedFilters.forEach((filter) => {
      const [key, value] = filter.split(':');
      queryParams.append(key, value);
    });


    getVisualizationData("areachart", queryParams, router)
      .then((data) => {
        setAreaChartData(data);
      });
      
  }, [searchParams, router.basePath, selectedTermAreaChart, selected, layout, selectedFilters]);


  
  return (
    <div ref={dashboardContainerRef} style={{ overflow: 'hidden' }} >
      <div style={{ position: 'relative'}}>
          <select
            value={selectedTermAreaChart}
            onChange={(event) => setSelectedTermAreaChart(event.target.value)}
            style={{ position: 'relative', top: '0', right: '0', margin: '16px' }}
          >
            <DahboardTerms/>
          </select>
        </div>
        {Object.keys(AreaChartData).length > 0 && (
        <AreaChart
          data={AreaChartData} term={selectedTermAreaChart} onDataSelect={handleDataSelect}
        />
      )}
    </div>
  );
} 

function StackedBar (layout: any) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedFilters, setSelectedFilters } = useSelectedFilters();
  const [stackedBarData, setStackedBarData] = useState({});
  const [selectedTerm, setSelectedTerm] = useState("");  
  const [selected, setSelected] = useState("");
  const handleDataSelect = (term: string, value: string) => {
    setSelectedTerm(term);
    setSelected(value);
    const filterString = `${term}:${value}`;

    if (selectedFilters.includes(filterString)) {
      setSelectedFilters((prevFilters) =>
        prevFilters.filter((filter) => !filterString.includes(filter))
      );
    } else {
      setSelectedFilters((prevFilters) => [...prevFilters, filterString]);
    }
  };
  useEffect(() => {
    const queryParams = new URLSearchParams(searchParams.toString());
    selectedFilters.forEach((filter) => {
      const [key, value] = filter.split(':');
      queryParams.append(key, value);
    });

    getVisualizationData("stackedbar", queryParams, router)
        .then((data) => {
          setStackedBarData(data);
    });
  }, [searchParams, router.basePath, selected, layout, selectedFilters]);

  return (
    <div style={{ overflow: 'hidden' }}> 
        {Object.keys(stackedBarData).length > 0 && <StackedBarChart sData={stackedBarData} onDataSelect={handleDataSelect}/>}
    </div>
  );
}

const getFromLS = (key: string) => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  }  catch (error) {}
};

const saveToLS = debounce((key: string, value: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("Error saving to local storage:", error);
  }
}, 300);

const ReactGridLayout = WidthProvider(RGL);

export const getServerSideProps = withForm<FormProps>(async (ctx, formProps) => {
  
  return {
    ...formProps,
  }
  
});

const initialLayouts = [
  [  
    { i: "parallelsets", x: 0, y: 0, w: 10, h: 6, minH: 3},
    { i: "stackedbar", x: 0, y: 9 , w: 10, h: 2, minH: 2},
    { i: "areachart", x: 0, y: 12, w: 10, h: 5, minH: 2 },
    { i: "matrix", x: 0, y: 18, w: 10, h: 4},
  ],
  [
    { i: "parallelsets", x: 0, y: 0, w: 6, h: 5, minH: 3 },
    { i: "stackedbar", x: 7, y: 0, w: 6, h: 2,  minH: 2 },
    { i: "matrix", x: 6, y: 3, w: 6, h: 3},
    { i: "areachart", x: 0, y: 6, w: 12, h: 5, minH: 2  },
  ],
  [
    { i: "stackedbar", x: 0, y: 0, w: 5, h: 2, minH: 2 },
    { i: "areachart", x: 5, y: 0, w: 7, h: 5, minH: 2 },
    { i: "parallelsets", x: 0, y: 6, w: 6, h: 5, minH: 3 },
    { i: "matrix", x: 6, y: 6, w: 6, h: 5 },
  ],
]; 

const availableVisualizationKeys = [
  { key: "matrix", label: "Matriz", color: "lightgreen" },
  { key: "parallelsets", label: "Diagrama de conjuntos paralelos", color: "lightgray" },
  { key: "areachart", label: "Gráfico de área empilhada", color: "lightcoral" },
  { key: "stackedbar", label: "Gráfico de barras empilhadas", color: "lightblue" },
];

function getLabelForItem(key: string) {
  const matchingKey = availableVisualizationKeys.find(vis => key.startsWith(vis.key));
  return matchingKey ? matchingKey.label : "Unknown";
}

const getVisualizationColor = (key: string) => {
  const matchingKey = availableVisualizationKeys.find(vis => key.startsWith(vis.key));
  return matchingKey ? matchingKey.color : "white";
};

const MiniLayoutPreview = ({ layout, getVisualizationColor }: MiniLayoutPreviewProps) => {
  const totalColumns = layout.reduce((maxX: number, item: { x: any; w: any; }) => Math.max(maxX, item.x + item.w), 0);
  const totalRows = layout.reduce((maxY: number, item: { y: any; h: any; }) => Math.max(maxY, item.y + item.h), 0);

  const squareWidth = 30 / totalColumns;
  const squareHeight = 30 / totalRows;

  // Check if all visualizations start at the same x position
  const allStartAtSameX = layout.every((item: { x: any; }, index: any, arr: { x: any; }[]) => item.x === arr[0].x);

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
          {layout.map((item: { i: string; w: number; h: number; }, index: any) => (
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
            {firstHalf.map((item: { i: string; w: number; h: number; }, index: any) => (
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
            {secondHalf.map((item: { i: string; w: number; h: number; }, index: any) => (
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



export const updateTooltipPosition = (tooltipNode: HTMLElement, event: MouseEvent, containerId: string) => {
  const containerElement = document.getElementById(containerId);
  if (containerElement) {
    const containerRect = containerElement.getBoundingClientRect();

    const tooltipWidth = tooltipNode.offsetWidth;
    const tooltipHeight = tooltipNode.offsetHeight;

    // Calculate the maximum allowable X and Y positions considering both container and viewport dimensions
    const maxX = containerRect.width - tooltipWidth;
    const maxY = containerRect.height - tooltipHeight;

    const x = Math.min(
      Math.max(event.clientX - containerRect.left - tooltipWidth, 0),
      maxX
    );
    const y = Math.min(
      Math.max(event.clientY - containerRect.top - tooltipHeight, 0),
      maxY
    );
    tooltipNode.style.fontSize = '10px';  
    tooltipNode.style.left = `${x}px`;
    tooltipNode.style.top = `${y}px`;
    tooltipNode.style.opacity = '1';
  }
};


export function getTextWidth(text: string, fontSize: string = "9px"): number {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const textElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
  textElement.textContent = text;
  textElement.style.fontSize = fontSize;

  svg.appendChild(textElement);
  document.body.appendChild(svg);

  const width = textElement.getComputedTextLength();

  document.body.removeChild(svg);

  return width;
}

function getVisualizationData(
  chartType: ChartType,
  searchParams: URLSearchParams,
  router: NextRouter
): Promise<any> {
  let abort = new AbortController();
  const apiUrl = `${router.basePath}/api/${chartType}?${searchParams.toString()}`;
  return fetch(apiUrl, { signal: abort.signal })
    .then((response) => {
      if (response.status === 200) {
        return response.json();
      } else {
        return Promise.resolve({});
      }
    })
    .catch((error) => {
      console.log(error);
      return Promise.resolve({});
    });
}
