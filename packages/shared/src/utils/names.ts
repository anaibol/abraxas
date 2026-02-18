export const RANDOM_NAMES = [
  "Aeric", "Baldur", "Cedric", "Drustan", "Elara", 
  "Fenris", "Gethin", "Hestia", "Iona", "Jarek",
  "Kaelen", "Lyra", "Myra", "Niviane", "Orin", 
  "Phelan", "Rhiannon", "Soren", "Thalia", "Ulric",
  "Valerius", "Wynter", "Xander", "Yvaine", "Zephyr",
  "Arcturus", "Beren", "Caspian", "Dante", "Elowen",
  "Freyja", "Gideon", "Hadrian", "Isolde", "Jasper",
  "Kaelthas", "Luthien", "Morgause", "Nimue", "Oberon",
  "Percival", "Quentin", "Rowan", "Silas", "Tristan",
  "Uther", "Vaughan", "Wulfric", "Xerxes", "Yorick", "Zoltan"
];

export function getRandomName(): string {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}
