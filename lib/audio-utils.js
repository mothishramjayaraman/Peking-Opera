/**
 * Converts frequency in Hz to a musical note name
 */
export function frequencyToNote(frequency) {
  if (!frequency || frequency <= 0) return "--";

  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  
  // A4 = 440Hz is the 69th MIDI note
  const midiNote = Math.round(12 * Math.log2(frequency / 440) + 69);
  
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  
  return `${notes[noteIndex]}${octave}`;
}

/**
 * Calculates the cents offset from the nearest semitone
 */
export function getPitchOffset(frequency) {
  if (!frequency || frequency <= 0) return 0;
  
  const midiNote = 12 * Math.log2(frequency / 440) + 69;
  const nearestMidiNote = Math.round(midiNote);
  
  return Math.round((midiNote - nearestMidiNote) * 100);
}
