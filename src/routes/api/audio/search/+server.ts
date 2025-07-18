import { db } from '$lib/server/db/index';
import { audios } from '$lib/server/db/schema';
import type { RequestHandler } from "./$types";
import { removeAccentsEnhanced } from '@urbanzoo/remove-accents';
import { and, or, eq, ilike, count, desc, asc, sql } from 'drizzle-orm';
import SearchRequestSchema from './schema';

// Constants
const MAX_SEARCH_RESULTS_PER_PAGE = 25;
const FUZZY_SEARCH_THRESHOLD = 0.3;

// Valid sort fields for the audios table
const validSortFields = ['id', 'name', 'category', 'created_at'] as const;
type ValidSortField = typeof validSortFields[number];

// Type definitions for better type safety
interface FilterCondition {
	field: string;
	value: string;
}

interface SortOption {
	field: ValidSortField;
	order: 'asc' | 'desc';
}

interface SearchFilters {
	filters: FilterCondition[];
	type: 'and' | 'or';
}

// Helper function to build filter conditions
function buildFilterConditions(filters: SearchFilters) {
	if (filters.filters.length === 0) return undefined;

	const conditions = filters.filters.map(({ field, value }) => {
		// Validate field exists in schema to prevent injection
		switch (field) {
			case 'name':
				return ilike(audios.name, `%${value}%`);
			case 'category':
				return ilike(audios.category, `%${value}%`);
			case 'tags':
				// For tags, we search within the text array
				return sql`EXISTS (
					SELECT 1 FROM unnest(${audios.tags}) AS tag
					WHERE tag ILIKE ${'%' + value + '%'}
				)`;
			default:
				throw new Error(`Invalid filter field: ${field}`);
		}
	});

	return filters.type === 'and' ? and(...conditions) : or(...conditions);
}

// Helper function to build sort condition
function buildSortCondition(sort: SortOption | null) {
	if (!sort) return asc(audios.name);
	
	let column;
	switch (sort.field) {
		case 'id':
			column = audios.id;
			break;
		case 'name':
			column = audios.name;
			break;
		case 'category':
			column = audios.category;
			break;
		case 'created_at':
			column = audios.created_at;
			break;
		default:
			column = audios.name;
	}
	
	return sort.order === 'desc' ? desc(column) : asc(column);
}

// Helper function to build base where conditions
function buildBaseWhereConditions(query?: string) {
	const baseConditions = [
		eq(audios.audioVisibility, 'PUBLIC'),
		eq(audios.audioLifecycle, 'ACTIVE')
	];

	if (query) {
		baseConditions.push(ilike(audios.name, `%${query}%`));
	}

	return and(...baseConditions);
}

// Helper function for fuzzy search using raw SQL
async function performFuzzySearch(
	query: string,
	searchFilters: SearchFilters | null,
	sortOption: SortOption | null,
	currentPage: number
) {
	// Build filter SQL fragment safely
	let filterSql = sql``;
	if (searchFilters && searchFilters.filters.length > 0) {
		const filterClauses: any[] = [];
		
		searchFilters.filters.forEach(({ field, value }) => {
			// Validate field and build safe SQL conditions
			switch (field) {
				case 'name':
					filterClauses.push(sql`name ILIKE ${'%' + value + '%'}`);
					break;
				case 'category':
					filterClauses.push(sql`category ILIKE ${'%' + value + '%'}`);
					break;
				case 'tags':
					filterClauses.push(sql`EXISTS (
						SELECT 1 FROM unnest(${audios.tags}) AS tag
						WHERE tag ILIKE ${'%' + value + '%'}
					)`);
					break;
				default:
					throw new Error(`Invalid filter field: ${field}`);
			}
		});

		if (filterClauses.length > 0) {
			const operator = searchFilters.type === 'and' ? sql` AND ` : sql` OR `;
			filterSql = sql` AND (${sql.join(filterClauses, operator)})`;
		}
	}

	// Build sort SQL
	let sortSql = sql`ORDER BY extensions.SIMILARITY(name, ${query}) DESC`;
	if (sortOption) {
		const orderDirection = sortOption.order === 'desc' ? sql`DESC` : sql`ASC`;
		sortSql = sql`ORDER BY ${sql.identifier(sortOption.field)} ${orderDirection}, extensions.SIMILARITY(name, ${query}) DESC`;
	}

	const offset = (currentPage - 1) * MAX_SEARCH_RESULTS_PER_PAGE;

	// Execute search and count queries concurrently
	const [searchResults, countResults] = await Promise.all([
		db.execute(sql`
			SELECT id, name, category, tags, is_previewable, whitelister, audio_url, created_at
			FROM ${audios}
			WHERE audio_visibility = 'PUBLIC'
			AND audio_lifecycle = 'ACTIVE'
			AND (
				name ILIKE ${'%' + query + '%'} OR
				extensions.SIMILARITY(name, ${query}) > ${FUZZY_SEARCH_THRESHOLD} OR
				EXISTS (
					SELECT 1 FROM unnest(tags) AS tag
					WHERE tag ILIKE ${'%' + query + '%'} OR
					extensions.SIMILARITY(tag, ${query}) > ${FUZZY_SEARCH_THRESHOLD}
				)
			)
			${filterSql}
			${sortSql}
			LIMIT ${MAX_SEARCH_RESULTS_PER_PAGE}
			OFFSET ${offset}
		`),
		
		db.execute(sql`
			SELECT COUNT(*) as count
			FROM ${audios}
			WHERE audio_visibility = 'PUBLIC'
			AND audio_lifecycle = 'ACTIVE'
			AND (
				name ILIKE ${'%' + query + '%'} OR
				extensions.SIMILARITY(name, ${query}) > ${FUZZY_SEARCH_THRESHOLD} OR
				EXISTS (
					SELECT 1 FROM unnest(tags) AS tag
					WHERE tag ILIKE ${'%' + query + '%'} OR
					extensions.SIMILARITY(tag, ${query}) > ${FUZZY_SEARCH_THRESHOLD}
				)
			)
			${filterSql}
		`)
	]);

	return {
		results: searchResults,
		total: Number((countResults[0] as any).count)
	};
}

// Helper function for standard search
async function performStandardSearch(
	whereConditions: any,
	filterConditions: any,
	sortCondition: any,
	currentPage: number
) {
	const finalWhereConditions = filterConditions 
		? and(whereConditions, filterConditions)
		: whereConditions;

	const offset = (currentPage - 1) * MAX_SEARCH_RESULTS_PER_PAGE;

	// Execute search and count queries concurrently
	const [searchResults, countResults] = await Promise.all([
		db.select({
			id: audios.id,
			name: audios.name,
			category: audios.category,
			tags: audios.tags,
			is_previewable: audios.isPreviewable,
			whitelister: audios.whitelister,
			audio_url: audios.audioUrl,
			created_at: audios.created_at
		})
		.from(audios)
		.where(finalWhereConditions)
		.orderBy(sortCondition)
		.limit(MAX_SEARCH_RESULTS_PER_PAGE)
		.offset(offset),

		db.select({ count: count() })
		.from(audios)
		.where(finalWhereConditions)
	]);

	return {
		results: searchResults,
		total: countResults[0].count
	};
}

export const POST: RequestHandler = async (event) => {
	try {
		// Extract and validate query parameter
		const rawQuery = event.url.searchParams.get('keyword') ?? '';
		const query = removeAccentsEnhanced(decodeURIComponent(rawQuery)).trim();

		// Extract and validate page parameter
		const pageParam = event.url.searchParams.get('page');
		const currentPage = pageParam ? Number(pageParam) : 1;

		if (isNaN(currentPage) || currentPage < 1) {
			return new Response(
				JSON.stringify({ errors: [{ message: 'Invalid "page" query parameter' }] }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Parse and validate request body
		const parsedRequestBody = await event.request.json();
		const requestBody = SearchRequestSchema.safeParse(parsedRequestBody);

		let searchFilters: SearchFilters | null = null;
		let sortOption: SortOption | null = null;

		if (requestBody.success) {
			// Process filters
			if (requestBody.data.filters?.filters) {
				const validFilters = requestBody.data.filters.filters
					.filter(({ inputValue }) => inputValue.trim() !== '')
					.map(({ value, inputValue }) => ({
						field: value,
						value: inputValue.trim()
					}));

				if (validFilters.length > 0) {
					searchFilters = {
						filters: validFilters,
						type: requestBody.data.filters.type || 'and'
					};
				}
			}

			// Process sort
			if (requestBody.data.sort) {
				const { field, order } = requestBody.data.sort;
				
				if (!validSortFields.includes(field as ValidSortField)) {
					return new Response(
						JSON.stringify({ 
							errors: [{ 
								message: `Invalid sort field: "${field}". Valid fields are: ${validSortFields.join(', ')}` 
							}] 
						}),
						{ status: 400, headers: { 'Content-Type': 'application/json' } }
					);
				}

				sortOption = { field: field as ValidSortField, order };
			}
		}

		// Build query conditions
		const whereConditions = buildBaseWhereConditions(query);
		const filterConditions = searchFilters ? buildFilterConditions(searchFilters) : null;
		const sortCondition = buildSortCondition(sortOption);

		let results: any[];
		let total: number;

		// Execute search based on whether we have a query and fuzzy search is available
		if (query) {
			try {
				// Attempt fuzzy search first
				const fuzzyResults = await performFuzzySearch(query, searchFilters, sortOption, currentPage);
				results = fuzzyResults.results;
				total = fuzzyResults.total;
			} catch (error) {
				// Fall back to standard search if fuzzy search fails
				console.warn("Fuzzy search failed, falling back to standard search:", error);
				const standardResults = await performStandardSearch(whereConditions, filterConditions, sortCondition, currentPage);
				results = standardResults.results;
				total = standardResults.total;
			}
		} else {
			// Use standard search when no query
			const standardResults = await performStandardSearch(whereConditions, filterConditions, sortCondition, currentPage);
			results = standardResults.results;
			total = standardResults.total;
		}

		// Validate page bounds
		const maxPage = Math.ceil(total / MAX_SEARCH_RESULTS_PER_PAGE);
		if (currentPage > maxPage && total > 0) {
			return new Response(
				JSON.stringify({
					errors: [{ message: `Page ${currentPage} is out of bounds. Max available page is ${maxPage}.` }]
				}),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Return results with proper serialization for BigInt values
		return new Response(
			JSON.stringify(
				{ items: results, total }, 
				(key, value) => (typeof value === 'bigint' ? value.toString() : value)
			),
			{ status: 200, headers: { 'Content-Type': 'application/json' } }
		);

	} catch (error) {
		console.error("Search API Error:", error);

		// Handle validation errors specifically
		if (error instanceof Error && error.message.includes('Invalid filter field')) {
			return new Response(
				JSON.stringify({ errors: [{ message: error.message }] }),
				{ status: 400, headers: { 'Content-Type': 'application/json' } }
			);
		}

		// Generic error response
		return new Response(
			JSON.stringify({ 
				errors: [{ message: 'Could not contact audio database, please try again later.' }] 
			}),
			{ status: 500, headers: { 'Content-Type': 'application/json' } }
		);
	}
};