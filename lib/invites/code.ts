// Alphabet deliberately excludes ambiguous characters (0/O, 1/I/L) so a
// shareable code like "7F3K-9QXR" can be read aloud without confusion.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const SEGMENT_LENGTH = 4;

function pickSegment(): string {
  let segment = "";
  for (let i = 0; i < SEGMENT_LENGTH; i++) {
    const index = Math.floor(Math.random() * CODE_ALPHABET.length);
    segment += CODE_ALPHABET[index];
  }
  return segment;
}

export function generateInviteCode(): string {
  return `${pickSegment()}-${pickSegment()}`;
}