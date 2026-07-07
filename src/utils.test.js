import { describe, it, expect } from 'vitest'
import { findRoute, validateRequirements } from './utils.js'
import { DEVICE_TYPES } from './constants.js'

// Build a getDeviceType callback from a devices array (same shape as project devices).
function typeResolver(devices) {
  return (deviceId) => {
    const dev = devices.find(d => d.id === deviceId)
    return dev ? DEVICE_TYPES[dev.typeId] : undefined
  }
}

describe('findRoute — single requirement', () => {
  it('finds a port-level route through camera -> switcher -> capture -> laptop', () => {
    const devices = [
      { id: 'cam', typeId: 'camera_sony' },
      { id: 'sw', typeId: 'switcher' },
      { id: 'cap', typeId: 'capture_card' },
      { id: 'lap', typeId: 'laptop' },
    ]
    const connections = [
      { id: 'c1', fromDeviceId: 'cam', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 0, signalType: 'video' },
      { id: 'c2', fromDeviceId: 'sw', fromPortIndex: 0, toDeviceId: 'cap', toPortIndex: 0, signalType: 'video' },
      { id: 'c3', fromDeviceId: 'cap', fromPortIndex: 0, toDeviceId: 'lap', toPortIndex: 0, signalType: 'video' },
    ]
    const route = findRoute(connections, 'cam', 'lap', 'video', typeResolver(devices))
    expect(route).not.toBeNull()
    // Route starts at cam out-port 0, ends at lap in-port 0.
    expect(route[0]).toEqual({ deviceId: 'cam', portIndex: 0, direction: 'out' })
    expect(route[route.length - 1]).toEqual({ deviceId: 'lap', portIndex: 0, direction: 'in' })
  })

  it('returns null when no path exists (broken)', () => {
    const devices = [
      { id: 'cam', typeId: 'camera_sony' },
      { id: 'lap', typeId: 'laptop' },
    ]
    const connections = []
    const route = findRoute(connections, 'cam', 'lap', 'video', typeResolver(devices))
    expect(route).toBeNull()
  })
})

describe('validateRequirements — port conflict between requirements', () => {
  it('two requirements competing for the same single-OUT port: second is conflict', () => {
    // Capture card has 1 USB OUT (port 0) and 1 HDMI LOOP (port 1) — both video.
    // Two requirements both need to pass THROUGH the capture card's USB OUT (port 0)
    // to reach distinct laptops. Only one can use port 0; the second should conflict.
    // We wire both capture-card outputs, but the LOOP (port 1) goes nowhere useful,
    // forcing both requirements to want port 0.
    const devices = [
      { id: 'cam1', typeId: 'camera_sony' },
      { id: 'cam2', typeId: 'camera_sony' },
      { id: 'sw', typeId: 'switcher' },
      { id: 'cap', typeId: 'capture_card' },
      { id: 'lap1', typeId: 'laptop' },
      { id: 'lap2', typeId: 'laptop' },
    ]
    const connections = [
      // Both cameras into switcher IN 0 and IN 1.
      { id: 'c1', fromDeviceId: 'cam1', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 0, signalType: 'video' },
      { id: 'c2', fromDeviceId: 'cam2', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 1, signalType: 'video' },
      // Switcher OUT 0 -> capture card IN 0 (single path through cap).
      { id: 'c3', fromDeviceId: 'sw', fromPortIndex: 0, toDeviceId: 'cap', toPortIndex: 0, signalType: 'video' },
      // Capture card USB OUT 0 -> lap1 IN 0.
      { id: 'c4', fromDeviceId: 'cap', fromPortIndex: 0, toDeviceId: 'lap1', toPortIndex: 0, signalType: 'video' },
      // Capture card USB OUT 0 -> lap2 IN 0 — SAME out-port c4 uses. Topologically reachable,
      // but the out-port can't serve two requirements. (No second wire from cap port 0 exists,
      // so the second requirement has no port-level route once the first consumes cap:0:out.)
      // To make it topologically reachable but port-conflicted, add a second wire from cap port 1 (LOOP) to lap2.
      { id: 'c5', fromDeviceId: 'cap', fromPortIndex: 1, toDeviceId: 'lap2', toPortIndex: 0, signalType: 'video' },
    ]
    const requirements = [
      { id: 'r1', sourceDeviceId: 'cam1', destDeviceId: 'lap1', signalType: 'video' },
      { id: 'r2', sourceDeviceId: 'cam2', destDeviceId: 'lap2', signalType: 'video' },
    ]
    const results = validateRequirements(requirements, connections, typeResolver(devices))
    const r1 = results.find(r => r.requirementId === 'r1')
    const r2 = results.find(r => r.requirementId === 'r2')
    expect(r1.status).toBe('ok')
    // r2 is topologically reachable (cap LOOP -> lap2) but the switcher OUT 0 is consumed by r1,
    // and there's no second switcher->cap wire. So r2 can't get a port-level route -> conflict.
    expect(r2.status).toBe('conflict')
    expect(r2.conflictWith).toBe('r1')
  })
})

describe('validateRequirements — different signal types do not conflict', () => {
  it('video and audio requirements use disjoint ports and both succeed', () => {
    const devices = [
      { id: 'mic', typeId: 'microphone' },
      { id: 'mixer', typeId: 'audio_mixer' },
      { id: 'sc', typeId: 'sound_card' },
      { id: 'lap', typeId: 'laptop' },
      { id: 'cam', typeId: 'camera_sony' },
      { id: 'sw', typeId: 'switcher' },
      { id: 'cap', typeId: 'capture_card' },
    ]
    const connections = [
      // Audio chain: mic -> mixer IN 0 -> sc -> lap USB 2 (audio)
      { id: 'a1', fromDeviceId: 'mic', fromPortIndex: 0, toDeviceId: 'mixer', toPortIndex: 0, signalType: 'audio' },
      { id: 'a2', fromDeviceId: 'mixer', fromPortIndex: 0, toDeviceId: 'sc', toPortIndex: 0, signalType: 'audio' },
      { id: 'a3', fromDeviceId: 'sc', fromPortIndex: 0, toDeviceId: 'lap', toPortIndex: 2, signalType: 'audio' },
      // Video chain: cam -> sw -> cap -> lap USB 0 (video)
      { id: 'v1', fromDeviceId: 'cam', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 0, signalType: 'video' },
      { id: 'v2', fromDeviceId: 'sw', fromPortIndex: 0, toDeviceId: 'cap', toPortIndex: 0, signalType: 'video' },
      { id: 'v3', fromDeviceId: 'cap', fromPortIndex: 0, toDeviceId: 'lap', toPortIndex: 0, signalType: 'video' },
    ]
    const requirements = [
      { id: 'rv', sourceDeviceId: 'cam', destDeviceId: 'lap', signalType: 'video' },
      { id: 'ra', sourceDeviceId: 'mic', destDeviceId: 'lap', signalType: 'audio' },
    ]
    const results = validateRequirements(requirements, connections, typeResolver(devices))
    expect(results.find(r => r.requirementId === 'rv').status).toBe('ok')
    expect(results.find(r => r.requirementId === 'ra').status).toBe('ok')
  })
})

describe('validateRequirements — switcher OUT exhaustion', () => {
  it('four video requirements through a 3-OUT switcher: fourth conflicts', () => {
    // Switcher has 3 video OUTs (ports 0,1,2). Four requirements each need to traverse
    // the switcher to a distinct destination. The fourth finds all OUTs consumed -> conflict.
    const devices = [
      { id: 'cam1', typeId: 'camera_sony' },
      { id: 'cam2', typeId: 'camera_sony' },
      { id: 'cam3', typeId: 'camera_sony' },
      { id: 'cam4', typeId: 'camera_sony' },
      { id: 'sw', typeId: 'switcher' },
      { id: 'scr1', typeId: 'large_screen' },
      { id: 'scr2', typeId: 'large_screen' },
      { id: 'scr3', typeId: 'large_screen' },
      { id: 'scr4', typeId: 'large_screen' },
    ]
    const connections = [
      // Each camera into a distinct switcher IN.
      { id: 'c1', fromDeviceId: 'cam1', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 0, signalType: 'video' },
      { id: 'c2', fromDeviceId: 'cam2', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 1, signalType: 'video' },
      { id: 'c3', fromDeviceId: 'cam3', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 2, signalType: 'video' },
      { id: 'c4', fromDeviceId: 'cam4', fromPortIndex: 0, toDeviceId: 'sw', toPortIndex: 3, signalType: 'video' },
      // Switcher 3 OUTs each to a distinct screen.
      { id: 's1', fromDeviceId: 'sw', fromPortIndex: 0, toDeviceId: 'scr1', toPortIndex: 0, signalType: 'video' },
      { id: 's2', fromDeviceId: 'sw', fromPortIndex: 1, toDeviceId: 'scr2', toPortIndex: 0, signalType: 'video' },
      { id: 's3', fromDeviceId: 'sw', fromPortIndex: 2, toDeviceId: 'scr3', toPortIndex: 0, signalType: 'video' },
      // scr4 has NO wire from the switcher (all 3 OUTs already used by s1/s2/s3).
      // So cam4->scr4 is topologically unreachable -> broken, not conflict.
      // To test OUT EXHAUSTION (conflict, not broken), we need scr4 reachable topologically
      // but blocked by port consumption. Add a 4th wire reusing switcher OUT 0 -> scr4.
      // But OUT 0 can only hold one wire (isOccupied model). Topologically device-reachable
      // treats switcher->scr4 as reachable via OUT 0 (same device). So:
      // (We don't add a 4th wire; deviceReachable checks if sw can reach scr4 via ANY video conn.
      //  sw has conns to scr1/2/3 only, not scr4. So cam4->scr4 is broken, not conflict.)
      // Correct way to force OUT exhaustion as conflict: give scr4 its own wire from switcher OUT 0
      // is impossible (one wire per out-port in the connection model — but deviceReachable doesn't
      // check port uniqueness, it just follows fromDeviceId). So add a wire sw OUT 0 -> scr4:
    ]
    // Add the 4th wire so scr4 is device-reachable from sw (via OUT 0, sharing with scr1).
    connections.push({ id: 's4', fromDeviceId: 'sw', fromPortIndex: 0, toDeviceId: 'scr4', toPortIndex: 0, signalType: 'video' })
    const requirements = [
      { id: 'r1', sourceDeviceId: 'cam1', destDeviceId: 'scr1', signalType: 'video' },
      { id: 'r2', sourceDeviceId: 'cam2', destDeviceId: 'scr2', signalType: 'video' },
      { id: 'r3', sourceDeviceId: 'cam3', destDeviceId: 'scr3', signalType: 'video' },
      { id: 'r4', sourceDeviceId: 'cam4', destDeviceId: 'scr4', signalType: 'video' },
    ]
    const results = validateRequirements(requirements, connections, typeResolver(devices))
    expect(results.find(r => r.requirementId === 'r1').status).toBe('ok')
    expect(results.find(r => r.requirementId === 'r2').status).toBe('ok')
    expect(results.find(r => r.requirementId === 'r3').status).toBe('ok')
    const r4 = results.find(r => r.requirementId === 'r4')
    expect(r4.status).toBe('conflict')
    expect(r4.conflictWith).toBeTruthy() // points to whichever prior requirement consumed the blocking port
  })
})
