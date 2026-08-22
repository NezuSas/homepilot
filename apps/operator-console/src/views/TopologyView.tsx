import React, { useEffect, useMemo, useState } from 'react';
import { Home as HomeIcon, Loader2, CheckCircle2, Layers3, Lightbulb, Trash2, Pencil, X, Power } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { Input, SearchInput } from '../components/ui/Input';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { UserContext } from '../lib/useSession';

interface Home {
  id: string;
  name: string;
  ownerId: string;
}

interface Room {
  id: string;
  name: string;
  homeId: string;
}

interface Device {
  id: string;
  name: string;
  type: string;
  semanticType?: string | null;
  status: string;
  roomId: string | null;
  lastKnownState?: Record<string, unknown> | null;
}

interface TopologyViewProps {
  currentUser: UserContext | null;
}

const API_URL = `${API_BASE_URL}/api/v1`;

const isActiveDevice = (device: Device) => {
  const state = device.lastKnownState || {};
  return state.on === true
    || state.state === 'on'
    || Number(state.brightness) > 0
    || Number(state.power) > 0;
};

const isLightDevice = (device: Device): boolean => (
  device.semanticType?.toLowerCase() === 'light' || device.type.toLowerCase() === 'light'
);

const getDeviceTypeTranslationKey = (device: Device) => (
  device.semanticType?.toLowerCase() || device.type.toLowerCase()
);

export const TopologyView: React.FC<TopologyViewProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomPendingDelete, setRoomPendingDelete] = useState<Room | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomRenameError, setRoomRenameError] = useState('');
  const [isRenamingRoom, setIsRenamingRoom] = useState(false);
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  const [homeNameDraft, setHomeNameDraft] = useState('');
  const [isRenamingHome, setIsRenamingHome] = useState(false);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [deviceProcessingId, setDeviceProcessingId] = useState<string | null>(null);
  const [topologyError, setTopologyError] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const canManageHome = (home: Home | null): boolean => (
    home !== null && home.ownerId === currentUser?.id
  );


  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [homesRes, devicesRes] = await Promise.all([
          apiFetch(`${API_URL}/homes`),
          apiFetch(`${API_URL}/devices`),
        ]);

        if (!homesRes.ok) throw new Error(await readApiError(homesRes, t('topology.load_error')));
        const homesData = await homesRes.json();
        if (!devicesRes.ok) throw new Error(await readApiError(devicesRes, t('topology.load_error')));
        const deviceData = await devicesRes.json();
        if (!isMounted) return;

        const nextHomes = Array.isArray(homesData) ? homesData : [];
        setDevices(Array.isArray(deviceData) ? deviceData : []);
        setTopologyError('');

        if (nextHomes.length > 0) {
          void loadRooms(nextHomes[0]);
        }
      } catch (error_: unknown) {
        setTopologyError(error_ instanceof Error ? error_.message : t('topology.load_error'));
      } finally {
        if (isMounted) setLoadingHomes(false);
      }
    };

    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Home selection controls later room refreshes.

  async function loadRooms(home: Home) {
    setSelectedHome(home);
    setSelectedRoomId(null);
    setLoadingRooms(true);
    try {
      const res = await apiFetch(`${API_URL}/homes/${home.id}/rooms`);
      if (!res.ok) throw new Error(await readApiError(res, t('topology.load_error')));
      const data = await res.json();
      const nextRooms = Array.isArray(data) ? data : [];
      setRooms(nextRooms);
      setSelectedRoomId(null);
      setDeviceSearch('');
      setTopologyError('');
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('topology.load_error'));
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleAddRoom = async () => {
    const home = selectedHome;
    if (!home || !canManageHome(home) || !newRoomName.trim()) return;
    setIsCreatingRoom(true);
    setTopologyError('');
    try {
      const res = await apiFetch(`${API_URL}/homes/${home.id}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim() })
      });
      if (!res.ok) throw new Error(await readApiError(res, t('topology.create_room_error')));
      const room = await res.json() as Room;
      setRooms((currentRooms) => [...currentRooms, room]);
      setSelectedRoomId(room.id);
      setNewRoomName('');
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('topology.create_room_error'));
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!roomPendingDelete || !canManageHome(selectedHome)) return;

    setIsDeletingRoom(true);
    try {
      const res = await apiFetch(`${API_URL}/rooms/${roomPendingDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) return;

      const deletedRoomId = roomPendingDelete.id;
      const nextRooms = rooms.filter((room) => room.id !== deletedRoomId);
      setRooms(nextRooms);
      setDevices((currentDevices) => currentDevices.map((device) => (
        device.roomId === deletedRoomId ? { ...device, roomId: null, status: 'PENDING' } : device
      )));
      setSelectedRoomId((currentRoomId) => (
        currentRoomId === deletedRoomId ? null : currentRoomId
      ));
      setRoomPendingDelete(null);
    } catch (err) {
      console.error('Error deleting room:', err);
    } finally {
      setIsDeletingRoom(false);
    }
  };

  const beginRoomRename = (room: Room) => {
    if (!canManageHome(selectedHome)) return;
    setEditingRoomId(room.id);
    setRoomNameDraft(room.name);
    setRoomRenameError('');
  };

  const cancelRoomRename = () => {
    if (isRenamingRoom) return;
    setEditingRoomId(null);
    setRoomNameDraft('');
    setRoomRenameError('');
  };

  const handleRenameRoom = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManageHome(selectedHome) || !selectedRoom || editingRoomId !== selectedRoom.id || !roomNameDraft.trim()) return;

    setIsRenamingRoom(true);
    setRoomRenameError('');
    try {
      const response = await apiFetch(`${API_URL}/rooms/${encodeURIComponent(selectedRoom.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomNameDraft.trim() }),
      });
      if (!response.ok) {
        const payload = await response.json() as { error?: { message?: string } };
        throw new Error(payload.error?.message || t('topology.rename_room_error'));
      }

      const updatedRoom = await response.json() as Room;
      setRooms((currentRooms) => currentRooms.map((room) => room.id === updatedRoom.id ? updatedRoom : room));
      setEditingRoomId(null);
      setRoomNameDraft('');
      setRoomRenameError('');
    } catch (error_: unknown) {
      setRoomRenameError(error_ instanceof Error ? error_.message : t('topology.rename_room_error'));
    } finally {
      setIsRenamingRoom(false);
    }
  };

  const beginHomeRename = (home: Home) => {
    if (!canManageHome(home)) return;
    setEditingHomeId(home.id);
    setHomeNameDraft(home.name);
  };

  const cancelHomeRename = () => {
    if (isRenamingHome) return;
    setEditingHomeId(null);
    setHomeNameDraft('');
  };

  const handleRenameHome = async (event: React.FormEvent, home: Home) => {
    event.preventDefault();
    if (!canManageHome(home) || !homeNameDraft.trim()) return;
    setIsRenamingHome(true);
    setTopologyError('');
    try {
      const res = await apiFetch(`${API_URL}/homes/${encodeURIComponent(home.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: homeNameDraft.trim() }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('topology.rename_home_error')));
      const updatedHome = await res.json() as Home;
      setSelectedHome((currentHome) => currentHome?.id === updatedHome.id ? updatedHome : currentHome);
      cancelHomeRename();
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('topology.rename_home_error'));
    } finally {
      setIsRenamingHome(false);
    }
  };

  const canToggleDevice = (device: Device) => isLightDevice(device);

  const handleToggleDevice = async (device: Device) => {
    if (!canToggleDevice(device) || deviceProcessingId) return;
    setDeviceProcessingId(device.id);
    setTopologyError('');
    try {
      const res = await apiFetch(`${API_URL}/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: isActiveDevice(device) ? 'turn_off' : 'turn_on' }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('common.errors.operation_failed')));
      const updatedDevice = await res.json() as Device;
      setDevices((currentDevices) => currentDevices.map((currentDevice) => currentDevice.id === updatedDevice.id ? updatedDevice : currentDevice));
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('common.errors.operation_failed'));
    } finally {
      setDeviceProcessingId(null);
    }
  };

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );

  const visibleRooms = useMemo(() => {
    const normalizedSearch = roomSearch.trim().toLocaleLowerCase();
    return [...rooms]
      .filter((room) => !normalizedSearch || room.name.toLocaleLowerCase().includes(normalizedSearch))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }, [rooms, roomSearch]);

  const selectedRoomLights = useMemo(
    () => selectedRoom ? devices.filter((device) => device.roomId === selectedRoom.id && isLightDevice(device)) : [],
    [devices, selectedRoom],
  );

  const visibleSelectedRoomDevices = useMemo(() => {
    const normalizedSearch = deviceSearch.trim().toLocaleLowerCase();
    return [...selectedRoomLights]
      .filter((device) => !normalizedSearch || device.name.toLocaleLowerCase().includes(normalizedSearch))
      .sort((left, right) => {
        const leftActive = isActiveDevice(left);
        const rightActive = isActiveDevice(right);
        if (leftActive !== rightActive) return leftActive ? -1 : 1;
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      });
  }, [deviceSearch, selectedRoomLights]);

  const activeRoomDeviceCount = useMemo(
    () => selectedRoomLights.filter(isActiveDevice).length,
    [selectedRoomLights],
  );

  if (loadingHomes) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-body font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <SectionHeader level="view" icon={Layers3} title={t('nav.spaces')} />
      <div className="flex flex-col gap-5">
      {topologyError && (
        <AlertBanner variant="danger" message={topologyError} />
      )}
      
      {/* Rooms Details */}
      <section className="flex min-w-0 flex-col gap-5 rounded-panel border border-border/80 bg-card p-4 shadow-depth-1 sm:p-6">
        {selectedHome ? (
          <>
            <div className="flex flex-col gap-4 border-b border-border/70 pb-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                  <HomeIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  {editingHomeId === selectedHome.id ? (
                    <form className="flex items-center gap-2" onSubmit={(event) => { void handleRenameHome(event, selectedHome); }}>
                      <Input
                        autoFocus
                        value={homeNameDraft}
                        onChange={(event) => setHomeNameDraft(event.target.value)}
                        containerClassName="min-w-0 flex-1"
                        className="h-9 rounded-control border-primary/40 px-3 text-body font-bold text-foreground"
                        aria-label={t('topology.rename_home')}
                      />
                      <IconButton
                        icon={isRenamingHome ? Loader2 : CheckCircle2}
                        label={t('common.save')}
                        type="submit"
                        disabled={isRenamingHome || !homeNameDraft.trim()}
                        variant="primary"
                        size="sm"
                        className={cn('h-9 w-9 rounded-control', isRenamingHome && '[&_svg]:animate-spin')}
                      />
                      <IconButton
                        icon={X}
                        label={t('common.cancel')}
                        onClick={cancelHomeRename}
                        disabled={isRenamingHome}
                        variant="default"
                        size="sm"
                        className="h-9 w-9 rounded-control"
                      />
                    </form>
                  ) : (
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-section-title font-bold tracking-tight text-foreground">{selectedHome.name}</h2>
                      {canManageHome(selectedHome) && (
                        <IconButton
                          icon={Pencil}
                          label={t('topology.rename_home')}
                          onClick={() => beginHomeRename(selectedHome)}
                          variant="default"
                          size="sm"
                          className="h-8 w-8 shrink-0 rounded-control hover:border-primary/30 hover:text-primary"
                        />
                      )}
                    </div>
                  )}
                  <p className="mt-1 text-caption text-muted-foreground">{t('topology.home_workspace_description')}</p>
                </div>
              </div>
              {canManageHome(selectedHome) && (
                <div className="flex w-full items-center gap-2 lg:w-auto">
                  <Input
                    type="text"
                    containerClassName="min-w-0 flex-1 lg:w-60"
                    placeholder={t('topology.placeholder')}
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="rounded-control px-3 py-2 text-caption focus-visible:ring-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                  />
                  <Button
                    onClick={handleAddRoom}
                    disabled={isCreatingRoom || !newRoomName.trim()}
                    isLoading={isCreatingRoom}
                    size="md"
                    className="shrink-0"
                  >
                    {t('topology.add_room')}
                  </Button>
                </div>
              )}
            </div>
            <SearchInput
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
              placeholder={t('topology.search_rooms')}
              aria-label={t('topology.search_rooms')}
              className="w-full"
            />

            {loadingRooms ? (
              <div className="flex flex-col items-center justify-center p-16 border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-3" />
                <p className="text-body">{t('common.loading')}</p>
              </div>
            ) : (
              <div className={cn(
                "grid grid-cols-1 items-start gap-4",
              )}>
                {rooms.length === 0 ? (
                  <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-body italic">
                    {t('topology.no_rooms', { defaultValue: 'No rooms associated with this environment.' })}
                  </div>
                ) : (
                  <>
                    <div
                      className="grid self-start grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3"
                      onClick={(event) => {
                        if (event.target === event.currentTarget) setSelectedRoomId(null);
                      }}
                    >
                      {visibleRooms.length === 0 && (
                        <p className="col-span-full rounded-xl border border-dashed border-border bg-muted/10 p-6 text-center text-body text-muted-foreground">
                          {t('topology.no_search_results')}
                        </p>
                      )}
                      {visibleRooms.map((room) => {
                        const isRoomSelected = selectedRoomId === room.id;
                        const roomDevices = devices.filter((device) => device.roomId === room.id);
                        const hasActiveLight = roomDevices.some((device) => isLightDevice(device) && isActiveDevice(device));

                        return (
                          <Button
                            key={room.id}
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedRoomId((currentRoomId) => currentRoomId === room.id ? null : room.id);
                              if (editingRoomId !== room.id) cancelRoomRename();
                            }}
                            className={cn(
                              "group h-auto min-h-24 self-start justify-start rounded-xl border bg-card p-3.5 text-left shadow-sm hover:border-primary/50 hover:shadow-md sm:p-4",
                              isRoomSelected ? "border-primary bg-primary/5 shadow-primary/10" : "border-border",
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
                                hasActiveLight
                                  ? "bg-warning/15 text-warning shadow-warning-soft"
                                  : isRoomSelected
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                              )}>
                                <Lightbulb className={cn("h-5 w-5", hasActiveLight && "fill-current")} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="block line-clamp-2 font-semibold text-foreground">{room.name}</span>
                                <span className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
                                  {t('topology.room_device_count', { count: roomDevices.length })}
                                </span>
                              </div>
                              {isRoomSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </div>
                          </Button>
                        );
                      })}
                    </div>

                    {selectedRoom && <aside className="self-start rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
                            {t('topology.room_details')}
                          </p>
                          {selectedRoom && editingRoomId === selectedRoom.id ? (
                            <form className="mt-2 flex items-center gap-2" onSubmit={handleRenameRoom}>
                              <Input
                                autoFocus
                                containerClassName="min-w-0 flex-1"
                                className="rounded-xl border-primary/40 px-3 py-2 text-body font-bold ring-2 ring-primary/10"
                                maxLength={80}
                                value={roomNameDraft}
                                onChange={(event) => setRoomNameDraft(event.target.value)}
                                aria-label={t('topology.rename_room_title')}
                              />
                              <IconButton
                                icon={isRenamingRoom ? Loader2 : CheckCircle2}
                                label={t('topology.rename_room_save')}
                                type="submit"
                                disabled={isRenamingRoom || !roomNameDraft.trim()}
                                variant="primary"
                                size="md"
                                className={cn('h-10 w-10', isRenamingRoom && '[&_svg]:animate-spin')}
                              />
                              <IconButton
                                icon={X}
                                label={t('common.cancel')}
                                onClick={cancelRoomRename}
                                disabled={isRenamingRoom}
                                variant="default"
                                size="md"
                                className="h-10 w-10"
                              />
                            </form>
                          ) : (
                            <div className="mt-1 flex items-center gap-2">
                              <h4 className="min-w-0 break-words text-section-title font-black tracking-tight text-foreground">
                                {selectedRoom?.name || t('topology.select_room_hint')}
                              </h4>
                              {selectedRoom && canManageHome(selectedHome) && (
                                <IconButton
                                  icon={Pencil}
                                  label={t('topology.rename_room')}
                                  onClick={() => beginRoomRename(selectedRoom)}
                                  variant="default"
                                  size="sm"
                                  className="h-8 w-8 rounded-lg hover:border-primary/30 hover:text-primary"
                                />
                              )}
                            </div>
                          )}
                          {roomRenameError && <p className="mt-2 text-caption font-semibold text-danger">{roomRenameError}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="rounded-xl bg-primary/10 p-2 text-primary">
                            <Layers3 className="h-5 w-5" />
                          </div>
                          <IconButton
                            icon={X}
                            label={t('topology.close_details')}
                            onClick={() => setSelectedRoomId(null)}
                            variant="default"
                            size="md"
                            className="h-9 w-9 rounded-xl hover:text-foreground"
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid max-w-md grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
                            {t('topology.lights_total')}
                          </p>
                          <p className="mt-1 text-view-title font-black text-foreground">{selectedRoomLights.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
                            {t('topology.lights_on')}
                          </p>
                          <p className="mt-1 text-view-title font-black text-primary">{activeRoomDeviceCount}</p>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border/50 pt-5">
                        <p className="mb-3 text-micro font-black uppercase tracking-widest text-muted-foreground/50">
                          {t('topology.lights_in_room')}
                        </p>
                        {selectedRoomLights.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-body font-medium text-muted-foreground">
                            {t('topology.no_lights_in_room')}
                          </p>
                        ) : (
                          <div className="flex flex-col gap-3">
                            <SearchInput
                              value={deviceSearch}
                              onChange={(event) => setDeviceSearch(event.target.value)}
                              placeholder={t('topology.search_lights')}
                              aria-label={t('topology.search_lights')}
                            />
                            <div className="grid max-h-topology-list grid-cols-1 gap-2 overflow-y-auto pr-1 custom-scrollbar sm:grid-cols-2 xl:grid-cols-3">
                            {visibleSelectedRoomDevices.length === 0 && (
                              <p className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-body font-medium text-muted-foreground">
                                {t('topology.no_light_search_results')}
                              </p>
                            )}
                            {visibleSelectedRoomDevices.map((device) => (
                              <div key={device.id} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_2rem] items-center gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-body font-bold text-foreground">{device.name}</p>
                                    <p className="text-micro font-black uppercase tracking-widest text-muted-foreground/50">
                                      {t(`device_types.${getDeviceTypeTranslationKey(device)}`, { defaultValue: t('device_types.none') })}
                                    </p>
                                  </div>
                                  <span className={cn(
                                    "inline-flex h-4 w-16 max-w-full items-center justify-center rounded-full px-1 font-medium uppercase",
                                    isActiveDevice(device) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                  )}
                                  style={{ fontSize: '0.625rem', lineHeight: 1, letterSpacing: '0' }}
                                >
                                    {isActiveDevice(device) ? t('device_states.on') : t('device_states.off')}
                                  </span>
                                  {canToggleDevice(device) && (
                                    <IconButton
                                      icon={deviceProcessingId === device.id ? Loader2 : Power}
                                      label={isActiveDevice(device) ? t('topology.turn_off_device') : t('topology.turn_on_device')}
                                      onClick={() => { void handleToggleDevice(device); }}
                                      disabled={deviceProcessingId !== null}
                                      variant={isActiveDevice(device) ? 'primary' : 'default'}
                                      size="sm"
                                      className={cn(
                                        "h-8 w-8 rounded-xl",
                                        isActiveDevice(device)
                                          ? "border-primary/30"
                                          : "bg-muted/30 hover:text-primary",
                                        deviceProcessingId === device.id && '[&_svg]:animate-spin',
                                      )}
                                    />
                                  )}
                                </div>
                              </div>
                            ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedRoom && canManageHome(selectedHome) && (
                        <Button
                          onClick={() => setRoomPendingDelete(selectedRoom)}
                          disabled={isDeletingRoom}
                          variant="ghost"
                          size="md"
                          className="mt-5 w-full border border-danger/20 bg-danger/5 text-danger hover:bg-danger/10 hover:text-danger sm:w-auto"
                        >
                          <Trash2 className="h-4 w-4" />
                          {t('topology.delete_room')}
                        </Button>
                      )}
                    </aside>}
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-topology-empty flex-col items-center justify-center rounded-card border border-dashed border-border bg-muted/20 px-6 text-center text-muted-foreground">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-muted/60">
              <HomeIcon className="h-5 w-5" />
            </div>
            <h2 className="text-section-title font-bold text-foreground">{t('topology.no_active_home_title')}</h2>
            <p className="mt-2 max-w-md text-caption leading-relaxed">{t('topology.no_active_home_description')}</p>
          </div>
        )}
      </section>

      <ConfirmModal
        isOpen={!!roomPendingDelete}
        onClose={() => {
          if (!isDeletingRoom) setRoomPendingDelete(null);
        }}
        onConfirm={handleDeleteRoom}
        title={t('topology.delete_room_title')}
        description={t('topology.delete_room_description')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isSubmitting={isDeletingRoom}
      />
      
    </div>
    </div>
  );
};
