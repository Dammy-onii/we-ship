import { Ionicons } from '@expo/vector-icons';
import {
  CameraView,
  type CameraType,
  useCameraPermissions,
  useMicrophonePermissions,
} from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { getScenePack } from '@/lib/scenes';
import { setLastTake, type RankEntry } from '@/lib/scene-take';

type Phase = 'checking' | 'need-permission' | 'ready' | 'recording';

export default function SceneScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pack: packId } = useLocalSearchParams<{ pack?: string }>();
  const pack = useMemo(() => getScenePack(packId), [packId]);
  const scenarios = pack.scenarios;
  const total = scenarios.length;

  // On web there is no video recording; play the ranking over a placeholder.
  const canRecord = Platform.OS !== 'web';

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);

  const [index, setIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [entries, setEntries] = useState<RankEntry[]>([]);

  // Mirror of `entries` so the async recording finalize reads the final ranking.
  const entriesRef = useRef<RankEntry[]>([]);
  const startRef = useRef<number>(0);
  const recordingRef = useRef(false);
  const finishedRef = useRef(false);

  const granted = Boolean(camPerm?.granted && micPerm?.granted);

  // Let people frame the shot and choose a lens before recording. Changing
  // camera while Expo is recording stops the clip, so the toggle is locked
  // only after capture begins.
  const phase: Phase = !canRecord
    ? 'recording'
    : !camPerm || !micPerm
      ? 'checking'
      : granted
        ? recording
          ? 'recording'
          : 'ready'
        : 'need-permission';

  const finish = useCallback(
    (videoUri: string | undefined, simulated: boolean) => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      setLastTake({
        packId: pack.id,
        videoUri,
        durationMs: Date.now() - (startRef.current || Date.now()),
        entries: entriesRef.current,
        simulated,
        createdAt: new Date().toISOString(),
      });
      setTimeout(() => router.replace('/play/scene-result'), 300);
    },
    [pack.id, router],
  );

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  const startCapture = useCallback(async () => {
    if (!canRecord || !cameraReady || recordingRef.current || finishedRef.current) return;
    recordingRef.current = true;
    setRecording(true);
    startRef.current = Date.now();
    try {
      const video = await cameraRef.current?.recordAsync({
        maxDuration: 60,
        ...(Platform.OS === 'ios' ? { codec: 'avc1' as const } : {}),
      });
      // Resolves after stopRecording() (or maxDuration). Ranking is already captured.
      finish(video?.uri, false);
    } catch {
      finish(undefined, true);
    }
  }, [cameraReady, canRecord, finish]);

  const toggleFacing = () => {
    if (recordingRef.current) return;
    setCameraReady(false);
    setFacing((current) => current === 'front' ? 'back' : 'front');
  };

  // Simulated (web) path starts its clock immediately.
  useEffect(() => {
    if (phase === 'recording' && !canRecord && !startRef.current) {
      startRef.current = Date.now();
    }
  }, [phase, canRecord]);

  useEffect(() => {
    if (phase !== 'recording') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const usedRanks = useMemo(() => new Set(entries.map((entry) => entry.rank)), [entries]);
  const current = scenarios[index];
  const done = index >= total;

  const assign = (rank: number) => {
    if (!current || usedRanks.has(rank) || finishedRef.current) return;
    const next = [
      ...entries,
      { scenarioId: current.id, rank, atMs: Date.now() - (startRef.current || Date.now()) },
    ];
    entriesRef.current = next;
    setEntries(next);
    if (index + 1 >= total) {
      if (canRecord && recordingRef.current) {
        cameraRef.current?.stopRecording(); // resolves recordAsync → finish()
      } else {
        finish(undefined, true);
      }
    }
    setIndex((i) => i + 1);
  };

  const cancel = () => {
    finishedRef.current = true;
    if (recordingRef.current) cameraRef.current?.stopRecording();
    router.back();
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  if (phase === 'checking') {
    return (
      <View style={[styles.root, styles.center]}>
        <LinearGradient colors={['#3A4A44', '#232C2A', '#1A211F']} style={StyleSheet.absoluteFill} />
        <Text variant="micro" style={{ color: 'rgba(255,252,247,0.6)' }}>
          PREPARING CAMERA…
        </Text>
      </View>
    );
  }

  if (phase === 'need-permission') {
    return (
      <View style={[styles.root, styles.center, { padding: Spacing.xl, gap: Spacing.base }]}>
        <LinearGradient colors={['#3A4A44', '#232C2A', '#1A211F']} style={StyleSheet.absoluteFill} />
        <Ionicons name="videocam-outline" size={40} color="rgba(255,252,247,0.7)" />
        <Text variant="title" onPhoto center>
          Record your take
        </Text>
        <Text variant="caption" onPhoto center style={{ opacity: 0.8 }}>
          Scene Challenges record a short video while you rank each moment. Weship needs camera and
          microphone access to capture it.
        </Text>
        <View style={{ height: Spacing.sm }} />
        <Button
          full
          label="Allow camera & mic"
          onPress={async () => {
            if (!camPerm?.granted) await requestCam();
            if (!micPerm?.granted) await requestMic();
            // Granting updates permission state and re-derives the phase.
          }}
        />
        <Button full variant="ghost" tone="partner" label="Not now" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {canRecord ? (
        <CameraView
          key={facing}
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
          videoQuality="1080p"
          videoBitrate={10_000_000}
          videoStabilizationMode="auto"
          onCameraReady={onCameraReady}
        />
      ) : (
        <>
          <LinearGradient colors={['#3A4A44', '#232C2A', '#1A211F']} style={StyleSheet.absoluteFill} />
          <View style={styles.center}>
            <View style={styles.selfieRing}>
              <Ionicons name="videocam-outline" size={34} color="rgba(255,252,247,0.45)" />
            </View>
            <Text variant="micro" style={{ color: 'rgba(255,252,247,0.45)', marginTop: 10 }}>
              CAMERA UNAVAILABLE ON WEB · RANK ONLY
            </Text>
          </View>
        </>
      )}

      {/* darkening so overlay text stays legible over any footage */}
      <LinearGradient
        colors={['rgba(16,20,17,0.22)', 'rgba(16,20,17,0)', 'rgba(16,20,17,0.30)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={cancel} hitSlop={10} style={styles.iconBtn} accessibilityLabel="Cancel">
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
        <View style={[styles.recPill, phase === 'ready' && styles.readyPill]}>
          {phase === 'recording' ? <View style={styles.recDot} /> : null}
          <Text variant="captionStrong" style={{ color: '#fff' }}>
            {phase === 'recording' ? `${mm}:${ss}` : 'READY'}
          </Text>
        </View>
        {canRecord ? (
          <Pressable
            onPress={toggleFacing}
            disabled={phase === 'recording'}
            hitSlop={10}
            style={[styles.iconBtn, phase === 'recording' && { opacity: 0.38 }]}
            accessibilityRole="button"
            accessibilityLabel={`Use ${facing === 'front' ? 'back' : 'front'} camera`}>
            <Ionicons name="camera-reverse-outline" size={23} color="#fff" />
          </Pressable>
        ) : <View style={styles.iconBtn} />}
      </View>

      {phase === 'recording' ? <View style={[styles.prompt, { top: insets.top + 62 }]}>
        <Text variant="micro" style={{ color: '#D8E0DA' }}>
          {pack.theme.toUpperCase()}
        </Text>
        <Text variant="heading" onPhoto>
          {pack.prompt}
        </Text>
      </View> : null}

      {phase === 'recording' ? <View style={[styles.rankCol, { top: insets.top + 152 }]}>
        {Array.from({ length: total }).map((_, i) => {
          const rank = i + 1;
          const used = usedRanks.has(rank);
          return (
            <Pressable
              key={rank}
              disabled={used || done}
              onPress={() => assign(rank)}
              accessibilityLabel={`Rank ${rank}`}
              style={[styles.rankBtn, used && styles.rankUsed]}>
              <Text variant="heading" style={{ color: used ? '#7E8B85' : '#22302B', fontWeight: '800' }}>
                {rank}
              </Text>
            </Pressable>
          );
        })}
      </View> : null}

      {phase === 'ready' ? (
        <View style={[styles.readyPanel, { paddingBottom: insets.bottom + 28 }]}>
          <View style={styles.readyCopy}>
            <Text variant="display" onPhoto center>Frame your take</Text>
            <Text variant="caption" onPhoto center style={{ opacity: 0.86 }}>
              Choose the front or back camera, then start when you are ready.
            </Text>
          </View>
          <Button
            full
            label={cameraReady ? 'Start recording' : 'Preparing camera…'}
            disabled={!cameraReady}
            onPress={startCapture}
            icon={<Ionicons name="videocam" size={18} color="#fff" />}
          />
        </View>
      ) : <>
      <View style={[styles.scenarioTop, { top: insets.top + 118 }]} pointerEvents="none">
        {!done && current ? (
          <Animated.View
            key={current.id}
            entering={FadeInDown.springify().damping(18)}
            exiting={FadeOut.duration(150)}
            style={styles.scenarioCard}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="micro" style={{ color: '#7C8A80' }}>
                {index + 1} OF {total} · TAP A NUMBER TO RANK
              </Text>
              <Text variant="title" style={{ color: '#22302B', fontSize: 19, lineHeight: 25 }}>
                {current.emoji}  {current.label}
              </Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn} style={styles.scenarioCard}>
            <Text variant="title" style={{ color: '#22302B', fontSize: 19 }}>
              Saving your take…
            </Text>
          </Animated.View>
        )}
      </View>
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.progressDots}>
          {scenarios.map((s, i) => (
            <View
              key={s.id}
              style={[styles.dot, { backgroundColor: i < index ? '#EBD9A0' : 'rgba(255,255,255,0.35)' }]}
            />
          ))}
        </View>
      </View>
      </>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1A211F' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  selfieRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: 'rgba(255,252,247,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#E4685E' },
  readyPill: { backgroundColor: 'rgba(0,0,0,0.3)' },
  readyPanel: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: 0,
    alignItems: 'stretch',
    gap: Spacing.lg,
  },
  readyCopy: { alignItems: 'center', gap: Spacing.sm },
  prompt: { position: 'absolute', left: Spacing.lg, right: Spacing.lg, gap: 4, alignItems: 'center' },
  // Numbers sit on the LEFT, as in the reference format.
  rankCol: { position: 'absolute', left: Spacing.md, gap: 9 },
  rankBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(251,249,244,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankUsed: { backgroundColor: 'rgba(251,249,244,0.28)' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg, gap: Spacing.base },
  // The scenario reads as a card laid over the footage, left clear of the
  // rank column so both stay tappable and legible.
  scenarioTop: { position: 'absolute', left: 82, right: Spacing.md },
  scenarioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: 'rgba(251,249,244,0.95)',
    borderRadius: Radius.card,
    padding: Spacing.base,
  },
  progressDots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
