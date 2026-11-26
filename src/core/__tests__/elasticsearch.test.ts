import {
  createQueryDslQueryContainer,
  populateFilters,
  parseSort,
  asciiFold,
  padZero,
  sortAlphabetically,
  SearchFilters
} from '../elasticsearch';
import { SortCombinations } from '@elastic/elasticsearch/lib/api/types';

describe('Elasticsearch Query Building & Search Utilities', () => {
  describe('Helper Functions', () => {
    it('strips accents and special characters with asciiFold', () => {
      expect(asciiFold('Acórdão')).toBe('Acordao');
      expect(asciiFold('Secção')).toBe('Seccao');
      expect(asciiFold('Jurisprudência')).toBe('Jurisprudencia');
      expect(asciiFold('1.ª Secção')).toBe('1.a Seccao');
    });

    it('pads zero numbers correctly', () => {
      expect(padZero(5, 4)).toBe('0005');
      expect(padZero(42, 4)).toBe('0042');
      expect(padZero(1234, 4)).toBe('1234');
      expect(padZero(99999, 4)).toBe('99999');
    });

    it('sorts strings alphabetically ignoring leading quotes/punctuation', () => {
      expect(sortAlphabetically('«Acórdão»', 'Decisão')).toBeGreaterThan(0);
      expect(sortAlphabetically('A', 'B')).toBeLessThan(0);
      expect(sortAlphabetically('B', 'A')).toBeGreaterThan(0);
      expect(sortAlphabetically('Mesmo', 'Mesmo')).toBe(0);
    });
  });

  describe('Query DSL Container (createQueryDslQueryContainer)', () => {
    it('returns match_all for empty queries', () => {
      expect(createQueryDslQueryContainer('')).toEqual({ match_all: {} });
      expect(createQueryDslQueryContainer(undefined)).toEqual({ match_all: {} });
      expect(createQueryDslQueryContainer([])).toEqual({ match_all: {} });
    });

    it('builds exact phrase query for fully-quoted strings', () => {
      const result = createQueryDslQueryContainer('"responsabilidade civil"');
      expect(Array.isArray(result)).toBe(true);
      const query = (result as any[])[0];

      expect(query.query_string).toBeDefined();
      expect(query.query_string.query).toBe('"responsabilidade civil"');
      expect(query.query_string.phrase_slop).toBe(0);
      expect(query.query_string.fields).toEqual(["Texto", "Sumário", "CONTENT", "*.Index"]);
    });

    it('preserves explicit boolean operators (AND, OR, NOT)', () => {
      const result = createQueryDslQueryContainer('burla AND qualificada NOT simples');
      const query = (result as any[])[0];

      expect(query.query_string).toBeDefined();
      expect(query.query_string.query).toBe('burla AND qualificada NOT simples');
    });

    it('builds boosted phrase + individual should clauses for multi-word queries', () => {
      const result = createQueryDslQueryContainer('contrato empreitada');
      const query = (result as any[])[0];

      expect(query.bool).toBeDefined();
      expect(query.bool.should).toBeDefined();
      expect(query.bool.should.length).toBe(3); // 1 boosted phrase + 2 words
      expect(query.bool.minimum_should_match).toBe(1);
    });
  });

  describe('Search Filters Population (populateFilters)', () => {
    it('populates date range filters for MinDate and MaxDate', () => {
      const filters: SearchFilters = { pre: [], after: [] };
      const body = {
        MinDate: '2023-01-15',
        MaxDate: '2024-12-31'
      };

      const used = populateFilters(filters, body, ['MinDate', 'MaxDate']);

      expect(used.MinDate).toEqual(['2023-01-15']);
      expect(used.MaxDate).toEqual(['2024-12-31']);
      expect(filters.after.length).toBe(1);
      const rangeFilter = (filters.after[0] as any).range.Data;
      expect(rangeFilter.gte).toBe('15/01/2023');
      expect(rangeFilter.lte).toBe('31/12/2024');
    });

    it('handles presence filters (hasField, mustHaveText, notHasField)', () => {
      const filters: SearchFilters = { pre: [], after: [] };
      const body = {
        mustHaveText: 'true',
        hasField: 'Sumário',
        notHasField: 'ECLI'
      };

      populateFilters(filters, body);

      expect(filters.pre.length).toBe(3);
      // Check exists for notHasField (index 0)
      expect((filters.pre[0] as any).bool.must_not.exists.field).toBe('ECLI');
      // Check exists for hasField (index 1)
      expect((filters.pre[1] as any).bool.must.exists.field).toBe('Sumário');
      // Check exists for mustHaveText (index 2)
      expect((filters.pre[2] as any).bool.must.exists.field).toBe('Texto');
    });

    it('matches both Secção and Área when filtering Secção by Formação or Conflitos', () => {
      const filters: SearchFilters = { pre: [], after: [] };
      populateFilters(filters, { Secção: ['Formação', 'or:Conflitos'] });

      expect(filters.pre.length).toBe(1);
      const serialized = JSON.stringify(filters.pre[0]);
      expect(serialized).toContain('Secção.Index.raw');
      expect(serialized).toContain('Área.Index.raw');
      expect(serialized).toContain('Formação');
      expect(serialized).toContain('Tribunal de Conflitos');
    });
  });

  describe('Sorting Parser (parseSort)', () => {
    it('parses descending date sort as default ("des")', () => {
      const array: SortCombinations[] = [];
      const result = parseSort('des', array);

      expect(result).toBe('des');
      expect(array).toEqual([{ Data: { order: 'desc' } }]);
    });

    it('parses ascending date sort ("asc")', () => {
      const array: SortCombinations[] = [];
      const result = parseSort('asc', array);

      expect(result).toBe('asc');
      expect(array).toEqual([{ Data: { order: 'asc' } }]);
    });

    it('parses score relevance sort ("score")', () => {
      const array: SortCombinations[] = [];
      const result = parseSort('score', array);

      expect(result).toBe('score');
      expect(array).toEqual([
        { _score: { order: 'desc' } },
        { Data: { order: 'desc' } }
      ]);
    });
  });
});
