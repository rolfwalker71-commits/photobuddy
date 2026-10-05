import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #5B66F5, #FF6B66)",
          color: "#ffffff",
          fontSize: 220,
          fontWeight: 700,
        }}
      >
        P
      </div>
    ),
    size,
  );
}
