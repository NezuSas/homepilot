$ErrorActionPreference = 'Stop'

$path = 'apps/operator-console/src/App.tsx'
if (!(Test-Path $path)) {
  throw "No se encontro $path. Ejecuta este script desde la raiz del proyecto homepilot."
}

$content = Get-Content $path -Raw

# 1) Add a runtime collapsed flag that respects mobile drawer state.
# On mobile, isDesktopSidebarCollapsed is usually true because desktop sidebar is closed by default.
# But when the mobile drawer is open, submenu content must still be visible/clickable.
$content = $content -replace \
  "const isDesktopSidebarCollapsed = !isDesktopSidebarOpen;`r?`n", \
  "const isDesktopSidebarCollapsed = !isDesktopSidebarOpen;`r`n  const isSidebarContentCollapsed = isDesktopSidebarCollapsed && !isSidebarOpen;`r`n"

# 2) Use the mobile-aware flag only for render conditions/titles that previously blocked mobile submenus.
$content = $content -replace \
  "title=\{isDesktopSidebarCollapsed \? t\('nav\.dashboards'\) : undefined\}", \
  "title={isSidebarContentCollapsed ? t('nav.dashboards') : undefined}"

$content = $content -replace \
  "\{!isDesktopSidebarCollapsed && \(isDashboardsExpanded", \
  "{!isSidebarContentCollapsed && (isDashboardsExpanded"

$content = $content -replace \
  "\{isDashboardsExpanded && !isDesktopSidebarCollapsed && \(", \
  "{isDashboardsExpanded && !isSidebarContentCollapsed && ("

$content = $content -replace \
  "title=\{isDesktopSidebarCollapsed \? t\('nav\.system'\) : undefined\}", \
  "title={isSidebarContentCollapsed ? t('nav.system') : undefined}"

$content = $content -replace \
  "\{!isDesktopSidebarCollapsed && \(isSystemExpanded", \
  "{!isSidebarContentCollapsed && (isSystemExpanded"

$content = $content -replace \
  "\{isSystemExpanded && !isDesktopSidebarCollapsed && \(", \
  "{isSystemExpanded && !isSidebarContentCollapsed && ("

Set-Content -Path $path -Value $content -NoNewline

Write-Host 'OK: Sidebar mobile submenu fix applied.' -ForegroundColor Green
Write-Host 'Changed file:' $path
