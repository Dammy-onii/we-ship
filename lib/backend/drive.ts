import { FunctionsHttpError } from '@supabase/supabase-js';

import { localMediaSize, uploadLocalFile, type LocalMedia } from '@/lib/media';

import { requireSupabase } from './supabase';

type DriveTarget = 'memory' | 'goodie';

type StartInput = {
  target: DriveTarget;
  uploadId: string;
  media: LocalMedia;
  mimeType: string;
};

export async function uploadOriginalToDrive(
  input: StartInput,
  onProgress?: (progress: number) => void,
) {
  // Stat the file rather than trusting the picker: ImagePicker often reports a
  // missing or stale `fileSize` on Android content:// URIs, and a declared
  // length that disagrees with the bytes sent makes Drive reject with 400.
  const measured = localMediaSize(input.media);
  const sizeBytes = measured > 0 ? measured : undefined;
  const start = await invokeDrive({
    action: 'start',
    target: input.target,
    uploadId: input.uploadId,
    fileName: input.media.fileName,
    mimeType: input.mimeType,
    sizeBytes,
  });
  if (!start?.uploadUrl) throw new Error('Google Drive did not return an upload session.');
  const uploaded = await uploadLocalFile(start.uploadUrl, input.media, input.mimeType, onProgress);
  if (!uploaded.id) throw new Error('Google Drive did not return the uploaded file ID.');
  return uploaded;
}

export type DriveStorage = {
  /** Null on plans with no quota (some Workspace tiers). */
  limitBytes: number | null;
  usageBytes: number;
  usageInDriveBytes: number;
  email: string | null;
};

/** Storage headroom on the connected Google account. */
export async function fetchDriveStorage(): Promise<DriveStorage> {
  return (await invokeDrive({ action: 'quota' })) as DriveStorage;
}

export async function completeDriveUpload(input: Record<string, unknown>) {
  return invokeDrive({ action: 'complete', ...input });
}

export async function deleteDriveMedia(target: DriveTarget, id: string) {
  return invokeDrive({ action: 'delete', target, id });
}

export async function discardDriveUpload(input: {
  target: DriveTarget;
  uploadId: string;
  driveFileId: string;
}) {
  try {
    const result = await invokeDrive({ action: 'discard', ...input });
    return result?.discarded === true;
  } catch {
    // An ambiguous completion must preserve the file and preview. The server
    // may already have committed their database record even if the response
    // never reached the device.
    return false;
  }
}

async function invokeDrive(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await requireSupabase().functions.invoke('google-drive-media', { body });
  if (!error) return data;
  if (error instanceof FunctionsHttpError) {
    let detail: { error?: string } | undefined;
    try {
      detail = await error.context.clone().json();
    } catch { /* use the SDK error below */ }
    if (detail?.error) throw new Error(detail.error);
  }
  throw new Error(error.message);
}
