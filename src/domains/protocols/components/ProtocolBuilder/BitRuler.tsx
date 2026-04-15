const positions = Array.from({ length: 33 }, (_, i) => i);
const isMajor = (i: number) => i % 4 === 0;

function labelTransform(i: number) {
  if (i === 0) return "translateX(0%)";
  if (i === 32) return "translateX(-100%)";
  return "translateX(-50%)";
}

export default function BitRuler() {
  return (
    <div
      className="relative select-none mb-1 overflow-hidden"
      style={{ height: "28px" }}
    >
      {/* Labels */}
      <div className="flex w-full absolute top-0 left-0">
        {positions.map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${(i / 32) * 100}%`,
              transform: labelTransform(i),
            }}
          >
            {isMajor(i) && (
              <span className="font-mono text-xs font-semibold text-zinc-400 leading-none">
                {i}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Tick marks */}
      <div
        className="flex w-full absolute bottom-0 left-0"
        style={{ height: "10px" }}
      >
        {positions.map((i) => (
          <div
            key={i}
            className="absolute"
            style={{
              left: `${(i / 32) * 100}%`,
              transform: "translateX(-50%)",
              width: "1px",
              height: isMajor(i) ? "10px" : "5px",
              background: isMajor(i)
                ? "rgb(113 113 122 / 0.8)"
                : "rgb(63 63 70 / 0.7)",
            }}
          />
        ))}
      </div>
    </div>
  );
}
