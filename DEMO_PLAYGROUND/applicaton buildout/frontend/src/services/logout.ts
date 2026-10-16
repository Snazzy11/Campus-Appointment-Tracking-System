import type { AuthConfig } from '../types';

export function cognitoLogoutUrl(config: AuthConfig, returnUri: string) {
  const url = new URL('/logout', config.domain);
  url.searchParams.set('client_id', config.client_id);
  url.searchParams.set('logout_uri', returnUri);
  return url.toString();
}
