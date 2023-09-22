type ChartType = 'matrix' | 'areachart' | 'parallelsets' | 'stackedbar';

type ParallelSetsDataSource = ParallelSetsDataAgg[];

interface ParallelSetsDataAgg {
  doc_count: number;
  key: string[];
  key_as_string: string;
}

interface MatrixAggregationBucket {
    doc_count: number;
    key: string;
    matrix: {
      buckets: Array<{
        doc_count: number;
        key: string;
      }>;
    };
}
  
interface MatrixDataSource {
    matrix: {
      doc_count_error_upper_bound: number;
      sum_other_doc_count: number;
      buckets: Array<MatrixAggregationBucket & { key: string }>;
    };
}

interface Bucket {
    key: string;
    doc_count: number;
  }
  
interface StackedBarDataSource {
    //doc_count_error_upper_bound: number;
    //sum_other_doc_count: number;
    //buckets: Bucket[];
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  [key: string]: any;
}  

interface MiniLayoutPreviewProps {
  layout: LayoutItem[];
  getVisualizationColor: (key: string) => string;
} 