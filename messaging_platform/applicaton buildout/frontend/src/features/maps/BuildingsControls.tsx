import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { BuildingsView } from './useBuildings3D';
export function BuildingsControls({view,available}:{view:BuildingsView;available:boolean}){
  const {state}=view;
  const button=(label:string,onPress:()=>void,selected=false,disabled=false)=><Pressable key={label} accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[s.button,selected&&s.selected,disabled&&{opacity:0.5}]}><Text style={s.label}>{label}</Text></Pressable>;
  return <View style={s.root}><View style={s.row}>
    {button('2D',()=>view.disable(),!state.enabled)}{button('3D',view.enable,state.enabled,!available)}
    {state.enabled?button('Rotate 45°',view.rotate):null}{state.enabled?button(view.pitch===45?'Tilt 60°':'Tilt 45°',view.tilt):null}
  </View>
  {state.message?<Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.text}>{state.message}</Text>:null}
  {state.enabled?<Text style={s.text}>Provider buildings are approximate visual context. Use building search for campus details.</Text>:null}</View>;
}
const s=StyleSheet.create({root:{gap:4},row:{flexDirection:'row',flexWrap:'wrap',gap:6},button:{minHeight:44,paddingHorizontal:14,justifyContent:'center',borderRadius:10,backgroundColor:'#e2e8f0'},selected:{backgroundColor:'#c7d2fe'},label:{fontWeight:'600',color:'#3730a3'},text:{fontSize:12,lineHeight:17,color:'#526078'}});
