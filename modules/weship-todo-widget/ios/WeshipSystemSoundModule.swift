import AudioToolbox
import ExpoModulesCore

/**
 Plays the platform's own notification sound.

 The Android half of this asks `RingtoneManager` for whatever tone the user
 chose in Settings. iOS has no equivalent — an app cannot read or play the
 user's selected notification sound outside of an actual delivered
 notification — so this uses the system sound the OS itself uses for an
 incoming message. It is a real iOS sound rather than an audio file shipped
 with the app, which is the point: an in-app alert should not introduce a noise
 the phone never makes on its own.
 */
public class WeshipSystemSoundModule: Module {
  /// The system "new message received" tone. Short, soft, and already familiar.
  private static let notificationSoundID: SystemSoundID = 1007

  public func definition() -> ModuleDefinition {
    Name("WeshipSystemSound")

    AsyncFunction("playNotificationSound") { () -> Bool in
      /*
       * iOS respects the silent switch for this class of sound on its own, so
       * unlike Android there is no ringer-mode check to make here — asking the
       * OS to play it is already the whole of the correct behaviour.
       */
      AudioServicesPlaySystemSound(Self.notificationSoundID)
      return true
    }
  }
}
