import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { api } from '../services/api';
import type { AuthConfig } from '../types';
import { LoginButton } from './LoginButton';
export function HeaderSignIn() {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const abort = new AbortController(); let active = true;
    const timer = setTimeout(() => abort.abort(), 10000);
    void api<AuthConfig>('/api/auth/config', null, {signal:abort.signal}).then(value => {if(active)setConfig(value);}).catch(() => {if(active)setError('Sign-in settings could not load. Check your connection and try again.');}).finally(() => {clearTimeout(timer);if(active)setLoading(false);});
    return () => {active=false;clearTimeout(timer);abort.abort();};
  }, [attempt]);
  return <View style={{marginRight:12}}>
    {loading ? <ActivityIndicator accessibilityLabel="Loading sign-in" /> : config ? <LoginButton config={config} onError={setError} compact /> : <Pressable accessibilityRole="button" onPress={()=>{setError('');setLoading(true);setAttempt(n=>n+1);}} style={{minHeight:44,padding:12,justifyContent:'center'}}><Text style={{color:'#4338ca'}}>Retry sign-in</Text></Pressable>}
    <Modal visible={!!error} transparent animationType="fade" onRequestClose={()=>setError('')}>
      <View style={{flex:1,justifyContent:'center',alignItems:'center',padding:24,backgroundColor:'rgba(15,23,42,0.4)'}}><View accessibilityViewIsModal style={{backgroundColor:'white',padding:24,borderRadius:16,gap:16,maxWidth:420,width:'100%'}}>
        <Text accessibilityRole="header" style={{fontSize:20,fontWeight:'700'}}>Unable to sign in</Text><Text accessibilityRole="alert">{error}</Text>
        <Pressable accessibilityRole="button" onPress={()=>setError('')} style={{minHeight:44,justifyContent:'center'}}><Text style={{color:'#4338ca'}}>Close</Text></Pressable>
      </View></View>
    </Modal>
  </View>;
}
