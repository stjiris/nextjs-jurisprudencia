import React, { useState, useEffect } from 'react';

interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date';
  options?: { key: string; label: string }[];
}

interface AdvancedFiltersProps {
  filters: Record<string, string>;
  onFiltersChange: (filters: Record<string, string>) => void;
}

const AVAILABLE_FILTERS: FilterField[] = [
  { key: 'Área', label: 'Área', type: 'select', options: [
    { key: 'Civil', label: 'Civil' },
    { key: 'Penal', label: 'Penal' },
    { key: 'Administrativo', label: 'Administrativo' },
    { key: 'Constitucional', label: 'Constitucional' },
    { key: 'Social', label: 'Social' }
  ]},
  { key: 'Decisão', label: 'Decisão', type: 'select', options: [
    { key: 'Acordão', label: 'Acordão' },
    { key: 'Despacho', label: 'Despacho' },
    { key: 'Acórdão', label: 'Acórdão' }
  ]},
  { key: 'Secção', label: 'Secção', type: 'text' },
  { key: 'Relator Nome Profissional', label: 'Relator', type: 'text' },
  { key: 'Meio Processual', label: 'Meio Processual', type: 'text' }
];

export default function AdvancedFilters({ filters, onFiltersChange }: AdvancedFiltersProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<Record<string, string>>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleFilterChange = (key: string, value: string) => {
    const newFilters = { ...localFilters };
    if (value) {
      newFilters[key] = value;
    } else {
      delete newFilters[key];
    }
    setLocalFilters(newFilters);
  };

  const applyFilters = () => {
    onFiltersChange(localFilters);
  };

  const clearFilters = () => {
    setLocalFilters({});
    onFiltersChange({});
  };

  const renderFilterInput = (field: FilterField) => {
    const value = localFilters[field.key] || '';

    switch (field.type) {
      case 'select':
        return (
          <select
            className="form-select"
            value={value}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
          >
            <option value="">Selecione...</option>
            {field.options?.map(option => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        );
      
      case 'date':
        return (
          <input
            type="date"
            className="form-control"
            value={value}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
          />
        );
      
      default:
        return (
          <input
            type="text"
            className="form-control"
            placeholder={`Digite ${field.label.toLowerCase()}...`}
            value={value}
            onChange={(e) => handleFilterChange(field.key, e.target.value)}
          />
        );
    }
  };

  const activeFiltersCount = Object.keys(localFilters).filter(key => localFilters[key]).length;

  return (
    <div className="card mb-4" style={{
      background: '#f8fafc',
      borderRadius: 12,
      border: '1px solid #e2e8f0'
    }}>
      <div className="card-header bg-transparent border-0 d-flex justify-content-between align-items-center">
        <h6 className="mb-0" style={{ fontWeight: 600, color: '#222' }}>
          Filtros Avançados
          {activeFiltersCount > 0 && (
            <span className="badge bg-primary ms-2">{activeFiltersCount}</span>
          )}
        </h6>
        <button
          className="btn btn-sm btn-outline-primary"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Ocultar' : 'Mostrar'} Filtros
        </button>
      </div>
      
      {showFilters && (
        <div className="card-body">
          <div className="row g-3">
            {AVAILABLE_FILTERS.map(field => (
              <div key={field.key} className="col-md-6 col-lg-4">
                <label className="form-label mb-1" style={{ fontWeight: 500, fontSize: '0.9em' }}>
                  {field.label}
                </label>
                {renderFilterInput(field)}
              </div>
            ))}
          </div>
          
          <div className="d-flex gap-2 mt-3">
            <button
              className="btn btn-primary"
              onClick={applyFilters}
            >
              Aplicar Filtros
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={clearFilters}
            >
              Limpar Todos
            </button>
          </div>
          
          {activeFiltersCount > 0 && (
            <div className="mt-3">
              <small className="text-muted">
                Filtros ativos: {Object.entries(localFilters)
                  .filter(([_, value]) => value)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(', ')}
              </small>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 