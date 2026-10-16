import { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { API_URL } from '../services/api';
import { PublicProfile } from '../types';

export function profileName(profile: PublicProfile | null | undefined, fallback = 'Member') {
  return profile?.display_name || profile?.username || fallback;
}
export function Avatar({ profile, fallback = '?', size = 44 }: { profile?: PublicProfile | null; fallback?: string; size?: number }) {
  const url = profile?.avatar_url;
  const [failed, setFailed] = useState<string | null>(null);
  const initial = profileName(profile, fallback).trim().charAt(0).toUpperCase() || '?';
  return <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#e0e7ff', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
    {url && failed !== url ? <Image accessible={false} source={{ uri: API_URL + url }} onError={() => setFailed(url)} style={{ width: size, height: size }} />
      : <Text style={{ color: '#3730a3', fontSize: size * 0.4, fontWeight: '700' }}>{initial}</Text>}
  </View>;
}
