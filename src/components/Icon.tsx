import React from "react";
import {
  // Place icons (the 18 curated subset from design-system README)
  House,
  Briefcase,
  Dumbbell,
  Coffee,
  BookOpen,
  ShoppingBag,
  Plane,
  Car,
  Heart,
  Music,
  Utensils,
  Bed,
  Baby,
  TreePine,
  Waves,
  Mountain,
  MapPin,
  Star,
  // System icons used across screens
  ChevronLeft,
  ChevronRight,
  X,
  Plus,
  Search,
  Check,
  Bell,
  Moon,
  Globe,
  Download,
  Clock,
  Lock,
  ChartBar,
  Settings,
  Info,
  TriangleAlert,
  CircleAlert,
  Trash2,
  Repeat,
  type LucideProps,
} from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";

// Stable string-based name → lucide component map.
// Keys use kebab-case to match the design-system source (Icon.jsx).
// We deliberately restrict the surface area to the 18 place icons + the
// system icons referenced by Plan 1/Plan 2 screens — adding new ones here
// is the only allowed extension point.
const ICONS = {
  // Place icons
  home: House,
  briefcase: Briefcase,
  dumbbell: Dumbbell,
  coffee: Coffee,
  "book-open": BookOpen,
  "shopping-bag": ShoppingBag,
  plane: Plane,
  car: Car,
  heart: Heart,
  music: Music,
  utensils: Utensils,
  bed: Bed,
  baby: Baby,
  "tree-pine": TreePine,
  waves: Waves,
  mountain: Mountain,
  "map-pin": MapPin,
  star: Star,
  // System icons
  "chevron-left": ChevronLeft,
  "chevron-right": ChevronRight,
  x: X,
  plus: Plus,
  search: Search,
  check: Check,
  bell: Bell,
  moon: Moon,
  globe: Globe,
  download: Download,
  clock: Clock,
  lock: Lock,
  "bar-chart": ChartBar,
  settings: Settings,
  info: Info,
  "alert-triangle": TriangleAlert,
  "alert-circle": CircleAlert,
  "trash-2": Trash2,
  repeat: Repeat,
} as const;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  testID?: string;
} & Omit<LucideProps, "size" | "color" | "strokeWidth">;

export function Icon({ name, size = 24, color, strokeWidth = 1.75, ...rest }: Props) {
  const t = useTheme();
  const Component = ICONS[name];
  const resolvedColor = color ?? t.color("color.fg");
  return <Component size={size} color={resolvedColor} strokeWidth={strokeWidth} {...rest} />;
}
