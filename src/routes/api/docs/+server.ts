import { ScalarApiReference } from '@scalar/sveltekit'
import type { RequestHandler } from './$types'
const render = ScalarApiReference({
  url: '/api/openapi.json',
  pageTitle: "Blockate Audio Browser API (v1)"
})

export const GET: RequestHandler = () => {
  return render()
}
