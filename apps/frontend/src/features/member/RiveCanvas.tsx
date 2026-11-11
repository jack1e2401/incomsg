import { useRive } from "@rive-app/react-webgl2";

export default function RiveCanvas({ src, onError }: { src: string; onError: () => void }) {
  const { rive, RiveComponent } = useRive(
    { src, stateMachine: "State Machine 1", autoplay: true, onLoadError: onError },
    {
      useDevicePixelRatio: true,
      fitCanvasToArtboardHeight: true,
      useOffscreenRenderer: true,
      shouldResizeCanvasToContainer: true,
    },
  );
  return rive ? <RiveComponent className="h-full w-full" aria-label="Nhân vật Loyalty" /> : null;
}
