import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.js'
import { useMe } from '../lib/auth.js'

const START_CALL_EVENT = 'kaza:start-call'
const terminal = new Set(['completed', 'missed', 'declined', 'failed'])

function iceServers() {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }]
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    })
  }
  return servers
}

export default function CallCenter() {
  const { data: user } = useMe()
  const incoming = useQuery({
    queryKey: ['calls', 'incoming'],
    queryFn: api.calls.incoming,
    enabled: Boolean(user),
    refetchInterval: 5_000,
  })
  const [call, setCall] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState('')
  const peer = useRef(null)
  const stream = useRef(null)
  const audio = useRef(null)
  const seenSignals = useRef(new Set())
  const queuedIce = useRef([])
  const dismissedCalls = useRef(new Set())
  const pollBusy = useRef(false)

  const releaseMedia = useCallback(() => {
    stream.current?.getTracks().forEach((track) => track.stop())
    peer.current?.close()
    if (audio.current) audio.current.srcObject = null
    stream.current = null
    peer.current = null
    queuedIce.current = []
  }, [])

  useEffect(() => {
    const start = (event) => {
      setError('')
      setAccepted(false)
      seenSignals.current.clear()
      queuedIce.current = []
      setCall({ ...event.detail, outgoing: true })
    }
    window.addEventListener(START_CALL_EVENT, start)
    return () => window.removeEventListener(START_CALL_EVENT, start)
  }, [])

  useEffect(() => {
    const nextCall = incoming.data?.find((item) => !dismissedCalls.current.has(item.id))
    if (!call && nextCall) {
      setError('')
      seenSignals.current.clear()
      setCall({ ...nextCall, outgoing: false })
    }
  }, [incoming.data, call])

  useEffect(() => () => releaseMedia(), [releaseMedia])

  const setupPeer = useCallback(async (currentCall, offerer) => {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      throw new Error('This browser does not support in-app audio calls.')
    }
    const localStream = await mediaDevices.getUserMedia({ audio: true, video: false })
    stream.current = localStream
    const connection = new RTCPeerConnection({ iceServers: iceServers() })
    peer.current = connection
    localStream.getTracks().forEach((track) => connection.addTrack(track, localStream))
    connection.ontrack = (event) => {
      if (audio.current) {
        audio.current.srcObject = event.streams[0]
        audio.current.play().catch(() => setError('Allow audio playback in your browser to hear the call.'))
      }
    }
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        api.calls.signal(currentCall.id, 'ice', event.candidate.toJSON())
          .catch((signalError) => setError(signalError.message))
      }
    }
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        setCall((previous) => previous ? { ...previous, status: 'connected' } : previous)
        api.calls.update(currentCall.id, 'connected').catch((statusError) => setError(statusError.message))
      } else if (['failed', 'disconnected'].includes(connection.connectionState)) {
        setError('The audio connection was interrupted. You can try ending and calling again.')
      }
    }
    if (offerer) {
      const offer = await connection.createOffer()
      await connection.setLocalDescription(offer)
      await api.calls.signal(currentCall.id, 'offer', connection.localDescription.toJSON())
      await api.calls.update(currentCall.id, 'ringing')
      setCall((previous) => previous ? { ...previous, status: 'ringing' } : previous)
    }
  }, [])

  useEffect(() => {
    if (!call?.outgoing || peer.current || terminal.has(call.status)) return
    setupPeer(call, true).then(() => setAccepted(true)).catch(async (callError) => {
      setError(callError.message)
      try {
        await api.calls.update(call.id, 'failed')
      } catch (statusError) {
        setError(`${callError.message} Call status could not be updated: ${statusError.message}`)
      }
      releaseMedia()
      setCall((previous) => previous ? { ...previous, status: 'failed' } : previous)
    })
  }, [call, releaseMedia, setupPeer])

  useEffect(() => {
    if (!call || (!call.outgoing && !accepted) || terminal.has(call.status)) return undefined
    let active = true
    const poll = async () => {
      if (pollBusy.current) return
      pollBusy.current = true
      try {
        const [latest, signals] = await Promise.all([
          api.calls.get(call.id),
          api.calls.signals(call.id),
        ])
        if (!active) return
        setCall((previous) => previous ? { ...previous, status: latest.status } : previous)
        if (terminal.has(latest.status)) {
          releaseMedia()
          return
        }
        for (const signal of signals) {
          if (seenSignals.current.has(signal.id)) continue
          const connection = peer.current
          if (!connection) break
          if (signal.kind === 'offer' && !call.outgoing) {
            await connection.setRemoteDescription(signal.payload)
            const answer = await connection.createAnswer()
            await connection.setLocalDescription(answer)
            await api.calls.signal(call.id, 'answer', connection.localDescription.toJSON())
            for (const candidate of queuedIce.current.splice(0)) await connection.addIceCandidate(candidate)
          } else if (signal.kind === 'answer' && call.outgoing && !connection.remoteDescription) {
            await connection.setRemoteDescription(signal.payload)
            for (const candidate of queuedIce.current.splice(0)) await connection.addIceCandidate(candidate)
          } else if (signal.kind === 'ice') {
            if (connection.remoteDescription) await connection.addIceCandidate(signal.payload)
            else queuedIce.current.push(signal.payload)
          } else if (signal.kind === 'hangup') {
            setCall((previous) => previous ? { ...previous, status: 'completed' } : previous)
            releaseMedia()
          }
          seenSignals.current.add(signal.id)
        }
      } catch (pollError) {
        if (active) setError(pollError.message)
      } finally {
        pollBusy.current = false
      }
    }
    void poll()
    const timer = window.setInterval(poll, 1_000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [accepted, call, releaseMedia])

  const accept = async () => {
    if (!call) return
    setError('')
    try {
      await setupPeer(call, false)
      setAccepted(true)
      await api.calls.update(call.id, 'ringing')
      setCall((previous) => previous ? { ...previous, status: 'ringing' } : previous)
    } catch (acceptError) {
      setError(acceptError.message)
      try {
        await api.calls.update(call.id, 'failed')
      } catch (statusError) {
        setError(`${acceptError.message} Call status could not be updated: ${statusError.message}`)
      }
      releaseMedia()
      setCall((previous) => previous ? { ...previous, status: 'failed' } : previous)
    }
  }

  const end = async (status) => {
    if (!call) return
    dismissedCalls.current.add(call.id)
    setError('')
    try {
      if (status === 'completed') await api.calls.signal(call.id, 'hangup', { ended: true })
      await api.calls.update(call.id, status)
      setCall((previous) => previous ? { ...previous, status } : previous)
    } catch (endError) {
      setError(endError.message)
    } finally {
      releaseMedia()
      setAccepted(false)
    }
  }

  if (!call) return null
  const isTerminal = terminal.has(call.status)
  const label = call.status === 'connected'
    ? 'Connected'
    : call.status === 'ringing'
      ? 'Ringing…'
      : call.status === 'declined'
        ? 'Call declined'
        : call.status === 'failed'
          ? 'Call failed'
          : call.status === 'missed'
            ? 'Call ended'
            : isTerminal
              ? 'Call ended'
              : call.outgoing
                ? 'Calling…'
                : 'Incoming call'

  return (
    <div role="dialog" aria-modal="true" aria-label="In-app call" className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-card p-5 shadow-xl">
      <audio ref={audio} autoPlay />
      <p className="text-xs font-bold uppercase tracking-wide text-sub">In-app call</p>
      <h2 className="mt-1 text-xl">{call.caller_name || (call.outgoing ? 'Calling privately' : 'Incoming call')}</h2>
      <p role="status" className="mt-1 text-sm text-ink-soft">{label}</p>
      <p className="mt-1 text-sm text-ink-soft">This call does not reveal either person's phone number.</p>
      {error && <p role="alert" className="mt-2 text-sm text-alert">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        {!call.outgoing && !accepted && !isTerminal ? (
          <>
            <button type="button" className="btn btn-primary" onClick={accept}>Accept</button>
            <button type="button" className="btn btn-secondary" onClick={() => end('declined')}>Decline</button>
          </>
        ) : isTerminal ? (
          <button type="button" className="btn btn-secondary" onClick={() => {
            dismissedCalls.current.add(call.id)
            setCall(null)
          }}>Close</button>
        ) : (
          <>
            {accepted && (
              <button type="button" className="btn btn-secondary" onClick={() => {
                const next = !muted
                stream.current?.getAudioTracks().forEach((track) => { track.enabled = !next })
                setMuted(next)
              }}>{muted ? 'Unmute' : 'Mute'}</button>
            )}
            <button type="button" className="btn btn-danger" onClick={() => end('completed')}>Hang up</button>
          </>
        )}
      </div>
    </div>
  )
}

export function StartCallButton({ recipientId, context, className = 'btn btn-secondary btn-sm', children = 'Call privately' }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const start = async () => {
    if (!recipientId) return
    setPending(true)
    setError('')
    try {
      const call = await api.calls.create({ ...context, recipientId })
      window.dispatchEvent(new CustomEvent(START_CALL_EVENT, { detail: call }))
    } catch (callError) {
      setError(callError.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button type="button" className={className} disabled={pending || !recipientId} onClick={start}>
        {pending ? 'Starting…' : children}
      </button>
      {error && <span role="alert" className="text-xs text-alert">{error}</span>}
    </span>
  )
}
