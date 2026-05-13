'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useLoader, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { BackSide, Camera, Scene, TextureLoader, WebGLRenderer } from 'three';
import { Maximize2, Minimize2, X } from 'lucide-react';

type Side = 'left' | 'right';

export type CameraSyncState = {
  position: [number, number, number];
  target: [number, number, number];
  source: Side;
  seq: number;
};

interface Compare360ViewerProps {
  viewerSide: Side;
  imageUrl: string;
  displayFileName?: string;
  roomLabel?: string;
  captureDate?: string;
  onClose: () => void;
  sharedCameraState: CameraSyncState | null;
  onCameraStateChange: (
    side: Side,
    state: { position: [number, number, number]; target: [number, number, number] },
  ) => void;
  isSynchronized: boolean;
  onTakeScreenshot?: (fn: () => string | null) => void;
}

function PanoramicSphere({ imageUrl }: { imageUrl: string }) {
  const { gl } = useThree();
  const texture = useLoader(TextureLoader, imageUrl);
  useEffect(() => {
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  }, [texture, gl]);
  return (
    <mesh>
      <sphereGeometry args={[500, 60, 40]} />
      <meshBasicMaterial map={texture} side={BackSide} />
    </mesh>
  );
}

function ScreenshotHelper({
  setRefs,
}: {
  setRefs: (gl: WebGLRenderer, scene: Scene, camera: Camera) => void;
}) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    setRefs(gl, scene, camera);
  }, [gl, scene, camera, setRefs]);
  return null;
}

export default function Compare360Viewer({
  viewerSide,
  imageUrl,
  displayFileName = '',
  roomLabel = '',
  captureDate = '',
  onClose,
  sharedCameraState,
  onCameraStateChange,
  isSynchronized,
  onTakeScreenshot,
}: Compare360ViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const glRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const orbitRef = useRef<OrbitControlsImpl | null>(null);
  const isApplyingRef = useRef(false);
  const lastBroadcastRef = useRef(0);

  const setRefs = (gl: WebGLRenderer, scene: Scene, camera: Camera) => {
    glRef.current = gl;
    sceneRef.current = scene;
    cameraRef.current = camera;
  };

  useEffect(() => {
    if (!onTakeScreenshot) return;
    onTakeScreenshot(() => {
      if (glRef.current && sceneRef.current && cameraRef.current) {
        glRef.current.render(sceneRef.current, cameraRef.current);
        return glRef.current.domElement.toDataURL('image/png');
      }
      return null;
    });
  }, [onTakeScreenshot]);

  useEffect(() => {
    if (!isSynchronized || !cameraRef.current || !sharedCameraState) return;
    if (sharedCameraState.source === viewerSide) return;
    isApplyingRef.current = true;
    cameraRef.current.position.set(...sharedCameraState.position);
    if (orbitRef.current?.target) {
      orbitRef.current.target.set(...sharedCameraState.target);
      orbitRef.current.update();
    }
    isApplyingRef.current = false;
  }, [sharedCameraState, isSynchronized, viewerSide]);

  const handleCameraChange = () => {
    if (!cameraRef.current || !isSynchronized || isApplyingRef.current) return;
    const now = Date.now();
    if (now - lastBroadcastRef.current < 50) return;
    lastBroadcastRef.current = now;
    const target = orbitRef.current?.target;
    onCameraStateChange(viewerSide, {
      position: [cameraRef.current.position.x, cameraRef.current.position.y, cameraRef.current.position.z],
      target: target ? [target.x, target.y, target.z] : [0, 0, 0],
    });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void viewerRef.current?.requestFullscreen();
    } else {
      void document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div ref={viewerRef} className="relative h-full w-full overflow-hidden rounded-lg bg-base-950">
      {/* File info overlay */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2 rounded-lg border border-base-700 bg-base-900/90 px-3 py-2 text-center backdrop-blur-sm">
        <p className="max-w-[200px] truncate text-[12px] font-medium text-white">{displayFileName || imageUrl.split('/').pop()}</p>
        {(roomLabel || captureDate) && (
          <p className="mt-0.5 text-[11px] text-ink-400">
            {roomLabel}{roomLabel && captureDate ? ' · ' : ''}{captureDate}
          </p>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute left-3 top-3 z-10 rounded-full border border-base-700 bg-base-900/90 p-1.5 text-ink-300 backdrop-blur-sm transition-colors hover:text-white"
      >
        <X size={14} />
      </button>

      {/* Fullscreen */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute bottom-3 right-3 z-10 rounded-full border border-base-700 bg-base-900/90 p-1.5 text-ink-300 backdrop-blur-sm transition-colors hover:text-white"
      >
        {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
      </button>

      <Canvas camera={{ fov: 70, position: [0, 0, 20] }}>
        <ScreenshotHelper setRefs={setRefs} />
        <PanoramicSphere imageUrl={imageUrl} />
        <OrbitControls
          ref={orbitRef as React.RefObject<OrbitControlsImpl>}
          enablePan
          enableZoom={false}
          enableDamping
          dampingFactor={0.3}
          onChange={handleCameraChange}
        />
      </Canvas>
    </div>
  );
}
