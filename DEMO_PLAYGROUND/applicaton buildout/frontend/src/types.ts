export type PublicProfile = { id: number; username?: string | null; display_name?: string | null; avatar_url?: string | null };
export type User = PublicProfile & { bio?: string; updated_at?: string; authenticated: true; id: number; sub: string; email: string };
export type Message = { id: number; sender: string; profile?: PublicProfile | null; text: string; created_at: string; conversation_id?: number; user_id?: number | null; version?: number; edited?: boolean; attachment?: import("./features/chat/ChatTools").ChatAttachment | null; kind?: "user" | "system" | "deleted" };
export type Conversation = { last_message?: Message | null; id: number; type: string; name: string | null; owner_ids: number[]; created_at: string; members: (PublicProfile & { email: string })[] };
export type AuthConfig = { domain: string; client_id: string };

export type Recipient = { id: number; email: string };
