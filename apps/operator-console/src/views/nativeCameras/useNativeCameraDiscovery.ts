import { useState } from 'react';
import { API_BASE_URL } from '../../config';
import { apiFetch } from '../../lib/apiClient';
import { MANUAL_DISCOVERY_ID } from './nativeCameraForm';
import type { DiscoveredCamera, NativeCameraSourceType } from './types';

/** State and loading flow of the ONVIF discovery modal that precedes the camera form. */
export function useNativeCameraDiscovery() {
  const [isDiscoveryModalOpen, setIsDiscoveryModalOpen] = useState(false);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<DiscoveredCamera[]>([]);
  const [selectedDiscoveredCamera, setSelectedDiscoveredCamera] = useState<string>('');
  const [selectedSourceType, setSelectedSourceType] = useState<NativeCameraSourceType>('onvif-ptz');

  const handleOpenDiscoveryModal = async () => {
    setIsDiscoveryModalOpen(true);
    setIsDiscovering(true);
    setSelectedSourceType('onvif-ptz');
    setSelectedDiscoveredCamera(MANUAL_DISCOVERY_ID);
    try {
      const res = await apiFetch(`${API_BASE_URL}/api/v1/native-cameras/discover`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveredCameras(data.devices || []);
      } else {
        setDiscoveredCameras([]);
      }
    } catch (err) {
      console.error(err);
      setDiscoveredCameras([]);
    } finally {
      setIsDiscovering(false);
    }
  };

  return {
    isDiscoveryModalOpen,
    isDiscovering,
    discoveredCameras,
    selectedDiscoveredCamera,
    selectedSourceType,
    setIsDiscoveryModalOpen,
    setSelectedDiscoveredCamera,
    setSelectedSourceType,
    handleOpenDiscoveryModal,
  };
}
