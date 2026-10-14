import { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { subscribe } from '../../services/stream';
import { nearbyPathIds, closurePreview, type ReviewPath } from './pathReview';
import { moderationProblem } from './liveReports';
import { api, jsonBody, ApiError } from '../../services/api';
import type { Blips } from './useBlips';
import type { Destinations } from './useDestinations';

export function BlipPanel({ destinations }: { destinations: Destinations }) {
  const { user } = useAuth();
  return <ReportPanel key={user?.id ?? 'anonymous'} destinations={destinations} />;
}
function ReportPanel({ destinations }: { destinations: Destinations }) {
  const { token, user } = useAuth();
  const { blips } = destinations;
  const { cancelReportPin } = destinations;
  useEffect(() => () => cancelReportPin(), [cancelReportPin]);
  const [open, setOpen] = useState(false);
  const [categories, setCategories] = useState<{slug:string;label:string}[]>([]);
  const [category, setCategory] = useState('hazard');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [hours, setHours] = useState('24');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState('user');
  const [items, setItems] = useState<Blips | null>(null);
  const [notes, setNotes] = useState<Record<number,string>>({});
  const [reviewErrors, setReviewErrors] = useState<Record<number,string>>({});
  const [scope, setScope] = useState<'mine'|'queue'|null>(null);
  useEffect(()=>{
    if(!token || !scope)return;
    let stop=()=>{};
    stop=subscribe('/api/geo/reports/private/stream?scope='+scope,token,{
      idleTimeoutMs:30000,
      onOpen:()=>{},
      onEvent:event=>{
        if(event.event==='map_snapshot')setItems(JSON.parse(event.data).reports);
        else if(event.event==='access_revoked'){setItems(null);setMessage('Your session or moderation permission changed. Sign in again or reopen My reports.');stop();}
        else if(event.event==='map_unavailable'){setItems(null);setMessage('Live report review is reconnecting.');}
      },
      onError:error=>{setItems(null);setMessage(error instanceof ApiError && [401,403].includes(error.status) ? 'Sign in again or check your moderator permissions.' : 'Report review is reconnecting.');},
    });
    return ()=>stop();
  },[token,scope]);
  const [pathReport, setPathReport] = useState<number | null>(null);
  const [paths, setPaths] = useState<ReviewPath[]>([]);
  const [edgeIds, setEdgeIds] = useState<number[]>([]);
  const [verified, setVerified] = useState(false);
  const { previewPaths } = destinations;
  useEffect(() => {
    previewPaths(items?.features.some(f=>Number(f.id)===pathReport && f.properties.status==='approved') ? closurePreview(paths, edgeIds) : []);
    return () => previewPaths([]);
  }, [paths, edgeIds, previewPaths, items, pathReport]);
  useEffect(() => {
    const abort = new AbortController();
    if (token) void api<{role:string}>('/api/geo/reports/account', token, {signal:abort.signal}).then(v => setRole(v.role)).catch(() => {});
    return () => abort.abort();
  }, [token]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Report action failed. Try again.'); }
    finally { setBusy(false); }
  }
  const button = (label: string, action: () => void, selected = false) => <Pressable key={label} accessibilityRole="button" accessibilityState={{selected,disabled:busy}} disabled={busy} onPress={action} style={[s.button,selected && s.selected]}><Text style={s.buttonText}>{label}</Text></Pressable>;
  return <View style={s.panel}>
    <Text accessibilityRole="header" style={s.title}>Campus reports</Text>
    <Text style={s.hint}>Approved reports appear on the map. This is not an emergency service.</Text>
    {blips.loading ? <Text style={s.hint}>Loading reports…</Text> : null}
    {blips.error ? <Text accessibilityRole="alert">{blips.error}</Text> : null}
    <Text accessibilityLiveRegion="polite" style={s.hint}>{blips.live}</Text>
    {!blips.loading && !blips.error && !blips.data.features.length ? <Text style={s.hint}>No active reports.</Text> : null}
    {blips.data.features.map(f => <View key={f.id} style={s.card}><Text style={s.title}>{f.properties.category.replaceAll('_',' ')} · {f.properties.severity}</Text><Text>{f.properties.description}</Text>{button('Show report '+f.id+' on map',()=>destinations.showReport(f.geometry.coordinates[0],f.geometry.coordinates[1]))}<Text style={s.hint}>{f.properties.verified ? 'Moderator verified' : 'Unverified observation'} · expires {new Date(f.properties.expires_at).toLocaleString()}</Text></View>)}
    {blips.data.next_after ? <Text style={s.hint}>Showing the first 100 active reports.</Text> : null}
    {button(destinations.reportPoint ? 'Reset report pin' : 'Place report pin', destinations.startReportPin)}
    {destinations.reportPoint ? <><Text accessibilityLiveRegion="polite" style={s.hint}>Drag the orange pin to the issue, or tap the map to move it. On a keyboard, focus the pin and use arrow keys.</Text>{button('Cancel report pin',destinations.cancelReportPin)}</> : null}
    {destinations.pinError ? <Text accessibilityRole="alert">{destinations.pinError}</Text> : null}
    {!user ? <Text style={s.hint}>Use Sign in in the header to submit a report.</Text> : button(open ? 'Close report form' : 'Report an issue', () => {
      setOpen(!open);
      if (open) destinations.cancelReportPin();
      else if (!destinations.reportPoint) destinations.startReportPin();
      if (!open) void run(async () => {
        setCategories(await api('/api/geo/reports/categories',null));
      });
    })}
    {open && user ? <View style={s.card}>
      <Text style={s.hint}>Place the pin at the exact issue location before submitting. A building center is only a starting point.</Text>
      <View style={s.row}>{categories.map(c => button(c.label,() => setCategory(c.slug),category===c.slug))}</View>
      <TextInput accessibilityLabel="Report description" placeholder="Describe the issue" multiline maxLength={1000} value={description} onChangeText={setDescription} style={s.input}/>
      <View style={s.row}>{['low','medium','high'].map(v => button(v+' severity',() => setSeverity(v),severity===v))}</View>
      <TextInput accessibilityLabel="Hours until report expires" value={hours} onChangeText={setHours} keyboardType="numeric" style={s.input}/>
      {button('Submit for review', () => { void run(async () => {
        if (!destinations.reportPoint || !Number.isFinite(Number(hours)) || Number(hours)<=0 || Number(hours)>720) throw new Error('Place a report pin and enter an expiration between 1 and 720 hours.');
        await api('/api/geo/reports',token,jsonBody({ category,description,longitude:destinations.reportPoint![0],latitude:destinations.reportPoint![1],severity,expires_at:new Date(Date.now()+Number(hours)*3600000).toISOString() }));
        setDescription(''); setOpen(false); destinations.cancelReportPin(); setMessage('Submitted for moderation. Your report does not close paths automatically.');
      }); })}
    </View> : null}
    {user ? button('My reports', () => { void run(async () => { setScope('mine'); setItems(await api('/api/geo/reports/private?scope=mine',token)); }); }) : null}
    {role !== 'user' ? <>
      {button('Moderation queue',() => { void run(async () => { setScope('queue'); setItems(await api('/api/geo/reports/private?scope=queue',token)); }); })}
      <Text style={s.hint}>Approve accepts a report for review; Publish on map makes it visible. Reject dismisses it. Mark resolved removes an active report.</Text>
      <Text style={s.hint}>Only select paths you have verified are closed. Selected segments will be excluded from routing until resolution or expiration. No selection publishes a marker only.</Text>
    </> : null}
    {items && !items.features.length ? <Text accessibilityLiveRegion="polite" style={s.hint}>{scope==='queue' ? 'All caught up. No reports need review.' : 'You have no reports yet.'}</Text> : null}
    {items?.features.map(f => <View key={f.id} style={s.card}><Text style={s.title}>Report #{f.id} · {f.properties.category.replaceAll('_',' ')}</Text><Text>{f.properties.description}</Text><Text style={s.hint}>Status: {f.properties.status} · {f.properties.severity} severity</Text>
    {role !== 'user' ? <><Text style={s.title}>Moderation reason</Text><Text style={s.hint}>Explain your decision in at least 10 characters. This note is separate from the student’s description.</Text>
      <TextInput accessibilityLabel={'Moderation reason for report '+f.id} placeholder="For example: Confirmed the walkway is clear." multiline maxLength={500} value={notes[Number(f.id)] || ''} onChangeText={value=>{setNotes(n=>({...n,[Number(f.id)]:value}));setReviewErrors(e=>({...e,[Number(f.id)]:''}));}} style={s.input}/>
      <Text style={s.hint}>{(notes[Number(f.id)] || '').trim().length}/10 minimum characters</Text>
      {reviewErrors[Number(f.id)] ? <Text accessibilityRole="alert" style={{color:'#991b1b'}}>{reviewErrors[Number(f.id)]}</Text> : null}
    </> : null}{role !== 'user' && f.properties.status==='approved' ? <>
      {button('Review paths for report '+f.id,()=>{void run(async()=>{
        setPathReport(null); setPaths([]); setEdgeIds([]); setVerified(false);
        destinations.showReport(f.geometry.coordinates[0],f.geometry.coordinates[1]);
        setPaths(await api('/api/geo/reports/'+f.id+'/paths',token)); setPathReport(Number(f.id));
      });})}
      {pathReport===f.id ? <View style={s.card}>
        <Text style={s.hint}>Selected paths appear in red on the map. This is a preview; they close only after verification and publication.</Text>
        {f.properties.severity==='high' ? button('Block nearby paths (within 10 m)',()=>{
          const ids=nearbyPathIds(paths);
          if(ids.length>30){setMessage('More than 30 nearby segments. Select the affected paths individually.');return;}
          setEdgeIds(ids); setVerified(false);
          setMessage(ids.length ? 'Review the red paths, confirm verification, then publish to block directions.' : 'No mapped paths within 10 metres. Review nearby paths individually.');
        }) : null}
        <Text accessibilityLiveRegion="polite" style={s.hint}>{edgeIds.length} paths selected for closure · maximum 30</Text>
        {button('Clear path selection',()=>{setEdgeIds([]);setVerified(false);})}
        {!paths.length ? <Text style={s.hint}>No mapped paths within 50 metres of this report.</Text> : null}
        {paths.map(p=>button('Path '+p.id+' · '+Math.round(p.distance_m)+' m from report · '+p.length_m+' m long',()=>{setVerified(false);setEdgeIds(ids=>ids.includes(p.id)?ids.filter(id=>id!==p.id):ids.length<30?[...ids,p.id]:ids);},edgeIds.includes(p.id)))}
        {button(verified?'Verification confirmed':'Confirm I verified this report',()=>setVerified(!verified),verified)}
      </View> : null}
    </> : null}{role !== 'user' ? <View style={s.row}>{(f.properties.status==='pending'?['approve','reject']:f.properties.status==='approved'?['activate','resolve']:f.properties.status==='active'?['resolve']:[]).map(action => button(({approve:'Approve report',reject:'Reject report',activate:'Publish on map',resolve:'Mark resolved'} as Record<string,string>)[action],() => {
      const note=(notes[Number(f.id)] || '').trim();
      const problem=moderationProblem(note);
      if(problem){setReviewErrors(e=>({...e,[Number(f.id)]:problem}));return;}
      if(action==='activate' && pathReport===f.id && edgeIds.length && !verified){setReviewErrors(e=>({...e,[Number(f.id)]:'Confirm you verified the selected paths are closed before publishing.'}));return;}
      void run(async () => {
      await api('/api/geo/reports/'+f.id+'/moderate',token,jsonBody({action,note,...(action==='activate' && pathReport===f.id?{verified,edge_ids:edgeIds}:{})}));
      setReviewErrors(e=>({...e,[Number(f.id)]:''}));
      setEdgeIds([]);setPaths([]);setPathReport(null);setVerified(false);
      setItems(await api('/api/geo/reports/private?scope=queue',token)); await blips.refresh();
    }); }))}</View> : null}</View>)}
    {items?.next_after ? <Text style={s.hint}>Showing the first 100 reports.</Text> : null}
    {message ? <Text accessibilityLiveRegion="polite">{message}</Text> : null}
  </View>;
}
const s=StyleSheet.create({panel:{gap:8,padding:12,backgroundColor:'#fff7ed',borderRadius:12},title:{fontSize:15,fontWeight:'700',color:'#172033'},hint:{fontSize:12,lineHeight:18,color:'#526078'},row:{flexDirection:'row',flexWrap:'wrap',gap:6},card:{gap:8,padding:8,borderWidth:1,borderColor:'#e2e8f0',borderRadius:8},button:{minHeight:44,justifyContent:'center',padding:8,borderRadius:8,backgroundColor:'#fff',borderWidth:1,borderColor:'#cbd5e1'},buttonText:{color:'#4338ca',fontWeight:'600'},selected:{backgroundColor:'#e0e7ff'},input:{minHeight:44,padding:10,borderWidth:1,borderColor:'#94a3b8',backgroundColor:'#fff',borderRadius:8,color:'#172033'}});
