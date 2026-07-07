// Layout constants
export const DEVICE_WIDTH = 200
export const HEADER_HEIGHT = 36
export const PORT_PADDING = 5
export const PORT_ROW = 24

// Signal colors
export const COLORS = {
  video: '#00d4ff',
  audio: '#ff9500',
  ok: '#00d97e',
  err: '#ff3b5c',
}

// Device category colors
export const CAT_COLORS = {
  source: '#ff5566',
  switcher: '#00d4ff',
  converter: '#c9a227',
  compute: '#00d97e',
  audio: '#ff9500',
  display: '#5588ff',
}

export const CAT_LABELS = {
  source: '信号源',
  switcher: '切换设备',
  converter: '转换设备',
  compute: '计算设备',
  audio: '音频设备',
  display: '显示设备',
}

// Device type definitions
export const DEVICE_TYPES = {
  camera_sony: {
    label: '索尼摄像机', category: 'source',
    inputs: [],
    outputs: [{ label: 'HDMI OUT', signal: 'video' }],
  },
  camera_a7m3: {
    label: '索尼A7M3', category: 'source',
    inputs: [],
    outputs: [{ label: 'HDMI OUT', signal: 'video' }],
  },
  camera_6d2: {
    label: '佳能6D2', category: 'source',
    inputs: [],
    outputs: [{ label: 'HDMI OUT', signal: 'video' }],
  },
  microphone: {
    label: '麦克风', category: 'source',
    icon: 'microphone',
    inputs: [],
    outputs: [{ label: 'XLR OUT', signal: 'audio' }],
  },
  switcher: {
    label: '切换台', category: 'switcher',
    inputs: [
      { label: 'IN 1', signal: 'video' },
      { label: 'IN 2', signal: 'video' },
      { label: 'IN 3', signal: 'video' },
      { label: 'IN 4', signal: 'video' },
    ],
    outputs: [
      { label: 'OUT 1', signal: 'video' },
      { label: 'OUT 2', signal: 'video' },
      { label: 'MON', signal: 'video' },
    ],
  },
  capture_card: {
    label: '采集卡', category: 'converter',
    inputs: [{ label: 'HDMI IN', signal: 'video' }],
    outputs: [
      { label: 'USB OUT', signal: 'video' },
      { label: 'HDMI LOOP', signal: 'video' },
    ],
  },
  laptop: {
    label: '笔记本', category: 'compute',
    inputs: [
      { label: 'USB 1', signal: 'video' },
      { label: 'USB 2', signal: 'video' },
      { label: 'USB 3', signal: 'audio' },
      { label: 'USB 4', signal: 'audio' },
    ],
    outputs: [{ label: 'HDMI OUT', signal: 'video' }],
  },
  sound_card: {
    label: '声卡', category: 'audio',
    inputs: [{ label: 'AUDIO IN', signal: 'audio' }],
    outputs: [{ label: 'USB OUT', signal: 'audio' }],
  },
  audio_mixer: {
    label: '调音台', category: 'audio',
    inputs: [
      { label: 'IN 1', signal: 'audio' },
      { label: 'IN 2', signal: 'audio' },
    ],
    outputs: [{ label: 'MAIN OUT', signal: 'audio' }],
  },
  large_screen: {
    label: '大屏', category: 'display',
    inputs: [{ label: 'HDMI IN', signal: 'video' }],
    outputs: [],
  },
}

// Initial demo state
export const INITIAL_DEVICES = [
  { id: 'd1', typeId: 'camera_sony', name: '索尼摄像机 1', x: 60, y: 80 },
  { id: 'd2', typeId: 'camera_a7m3', name: '索尼A7M3 1', x: 60, y: 220 },
  { id: 'd3', typeId: 'switcher', name: '切换台 1', x: 360, y: 130 },
  { id: 'd4', typeId: 'large_screen', name: '大屏 1', x: 660, y: 60 },
  { id: 'd5', typeId: 'capture_card', name: '采集卡 1', x: 660, y: 250 },
  { id: 'd6', typeId: 'laptop', name: '笔记本 1', x: 940, y: 140 },
  { id: 'd7', typeId: 'audio_mixer', name: '调音台 1', x: 360, y: 420 },
  { id: 'd8', typeId: 'sound_card', name: '声卡 1', x: 660, y: 440 },
  { id: 'd9', typeId: 'microphone', name: '麦克风 1', x: 60, y: 440 },
]

export const INITIAL_CONNECTIONS = [
  { id: 'c1', fromDeviceId: 'd1', fromPortIndex: 0, toDeviceId: 'd3', toPortIndex: 0, signalType: 'video' },
  { id: 'c2', fromDeviceId: 'd2', fromPortIndex: 0, toDeviceId: 'd3', toPortIndex: 1, signalType: 'video' },
  { id: 'c3', fromDeviceId: 'd3', fromPortIndex: 0, toDeviceId: 'd5', toPortIndex: 0, signalType: 'video' },
  { id: 'c4', fromDeviceId: 'd3', fromPortIndex: 1, toDeviceId: 'd4', toPortIndex: 0, signalType: 'video' },
  { id: 'c5', fromDeviceId: 'd5', fromPortIndex: 0, toDeviceId: 'd6', toPortIndex: 0, signalType: 'video' },
  { id: 'c6', fromDeviceId: 'd6', fromPortIndex: 0, toDeviceId: 'd3', toPortIndex: 2, signalType: 'video' },
  { id: 'c7', fromDeviceId: 'd9', fromPortIndex: 0, toDeviceId: 'd7', toPortIndex: 0, signalType: 'audio' },
  { id: 'c8', fromDeviceId: 'd7', fromPortIndex: 0, toDeviceId: 'd8', toPortIndex: 0, signalType: 'audio' },
  { id: 'c9', fromDeviceId: 'd8', fromPortIndex: 0, toDeviceId: 'd6', toPortIndex: 2, signalType: 'audio' },
]

export const INITIAL_REQUIREMENTS = [
  { id: 'r1', sourceDeviceId: 'd1', destDeviceId: 'd6', signalType: 'video' },
  { id: 'r2', sourceDeviceId: 'd2', destDeviceId: 'd6', signalType: 'video' },
  { id: 'r3', sourceDeviceId: 'd3', destDeviceId: 'd4', signalType: 'video' },
  { id: 'r4', sourceDeviceId: 'd6', destDeviceId: 'd3', signalType: 'video' },
  { id: 'r5', sourceDeviceId: 'd9', destDeviceId: 'd6', signalType: 'audio' },
]
