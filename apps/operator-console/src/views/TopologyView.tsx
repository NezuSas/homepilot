import React, { useEffect, useMemo, useState } from 'react';
import { Home as HomeIcon, Loader2, CheckCircle2, Layers3, Pencil, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch, readApiError } from '../lib/apiClient';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { Button } from '../components/ui/Button';
import { LoadingState } from '../components/ui/LoadingState';
import { IconButton } from '../components/ui/IconButton';
import { Input, SearchInput } from '../components/ui/Input';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { UserContext } from '../lib/useSession';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../stores/useDeviceSnapshotStore';
import {
  filterTopologyRooms,
  type TopologyHome as Home,
  type TopologyRoom as Room,
} from './topology/topologyPresentation';
import { TopologyRoomCard } from './topology/TopologyRoomCard';
import { TopologyRoomDetailPanel } from './topology/TopologyRoomDetailPanel';
import { getRoomDeviceState, isRoomDeviceMomentary, sortRoomDevices } from './topology/topologyDeviceControl';
import { canExecuteCommand } from '../lib/deviceCapabilities';
import { isDeviceUnavailable } from '../lib/deviceAvailability';

interface TopologyViewProps {
  currentUser: UserContext | null;
}

const API_URL = `${API_BASE_URL}/api/v1`;

export const TopologyView: React.FC<TopologyViewProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<SnapshotDevice[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loadingHomes, setLoadingHomes] = useState(true);
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
  const [topologyError, setTopologyError] = useState('');
  const [roomSearch, setRoomSearch] = useState('');
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);
  const upsertDevice = useDeviceSnapshotStore((state) => state.upsertDevice);

  const canManageHome = (home: Home | null): boolean => (
    home !== null && home.ownerId === currentUser?.id
  );


  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        await refreshSnapshot();
        if (!isMounted) return;
        const snapshot = useDeviceSnapshotStore.getState();
        if (snapshot.lastUpdatedAt === null) throw new Error(t('topology.load_error'));
        const home = snapshot.homes.find((candidate): candidate is Home => (
          typeof candidate.id === 'string'
          && typeof candidate.name === 'string'
          && typeof candidate.ownerId === 'string'
        ));
        setDevices(snapshot.devices);
        setTopologyError('');
        if (home) {
          setSelectedHome(home);
          if (home.ownerId === currentUser?.id) {
            setRooms(snapshot.roomsByHome[home.id] ?? []);
          } else {
            // Preserve the per-home endpoint's ownership check for shared topologies.
            const response = await apiFetch(`${API_URL}/homes/${home.id}/rooms`);
            if (!response.ok) throw new Error(await readApiError(response, t('topology.load_error')));
            const roomData = await response.json();
            if (isMounted) setRooms(Array.isArray(roomData) ? roomData : []);
          }
        }
      } catch (error_: unknown) {
        if (isMounted) setTopologyError(error_ instanceof Error ? error_.message : t('topology.load_error'));
      } finally {
        if (isMounted) setLoadingHomes(false);
      }
    };

    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, [currentUser?.id, refreshSnapshot, t]);

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
      void refreshSnapshot({ force: true });
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
      void refreshSnapshot({ force: true });
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
      void refreshSnapshot({ force: true });
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
      void refreshSnapshot({ force: true });
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('topology.rename_home_error'));
    } finally {
      setIsRenamingHome(false);
    }
  };

  const executeRoomDeviceCommand = async (deviceId: string, command: string, params?: Record<string, unknown>): Promise<SnapshotDevice | null> => {
    const device = devices.find(candidate => candidate.id === deviceId);
    if (!device || device.roomId !== selectedRoomId || device.homeId !== selectedHome?.id
      || device.status !== 'ASSIGNED' || isDeviceUnavailable(device) || !canExecuteCommand(device, command)) return null;
    setTopologyError('');
    try {
      const res = await apiFetch(`${API_URL}/devices/${encodeURIComponent(device.id)}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: params ? { name: command, params } : command }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('common.errors.operation_failed')));
      const updatedDevice = await res.json() as SnapshotDevice;
      setDevices((currentDevices) => currentDevices.map((currentDevice) => currentDevice.id === updatedDevice.id ? updatedDevice : currentDevice));
      upsertDevice(updatedDevice);
      return updatedDevice;
    } catch (error_: unknown) {
      setTopologyError(error_ instanceof Error ? error_.message : t('common.errors.operation_failed'));
      return null;
    }
  };

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );

  const visibleRooms = useMemo(() => {
    return filterTopologyRooms(rooms, roomSearch);
  }, [rooms, roomSearch]);

  const selectedRoomDevices = useMemo(
    () => selectedRoom ? devices.filter((device) => device.roomId === selectedRoom.id && device.homeId === selectedHome?.id && device.status === 'ASSIGNED') : [],
    [devices, selectedRoom, selectedHome?.id],
  );

  const visibleSelectedRoomDevices = useMemo(() => {
    return sortRoomDevices(selectedRoomDevices, deviceSearch);
  }, [deviceSearch, selectedRoomDevices]);

  const activeRoomDeviceCount = useMemo(
    () => selectedRoomDevices.filter(device => !isRoomDeviceMomentary(device) && getRoomDeviceState(device) === true).length,
    [selectedRoomDevices],
  );

  if (loadingHomes) {
    return <LoadingState label={t('common.loading')} layout="cards" />;
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
                      {visibleRooms.map((room) => (
                        <TopologyRoomCard
                          key={room.id}
                          room={room}
                          devices={devices}
                          selected={selectedRoomId === room.id}
                          t={t}
                          onSelect={() => {
                            setSelectedRoomId((currentRoomId) => currentRoomId === room.id ? null : room.id);
                            if (editingRoomId !== room.id) cancelRoomRename();
                          }}
                        />
                      ))}
                    </div>

                    {selectedRoom && <TopologyRoomDetailPanel
                      room={selectedRoom}
                      devices={selectedRoomDevices}
                      visibleDevices={visibleSelectedRoomDevices}
                      activeLightCount={activeRoomDeviceCount}
                      canManage={canManageHome(selectedHome)}
                      editing={editingRoomId === selectedRoom.id}
                      draft={roomNameDraft}
                      renameError={roomRenameError}
                      isRenaming={isRenamingRoom}
                      deviceSearch={deviceSearch}
                      isDeleting={isDeletingRoom}
                      t={t}
                      onDraftChange={setRoomNameDraft}
                      onRename={handleRenameRoom}
                      onStartRename={() => beginRoomRename(selectedRoom)}
                      onCancelRename={cancelRoomRename}
                      onClose={() => setSelectedRoomId(null)}
                      onDeviceSearchChange={setDeviceSearch}
                      onDeviceCommand={executeRoomDeviceCommand}
                      onDelete={() => setRoomPendingDelete(selectedRoom)}
                    />}
                  </>
                )}
              </div>
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
