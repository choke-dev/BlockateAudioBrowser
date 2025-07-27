import { ScalarApiReference } from '@scalar/sveltekit'
import type { RequestHandler } from './$types'
const render = ScalarApiReference({
  url: 'https://cdn.jsdelivr.net/npm/@scalar/galaxy/dist/latest.json',
})

export const GET: RequestHandler = () => {
  return render()
}
