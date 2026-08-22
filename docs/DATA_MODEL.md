# Data Model

The same selector shapes support two runtimes: a deterministic demo when Supabase is absent and authenticated Supabase rows when configured. Live rows are mapped to stable client-side `you`/`partner` aliases so screens never handle raw account IDs.

## Entities

```ts
User {
  id
  displayName
  avatarUrl?
  color: 'you' | 'them'      // drives the two-voice palette
  timezone                   // IANA, e.g. "Europe/Helsinki"
}

Space {                      // the couple container (one per relationship)
  id
  memberIds: [userId, userId]
  mode: 'together' | 'distance'
  anniversary?: ISODate
  streak: { count, lastActiveDate, graceLeft }
}

Presence {                   // current, per user
  userId
  mood: MoodKey              // 'sunny'|'calm'|'low'|'tired'|'loved'|...
  statusText?
  updatedAt
  localTime                  // derived from timezone
  weather?                   // distance mode
}

Note { id, authorId, text, createdAt, pinned }

Moment {                     // photo/video
  id, authorId, previewUrl, type:'photo'|'video',
  caption?, createdAt, originalAvailable?
}

Goodie {
  id, authorId,
  kind:'photo'|'video'|'voice'|'note'|'reminder',
  text?, previewUrl?, durationSeconds?, createdAt, originalAvailable?
}

Question {
  id, promptDate, text,
  answers: { [userId]: { text, answeredAt } }
  revealed: boolean          // true once both answered
}

QuestionPrompt {
  id, spaceId, createdBy, text, createdAt
  // pair-authored, unused prompts waiting for a future daily question
}

ChoiceGamePrompt {
  id, spaceId, createdBy, gameId, question,
  options: [{ id, label }], usedAt?, createdAt
  // oldest unused prompt is consumed atomically when the next round starts
}

SceneChallenge {
  id, theme, scenarios: [{ id, label }],
  ranking: { [userId]: orderedScenarioIds }, // 1..n
  videoUrl?, createdAt
}

LogDay {                     // one per date, per space
  date,
  mood: { [userId]: MoodKey },
  habits: { [habitId]: { [userId]: boolean } }
}

TaskRoutine = 'daily' | 'weekly' | 'monthly'

Habit {
  id, label, icon, color,
  routine: TaskRoutine,
  noteRequired: boolean
}

Nudge { id, fromId, kind:'thinkingOfYou'|'heart'|'custom', createdAt, seen }

WidgetConfig {
  id, kind:'todo', enabled
}

MemoryItem { id, kind:'moment'|'question'|'milestone', title, subtitle, date }

Friend { id, displayName, avatarUrl, mood, lastActive }  // v2
```

## Store API (what screens call)

The mock store is a small React context + hooks. Same signatures will back onto Supabase later.

```ts
useSpace()            -> Space
useMe(), usePartner() -> User
usePresence(userId)   -> Presence
useNotes()            -> { notes, addNote(text) }
useMoments()          -> Moment[]
useGoodies()          -> { goodies, addGoodie(input) }
useTodayQuestion()    -> { question, answer(text), partnerAutoAnswers() }
useQuestionArchive()  -> Question[]
useQuestionQueue()    -> { questions, addQuestion(text), deleteQuestion(id) }
useLog()              -> {
  log, habits, today, setMood(m), toggleHabit(id),
  addTask({ label, routine, noteRequired }), deleteTask(id)
}
useStreak()           -> { count, bumpedToday }
useNudges()           -> { nudges, send(kind) }
useWidgets()          -> { widgets, update(id, patch) }
useMemories()         -> { memories, addMemory(input), updateMemory(id, input) }
```

## Supabase persistence map

The authoritative relational model is in `supabase/migrations/`: `profiles`, `spaces`, `space_members`, `space_invites`, `tasks`, `task_completions`, `goodies`, `memories`, `memory_media`, `timeline_events`, `notes`, `presence`, `streaks`, `nudges`, `question_prompts`, `custom_question_prompts`, `questions`, `question_answers`, `widget_preferences`, `push_tokens`, `activity_events`, `notifications`, `provider_connections`, `calendar_sources`, `game_catalog`, `game_sessions`, `game_moves`, and `choice_game_prompts`. Sensitive provider tokens, OAuth sessions, and simultaneous game choices live in the non-exposed `private` schema. `ensure_daily_question` atomically chooses one pair question per local date; `private.create_choice_game_session` atomically consumes the oldest unused pair-authored Pick Together prompt. — [codex · done-unverified]

For Drive-primary photo/video rows, `storage_provider='google_drive'`, `drive_file_id` identifies the original, `drive_owner_id` identifies whose quota/token owns it, `preview_path` points to a compact private JPEG, and `upload_status` reports availability. Supabase does not store the original binary. Voice Goodies continue to use `storage_path`. — [codex · done-unverified]

## Standalone seeding

On first load the store seeds:
- **You** = "You" (neutral graphite), **Partner** = Riri (warm clay), distance mode with a real IANA timezone so the clock differs.
- Today's question (partner has already answered, so "reveal on both" is demonstrable after you answer).
- A week of `LogDay` history and a starting streak (e.g. 6).
- A handful of notes, moments (placeholder images), and one "On This Day" memory.

Seed data lives in `lib/mock/seed.ts`; the store shape lives in `lib/store/`.
