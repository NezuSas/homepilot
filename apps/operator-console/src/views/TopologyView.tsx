import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Home as HomeIcon, Layers3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import ConfirmModal from '../components/ConfirmModal';
import { AlertBanner } from '../components/ui/AlertBanner';
import { EmptyState } from '../components/ui/EmptyState';
import { SpacesSkeleton } from '../components/ui/ComponentSkeletons';
import { SearchInput } from '../components/ui/Input';
import { SectionHeader } from '../components/ui/SectionHeader';
import type { UserContext } from '../lib/useSession';
import { filterTopologyRooms } from './topology/topologyPresentation';
import { TopologyHomeHeader } from './topology/TopologyHomeHeader';
import { TopologyRoomCard } from './topology/TopologyRoomCard';
import { TopologyRoomDetailPanel } from './topology/TopologyRoomDetailPanel';
import { sortRoomDevices } from './topology/topologyDeviceControl';
import { canManageHome, getAssignedRoomDevices } from './topology/topologyViewModel';
import { useRoomDeviceCommand } from './topology/useRoomDeviceCommand';
import { useTopologyData } from './topology/useTopologyData';
import { useTopologyHomeRename } from './topology/useTopologyHomeRename';
import { useTopologyRooms } from './topology/useTopologyRooms';

/** With a handful of spaces the list is scanned by eye; a search box only starts to help beyond this. */
const ROOM_SEARCH_THRESHOLD = 6;

interface TopologyViewProps {
  currentUser: UserContext | null;
}

export const TopologyView: React.FC<TopologyViewProps> = ({ currentUser }) => {
  const { t } = useTranslation();
  const userId = currentUser?.id;
  const {
    selectedHome, setSelectedHome, rooms, setRooms, devices, setDevices, loadingHomes, topologyError, setTopologyError,
  } = useTopologyData(userId);
  const [deviceSearch, setDeviceSearch] = useState('');
  const [roomSearch, setRoomSearch] = useState('');

  const homeRename = useTopologyHomeRename({ userId, setSelectedHome, setTopologyError });
  const roomsState = useTopologyRooms({ userId, selectedHome, rooms, setRooms, setDevices, setTopologyError });
  const { selectedRoom, selectedRoomId, editingRoomId } = roomsState;
  const executeRoomDeviceCommand = useRoomDeviceCommand({
    devices, selectedRoomId, homeId: selectedHome?.id, setDevices, setTopologyError,
  });

  const manageable = canManageHome(selectedHome, userId);

  const visibleRooms = useMemo(() => {
    return filterTopologyRooms(rooms, roomSearch);
  }, [rooms, roomSearch]);

  const selectedRoomDevices = useMemo(
    () => getAssignedRoomDevices(devices, selectedRoom?.id ?? null, selectedHome?.id),
    [devices, selectedRoom, selectedHome?.id],
  );

  const visibleSelectedRoomDevices = useMemo(() => {
    return sortRoomDevices(selectedRoomDevices, deviceSearch);
  }, [deviceSearch, selectedRoomDevices]);

  // Opening a space brings its detail into view: on a phone it opens below the whole list.
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedRoomId) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    detailRef.current?.scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [selectedRoomId]);

  if (loadingHomes) {
    return <SpacesSkeleton label={t('common.loading')} />;
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
            <TopologyHomeHeader
              home={selectedHome}
              roomCount={rooms.length}
              canManage={manageable}
              editing={homeRename.editingHomeId === selectedHome.id}
              nameDraft={homeRename.homeNameDraft}
              isRenaming={homeRename.isRenamingHome}
              newRoomName={roomsState.newRoomName}
              isCreatingRoom={roomsState.isCreatingRoom}
              onNameDraftChange={homeRename.setHomeNameDraft}
              onBeginRename={() => homeRename.beginHomeRename(selectedHome)}
              onCancelRename={homeRename.cancelHomeRename}
              onRename={(event) => { void homeRename.handleRenameHome(event, selectedHome); }}
              onNewRoomNameChange={roomsState.setNewRoomName}
              onAddRoom={roomsState.handleAddRoom}
            />
            {rooms.length > ROOM_SEARCH_THRESHOLD && <SearchInput
              value={roomSearch}
              onChange={(event) => setRoomSearch(event.target.value)}
              placeholder={t('topology.search_rooms')}
              aria-label={t('topology.search_rooms')}
            />}

              <div className={cn(
                "grid grid-cols-1 items-start gap-4",
              )}>
                {rooms.length === 0 ? (
                  <EmptyState
                    variant="dashed"
                    className="col-span-full"
                    title={t('topology.no_rooms', { defaultValue: 'No rooms associated with this environment.' })}
                  />
                ) : (
                  <>
                    <div
                      className="grid self-start grid-cols-[repeat(auto-fit,minmax(min(100%,14rem),1fr))] gap-3"
                      onClick={(event) => {
                        if (event.target === event.currentTarget) roomsState.setSelectedRoomId(null);
                      }}
                    >
                      {visibleRooms.length === 0 && (
                        <EmptyState
                          variant="dashed"
                          className="col-span-full"
                          title={t('topology.no_search_results')}
                        />
                      )}
                      {visibleRooms.map((room) => (
                        <TopologyRoomCard
                          key={room.id}
                          room={room}
                          devices={devices}
                          selected={selectedRoomId === room.id}
                          onSelect={() => {
                            roomsState.setSelectedRoomId((currentRoomId) => currentRoomId === room.id ? null : room.id);
                            if (editingRoomId !== room.id) roomsState.cancelRoomRename();
                          }}
                        />
                      ))}
                    </div>

                    {selectedRoom && <div ref={detailRef} className="scroll-mt-4"><TopologyRoomDetailPanel
                      room={selectedRoom}
                      devices={selectedRoomDevices}
                      visibleDevices={visibleSelectedRoomDevices}
                      canManage={manageable}
                      editing={editingRoomId === selectedRoom.id}
                      draft={roomsState.roomNameDraft}
                      renameError={roomsState.roomRenameError}
                      isRenaming={roomsState.isRenamingRoom}
                      deviceSearch={deviceSearch}
                      isDeleting={roomsState.isDeletingRoom}
                      t={t}
                      onDraftChange={roomsState.setRoomNameDraft}
                      onRename={roomsState.handleRenameRoom}
                      onStartRename={() => roomsState.beginRoomRename(selectedRoom)}
                      onCancelRename={roomsState.cancelRoomRename}
                      onClose={() => roomsState.setSelectedRoomId(null)}
                      onDeviceSearchChange={setDeviceSearch}
                      onDeviceCommand={executeRoomDeviceCommand}
                      onDelete={() => roomsState.setRoomPendingDelete(selectedRoom)}
                    /></div>}
                  </>
                )}
              </div>
          </>
        ) : (
          <EmptyState
            variant="dashed"
            className="h-topology-empty"
            icon={HomeIcon}
            title={t('topology.no_active_home_title')}
            description={t('topology.no_active_home_description')}
          />
        )}
      </section>

      <ConfirmModal
        isOpen={!!roomsState.roomPendingDelete}
        onClose={() => {
          if (!roomsState.isDeletingRoom) roomsState.setRoomPendingDelete(null);
        }}
        onConfirm={roomsState.handleDeleteRoom}
        title={t('topology.delete_room_title')}
        description={t('topology.delete_room_description')}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isSubmitting={roomsState.isDeletingRoom}
      />

    </div>
    </div>
  );
};
