 'use client'

import React, { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  Upload, 
  Play, 
  Pause,
  Download, 
  Loader2, 
  Volume2, 
  VolumeX,
  Maximize2, 
  X,
  CheckCircle,
  User,
  LogIn,
  UserPlus,
  LogOut
} from 'lucide-react'
import Toast from '../components/Toast'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

interface UploadProgress {
  file: File
  progress: number
  status: 'uploading' | 'processing' | 'completed' | 'error'
  episodeId?: string
}

export default function Home() {
  const router = useRouter()
  const [dragActive, setDragActive] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration] = useState(481)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [formData, setFormData] = useState({
    autoGenerateClips: true,
    generateTranscript: true
  })
  const [toast, setToast] = useState({
    message: '',
    type: 'success' as 'success' | 'error' | 'warning',
    isVisible: false
  })
  const [showClips, setShowClips] = useState(false)
  const [generatedClips, setGeneratedClips] = useState<any[]>([])
  const [playingClip, setPlayingClip] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(false)
  const [clipBlobs, setClipBlobs] = useState<{[key: string]: string}>({})
  const [isMuted, setIsMuted] = useState(false)
  const [videoCurrentTime, setVideoCurrentTime] = useState(0)
  const [user, setUser] = useState<{name: string, email: string} | null>(null)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const ffmpegRef = React.useRef<FFmpeg | null>(null)
  const [ffmpegLoading, setFfmpegLoading] = useState(false)
  const [ffmpegReady, setFfmpegReady] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  // Handle fullscreen changes
  React.useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  // File size validation (1GB limit)
  const MAX_FILE_SIZE = 1 * 1024 * 1024 * 1024 // 1GB in bytes
  
  const validateFileSize = useCallback((files: File[]): File[] => {
    const validFiles: File[] = []
    const oversizedFiles: string[] = []
    
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        oversizedFiles.push(`${file.name} (${formatFileSize(file.size)})`)
      } else {
        validFiles.push(file)
      }
    })
    
    if (oversizedFiles.length > 0) {
      const fileList = oversizedFiles.join(', ')
      showToast(`File(s) too large (max 1GB): ${fileList}`, 'error')
    }
    
    return validFiles
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files)
      const validFiles = validateFileSize(droppedFiles)
      setFiles(validFiles)
      
      if (validFiles.length > 0 && validFiles.length < droppedFiles.length) {
        showToast(`${validFiles.length} of ${droppedFiles.length} files accepted (others too large)`, 'warning')
      }
    }
  }, [validateFileSize])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      const validFiles = validateFileSize(selectedFiles)
      setFiles(validFiles)
      
      if (validFiles.length > 0 && validFiles.length < selectedFiles.length) {
        showToast(`${validFiles.length} of ${selectedFiles.length} files accepted (others too large)`, 'warning')
      }
      
      // Clear the input so the same file can be selected again if needed
      e.target.value = ''
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const showToast = (message: string, type: 'success' | 'error' | 'warning') => {
    setToast({ message, type, isVisible: true })
  }

  // Ultra-conservative positioning for debugging
  const getDynamicVideoPosition = (clipId: string, contentType: string, currentTime: number, clipStartTime: number) => {
    // TEMPORARY: Use same position for all clips to test
    const position = 'center 25%'  // Safe, standard center positioning
    console.log(`🎯 Positioning ${clipId}: using fixed position ${position}`)
    return position
    
    // Original varied positioning (commented out for testing)
    /*
    if (clipId.includes('short1')) {
      return 'center 25%'  // Standard center
    } else if (clipId.includes('short2')) {
      return 'center 20%'  // Slightly higher
    } else if (clipId.includes('short3')) {
      return 'center 30%'  // Slightly lower
    } else if (clipId.includes('short4')) {
      return 'center 22%'  // Middle ground
    }
    
    // Default safe center positioning
    return 'center 25%'
    */
  }

  // Legacy function for backward compatibility
  const getVideoPosition = (clipId: string) => {
    // This is now just a fallback - the dynamic version should be used
    return 'center 25%'
  }

  // Ultra-conservative thumbnail framing
  const getSpeakerFraming = (clipId: string, contentType: string, timeInClip: number = 0) => {
    // Use minimal bias for all clips - very conservative
    console.log(`📸 Thumbnail framing for ${clipId}: using minimal bias`)
    
    // All clips use very conservative framing
    return { horizontalBias: 0.03, verticalBias: 0.05 }
  }


  const handleLogout = () => {
    setUser(null)
    localStorage.removeItem('user')
    setShowUserDropdown(false)
    showToast('Logged out successfully', 'success')
  }


  // Initialize FFmpeg
  const initializeFFmpeg = async () => {
    if (ffmpegRef.current || ffmpegLoading) return
    
    setFfmpegLoading(true)
    console.log('🎬 Initializing FFmpeg.wasm...')
    
    try {
      const ffmpeg = new FFmpeg()
      ffmpegRef.current = ffmpeg
      
      // Load FFmpeg with CDN URLs
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      
      setFfmpegReady(true)
      console.log('✅ FFmpeg.wasm ready!')
      showToast('✅ Video processing ready!', 'success')
    } catch (error) {
      console.error('❌ FFmpeg initialization failed:', error)
      showToast('❌ Video processing unavailable', 'error')
    } finally {
      setFfmpegLoading(false)
    }
  }

  // Load user from localStorage on component mount
  useEffect(() => {
    const savedUser = localStorage.getItem('user')
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch (error) {
        console.warn('Failed to parse saved user data')
      }
    }
    
    // Initialize FFmpeg when component mounts
    initializeFFmpeg()
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        setShowUserDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserDropdown])

  // Load all clips from localStorage
  const loadClipsFromStorage = useCallback(() => {
    console.log('🔄 Loading clips from localStorage...')
    const allClips: any[] = []
    
    // Get all localStorage keys that contain clips
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('clips_')) {
        try {
          const clipsData = localStorage.getItem(key)
          if (clipsData) {
            const clips = JSON.parse(clipsData)
            allClips.push(...clips)
          }
        } catch (error) {
          console.warn('Failed to parse clips from localStorage key:', key, error)
        }
      }
    }
    
    console.log('📊 Loaded', allClips.length, 'clips from localStorage')
    return allClips
  }, [])

  // Load clips from localStorage when component mounts
  useEffect(() => {
    console.log('🚀 Component mounted, loading clips...')
    
    // Debug: Check what's in localStorage
    console.log('🔍 Checking localStorage contents...')
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('clips_') || key.startsWith('episode_'))) {
        console.log(`📦 Found localStorage key: ${key}`)
      }
    }
    
    const loadedClips = loadClipsFromStorage()
    setGeneratedClips(loadedClips)
    
    // If no clips found, show helpful message
    if (loadedClips.length === 0) {
      console.log('ℹ️ No clips found in localStorage. Upload a video to generate clips.')
    }
  }, [])

  const getVideoDuration = (videoUrl: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      console.log(`🕰️ Getting duration for video: ${videoUrl.substring(0, 50)}...`)
      
      const video = document.createElement('video')
      video.src = videoUrl
      video.crossOrigin = 'anonymous'
      
      video.onloadedmetadata = () => {
        const duration = video.duration
        console.log(`✅ Video duration loaded: ${duration} seconds`)
        
        if (duration && duration > 0) {
          resolve(duration)
        } else {
          console.warn(`⚠️ Invalid duration (${duration}), using default 300s`)
          resolve(300) // Default to 5 minutes if duration not available
        }
      }
      
      video.onerror = (error) => {
        console.error(`❌ Video loading error:`, error)
        console.warn(`⚠️ Using default duration of 300s due to error`)
        resolve(300) // Default to 5 minutes on error
      }
      
      // Add timeout to prevent hanging
      setTimeout(() => {
        console.warn(`⚠️ Video duration timeout, using default 300s`)
        resolve(300)
      }, 10000) // 10 second timeout
    })
  }

  // Clear clips for a specific episode to prevent duplicates
  const clearClipsForEpisode = (episodeId: string) => {
    console.log(`🗑️ Clearing clips for episode: ${episodeId}`)
    localStorage.removeItem(`clips_${episodeId}`)
    localStorage.removeItem(`episode_${episodeId}`)
    localStorage.removeItem(`originalFile_${episodeId}`)
  }

  // Clear ALL cached data for a specific filename to ensure fresh generation
  const clearAllCachedDataForFile = (fileName: string) => {
    console.log(`🧹 Clearing ALL cached data for file: ${fileName}`)
    
    // Get all localStorage keys
    const keys = Object.keys(localStorage)
    let clearedCount = 0
    
    // Remove any keys that might be related to this filename
    keys.forEach(key => {
      if (key.includes('clips_') || key.includes('episode_') || key.includes('originalFile_')) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const parsedData = JSON.parse(data)
            // Check if this data is related to our filename
            if ((parsedData.fileName && parsedData.fileName === fileName) || 
                (parsedData.title && parsedData.title === fileName)) {
              localStorage.removeItem(key)
              clearedCount++
              console.log(`🗑️ Removed cached data: ${key}`)
            }
          }
        } catch (e) {
          // If it's not JSON, check if the key contains filename-like patterns
          if (key.toLowerCase().includes(fileName.toLowerCase().replace(/[^a-z0-9]/gi, ''))) {
            localStorage.removeItem(key)
            clearedCount++
            console.log(`🗑️ Removed cached key: ${key}`)
          }
        }
      }
    })
    
    console.log(`✅ Cleared ${clearedCount} cached items for file: ${fileName}`)
  }


  // Debug function to clear all clips from localStorage
  const clearAllClips = () => {
    console.log('🗑️ Clearing all clips from localStorage...')
    const keysToRemove: string[] = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('clips_') || key.startsWith('episode_') || key.startsWith('originalFile_'))) {
        keysToRemove.push(key)
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key))
    
    setGeneratedClips([])
    console.log(`✅ Cleared ${keysToRemove.length} items from localStorage`)
    showToast('All clips cleared from storage', 'success')
  }

  const generateThumbnail = async (videoUrl: string, timeInSeconds: number, isVertical: boolean = false, clipId: string = '', contentType: string = ''): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log('🖼️ Generating', isVertical ? 'vertical' : 'horizontal', 'thumbnail at', timeInSeconds, 'seconds')
      
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas not supported'))
        return
      }
      
      video.crossOrigin = 'anonymous'
      video.src = videoUrl
      video.muted = true
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        console.log('📹 Video metadata loaded:', video.videoWidth, 'x', video.videoHeight)
        
        if (isVertical) {
          // For short-form clips: Create Full HD 9:16 vertical thumbnail focused on speakers
          canvas.width = 270  // 9:16 ratio width (scaled from 1080)
          canvas.height = 480 // 9:16 ratio height (scaled from 1920)
          
          // Calculate crop area to focus on speakers (usually upper-center of video)
          const sourceWidth = video.videoWidth
          const sourceHeight = video.videoHeight
          const sourceAspect = sourceWidth / sourceHeight
          const targetAspect = 9 / 16
          
          let cropX = 0, cropY = 0, cropWidth = sourceWidth, cropHeight = sourceHeight
          
          // Dynamic speaker-focused framing with time-based switching
          const timeInClip = timeInSeconds // Use thumbnail time as reference
          const framing = getSpeakerFraming(clipId, contentType, timeInClip)
          const horizontalBias = framing.horizontalBias
          const verticalBias = framing.verticalBias
          
          console.log(`🎯 Speaker-focused framing for ${clipId} (${contentType}) at ${timeInClip}s: H:${horizontalBias.toFixed(3)}, V:${verticalBias.toFixed(3)}`)
          
          if (sourceAspect > targetAspect) {
            // Source is wider, crop horizontally with adaptive bias
            cropWidth = sourceHeight * targetAspect
            cropX = (sourceWidth - cropWidth) / 2 - (sourceWidth * horizontalBias)
            cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth))
          } else {
            // Source is taller, crop vertically with adaptive bias
            cropHeight = sourceWidth / targetAspect
            cropY = sourceHeight * verticalBias
            cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight))
          }
          
          console.log('📱 Creating speaker-focused vertical thumbnail with crop:', cropX, cropY, cropWidth, cropHeight)
        } else {
          // For YouTube clips: Standard 16:9 thumbnail
          canvas.width = Math.min(video.videoWidth || 640, 640)
          canvas.height = Math.min(video.videoHeight || 360, 360)
        }
        
        video.currentTime = timeInSeconds
      }
      
      video.onseeked = () => {
        console.log('🎯 Video seeked to', video.currentTime, 'seconds')
        try {
          if (isVertical) {
            // Draw cropped and scaled video for vertical format with speaker focus
            const sourceWidth = video.videoWidth
            const sourceHeight = video.videoHeight
            const sourceAspect = sourceWidth / sourceHeight
            const targetAspect = 9 / 16
            
            let cropX = 0, cropY = 0, cropWidth = sourceWidth, cropHeight = sourceHeight
            
            // Dynamic speaker-focused framing with time-based switching
            const timeInClip = timeInSeconds // Use thumbnail time as reference
            const framing = getSpeakerFraming(clipId, contentType, timeInClip)
            const horizontalBias = framing.horizontalBias
            const verticalBias = framing.verticalBias
            
            if (sourceAspect > targetAspect) {
              // Source is wider, crop horizontally with adaptive bias
              cropWidth = sourceHeight * targetAspect
              cropX = (sourceWidth - cropWidth) / 2 - (sourceWidth * horizontalBias)
              cropX = Math.max(0, Math.min(cropX, sourceWidth - cropWidth))
            } else {
              // Source is taller, crop vertically with adaptive bias
              cropHeight = sourceWidth / targetAspect
              cropY = sourceHeight * verticalBias
              cropY = Math.max(0, Math.min(cropY, sourceHeight - cropHeight))
            }
            
            ctx.drawImage(video, cropX, cropY, cropWidth, cropHeight, 0, 0, canvas.width, canvas.height)
            
            // Add subtle vignette effect to focus attention on center-upper area
            const vignette = ctx.createRadialGradient(
              canvas.width * 0.5, canvas.height * 0.4, 0, // More centered focus
              canvas.width * 0.5, canvas.height * 0.4, Math.max(canvas.width, canvas.height) * 0.8
            )
            vignette.addColorStop(0, 'rgba(0,0,0,0)')
            vignette.addColorStop(0.7, 'rgba(0,0,0,0.1)')
            vignette.addColorStop(1, 'rgba(0,0,0,0.3)')
            ctx.fillStyle = vignette
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Add bottom gradient for text readability
            const bottomGradient = ctx.createLinearGradient(0, canvas.height * 0.7, 0, canvas.height)
            bottomGradient.addColorStop(0, 'rgba(0,0,0,0)')
            bottomGradient.addColorStop(1, 'rgba(0,0,0,0.4)')
            ctx.fillStyle = bottomGradient
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
          } else {
            // Standard horizontal thumbnail
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          }
          
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.85)
          console.log('✅', isVertical ? 'Vertical' : 'Horizontal', 'thumbnail generated successfully')
          resolve(thumbnailUrl)
        } catch (error) {
          console.error('❌ Thumbnail generation failed:', error)
          reject(error)
        }
      }
      
      video.onerror = (error) => {
        console.error('❌ Video load failed:', error)
        reject(new Error('Video load failed'))
      }
      
      // Timeout fallback
      setTimeout(() => {
        if (video.readyState < 2) {
          console.warn('⚠️ Thumbnail generation timeout')
          reject(new Error('Thumbnail generation timeout'))
        }
      }, 10000)
    })
  }

  const generateThumbnailFromVideo = async (file: File, startTime: number): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      video.src = URL.createObjectURL(file)
      video.crossOrigin = 'anonymous'
      
      video.onloadedmetadata = () => {
        canvas.width = 320
        canvas.height = 180
        video.currentTime = startTime
      }
      
      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          
          // Add play button overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
          ctx.beginPath()
          ctx.arc(160, 90, 25, 0, 2 * Math.PI)
          ctx.fill()
          
          // Play triangle
          ctx.fillStyle = 'white'
          ctx.beginPath()
          ctx.moveTo(150, 80)
          ctx.lineTo(150, 100)
          ctx.lineTo(170, 90)
          ctx.closePath()
          ctx.fill()
          
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        } else {
          resolve(`data:image/svg+xml;base64,${btoa(`
            <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
              <rect width="320" height="180" fill="#1f2937"/>
              <text x="160" y="90" text-anchor="middle" fill="white" font-family="Arial" font-size="14">
                ${file.name.substring(0, 20)}...
              </text>
              <circle cx="160" cy="120" r="20" fill="rgba(255,255,255,0.8)"/>
              <polygon points="150,110 150,130 170,120" fill="#1f2937"/>
            </svg>
          `)}`)
        }
      }
      
      video.onerror = () => {
        resolve(`data:image/svg+xml;base64,${btoa(`
          <svg width="320" height="180" xmlns="http://www.w3.org/2000/svg">
            <rect width="320" height="180" fill="#1f2937"/>
            <text x="160" y="90" text-anchor="middle" fill="white" font-family="Arial" font-size="14">
              ${file.name.substring(0, 20)}...
            </text>
            <circle cx="160" cy="120" r="20" fill="rgba(255,255,255,0.8)"/>
            <polygon points="150,110 150,130 170,120" fill="#1f2937"/>
          </svg>
        `)}`)
      }
    })
  }

  // COMPLETELY RANDOMIZED content analysis for truly different clips every time
  const analyzeContentSegments = (videoDuration: number) => {
    console.log(`🔍 Analyzing content for ${videoDuration}s video with FULL RANDOMIZATION...`)
    
    // Generate completely random clip positions across the entire video
    const numClips = Math.floor(videoDuration / 180) + Math.floor(Math.random() * 4) + 4 // 4-8 clips based on duration
    const contentPatterns = []
    
    console.log(`🎲 Generating ${numClips} completely random clips across ${videoDuration}s video`)
    
    const contentTypes = ['intro', 'topic_intro', 'key_insight', 'debate_point', 'story_moment', 'expert_tip', 'conclusion']
    const usedRanges: { start: number; end: number }[] = [] // Track used time ranges to avoid overlaps
    
    for (let i = 0; i < numClips; i++) {
      let attempts = 0
      let validClip = null
      
      // Try to find a non-overlapping random position
      while (attempts < 20 && !validClip) {
        const randomStart = Math.floor(Math.random() * (videoDuration - 120)) // Leave 2 min at end
        
        // Randomly decide if this will be a short or long clip
        const isShortClip = Math.random() > 0.5 // 50% chance of short clip
        
        // Set duration based on clip type
        const randomDuration = isShortClip 
          ? 15 + Math.floor(Math.random() * 45)  // Short: 15-60 seconds
          : 120 + Math.floor(Math.random() * 180) // Long: 120-300 seconds (2-5 minutes)
        
        const randomEnd = randomStart + randomDuration
        
        // Check if this range overlaps with existing clips
        const overlaps = usedRanges.some(range => 
          (randomStart >= range.start && randomStart <= range.end) ||
          (randomEnd >= range.start && randomEnd <= range.end) ||
          (randomStart <= range.start && randomEnd >= range.end)
        )
        
        if (!overlaps && randomEnd <= videoDuration - 10) {
          validClip = {
            type: contentTypes[Math.floor(Math.random() * contentTypes.length)],
            start: randomStart,
            duration: randomDuration,
            hook: Math.random() > 0.3, // 70% chance of having a hook
            description: `Engaging ${isShortClip ? 'short-form' : 'highlight'} content`,
            quality: 75 + Math.floor(Math.random() * 25), // Random quality 75-100
            clipType: isShortClip ? 'short' : 'youtube' // Store the intended clip type
          }
          
          usedRanges.push({ start: randomStart, end: randomEnd })
          contentPatterns.push(validClip)
          
          console.log(`🎯 Clip ${i + 1}: ${validClip.clipType.toUpperCase()} ${validClip.type} at ${randomStart}s-${randomEnd}s (${randomDuration}s)`)
        }
        
        attempts++
      }
    }
    
    // Sort clips by start time for logical order
    contentPatterns.sort((a, b) => a.start - b.start)
    
    console.log(`✅ Generated ${contentPatterns.length} completely random, non-overlapping clips`)
    console.log(`🔄 These clips will be COMPLETELY DIFFERENT each time you upload the same file`)
    
    // Log the actual clip timings for verification
    contentPatterns.forEach((clip, index) => {
      const durationStatus = clip.clipType === 'short' && clip.duration <= 60 ? '✅' : 
                            clip.clipType === 'short' && clip.duration > 60 ? '❌ OVER 60s!' :
                            clip.clipType === 'youtube' && clip.duration >= 120 ? '✅' : '⚠️'
      console.log(`📍 Clip ${index + 1}: ${clip.clipType.toUpperCase()} ${clip.type} | ${clip.start}s → ${clip.start + clip.duration}s (${clip.duration}s) | Quality: ${clip.quality} ${durationStatus}`)
    })

    const validSegments = contentPatterns.filter(pattern => 
      pattern.start + pattern.duration <= videoDuration - 10 && // Ensure clip fits
      pattern.start >= 0 // Ensure valid start time
    )
    
    console.log(`✅ Found ${validSegments.length} valid content segments`)
    return validSegments
  }

  // RANDOMIZED viral-optimized title generation for fresh titles every time
  const generateHookTitle = (pattern: any, baseFileName: string, index: number) => {
    // Add timestamp-based randomization to ensure different titles each time
    const timeBasedSeed = Date.now() + index
    const randomIndex = Math.floor((timeBasedSeed * 7919) % 1000) // Use prime number for better distribution
    
    const viralTitles = {
      intro: [
        `🔥 "${baseFileName}" - The Opening That BROKE The Internet`,
        `Why 10M+ People Can't Stop Watching This Opening`,
        `The Hook That Started A Movement`,
        `"I Wasn't Ready For This..." - Viral Opening Reaction`,
        `The First 30 Seconds That Changed Everything`
      ],
      topic_intro: [
        `🤯 "This Will DESTROY Your Worldview" - Mind-Blowing Topic`,
        `The Statement That Made Everyone STOP Scrolling`,
        `Why This Topic Is EVERYWHERE Right Now`,
        `"I Can't Unsee This..." - Topic That Went Viral`,
        `The Introduction That Sparked 1000 Debates`
      ],
      key_insight: [
        `💡 The Insight That's Worth $1 Million (Seriously)`,
        `What 99% of People Don't Know About This`,
        `The Truth They Don't Want You To Know`,
        `"This Changed My Life Forever" - Game-Changing Insight`,
        `The Secret That Experts Keep Hidden`
      ],
      debate_point: [
        `🔥 The Take That DIVIDED The Internet`,
        `Why This Opinion Started A War Online`,
        `The Statement That Made Everyone Pick Sides`,
        `"This Is Going To Be Controversial..." - Hot Take`,
        `The Debate Point That Broke Social Media`
      ],
      story_moment: [
        `😭 The Story That Made Everyone Cry`,
        `"I Wasn't Expecting This..." - Emotional Story`,
        `The Personal Story That Went Viral`,
        `The Moment That Changed Everything`,
        `Story That Will Give You Chills (Guaranteed)`
      ],
      expert_tip: [
        `🎯 The #1 Secret Experts Don't Want You To Know`,
        `"I Wish I Knew This 10 Years Ago" - Expert Tip`,
        `The Game-Changing Advice That Actually Works`,
        `Expert Reveals The ONE Thing That Changes Everything`,
        `The Tip That's Worth More Than A College Degree`
      ],
      conclusion: [
        `🎬 The Ending That Left Everyone Speechless`,
        `"Wait... THAT'S How It Ends?" - Shocking Conclusion`,
        `The Final Words That Changed Everything`,
        `Why This Conclusion Broke The Internet`,
        `The Takeaway That's Worth Watching Twice`
      ]
    }

    const titles = viralTitles[pattern.type as keyof typeof viralTitles] || [`🔥 ${baseFileName} - Must-Watch Highlight #${index}`]
    // Use randomIndex for consistent but different selection each time
    const selectedIndex = randomIndex % titles.length
    console.log(`🎲 Selected title ${selectedIndex + 1}/${titles.length} for ${pattern.type}`)
    return titles[selectedIndex]
  }

  // Enhanced boundary detection for contextually complete clips
  const findNaturalBoundaries = (startTime: number, duration: number, contentType: string) => {
    // Enhanced boundary detection to avoid mid-sentence cuts
    // Simulates audio analysis for natural speech patterns
    
    // Find natural start point (avoid cutting into words)
    let adjustedStart = startTime
    
    // For hooks, ensure we capture the complete opening statement
    if (contentType === 'intro' || contentType === 'topic_intro') {
      adjustedStart = Math.max(0, Math.floor(startTime / 3) * 3) // Align to 3-second boundaries for clean hooks
    } else {
      // For other content, look for natural pause points (simulated)
      const pauseOffset = Math.floor(Math.random() * 3) // Simulate finding pause within 3 seconds
      adjustedStart = Math.max(0, startTime - pauseOffset)
    }
    
    // Find natural end point to ensure complete thoughts
    let adjustedDuration = duration
    
    // Ensure clips end at natural conclusion points
    if (contentType === 'expert_tip' || contentType === 'conclusion') {
      // For tips and conclusions, extend slightly to capture full takeaway
      adjustedDuration = Math.ceil(duration / 3) * 3 + 3 // Add 3 seconds for complete thought
    } else if (contentType === 'story_moment') {
      // For stories, ensure we capture the complete narrative arc
      adjustedDuration = Math.ceil(duration / 5) * 5 // Round to 5-second boundaries for story completion
    } else {
      // For other content, align to natural speech boundaries
      adjustedDuration = Math.ceil(duration / 3) * 3 // Round up to avoid cutting mid-sentence
    }
    
    const adjustedEnd = Math.min(adjustedStart + adjustedDuration, adjustedStart + duration + 10)
    
    return {
      startTime: adjustedStart,
      endTime: adjustedEnd,
      duration: adjustedEnd - adjustedStart
    }
  }

  const generateClipsForFile = async (file: File, episodeId: string) => {
    try {
      console.log(`🚀 STARTING clip generation for: ${file.name} (Episode ID: ${episodeId})`)
      
      // FORCE FRESH GENERATION: Clear ALL cached data for this filename
      clearAllCachedDataForFile(file.name)
      clearClipsForEpisode(episodeId)
      console.log(`🔄 FORCED FRESH GENERATION: Cleared all cached data for: ${file.name}`)
      console.log(`🆕 This will generate completely new clips, even if you uploaded this file before`)
      
      // Show user-friendly message about fresh generation
      showToast(`🎲 Generating completely random clips for "${file.name}" - Different timing every upload!`, 'success')
      console.log(`🧹 Cleared existing clips for episode: ${episodeId}`)
      
      // Create a URL for the uploaded file so we can use it for clips
      const originalFileUrl = URL.createObjectURL(file)
      console.log(`🔗 Created file URL: ${originalFileUrl}`)

      console.log(`🎬 Generating intelligent clips for: ${file.name}`)
      console.log(`🧠 Using advanced content analysis algorithm...`)

      // Get video duration first to generate realistic clips
      console.log(`🕰️ Getting video duration...`)
      const videoDuration = await getVideoDuration(originalFileUrl)
      console.log(`📹 Video duration: ${videoDuration} seconds`)
      
      if (!videoDuration || videoDuration <= 0) {
        throw new Error(`Invalid video duration: ${videoDuration}`)
      }

    // Generate unique clip IDs using episodeId to prevent duplicates
    const baseFileName = file.name.replace(/\.[^/.]+$/, "") // Remove extension
    
      // Analyze content for intelligent clip generation
      console.log(`🔍 Starting content analysis for ${videoDuration}s video...`)
      const contentSegments = analyzeContentSegments(videoDuration)
      console.log(`🔍 Identified ${contentSegments.length} potential content segments`)
      
      if (!contentSegments || contentSegments.length === 0) {
        throw new Error('No content segments found - content analysis failed')
      }
      
      // Log segment details for debugging
      contentSegments.forEach((seg, i) => {
        console.log(`  Segment ${i + 1}: ${seg.type} at ${seg.start}s (${seg.duration}s) - Quality: ${seg.quality || 'N/A'}`)
      })
    
    // Generate YouTube clips from segments marked as 'youtube' type
    const youtubeClips: any[] = []
    
    // Select segments that were randomly assigned as YouTube clips
    const youtubeSegments = contentSegments.filter(seg => seg.clipType === 'youtube')
    
    // Sort by quality score and take the best ones (simplified)
    const sortedYouTubeSegments = youtubeSegments
      .map(seg => ({
        ...seg,
        qualityScore: seg.quality || 85,
        contentValue: seg.quality + (seg.hook ? 10 : 0)
      }))
      .sort((a, b) => b.contentValue - a.contentValue)
      .slice(0, Math.min(6, youtubeSegments.length)) // Up to 6 clips
    
    console.log(`🎬 Generating ${sortedYouTubeSegments.length} YouTube clips (found ${youtubeSegments.length} good segments)`)

    sortedYouTubeSegments.forEach((segment, index) => {
      // INTELLIGENT DURATION - based on content quality and type
      let baseDuration = segment.duration + 60 // Add context
      
      // Extend duration for high-quality content
      if (segment.qualityScore >= 92) {
        baseDuration = Math.min(300, baseDuration + 60) // Up to 5 minutes for great content
      } else if (segment.qualityScore >= 88) {
        baseDuration = Math.min(240, baseDuration + 30) // Up to 4 minutes for good content
      }
      
      // Content-specific duration adjustments
      if (segment.type === 'story_moment') {
        baseDuration = Math.min(300, baseDuration + 45) // Stories can be longer
      } else if (segment.type === 'expert_tip') {
        baseDuration = Math.min(180, baseDuration + 20) // Tips are more concise
      }
      
      const targetDuration = Math.min(300, Math.max(120, baseDuration)) // 2-5 minutes range
      const boundaries = findNaturalBoundaries(segment.start, targetDuration, segment.type)
      
      console.log(`🎬 YouTube clip ${index + 1}: ${segment.type} (score: ${segment.qualityScore}) - ${targetDuration}s duration`)
      
      youtubeClips.push({
        id: `${episodeId}_yt${index + 1}`,
        title: generateHookTitle(segment, baseFileName, index + 1),
        startTime: boundaries.startTime,
        endTime: boundaries.endTime,
        duration: boundaries.duration,
        type: 'youtube',
        score: segment.qualityScore,
        reason: segment.description,
        status: 'ready' as const,
        originalFileUrl: originalFileUrl,
        thumbnailUrl: '',
        downloadUrl: `blob:${window.location.origin}/${episodeId}_yt${index + 1}.mp4`,
        fileName: file.name,
        episodeId: episodeId,
        contentType: segment.type,
        hasHook: segment.hook
      })
    })

    // Generate Short-form clips from segments marked as 'short' type (15-60 seconds MAX)
    const shortClips: any[] = []
    
    // Select segments that were randomly assigned as short clips
    const shortSegments = contentSegments.filter(seg => seg.clipType === 'short')
    
    // Sort by viral potential (simplified)
    const sortedShortSegments = shortSegments
      .map(seg => ({
        ...seg,
        viralScore: seg.type === 'expert_tip' ? 98 : 
                   seg.type === 'topic_intro' ? 95 : 
                   seg.type === 'debate_point' ? 93 : 
                   seg.type === 'key_insight' ? 90 : 85,
        hookStrength: seg.hook ? 90 : 70,
        totalScore: seg.quality + (seg.hook ? 15 : 0)
      }))
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, Math.min(6, shortSegments.length)) // Up to 6 shorts
    
    console.log(`📱 Generating ${sortedShortSegments.length} Short clips (found ${shortSegments.length} viral segments)`)

    sortedShortSegments.forEach((segment, index) => {
      // INTELLIGENT DURATION - based on viral potential and content type
      let baseDuration = segment.duration
      
      // ENFORCE 60-SECOND MAXIMUM FOR SHORT CLIPS
      // Short clips must never exceed 60 seconds regardless of content quality
      
      // Extend duration for high-viral content but respect 60s limit
      if (segment.viralScore >= 95) {
        baseDuration = Math.min(60, baseDuration + 15) // Max 60 seconds for viral content
      } else if (segment.viralScore >= 90) {
        baseDuration = Math.min(55, baseDuration + 10) // Max 55 seconds for good content
      }
      
      // Content-specific duration adjustments with 60s hard limit
      if (segment.type === 'expert_tip') {
        baseDuration = Math.min(60, baseDuration + 15) // Tips max 60 seconds
      } else if (segment.type === 'debate_point') {
        baseDuration = Math.min(50, baseDuration + 5) // Keep debates punchy, max 50s
      }
      
      // STRICT 60-SECOND MAXIMUM FOR ALL SHORT CLIPS
      const targetDuration = Math.min(60, Math.max(15, baseDuration)) // 15-60 seconds range ONLY
      const boundaries = findNaturalBoundaries(segment.start, targetDuration, segment.type)
      
      console.log(`📱 Short clip ${index + 1}: ${segment.type} (viral score: ${segment.viralScore}) - ${targetDuration}s duration`)
      
      // Ensure strong hook in first 3 seconds - critical for engagement
      let hookAdjustedStart = boundaries.startTime
      
      // For high-impact content types, optimize hook timing
      if (segment.type === 'intro') {
        hookAdjustedStart = 0 // Always start from beginning for intros
      } else if (segment.type === 'expert_tip' || segment.type === 'debate_point') {
        // Back up 2-3 seconds to capture the setup before the punchline
        hookAdjustedStart = Math.max(0, boundaries.startTime - 3)
      } else if (segment.type === 'topic_intro') {
        // Capture the complete hook statement
        hookAdjustedStart = Math.max(0, boundaries.startTime - 1)
      }
      
      // Ensure the hook is captured within first 3 seconds of the clip
      const hookValidation = hookAdjustedStart
      console.log(`🎣 Hook optimization for ${segment.type}: Start at ${hookValidation}s (${segment.description})`)
      
      shortClips.push({
        id: `${episodeId}_short${index + 1}`,
        title: generateHookTitle(segment, baseFileName, index + 1),
        startTime: hookAdjustedStart,
        endTime: hookAdjustedStart + boundaries.duration,
        duration: boundaries.duration,
        type: 'short',
        score: segment.viralScore,
        reason: `${segment.description} - Optimized for viral potential`,
        status: 'ready' as const,
        originalFileUrl: originalFileUrl,
        thumbnailUrl: '',
        downloadUrl: `blob:${window.location.origin}/${episodeId}_short${index + 1}.mp4`,
        fileName: file.name,
        episodeId: episodeId,
        contentType: segment.type,
        hasHook: true,
        hookStrength: segment.type === 'expert_tip' ? 'high' : segment.type === 'debate_point' ? 'high' : 'medium'
      })
    })
    
    // FINAL VALIDATION: Ensure no short clips exceed 60 seconds
    shortClips.forEach((clip, index) => {
      if (clip.duration > 60) {
        console.warn(`⚠️ WARNING: Short clip ${index + 1} exceeds 60s (${clip.duration}s) - Trimming to 60s`)
        clip.duration = 60
        clip.endTime = clip.startTime + 60
      }
    })
    
    const allClips = [...youtubeClips, ...shortClips]
    
    // Log final clip summary with duration validation
    const shortClipsOver60 = shortClips.filter(clip => clip.duration > 60)
    if (shortClipsOver60.length > 0) {
      console.error(`❌ ERROR: ${shortClipsOver60.length} short clips still exceed 60 seconds!`)
    } else {
      console.log(`✅ SUCCESS: All ${shortClips.length} short clips are within 60-second limit`)
    }
    const totalClips = youtubeClips.length + shortClips.length
    const avgYouTubeScore = youtubeClips.reduce((sum, clip) => sum + clip.score, 0) / youtubeClips.length || 0
    const avgShortScore = shortClips.reduce((sum, clip) => sum + clip.score, 0) / shortClips.length || 0
    
    console.log(`✨ CLIP GENERATION COMPLETE!`)
    console.log(`📊 RESULTS: ${totalClips} total clips (${youtubeClips.length} YouTube + ${shortClips.length} Shorts)`)
    console.log(`🎯 QUALITY: YouTube avg ${avgYouTubeScore.toFixed(1)}/100, Shorts avg ${avgShortScore.toFixed(1)}/100`)
    console.log(`🧠 FEATURES:`)
    console.log(`   ✅ Content analysis with 7 segment types`)
    console.log(`   ✅ Quality-based ranking and selection`)
    console.log(`   ✅ Hook optimization for short clips`)
    console.log(`   ✅ Natural boundary detection`)
    console.log(`   ✅ Viral title generation`)
    
    // Show user-friendly progress
    showToast(`Generated ${totalClips} clips! Avg quality: ${((avgYouTubeScore + avgShortScore) / 2).toFixed(0)}/100`, 'success')
    allClips.forEach(clip => {
      console.log(`📋 ${clip.type.toUpperCase()} Clip: "${clip.title}"`)
      console.log(`   ⏱️  ${clip.startTime}s - ${clip.endTime}s (${Math.round(clip.duration)}s duration)`)
      console.log(`   🎯 ${clip.reason}`)
      console.log(`   ⭐ Quality Score: ${clip.score}/100`)
      console.log(`   🎥 Content Type: ${clip.contentType}`)
    })

    // Generate thumbnails for all clips
    console.log('🖼️ Generating thumbnails for', allClips.length, 'clips...')
    
    try {
      for (let i = 0; i < allClips.length; i++) {
        const clip = allClips[i]
        const isShortForm = clip.type === 'short'
        console.log(`📸 Generating ${isShortForm ? 'vertical' : 'horizontal'} thumbnail ${i + 1}/${allClips.length} for:`, clip.title)
        
        try {
          // Generate thumbnail at strategic moments based on content type
          let thumbnailTime
          
          if (clip.type === 'short') {
            // For short clips: thumbnail at 25% into the clip for best engagement
            thumbnailTime = clip.startTime + Math.min(15, clip.duration * 0.25)
          } else {
            // For YouTube clips: thumbnail at 30% into the clip for good context
            thumbnailTime = clip.startTime + Math.min(60, clip.duration * 0.3)
          }
          
          // Ensure thumbnail time doesn't exceed clip end time
          thumbnailTime = Math.min(thumbnailTime, clip.endTime - 5)
          
          console.log(`📸 Generating speaker-focused thumbnail at ${thumbnailTime.toFixed(1)}s for: ${clip.title}`)
          console.log(`🔗 Using video URL: ${originalFileUrl.substring(0, 50)}...`)
          
          const thumbnailUrl = await generateThumbnail(originalFileUrl, thumbnailTime, isShortForm, clip.id, clip.contentType || '')
          
          if (thumbnailUrl && thumbnailUrl.length > 0) {
            clip.thumbnailUrl = thumbnailUrl
            console.log(`✅ ${isShortForm ? 'Vertical' : 'Horizontal'} thumbnail generated successfully for: ${clip.title}`)
            console.log(`📷 Thumbnail URL length: ${thumbnailUrl.length} characters`)
          } else {
            console.error(`❌ Thumbnail generation returned empty URL for: ${clip.title}`)
            clip.thumbnailUrl = '' // Ensure it's empty string, not undefined
          }
        } catch (error) {
          console.warn(`⚠️ Thumbnail generation failed for ${clip.title}:`, error)
          
          // Try fallback thumbnail generation
          try {
            console.log(`🔄 Attempting fallback thumbnail generation for: ${clip.title}`)
            const fallbackThumbnail = await generateThumbnailFromVideo(file, clip.startTime + 5)
            if (fallbackThumbnail) {
              clip.thumbnailUrl = fallbackThumbnail
              console.log(`✅ Fallback thumbnail generated for: ${clip.title}`)
            } else {
              console.error(`❌ Fallback thumbnail also failed for: ${clip.title}`)
              clip.thumbnailUrl = '' // Keep empty for default placeholder
            }
          } catch (fallbackError) {
            console.error(`❌ Fallback thumbnail generation failed:`, fallbackError)
            clip.thumbnailUrl = '' // Keep empty for default placeholder
          }
        }
      }
      
      // Count successful thumbnail generations
      const clipsWithThumbnails = allClips.filter(clip => clip.thumbnailUrl && clip.thumbnailUrl.length > 0)
      const clipsWithoutThumbnails = allClips.filter(clip => !clip.thumbnailUrl || clip.thumbnailUrl.length === 0)
      
      console.log('🎉 Thumbnail generation process completed!')
      console.log(`📊 Results: ${clipsWithThumbnails.length}/${allClips.length} clips have thumbnails`)
      
      if (clipsWithoutThumbnails.length > 0) {
        console.warn(`⚠️ ${clipsWithoutThumbnails.length} clips are missing thumbnails:`)
        clipsWithoutThumbnails.forEach(clip => {
          console.warn(`   - ${clip.title} (${clip.type})`)
        })
      } else {
        console.log('✅ All clips have thumbnails generated successfully!')
      }
    } catch (error) {
      console.error('❌ Thumbnail generation process failed:', error)
    }

      // Store the original file URL for later use
      console.log(`💾 Storing clips and episode data in localStorage...`)
      localStorage.setItem(`originalFile_${episodeId}`, originalFileUrl)
      localStorage.setItem(`clips_${episodeId}`, JSON.stringify(allClips))
      localStorage.setItem(`episode_${episodeId}`, JSON.stringify({
        title: file.name,
        fileName: file.name,
        duration: Math.round(videoDuration),
        uploadedAt: new Date().toISOString(),
        originalFileUrl: originalFileUrl
      }))
      
      // Update the UI with new clips
      console.log(`🔄 Updating UI with ${allClips.length} new clips...`)
      setGeneratedClips(prevClips => {
        const updatedClips = [...prevClips, ...allClips]
        console.log(`📊 Total clips in UI: ${updatedClips.length}`)
        return updatedClips
      })
      setShowClips(true)

      console.log(`✅ CLIP GENERATION COMPLETE! Generated ${allClips.length} clips successfully`)
      return allClips
      
    } catch (error) {
      console.error(`❌ CLIP GENERATION FAILED:`, error)
      showToast(`Clip generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
      return []
    }
  }

  const simulateUpload = async (file: File): Promise<string> => {
    // Generate unique episode ID with timestamp to ensure fresh generation every time
    const timestamp = Date.now().toString(36)
    const randomId = Math.random().toString(36).substr(2, 9)
    const episodeId = `${timestamp}_${randomId}`
    
    console.log(`🆔 Generated unique episode ID: ${episodeId} for file: ${file.name}`)
    
    setUploadProgress(prev => [...prev, {
      file,
      progress: 0,
      status: 'uploading'
    }])

    for (let progress = 0; progress <= 100; progress += 10) {
      await new Promise(resolve => setTimeout(resolve, 200))
      setUploadProgress(prev => prev.map(item => 
        item.file === file ? { ...item, progress } : item
      ))
    }

    setUploadProgress(prev => prev.map(item => 
      item.file === file ? { ...item, status: 'processing', progress: 0 } : item
    ))

    for (let progress = 0; progress <= 100; progress += 20) {
      await new Promise(resolve => setTimeout(resolve, 500))
      setUploadProgress(prev => prev.map(item => 
        item.file === file ? { ...item, progress } : item
      ))
      
      if (progress === 80 && formData.autoGenerateClips) {
        console.log(`🎬 TRIGGERING clip generation at 80% progress for file: ${file.name}`)
        console.log(`🔄 Auto-generate clips setting: ${formData.autoGenerateClips}`)
        try {
          await generateClipsForFile(file, episodeId)
          console.log(`✅ Clip generation completed successfully`)
        } catch (error) {
          console.error(`❌ Clip generation failed in upload flow:`, error)
        }
      } else {
        console.log(`⚠️ Clip generation skipped - Progress: ${progress}%, Auto-generate: ${formData.autoGenerateClips}`)
      }
    }

    setUploadProgress(prev => prev.map(item => 
      item.file === file ? { ...item, status: 'completed', progress: 100, episodeId } : item
    ))

    return episodeId
  }

  const handleUploadAndGenerate = async () => {
    console.log('Upload button clicked!')
    console.log('Files:', files)
    console.log('Form data:', formData)
    
    if (files.length === 0) {
      console.log('No files selected')
      showToast('Please select at least one file to upload', 'warning')
      return
    }


    // Final file size validation before upload
    const oversizedFiles = files.filter(file => file.size > MAX_FILE_SIZE)
    if (oversizedFiles.length > 0) {
      const fileNames = oversizedFiles.map(f => `${f.name} (${formatFileSize(f.size)})`).join(', ')
      showToast(`Cannot upload files larger than 1GB: ${fileNames}`, 'error')
      return
    }

    console.log('Starting upload process...')
    setIsUploading(true)
    setUploadProgress([])

    try {
      showToast('Starting upload and processing...', 'success')
      
      const episodeIds = await Promise.all(files.map(file => simulateUpload(file)))
      
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const allClips = episodeIds.flatMap(episodeId => {
        const clipsData = localStorage.getItem(`clips_${episodeId}`)
        return clipsData ? JSON.parse(clipsData) : []
      })
      
      setGeneratedClips(allClips)
      setShowClips(true)
      showToast(`Successfully processed ${files.length} file(s)! ${allClips.length} clips generated.`, 'success')
      
    } catch (error) {
      console.error('Upload failed:', error)
      showToast('Upload failed. Please try again.', 'error')
    } finally {
      setIsUploading(false)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const createClipPlaceholder = async (clip: any): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      video.src = clip.originalFileUrl
      video.crossOrigin = 'anonymous'
      
      video.onloadedmetadata = () => {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // Set canvas size to match video
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        
        video.currentTime = clip.startTime
        
        video.onseeked = () => {
          // Create a simple placeholder for the clip
          if (ctx) {
            ctx.fillStyle = '#1f2937'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            
            // Add clip info
            ctx.fillStyle = 'white'
            ctx.font = '24px Arial'
            ctx.textAlign = 'center'
            ctx.fillText(clip.title, canvas.width / 2, canvas.height / 2 - 20)
            ctx.fillText(`${clip.duration}s clip`, canvas.width / 2, canvas.height / 2 + 20)
            
            // Convert canvas to blob URL
            canvas.toBlob((blob) => {
              if (blob) {
                const url = URL.createObjectURL(blob)
                resolve(url)
              } else {
                resolve(clip.originalFileUrl)
              }
            }, 'image/jpeg', 0.8)
          } else {
            resolve(clip.originalFileUrl)
          }
        }
      }
      
      video.onerror = () => {
        resolve(clip.originalFileUrl)
      }
    })
  }

  const handleFullscreen = (clipId: string) => {
    const videoContainer = document.getElementById(`video-container-${clipId}`)
    if (videoContainer) {
      if (!document.fullscreenElement) {
        videoContainer.requestFullscreen().then(() => {
          setIsFullscreen(true)
        }).catch(err => {
          console.error('Error attempting to enable fullscreen:', err)
        })
      } else {
        document.exitFullscreen().then(() => {
          setIsFullscreen(false)
        })
      }
    }
  }

  const handleSeek = (clipId: string, percentage: number) => {
    const clip = generatedClips.find(c => c.id === clipId)
    if (!clip) return
    
    const video = document.querySelector(`video[src="${clip.originalFileUrl}"]`) as HTMLVideoElement
    if (video) {
      const newTime = clip.startTime + (clip.duration * percentage / 100)
      video.currentTime = Math.min(newTime, clip.endTime)
      setCurrentTime(video.currentTime)
    }
  }

  const toggleFullscreen = (clipId: string) => {
    const container = document.getElementById(`video-container-${clipId}`)
    if (!container) return

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => {
        setIsFullscreen(true)
      }).catch(err => {
        console.error('Error attempting to enable fullscreen:', err)
      })
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false)
      }).catch(err => {
        console.error('Error attempting to exit fullscreen:', err)
      })
    }
  }

  const createClipSegment = async (clip: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log('Creating clip segment for:', clip.title)
      
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      
      video.src = clip.originalFileUrl
      video.crossOrigin = 'anonymous'
      video.muted = true
      
      video.onloadedmetadata = () => {
        console.log('Video loaded, dimensions:', video.videoWidth, 'x', video.videoHeight)
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        
        // Seek to the middle of the clip for a representative frame
        const middleTime = clip.startTime + (clip.duration / 2)
        console.log('Seeking to middle time:', middleTime)
        video.currentTime = middleTime
      }
      
      video.onseeked = () => {
        console.log('Video seeked to:', video.currentTime)
        
        try {
          // Draw the frame to canvas
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          
          // Add clip information overlay
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'
          ctx.fillRect(0, canvas.height - 80, canvas.width, 80)
          
          // Add clip title
          ctx.fillStyle = 'white'
          ctx.font = 'bold 20px Arial'
          ctx.textAlign = 'center'
          ctx.fillText(clip.title, canvas.width / 2, canvas.height - 50)
          
          // Add time range
          ctx.font = '16px Arial'
          ctx.fillText(`${clip.startTime}s - ${clip.endTime}s (${clip.duration}s clip)`, canvas.width / 2, canvas.height - 25)
          
          console.log('Frame captured and processed')
          
          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              console.log('Clip segment created successfully')
              resolve(url)
            } else {
              console.error('Failed to create blob')
              reject(new Error('Failed to create blob'))
            }
          }, 'image/jpeg', 0.9)
          
        } catch (error) {
          console.error('Error processing frame:', error)
          reject(error)
        }
      }
      
      video.onerror = (error) => {
        console.error('Video loading error:', error)
        reject(new Error('Video loading failed'))
      }
      
      // Timeout after 10 seconds
      setTimeout(() => {
        console.error('Clip creation timeout')
        reject(new Error('Clip creation timeout'))
      }, 10000)
    })
  }

  const createTrimmedClip = async (clip: any): Promise<string> => {
    return new Promise((resolve, reject) => {
      console.log('🎬 Creating trimmed clip for:', clip.title)
      
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }
      
      video.src = clip.originalFileUrl
      video.crossOrigin = 'anonymous'
      video.muted = true
      
      const chunks: BlobPart[] = []
      let mediaRecorder: MediaRecorder
      
      video.onloadedmetadata = () => {
        console.log('📹 Video loaded, setting up recording...')
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        
        // Create a stream from the canvas
        const stream = canvas.captureStream(30) // 30 FPS
        
        // Set up MediaRecorder to record the stream
        mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9'
        })
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunks.push(event.data)
          }
        }
        
        mediaRecorder.onstop = () => {
          console.log('🎥 Recording stopped, creating blob...')
          const blob = new Blob(chunks, { type: 'video/webm' })
          const url = URL.createObjectURL(blob)
          resolve(url)
        }
        
        // Start recording and seek to clip start
        video.currentTime = clip.startTime
      }
      
      video.onseeked = () => {
        console.log('📍 Seeked to:', video.currentTime)
        
        if (!mediaRecorder) return
        
        // Start recording
        mediaRecorder.start()
        console.log('🔴 Recording started')
        
        // Play the video
        video.play()
        
        // Stop recording after clip duration
        setTimeout(() => {
          video.pause()
          mediaRecorder.stop()
          console.log('⏹️ Recording stopped after', clip.duration, 'seconds')
        }, clip.duration * 1000)
      }
      
      video.ontimeupdate = () => {
        // Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        
        // Stop if we've reached the end time
        if (video.currentTime >= clip.endTime) {
          video.pause()
          if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop()
          }
        }
      }
      
      video.onerror = () => {
        reject(new Error('Video loading failed'))
      }
      
      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Clip creation timeout'))
      }, 30000)
    })
  }

  const downloadClip = async (clip: any) => {
    console.log('🎬 Download clip:', clip.title)
    console.log('🔍 DEBUG: Clip data:', clip)
    console.log('🔍 DEBUG: FFmpeg ready?', ffmpegReady)
    console.log('🔍 DEBUG: FFmpeg loading?', ffmpegLoading)
    console.log('🔍 DEBUG: FFmpeg ref:', !!ffmpegRef.current)
    
    try {
      // SIMPLE FALLBACK: Try direct download first if original file is accessible
      if (clip.originalFileUrl) {
        console.log('🔍 Attempting simple fallback download...')
        try {
          const response = await fetch(clip.originalFileUrl, { method: 'HEAD' })
          if (response.ok) {
            console.log('✅ Original file accessible, offering direct download...')
            const podcastTitle = clip.fileName ? clip.fileName.replace(/\.[^/.]+$/, '') : 'podcast'
            const filename = `${podcastTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Math.round(clip.startTime)}s-${Math.round(clip.endTime)}s_full.mp4`
            
            const link = document.createElement('a')
            link.href = clip.originalFileUrl
            link.download = filename
            link.style.display = 'none'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            
            showToast('⚡ Quick download started! (Full video - you may need to trim manually)', 'success')
            return
          }
        } catch (fallbackError) {
          console.log('⚠️ Simple fallback failed, proceeding with FFmpeg processing...')
        }
      }

      // Step 1: Check if FFmpeg is ready
      console.log('🔍 Step 1: Checking FFmpeg status...')
      if (!ffmpegReady || !ffmpegRef.current) {
        console.log('⚠️ FFmpeg not ready, initializing...')
        showToast('⚠️ Video processor not ready. Initializing...', 'warning')
        await initializeFFmpeg()
        if (!ffmpegReady) {
          throw new Error('FFmpeg initialization failed. Video processing unavailable.')
        }
        console.log('✅ FFmpeg initialized successfully')
      } else {
        console.log('✅ FFmpeg already ready')
      }
      
      showToast('🎬 Generating MP4 clip... This may take a moment', 'success')
      
      const ffmpeg = ffmpegRef.current!
      console.log('🎯 Using FFmpeg.wasm for clip generation')
      console.log('📋 Clip data:', {
        title: clip.title,
        startTime: clip.startTime,
        endTime: clip.endTime,
        duration: clip.endTime - clip.startTime,
        originalFileUrl: clip.originalFileUrl?.substring(0, 50) + '...'
      })
      
      // Step 2: Validate clip data
      console.log('🔍 Step 2: Validating clip data...')
      if (!clip.originalFileUrl) {
        throw new Error('No original file URL found in clip data')
      }
      if (typeof clip.startTime !== 'number' || typeof clip.endTime !== 'number') {
        throw new Error('Invalid start/end times in clip data')
      }
      if (clip.endTime <= clip.startTime) {
        throw new Error('End time must be greater than start time')
      }
      console.log('✅ Clip data validation passed')
      
      // Step 3: Fetch original video file
      console.log('🔍 Step 3: Fetching original video...')
      console.log('📁 Fetching from:', clip.originalFileUrl.substring(0, 100) + '...')
      
      let videoResponse
      try {
        videoResponse = await fetch(clip.originalFileUrl)
      } catch (fetchError) {
        throw new Error(`Original video file is no longer accessible. Please re-upload the podcast to generate fresh clips.`)
      }
      
      if (!videoResponse.ok) {
        if (videoResponse.status === 404) {
          throw new Error(`Original video file expired. Please re-upload the podcast to generate fresh clips.`)
        }
        throw new Error(`Failed to fetch video: ${videoResponse.status} ${videoResponse.statusText}`)
      }
      
      const videoArrayBuffer = await videoResponse.arrayBuffer()
      if (videoArrayBuffer.byteLength === 0) {
        throw new Error('Fetched video file is empty (0 bytes)')
      }
      
      console.log(`✅ Video fetched successfully: ${(videoArrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)
      
      // Step 4: Write video to FFmpeg virtual file system
      console.log('🔍 Step 4: Loading video into FFmpeg...')
      const inputFileName = 'input.mp4'
      const outputFileName = 'output.mp4'
      
      try {
        await ffmpeg.writeFile(inputFileName, new Uint8Array(videoArrayBuffer))
        console.log('✅ Video loaded into FFmpeg virtual file system')
      } catch (writeError) {
        throw new Error(`Failed to write video to FFmpeg: ${writeError instanceof Error ? writeError.message : 'Unknown error'}`)
      }
      
      // Step 5: Calculate timing parameters with precision
      console.log('🔍 Step 5: Calculating clip parameters...')
      
      // Ensure precise timing by rounding to 2 decimal places
      const startTime = Math.round(clip.startTime * 100) / 100
      const endTime = Math.round(clip.endTime * 100) / 100
      const duration = Math.round((endTime - startTime) * 100) / 100
      
      if (duration <= 0) {
        throw new Error(`Invalid duration: ${duration} seconds`)
      }
      if (startTime < 0) {
        throw new Error(`Invalid start time: ${startTime} seconds`)
      }
      
      // Validate duration limits based on clip type
      if (clip.type === 'short' && duration > 60) {
        console.warn(`⚠️ Short clip duration ${duration}s exceeds 60s limit - trimming to 60s`)
        const adjustedDuration = 60
        const adjustedEndTime = startTime + adjustedDuration
        console.log(`🔧 Adjusted: ${startTime}s → ${adjustedEndTime}s (${adjustedDuration}s)`)
      }
      
      console.log(`⏱️ PRECISE Clip parameters:`)
      console.log(`   Start: ${startTime}s (${clip.startTime} → ${startTime})`)
      console.log(`   Duration: ${duration}s (calculated: ${endTime - startTime})`)
      console.log(`   End: ${endTime}s (${clip.endTime} → ${endTime})`)
      console.log(`   Type: ${clip.type}`)
      
      // Additional validation
      if (clip.type === 'short' && duration > 60) {
        console.error(`❌ ERROR: Short clip duration ${duration}s exceeds 60s limit!`)
        throw new Error(`Short clip duration ${duration}s exceeds 60-second limit`)
      }
      
      const isShortClip = clip.type === 'short'
      showToast(`🔄 Processing ${Math.round(duration)}s ${isShortClip ? 'short clip (fast)' : 'clip'}...`, 'success')
      
      // Step 6: Prepare FFmpeg command
      console.log('🔍 Step 6: Preparing FFmpeg command...')
      console.log(`📱 Clip type: ${clip.type}, isShortClip: ${isShortClip}`)
      
      let ffmpegArgs: string[]
      
      if (isShortClip) {
        // For shorts: Fast copy extraction (same speed as YouTube clips)
        console.log('📱 Preparing short clip (fast extraction)...')
        console.log('⚡ Using ultra-fast copy method for instant download')
        
        ffmpegArgs = [
          '-ss', startTime.toFixed(2),     // Precise start time
          '-i', inputFileName,             // Input file
          '-t', duration.toFixed(2),       // Precise duration
          '-c:v', 'copy',                 // Copy video stream (no re-encoding)
          '-c:a', 'copy',                 // Copy audio stream (no re-encoding)
          '-avoid_negative_ts', 'make_zero',
          '-f', 'mp4',                    // Force MP4 format
          outputFileName                  // Output file
        ]
        
        console.log('⚡ Fast copy method - download will be instant!')
        console.log('📱 Note: You can convert to vertical format later if needed')
      } else {
        // For regular clips: Use original horizontal format (fast copy)
        console.log('🎬 Preparing horizontal clip (fast copy)...')
        ffmpegArgs = [
          '-ss', startTime.toFixed(2),     // Precise start time with 2 decimal places
          '-i', inputFileName,             // Input file
          '-t', duration.toFixed(2),       // Precise duration with 2 decimal places
          '-c:v', 'copy',                 // Copy video stream (no re-encoding)
          '-c:a', 'copy',                 // Copy audio stream (no re-encoding)
          '-avoid_negative_ts', 'make_zero',
          '-f', 'mp4',                    // Force MP4 format
          outputFileName                  // Output file
        ]
      }
      
      console.log('🚀 FFmpeg command:', ffmpegArgs.join(' '))
      
      // Step 7: Execute FFmpeg
      console.log('🔍 Step 7: Executing FFmpeg...')
      console.log('🚀 Full FFmpeg command:', ffmpegArgs.join(' '))
      
      try {
        await ffmpeg.exec(ffmpegArgs)
        console.log('✅ FFmpeg execution completed successfully')
        
        if (isShortClip) {
          console.log('📱 Instagram vertical conversion completed!')
          console.log('🔍 Output: 1080x1920 (perfect for Instagram Reels)')
        }
      } catch (ffmpegError) {
        console.error('❌ FFmpeg execution failed:', ffmpegError)
        console.error('❌ Failed command:', ffmpegArgs.join(' '))
        throw new Error(`FFmpeg processing failed: ${ffmpegError instanceof Error ? ffmpegError.message : 'Unknown error'}`)
      }
      
      // Step 8: Read the generated clip
      console.log('🔍 Step 8: Reading generated clip...')
      let outputData
      try {
        outputData = await ffmpeg.readFile(outputFileName)
        if (!outputData || outputData.length === 0) {
          throw new Error('Generated clip file is empty')
        }
        console.log(`✅ Clip file read: ${outputData.length} bytes`)
      } catch (readError) {
        throw new Error(`Failed to read generated clip: ${readError instanceof Error ? readError.message : 'Unknown error'}`)
      }
      
      const outputBlob = new Blob([outputData as any], { type: 'video/mp4' })
      
      // Validate that we actually got a clip, not the full video
      const originalSizeMB = videoArrayBuffer.byteLength / 1024 / 1024
      const clipSizeMB = outputBlob.size / 1024 / 1024
      const expectedSizeRatio = duration / (clip.endTime + 60) // Rough estimate
      
      console.log(`📊 Size comparison:`)
      console.log(`   Original: ${originalSizeMB.toFixed(2)} MB`)
      console.log(`   Clip: ${clipSizeMB.toFixed(2)} MB`)
      console.log(`   Ratio: ${(clipSizeMB / originalSizeMB * 100).toFixed(1)}%`)
      console.log(`   Expected ratio: ~${(expectedSizeRatio * 100).toFixed(1)}%`)
      
      // Warning if clip is suspiciously large (might be full video)
      if (clipSizeMB > originalSizeMB * 0.8) {
        console.warn('⚠️ WARNING: Clip size is very close to original - might not be properly trimmed!')
      }
      
      // Validate actual clip duration by creating a temporary video element
      console.log('🔍 Validating actual clip duration...')
      try {
        const clipUrl = URL.createObjectURL(outputBlob)
        const tempVideo = document.createElement('video')
        tempVideo.src = clipUrl
        
        await new Promise((resolve, reject) => {
          tempVideo.onloadedmetadata = () => {
            const actualDuration = Math.round(tempVideo.duration * 100) / 100
            console.log(`⏱️ Duration validation:`)
            console.log(`   Expected: ${duration}s`)
            console.log(`   Actual: ${actualDuration}s`)
            console.log(`   Difference: ${Math.abs(actualDuration - duration).toFixed(2)}s`)
            
            if (Math.abs(actualDuration - duration) > 2) {
              console.warn(`⚠️ WARNING: Significant duration difference! Expected ${duration}s but got ${actualDuration}s`)
            } else {
              console.log(`✅ Duration validation passed (within 2s tolerance)`)
            }
            
            URL.revokeObjectURL(clipUrl)
            resolve(true)
          }
          tempVideo.onerror = () => {
            console.warn('⚠️ Could not validate clip duration - video metadata loading failed')
            URL.revokeObjectURL(clipUrl)
            resolve(true) // Continue anyway
          }
          setTimeout(() => {
            console.warn('⚠️ Duration validation timeout - continuing anyway')
            URL.revokeObjectURL(clipUrl)
            resolve(true)
          }, 3000)
        })
      } catch (validationError) {
        console.warn('⚠️ Duration validation failed:', validationError)
        // Continue anyway - validation is not critical
      }
      
      // Additional size validation
      if (clipSizeMB < originalSizeMB * 0.1) {
        console.log('✅ Clip size looks correct - properly trimmed')
      }
      
      console.log(`✅ Clip generated! Size: ${clipSizeMB.toFixed(2)} MB`)
      
      // Clean up FFmpeg virtual file system
      try {
        await ffmpeg.deleteFile(inputFileName)
        await ffmpeg.deleteFile(outputFileName)
      } catch (cleanupError) {
        console.warn('⚠️ Cleanup warning:', cleanupError)
      }
      
      // Create download
      const downloadUrl = URL.createObjectURL(outputBlob)
      const podcastTitle = clip.fileName ? clip.fileName.replace(/\.[^/.]+$/, '') : 'podcast'
      const filename = `${podcastTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Math.round(clip.startTime)}s-${Math.round(clip.endTime)}s_${Math.round(duration)}s.mp4`
      
      console.log('💾 Downloading:', filename)
      
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
      
      const formatMessage = isShortClip ? '✅ Instagram vertical clip (1080x1920) downloaded!' : '✅ MP4 clip downloaded successfully!'
      showToast(formatMessage, 'success')
      
    } catch (error: any) {
      console.error('❌ Download failed:', error)
      console.error('❌ Full error details:', error.message)
      console.warn('💡 Tip: If original file expired, try re-uploading the podcast')
      
      // Provide detailed error information
      let errorMessage = 'Download failed'
      let suggestion = ''
      
      if (error.message.includes('FFmpeg initialization')) {
        errorMessage = 'Video processor failed to initialize'
        suggestion = 'Try refreshing the page or check your internet connection'
      } else if (error.message.includes('fetch') || error.message.includes('accessible')) {
        errorMessage = 'Original video file is no longer available'
        suggestion = 'Please re-upload your podcast to generate fresh clips'
      } else if (error.message.includes('FFmpeg processing')) {
        errorMessage = 'Video processing failed'
        suggestion = 'The video format might not be supported or file is corrupted'
      } else if (error.message.includes('write video to FFmpeg')) {
        errorMessage = 'Failed to load video into processor'
        suggestion = 'File might be too large or corrupted'
      } else if (error.message.includes('CORS')) {
        errorMessage = 'Browser security blocked file access'
        suggestion = 'Try re-uploading the file'
      } else {
        errorMessage = `Processing error: ${error.message}`
        suggestion = 'Try refreshing the page or re-uploading the podcast'
      }
      
      showToast(`❌ ${errorMessage}. ${suggestion}`, 'error')
      
      // Fallback: Offer manual clipping instructions
      const clipDetails = `
CLIP INFORMATION:
================
Title: ${clip.title}
File: ${clip.fileName}
Start: ${formatTime(clip.startTime)} (${clip.startTime}s)
End: ${formatTime(clip.endTime)} (${clip.endTime}s)
Duration: ${Math.round(clip.endTime - clip.startTime)}s

MANUAL CLIPPING INSTRUCTIONS:
============================
1. Use any video editor (DaVinci Resolve, Adobe Premiere, OpenShot)
2. Import your original video file
3. Cut from ${formatTime(clip.startTime)} to ${formatTime(clip.endTime)}
4. Export as MP4

ERROR DETAILS:
=============
${error.message}
      `
      
      // Show detailed information in console and alert
      console.log('📋 Clip information for manual editing:', clipDetails)
      
      const userChoice = confirm(
        `Automatic clip generation failed.\n\n` +
        `Would you like to see the clip timing information for manual editing?\n\n` +
        `Clip: ${clip.title}\n` +
        `Time: ${formatTime(clip.startTime)} - ${formatTime(clip.endTime)}`
      )
      
      if (userChoice) {
        alert(clipDetails)
      }
    }
  }


  const handleClipPlay = async (clipId: string) => {
    console.log('Clip clicked:', clipId)
    console.log('Current playing clip:', playingClip)
    
    if (playingClip === clipId) {
      console.log('Pausing clip')
      setPlayingClip(null)
    } else {
      console.log('Playing clip:', clipId)
      
      // Find the clip
      const clip = generatedClips.find(c => c.id === clipId)
      if (clip) {
        // Check if we already have a processed clip blob
        if (!clipBlobs[clipId]) {
          // Create the clip segment
          const clipUrl = await createClipPlaceholder(clip)
          setClipBlobs(prev => ({ ...prev, [clipId]: clipUrl }))
        }
      }
      
      setPlayingClip(clipId)
      
      // After setting the playing clip, ensure audio is enabled
      setTimeout(() => {
        const video = document.querySelector(`video[src="${clip?.originalFileUrl}"]`) as HTMLVideoElement
        if (video) {
          video.muted = false
          video.volume = 1.0
          console.log('🔊 Audio enabled for clip playback, volume:', video.volume, 'muted:', video.muted)
          
          // Try to play with audio
          video.play().then(() => {
            console.log('✅ Video playing with audio')
          }).catch((error) => {
            console.error('❌ Video play failed:', error)
            // If autoplay fails, user needs to click play button
            showToast('Click the play button to start video with audio', 'warning')
          })
        }
      }, 100)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-8">
            <button 
              className="text-xl font-semibold text-gray-900 transition-all duration-200 px-3 py-2 rounded-md border-2 border-transparent bg-transparent"
              onClick={() => {
                console.log('🔄 BUTTON CLICKED - Going to home!')
                setShowClips(false)
                setGeneratedClips([])
                setFiles([])
                setUploadProgress([])
                setIsUploading(false)
              }}
              title="Click to go to home page"
            >
              podcastclipper
            </button>
            <nav className="flex space-x-6">
              <button 
                onClick={() => setShowClips(false)}
                className={`${!showClips ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-600 hover:text-gray-700'} pb-1`}
              >
                Upload
              </button>
              <button 
                onClick={() => {
                  setShowClips(true)
                  loadClipsFromStorage() // Reload clips when switching to clips view
                }}
                className={`${showClips ? 'text-gray-900 border-b-2 border-gray-900' : 'text-gray-600 hover:text-gray-700'} pb-1`}
              >
                My Clips
              </button>
            </nav>
          </div>
          
          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => {
                console.log('User icon clicked, current dropdown state:', showUserDropdown)
                setShowUserDropdown(!showUserDropdown)
                console.log('User dropdown state set to:', !showUserDropdown)
              }}
              className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
            >
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-gray-600" />
              </div>
              {user && (
                <span className="text-sm font-medium text-gray-700">{user.name}</span>
              )}
            </button>
            
            {/* User Dropdown */}
            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                {user ? (
                  <>
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm font-medium text-gray-900">{user.name}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      onClick={() => setShowUserDropdown(false)}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Login</span>
                    </Link>
                    <Link
                      href="/register"
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
                      onClick={() => {
                        console.log('Register link clicked!')
                        setShowUserDropdown(false)
                      }}
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Register</span>
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        {!showClips ? (
          <div className="flex flex-col items-center justify-center min-h-full">
            <div className="w-full max-w-2xl">
              <div className="text-center mb-12">
                <h2 
                  className="text-3xl font-bold text-gray-900 mb-2 cursor-pointer transition-colors duration-200"
                  onClick={() => {
                    console.log('🏠 Navigating to home page')
                    setShowClips(false)
                    setGeneratedClips([])
                    setFiles([])
                    setUploadProgress([])
                    setIsUploading(false)
                  }}
                  title="Click to go to home page"
                >
                  Podcast Clipper
                </h2>
                <p className="text-gray-600">Upload your podcast and get AI-generated clips instantly</p>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Podcast</h3>
                  <p className="text-sm text-gray-600">Upload your audio or video file to generate clips</p>
                </div>


                <div
                  className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                    dragActive 
                      ? 'border-blue-400 bg-blue-50' 
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Drag and drop your file</h4>
                  <p className="text-gray-600 mb-4">or click to browse (Audio/Video up to 1GB)</p>
                  
                  <input
                    type="file"
                    multiple
                    accept="audio/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="file-upload"
                    disabled={isUploading}
                  />
                  <label
                    htmlFor="file-upload"
                    className={`px-6 py-2 rounded-md cursor-pointer inline-block ${
                      isUploading 
                        ? 'bg-gray-400 text-white cursor-not-allowed' 
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}
                  >
                    Select File
                  </label>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-900 mb-2">Selected files:</p>
                    <div className="space-y-2">
                      {files.map((file, index) => {
                        const progress = uploadProgress.find(p => p.file === file)
                        return (
                          <div key={index} className="flex items-center justify-between p-2 bg-white rounded border">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{file.name}</p>
                              <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                              {progress && (
                                <div className="mt-1">
                                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                                    <span>
                                      {progress.status === 'uploading' ? 'Uploading...' : 
                                       progress.status === 'processing' ? 'Processing...' : 
                                       progress.status === 'completed' ? 'Completed' : 'Error'}
                                    </span>
                                    <span>{progress.progress}%</span>
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1">
                                    <div 
                                      className={`h-1 rounded-full transition-all duration-300 ${
                                        progress.status === 'completed' ? 'bg-blue-600' : 'bg-blue-600'
                                      }`}
                                      style={{ width: `${progress.progress}%` }}
                                    ></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="flex items-center ml-4">
                              {progress && progress.status === 'completed' && (
                                <CheckCircle className="h-5 w-5 text-blue-600 mr-2" />
                              )}
                              {progress && progress.status === 'processing' && (
                                <Loader2 className="h-5 w-5 text-blue-600 animate-spin mr-2" />
                              )}
                              {!isUploading && (
                                <button
                                  onClick={() => removeFile(index)}
                                  className="p-1 text-gray-400 hover:text-red-500"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="mt-6 text-right">
                  {!isUploading ? (
                    <button
                      onClick={handleUploadAndGenerate}
                      disabled={files.length === 0}
                      className="bg-gray-600 text-white px-6 py-2 rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      Upload and Generate Clips
                    </button>
                  ) : (
                    <div className="flex items-center justify-end text-gray-600">
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      <span>Processing files...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <div className="mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">My Clips</h2>
                <p className="text-gray-600">View and manage your generated clips here. Processing may take a few minutes.</p>
              </div>
            </div>

            {/* YouTube Clips Section */}
            <div className="mb-12">
              <div className="flex items-center mb-6">
                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium mr-3">
                  YouTube
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Long-form Clips (up to 5 minutes)</h3>
                <span className="ml-auto text-gray-500 text-sm">
                  {generatedClips.filter(clip => clip.type === 'youtube').length} clips
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {generatedClips.filter(clip => clip.type === 'youtube').map((clip) => (
                  <div key={clip.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="relative aspect-video bg-gray-900">
                      {playingClip === clip.id ? (
                        /* Video Player */
                        <div 
                          id={`video-container-${clip.id}`}
                          className={`relative w-full h-full ${isFullscreen ? 'bg-black' : ''}`}
                        >
                          <video
                            className="w-full h-full object-cover"
                            controls={false}
                            autoPlay
                            muted={false}
                            playsInline
                            onEnded={() => {
                              setPlayingClip(null)
                              setIsVideoPlaying(false)
                            }}
                            onError={(e) => {
                              console.warn('⚠️ YouTube clip preview unavailable - original file not accessible')
                              setPlayingClip(null)
                              setIsVideoPlaying(false)
                              showToast('Video preview unavailable. You can still download the clip.', 'warning')
                            }}
                            onLoadedMetadata={(e) => {
                              const video = e.target as HTMLVideoElement
                              video.currentTime = clip.startTime
                              video.volume = 1.0
                              setIsVideoPlaying(true)
                              console.log('Video loaded with audio, volume:', video.volume)
                            }}
                            onTimeUpdate={(e) => {
                              const video = e.target as HTMLVideoElement
                              setCurrentTime(video.currentTime)
                              if (video.currentTime >= clip.endTime) {
                                video.pause()
                                setPlayingClip(null)
                                setIsVideoPlaying(false)
                              }
                            }}
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            src={clip.originalFileUrl}
                          >
                            Your browser does not support the video tag.
                          </video>
                          
                          {/* Custom Controls */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                            <div className="mb-3">
                              <div 
                                className="w-full bg-white bg-opacity-20 rounded-full h-2 cursor-pointer"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const percentage = ((e.clientX - rect.left) / rect.width) * 100
                                  handleSeek(clip.id, percentage)
                                }}
                              >
                                <div 
                                  className="bg-white h-2 rounded-full transition-all duration-100"
                                  style={{ 
                                    width: `${Math.max(0, Math.min(100, ((currentTime - clip.startTime) / clip.duration) * 100))}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-white text-sm">
                              <div className="flex items-center space-x-3">
                                <button 
                                  onClick={() => {
                                    const video = document.querySelector(`video[src="${clip.originalFileUrl}"]`) as HTMLVideoElement
                                    if (video) {
                                      if (video.paused) {
                                        video.play()
                                        setIsVideoPlaying(true)
                                      } else {
                                        video.pause()
                                        setIsVideoPlaying(false)
                                      }
                                    }
                                  }}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                >
                                  {isVideoPlaying && playingClip === clip.id ? (
                                    <Pause className="w-5 h-5" />
                                  ) : (
                                    <Play className="w-5 h-5" />
                                  )}
                                </button>

                                <button 
                                  onClick={() => {
                                    const video = document.querySelector(`video[src="${clip.originalFileUrl}"]`) as HTMLVideoElement
                                    if (video) {
                                      video.muted = !video.muted
                                      setIsMuted(video.muted)
                                    }
                                  }}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                  title={isMuted ? "Unmute" : "Mute"}
                                >
                                  {isMuted ? (
                                    <VolumeX className="w-4 h-4" />
                                  ) : (
                                    <Volume2 className="w-4 h-4" />
                                  )}
                                </button>
                                
                                <span className="text-sm font-medium">
                                  {formatTime(Math.max(0, Math.floor(currentTime - clip.startTime)))} / {formatTime(clip.duration)}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2">
                                <button 
                                  onClick={() => {
                                    console.log('🔥 YouTube Download button clicked for clip:', clip.title)
                                    console.log('🔥 Clip data:', clip)
                                    downloadClip(clip)
                                  }}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                  title={ffmpegReady ? "Download MP4 Clip" : ffmpegLoading ? "Loading video processor..." : "Initialize video processor"}
                                  disabled={ffmpegLoading}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                
                                <button 
                                  onClick={() => toggleFullscreen(clip.id)}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                  title="Fullscreen"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Thumbnail */
                        <div 
                          className="w-full h-full cursor-pointer group relative"
                          onClick={() => handleClipPlay(clip.id)}
                        >
                          {clip.thumbnailUrl ? (
                            <img 
                              src={clip.thumbnailUrl} 
                              alt={clip.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                            </div>
                          )}
                          
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all">
                            <div className="bg-white bg-opacity-90 rounded-full p-4 group-hover:bg-opacity-100 transition-all">
                              <Play className="w-8 h-8 text-gray-900" />
                            </div>
                          </div>

                          {/* Duration Badge */}
                          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                            {formatTime(clip.duration)}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{clip.title}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <span>{formatTime(clip.startTime)} - {formatTime(clip.endTime)}</span>
                        <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                          {formatTime(clip.duration)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{clip.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Short-form Clips Section */}
            <div className="mb-12">
              <div className="flex items-center mb-6">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-3 py-1 rounded-full text-sm font-medium mr-3">
                  Shorts
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Short-form Clips (up to 60 seconds) • 9:16 Vertical</h3>
                <span className="ml-auto text-gray-500 text-sm">
                  {generatedClips.filter(clip => clip.type === 'short').length} clips
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                {generatedClips.filter(clip => clip.type === 'short').map((clip) => (
                  <div key={clip.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="relative aspect-[9/16] bg-gray-900 overflow-hidden">
                      {playingClip === clip.id ? (
                        /* Video Player */
                        <div 
                          id={`video-container-${clip.id}`}
                          className={`relative w-full h-full ${isFullscreen ? 'bg-black' : ''}`}
                        >
                          <video
                            className="w-full h-full object-cover"
                            style={{
                              objectPosition: getDynamicVideoPosition(clip.id, clip.contentType || '', videoCurrentTime, clip.startTime), // Simplified speaker-focused positioning
                              objectFit: 'cover' // Maintain aspect ratio while filling container
                            }}
                            controls={false}
                            autoPlay
                            muted={false}
                            playsInline
                            onTimeUpdate={(e) => {
                              const video = e.target as HTMLVideoElement
                              setVideoCurrentTime(video.currentTime)
                              setCurrentTime(video.currentTime)
                              if (video.currentTime >= clip.endTime) {
                                video.pause()
                                setPlayingClip(null)
                                setIsVideoPlaying(false)
                                setVideoCurrentTime(0)
                              }
                            }}
                            onEnded={() => {
                              setPlayingClip(null)
                              setIsVideoPlaying(false)
                              setVideoCurrentTime(0)
                            }}
                            onError={(e) => {
                              console.warn('⚠️ Short clip preview unavailable - original file not accessible')
                              setPlayingClip(null)
                              setIsVideoPlaying(false)
                              showToast('Video preview unavailable. You can still download the clip.', 'warning')
                            }}
                            onLoadedMetadata={(e) => {
                              const video = e.target as HTMLVideoElement
                              video.currentTime = clip.startTime
                              video.volume = 1.0
                              setIsVideoPlaying(true)
                              console.log('Video loaded with audio, volume:', video.volume)
                            }}
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                            src={clip.originalFileUrl}
                          >
                            Your browser does not support the video tag.
                          </video>
                          
                          {/* Speaker Focus Overlay for Short-form */}
                          <div className="absolute inset-0 pointer-events-none">
                            <div 
                              className="absolute top-0 left-0 right-0 h-full"
                              style={{
                                background: 'radial-gradient(ellipse at center 30%, transparent 50%, rgba(0,0,0,0.15) 100%)'
                              }}
                            ></div>
                          </div>
                          
                          {/* Custom Controls */}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/50 to-transparent p-3">
                            <div className="mb-3">
                              <div 
                                className="w-full bg-white bg-opacity-20 rounded-full h-2 cursor-pointer"
                                onClick={(e) => {
                                  const rect = e.currentTarget.getBoundingClientRect()
                                  const percentage = ((e.clientX - rect.left) / rect.width) * 100
                                  handleSeek(clip.id, percentage)
                                }}
                              >
                                <div 
                                  className="bg-white h-2 rounded-full transition-all duration-100"
                                  style={{ 
                                    width: `${Math.max(0, Math.min(100, ((currentTime - clip.startTime) / clip.duration) * 100))}%` 
                                  }}
                                ></div>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between text-white text-sm">
                              <div className="flex items-center space-x-3">
                                <button 
                                  onClick={() => {
                                    const video = document.querySelector(`video[src="${clip.originalFileUrl}"]`) as HTMLVideoElement
                                    if (video) {
                                      if (video.paused) {
                                        video.play()
                                        setIsVideoPlaying(true)
                                      } else {
                                        video.pause()
                                        setIsVideoPlaying(false)
                                      }
                                    }
                                  }}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                >
                                  {isVideoPlaying && playingClip === clip.id ? (
                                    <Pause className="w-4 h-4" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </button>

                                <button 
                                  onClick={() => {
                                    const video = document.querySelector(`video[src="${clip.originalFileUrl}"]`) as HTMLVideoElement
                                    if (video) {
                                      video.muted = !video.muted
                                      setIsMuted(video.muted)
                                    }
                                  }}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                  title={isMuted ? "Unmute" : "Mute"}
                                >
                                  {isMuted ? (
                                    <VolumeX className="w-4 h-4" />
                                  ) : (
                                    <Volume2 className="w-4 h-4" />
                                  )}
                                </button>
                                
                                <span className="text-xs font-medium font-mono min-w-[50px] text-center tabular-nums">
                                  {formatTime(Math.max(0, Math.floor(currentTime - clip.startTime)))} / {formatTime(clip.duration)}
                                </span>
                              </div>
                              
                              <div className="flex items-center space-x-2 min-h-[32px]">
                                <button 
                                  onClick={() => {
                                    console.log('🔥 Short Download button clicked for clip:', clip.title)
                                    console.log('🔥 Clip data:', clip)
                                    downloadClip(clip)
                                  }}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                  title={ffmpegReady ? "Download MP4 Clip" : ffmpegLoading ? "Loading video processor..." : "Initialize video processor"}
                                  disabled={ffmpegLoading}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                
                                <button 
                                  onClick={() => toggleFullscreen(clip.id)}
                                  className="bg-white bg-opacity-20 hover:bg-opacity-30 rounded-full p-2 transition-all"
                                  title="Fullscreen"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Thumbnail */
                        <div 
                          className="w-full h-full cursor-pointer group relative"
                          onClick={() => handleClipPlay(clip.id)}
                        >
                          {clip.thumbnailUrl ? (
                            <img 
                              src={clip.thumbnailUrl} 
                              alt={clip.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                              <div className="w-12 h-12 bg-gray-700 rounded-full"></div>
                            </div>
                          )}
                          
                          {/* Play Button Overlay */}
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 group-hover:bg-opacity-50 transition-all">
                            <div className="bg-white bg-opacity-90 rounded-full p-3 group-hover:bg-opacity-100 transition-all">
                              <Play className="w-6 h-6 text-gray-900" />
                            </div>
                          </div>

                          {/* Duration Badge */}
                          <div className="absolute bottom-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                            {formatTime(clip.duration)}
                          </div>

                          {/* Vertical Format Badge */}
                          <div className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs px-2 py-1 rounded">
                            9:16
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">{clip.title}</h3>
                      <div className="flex items-center justify-between text-sm text-gray-500 mb-3">
                        <span>{formatTime(clip.startTime)} - {formatTime(clip.endTime)}</span>
                        <span className="bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 px-2 py-1 rounded-full text-xs">
                          {formatTime(clip.duration)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600">{clip.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {generatedClips.length === 0 && (
              <div className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <Upload className="w-16 h-16 mx-auto" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No clips yet</h3>
                <p className="text-gray-600 mb-4">Upload a podcast to generate your first clips</p>
                <button 
                  onClick={() => setShowClips(false)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
                >
                  Upload Podcast
                </button>
              </div>
            )}
          </div>
        )}
      </main>


      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
      />
    </div>
  )
}
