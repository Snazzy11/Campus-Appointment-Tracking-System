
function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

export async function login() {
  const domain = import.meta.env.VITE_COGNITO_DOMAIN
  const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID
  const redirectUri = import.meta.env.VITE_COGNITO_REDIRECT_URI

  if (!domain || !clientId || !redirectUri) {
    throw new Error('Missing Cognito environment configuration')
  }

  // Generate a random PKCE verifier.
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)))

  // SHA-256 hash of the verifier.
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(verifier)
  )

  const challenge = base64url(new Uint8Array(hash))

  // Generate a random OAuth state to prevent login CSRF.
  const state = base64url(crypto.getRandomValues(new Uint8Array(24)))

  // Temporary values needed when Cognito redirects back.
  sessionStorage.setItem('cognito_pkce_verifier', verifier)
  sessionStorage.setItem('cognito_oauth_state', state)

  const url = new URL('/oauth2/authorize', domain)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('code_challenge', challenge)

  window.location.assign(url.toString())
}
