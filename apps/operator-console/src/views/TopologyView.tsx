import React, { useEffect, useState } from 'react';
import { Home as HomeIcon, Box, ArrowRight, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
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

export const TopologyView: React.FC = () => {
  const [homes, setHomes] = useState<Home[]>([]);
  const [selectedHome, setSelectedHome] = useState<Home | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingHomes, setLoadingHomes] = useState(true);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // En entorno Local/Edge, la API v1 expuesta en el puerto contiguo soluciona el binding
  const API_URL = `${API_BASE_URL}/api/v1`;

  useEffect(() => {
    fetch(`${API_URL}/homes`)
      .then((res) => res.json())
      .then((data) => {
        setHomes(data || []);
        if (data.length > 0 && !selectedHome) {
           handleSelectHome(data[0]);
        }
        setLoadingHomes(false);
      })
      .catch((err) => {
        console.error('Error fetching homes:', err);
        setLoadingHomes(false);
      });
  }, []);

  const handleSelectHome = (home: Home) => {
    setSelectedHome(home);
    setLoadingRooms(true);
    fetch(`${API_URL}/homes/${home.id}/rooms`)
      .then((res) => res.json())
      .then((data) => {
        setRooms(Array.isArray(data) ? data : []);
        setLoadingRooms(false);
      })
      .catch((err) => {
        console.error('Error fetching rooms:', err);
        setLoadingRooms(false);
      });
  };

  const handleAddRoom = async () => {
    if (!selectedHome || !newRoomName.trim()) return;
    setIsCreatingRoom(true);
    try {
      const res = await fetch(`${API_URL}/homes/${selectedHome.id}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newRoomName.trim() })
      });
      if (res.ok) {
        setNewRoomName('');
        handleSelectHome(selectedHome); // Refresh
      }
    } catch (err) {
      console.error('Error creating room:', err);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  if (loadingHomes) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-muted/10 rounded-xl border border-dashed">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p className="text-sm font-medium">Cargando topología estructural...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
      
      {/* Homes List */}
      <div className="md:col-span-5 lg:col-span-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold tracking-wider text-muted-foreground uppercase flex items-center gap-2">
            Homes Registrados 
            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-[10px]">
              {homes.length}
            </span>
          </h3>
        </div>
        
        <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
          {homes.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground italic bg-muted/20">
              No hay hogares registrados.
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {homes.map((home) => {
                const isSelected = selectedHome?.id === home.id;
                return (
                  <li 
                    key={home.id}
                    onClick={() => handleSelectHome(home)}
                    className={cn(
                      "group flex flex-col p-4 cursor-pointer transition-all border-l-[3px]",
                      isSelected 
                        ? "bg-primary/5 border-l-primary" 
                        : "border-l-transparent hover:bg-muted/50"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg transition-colors",
                          isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground group-hover:text-foreground"
                        )}>
                          <HomeIcon className="w-4 h-4" />
                        </div>
                        <span className={cn(
                          "font-medium text-sm transition-colors",
                          isSelected ? "text-primary" : "text-foreground"
                        )}>{home.name}</span>
                      </div>
                      <ArrowRight className={cn(
                        "w-4 h-4 transition-all duration-200", 
                        isSelected 
                          ? "text-primary translate-x-0 opacity-100" 
                          : "text-muted-foreground -translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0"
                      )} />
                    </div>
                    <div className="flex items-center justify-between mt-3 ml-11">
                      <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                        {home.id.split('-')[0] + '...'}
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
                Rooms en <span className="text-foreground normal-case font-semibold bg-muted px-2 py-0.5 rounded-md">{selectedHome.name}</span>
              </h3>
              <div className="flex items-center gap-2">
                <input 
                  type="text"
                  placeholder="New Room Name"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-primary outline-none transition-all"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddRoom()}
                />
                <button 
                  onClick={handleAddRoom}
                  disabled={isCreatingRoom || !newRoomName.trim()}
                  className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center gap-2"
                >
                  {isCreatingRoom ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add Room'}
                </button>
              </div>
            </div>

            {loadingRooms ? (
              <div className="flex flex-col items-center justify-center p-16 border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin mb-3" />
                <p className="text-sm">Recuperando habitaciones...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                {rooms.length === 0 ? (
                  <div className="col-span-full p-8 text-center border border-border border-dashed rounded-xl bg-card/30 text-muted-foreground text-sm italic">
                    No existen habitaciones asociadas a este entorno.
                  </div>
                ) : (
                  rooms.map((room) => (
                    <div 
                      key={room.id} 
                      className="flex flex-col p-5 border border-border rounded-xl bg-card shadow-sm hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 bg-primary/10 rounded-lg text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Box className="w-5 h-5" />
                        </div>
                        <span className="font-semibold text-foreground">{room.name}</span>
                      </div>
                      <div className="mt-auto pt-4 border-t border-border/50 flex justify-between items-center">
                         <span className="text-xs text-muted-foreground font-medium">Room ID</span>
                         <span className="text-[11px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded truncate max-w-[140px]" title={room.id}>
                           {room.id}
                         </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-[350px] border border-border border-dashed rounded-xl bg-muted/10 text-muted-foreground cursor-default">
            <div className="p-4 bg-muted rounded-full mb-4 opacity-50">
              <HomeIcon className="w-8 h-8" />
            </div>
            <p className="text-sm font-medium text-foreground">Ningún Hogar Seleccionado</p>
            <p className="text-xs mt-1.5 opacity-80 max-w-xs text-center">Selecciona un elemento estructural en el panel izquierdo para visualizar e inspeccionar sus propiedades físicas asociadas.</p>
          </div>
        )}
      </div>
      
    </div>
  );
};
