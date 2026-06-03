import { useState, useRef, useCallback, useEffect } from "react";
import { PitchDetector } from "pitchy";
import { encodeWAV } from "@/lib/wav-encoder";

export function useAudioRecorder() {
  const [state, setState] = useState({
    isRecording: false,
    duration: 0,
    audioBlob: null,
    audioUrl: null,
    analyserData: null,
    pitch: null,
    clarity: null,
    error: null,
    volumeLevel: 0,
    levelWarning: null, // 'too-quiet' | 'too-loud' | null
  });

  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const processorRef = useRef(null);
  const streamRef = useRef(null);
  const pcmDataRef = useRef([]);
  const timerRef = useRef(null);
  const animationFrameRef = useRef(null);

  // Refs for audio analyzer objects to avoid GC pressure
  const freqDataRef = useRef(null);
  const timeDataRef = useRef(null);
  const detectorRef = useRef(null);

  //animation purpose like waveform
  const updateAudioData = useCallback(() => {
    if (analyserRef.current && audioContextRef.current) {
      if (!freqDataRef.current) {
        freqDataRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);
      }
      if (!timeDataRef.current) {
        timeDataRef.current = new Float32Array(analyserRef.current.fftSize);
      }
      if (!detectorRef.current) {
        detectorRef.current = PitchDetector.forFloat32Array(analyserRef.current.fftSize);
      }

      analyserRef.current.getByteFrequencyData(freqDataRef.current);
      analyserRef.current.getFloatTimeDomainData(timeDataRef.current);

      const [pitch, clarity] = detectorRef.current.findPitch(
        timeDataRef.current,
        audioContextRef.current.sampleRate,
      );

      // RMS = root mean square (volume measurement)
      let rms = 0;
      for (let i = 0; i < timeDataRef.current.length; i++) {
        rms += timeDataRef.current[i] * timeDataRef.current[i];
      }
      rms = Math.sqrt(rms / timeDataRef.current.length);

      const volumeLevel = Math.min(100, Math.max(0, rms * 500)); // Scale to 0-100

      let levelWarning = null;
      if (volumeLevel < 10) {
        levelWarning = "too-quiet"; // Mic too far or low volume
      } else if (volumeLevel > 90) {
        levelWarning = "too-loud"; // Might clip
      }

      setState((prev) => ({
        ...prev,
        analyserData: new Uint8Array(freqDataRef.current), // Need a copy for React state to trigger render correctly
        pitch: clarity > 0.8 ? pitch : null,
        clarity,
        volumeLevel,
        levelWarning,
      }));

      animationFrameRef.current = requestAnimationFrame(updateAudioData);
    }
  }, [state.isRecording]);

  const startRecording = useCallback(async () => {
    try {
      //chain created : Microphone → Source Node → Analyser Node → ScriptProcessor → Destination

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); //browser microphone permission
      streamRef.current = stream;

      // 2. Create the AudioContext — the  audio engine that processes all audio
      const AudioContextClass =
        window.AudioContext || window.webkitAudioContext; //for older brower audioContext does not support so it uses webkit
      audioContextRef.current = new AudioContextClass(); //no re render issue for mic

      // 3. Wrap the mic stream into a "Source Node" (entry point of the chain)
      sourceRef.current =
        audioContextRef.current.createMediaStreamSource(stream); //stream get from userMedia and wraps into source node

      //4.analyser node
      analyserRef.current = audioContextRef.current.createAnalyser(); //gives waveform bars and pitch detection via pitchy
      analyserRef.current.fftSize = 2048; // it makes individual freq to detect pitch (60fps)

      // 5.script processor
      processorRef.current = audioContextRef.current.createScriptProcessor(
        4096, //sample per chunk
        1,
        1,
      ); //intercept the audio and returns in chunk

      pcmDataRef.current = []; //clear previous audio chunks

      //capture every audio chunk
      processorRef.current.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0); //one chunk of 4096 literally voice drawn as number b/t -1.0 to +1.0. channel 0 means audio from mic
        // Copy to our buffer
        pcmDataRef.current.push(new Float32Array(inputData)); //make copy becoz the original chunk is overwritten and add it to array.
      };

      //connecting the source,analyser,processor together.without connect the node gets disconnected
      sourceRef.current.connect(analyserRef.current); //entry point
      analyserRef.current.connect(processorRef.current); //reads pitch +waveform live
      processorRef.current.connect(audioContextRef.current.destination); //capture 4096 samples

      //update state is recording true
      setState((prev) => ({
        ...prev,
        isRecording: true,
        duration: 0,
        audioBlob: null,
        audioUrl: null,
        error: null,
      }));
      //ui time duration running
      timerRef.current = setInterval(() => {
        //calculating duration count
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      updateAudioData();
    } catch (err) {
      console.error("Mic access error:", err);
      setState((prev) => ({
        ...prev,
        error: "Could not access microphone.",
      }));
    }
  }, [updateAudioData]);

  const stopRecording = useCallback(() => {
    if (audioContextRef.current && state.isRecording) {
      // Disconnect and Cleanup
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current.onaudioprocess = null;
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

      const sampleRate = audioContextRef.current.sampleRate;

      // Flatten PCM data
      const totalLength = pcmDataRef.current.reduce(
        (acc, current) => acc + current.length,
        0,
      );

      //rewind the audio
      const result = new Float32Array(totalLength);
      let offset = 0;
      for (const chunk of pcmDataRef.current) {
        result.set(chunk, offset); // stores all the chunks
        offset += chunk.length;
      }

      // Encode to WAV
      const blob = encodeWAV(result, sampleRate); //pcm to wav
      const url = URL.createObjectURL(blob); //audio playable

      setState((prev) => ({
        ...prev,
        isRecording: false,
        audioBlob: blob,
        audioUrl: url,
        pitch: null,
        clarity: null,
      })); //stops recording

      // Cancel timer + animation loop
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);

      //Release mic + close engine
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      audioContextRef.current.close();
    }
  }, [state.isRecording]);

  const resetRecording = useCallback(() => {
    //clear all
    if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    setState({
      isRecording: false,
      duration: 0,
      audioBlob: null,
      audioUrl: null,
      analyserData: null,
      pitch: null,
      clarity: null,
      error: null,
      volumeLevel: 0,
      levelWarning: null,
    });
    pcmDataRef.current = []; //cleanup previous audio chunk
  }, [state.audioUrl]);

  //upload audio file
  const loadAudioFile = useCallback(async (file) => {
    if (!file) return;

    try {
      const url = URL.createObjectURL(file); //convert the audio blob

      // Create a temporary audio element to get the duration
      const audio = new Audio(url);
      const durationPromise = new Promise((resolve) => {
        audio.onloadedmetadata = () => {
          resolve(Math.round(audio.duration));
        };
        // Safety timeout in case metadata can't be loaded
        setTimeout(() => resolve(0), 1000);
      });

      const loadedDuration = await durationPromise; //wait for meta data.

      setState((prev) => {
        if (prev.audioUrl) URL.revokeObjectURL(prev.audioUrl);
        return {
          ...prev,
          audioBlob: file, // actual file
          audioUrl: url, //playable audio
          duration: loadedDuration, //duration on screen
          isRecording: false, //not recording just upload
          error: null,
        };
      });
    } catch (err) {
      console.error("Load error:", err);
      setState((prev) => ({ ...prev, error: "Failed to process audio file." }));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationFrameRef.current)
        cancelAnimationFrame(animationFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        audioContextRef.current.close();
      }
      if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
    };
  }, [state.audioUrl]);

  return {
    ...state,
    startRecording,
    stopRecording,
    resetRecording,
    loadAudioFile,
  };
}
