export type MicrophoneDevices = Pick<MediaDevices, 'getUserMedia'>;

// Permission is the entire demo feature. Release every track immediately;
// no MediaRecorder, audio processing, storage, or upload is created.
export async function requestWebMicrophone(devices: MicrophoneDevices) {
  const stream = await devices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) track.stop();
}
