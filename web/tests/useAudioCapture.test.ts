import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudioCapture } from "../src/hooks/useAudioCapture";

describe("useAudioCapture startup cleanup", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops microphone tracks and closes the AudioContext when AudioWorklet setup fails", async () => {
    const stopTrack = vi.fn();
    const closeContext = vi.fn().mockResolvedValue(undefined);
    const mediaStream = {
      getTracks: () => [{ stop: stopTrack }],
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(mediaStream);
    const addModule = vi.fn().mockRejectedValue(new Error("worklet file unavailable"));

    class MockAudioContext {
      state = "running";
      audioWorklet = { addModule };
      close = closeContext;
    }

    vi.stubGlobal("AudioContext", MockAudioContext);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useAudioCapture({ onFrame: vi.fn(), onError })
    );
    let caught: unknown;

    await act(async () => {
      try {
        await result.current.start();
      } catch (error) {
        caught = error;
      }
    });

    expect(caught).toBeInstanceOf(Error);
    expect(getUserMedia).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(closeContext).toHaveBeenCalledOnce();
    expect(onError).toHaveBeenCalledOnce();
    expect(result.current.isCapturing).toBe(false);
  });
});
