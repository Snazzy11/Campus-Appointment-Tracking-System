export type User = { authenticated: true; id: number; sub: string; email: string };
export type Message = { id: number; sender: string; text: string; created_at: string; conversation_id?: number; user_id?: number };
export type Conversation = { id: number; type: string; created_at: string; members: { id: number; email: string }[] };
export type AuthConfig = { domain: string; client_id: string };
