import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ReturnTypeOfFollowing } from './useFollowing';
export function LocationPanel({following}:{following:ReturnTypeOfFollowing}) {
  const {state}=following;
  const active=state.status==='following' || state.status==='locating';
  return <View style={s.panel}>
    <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={active?following.stop:following.start} style={s.button}><Text style={s.label}>{active?'Stop following location':'Follow my location'}</Text></Pressable>
    {state.message ? <Text accessibilityRole={state.status==='error'?'alert':undefined} accessibilityLiveRegion="polite" style={s.text}>{state.message}</Text> : null}
    {state.fix ? <Text style={s.text}>Blue dot: your estimated position · accuracy ±{Math.ceil(state.fix.accuracy!)} m. The shaded area shows uncertainty.</Text> : null}
    <Text style={s.text}>Only while Maps is open. No location history is saved. Map tiles reflect the area you view; following does not send coordinates to our route service.</Text>
  </View>;
}
const s=StyleSheet.create({panel:{gap:6},button:{minHeight:44,justifyContent:'center',padding:10,borderRadius:10,backgroundColor:'#dbeafe'},label:{color:'#1e40af',fontWeight:'600'},text:{fontSize:12,lineHeight:17,color:'#526078'}});
