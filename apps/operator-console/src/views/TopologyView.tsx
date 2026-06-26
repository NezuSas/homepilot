import React, { useEffect, useMemo, useState } from 'react';
import { Home as HomeIcon, Box, ArrowRight, Loader2, CheckCircle2, Layers3, PlugZap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../config';
import { apiFetch } from '../lib/apiClient';
import { cn } from '../lib/utils';

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
  status: string;
  roomId: string | null;
  lastKnownState?: Record<string, unknown> | null;
}

const API_URL = `${API_BASE_URL}/api/v1`;

const isActiveDevice = (device: Device) => {
  const state = device.lastKnownState || {};
  return state.on === true
    || state.state === 'on'
    || Number(state.brightness) > 0
    || Number(state.power) > 0;
};

export const TopologyView: React.FC = () => {
  const { t } = useTranslation();
  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        const [homesRes, devicesRes] = await Promise.all([
          apiFetch(`${API_URL}/homes`),
          apiFetch(`${API_URL}/devices`),
        ]);

        const homesData = await homesRes.json();
        const deviceData = devicesRes.ok ? await devicesRes.json() : [];
        if (!isMounted) return;

        const nextHomes = Array.isArray(homesData) ? homesData : [];
        setHomes(nextHomes);
        setDevices(Array.isArray(deviceData) ? deviceData : []);

        if (nextHomes.length > 0) {
          void handleSelectHome(nextHomes[0]);
        }
      } catch (err) {
        console.error('Error fetching topology:', err);
      } finally {
        if (isMounted) setLoadingHomes(false);
      }
    };

    void loadInitialData();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectHome = async (home: Home) => {
    setSelectedHome(home);
    setSelectedRoomId(null);
    setLoadingRooms(true);
    try {
      const res = await apiFetch(`${API_URL}/homes/${home.id}/rooms`);
      const data = await res.json();
      const nextRooms = Array.isArray(data) ? data : [];
      setRooms(nextRooms);
      setSelectedRoomId(nextRooms[0]?.id ?? null);
    } catch (err) {
      console.error('Error fetching rooms:', err);
      setRooms([]);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handleAddRoom = async () => {
    if (!selectedHome || !newRoomName.trim()) return;
    setIsCreatingRoom(true);
    try {
      const res = await apiFetch(`${API_URL}/homes/${selectedHome.id}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim() })
      });
      if (res.ok) {
        setNewRoomName('');
        void handleSelectHome(selectedHome);
      }
    } catch (err) {
      console.error('Error creating room:', err);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) || null,
    [rooms, selectedRoomId],
  );

  const selectedHomeDevices = useMemo(
    () => devices.filter((device) => device.roomId && rooms.some((room) => room.id === device.roomId)),
    [devices, rooms],
  );

  const selectedRoomDevices = useMemo(
    () => selectedRoom ? devices.filter((device) => device.roomId === selectedRoom.id) : [],
    [devices, selectedRoom],
  );

  const activeRoomDeviceCount = useMemo(
    () => selectedRoomDevices.filter(isActiveDevice).length,
    [selectedRoomDevices],
  );

  if (loadingHomes) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      
      {/* Homes List */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            {t('topology.homes_title')} 
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {homes.length}
            </span>
          </h3>
        </div>
        
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          {homes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic bg-muted/20">
              {t('topology.no_homes', { defaultValue: 'No homes registered.' })}
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {Array.isArray(homes) && homes.map((home) => {
                const isSelected = selectedHome?.id === home.id;
                return (
                  <li 
                    key={home.id}
                    onClick={() => { void handleSelectHome(home); }}
                    className={cn(
                      "group flex flex-col p-4 cursor-pointer transition-all border-l-[4px] relative",
                      isSelected 
                        ? "bg-primary/5 border-l-primary" 
                        : "border-l-transparent hover:bg-muted/50 border-muted/20"
                    )}
                  >
                    {isSelected && loadingRooms && (
                      <div className="absolute inset-0 bg-primary/5 animate-pulse rounded-r-xl pointer-events-none" />
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2.5 rounded-xl transition-all duration-300",
                          isSelected ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                        )}>
                          <HomeIcon className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className={cn(
                            "font-bold text-sm transition-colors",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>{home.name}</span>
                          {isSelected && (
                            <span className="text-[9px] font-black tracking-tighter uppercase text-primary/60">{t('inbox.inspector.home_cluster')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && !loadingRooms && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary opacity-50" />
                        )}
                        <ArrowRight className={cn(
                          "w-4 h-4 transition-all duration-300", 
                          isSelected 
                            ? "text-primary translate-x-0 opacity-100" 
                            : "text-muted-foreground -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                        )} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 ml-12">
                      <span className="text-[10px] text-muted-foreground/50 font-mono bg-muted/30 px-2 py-0.5 rounded border border-border/10">
                        {home.id}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Rooms Details */}
      <div className="md:col-span-7 lg:col-span-8 flex flex-col gap-4">
        {selectedHome ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
                {t('topology.rooms_in')} <span className="text-foreground normal-case font-semibold bg-muted px-2 py-0.5 rounded-md">{selectedHome.name}</span>
              </h3>
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  placeholder={t('topology.placeholder')}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                />
                <button 
                  onClick={handleAddRoom}
                  disabled={isCreatingRoom || !newRoomName.trim()}
                  className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isCreatingRoom ? <Loader2 className="w-3 h-3 animate-spin" /> : t('topology.add_room')}
                </button>
              </div>
            </div>

            {loadingRooms ? (
              <div className="flex flex-col items-center justify-center p-16 border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-3" />
                <p className="text-sm">{t('common.loading')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] gap-4">
                {rooms.length === 0 ? (
                  <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-sm italic">
                    {t('topology.no_rooms', { defaultValue: 'No rooms associated with this environment.' })}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {Array.isArray(rooms) && rooms.map((room) => {
                        const isRoomSelected = selectedRoomId === room.id;
                        const roomDevices = devices.filter((device) => device.roomId === room.id);
                        const activeCount = roomDevices.filter(isActiveDevice).length;

                        return (
                          <button
                            key={room.id}
                            type="button"
                            onClick={() => setSelectedRoomId(room.id)}
                            className={cn(
                              "flex flex-col p-5 border rounded-xl bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all group text-left",
                              isRoomSelected ? "border-primary bg-primary/5 shadow-primary/10" : "border-border",
                            )}
                          >
                            <div className="flex items-center gap-3 mb-4">
                              <div className={cn(
                                "p-2.5 rounded-lg transition-colors",
                                isRoomSelected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground",
                              )}>
                                <Box className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate font-semibold text-foreground">{room.name}</span>
                                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                                  {t('topology.room_device_count', { count: roomDevices.length, defaultValue: `${roomDevices.length} devices` })}
                                </span>
                              </div>
                            </div>
                            <div className="mt-auto pt-4 border-t border-border/50 flex justify-between items-center gap-3">
                              <span className="text-xs text-muted-foreground font-medium">{t('inbox.inspector.room_label')}</span>
                              <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[140px]" title={room.id}>
                                {room.id}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                <PlugZap className="h-3 w-3" />
                                {activeCount}/{roomDevices.length}
                              </span>
                              {isRoomSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <aside className="rounded-xl border border-border bg-card p-5 shadow-sm">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                            {t('topology.room_details', { defaultValue: 'Room details' })}
                          </p>
                          <h4 className="mt-1 truncate text-lg font-black tracking-tight text-foreground">
                            {selectedRoom?.name || t('topology.select_room_hint', { defaultValue: 'Select a room' })}
                          </h4>
                        </div>
                        <div className="rounded-xl bg-primary/10 p-2 text-primary">
                          <Layers3 className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                            {t('topology.devices_total', { defaultValue: 'Devices' })}
                          </p>
                          <p className="mt-1 text-2xl font-black text-foreground">{selectedRoomDevices.length}</p>
                        </div>
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                            {t('topology.devices_active', { defaultValue: 'Active' })}
                          </p>
                          <p className="mt-1 text-2xl font-black text-primary">{activeRoomDeviceCount}</p>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-border/50 pt-5">
                        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                          {t('topology.devices_in_room', { defaultValue: 'Devices in room' })}
                        </p>
                        {selectedRoomDevices.length === 0 ? (
                          <p className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm font-medium text-muted-foreground">
                            {t('topology.no_devices_in_room', { defaultValue: 'No devices assigned to this room yet.' })}
                          </p>
                        ) : (
                          <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar">
                            {selectedRoomDevices.map((device) => (
                              <div key={device.id} className="rounded-2xl border border-border/60 bg-background/60 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-foreground">{device.name}</p>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">{device.type}</p>
                                  </div>
                                  <span className={cn(
                                    "shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-widest",
                                    isActiveDevice(device) ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                                  )}>
                                    {isActiveDevice(device) ? t('device_states.on') : t('device_states.off')}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 border-t border-border/50 pt-4">
                        <div className="flex justify-between gap-3 text-[10px] font-mono text-muted-foreground">
                          <span>{t('inbox.inspector.home_cluster')}</span>
                          <span className="truncate" title={selectedHome.id}>{selectedHomeDevices.length} / {selectedHome.id}</span>
                        </div>
                      </div>
                    </aside>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[350px] border border-border border-dashed rounded-xl bg-muted/10 text-muted-foreground cursor-default">
            <div className="p-4 bg-muted rounded-full mb-4 opacity-50">
              <HomeIcon className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-foreground">{t('topology.select_home_hint', { defaultValue: 'No Home Selected' })}</p>
            <p className="text-xs mt-1.5 opacity-80 max-w-xs text-center">{t('topology.select_home')}</p>
          </div>
        )}
      </div>
      
    </div>
  );
};
