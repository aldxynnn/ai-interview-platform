import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import HardwareCheck from "../src/components/HardwareCheck";
import { getBrowserInfo, getOSInfo, getCurrentTime } from "@/utils/hardwareUtils";
import { testInternetSpeed } from "@/utils/internetSpeedTest";

vi.mock("@/utils/hardwareUtils", () => ({
  ProctoringState: {
    WAITING: "waiting",
    LOADING: "loading",
    PASSED: "passed",
    ERROR: "error",
  },
  getBrowserInfo: vi.fn(),
  getOSInfo: vi.fn(),
  getCurrentTime: vi.fn(),
  checkCamera: vi.fn(),
}));

vi.mock("@/utils/internetSpeedTest", () => ({
  DEFAULT_THRESHOLDS: { minDownloadMbps: 8, minUploadMbps: 4, maxPingMs: 300 },
  testInternetSpeed: vi.fn(),
}));

const failedSpeed = {
  download: 1, upload: 1, ping: 900, passed: false,
  downloadTests: [1], uploadTests: [1], pingTests: [900],
};
const passedSpeed = {
  download: 40, upload: 20, ping: 35, passed: true,
  downloadTests: [40], uploadTests: [20], pingTests: [35],
};

describe("HardwareCheck Retry", () => {
  const stopTrack = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] } as unknown as MediaStream;
  const getUserMedia = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getBrowserInfo).mockClear();
    vi.mocked(getOSInfo).mockClear();
    vi.mocked(getCurrentTime).mockClear();
    vi.mocked(testInternetSpeed)
      .mockReset()
      .mockResolvedValueOnce(failedSpeed)
      .mockResolvedValueOnce(passedSpeed);
    getUserMedia.mockReset().mockResolvedValue(stream);

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    class MockAudioContext {
      state = "running";
      currentTime = 1;
      destination = {};
      audioWorklet = { addModule: vi.fn().mockResolvedValue(undefined) };
      createOscillator() {
        return {
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          frequency: { setValueAtTime: vi.fn() },
        };
      }
      createGain() {
        return { connect: vi.fn(), gain: { setValueAtTime: vi.fn() } };
      }
      createMediaStreamSource() {
        return { connect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 0,
          frequencyBinCount: 4,
          getByteFrequencyData: (data: Uint8Array) => data.fill(20),
        };
      }
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
    }

    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: MockAudioContext,
    });
    Object.defineProperty(window, "requestAnimationFrame", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reruns OS/browser and internet checks after Retry", async () => {
    render(<HardwareCheck onStart={vi.fn()} />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(850);
      await Promise.resolve();
    });

    expect(testInternetSpeed).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(850);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(testInternetSpeed).toHaveBeenCalledTimes(2);
    expect(getOSInfo).toHaveBeenCalledTimes(2);
    expect(getBrowserInfo).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: /start interview/i })).toBeEnabled();
  });
});
