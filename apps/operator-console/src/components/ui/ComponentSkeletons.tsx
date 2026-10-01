import type { ComponentType } from 'react';
import type { View } from '../../types';
import { LoadingState } from './LoadingState';
import { DashboardSkeletonBar as Bar, DashboardCardSkeleton } from './DashboardCardSkeleton';

interface SkeletonProps { label: string; className?: string }
const collectionGrid = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),min(100%,20rem)))] gap-3';
const shell = 'min-w-0 rounded-section border border-border bg-card p-3';

/** Shared atoms, not a shared silhouette: each component owns its loading composition. */
export function SceneCardSkeleton() {
  return <div className={`${shell} space-y-3`}><div className="flex items-center gap-3"><Bar className="size-10 shrink-0" /><div className="flex-1 space-y-2"><Bar className="h-4 w-3/4" /><Bar className="h-3 w-1/2" /></div><Bar className="size-11 shrink-0" /></div><div className="flex gap-1.5"><Bar className="h-11 flex-1" /><Bar className="size-11" /><Bar className="size-11" /></div></div>;
}
export function AutomationRuleCardSkeleton() {
  return <div className={`${shell} space-y-3`}><div className="flex gap-3"><Bar className="size-10" /><Bar className="h-5 flex-1" /><Bar className="size-11" /></div><div className="grid grid-cols-[2rem_1fr] gap-2"><Bar className="h-4" /><Bar className="h-4" /><Bar className="h-4" /><Bar className="h-4 w-3/4" /></div><Bar className="h-11 w-full" /><div className="flex gap-2 border-t border-border pt-3"><Bar className="h-11 flex-1" /><Bar className="size-11" /><Bar className="size-11" /></div></div>;
}
export function ManagedDeviceTileSkeleton() {
  return <div className="flex items-center gap-3 rounded-control border border-border bg-card p-3"><Bar className="h-4 w-3/4 min-w-0 flex-1" /><Bar className="size-11 shrink-0" /></div>;
}
export function TopologyRoomCardSkeleton() {
  return <div className="flex min-h-20 items-center gap-3 rounded-panel border border-border bg-card p-3"><Bar className="size-11 shrink-0" /><div className="flex-1 space-y-2"><Bar className="h-4 w-2/3" /><Bar className="h-3 w-1/3" /></div></div>;
}
function ViewHeadingSkeleton() { return <div className="flex flex-wrap items-center justify-between gap-3"><div className="space-y-2"><Bar className="h-7 w-40" /><Bar className="h-4 w-56 max-w-full" /></div><Bar className="h-11 w-36" /></div>; }
export function ScenesSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className={collectionGrid}>{Array.from({ length: 3 }, (_, i) => <SceneCardSkeleton key={i} />)}</div></LoadingState>;
}
export function AutomationsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className={collectionGrid}>{Array.from({ length: 3 }, (_, i) => <AutomationRuleCardSkeleton key={i} />)}</div></LoadingState>;
}
export function DeviceManagerSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="flex flex-col gap-5 sm:flex-row sm:items-center"><Bar className="h-7 w-56" /><div className="ml-auto grid w-full max-w-[26rem] grid-cols-2 gap-3"><Bar className="h-16 w-full" /><Bar className="h-16 w-full" /></div></div><Bar className="h-5 w-32" /><div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,15rem),1fr))] gap-3 sm:gap-4">{Array.from({ length: 4 }, (_, i) => <ManagedDeviceTileSkeleton key={i} />)}</div></LoadingState>;
}
export function SpacesSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className="space-y-5 rounded-section border border-border bg-card p-4"><div className="flex items-center gap-3"><Bar className="size-11" /><Bar className="h-6 w-32" /></div><Bar className="h-11 w-full" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <TopologyRoomCardSkeleton key={i} />)}</div></div></LoadingState>;
}
export function HomeSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="homepilot-home-hero space-y-5 bg-card p-6 sm:p-8"><div className="space-y-2"><Bar className="h-10 w-56 max-w-full" /><Bar className="h-10 w-40" /></div><Bar className="h-5 w-1/2" /><div className="flex w-72 max-w-full gap-2">{Array.from({ length: 4 }, (_, i) => <Bar key={i} className="h-20 min-w-0 flex-1" />)}</div><div className="flex flex-wrap gap-2"><Bar className="h-10 w-24 rounded-pill" /><Bar className="h-10 w-40 rounded-pill" /><Bar className="h-10 w-36 rounded-pill" /></div><Bar className="ml-auto h-11 w-40 rounded-pill" /></div><Bar className="h-6 w-40" /><div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,9rem))] gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28"><DashboardCardSkeleton variant="control" /></div>)}</div></LoadingState>;
}
export function DisplayControlsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><Bar className="h-11 w-full" /><div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,8.5rem),1fr))] gap-3">{Array.from({ length: 4 }, (_, i) => <div key={i} className="h-28"><DashboardCardSkeleton variant="display" /></div>)}</div></LoadingState>;
}
export function DisplayCatalogSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="space-y-2"><Bar className="h-4 w-28" /><Bar className="h-6 w-40" /><Bar className="h-4 w-24" /></div><Bar className="h-5 w-48" />{Array.from({ length: 4 }, (_, i) => <div key={i} className="space-y-2 border-b border-border py-3"><Bar className="h-5 w-1/2" /><Bar className="h-4 w-3/4" /></div>)}</LoadingState>;
}
export function CamerasSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <DashboardCardSkeleton key={i} variant="camera" />)}</div></LoadingState>;
}
export function DeviceInspectorSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="flex gap-3"><Bar className="size-12" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-4 w-24" /><Bar className="h-7 w-3/4" /></div><Bar className="size-11" /></div><Bar className="h-11 w-full" /><div className="grid gap-3">{Array.from({ length: 2 }, (_, i) => <div key={i} className={`${shell} space-y-2`}><Bar className="h-4 w-1/2" /><Bar className="h-5 w-full" /></div>)}<div className={`${shell} space-y-2`}><Bar className="h-4 w-1/2" /><Bar className="h-11 w-full" /><Bar className="h-4 w-full" /></div><div className={`${shell} space-y-2`}><Bar className="h-4 w-1/2" /><Bar className="h-5 w-full" /><Bar className="h-11 w-full" /></div><div className={`${shell} space-y-2`}><Bar className="h-4 w-1/2" /><Bar className="h-11 w-full" /></div></div></LoadingState>;
}
export function AutomationEditorSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><Bar className="h-11 w-full" /><div className="grid gap-4 md:grid-cols-2">{['trigger', 'action'].map(part => <div key={part} className={`${shell} space-y-4`}><Bar className="h-6 w-24" /><Bar className="h-11 w-full" /><Bar className="h-11 w-full" /></div>)}</div></LoadingState>;
}
export function IconPickerSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="grid grid-cols-5 gap-2">{Array.from({ length: 20 }, (_, i) => <Bar key={i} className="aspect-square w-full" />)}</div></LoadingState>;
}
export function AssistantSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><Bar className="h-16 w-4/5" /><Bar className="ml-auto h-12 w-3/5" /><Bar className="h-24 w-4/5" /><Bar className="h-12 w-full" /></LoadingState>;
}
export function AuditLogsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton />{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-col gap-5 rounded-panel border border-border bg-card p-5 md:flex-row"><div className="space-y-2 md:w-44"><Bar className="h-4 w-24" /><Bar className="h-4 w-32" /><Bar className="h-3 w-20" /></div><div className="flex-1 space-y-3"><Bar className="h-5 w-4/5" /><Bar className="h-4 w-1/2" /></div></div>)}</LoadingState>;
}
export function ExecutionsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton />{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center gap-4 rounded-dashboard border border-border bg-card p-5"><Bar className="size-12 shrink-0" /><div className="flex-1 space-y-2"><Bar className="h-3 w-1/3" /><Bar className="h-5 w-3/4" /></div><Bar className="h-6 w-20" /><Bar className="size-11" /></div>)}</LoadingState>;
}
export function DashboardHistorySkeleton(props: SkeletonProps) {
  return <LoadingState {...props}>{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border bg-muted/15 p-3"><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-2/3" /><Bar className="h-4 w-full" /></div><Bar className="h-11 w-28" /></div>)}</LoadingState>;
}
export function DiscoverySkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><Bar className="ml-auto h-16 w-[26rem] max-w-full" /><Bar className="h-5 w-32" /><div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className={`${shell} space-y-3`}><div className="flex items-center gap-3"><Bar className="h-4 flex-1" /><Bar className="size-11" /></div><div className="flex gap-2"><Bar className="h-11 flex-1" /><Bar className="h-11 w-20" /></div></div>)}</div></LoadingState>;
}
export function HaDiscoverySkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="flex flex-wrap justify-between gap-3"><Bar className="h-11 w-80 max-w-full" /><Bar className="ml-auto h-16 w-52" /></div><div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className={`${shell} flex flex-col gap-3`}><div className="flex-1 space-y-2"><Bar className="h-5 w-3/4" /><Bar className="h-4 w-full" /></div><Bar className="h-11 w-24" /></div>)}</div></LoadingState>;
}
export function NativeCameraSettingsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-5 rounded-card border border-border bg-card p-5"><div className="flex gap-3"><Bar className="size-10" /><div className="flex-1 space-y-2"><Bar className="h-6 w-3/4" /><Bar className="h-4 w-20" /></div></div>{Array.from({ length: 3 }, (_, j) => <div key={j} className="flex justify-between gap-4"><Bar className="h-4 w-20" /><Bar className="h-4 w-28" /></div>)}</div>)}</div></LoadingState>;
}
export function SystemStatusSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="min-h-40 space-y-5 rounded-card border border-border bg-card p-5"><div className="flex justify-between"><Bar className="size-10" /><Bar className="h-6 w-12" /></div><div className="space-y-2"><Bar className="h-5 w-1/2" /><Bar className="h-4 w-4/5" /></div></div>)}</div><div className="space-y-3 rounded-card border border-border bg-card p-5"><Bar className="h-5 w-40" /><Bar className="h-4 w-3/4" /></div></LoadingState>;
}
export function SettingsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className="space-y-5 rounded-section border border-border bg-card p-4">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-2"><Bar className="h-4 w-32" /><Bar className="h-11 w-full" /></div>)}</div></LoadingState>;
}
export function HomePersonalizationSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="space-y-4">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-2"><Bar className="h-4 w-28" /><Bar className="h-24 w-full" /></div>)}</div><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{Array.from({ length: 5 }, (_, i) => <Bar key={i} className="aspect-video w-full" />)}</div></LoadingState>;
}
export function DashboardsSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><Bar className="h-11 w-2/3" /><div className="grid gap-4 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="space-y-3 rounded-section border border-border bg-card p-4"><Bar className="h-6 w-1/2" /><div className="grid grid-cols-2 gap-3"><Bar className="h-28" /><Bar className="h-28" /></div></div>)}</div></LoadingState>;
}
export function UsersSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><ViewHeadingSkeleton /><div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,19rem),1fr))] gap-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className={`${shell} space-y-3`}><div className="flex items-center gap-3"><Bar className="size-11 rounded-full" /><div className="flex-1 space-y-2"><Bar className="h-5 w-3/4" /><Bar className="h-4 w-1/2" /></div></div><div className="space-y-2"><Bar className="h-4 w-32" /><Bar className="h-11 w-full" /></div><div className="flex items-center justify-between gap-2"><Bar className="h-6 w-20" /><div className="flex gap-1"><Bar className="size-11" /><Bar className="size-11" /><Bar className="size-11" /></div></div></div>)}</div></LoadingState>;
}
export function DiagnosticsResilienceSkeleton() {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card p-4"><div className="min-w-0 flex-1 space-y-1"><Bar className="h-4 w-3/4" /><Bar className="h-8 w-full" /></div><Bar className="size-11 shrink-0" /></div>)}</div>;
}
export function DiagnosticsHealthSkeleton() {
  return <div className="flex flex-col justify-between gap-6 rounded-2xl border-2 border-border bg-card p-6 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-4"><Bar className="size-10 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-8 w-full" /><Bar className="h-6 w-full" /></div></div><div className="flex flex-col gap-6 sm:flex-row"><div className="space-y-2"><Bar className="h-4 w-32" /><Bar className="h-6 w-36" /><Bar className="h-9 w-36" /></div><div className="space-y-2"><Bar className="h-4 w-28" /><Bar className="h-6 w-24" /></div></div></div>;
}
export function DiagnosticsProbeSkeleton() {
  return <><Bar className="mb-4 mt-8 h-4 w-40" /><div className="grid grid-cols-1 gap-6 md:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex flex-col gap-6 rounded-2xl border border-border bg-card p-5"><div className="flex items-center justify-between gap-2"><Bar className="h-6 w-1/2" /><Bar className="h-4 w-16" /></div><div className="space-y-3"><Bar className="h-5 w-full" /><Bar className="h-8 w-full" /><Bar className="h-4 w-full" /></div></div>)}</div></>;
}
export function DiagnosticsBackupsSkeleton() {
  return <div className="space-y-3 rounded-card border border-border bg-card p-4 sm:p-5"><div className="flex justify-between gap-3"><div className="flex-1 space-y-2"><Bar className="h-5 w-1/2" /><Bar className="h-9 w-full" /></div><Bar className="size-10" /></div><Bar className="h-20 w-full" /><Bar className="h-12 w-full" /><Bar className="h-10 w-full" /><Bar className="h-4 w-full" /></div>;
}
export function DiagnosticsTimelineSkeleton() {
  return <div className="space-y-4 pt-4"><Bar className="h-4 w-32" /><div className="grid gap-3 sm:max-w-lg sm:grid-cols-2"><Bar className="h-16 w-full" /><Bar className="h-16 w-full" /></div><Bar className="h-4 w-56 max-w-full" /><div className="divide-y divide-border rounded-2xl border border-border bg-card">{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex gap-4 p-4"><Bar className="h-4 w-20 shrink-0" /><div className="min-w-0 flex-1 space-y-2"><Bar className="h-5 w-3/4" /><Bar className="h-5 w-full" /></div></div>)}</div></div>;
}
export function DiagnosticsSkeleton({ isAdmin = true, ...props }: SkeletonProps & { isAdmin?: boolean }) {
  return <LoadingState {...props}><div className="space-y-6 pb-10 sm:space-y-8"><DiagnosticsResilienceSkeleton /><DiagnosticsHealthSkeleton /><DiagnosticsProbeSkeleton />{isAdmin && <DiagnosticsBackupsSkeleton />}<DiagnosticsTimelineSkeleton /></div></LoadingState>;
}
export function EnergySkeleton(props: SkeletonProps) {
  return <div className="space-y-6"><div aria-hidden="true"><ViewHeadingSkeleton /></div><EnergyDataSkeleton {...props} /></div>;
}
export function EnergyDataSkeleton(props: SkeletonProps) {
  return <LoadingState {...props}><div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 2 }, (_, i) => <div key={i} className="space-y-5 rounded-card border border-border bg-card p-6"><div className="flex gap-3"><Bar className="size-10" /><Bar className="h-4 flex-1" /></div><Bar className="h-14 w-1/2" /></div>)}</div><Bar className="h-4 w-40" />{Array.from({ length: 3 }, (_, i) => <div key={i} className="flex items-center justify-between gap-3 rounded-control bg-card p-4"><Bar className="h-5 w-1/2" /><Bar className="h-5 w-16" /></div>)}</LoadingState>;
}
export function ViewSkeleton({ view, section, ...props }: SkeletonProps & { view: View; section?: 'scenes' | 'automations' }) {
  const components: Partial<Record<View, ComponentType<SkeletonProps>>> = {
    dashboard: HomeSkeleton, spaces: SpacesSkeleton, routines: section === 'automations' ? AutomationsSkeleton : ScenesSkeleton,
    dashboards: DashboardsSkeleton, assistant: AssistantSkeleton, 'home-conversation': AssistantSkeleton,
    energy: EnergySkeleton, 'system-devices': DeviceManagerSkeleton, 'system-inbox': DiscoverySkeleton,
    'system-cameras': NativeCameraSettingsSkeleton, 'system-users': UsersSkeleton, 'system-audit': AuditLogsSkeleton,
    'system-executions': ExecutionsSkeleton, 'system-diagnostics': DiagnosticsSkeleton, 'resilience-showcase': SystemStatusSkeleton,
    'system-home-personalization': HomePersonalizationSkeleton, 'system-ha': SettingsSkeleton, 'system-onboarding': SettingsSkeleton,
  };
  const Skeleton = components[view] ?? SettingsSkeleton;
  return <Skeleton {...props} />;
}
