// Persistent storage abstraction for file uploads.
//
// PROBLEM:
//   The original code wrote uploaded files to `public/uploads/products/`
//   and `public/uploads/slips/`. On Netlify (and any serverless host) the
//   filesystem is read-only at runtime — uploads would be lost on the next
//   function invocation.
//
// SOLUTION:
//   This module abstracts file storage behind a single `uploadFile()`
//   function. The actual backend is selected at runtime:
//
//   • If `CLOUDINARY_URL` (or CLOUDINARY_CLOUD_NAME + CLOUDINARY_API_KEY +
//     CLOUDINARY_API_SECRET) is set → uploads go to Cloudinary and return
//     a `https://res.cloudinary.com/...` URL.
//
//   • Otherwise (local dev sandbox) → writes to `public/uploads/<folder>/`
//     and returns a relative URL `/uploads/<folder>/<file>`. This preserves
//     the original dev-mode behavior so the local sandbox still works.
//
// API CONTRACT (unchanged from the original slip-upload route):
//   uploadFile(buffer, { folder, filename, mimetype }) → Promise<{ url }>
//   The returned `url` is stored in the database (Order.slipUrl,
//   ProductMedia.url) and served back to the client as-is.

import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

export interface UploadOptions {
  /** Logical folder name (e.g. "products", "slips"). Becomes a Cloudinary folder. */
  folder: string
  /** Desired filename (extension is preserved, base is randomized to avoid collisions). */
  filename: string
  /** MIME type — used for validation. */
  mimetype: string
}

export interface UploadResult {
  url: string
  /** Storage backend used — useful for logging. */
  backend: 'cloudinary' | 'local'
  /** Cloudinary public_id (when applicable) — needed to delete later. */
  publicId?: string
}

// ---------------------------------------------------------------------------
// Cloudinary backend
// ---------------------------------------------------------------------------

let cloudinary: typeof import('cloudinary').v2 | null = null
let cloudinaryInitialized = false

async function getCloudinary() {
  if (cloudinaryInitialized) return cloudinary
  cloudinaryInitialized = true

  const url = process.env.CLOUDINARY_URL
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!url && !(cloudName && apiKey && apiSecret)) {
    return null // Cloudinary not configured
  }

  const mod = await import('cloudinary')
  cloudinary = mod.v2
  cloudinary.config(
    url
      ? { secure: true }
      : { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true }
  )
  return cloudinary
}

async function uploadToCloudinary(
  buffer: Buffer,
  opts: UploadOptions
): Promise<UploadResult> {
  const cld = await getCloudinary()
  if (!cld) throw new Error('Cloudinary not configured')

  // Random public_id to prevent collisions + path traversal.
  const ext = path.extname(opts.filename).toLowerCase() || ''
  const publicId = `${opts.folder}/${crypto.randomBytes(8).toString('hex')}`

  // Cloudinary's uploader accepts a base64 data URI for binary content
  // (works in serverless envs without filesystem access).
  const dataUri = `data:${opts.mimetype};base64,${buffer.toString('base64')}`

  const result = await cld.uploader.upload(dataUri, {
    public_id: publicId,
    resource_type: opts.mimetype.startsWith('video/') ? 'video' : 'image',
    // Drop the file extension from the public_id — Cloudinary appends it
    // automatically based on the derived format.
    overwrite: false,
  })

  return {
    url: result.secure_url,
    backend: 'cloudinary',
    publicId: result.public_id,
  }
}

// ---------------------------------------------------------------------------
// Local filesystem backend (dev fallback)
// ---------------------------------------------------------------------------

async function uploadToLocal(
  buffer: Buffer,
  opts: UploadOptions
): Promise<UploadResult> {
  const outDir = path.join(process.cwd(), 'public', 'uploads', opts.folder)
  await mkdir(outDir, { recursive: true })

  const ext = path.extname(opts.filename).toLowerCase() || ''
  const name = crypto.randomBytes(8).toString('hex') + ext
  await writeFile(path.join(outDir, name), buffer)

  return {
    url: `/uploads/${opts.folder}/${name}`,
    backend: 'local',
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload a file to persistent storage. Backend is auto-selected based on
 * environment variables (Cloudinary in production, local FS in dev).
 *
 * @param buffer  File contents as a Node Buffer.
 * @param opts    Upload metadata (folder, filename, mimetype).
 * @returns       { url, backend } — the URL to persist in the database.
 */
export async function uploadFile(
  buffer: Buffer,
  opts: UploadOptions
): Promise<UploadResult> {
  // Try Cloudinary first (production path).
  if (process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME) {
    try {
      return await uploadToCloudinary(buffer, opts)
    } catch (err) {
      // If Cloudinary fails mid-upload (network blip, bad creds), log
      // and fall back to local FS — better than failing the whole request.
      console.error('[storage] Cloudinary upload failed, falling back to local:', err)
    }
  }
  // Dev fallback — local filesystem.
  return uploadToLocal(buffer, opts)
}

/**
 * Check if persistent cloud storage is configured. Useful for surfacing a
 * warning in the admin UI when uploads are landing on the local FS (which
 * will be lost on serverless deploys).
 */
export function isCloudStorageConfigured(): boolean {
  return !!(process.env.CLOUDINARY_URL || process.env.CLOUDINARY_CLOUD_NAME)
}
