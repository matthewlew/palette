import { supabase } from './supabase'
import { namePalette } from './naming'

export function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

export async function publishPalette(hexes: string[], shape: string, angle: number = 0) {
  // 1. Generate the base name using your existing engine
  let displayName = namePalette(hexes)
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
      displayName = `${namePalette(hexes)} ${attemptNumber}`
      slug = generateSlug(displayName)
    } else {
      // Some other database error occurred
      throw new Error(`Supabase Error: ${error.message}`)
    }
  }
}
