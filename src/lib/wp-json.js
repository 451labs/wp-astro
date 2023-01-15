import * as dotenv from 'dotenv'
dotenv.config()

/**
 * POSTS
 */

const POSTS = 'wp/v2/posts/'

export async function listPosts(params, limit) {
	return await wpList(POSTS, params, limit)
}

export async function retrievePost(id, params) {
	return await wpRetrieve(`${POSTS}${id}`, params)
}

/**
 * Internal logic
 */
 
const API_BASE = new URL('wp-json/', process.env.WP_SITE_ADDRESS)
const PAGE_SIZE = process.env.WP_PER_PAGE_DEFAULT ?? 10

// WARN if PAGE_SIZE > 100 (Wordpress may not honour it)

const HEADERS = new Headers({
	'Content-Type': 'application/json' 
})

const CONTEXT = process.env.WP_USERNAME ? 'edit' : 'view'
if ('edit' === CONTEXT) {
	HEADERS.append('Authorization', 'Basic ' + Buffer.from(process.env.WP_USERNAME + ":" + process.env.WP_APPLICATION_PASSWORD, 'utf-8').toString('base64'))
}

async function wpList(resource, params={}, limit=PAGE_SIZE) { // default to one page
	const url = new URL(resource, API_BASE)
	const per_page = limit > 0 && limit < PAGE_SIZE ? limit : PAGE_SIZE
	for (const [name, value] of Object.entries({ 'context': CONTEXT, per_page, ...params })) {
		url.searchParams.set(name, value)
	}

	console.info('wp-json: LIST', url.href)
		
	const response = await fetch(url, { 'headers': HEADERS })
	const json = await response.json()
	if (json.errors) {
		console.error(json.errors)
		throw new Error('wp-json: Failed to fetch from Wordpress API')
	}
	
	if (limit > 0 && json.length >= limit) { // && Array.isArray(json)
		return json.slice(0, limit)
	}
		
	// We need to paginate
	const TOTAL = response.headers.get('x-wp-total')
	const TOTAL_PAGES = response.headers.get('x-wp-totalpages')
	const max = limit <= 0 ? TOTAL : limit
	
	for (let i=2; i<=TOTAL_PAGES && json.length < max; i++) {
		url.searchParams.set('page', i)
		
		console.info('wp-json: LIST', url.href)
		
		const response = await fetch(url, { 'headers': HEADERS }) // block scope
		const next = await response.json()
		if (next.errors) {
			console.error(next.errors)
			throw new Error('wp-json: Failed to fetch from Wordpress API')
		}
		
		json.push(...next)
	}
	
	return json.slice(0, max)
}

async function wpRetrieve(resource, params={}) {
	const url = new URL(resource, API_BASE)
	for (const [name, value] of Object.entries({ 'context': CONTEXT, ...params })) {
		url.searchParams.set(name, value)
	}
	
	console.info('wp-json: RETRIEVE', url.href)
	
	const response = await fetch(url, { 'headers': HEADERS })
	const json = await response.json()
	if (json.errors) {
		console.error(json.errors)
		throw new Error('wp-json: Failed to fetch from Wordpress API')
	}
	return json
}