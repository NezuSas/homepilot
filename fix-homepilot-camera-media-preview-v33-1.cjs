// HomePilot V33.1 - Restore CameraMediaPreview component
// Run from repo root:
// node .\fix-homepilot-camera-media-preview-v33-1.cjs

const fs = require("fs");

const file = "apps/operator-console/src/views/dashboards/widgets/SectionWidget.tsx";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("function CameraMediaPreview(")) {
  const component = `function CameraMediaPreview({ mediaUrl, title }: { mediaUrl?: string; title: string }) {
  const isVideo = Boolean(mediaUrl && /\\.(mp4|webm|ogg)(\\?|#|$)/i.test(mediaUrl));
  const isHls = Boolean(mediaUrl && /\\.m3u8(\\?|#|$)/i.test(mediaUrl));
  const isRtsp = Boolean(mediaUrl && /^rtsp:/i.test(mediaUrl));

  if (mediaUrl && isVideo) {
    return (
      <video
        className="h-full w-full object-cover"
        src={mediaUrl}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  if (mediaUrl && !isHls && !isRtsp) {
    return (
      <img
        className="h-full w-full object-cover"
        src={mediaUrl}
        alt={title}
      />
    );
  }

  return (
    <div className="grid h-full w-full place-items-center bg-[radial-gradient(circle_at_90%_20%,rgba(234,88,12,0.25),transparent_16%),linear-gradient(135deg,rgba(234,88,12,0.24),rgba(18,18,18,0.95)_42%,rgba(8,8,8,0.98))]">
      <div className="grid h-16 w-16 place-items-center rounded-full border border-white/15 bg-black/25 text-white/70">
        <Camera className="h-9 w-9" />
      </div>
    </div>
  );
}

`;

  const anchor = "function CardPreview({";
  if (!s.includes(anchor)) {
    throw new Error("Could not find CardPreview anchor.");
  }

  s = s.replace(anchor, component + anchor);
}

fs.writeFileSync(file, s, "utf8");

console.log("V33.1 applied: CameraMediaPreview restored.");
console.log("Run: npm run build --workspace=apps/operator-console");
