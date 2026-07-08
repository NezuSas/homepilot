$ErrorActionPreference = "Stop"

function Write-FileUtf8NoBom {
  param([string]$Path, [string]$Content)
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $Path), $Content, $encoding)
}

function Replace-InFile {
  param([string]$Path, [string]$Old, [string]$New)
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "SKIP missing: $Path" -ForegroundColor Yellow
    return
  }
  $content = Get-Content -LiteralPath $Path -Raw
  $updated = $content.Replace($Old, $New)
  if ($updated -ne $content) {
    Write-FileUtf8NoBom -Path $Path -Content $updated
    Write-Host "OK replace: $Path" -ForegroundColor Green
  }
}

function Regex-InFile {
  param([string]$Path, [string]$Pattern, [string]$Replacement)
  if (-not (Test-Path -LiteralPath $Path)) {
    Write-Host "SKIP missing: $Path" -ForegroundColor Yellow
    return
  }
  $content = Get-Content -LiteralPath $Path -Raw
  $updated = [regex]::Replace($content, $Pattern, $Replacement)
  if ($updated -ne $content) {
    Write-FileUtf8NoBom -Path $Path -Content $updated
    Write-Host "OK regex: $Path" -ForegroundColor Green
  }
}

$rootCheck = "apps/operator-console/src/views/dashboards"
if (-not (Test-Path -LiteralPath $rootCheck)) {
  throw "Ejecuta este script desde la raíz del repo homepilot. No encuentro $rootCheck"
}

# 1) Dashboard shell: mismo color base para tarjetas normales y tarjetas de dispositivos.
# El estado activo debe mostrarse por icono/acento interno, no cambiando toda la tarjeta.
$dashboardWidgetPath = "apps/operator-console/src/views/dashboards/DashboardWidget.tsx"
Replace-InFile $dashboardWidgetPath '!isSection && !isCamera && !accentColor && isDevice && "bg-card/95 dark:bg-background/55 backdrop-blur-3xl border border-border/50 shadow-xl"' '!isSection && !isCamera && !accentColor && isDevice && "bg-card border border-border/60 shadow-xl"'
Replace-InFile $dashboardWidgetPath '!isSection && !isCamera && !accentColor && isDevice && "bg-card/95 dark:bg-card/90 backdrop-blur-3xl border border-border/50 shadow-xl"' '!isSection && !isCamera && !accentColor && isDevice && "bg-card border border-border/60 shadow-xl"'
Replace-InFile $dashboardWidgetPath '"relative h-full w-full overflow-hidden transition-all duration-300 group @container"' '"relative h-full w-full min-h-0 overflow-hidden transition-all duration-300 group @container touch-manipulation"'
Replace-InFile $dashboardWidgetPath '"relative h-full w-full min-h-0 overflow-hidden transition-all duration-300 group @container"' '"relative h-full w-full min-h-0 overflow-hidden transition-all duration-300 group @container touch-manipulation"'
Replace-InFile $dashboardWidgetPath ' : "rounded-[2rem]",' ' : "rounded-[1.5rem] sm:rounded-[2rem]",'
Replace-InFile $dashboardWidgetPath '<div className="h-full w-full">' '<div className="h-full w-full min-h-0">'
Replace-InFile $dashboardWidgetPath 'className="absolute bottom-1 right-1 z-40 w-8 h-8 flex items-end justify-end p-2 cursor-nwse-resize group/resize opacity-0 group-hover:opacity-100 transition-opacity active:scale-95"' 'className="absolute bottom-1 right-1 z-40 hidden h-8 w-8 cursor-nwse-resize items-end justify-end p-2 opacity-0 transition-opacity active:scale-95 group-hover:opacity-100 group/resize lg:flex"'

# 2) DashboardCanvas: mejorar espacios por pantalla y evitar edición en responsive.
$canvasPath = "apps/operator-console/src/views/dashboards/DashboardCanvas.tsx"
Replace-InFile $canvasPath '"relative w-full grid gap-3 transition-all duration-500 sm:gap-4"' '"relative w-full grid gap-2.5 transition-all duration-500 sm:gap-3 lg:gap-4"'
Replace-InFile $canvasPath '"min-w-0 min-h-0 select-none transition-all duration-300 relative rounded-[1.75rem] sm:rounded-[2.5rem]"' '"min-w-0 min-h-0 select-none transition-all duration-300 relative rounded-[1.5rem] sm:rounded-[2rem] lg:rounded-[2.5rem]"'
Replace-InFile $canvasPath 'const MAX_ROW_HEIGHT = 80;' 'const MAX_ROW_HEIGHT = 80;'

# 3) DeviceWidget: layout más estable en móviles/tablets, sin overflow.
$devicePath = "apps/operator-console/src/views/dashboards/widgets/DeviceWidget.tsx"
Replace-InFile $devicePath '"relative h-full w-full flex flex-row items-center gap-3 px-3 py-2 @md:px-4 transition-all duration-300 select-none group focus:outline-none"' '"relative h-full w-full min-w-0 min-h-0 flex flex-row items-center gap-3 px-3 py-2 @md:px-4 transition-all duration-300 select-none group focus:outline-none"'
Replace-InFile $devicePath '"relative h-full w-full flex flex-col items-center justify-center p-3 @md:p-4 transition-all duration-300 select-none group focus:outline-none"' '"relative h-full w-full min-w-0 min-h-0 flex flex-col items-center justify-center p-3 @md:p-4 transition-all duration-300 select-none group focus:outline-none"'
Replace-InFile $devicePath '<div className="flex-1 min-w-0 text-left">' '<div className="flex-1 min-w-0 overflow-hidden text-left">'
Replace-InFile $devicePath '<div className="w-full min-w-0 text-center mt-auto pb-1">' '<div className="w-full min-w-0 overflow-hidden text-center mt-auto pb-1">'
Replace-InFile $devicePath '"text-xs sm:text-sm font-bold tracking-tight leading-none truncate"' '"text-[clamp(0.72rem,3.5cqi,0.95rem)] font-bold tracking-tight leading-none truncate"'
Replace-InFile $devicePath '"text-[clamp(0.7rem,3cqi,1rem)] font-bold tracking-tight leading-tight truncate px-1"' '"text-[clamp(0.72rem,3.4cqi,1rem)] font-bold tracking-tight leading-tight truncate px-1"'

# 4) RoomWidget: compactar sin perder jerarquía en celular.
$roomPath = "apps/operator-console/src/views/dashboards/widgets/RoomWidget.tsx"
Replace-InFile $roomPath '"relative h-full w-full flex flex-col p-7 transition-all duration-700"' '"relative h-full w-full min-h-0 flex flex-col p-4 @md:p-6 @lg:p-7 transition-all duration-700"'
Replace-InFile $roomPath '"relative h-full w-full min-h-0 flex flex-col p-4 @md:p-6 @lg:p-7 transition-all duration-700"' '"relative h-full w-full min-h-0 flex flex-col p-4 @md:p-6 @lg:p-7 transition-all duration-700 overflow-hidden"'
Replace-InFile $roomPath 'className="flex items-center justify-between mb-6"' 'className="flex items-center justify-between gap-3 mb-3 @md:mb-6"'
Replace-InFile $roomPath 'className="text-xl font-black tracking-tight text-foreground truncate"' 'className="text-base @md:text-xl font-black tracking-tight text-foreground truncate"'
Replace-InFile $roomPath '<div className="flex-1 space-y-4">' '<div className="flex-1 min-h-0 space-y-3 @md:space-y-4 overflow-hidden">'

# 5) SceneShortcut: evitar tarjetas gigantes o textos cortados.
$scenePath = "apps/operator-console/src/views/dashboards/widgets/SceneShortcutWidget.tsx"
Replace-InFile $scenePath '"relative h-full w-full flex flex-col justify-center items-center p-6 transition-all duration-500"' '"relative h-full w-full min-h-0 flex flex-col justify-center items-center p-4 @md:p-6 transition-all duration-500 overflow-hidden"'
Replace-InFile $scenePath '"w-16 h-16 rounded-[2rem] flex items-center justify-center border transition-all duration-500 mb-4"' '"w-12 h-12 @md:w-16 @md:h-16 rounded-[1.5rem] @md:rounded-[2rem] flex shrink-0 items-center justify-center border transition-all duration-500 mb-2 @md:mb-4"'
Replace-InFile $scenePath 'className="text-sm font-black tracking-tight text-foreground line-clamp-2 text-center leading-tight"' 'className="text-xs @md:text-sm font-black tracking-tight text-foreground line-clamp-2 text-center leading-tight"'

# 6) Energy/System/Assistant/Activity: contenedores scroll-safe y tipografía adaptativa.
$energyPath = "apps/operator-console/src/views/dashboards/widgets/EnergySnapshotWidget.tsx"
Replace-InFile $energyPath '"relative w-full h-full rounded-[2.5rem] overflow-hidden p-6 transition-all duration-700"' '"relative w-full h-full min-h-0 rounded-[1.5rem] @md:rounded-[2.5rem] overflow-hidden p-4 @md:p-6 transition-all duration-700"'
Replace-InFile $energyPath 'className="text-4xl font-black tracking-tighter text-foreground tabular-nums"' 'className="text-[clamp(1.75rem,18cqi,2.25rem)] font-black tracking-tighter text-foreground tabular-nums"'
Replace-InFile $energyPath 'className="grid grid-cols-1 gap-6 relative z-10"' 'className="grid grid-cols-1 gap-4 @md:gap-6 relative z-10"'

$assistantPath = "apps/operator-console/src/views/dashboards/widgets/AssistantInsightWidget.tsx"
Replace-InFile $assistantPath '"flex flex-col h-full rounded-3xl p-5 transition-all duration-500"' '"flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 transition-all duration-500 overflow-hidden"'
Replace-InFile $assistantPath 'className="text-sm font-black text-foreground tracking-tight"' 'className="text-xs @md:text-sm font-black text-foreground tracking-tight truncate"'

$activityPath = "apps/operator-console/src/views/dashboards/widgets/ActivityFeedWidget.tsx"
Replace-InFile $activityPath '"flex flex-col h-full rounded-3xl p-5 overflow-hidden transition-all duration-500"' '"flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 overflow-hidden transition-all duration-500"'
Replace-InFile $activityPath '<div className="flex-1 overflow-y-auto no-scrollbar space-y-3">' '<div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2 @md:space-y-3">'
Replace-InFile $activityPath 'className="text-sm font-black text-foreground tracking-tight"' 'className="text-xs @md:text-sm font-black text-foreground tracking-tight truncate"'

$systemPath = "apps/operator-console/src/views/dashboards/widgets/SystemStatusWidget.tsx"
Replace-InFile $systemPath '"flex flex-col h-full rounded-3xl p-5 overflow-hidden transition-all duration-500"' '"flex flex-col h-full min-h-0 rounded-2xl @md:rounded-3xl p-4 @md:p-5 overflow-hidden transition-all duration-500"'
Replace-InFile $systemPath 'className="text-sm font-black text-foreground tracking-tight"' 'className="text-xs @md:text-sm font-black text-foreground tracking-tight truncate"'
Replace-InFile $systemPath '<div className="space-y-5 animate-in fade-in duration-500">' '<div className="space-y-3 @md:space-y-5 animate-in fade-in duration-500">'

$sectionPath = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx"
Replace-InFile $sectionPath 'className="text-[13px] font-black uppercase tracking-[0.25em] text-foreground/80 whitespace-nowrap"' 'className="truncate text-[11px] @md:text-[13px] font-black uppercase tracking-[0.18em] @md:tracking-[0.25em] text-foreground/80 whitespace-nowrap"'

Write-Host "OK: Responsive V2 aplicado. Ejecuta: npm run build --workspace=apps/operator-console" -ForegroundColor Green
