import { ChartPieSliceIcon } from "@phosphor-icons/react/dist/csr/ChartPieSlice";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { UsersThreeIcon } from "@phosphor-icons/react/dist/csr/UsersThree";
import { GraphIcon } from "@phosphor-icons/react/dist/csr/Graph";
import { UserCircleIcon } from "@phosphor-icons/react/dist/csr/UserCircle";
import { ShieldCheckIcon } from "@phosphor-icons/react/dist/csr/ShieldCheck";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { PlusIcon } from "@phosphor-icons/react/dist/csr/Plus";
import { SignInIcon } from "@phosphor-icons/react/dist/csr/SignIn";
import { SignOutIcon } from "@phosphor-icons/react/dist/csr/SignOut";
import { BellSimpleIcon } from "@phosphor-icons/react/dist/csr/BellSimple";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CopySimpleIcon } from "@phosphor-icons/react/dist/csr/CopySimple";
import { UserPlusIcon } from "@phosphor-icons/react/dist/csr/UserPlus";
import { SpeakerSlashIcon } from "@phosphor-icons/react/dist/csr/SpeakerSlash";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { FolderPlusIcon } from "@phosphor-icons/react/dist/csr/FolderPlus";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { LockKeyIcon } from "@phosphor-icons/react/dist/csr/LockKey";
import { CompassIcon } from "@phosphor-icons/react/dist/csr/Compass";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { TrashIcon } from "@phosphor-icons/react/dist/csr/Trash";
import { PencilSimpleIcon } from "@phosphor-icons/react/dist/csr/PencilSimple";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/csr/DotsThree";
import { UploadSimpleIcon } from "@phosphor-icons/react/dist/csr/UploadSimple";
import { ArrowsOutIcon } from "@phosphor-icons/react/dist/csr/ArrowsOut";
import { ArrowsInIcon } from "@phosphor-icons/react/dist/csr/ArrowsIn";
import { CursorIcon } from "@phosphor-icons/react/dist/csr/Cursor";
import { CircleNotchIcon } from "@phosphor-icons/react/dist/csr/CircleNotch";
import { CheckSquareOffsetIcon } from "@phosphor-icons/react/dist/csr/CheckSquareOffset";
import { CheckIcon } from "@phosphor-icons/react/dist/csr/Check";
import { DiamondIcon } from "@phosphor-icons/react/dist/csr/Diamond";
import { ArrowClockwiseIcon } from "@phosphor-icons/react/dist/csr/ArrowClockwise";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { ListChecksIcon } from "@phosphor-icons/react/dist/csr/ListChecks";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowBendUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowBendUpLeft";
import { SmileyIcon } from "@phosphor-icons/react/dist/csr/Smiley";
import { PaperclipIcon } from "@phosphor-icons/react/dist/csr/Paperclip";
import { MicrophoneIcon } from "@phosphor-icons/react/dist/csr/Microphone";
import { FileIcon } from "@phosphor-icons/react/dist/csr/File";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { PushPinIcon } from "@phosphor-icons/react/dist/csr/PushPin";
import { BookmarkSimpleIcon } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";

// Phosphor (MIT). Individual imports keep the development module graph small.
const icons = {
  overview: ChartPieSliceIcon, chat: ChatsCircleIcon, people: UsersThreeIcon,
  office: GraphIcon, profile: UserCircleIcon, shield: ShieldCheckIcon,
  settings: GearSixIcon, plus: PlusIcon, enter: SignInIcon, leave: SignOutIcon,
  notifications: BellSimpleIcon, search: MagnifyingGlassIcon, close: XIcon,
  chevron: CaretDownIcon, "copy-id": CopySimpleIcon, invite: UserPlusIcon,
  "hide-muted": SpeakerSlashIcon, "create-channel": HashIcon,
  "create-category": FolderPlusIcon, "create-event": CalendarBlankIcon,
  incident: LockKeyIcon, guide: CompassIcon, "channels-roles": SlidersHorizontalIcon,
  members: UsersThreeIcon, external: ArrowSquareOutIcon, delete: TrashIcon,
  edit: PencilSimpleIcon, more: DotsThreeIcon, upload: UploadSimpleIcon,
  expand: ArrowsOutIcon, collapse: ArrowsInIcon, cursor: CursorIcon, orbit: CircleNotchIcon,
  task: CheckSquareOffsetIcon, check: CheckIcon, decision: DiamondIcon,
  followup: ArrowClockwiseIcon, risk: WarningIcon, requirement: ListChecksIcon,
  arrow: ArrowRightIcon,
  reply: ArrowBendUpLeftIcon, smile: SmileyIcon, attach: PaperclipIcon,
  microphone: MicrophoneIcon, file: FileIcon, play: PlayIcon,
  pin: PushPinIcon, memory: BookmarkSimpleIcon, send: PaperPlaneTiltIcon,
} as const;
export type EclipseUiIconName = keyof typeof icons;
export function EclipseUiIcon({ name, size = 20, className = "" }: {
  name: EclipseUiIconName; size?: number; className?: string;
}) {
  const Icon = icons[name];
  return <Icon size={size} weight="regular" data-icon={name} className={`ec-ui-icon ${className}`} aria-hidden="true" focusable="false" />;
}
