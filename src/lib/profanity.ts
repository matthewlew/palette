import { Filter } from 'bad-words'

const filter = new Filter()

const BAD_WORDS_REGEX = /f+u+c+k+|s+h+i+t+|b+i+t+c+h+|c+u+n+t+|a+s+s+h+o+l+e+|d+i+c+k+|p+u+s+s+y+|w+h+o+r+e+|s+l+u+t+|f+a+g+g+o+t+|n+i+g+g+e+r+|n+i+g+g+a+/i

export function isProfane(text: string): boolean {
  if (!text) return false
  const normalized = text.replace(/[^a-zA-Z]/g, '').toLowerCase()
  return filter.isProfane(text) || BAD_WORDS_REGEX.test(normalized)
}
