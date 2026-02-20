export class AudioManager {
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private onDataAvailable: ((data: ArrayBuffer) => void) | null = null;

  async startRecording(onData: (data: ArrayBuffer) => void) {
    try {
      if (!this.stream) {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (err) {
      console.error("Failed to access microphone:", err);
      return;
    }

    this.onDataAvailable = onData;
    
    // Explicitly use Opus for best quality/performance
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/ogg;codecs=opus";

    this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

    this.mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && this.onDataAvailable) {
        const buffer = await event.data.arrayBuffer();
        this.onDataAvailable(buffer);
      }
    };

    // Use a 250ms timeslice for real-time feel
    this.mediaRecorder.start(250);
  }

  stopRecording() {
    if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
      this.mediaRecorder.stop();
    }
    this.onDataAvailable = null;
  }

  async playAudioChunk(data: ArrayBuffer) {
    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume context if it was suspended (browser policy)
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      const audioBuffer = await this.audioContext.decodeAudioData(data.slice(0));
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      source.start();
    } catch (err) {
      console.error("Error playing audio chunk:", err);
    }
  }

  cleanup() {
    this.stopRecording();
    if (this.stream) {
      for (const track of this.stream.getTracks()) track.stop();
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
