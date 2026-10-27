declare module 'drizzle-orm' {
  export const sql: any;
  export const eq: any;
  export const ne: any;
  export const and: any;
  export const asc: any;
  export const desc: any;
  export type SQL<T = unknown> = any;
  export type SQLWrapper = any;
  export type InferSelectModel<T> = any;
  export type InferInsertModel<T> = any;
  const all: Record<string, any>;
  export default all;
}

declare module 'drizzle-orm/pg-core' {
  export const pgTable: any;
  export const text: any;
  export const numeric: any;
  export const date: any;
  export const timestamp: any;
  export const uniqueIndex: any;
  export const uuid: any;
  const all: Record<string, any>;
  export default all;
}

declare module 'drizzle-orm/node-postgres' {
  export const drizzle: any;
  export type NodePgDatabase<T = any> = any;
  const all: Record<string, any>;
  export default all;
}

declare module 'lucide-react' {
  import * as React from 'react';
  export interface LucideProps extends React.SVGProps<SVGSVGElement> {
    size?: string | number;
    color?: string;
    strokeWidth?: string | number;
    className?: string;
  }
  export type LucideIcon = React.FC<LucideProps>;
  export const AlertCircle: LucideIcon;
  export const ArrowDownToLine: LucideIcon;
  export const ArrowRight: LucideIcon;
  export const ArrowUpRight: LucideIcon;
  export const Check: LucideIcon;
  export const CheckCircle2: LucideIcon;
  export const ChevronRight: LucideIcon;
  export const ChevronDown: LucideIcon;
  export const CircleHelp: LucideIcon;
  export const FilePlus2: LucideIcon;
  export const LayoutDashboard: LucideIcon;
  export const Layers3: LucideIcon;
  export const LoaderCircle: LucideIcon;
  export const Menu: LucideIcon;
  export const ScanLine: LucideIcon;
  export const Search: LucideIcon;
  export const Settings: LucideIcon;
  export const Settings2: LucideIcon;
  export const ShieldCheck: LucideIcon;
  export const TableProperties: LucideIcon;
  export const X: LucideIcon;
  export const Zap: LucideIcon;
  export const Barcode: LucideIcon;
  export const Camera: LucideIcon;
  export const FileScan: LucideIcon;
  export const Keyboard: LucideIcon;
  export const Pencil: LucideIcon;
  export const Trash2: LucideIcon;
  export const CalendarDays: LucideIcon;
  export const CircleDollarSign: LucideIcon;
  export const FileCheck2: LucideIcon;
  export const FileSpreadsheet: LucideIcon;
  export const Files: LucideIcon;
  export const BadgeCheck: LucideIcon;
  export const Sparkles: LucideIcon;
  const icons: Record<string, LucideIcon>;
  export default icons;
}
