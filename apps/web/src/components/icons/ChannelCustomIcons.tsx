import type { ChannelType } from "../../lib/socket";
import { ChatsCircleIcon } from "@phosphor-icons/react/dist/csr/ChatsCircle";
import { BellSimpleIcon } from "@phosphor-icons/react/dist/csr/BellSimple";
import { MegaphoneIcon } from "@phosphor-icons/react/dist/csr/Megaphone";
import { PushPinIcon } from "@phosphor-icons/react/dist/csr/PushPin";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { LightbulbIcon } from "@phosphor-icons/react/dist/csr/Lightbulb";
import { BrainIcon } from "@phosphor-icons/react/dist/csr/Brain";
import { TargetIcon } from "@phosphor-icons/react/dist/csr/Target";
import { RocketLaunchIcon } from "@phosphor-icons/react/dist/csr/RocketLaunch";
import { FlameIcon } from "@phosphor-icons/react/dist/csr/Flame";
import { FlowArrowIcon } from "@phosphor-icons/react/dist/csr/FlowArrow";
import { HammerIcon } from "@phosphor-icons/react/dist/csr/Hammer";
import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { WrenchIcon } from "@phosphor-icons/react/dist/csr/Wrench";
import { PackageIcon } from "@phosphor-icons/react/dist/csr/Package";
import { ChartBarIcon } from "@phosphor-icons/react/dist/csr/ChartBar";
import { TrendUpIcon } from "@phosphor-icons/react/dist/csr/TrendUp";
import { CoinsIcon } from "@phosphor-icons/react/dist/csr/Coins";
import { VaultIcon } from "@phosphor-icons/react/dist/csr/Vault";
import { DiamondIcon } from "@phosphor-icons/react/dist/csr/Diamond";
import { PaletteIcon } from "@phosphor-icons/react/dist/csr/Palette";
import { GameControllerIcon } from "@phosphor-icons/react/dist/csr/GameController";
import { FilmStripIcon } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { MusicNotesIcon } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { MonitorIcon } from "@phosphor-icons/react/dist/csr/Monitor";
import { CoffeeIcon } from "@phosphor-icons/react/dist/csr/Coffee";
import { PizzaIcon } from "@phosphor-icons/react/dist/csr/Pizza";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { MoonStarsIcon } from "@phosphor-icons/react/dist/csr/MoonStars";
import { StarIcon } from "@phosphor-icons/react/dist/csr/Star";
import { HashIcon } from "@phosphor-icons/react/dist/csr/Hash";
import { KanbanIcon } from "@phosphor-icons/react/dist/csr/Kanban";

// Phosphor 2.1.10, MIT. One regular-weight family; legacy ec:* IDs stay stable.
const icons = {
  "ec:chat": ChatsCircleIcon,
  "ec:bell": BellSimpleIcon,
  "ec:announce": MegaphoneIcon,
  "ec:pin": PushPinIcon,
  "ec:voice": SpeakerHighIcon,
  "ec:idea": LightbulbIcon,
  "ec:brain": BrainIcon,
  "ec:target": TargetIcon,
  "ec:rocket": RocketLaunchIcon,
  "ec:flame": FlameIcon,
  "ec:flow": FlowArrowIcon,
  "ec:tools": HammerIcon,
  "ec:gear": GearSixIcon,
  "ec:wrench": WrenchIcon,
  "ec:box": PackageIcon,
  "ec:bars": ChartBarIcon,
  "ec:trend": TrendUpIcon,
  "ec:money": CoinsIcon,
  "ec:vault": VaultIcon,
  "ec:gem": DiamondIcon,
  "ec:paint": PaletteIcon,
  "ec:game": GameControllerIcon,
  "ec:film": FilmStripIcon,
  "ec:music": MusicNotesIcon,
  "ec:screen": MonitorIcon,
  "ec:coffee": CoffeeIcon,
  "ec:pizza": PizzaIcon,
  "ec:globe": GlobeHemisphereWestIcon,
  "ec:moon": MoonStarsIcon,
  "ec:star": StarIcon,
};
export type ChannelIconId = keyof typeof icons;
export type ChannelIconPreset = { id: ChannelIconId; label: string; tone: "gold" };
export const CHANNEL_ICON_PRESETS: readonly ChannelIconPreset[] = [
  { id: "ec:chat", label: "Чат", tone: "gold" },
  { id: "ec:bell", label: "Сигнал", tone: "gold" },
  { id: "ec:announce", label: "Анонс", tone: "gold" },
  { id: "ec:pin", label: "Пин", tone: "gold" },
  { id: "ec:voice", label: "Эфир", tone: "gold" },
  { id: "ec:idea", label: "Идея", tone: "gold" },
  { id: "ec:brain", label: "Мозг", tone: "gold" },
  { id: "ec:target", label: "Цель", tone: "gold" },
  { id: "ec:rocket", label: "Запуск", tone: "gold" },
  { id: "ec:flame", label: "Горячее", tone: "gold" },
  { id: "ec:flow", label: "Поток", tone: "gold" },
  { id: "ec:tools", label: "Сборка", tone: "gold" },
  { id: "ec:gear", label: "Система", tone: "gold" },
  { id: "ec:wrench", label: "Ремонт", tone: "gold" },
  { id: "ec:box", label: "Релиз", tone: "gold" },
  { id: "ec:bars", label: "Метрики", tone: "gold" },
  { id: "ec:trend", label: "Рост", tone: "gold" },
  { id: "ec:money", label: "Деньги", tone: "gold" },
  { id: "ec:vault", label: "Сейф", tone: "gold" },
  { id: "ec:gem", label: "Премиум", tone: "gold" },
  { id: "ec:paint", label: "Дизайн", tone: "gold" },
  { id: "ec:game", label: "Игры", tone: "gold" },
  { id: "ec:film", label: "Видео", tone: "gold" },
  { id: "ec:music", label: "Музыка", tone: "gold" },
  { id: "ec:screen", label: "Экран", tone: "gold" },
  { id: "ec:coffee", label: "Кофе", tone: "gold" },
  { id: "ec:pizza", label: "Пицца", tone: "gold" },
  { id: "ec:globe", label: "Мир", tone: "gold" },
  { id: "ec:moon", label: "Ночь", tone: "gold" },
  { id: "ec:star", label: "Избранное", tone: "gold" },
] as const;

export function isCustomChannelIcon(value: string | null | undefined): value is ChannelIconId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(icons, value));
}
export function getChannelIconLabel(value: string | null | undefined, type: ChannelType): string {
  if (isCustomChannelIcon(value)) return CHANNEL_ICON_PRESETS.find(item => item.id === value)?.label ?? "Иконка";
  if (type === "VOICE") return "Голосовой канал";
  if (type === "BROADCAST") return "Канал вещания";
  if (type === "EXECUTION") return "Канал задач";
  return "Текстовый канал";
}
export function ChannelGlyph({ type, icon, size = 16, className = "" }: {
  type: ChannelType; icon?: string | null; size?: number; className?: string;
}) {
  // Old emoji choices remain stored, but channel navigation uses semantic icons.
  // This does not affect emoji in messages or uploaded workspace artwork.
  const Icon = isCustomChannelIcon(icon) ? icons[icon]
    : type === "VOICE" ? SpeakerHighIcon : type === "BROADCAST" ? MegaphoneIcon
    : type === "EXECUTION" ? KanbanIcon : HashIcon;
  return <span className={`ec-channel-glyph ec-channel-glyph--eclipse ${className}`} aria-hidden="true">
    <Icon size={size} weight="regular" focusable={false} />
  </span>;
}
