import { ReactConnector, ReactNode } from './react-connector';
import { Lazy } from '../utilities';
import { KeepBuffer, makeGetOption, MinLatencyReload, MinLatencySpeedup, Option } from '../options';

export function getPlayer(connector: Lazy<ReactConnector>): TwitchPlayer | null {
  return connector().find('twitch-player', node => node.setPlayerActive && node.props?.mediaPlayerInstance);
}

export function getPlayerState(connector: Lazy<ReactConnector>): TwitchPlayerState | null {
  return connector().find('twitch-player-state', node => node.setSrc && node.setInitialPlaybackSettings);
}

export function resetPlayer(connector: Lazy<ReactConnector>) {
  const player = getPlayer(connector)?.props?.mediaPlayerInstance;
  const playerState = getPlayerState(connector);
  if (!player) throw new Error('Could not find player');
  if (!playerState) throw new Error('Could not find player state');

  const sink = player.mediaSinkManager || player.core?.mediaSinkManager;
  if (sink?.video?._ffz_compressor) {
    const video = sink.video;
    const volume = video.volume ?? player.getVolume();
    const muted = player.isMuted();
    const newVideo = document.createElement('video') as ExtendedVideo;
    newVideo.volume = muted ? 0 : volume;
    newVideo.playsInline = true;
    video.replaceWith(newVideo);
    player.attachHTMLVideoElement(video);
    setImmediate(() => {
      player.setVolume(volume);
      player.setMuted(muted);
    });
  }

  playerState.setSrc({ isNewMediaPlayerInstance: true });
}

export function initWorkerHandler(connector: Lazy<ReactConnector>) {
  const worker = getPlayer(connector)?.props?.mediaPlayerInstance?.core?.worker;
  if (!worker) throw new Error('No worker');

  if (Reflect.get(worker, 'ad:known')) return;
  Reflect.set(worker, 'ad:known', true);

  console.log('Listening on worker messages.');

  worker.addEventListener('message', ({ data }: { data: WorkerMessage }) => {
    if (typeof data !== 'object') return;

    if (data.type === 'PlayerAnalyticsEvent') {
      const args: AnalyticsEventArgs = {properties: {...data.arg.properties}};
      if(args.properties.sink_buffer_size)
        args.properties.sink_buffer_size *= 1000;
      if (args.properties.sink_buffer_size && args.properties.sink_buffer_size > MinLatencySpeedup() * 1000) {
        if (args.properties.sink_buffer_size > MinLatencyReload() * 1000) resetPlayer(connector);
        else {
          const latencyToSkip = args.properties.sink_buffer_size - (KeepBuffer() * 1000);
          const video = document.querySelector('video')!;
          video.playbackRate = 2;
          setTimeout(() => {
            video.playbackRate = 1;
          }, latencyToSkip);
        }
      }
    } else if (data.type === 'PlayerError') {
      resetPlayer(connector);
    }
  });
}

interface TwitchPlayerState extends ReactNode {
  setSrc(options: { isNewMediaPlayerInstance: boolean }): void;
  setInitialPlaybackSettings(opts: unknown): void;
}

interface TwitchPlayer extends ReactNode {
  setPlayerActive: () => void;
  props?: {
    mediaPlayerInstance?: MediaPlayer;
  };
}

interface MediaPlayer extends ReactNode {
  core?: MediaPlayerCore;
  attachHTMLVideoElement: (el: HTMLVideoElement) => void;
  mediaSinkManager?: MediaSinkManager;
  getVolume(): number;
  setVolume(vol: number): void;
  setMuted(mut: boolean): void;
  isMuted(): boolean;
}

interface MediaPlayerCore {
  worker: Worker;
  mediaSinkManager?: MediaSinkManager;
  getVolume(): number;
  isMuted(): boolean;
}

interface MediaSinkManager {
  video?: ExtendedVideo;
}

type ExtendedVideo = HTMLVideoElement & { _ffz_compressor?: boolean; playsInline: boolean };

interface WorkerMessage {
  type: string | number;
  id: number;
  arg: any;
}

type AnalyticsEventArgs = {
  properties: {
    hls_latency_broadcaster?: number;
    sink_buffer_size?: number;
  };
};
