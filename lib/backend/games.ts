import { requireSupabase } from './supabase';

export type ChoiceGameState = {
  sessionId: string;
  status: 'waiting' | 'active' | 'complete';
  submittedCount: number;
  myChoice?: string;
  question: string;
  options: ChoiceOption[];
  revealed?: Record<string, string>;
};

export type ChoiceOption = { id: string; label: string };

export type ChoicePrompt = {
  id: string;
  question: string;
  options: ChoiceOption[];
  createdBy: string;
  createdAt: string;
};

async function choiceState(sessionId: string): Promise<ChoiceGameState> {
  const state = await requireSupabase().rpc('get_choice_game_state', { target_session_id: sessionId });
  if (state.error) throw new Error(state.error.message);
  return state.data as ChoiceGameState;
}

export async function openChoiceGame(gameId: string): Promise<ChoiceGameState> {
  const client = requireSupabase();
  const session = await client.rpc('get_or_create_choice_game', { target_game_id: gameId });
  if (session.error) throw new Error(session.error.message);
  return choiceState(session.data);
}

export async function startChoiceGame(gameId: string): Promise<ChoiceGameState> {
  const { data, error } = await requireSupabase().rpc('start_choice_game_round', {
    target_game_id: gameId,
  });
  if (error) throw new Error(error.message);
  return choiceState(data);
}

export async function submitChoice(sessionId: string, choiceId: string): Promise<ChoiceGameState> {
  const { data, error } = await requireSupabase().rpc('submit_choice_game', {
    target_session_id: sessionId,
    choice_id: choiceId,
  });
  if (error) throw new Error(error.message);
  return data as ChoiceGameState;
}

export async function listChoicePrompts(): Promise<ChoicePrompt[]> {
  const { data, error } = await requireSupabase()
    .from('choice_game_prompts')
    .select('id,question,options,created_by,created_at')
    .eq('game_id', 'tonight-pick')
    .is('used_at', null)
    .order('created_at');
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    question: row.question,
    options: row.options as ChoiceOption[],
    createdBy: row.created_by,
    createdAt: row.created_at,
  }));
}

export async function addChoicePrompt(
  spaceId: string,
  userId: string,
  question: string,
  options: ChoiceOption[],
) {
  const { error } = await requireSupabase().from('choice_game_prompts').insert({
    space_id: spaceId,
    created_by: userId,
    game_id: 'tonight-pick',
    question: question.trim(),
    options,
  });
  if (error) throw new Error(error.message);
}

export async function deleteChoicePrompt(promptId: string) {
  const { error } = await requireSupabase()
    .from('choice_game_prompts')
    .delete()
    .eq('id', promptId);
  if (error) throw new Error(error.message);
}

export function subscribeToChoicePrompts(spaceId: string, onChange: () => void) {
  const client = requireSupabase();
  const channel = client
    .channel(`choice-prompts:${spaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'choice_game_prompts',
        filter: `space_id=eq.${spaceId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
