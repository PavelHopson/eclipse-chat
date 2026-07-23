import { useRef, useState, type ChangeEvent } from "react";
import { Modal } from "../Modal";
import { useConfirm } from "../ConfirmDialog";
import type { Profile } from "../../hooks/useProfile";
import { useChangePassword } from "../../hooks/useChangePassword";
import { useDensity } from "../../hooks/useDensity";
import { useFocusDim } from "../../hooks/useFocusDim";
import { useInstallPrompt } from "../../hooks/useInstallPrompt";
import { usePushNotifications } from "../../hooks/usePushNotifications";
import { usePushPreferences } from "../../hooks/usePushPreferences";
import { useNotificationSoundSettings } from "../../hooks/useNotificationSoundSettings";
import { useDesktopAutostart } from "../../hooks/useDesktopAutostart";
import { AccountProfileSection } from "./categories/AccountProfileSection";
import { AccountSecuritySection } from "./categories/AccountSecuritySection";
import { ActivitySection } from "./categories/ActivitySection";
import { AppearanceSection } from "./categories/AppearanceSection";
import { HotkeysSection } from "./categories/HotkeysSection";
import { InstallSection } from "./categories/InstallSection";
import { NotificationsPushSection } from "./categories/NotificationsPushSection";
import { NotificationsQuietHoursSection } from "./categories/NotificationsQuietHoursSection";
import { PlaceholderSection } from "./categories/PlaceholderSection";
import { SessionsSection } from "./categories/SessionsSection";
import { useSessions } from "../../hooks/useSessions";
import {
  isSettingsViewId,
  SETTINGS_LAST_ACTIVE_KEY,
  SettingsTreeNav,
  type SettingsViewId,
} from "./SettingsTreeNav";

const ACTIVITY_EMOJI_PRESETS = [
  "💻", "🎧", "📞", "🧠", "⚡", "🛠️", "🚀", "☕",
  "📚", "🎯", "🧪", "📝", "🔒", "📊", "🎨", "🕹️",
  "🌙", "🔥", "✅", "⏳", "🧭", "💬", "🎥", "🎙️",
  "🧩", "🪄", "🧱", "🌌", "🏗️", "🕵️", "🧘", "🍵",
];

type Props = {
  initialViewId?: SettingsViewId;
  profile: Profile;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (data: { displayName?: string; bio?: string | null }) => Promise<boolean>;
  onUpdateActivity: (data: {
    activityText?: string | null;
    activityEmoji?: string | null;
  }) => Promise<boolean>;
  onUpdateQuietHours: (data: {
    quietFrom?: string | null;
    quietTo?: string | null;
    timezone?: string | null;
  }) => Promise<boolean>;
  onUploadAvatar: (file: File) => Promise<boolean>;
  onDeleteAvatar: () => Promise<boolean>;
  onUploadProfileBanner: (file: File) => Promise<boolean>;
  onDeleteProfileBanner: () => Promise<boolean>;
  onUploadProfileImage: (file: File) => Promise<boolean>;
  onDeleteProfileImage: (imageId: string) => Promise<boolean>;
  onTwoFactorChanged?: () => void;
  onLogout: () => Promise<void>;
};

function initialView(): SettingsViewId {
  if (typeof localStorage === "undefined") return "account-profile";
  try {
    const stored = localStorage.getItem(SETTINGS_LAST_ACTIVE_KEY);
    return isSettingsViewId(stored) && stored !== "install" ? stored : "account-profile";
  } catch {
    return "account-profile";
  }
}

function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function minutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function currentMinutesInTimezone(timezone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
    return hour * 60 + minute;
  } catch {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }
}

function isInQuietWindow(fromValue: string, toValue: string, timezone: string): boolean {
  const from = minutes(fromValue);
  const to = minutes(toValue);
  if (from == null || to == null || from === to) return false;
  const now = currentMinutesInTimezone(timezone);
  return from < to ? now >= from && now < to : now >= from || now < to;
}

function placeholderFor(view: SettingsViewId) {
  const map: Record<string, { eyebrow: string; title: string; version: string }> = {
    content: { eyebrow: "Контент и общение", title: "Контент и общение", version: "v1.5.55+" },
    "data-export": { eyebrow: "Данные", title: "Экспорт", version: "v1.5.55+" },
    integrations: { eyebrow: "Интеграции", title: "Интеграции", version: "v1.5.55+" },
    "voice-video": { eyebrow: "Голос и видео", title: "Голос и видео", version: "v1.5.55+" },
    developer: { eyebrow: "Разработчик", title: "Разработчик", version: "v1.5.55+" },
  };
  return map[view] ?? { eyebrow: "Настройки", title: "Раздел", version: "v1.5.55+" };
}

export function SettingsPanel({
  initialViewId,
  profile,
  busy,
  error,
  onClose,
  onSave,
  onUpdateActivity,
  onUpdateQuietHours,
  onUploadAvatar,
  onDeleteAvatar,
  onUploadProfileBanner,
  onDeleteProfileBanner,
  onUploadProfileImage,
  onDeleteProfileImage,
  onTwoFactorChanged,
  onLogout,
}: Props) {
  const [active, setActive] = useState<SettingsViewId>(
    () => initialViewId ?? initialView(),
  );
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [activityText, setActivityText] = useState(profile.activityText ?? "");
  const [activityEmoji, setActivityEmoji] = useState(profile.activityEmoji ?? "");
  const [activityBusy, setActivityBusy] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [show2FA, setShow2FA] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const bannerFileRef = useRef<HTMLInputElement>(null);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const push = usePushNotifications();
  const pushPrefs = usePushPreferences(push.enabled);
  const notificationSounds = useNotificationSoundSettings();
  const sessions = useSessions(active === "account-sessions");
  const [showPrefs, setShowPrefs] = useState(false);
  const install = useInstallPrompt();
  const autostart = useDesktopAutostart();
  const { density, setDensity } = useDensity();
  const focusDim = useFocusDim();
  const { changePassword, busy: pwdBusy } = useChangePassword();
  const [showPwd, setShowPwd] = useState(false);
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);
  const detectedTimezone = profile.timezone ?? browserTimezone();
  const [quietEnabled, setQuietEnabled] = useState(Boolean(profile.quietFrom && profile.quietTo));
  const [quietFrom, setQuietFrom] = useState(profile.quietFrom ?? "22:00");
  const [quietTo, setQuietTo] = useState(profile.quietTo ?? "08:00");
  const [quietTimezone] = useState(detectedTimezone);
  const [quietBusy, setQuietBusy] = useState(false);
  const [quietError, setQuietError] = useState<string | null>(null);
  const confirm = useConfirm();

  const twoFaOn = profile.twoFactorEnabled === true;
  const trimmedName = displayName.trim();
  const trimmedBio = bio.trim();
  const nameChanged = trimmedName !== profile.displayName.trim();
  const bioChanged = trimmedBio !== (profile.bio ?? "").trim();
  const canSave =
    !busy &&
    trimmedName.length >= 1 &&
    trimmedName.length <= 64 &&
    trimmedBio.length <= 280 &&
    (nameChanged || bioChanged);
  const trimmedActivity = activityText.trim();
  const trimmedEmoji = activityEmoji.trim();
  const activityChanged =
    trimmedActivity !== (profile.activityText ?? "").trim() ||
    trimmedEmoji !== (profile.activityEmoji ?? "").trim();
  const canSaveActivity =
    !activityBusy &&
    trimmedActivity.length <= 128 &&
    trimmedEmoji.length <= 64 &&
    activityChanged;
  const newPwdValid =
    newPwd.length >= 8 &&
    newPwd.length <= 128 &&
    /[A-Za-z]/.test(newPwd) &&
    /\d/.test(newPwd);
  const pwdMatch = confirmPwd === newPwd;
  const canChangePwd = !pwdBusy && curPwd.length >= 1 && newPwdValid && pwdMatch;
  const inQuietWindow = quietEnabled && isInQuietWindow(quietFrom, quietTo, quietTimezone);

  const handleSave = async () => {
    const data: { displayName?: string; bio?: string | null } = {};
    if (nameChanged) data.displayName = trimmedName;
    if (bioChanged) data.bio = trimmedBio === "" ? null : trimmedBio;
    if (Object.keys(data).length === 0) return;
    const ok = await onSave(data);
    if (ok) onClose();
  };

  const handleActivitySave = async () => {
    if (!canSaveActivity) return;
    setActivityBusy(true);
    setActivityError(null);
    const ok = await onUpdateActivity({
      activityText: trimmedActivity === "" ? null : trimmedActivity,
      activityEmoji: trimmedEmoji === "" ? null : trimmedEmoji,
    });
    if (!ok) setActivityError("Не удалось сохранить кастомный статус");
    setActivityBusy(false);
  };

  const handleActivityClear = async () => {
    if (activityBusy) return;
    const previousText = activityText;
    const previousEmoji = activityEmoji;
    setActivityText("");
    setActivityEmoji("");
    setActivityBusy(true);
    setActivityError(null);
    const ok = await onUpdateActivity({ activityText: null, activityEmoji: null });
    if (!ok) {
      setActivityText(previousText);
      setActivityEmoji(previousEmoji);
      setActivityError("Не удалось очистить кастомный статус");
    }
    setActivityBusy(false);
  };

  const handleChangePwd = async () => {
    if (!canChangePwd) return;
    setPwdError(null);
    setPwdDone(false);
    const result = await changePassword(curPwd, newPwd);
    if (result.ok) {
      setPwdDone(true);
      setCurPwd("");
      setNewPwd("");
      setConfirmPwd("");
    } else {
      setPwdError(result.error ?? "Не удалось сменить пароль");
    }
  };

  const takeFile = (e: ChangeEvent<HTMLInputElement>): File | null => {
    const file = e.target.files?.[0];
    e.target.value = "";
    return file ?? null;
  };

  const confirmDeleteAvatar = async () => {
    if (!(await confirm({
      title: "Удалить аватар?",
      message: "Вместо фотографии участники будут видеть инициалы. Новый аватар можно загрузить в любое время.",
      confirmLabel: "Удалить аватар",
      danger: true,
    }))) return;
    await onDeleteAvatar();
  };

  const confirmDeleteBanner = async () => {
    if (!(await confirm({
      title: "Удалить обложку?",
      message: "Профиль вернётся к стандартному оформлению Eclipse. Новую обложку можно добавить позже.",
      confirmLabel: "Удалить обложку",
      danger: true,
    }))) return;
    await onDeleteProfileBanner();
  };

  const confirmDeleteProfileImage = async (imageId: string) => {
    if (!(await confirm({
      title: "Удалить фотографию?",
      message: "Она исчезнет из публичной галереи профиля. Действие нельзя отменить.",
      confirmLabel: "Удалить фотографию",
      danger: true,
    }))) return;
    await onDeleteProfileImage(imageId);
  };

  const handleQuietSave = async () => {
    setQuietBusy(true);
    setQuietError(null);
    const payload = quietEnabled
      ? { quietFrom, quietTo, timezone: quietTimezone }
      : { quietFrom: null, quietTo: null, timezone: quietTimezone };
    const ok = await onUpdateQuietHours(payload);
    if (!ok) setQuietError("Не удалось сохранить тихие часы");
    setQuietBusy(false);
  };

  const renderContent = () => {
    if (active === "account-profile") {
      return (
        <AccountProfileSection
          profile={profile}
          busy={busy}
          error={error}
          displayName={displayName}
          bio={bio}
          trimmedName={trimmedName}
          trimmedBio={trimmedBio}
          canSave={canSave}
          avatarFileRef={avatarFileRef}
          bannerFileRef={bannerFileRef}
          galleryFileRef={galleryFileRef}
          onChangeDisplayName={setDisplayName}
          onChangeBio={setBio}
          onSave={() => void handleSave()}
          onAvatarFile={(event) => {
            const file = takeFile(event);
            if (file) void onUploadAvatar(file);
          }}
          onBannerFile={(event) => {
            const file = takeFile(event);
            if (file) void onUploadProfileBanner(file);
          }}
          onGalleryFile={(event) => {
            const file = takeFile(event);
            if (file) void onUploadProfileImage(file);
          }}
          onDeleteAvatar={() => void confirmDeleteAvatar()}
          onDeleteBanner={() => void confirmDeleteBanner()}
          onDeleteProfileImage={(imageId) => void confirmDeleteProfileImage(imageId)}
        />
      );
    }
    if (active === "account-security") {
      return (
        <AccountSecuritySection
          twoFaOn={twoFaOn}
          show2FA={show2FA}
          showPwd={showPwd}
          curPwd={curPwd}
          newPwd={newPwd}
          confirmPwd={confirmPwd}
          newPwdValid={newPwdValid}
          pwdMatch={pwdMatch}
          canChangePwd={canChangePwd}
          pwdBusy={pwdBusy}
          pwdError={pwdError}
          pwdDone={pwdDone}
          onToggle2FA={() => setShow2FA(true)}
          onClose2FA={() => setShow2FA(false)}
          onTwoFactorChanged={onTwoFactorChanged}
          onTogglePwd={() => {
            setShowPwd((value) => !value);
            setPwdError(null);
            setPwdDone(false);
          }}
          onCurPwd={setCurPwd}
          onNewPwd={setNewPwd}
          onConfirmPwd={setConfirmPwd}
          onChangePwd={() => void handleChangePwd()}
        />
      );
    }
    if (active === "account-sessions") {
      return (
        <SessionsSection
          sessions={sessions.sessions}
          loading={sessions.loading}
          error={sessions.error}
          onRetry={() => void sessions.reload()}
          onRevoke={sessions.revoke}
        />
      );
    }
    if (active === "activity-status") {
      return (
        <ActivitySection
          profile={profile}
          emojiPresets={ACTIVITY_EMOJI_PRESETS}
          activityText={activityText}
          activityEmoji={activityEmoji}
          trimmedActivity={trimmedActivity}
          trimmedEmoji={trimmedEmoji}
          activityBusy={activityBusy}
          activityError={activityError}
          canSaveActivity={canSaveActivity}
          onChangeText={setActivityText}
          onChangeEmoji={setActivityEmoji}
          onSave={() => void handleActivitySave()}
          onClear={() => void handleActivityClear()}
        />
      );
    }
    if (active === "notifications-push") {
      return (
        <NotificationsPushSection
          push={push}
          pushPrefs={pushPrefs}
          sounds={notificationSounds}
          showPrefs={showPrefs}
          onTogglePrefs={() => setShowPrefs((value) => !value)}
        />
      );
    }
    if (active === "notifications-quiet") {
      return (
        <NotificationsQuietHoursSection
          quietEnabled={quietEnabled}
          quietFrom={quietFrom}
          quietTo={quietTo}
          quietTimezone={quietTimezone}
          quietBusy={quietBusy}
          quietError={quietError}
          inQuietWindow={inQuietWindow}
          onToggle={setQuietEnabled}
          onFrom={setQuietFrom}
          onTo={setQuietTo}
          onSave={() => void handleQuietSave()}
        />
      );
    }
    if (active === "appearance") {
      return (
        <AppearanceSection
          density={density}
          onDensity={setDensity}
          focusEnabled={focusDim.enabled}
          onFocusEnabled={focusDim.setEnabled}
        />
      );
    }
    if (active === "install") {
      return <InstallSection install={install} autostart={autostart} />;
    }
    if (active === "hotkeys") return <HotkeysSection />;
    const placeholder = placeholderFor(active);
    return <PlaceholderSection {...placeholder} />;
  };

  return (
    <Modal title="Настройки" width={1120} onClose={onClose}>
      <div className="ec-settings-panel">
        <SettingsTreeNav
          active={active}
          installAvailable={install.canInstall || install.isIOS || autostart.supported}
          onSelect={setActive}
          onLogout={onLogout}
        />
        <main className="ec-settings-panel__main" aria-live="polite">
          {renderContent()}
        </main>
      </div>
    </Modal>
  );
}
