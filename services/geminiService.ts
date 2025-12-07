// Servicio local de comentarios "Arcade Style"
// Ya no utiliza IA externa, sino una base de datos local de respuestas.

const COMMENTS = {
  low: [
    "Glitch in the matrix? That was terrible.",
    "My grandmother processes faster than you.",
    "Insert coin... oh wait, you have no skill.",
    "System error: User competence not found.",
    "Try opening your eyes next time."
  ],
  medium: [
    "Acceptable. For a biological entity.",
    "System optimization required. Keep practicing.",
    "Not completely embarrassing.",
    "You survived. Barely.",
    "Mediocrity achieved. Congratulations."
  ],
  high: [
    "System overload! High score detected.",
    "You are worthy of the neon realm.",
    "Don't let the pixels go to your head.",
    "Impressive efficiency.",
    "You have synced with the machine."
  ]
};

export const generateGameCommentary = async (score: number): Promise<string> => {
  // Simulamos una pequeña latencia para "efecto" de procesamiento
  await new Promise(resolve => setTimeout(resolve, 300));

  let pool: string[] = [];

  if (score < 5) {
    pool = COMMENTS.low;
  } else if (score < 15) {
    pool = COMMENTS.medium;
  } else {
    pool = COMMENTS.high;
  }

  const randomIndex = Math.floor(Math.random() * pool.length);
  return pool[randomIndex];
};