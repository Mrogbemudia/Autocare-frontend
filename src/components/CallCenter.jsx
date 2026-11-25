import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api.js'

export default function CallCenter() {
  const incoming = useQuery({queryKey:['calls','incoming'],queryFn:api.calls.incoming,refetchInterval:3000})
  const [call,setCall]=useState(null)
  const [muted,setMuted]=useState(false)
  const peer=useRef(null)
  const stream=useRef(null)

  useEffect(() => {
    if (!incoming.data?.length) return
    if (!call) setCall(incoming.data[0])
  }, [incoming.data,call])

  useEffect(() => () => {
    stream.current?.getTracks().forEach((track)=>track.stop())
    peer.current?.close()
  },[])

  const cleanup=async(status='completed')=>{
    if (call) await api.calls.update(call.id,status).catch(()=>{})
    stream.current?.getTracks().forEach((track)=>track.stop())
    peer.current?.close()
    stream.current=null
    peer.current=null
    setCall(null)
  }

  const accept=async()=>{
    try {
      const media=await navigator.mediaDevices.getUserMedia({audio:true,video:false})
      stream.current=media
      const iceServers=[{urls:'stun:stun.l.google.com:19302'}]
      if (import.meta.env.VITE_TURN_URL) {
        iceServers.push({
          urls:import.meta.env.VITE_TURN_URL,
          username:import.meta.env.VITE_TURN_USERNAME,
          credential:import.meta.env.VITE_TURN_CREDENTIAL,
        })
      }
      peer.current=new RTCPeerConnection({iceServers})
      media.getTracks().forEach((track)=>peer.current.addTrack(track,media))
      await api.calls.update(call.id,'connected')
    } catch {
      await cleanup('failed')
    }
  }

  if (!call) return null
  return (
    <div role="dialog" aria-modal="true" className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-sm rounded-xl border border-line bg-card p-5 shadow-xl">
      <p className="text-xs font-bold uppercase tracking-wide text-sub">In-app call</p>
      <h2 className="mt-1 text-xl">{call.caller_name || 'Incoming call'}</h2>
      <p className="mt-1 text-sm text-ink-soft">This call does not reveal either person's phone number.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {call.status==='requested' ? (
          <>
            <button type="button" className="btn btn-primary" onClick={accept}>Accept</button>
            <button type="button" className="btn btn-secondary" onClick={()=>cleanup('declined')}>Decline</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={()=>{const next=!muted;stream.current?.getAudioTracks().forEach((track)=>{track.enabled=!next});setMuted(next)}}>{muted?'Unmute':'Mute'}</button>
            <button type="button" className="btn btn-danger" onClick={()=>cleanup('completed')}>End call</button>
          </>
        )}
      </div>
    </div>
  )
}

export function StartCallButton({ recipientId, context, className='btn btn-secondary btn-sm', children='Call privately' }) {
  const [pending,setPending]=useState(false)
  const [error,setError]=useState('')
  const start=async()=>{
    if (!recipientId) return
    setPending(true)
    setError('')
    try {
      await api.calls.create({...context,recipientId})
    } catch (err) {
      setError(err.message)
    } finally {
      setPending(false)
    }
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" className={className} disabled={pending||!recipientId} onClick={start}>
        {pending?'Starting…':children}
      </button>
      {error&&<span role="alert" className="text-xs text-alert">{error}</span>}
    </span>
  )
}
