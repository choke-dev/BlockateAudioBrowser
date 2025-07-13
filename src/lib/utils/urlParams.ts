import { browser } from '$app/environment';
import { goto, replaceState } from '$app/navigation';
import { z } from 'zod';

export interface FilterData {
  filters: { label: string; value: string; inputValue: string }[];
  type: "and" | "or";
}

export interface SortData {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchParams {
  query?: string;
  page?: number;
  filters?: FilterData | null;
  sort?: SortData | null;
}

// Validation schemas
const FilterSchema = z.object({
  label: z.string().min(1).max(50),
  value: z.enum(['category', 'whitelisterName', 'name', 'id']),
  inputValue: z.string().max(100)
});

const FilterDataSchema = z.object({
  filters: z.array(FilterSchema).max(10), // Limit to 10 filters
  type: z.enum(['and', 'or'])
});

const SortDataSchema = z.object({
  field: z.enum(['id', 'name', 'category', 'created_at']),
  order: z.enum(['asc', 'desc'])
});

const QuerySchema = z.string().max(100);
const PageSchema = z.number().int().min(1).max(1000);

/**
 * Read search parameters from the current URL with validation
 */
export function readSearchParams(): SearchParams {
  if (!browser) return {};
  
  const url = new URL(window.location.href);
  const params: SearchParams = {};
  
  // Read and validate query
  const query = url.searchParams.get('q');
  if (query) {
    try {
      const decoded = decodeURIComponent(query);
      const validated = QuerySchema.parse(decoded);
      params.query = validated;
    } catch (e) {
      console.warn('Invalid query parameter:', e);
    }
  }
  
  // Read and validate page
  const page = url.searchParams.get('page');
  if (page) {
    try {
      const pageNum = parseInt(page);
      const validated = PageSchema.parse(pageNum);
      params.page = validated;
    } catch (e) {
      console.warn('Invalid page parameter:', e);
    }
  }
  
  // Read and validate filters
  const filtersParam = url.searchParams.get('filters');
  if (filtersParam) {
    try {
      const decoded = decodeURIComponent(filtersParam);
      const parsed = JSON.parse(decoded);
      const validated = FilterDataSchema.parse(parsed);
      params.filters = validated;
    } catch (e) {
      console.warn('Invalid filters parameter:', e);
    }
  }
  
  // Read and validate sort
  const sortParam = url.searchParams.get('sort');
  if (sortParam) {
    try {
      const decoded = decodeURIComponent(sortParam);
      const parsed = JSON.parse(decoded);
      const validated = SortDataSchema.parse(parsed);
      params.sort = validated;
    } catch (e) {
      console.warn('Invalid sort parameter:', e);
    }
  }
  
  return params;
}

/**
 * Update URL parameters without triggering navigation with validation
 */
export function updateSearchParams(params: SearchParams, shouldReplaceState = true) {
  if (!browser) return;
  
  const url = new URL(window.location.href);
  
  // Clear existing search params
  url.searchParams.delete('q');
  url.searchParams.delete('page');
  url.searchParams.delete('filters');
  url.searchParams.delete('sort');
  
  // Validate and set query
  if (params.query && params.query.trim()) {
    try {
      const validated = QuerySchema.parse(params.query.trim());
      url.searchParams.set('q', encodeURIComponent(validated));
    } catch (e) {
      console.warn('Invalid query for URL:', e);
    }
  }
  
  // Validate and set page (only if not page 1)
  if (params.page && params.page > 1) {
    try {
      const validated = PageSchema.parse(params.page);
      url.searchParams.set('page', validated.toString());
    } catch (e) {
      console.warn('Invalid page for URL:', e);
    }
  }
  
  // Validate and set filters
  if (params.filters && params.filters.filters.length > 0) {
    try {
      const validated = FilterDataSchema.parse(params.filters);
      const filtersJson = JSON.stringify(validated);
      url.searchParams.set('filters', encodeURIComponent(filtersJson));
    } catch (e) {
      console.warn('Invalid filters for URL:', e);
    }
  }
  
  // Validate and set sort
  if (params.sort) {
    try {
      const validated = SortDataSchema.parse(params.sort);
      const sortJson = JSON.stringify(validated);
      url.searchParams.set('sort', encodeURIComponent(sortJson));
    } catch (e) {
      console.warn('Invalid sort for URL:', e);
    }
  }
  
  // Update URL
  const newUrl = url.toString();
  if (newUrl !== window.location.href) {
    if (shouldReplaceState) {
      replaceState(newUrl, '');
    } else {
      goto(newUrl, { replaceState: false, noScroll: true });
    }
  }
}

/**
 * Create a shareable URL with current search parameters with validation
 */
export function createShareableUrl(params: SearchParams): string {
  if (!browser) return '';
  
  const url = new URL(window.location.origin + window.location.pathname);
  
  // Validate and set query
  if (params.query && params.query.trim()) {
    try {
      const validated = QuerySchema.parse(params.query.trim());
      url.searchParams.set('q', encodeURIComponent(validated));
    } catch (e) {
      console.warn('Invalid query for shareable URL:', e);
    }
  }
  
  // Validate and set page
  if (params.page && params.page > 1) {
    try {
      const validated = PageSchema.parse(params.page);
      url.searchParams.set('page', validated.toString());
    } catch (e) {
      console.warn('Invalid page for shareable URL:', e);
    }
  }
  
  // Validate and set filters
  if (params.filters && params.filters.filters.length > 0) {
    try {
      const validated = FilterDataSchema.parse(params.filters);
      const filtersJson = JSON.stringify(validated);
      url.searchParams.set('filters', encodeURIComponent(filtersJson));
    } catch (e) {
      console.warn('Invalid filters for shareable URL:', e);
    }
  }
  
  // Validate and set sort
  if (params.sort) {
    try {
      const validated = SortDataSchema.parse(params.sort);
      const sortJson = JSON.stringify(validated);
      url.searchParams.set('sort', encodeURIComponent(sortJson));
    } catch (e) {
      console.warn('Invalid sort for shareable URL:', e);
    }
  }
  
  return url.toString();
}

/**
 * Sanitize and validate search parameters
 */
export function validateSearchParams(params: SearchParams): SearchParams {
  const validated: SearchParams = {};
  
  if (params.query) {
    try {
      validated.query = QuerySchema.parse(params.query);
    } catch (e) {
      console.warn('Invalid query parameter:', e);
    }
  }
  
  if (params.page) {
    try {
      validated.page = PageSchema.parse(params.page);
    } catch (e) {
      console.warn('Invalid page parameter:', e);
    }
  }
  
  if (params.filters) {
    try {
      validated.filters = FilterDataSchema.parse(params.filters);
    } catch (e) {
      console.warn('Invalid filters parameter:', e);
    }
  }
  
  if (params.sort) {
    try {
      validated.sort = SortDataSchema.parse(params.sort);
    } catch (e) {
      console.warn('Invalid sort parameter:', e);
    }
  }
  
  return validated;
}