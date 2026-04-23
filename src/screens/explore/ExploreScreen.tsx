import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, ActivityIndicator, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Typography } from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../lib/authStore';

const YT_API_KEY = 'AIzaSyBH2kveg27RI1tcrlHGNzjI6LfDYBqLLCc';

const ACTIVITY_TO_QUERY: Record<string, string> = {
  cycling:  'cycling shorts eco commute',
  vegmeal:  'plant based shorts healthy eating',
  car:      'reduce car emissions shorts',
  bus:      'public transport shorts',
  flight:   'sustainable travel shorts',
  meatmeal: 'reduce meat shorts tips',
  coffee:   'sustainable coffee shorts',
  delivery: 'food delivery carbon shorts',
  heating:  'home energy efficiency shorts',
  ac:       'energy efficient home shorts',
  streaming:'digital carbon shorts',
  browsing: 'sustainable internet shorts',
  default:  'sustainability eco shorts green',
};

const ACTIVITY_LABELS: Record<string, string> = {
  cycling: '🚴 cycling', vegmeal: '🥗 healthy eating',
  car: '🚗 transport', bus: '🚌 transit',
  meatmeal: '🍽️ food', heating: '🌡️ energy',
  ac: '❄️ energy', streaming: '📱 digital',
  default: '🌿 eco',
};

const PLATFORMS = [
  { id: 'all',       label: 'All',       icon: '🌿' },
  { id: 'shorts',    label: 'Shorts',    icon: '⚡' },
  { id: 'tiktok',    label: 'TikTok',    icon: '🎵' },
  { id: 'instagram', label: 'Instagram', icon: '📸' },
];

const MOCK_SOCIAL = [
  { id: 'm1', plat: 'tiktok',    platLabel: 'TikTok',    color: '#010101', emoji: '🌍', author: '@greenearth.co',   title: '5 simple swaps that cut your food carbon in half', url: 'https://www.tiktok.com' },
  { id: 'm2', plat: 'tiktok',    platLabel: 'TikTok',    color: '#010101', emoji: '🚴', author: '@cyclelife.co',     title: 'I cycled everywhere for 30 days — results',        url: 'https://www.tiktok.com' },
  { id: 'm3', plat: 'tiktok',    platLabel: 'TikTok',    color: '#010101', emoji: '🥗', author: '@plantbased.daily', title: 'What I eat in a day — fully plant based',           url: 'https://www.tiktok.com' },
  { id: 'm4', plat: 'tiktok',    platLabel: 'TikTok',    color: '#010101', emoji: '🐝', author: '@rewild.daily',     title: 'Plant these 3 native species',                      url: 'https://www.tiktok.com' },
  { id: 'm5', plat: 'instagram', platLabel: 'Instagram',  color: '#c13584', emoji: '☀️', author: '@solarpunklife',    title: 'How solar panels paid for themselves in 3 years',   url: 'https://www.instagram.com' },
  { id: 'm6', plat: 'instagram', platLabel: 'Instagram',  color: '#c13584', emoji: '🌊', author: '@oceanclean.co',    title: 'We removed 200kg of plastic from a beach',          url: 'https://www.instagram.com' },
  { id: 'm7', plat: 'instagram', platLabel: 'Instagram',  color: '#c13584', emoji: '🥑', author: '@wholefood.life',   title: 'A week of healthy plant-based meals under $50',     url: 'https://www.instagram.com' },
  { id: 'm8', plat: 'instagram', platLabel: 'Instagram',  color: '#c13584', emoji: '🔋', author: '@evlife.official',  title: 'One year of EV ownership — real numbers',           url: 'https://www.instagram.com' },
];

// Fetch short-form videos (under 4 min = videoDuration=short)
const fetchYTPage = async (query: string, pageToken: string | null, shortsOnly: boolean) => {
  let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YT_API_KEY}&order=viewCount&relevanceLanguage=en`;
  if (shortsOnly) url += '&videoDuration=short'; // under 4 minutes
  if (pageToken) url += `&pageToken=${pageToken}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.error) { console.error('YT:', data.error.message); return { videos: [], nextToken: null }; }
    const videos = (data.items || []).map((item: any) => ({
      id: item.id.videoId,
      videoId: item.id.videoId,
      title: item.snippet.title,
      channel: item.snippet.channelTitle,
      thumbnail: item.snippet.thumbnails?.medium?.url,
      publishedAt: new Date(item.snippet.publishedAt).toLocaleDateString(),
      plat: 'youtube',
      isShort: shortsOnly,
    }));
    return { videos, nextToken: data.nextPageToken || null };
  } catch (e) { return { videos: [], nextToken: null }; }
};

export default function ExploreScreen() {
  const { profile } = useAuthStore();
  const insets = useSafeAreaInsets();
  const [plat, setPlat] = useState('all');
  const [ytVideos, setYtVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [watched, setWatched] = useState<Set<string>>(new Set());
  const [scrolledPast, setScrolledPast] = useState<Set<string>>(new Set());
  const [shared, setShared] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [topActivities, setTopActivities] = useState<string[]>(['default']);
  const [queries, setQueries] = useState<string[]>([]);
  const [pageTokens, setPageTokens] = useState<Record<string, string | null>>({});
  const [hasMore, setHasMore] = useState(true);
  const seenIds = useRef<Set<string>>(new Set());
  const isLoadingMore = useRef(false);

  useEffect(() => { setTimeout(initFeed, 400); }, [profile?.id]);

  const getShortsOnly = (p: string) => p === 'shorts';

  const initFeed = async () => {
    setLoading(true);
    seenIds.current = new Set();
    let activities = ['default'];

    if (profile?.id) {
      const { data: actData } = await supabase
        .from('activities')
        .select('activity_type, category')
        .eq('user_id', profile.id)
        .order('logged_at', { ascending: false })
        .limit(30);

      if (actData?.length) {
        const counts: Record<string, number> = {};
        actData.forEach((a: any) => {
          const key = a.activity_type || a.category || 'default';
          if (ACTIVITY_TO_QUERY[key]) counts[key] = (counts[key] || 0) + 1;
        });
        if (Object.keys(counts).length) {
          activities = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]);
        }
      }

      // Load watch history
      const { data: watchData } = await supabase
        .from('watched_videos')
        .select('video_id, completed')
        .eq('user_id', profile.id);

      if (watchData) {
        const w = new Set(watchData.filter((x: any) => x.completed).map((x: any) => x.video_id));
        const s = new Set(watchData.filter((x: any) => !x.completed).map((x: any) => x.video_id));
        setWatched(w as Set<string>);
        setScrolledPast(s as Set<string>);
        watchData.forEach((x: any) => seenIds.current.add(x.video_id));
      }
    }

    setTopActivities(activities);
    const q = [...new Set(activities.slice(0, 3).map(a => ACTIVITY_TO_QUERY[a] || ACTIVITY_TO_QUERY.default))];
    setQueries(q);

    // Initial tokens all null
    const initTokens: Record<string, string | null> = {};
    q.forEach(query => { initTokens[query] = null; });

    // Fetch one page from each query
    const results = await Promise.all(q.map(query => fetchYTPage(query, null, false)));
    const newTokens = { ...initTokens };
    const allVideos: any[] = [];

    results.forEach((r, i) => {
      newTokens[q[i]] = r.nextToken;
      r.videos.forEach((v: any) => {
        if (!seenIds.current.has(v.id)) {
          seenIds.current.add(v.id);
          allVideos.push(v);
        }
      });
    });

    setPageTokens(newTokens);
    setYtVideos(allVideos);
    setHasMore(true);
    setLoading(false);
  };

  const loadMore = async () => {
    if (isLoadingMore.current || !hasMore) return;
    isLoadingMore.current = true;
    setLoadingMore(true);

    const shortsOnly = getShortsOnly(plat);
    // Pick next query that still has pages
    const availableQueries = queries.filter(q => pageTokens[q] !== undefined);
    if (!availableQueries.length) { setHasMore(false); setLoadingMore(false); isLoadingMore.current = false; return; }

    // Load from all available queries in parallel
    const results = await Promise.all(availableQueries.map(q => fetchYTPage(q, pageTokens[q] ?? null, shortsOnly)));
    const newTokens = { ...pageTokens };
    const newVideos: any[] = [];
    let anyMore = false;

    results.forEach((r, i) => {
      const q = availableQueries[i];
      newTokens[q] = r.nextToken;
      if (r.nextToken) anyMore = true;
      r.videos.forEach((v: any) => {
        if (!seenIds.current.has(v.id)) {
          seenIds.current.add(v.id);
          newVideos.push(v);
        }
      });
    });

    setPageTokens(newTokens);
    if (newVideos.length > 0) setYtVideos(prev => [...prev, ...newVideos]);
    setHasMore(anyMore || newVideos.length > 0);
    setLoadingMore(false);
    isLoadingMore.current = false;
  };

  const markWatched = async (videoId: string) => {
    if (!profile?.id) { setPlaying(videoId); return; }
    setPlaying(videoId);
    setWatched(prev => new Set([...prev, videoId]));
    await supabase.from('watched_videos').upsert({ user_id: profile.id, video_id: videoId, platform: 'youtube', completed: true }, { onConflict: 'user_id,video_id' });
  };

  const markScrolled = async (videoId: string) => {
    if (watched.has(videoId) || scrolledPast.has(videoId) || !profile?.id) return;
    setScrolledPast(prev => new Set([...prev, videoId]));
    supabase.from('watched_videos').upsert({ user_id: profile.id, video_id: videoId, platform: 'youtube', completed: false }, { onConflict: 'user_id,video_id' });
  };

  const handleScroll = (e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 800) loadMore();
  };

  const handlePlatChange = async (p: string) => {
    setPlat(p);
    if (p === 'tiktok' || p === 'instagram') return;
    // Re-fetch with shorts filter if needed
    setLoading(true);
    seenIds.current = new Set();
    const shortsOnly = p === 'shorts';
    const results = await Promise.all(queries.map(q => fetchYTPage(q, null, shortsOnly)));
    const newTokens: Record<string, string | null> = {};
    const allVideos: any[] = [];
    results.forEach((r, i) => {
      newTokens[queries[i]] = r.nextToken;
      r.videos.forEach((v: any) => {
        if (!seenIds.current.has(v.id)) { seenIds.current.add(v.id); allVideos.push(v); }
      });
    });
    setPageTokens(newTokens);
    setYtVideos(allVideos);
    setHasMore(true);
    setLoading(false);
  };

  const toggleSave = (id: string) => setSaved(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  const getItems = () => {
    if (plat === 'tiktok') return MOCK_SOCIAL.filter(v => v.plat === 'tiktok');
    if (plat === 'instagram') return MOCK_SOCIAL.filter(v => v.plat === 'instagram');
    return ytVideos;
  };

  const getLabel = () => {
    if (topActivities[0] === 'default') return '🌿 Popular eco content';
    return `✦ Based on your ${topActivities.slice(0, 3).map(a => ACTIVITY_LABELS[a] || a).join(', ')}`;
  };

  const getVideoStatus = (id: string) => {
    if (watched.has(id)) return { label: '✓ Watched', color: Colors.lime };
    if (scrolledPast.has(id)) return { label: '👁 Seen', color: Colors.tx3 };
    return null;
  };

  return (
    <View style={s.root}>
      <View style={[s.phone, { paddingTop: insets.top || 12 }]}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.bg} />
        <View style={s.header}>
          <View>
            <Text style={s.title}>Eco Reels</Text>
            <Text style={s.subtitle}>{plat === 'shorts' ? '⚡ Short videos only' : 'Personalized · sorted by views'}</Text>
          </View>
          <View style={s.greenBadge}><View style={s.greenDot} /><Text style={s.greenBadgeText}>🌿 Green only</Text></View>
        </View>

        <View style={s.tabsRow}>
          {PLATFORMS.map(p => (
            <TouchableOpacity key={p.id} style={s.tab} onPress={() => handlePlatChange(p.id)} activeOpacity={0.7}>
              <Text style={s.tabIcon}>{p.icon}</Text>
              <Text style={[s.tabLabel, plat === p.id && s.tabLabelOn]}>{p.label}</Text>
              {plat === p.id && <View style={s.tabUnderline} />}
            </TouchableOpacity>
          ))}
        </View>

        {plat !== 'tiktok' && plat !== 'instagram' && (
          <View style={s.pBanner}>
            <Text style={s.pText} numberOfLines={1}>{getLabel()}</Text>
            <TouchableOpacity onPress={initFeed}><Text style={s.refreshBtn}>↻</Text></TouchableOpacity>
          </View>
        )}

        {loading && plat !== 'tiktok' && plat !== 'instagram' ? (
          <View style={s.loadWrap}>
            <ActivityIndicator color={Colors.lime} size="large" />
            <Text style={s.loadTxt}>{plat === 'shorts' ? 'Finding eco shorts...' : 'Finding videos for you...'}</Text>
            <Text style={s.loadSub}>{getLabel()}</Text>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 6, paddingBottom: 80 }} onScroll={handleScroll} scrollEventThrottle={200}>
            {(plat === 'tiktok' || plat === 'instagram') && (
              <View style={s.socialNote}><Text style={s.socialNoteTxt}>{plat === 'tiktok' ? '🎵' : '📸'} Tap to open in {plat === 'tiktok' ? 'TikTok' : 'Instagram'}</Text></View>
            )}

            {getItems().map((v: any) => {
              const status = v.plat === 'youtube' ? getVideoStatus(v.id) : null;
              return (
                <View key={v.id} style={[s.card, v.isShort && s.shortCard]} onLayout={() => v.plat === 'youtube' && markScrolled(v.id)}>
                  {status && (
                    <View style={[s.statusBadge, { borderColor: status.color }]}>
                      <Text style={[s.statusText, { color: status.color }]}>{status.label}</Text>
                    </View>
                  )}
                  {v.plat === 'youtube' ? (
                    playing === v.id ? (
                      <View style={[s.ytPlayer, v.isShort && s.ytPlayerShort]}>
                        {/* @ts-ignore */}
                        <iframe width="100%" height={v.isShort ? 480 : 210} src={`https://www.youtube.com/embed/${v.videoId}?autoplay=1&rel=0&modestbranding=1`} frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ border: 'none' }} />
                      </View>
                    ) : (
                      <TouchableOpacity style={[s.thumb, v.isShort && s.thumbShort]} onPress={() => markWatched(v.id)} activeOpacity={0.9}>
                        {v.thumbnail && /* @ts-ignore */ <img src={v.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />}
                        <LinearGradient colors={['transparent', 'rgba(7,16,13,0.85)']} style={StyleSheet.absoluteFillObject} />
                        <View style={s.playBtn}><Text style={{ color: '#071810', fontSize: 14 }}>▶</Text></View>
                        {v.isShort && <View style={s.shortsBadge}><Text style={s.shortsBadgeTxt}>⚡ Short</Text></View>}
                        <View style={s.platBadge}><View style={[s.platDot, { backgroundColor: '#FF0000' }]} /><Text style={s.platBadgeTxt}>YouTube</Text></View>
                        <View style={s.thumbBottom}><Text style={s.thumbAuthor}>{v.channel}</Text><View style={s.greenTag}><Text style={s.greenTagTxt}>🌿 Green verified</Text></View></View>
                      </TouchableOpacity>
                    )
                  ) : (
                    <TouchableOpacity style={s.thumb} onPress={() => Linking.openURL(v.url)} activeOpacity={0.9}>
                      <LinearGradient colors={['rgba(7,16,13,0.1)', 'rgba(7,16,13,0.92)']} style={StyleSheet.absoluteFillObject} />
                      <Text style={s.thumbEmoji}>{v.emoji}</Text>
                      <View style={[s.platBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}><View style={[s.platDot, { backgroundColor: v.color }]} /><Text style={s.platBadgeTxt}>{v.platLabel}</Text></View>
                      <View style={s.openBadge}><Text style={s.openBadgeTxt}>Open in app ↗</Text></View>
                      <View style={s.thumbBottom}><Text style={s.thumbAuthor}>{v.author}</Text><View style={s.greenTag}><Text style={s.greenTagTxt}>🌿 Green verified</Text></View></View>
                    </TouchableOpacity>
                  )}
                  <View style={s.info}>
                    <Text style={s.infoTitle} numberOfLines={2}>{v.title}</Text>
                    <View style={s.metaRow}>
                      {v.publishedAt && <Text style={s.meta}>{v.publishedAt}</Text>}
                      <View style={s.actions}>
                        <TouchableOpacity style={[s.actBtn, s.shareBtn]} onPress={() => setShared(v.id)}><Text style={s.shareTxt}>Share</Text></TouchableOpacity>
                        <TouchableOpacity style={[s.actBtn, saved.includes(v.id) ? s.savedBtn : s.saveBtn]} onPress={() => toggleSave(v.id)}><Text style={[s.saveTxt, saved.includes(v.id) && { color: Colors.lime }]}>{saved.includes(v.id) ? '✓ Saved' : 'Save'}</Text></TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            {loadingMore && <View style={s.loadMoreWrap}><ActivityIndicator color={Colors.lime} size="small" /><Text style={s.loadMoreTxt}>Loading more...</Text></View>}
            {!loadingMore && hasMore && <TouchableOpacity style={s.loadMoreBtn} onPress={loadMore}><Text style={s.loadMoreBtnTxt}>Load more ↓</Text></TouchableOpacity>}
          </ScrollView>
        )}

        {shared && (
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setShared(null)}>
            <View style={s.sheet}>
              <View style={s.sheetHandle} />
              <Text style={s.sheetTitle}>Share this eco reel</Text>
              <Text style={s.sheetSub}>Spread the green movement 🌿</Text>
              <View style={s.sheetRow}>
                {[{ icon: '💬', label: 'Messages' }, { icon: '📸', label: 'Story' }, { icon: '🌿', label: 'Friends' }, { icon: '🔗', label: 'Copy' }].map((p, i) => (
                  <TouchableOpacity key={i} style={s.sheetBtn} onPress={() => setShared(null)}>
                    <Text style={{ fontSize: 20 }}>{p.icon}</Text>
                    <Text style={s.sheetBtnLbl}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', alignItems: 'center' },
  phone: { width: 390, maxWidth: '100%', height: '100%', backgroundColor: Colors.bg, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  title: { fontFamily: Typography.heading, fontSize: 20, color: Colors.tx, letterSpacing: -0.5 },
  subtitle: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 },
  greenBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, backgroundColor: 'rgba(200,244,90,0.1)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.25)' },
  greenDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Colors.lime },
  greenBadgeText: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.lime },
  tabsRow: { flexDirection: 'row', paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(255,255,255,0.06)', marginBottom: 6 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, gap: 2, position: 'relative' },
  tabIcon: { fontSize: 14 },
  tabLabel: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx3, textTransform: 'uppercase', letterSpacing: 0.4 },
  tabLabelOn: { color: Colors.lime },
  tabUnderline: { position: 'absolute', bottom: 0, left: '20%', right: '20%', height: 2, backgroundColor: Colors.lime, borderRadius: 1 },
  pBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, marginHorizontal: 10, marginBottom: 4, backgroundColor: 'rgba(200,244,90,0.05)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.12)', borderRadius: 8 },
  pText: { fontFamily: Typography.headingBold, fontSize: 9, color: Colors.tx2, flex: 1 },
  refreshBtn: { fontFamily: Typography.headingBold, fontSize: 14, color: Colors.lime, paddingLeft: 8 },
  loadWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10 },
  loadTxt: { fontFamily: Typography.headingBold, fontSize: 13, color: Colors.tx2 },
  loadSub: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 },
  socialNote: { backgroundColor: 'rgba(200,244,90,0.05)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.15)', borderRadius: 8, padding: 8, marginBottom: 8 },
  socialNoteTxt: { fontFamily: Typography.headingBold, fontSize: 10, color: Colors.tx2, textAlign: 'center' },
  card: { backgroundColor: Colors.bg2, borderWidth: 0.5, borderColor: Colors.border, borderRadius: 16, overflow: 'hidden', marginBottom: 8, position: 'relative' },
  shortCard: { borderColor: 'rgba(200,244,90,0.2)' },
  statusBadge: { position: 'absolute', top: 8, right: 8, zIndex: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, borderWidth: 0.5, backgroundColor: Colors.bg },
  statusText: { fontFamily: Typography.headingBold, fontSize: 8 },
  ytPlayer: { width: '100%', height: 210, backgroundColor: '#000' },
  ytPlayerShort: { height: 480 },
  thumb: { height: 160, position: 'relative', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.bg3, overflow: 'hidden' },
  thumbShort: { height: 240 },
  thumbEmoji: { fontSize: 52, opacity: 0.22 },
  shortsBadge: { position: 'absolute', bottom: 36, right: 8, backgroundColor: 'rgba(200,244,90,0.9)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  shortsBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: '#071810' },
  platBadge: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.55)' },
  platDot: { width: 8, height: 8, borderRadius: 2 },
  platBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: '#fff' },
  openBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.55)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  openBadgeTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: '#fff' },
  playBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(200,244,90,0.92)', justifyContent: 'center', alignItems: 'center', position: 'absolute' },
  thumbBottom: { position: 'absolute', bottom: 8, left: 8, right: 8 },
  thumbAuthor: { fontFamily: Typography.headingBold, fontSize: 9, color: '#fff', marginBottom: 3 },
  greenTag: { alignSelf: 'flex-start', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, backgroundColor: 'rgba(200,244,90,0.2)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.4)' },
  greenTagTxt: { fontFamily: Typography.headingBold, fontSize: 7, color: Colors.lime },
  info: { padding: 9 },
  infoTitle: { fontFamily: Typography.bodyMedium, fontSize: 12, color: Colors.tx, marginBottom: 5, lineHeight: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  meta: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx3 },
  actions: { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  actBtn: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  shareBtn: { backgroundColor: 'rgba(200,244,90,0.12)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.25)' },
  shareTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.lime },
  saveBtn: { backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border },
  savedBtn: { backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)' },
  saveTxt: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx2 },
  loadMoreWrap: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 16 },
  loadMoreTxt: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx3 },
  loadMoreBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 8, borderRadius: 12, backgroundColor: 'rgba(200,244,90,0.08)', borderWidth: 0.5, borderColor: 'rgba(200,244,90,0.2)' },
  loadMoreBtnTxt: { fontFamily: Typography.headingBold, fontSize: 11, color: Colors.lime },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Colors.bg2, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 0.5, borderColor: Colors.border2, padding: 14, paddingBottom: 28 },
  sheetHandle: { width: 30, height: 3, backgroundColor: Colors.sf2, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetTitle: { fontFamily: Typography.heading, fontSize: 14, color: Colors.tx, marginBottom: 2 },
  sheetSub: { fontFamily: Typography.body, fontSize: 11, color: Colors.tx2, marginBottom: 12 },
  sheetRow: { flexDirection: 'row', gap: 7 },
  sheetBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, backgroundColor: Colors.sf, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', gap: 3 },
  sheetBtnLbl: { fontFamily: Typography.headingBold, fontSize: 8, color: Colors.tx2 },
});
