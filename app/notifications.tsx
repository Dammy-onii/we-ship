import { Ionicons } from '@expo/vector-icons';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DataState } from '@/components/ui/data-state';
import { useToast } from '@/components/ui/toast';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as repository from '@/lib/backend/repository';
import { useFriends } from '@/lib/friends';
import {
  PARTNER_ID,
  useBackendStatus,
  useGoodies,
  useMoments,
  useNotes,
  useNudges,
  usePartner,
  useTodayQuestion,
} from '@/lib/store';
import { relativeDay } from '@/lib/time';
import type { FriendRequest } from '@/lib/types';
import { userFacingError } from '@/lib/user-facing-error';

type Activity = {
  id: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  detail: string;
  createdAt: string;
  href?: Href;
  unread?: boolean;
};

export default function NotificationsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const partner = usePartner();
  const { goodies } = useGoodies();
  const { notes } = useNotes();
  const moments = useMoments();
  const { nudges } = useNudges();
  const { question } = useTodayQuestion();
  const sync = useBackendStatus();
  const { notifications, markNotificationsRead, incoming, accept, decline } = useFriends();
  const [liveActivities, setLiveActivities] = useState<Activity[]>();
  const [activityError, setActivityError] = useState<string>();

  const loadActivities = useCallback(async () => {
    if (sync.mode !== 'live') return;
    try {
      const items = await repository.fetchPartnerActivities();
        setLiveActivities(items.map((item) => ({
          id: item.id,
          icon: activityIcon(item.kind),
          title: item.title,
          detail: item.body ?? 'Open Weship to see what changed.',
          createdAt: item.createdAt,
          href: item.route as Href | undefined,
          unread: item.unread,
        })));
      await repository.markPartnerActivitiesRead(items.filter((item) => item.unread).map((item) => item.id));
      setActivityError(undefined);
    } catch (error) {
      setLiveActivities([]);
      setActivityError(userFacingError(error, 'Could not load recent activity.'));
    }
  }, [sync.mode]);

  useEffect(() => {
    let active = true;
    Promise.resolve().then(() => { if (active) return loadActivities(); });
    if (sync.mode !== 'live') return () => { active = false; };
    const channel = repository.subscribeToNotifications(() => loadActivities());
    repository.markPartnerNudgesSeen().catch(() => {});
    return () => {
      active = false;
      channel.unsubscribe();
    };
  }, [loadActivities, sync.mode]);

  /*
   * Marking read is tied to *focus*, not to mount or unmount.
   *
   * This is a drawer screen, so it stays mounted after the user navigates away
   * — an unmount cleanup would never run, and the badge would never clear.
   * Mounting is not the right moment either: it fires before anything is on
   * screen. So: a beat after the screen is actually looked at, and again when
   * it loses focus, which catches anything that arrived while it was open.
   */
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        markNotificationsRead().catch(() => {});
      }, 600);
      return () => {
        clearTimeout(timer);
        markNotificationsRead().catch(() => {});
      };
    }, [markNotificationsRead]),
  );

  const derivedActivities: Activity[] = [
    ...nudges
      .filter((item) => item.fromId === PARTNER_ID)
      .map((item) => ({
        id: `nudge-${item.id}`,
        icon: 'heart-outline' as const,
        title: `${partner.displayName} sent you a nudge`,
        detail: nudgeLabel(item.kind),
        createdAt: item.createdAt,
        unread: !item.seen,
      })),
    ...goodies
      .filter((item) => item.authorId === PARTNER_ID)
      .map((item) => ({
        id: `goodie-${item.id}`,
        icon: goodieIcon(item.kind),
        title: `${partner.displayName} sent a ${item.kind === 'voice' ? 'voice note' : item.kind}`,
        detail: item.text || 'Open today’s Goodies to see it.',
        createdAt: item.createdAt,
        href: '/goodies' as Href,
      })),
    ...notes
      .filter((item) => item.authorId === PARTNER_ID)
      .map((item) => ({
        id: `note-${item.id}`,
        icon: 'document-text-outline' as const,
        title: `${partner.displayName} left a note`,
        detail: item.text,
        createdAt: item.createdAt,
        href: '/us/notes' as Href,
      })),
    ...moments
      .filter((item) => item.authorId === PARTNER_ID)
      .map((item) => ({
        id: `moment-${item.id}`,
        icon: item.type === 'video' ? ('videocam-outline' as const) : ('image-outline' as const),
        title: `${partner.displayName} shared a ${item.type}`,
        detail: item.caption || 'A new memory was added.',
        createdAt: item.createdAt,
        href: '/memories' as Href,
      })),
    ...(question.answers[PARTNER_ID]
      ? [
          {
            id: `question-${question.id}`,
            icon: 'chatbubble-ellipses-outline' as const,
            title: `${partner.displayName} answered today’s question`,
            detail: 'Answer yours to reveal what they said.',
            createdAt: question.answers[PARTNER_ID].answeredAt,
            href: '/play/question' as Href,
          },
        ]
      : []),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const personalActivities: Activity[] = notifications.map((item) => ({
    id: `personal-${item.id}`,
    icon: item.kind === 'friend_request' ? 'person-add-outline' : 'people-outline',
    title: item.title,
    detail: item.body ?? 'Open Weship to see what changed.',
    createdAt: item.createdAt,
    href: (item.route ?? '/friends') as Href,
    unread: !item.readAt,
  }));
  const activities = liveActivities
    ? [...liveActivities, ...personalActivities].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : derivedActivities;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.bg }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.xl }]}>
      <View style={styles.intro}>
        <Avatar name={partner.displayName} seed={partner.photoSeed} uri={partner.photoUri} ring="them" size={46} />
        <View style={{ flex: 1 }}>
          <Text variant="display">Recent activity</Text>
          <Text variant="body" color="textSoft">The latest things {partner.displayName} shared with you.</Text>
        </View>
      </View>

      {incoming.length ? (
        <View style={styles.requests}>
          <Text variant="micro" color="textFaint">FRIEND REQUESTS</Text>
          {incoming.map((request) => (
            <FriendRequestCard
              key={request.id}
              request={request}
              onAccept={() => accept(request.id)}
              onDecline={() => decline(request.id)}
            />
          ))}
        </View>
      ) : null}

      <View style={[styles.list, { borderTopColor: theme.line, borderBottomColor: theme.line }]}>
        {sync.mode === 'live' && liveActivities === undefined ? (
          <DataState loading title="Loading recent activity" />
        ) : activityError ? (
          <DataState icon="cloud-offline-outline" title="Activity unavailable" detail={activityError} />
        ) : !activities.length ? (
          <DataState icon="notifications-outline" title="No recent activity" detail={`New things from ${partner.displayName} will appear here.`} />
        ) : activities.map((activity, index) => (
          <Pressable
            key={activity.id}
            disabled={!activity.href}
            onPress={() => activity.href && router.push(activity.href)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.line },
              pressed && { opacity: 0.65 },
            ]}>
            <View style={[styles.icon, { backgroundColor: theme.surfaceAlt }]}>
              <Ionicons name={activity.icon} size={20} color={theme.textSoft} />
              {activity.unread ? <View style={[styles.unread, { backgroundColor: theme.bloom }]} /> : null}
            </View>
            <View style={styles.copy}>
              <Text variant="bodyStrong">{activity.title}</Text>
              <Text variant="caption" color="textSoft" numberOfLines={2}>{activity.detail}</Text>
              <Text variant="micro" color="textFaint" style={styles.when}>
                {relativeDay(activity.createdAt.slice(0, 10)).toUpperCase()}
              </Text>
            </View>
            {activity.href ? <Ionicons name="chevron-forward" size={16} color={theme.textFaint} /> : null}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

/**
 * An incoming friend request, answerable where it is seen.
 *
 * Requests previously only appeared as a line in this list that pushed to the
 * friends screen, so there was nothing here that read as a prompt.
 */
function FriendRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const theme = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>, failure: string) => {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      toast.show(userFacingError(error, failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.request, { backgroundColor: theme.surface, borderColor: theme.line }]}>
      <View style={styles.requestHead}>
        <Avatar
          name={request.person.displayName}
          seed={request.person.id}
          uri={request.person.photoUri}
          size={44}
        />
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{request.person.displayName}</Text>
          <Text variant="caption" color="textFaint">
            {request.person.username ? `@${request.person.username}` : 'wants to connect'}
          </Text>
        </View>
      </View>
      <View style={styles.requestActions}>
        <Button
          label="Decline"
          variant="ghost"
          size="sm"
          disabled={busy}
          onPress={() => run(onDecline, 'Could not decline this request.')}
        />
        <Button
          loading={busy}
          label={busy ? 'Working…' : 'Accept'}
          size="sm"
          disabled={busy}
          onPress={() => run(onAccept, 'Could not accept this request.')}
        />
      </View>
    </View>
  );
}

function activityIcon(kind: string): React.ComponentProps<typeof Ionicons>['name'] {
  if (kind.includes('task')) return 'checkbox-outline';
  if (kind.includes('goodie')) return 'gift-outline';
  if (kind.includes('memory')) return 'images-outline';
  if (kind.includes('calendar')) return 'calendar-outline';
  if (kind.includes('question')) return 'chatbubble-ellipses-outline';
  if (kind.includes('game')) return 'game-controller-outline';
  if (kind.includes('nudge')) return 'heart-outline';
  return 'notifications-outline';
}

function nudgeLabel(kind: 'thinkingOfYou' | 'heart' | 'hug' | 'goodnight') {
  if (kind === 'thinkingOfYou') return 'Thinking of you';
  if (kind === 'goodnight') return 'Goodnight';
  return kind === 'hug' ? 'A warm hug' : 'A little heart';
}

function goodieIcon(kind: 'photo' | 'video' | 'voice' | 'note' | 'reminder') {
  if (kind === 'photo') return 'image-outline' as const;
  if (kind === 'video') return 'videocam-outline' as const;
  if (kind === 'voice') return 'mic-outline' as const;
  if (kind === 'reminder') return 'alarm-outline' as const;
  return 'document-text-outline' as const;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.xl },
  requests: { gap: Spacing.sm },
  request: {
    borderRadius: Radius.inset,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  requestHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  requestActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm },
  intro: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  list: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: { minHeight: 94, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  icon: { width: 44, height: 44, borderRadius: Radius.chip, alignItems: 'center', justifyContent: 'center' },
  unread: { position: 'absolute', width: 8, height: 8, borderRadius: 4, right: 2, top: 2 },
  copy: { flex: 1, gap: 2 },
  when: { marginTop: 4 },
});
