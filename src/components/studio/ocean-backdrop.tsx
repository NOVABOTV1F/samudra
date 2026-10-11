export function OceanBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="ocean-scene absolute inset-0" />
      <div className="ocean-caustic absolute -inset-[12%]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-linear-to-t from-abyss to-transparent" />
    </div>
  );
}
