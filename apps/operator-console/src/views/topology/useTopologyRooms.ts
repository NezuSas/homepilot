import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { apiFetch, readApiError } from '../../lib/apiClient';
import { useDeviceSnapshotStore, type SnapshotDevice } from '../../stores/useDeviceSnapshotStore';
import { TOPOLOGY_API_URL } from './useTopologyData';
import { canManageHome, detachRoomDevices } from './topologyViewModel';
import type { TopologyHome as Home, TopologyRoom as Room } from './topologyPresentation';

interface Options {
  userId: string | undefined;
  selectedHome: Home | null;
  rooms: Room[];
  setRooms: Dispatch<SetStateAction<Room[]>>;
  setDevices: Dispatch<SetStateAction<SnapshotDevice[]>>;
  setTopologyError: Dispatch<SetStateAction<string>>;
}

/** Room selection plus the create, rename and delete flows for the active home. */
export function useTopologyRooms({ userId, selectedHome, rooms, setRooms, setDevices, setTopologyError }: Options) {
  const { t } = useTranslation();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [roomPendingDelete, setRoomPendingDelete] = useState<Room | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomRenameError, setRoomRenameError] = useState('');
  const [isRenamingRoom, setIsRenamingRoom] = useState(false);
  const refreshSnapshot = useDeviceSnapshotStore((state) => state.refreshSnapshot);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );

  const handleAddRoom = async () => {
    const home = selectedHome;
    if (!home || !canManageHome(home, userId) || !newRoomName.trim()) return;
    setIsCreatingRoom(true);
    setTopologyError('');
    try {
      const res = await apiFetch(`${TOPOLOGY_API_URL}/homes/${home.id}/rooms`, {
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
    if (!roomPendingDelete || !canManageHome(selectedHome, userId)) return;

    setIsDeletingRoom(true);
    try {
      const res = await apiFetch(`${TOPOLOGY_API_URL}/rooms/${roomPendingDelete.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) return;

      const deletedRoomId = roomPendingDelete.id;
      const nextRooms = rooms.filter((room) => room.id !== deletedRoomId);
      setRooms(nextRooms);
      setDevices((currentDevices) => detachRoomDevices(currentDevices, deletedRoomId));
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
    if (!canManageHome(selectedHome, userId)) return;
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

  const handleRenameRoom = async (event: FormEvent) => {
    event.preventDefault();
    if (!canManageHome(selectedHome, userId) || !selectedRoom || editingRoomId !== selectedRoom.id || !roomNameDraft.trim()) return;

    setIsRenamingRoom(true);
    setRoomRenameError('');
    try {
      const response = await apiFetch(`${TOPOLOGY_API_URL}/rooms/${encodeURIComponent(selectedRoom.id)}`, {
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

  return {
    selectedRoomId,
    setSelectedRoomId,
    selectedRoom,
    newRoomName,
    setNewRoomName,
    isCreatingRoom,
    roomPendingDelete,
    setRoomPendingDelete,
    isDeletingRoom,
    editingRoomId,
    roomNameDraft,
    setRoomNameDraft,
    roomRenameError,
    isRenamingRoom,
    handleAddRoom,
    handleDeleteRoom,
    beginRoomRename,
    cancelRoomRename,
    handleRenameRoom,
  };
}
