export const RANDOM_NAMES = [
  "Aeric", "Baldur", "Cedric", "Drustan", "Elara", 
  "Fenris", "Gethin", "Hestia", "Iona", "Jarek",
  "Kaelen"
];

export function getRandomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}
