import { getInfo } from "react-mediainfo";

export interface VideoInfo {
  videoFPS: number;
  index_count: number;
  duration: number;
  format: string;
}

export async function getVideoInfo(url: string): Promise<VideoInfo | null> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const file = new File([blob], "video.mp4", { type: "video/mp4" });
    const info: any = await getInfo(file);
    console.log("🚀 ~ video info:", info);
    const videoTrack = info.media.track.find(
      (track: any) => track["@type"] === "Video"
    );
    const result = {
      videoFPS: Number(
        (
          (parseFloat(videoTrack.FrameCount) - 1) /
          parseFloat(videoTrack.Duration)
        ).toFixed(6)
      ),
      index_count: Number(videoTrack.FrameCount),
      duration: Number(videoTrack.Duration),
      format: videoTrack.Format,
    };
    if (result) {
      return result;
    }
  } catch (error) {
    console.error("Error getting video info:", error);
  }
  return null;
}
