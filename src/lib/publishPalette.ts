import { supabase } from './supabase'
import { namePalette } from './naming'
import { isProfane } from './profanity'

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function publishPalette(hexes: string[], shape: string, angle: number = 0, providedName?: string) {
  // 1. Use the provided name or generate one using the engine
  let baseName = providedName?.trim() || namePalette(hexes)
  
  // If the provided name contains profanity, fallback to the generated one
  if (isProfane(baseName)) {
    baseName = namePalette(hexes)
  }

  let displayName = baseName
  let slug = generateSlug(displayName)

  let isSaved = false
  let attemptNumber = 1

  while (!isSaved) {
    // 2. Try to insert it into Supabase
    const { error } = await supabase.from('palettes').insert({
      slug: slug,
      display_name: displayName,
      colors: hexes,
      shape: shape,
      angle: angle
    })

    if (!error) {
      // Success! It was totally unique.
      isSaved = true
      return { success: true, slug, displayName }
    } 
    
    // 3. If there is a conflict (slug is already taken)
    // Postgres Unique Violation code is '23505'
    if (error.code === '23505') { 
      attemptNumber++
      // Update the name and slug to include the new number
      displayName = `${baseName} ${attemptNumber}`
      slug = generateSlug(displayName)
    } else {
      // Some other database error occurred
      throw new Error(`Supabase Error: ${error.message}`)
    }
  }
}
