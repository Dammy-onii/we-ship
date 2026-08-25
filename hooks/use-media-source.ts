import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';

import { showDialog } from '@/components/ui/dialog';
import { useNativePickerAction } from '@/hooks/use-native-picker';
import { userFacingError } from '@/lib/user-facing-error';

type MediaKind = 'photo' | 'video';

type Options = {
  kind: MediaKind;
  onPicked: (asset: ImagePicker.ImagePickerAsset) => void;
  libraryPermissionMessage: string;
  /** Goodies use the legacy Android picker to guarantee a stable file URI. */
  legacyLibrary?: boolean;
};

/**
 * Offers camera capture and library selection for one full-quality media item.
 *
 * Capture uses the phone's system camera so the device maker retains control of
 * focus, exposure, stabilization and image processing. Editing is disabled and
 * quality is maximized so Weship does not intentionally recompress the result.
 */
export function useMediaSource({
  kind,
  onPicked,
  libraryPermissionMessage,
  legacyLibrary = false,
}: Options) {
  const runPicker = useNativePickerAction();
  const isVideo = kind === 'video';

  const chooseFromLibrary = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showDialog('Photos permission needed', libraryPermissionMessage);
        return;
      }

      const result = await runPicker(() =>
        ImagePicker.launchImageLibraryAsync({
          mediaTypes: isVideo ? ['videos'] : ['images'],
          allowsEditing: false,
          allowsMultipleSelection: false,
          selectionLimit: 1,
          quality: 1,
          legacy: legacyLibrary,
        }),
      );
      if (!result.canceled && result.assets[0]) onPicked(result.assets[0]);
    } catch (error) {
      showDialog(
        'Could not open library',
        userFacingError(error, 'Please try again.'),
      );
    }
  }, [isVideo, legacyLibrary, libraryPermissionMessage, onPicked, runPicker]);

  const captureMedia = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        showDialog(
          'Camera permission needed',
          `Allow camera access to ${isVideo ? 'record a video' : 'take a photo'}. You can still choose one from your library.`,
        );
        return;
      }

      const result = await runPicker(() =>
        ImagePicker.launchCameraAsync({
          mediaTypes: isVideo ? ['videos'] : ['images'],
          cameraType: ImagePicker.CameraType.back,
          allowsEditing: false,
          quality: 1,
          ...(isVideo
            ? {
                // Zero leaves duration unrestricted. High requests the best
                // iOS capture quality; Android's system camera owns quality.
                videoMaxDuration: 0,
                videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
              }
            : {}),
        }),
      );
      if (!result.canceled && result.assets[0]) onPicked(result.assets[0]);
    } catch (error) {
      showDialog('Could not open camera', userFacingError(error, 'Please try again.'));
    }
  }, [isVideo, onPicked, runPicker]);

  return useCallback(() => {
    showDialog(
      isVideo ? 'Add a video' : 'Add a photo',
      isVideo
        ? 'Record a new video or choose one already on this device.'
        : 'Take a new photo or choose one already on this device.',
      [
        {
          text: isVideo ? 'Record video' : 'Take photo',
          onPress: () => void captureMedia(),
        },
        { text: 'Choose from library', onPress: () => void chooseFromLibrary() },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }, [captureMedia, chooseFromLibrary, isVideo]);
}
