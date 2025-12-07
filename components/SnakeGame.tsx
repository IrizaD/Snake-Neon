import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, Trophy, Terminal, Brain, Zap, FastForward } from 'lucide-react';
import { Coordinate, Direction, GameStatus, GameMode, QTable } from '../types';
import { Controls } from './Controls';
import { generateGameCommentary } from '../services/geminiService';

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;
const AI_SPEED = 30; // Muy rápido para entrenar

// AI Hyperparameters
const ALPHA = 0.1; // Learning Rate
const GAMMA = 0.9; // Discount Factor
const EPSILON_DECAY = 0.995; // Reduce randomness over time

export const SnakeGame: React.FC = () => {
  // Game State
  const [snake, setSnake] = useState<Coordinate[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Coordinate>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>(Direction.RIGHT);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [commentary, setCommentary] = useState<string>("");
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.MANUAL);
  
  // AI Stats
  const [episode, setEpisode] = useState(0);
  const [epsilon, setEpsilon] = useState(1.0); // 1.0 = 100% random moves initially
  const [aiBestScore, setAiBestScore] = useState(0);

  // Refs
  const directionRef = useRef<Direction>(Direction.RIGHT);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qTableRef = useRef<QTable>({});
  
  // Refs para estado instantáneo (necesario para el loop de IA síncrono)
  const snakeRef = useRef<Coordinate[]>([{ x: 10, y: 10 }]);
  const foodRef = useRef<Coordinate>({ x: 15, y: 10 });
  const scoreRef = useRef(0);

  // Handle high score persistence
  useEffect(() => {
    const saved = localStorage.getItem('snake_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
    
    // Load existing brain if any (optional, keeping it fresh for "watching it learn")
    const savedQ = localStorage.getItem('snake_brain');
    if (savedQ) {
       try {
         qTableRef.current = JSON.parse(savedQ);
         // If we load a brain, start with low epsilon
         setEpsilon(0.1); 
       } catch (e) {
         console.error("Brain damage", e);
       }
    }
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake_highscore', score.toString());
    }
    if (gameMode === GameMode.AI_TRAINING && score > aiBestScore) {
      setAiBestScore(score);
    }
  }, [score, highScore, gameMode, aiBestScore]);

  // Sync Refs with State
  useEffect(() => {
    snakeRef.current = snake;
    foodRef.current = food;
    scoreRef.current = score;
  }, [snake, food, score]);

  // Generate random food
  const generateFood = useCallback((currentSnake: Coordinate[]): Coordinate => {
    let newFood: Coordinate;
    let isOnSnake = true;
    let attempts = 0;
    while (isOnSnake && attempts < 100) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isOnSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!isOnSnake) return newFood;
      attempts++;
    }
    // Fallback if grid is full
    return { x: 0, y: 0 }; 
  }, []);

  // --- AI LOGIC START ---

  const getRelativeState = (head: Coordinate, food: Coordinate, snakeBody: Coordinate[], dir: Direction) => {
    // Definir direcciones relativas: Izquierda, Frente, Derecha
    const directions = [Direction.UP, Direction.RIGHT, Direction.DOWN, Direction.LEFT];
    const idx = directions.indexOf(dir);
    
    const leftDir = directions[(idx + 3) % 4];
    const rightDir = directions[(idx + 1) % 4];
    const straightDir = dir;

    const isCollision = (pt: Coordinate) => {
      return pt.x < 0 || pt.x >= GRID_SIZE || pt.y < 0 || pt.y >= GRID_SIZE || 
             snakeBody.some(s => s.x === pt.x && s.y === pt.y);
    };

    const movePoint = (pt: Coordinate, d: Direction) => {
      if (d === Direction.UP) return { x: pt.x, y: pt.y - 1 };
      if (d === Direction.DOWN) return { x: pt.x, y: pt.y + 1 };
      if (d === Direction.LEFT) return { x: pt.x - 1, y: pt.y };
      return { x: pt.x + 1, y: pt.y }; // RIGHT
    };

    const dangerLeft = isCollision(movePoint(head, leftDir));
    const dangerStraight = isCollision(movePoint(head, straightDir));
    const dangerRight = isCollision(movePoint(head, rightDir));

    // Dirección de la comida relativa
    const foodLeft = food.x < head.x; // Simplificado
    const foodRight = food.x > head.x;
    const foodUp = food.y < head.y;
    const foodDown = food.y > head.y;

    // Estado como string para la Q-Table
    return [
      dangerLeft ? 1 : 0,
      dangerStraight ? 1 : 0,
      dangerRight ? 1 : 0,
      dir === Direction.LEFT ? 1 : 0,
      dir === Direction.RIGHT ? 1 : 0,
      dir === Direction.UP ? 1 : 0,
      dir === Direction.DOWN ? 1 : 0,
      foodLeft ? 1 : 0,
      foodRight ? 1 : 0,
      foodUp ? 1 : 0,
      foodDown ? 1 : 0
    ].join("");
  };

  const getReward = (oldDist: number, newDist: number, dead: boolean, ate: boolean) => {
    if (dead) return -100; // Gran castigo por morir
    if (ate) return 10; // Gran premio por comer
    if (newDist < oldDist) return 1; // Premio pequeño por acercarse
    return -2; // Castigo pequeño por alejarse (o perder tiempo)
  };

  const aiStep = () => {
    const currentHead = snakeRef.current[0];
    const currentFood = foodRef.current;
    const currentSnake = snakeRef.current;
    const currentDir = directionRef.current;

    // 1. Obtener estado actual
    const stateOld = getRelativeState(currentHead, currentFood, currentSnake, currentDir);

    // 2. Elegir acción (Epsilon-Greedy)
    const possibleMoves = [Direction.UP, Direction.DOWN, Direction.LEFT, Direction.RIGHT];
    // Filtrar movimiento opuesto (ilegal en Snake)
    const validMoves = possibleMoves.filter(m => {
        if (currentDir === Direction.UP && m === Direction.DOWN) return false;
        if (currentDir === Direction.DOWN && m === Direction.UP) return false;
        if (currentDir === Direction.LEFT && m === Direction.RIGHT) return false;
        if (currentDir === Direction.RIGHT && m === Direction.LEFT) return false;
        return true;
    });

    let nextMove: Direction;
    
    // Exploración vs Explotación
    if (Math.random() < epsilon) {
       nextMove = validMoves[Math.floor(Math.random() * validMoves.length)];
    } else {
       // Consultar tabla Q
       if (!qTableRef.current[stateOld]) {
         qTableRef.current[stateOld] = {};
       }
       // Encontrar la acción con mejor Q-value
       let maxQ = -Infinity;
       let bestAction = validMoves[Math.floor(Math.random() * validMoves.length)]; // Default random si empate
       
       validMoves.forEach(move => {
          const qVal = qTableRef.current[stateOld][move] || 0;
          if (qVal > maxQ) {
            maxQ = qVal;
            bestAction = move;
          }
       });
       nextMove = bestAction;
    }

    // 3. Ejecutar acción (Simular movimiento para calcular recompensa)
    let newHead = { ...currentHead };
    switch (nextMove) {
      case Direction.UP: newHead.y -= 1; break;
      case Direction.DOWN: newHead.y += 1; break;
      case Direction.LEFT: newHead.x -= 1; break;
      case Direction.RIGHT: newHead.x += 1; break;
    }

    // Calcular distancias
    const oldDist = Math.abs(currentHead.x - currentFood.x) + Math.abs(currentHead.y - currentFood.y);
    const newDist = Math.abs(newHead.x - currentFood.x) + Math.abs(newHead.y - currentFood.y);

    // Verificar colisiones
    let dead = false;
    let ate = false;

    if (
      newHead.x < 0 || newHead.x >= GRID_SIZE || 
      newHead.y < 0 || newHead.y >= GRID_SIZE ||
      currentSnake.some(s => s.x === newHead.x && s.y === newHead.y)
    ) {
      dead = true;
    } else if (newHead.x === currentFood.x && newHead.y === currentFood.y) {
      ate = true;
    }

    // 4. Calcular recompensa
    const reward = getReward(oldDist, newDist, dead, ate);

    // 5. Actualizar Q-Value (Aprendizaje)
    // Necesitamos el maxQ del nuevo estado
    const stateNew = getRelativeState(newHead, currentFood, dead ? currentSnake : [newHead, ...currentSnake], nextMove);
    
    if (!qTableRef.current[stateOld]) qTableRef.current[stateOld] = {};
    if (!qTableRef.current[stateNew]) qTableRef.current[stateNew] = {};

    const oldQ = qTableRef.current[stateOld][nextMove] || 0;
    
    // Max Q para el estado futuro
    let maxFutureQ = -Infinity;
    // Si murió, el futuro es 0 (o malo), pero asumimos 0 para terminal
    if (dead) {
      maxFutureQ = 0;
    } else {
       Object.values(qTableRef.current[stateNew]).forEach(v => {
         if (v > maxFutureQ) maxFutureQ = v;
       });
       if (maxFutureQ === -Infinity) maxFutureQ = 0;
    }

    // Ecuación de Bellman
    const newQ = oldQ + ALPHA * (reward + GAMMA * maxFutureQ - oldQ);
    qTableRef.current[stateOld][nextMove] = newQ;

    // 6. Actualizar estado real del juego
    directionRef.current = nextMove;
    setDirection(nextMove); // Para la UI
    
    if (dead) {
       // Reinicio rápido para IA
       setEpisode(e => e + 1);
       if (epsilon > 0.01) setEpsilon(e => e * EPSILON_DECAY);
       
       // Reset game state immediately without waiting for 'Game Over' screen
       const resetSnk = [{ x: 10, y: 10 }];
       setSnake(resetSnk);
       snakeRef.current = resetSnk;
       setDirection(Direction.RIGHT);
       directionRef.current = Direction.RIGHT;
       setScore(0);
       scoreRef.current = 0;
       const newF = generateFood(resetSnk);
       setFood(newF);
       foodRef.current = newF;
       
       // Save brain occasionally
       if (episode % 50 === 0) {
         localStorage.setItem('snake_brain', JSON.stringify(qTableRef.current));
       }
    } else {
       // Move Logic (Duplicated slightly from render loop but needed for sync AI)
       const newSnakeArr = [newHead, ...currentSnake];
       if (ate) {
         setScore(s => s + 1);
         scoreRef.current += 1;
         const f = generateFood(newSnakeArr);
         setFood(f);
         foodRef.current = f;
       } else {
         newSnakeArr.pop();
       }
       setSnake(newSnakeArr);
       snakeRef.current = newSnakeArr;
    }
  };

  // --- AI LOGIC END ---

  const gameOver = useCallback(async () => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    setStatus(GameStatus.GAME_OVER);
    
    // Get Local Commentary
    const comment = await generateGameCommentary(score);
    setCommentary(comment);
  }, [score]);

  const resetGame = (mode: GameMode = GameMode.MANUAL) => {
    setSnake([{ x: 10, y: 10 }]);
    snakeRef.current = [{ x: 10, y: 10 }];
    setScore(0);
    setDirection(Direction.RIGHT);
    directionRef.current = Direction.RIGHT;
    setStatus(GameStatus.PLAYING);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setCommentary("");
    setGameMode(mode);
    
    if (mode === GameMode.MANUAL) {
        // Reset AI stats visuals if manual
    } else {
        // AI keeps training stats
    }
  };

  const handleDirectionChange = useCallback((newDir: Direction) => {
    if (gameMode === GameMode.AI_TRAINING) return; // Disable user controls in AI mode

    // Prevent 180 degree turns
    const currentDir = directionRef.current;
    if (newDir === Direction.UP && currentDir === Direction.DOWN) return;
    if (newDir === Direction.DOWN && currentDir === Direction.UP) return;
    if (newDir === Direction.LEFT && currentDir === Direction.RIGHT) return;
    if (newDir === Direction.RIGHT && currentDir === Direction.LEFT) return;
    
    directionRef.current = newDir;
    setDirection(newDir);
  }, [gameMode]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameMode === GameMode.AI_TRAINING) return;
      switch (e.key) {
        case 'ArrowUp': handleDirectionChange(Direction.UP); break;
        case 'ArrowDown': handleDirectionChange(Direction.DOWN); break;
        case 'ArrowLeft': handleDirectionChange(Direction.LEFT); break;
        case 'ArrowRight': handleDirectionChange(Direction.RIGHT); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDirectionChange, gameMode]);

  // Game Loop
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;

    const tick = () => {
      if (gameMode === GameMode.AI_TRAINING) {
        aiStep();
        return;
      }

      // Manual Logic
      setSnake(prevSnake => {
        const head = prevSnake[0];
        const currentDir = directionRef.current;
        const newHead = { ...head };

        switch (currentDir) {
          case Direction.UP: newHead.y -= 1; break;
          case Direction.DOWN: newHead.y += 1; break;
          case Direction.LEFT: newHead.x -= 1; break;
          case Direction.RIGHT: newHead.x += 1; break;
        }

        // Wall Collision
        if (
          newHead.x < 0 || newHead.x >= GRID_SIZE || 
          newHead.y < 0 || newHead.y >= GRID_SIZE ||
          prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)
        ) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 1);
          setFood(generateFood(newSnake));
        } else {
          newSnake.pop();
        }

        return newSnake;
      });
    };

    const speed = gameMode === GameMode.AI_TRAINING ? AI_SPEED : Math.max(50, INITIAL_SPEED - (score * 2));
    gameLoopRef.current = setInterval(tick, speed);

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [status, food, score, generateFood, gameOver, gameMode, epsilon]); // Added epsilon dependency for AI updates


  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto p-4">
      
      {/* Score Board & Mode Toggle */}
      <div className="w-full mb-4 flex flex-col gap-2">
        <div className="flex justify-between w-full bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-xl">
          <div className="flex flex-col">
              <span className="text-gray-400 text-xs uppercase tracking-widest">Score</span>
              <span className="text-3xl font-bold text-cyan-400 font-mono">{score.toString().padStart(3, '0')}</span>
          </div>
          <div className="flex flex-col items-end">
              <span className="text-gray-400 text-xs uppercase tracking-widest flex items-center gap-1">
                  <Trophy size={12} className="text-yellow-500"/> Best
              </span>
              <span className="text-3xl font-bold text-yellow-500 font-mono">{highScore.toString().padStart(3, '0')}</span>
          </div>
        </div>

        {/* AI Stats Panel */}
        {gameMode === GameMode.AI_TRAINING && (
          <div className="grid grid-cols-3 gap-2 bg-gray-900/50 p-2 rounded-lg border border-purple-500/30">
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-gray-500 uppercase">Generation</span>
               <span className="font-mono text-purple-400 font-bold">{episode}</span>
             </div>
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-gray-500 uppercase">Exploration</span>
               <span className="font-mono text-blue-400 font-bold">{(epsilon * 100).toFixed(1)}%</span>
             </div>
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-gray-500 uppercase">AI Best</span>
               <span className="font-mono text-green-400 font-bold">{aiBestScore}</span>
             </div>
          </div>
        )}
      </div>

      {/* Game Area */}
      <div className="relative bg-gray-900 border-4 border-gray-700 rounded-lg shadow-2xl overflow-hidden touch-none"
           style={{
             width: '100%',
             aspectRatio: '1/1',
             maxWidth: '400px'
           }}>
        
        {/* Grid Background */}
        <div 
          className="absolute inset-0 grid" 
          style={{ 
            gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` 
          }}
        >
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => (
             <div key={i} className="border-[0.5px] border-gray-800/50" />
          ))}
        </div>

        {/* Snake & Food Layer */}
        <div 
           className="absolute inset-0"
           style={{
             position: 'relative',
             width: '100%',
             height: '100%',
           }}
        >
          {/* Food */}
          <div
            className="absolute bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"
            style={{
              left: `${(food.x / GRID_SIZE) * 100}%`,
              top: `${(food.y / GRID_SIZE) * 100}%`,
              width: `${100 / GRID_SIZE}%`,
              height: `${100 / GRID_SIZE}%`,
            }}
          />

          {/* Snake */}
          {snake.map((segment, index) => (
            <div
              key={`${segment.x}-${segment.y}-${index}`}
              className={`absolute rounded-sm transition-all duration-75 ${
                index === 0 
                  ? gameMode === GameMode.AI_TRAINING ? 'bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.8)] z-10' : 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10'
                  : gameMode === GameMode.AI_TRAINING ? 'bg-pink-600/70' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'
              }`}
              style={{
                left: `${(segment.x / GRID_SIZE) * 100}%`,
                top: `${(segment.y / GRID_SIZE) * 100}%`,
                width: `${100 / GRID_SIZE}%`,
                height: `${100 / GRID_SIZE}%`,
              }}
            />
          ))}
        </div>

        {/* Overlays */}
        {status === GameStatus.IDLE && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20 gap-4 p-4">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-2 drop-shadow-lg text-center">
                NEON SNAKE
              </h1>
              
              <button 
                onClick={() => resetGame(GameMode.MANUAL)}
                className="w-full max-w-xs group flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(8,145,178,0.5)]"
              >
                <Play className="fill-current" /> PLAY MANUAL
              </button>

              <button 
                onClick={() => resetGame(GameMode.AI_TRAINING)}
                className="w-full max-w-xs group flex items-center justify-center gap-2 bg-purple-700 hover:bg-purple-600 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(147,51,234,0.5)]"
              >
                <Brain className="fill-current" /> TRAIN AI AGENT
              </button>
              
              <p className="text-gray-400 text-xs mt-2 text-center max-w-[250px]">
                Watch the Neural Network learn from its mistakes in real-time.
              </p>
           </div>
        )}

        {status === GameStatus.GAME_OVER && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-20 p-6 text-center">
              <h2 className="text-4xl font-bold text-red-500 mb-2 font-mono glitch-text">GAME OVER</h2>
              <p className="text-gray-300 mb-6">Final Score: <span className="text-white font-bold">{score}</span></p>
              
              {/* Commentary Section */}
              <div className="w-full bg-gray-800/80 rounded-lg p-4 mb-6 border border-purple-500/30 min-h-[100px] flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 text-purple-400 text-sm font-bold tracking-wider mb-2">
                   <Terminal size={16} /> SYSTEM LOG
                </div>
                <p className="text-purple-100 italic text-sm md:text-base">"{commentary}"</p>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-xs">
                <button 
                  onClick={() => resetGame(GameMode.MANUAL)}
                  className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full transition-colors border border-gray-500"
                >
                  <RotateCcw size={20} /> TRY MANUAL AGAIN
                </button>
                <button 
                  onClick={() => resetGame(GameMode.AI_TRAINING)}
                  className="flex items-center justify-center gap-2 bg-purple-900/50 hover:bg-purple-800 text-purple-200 font-bold py-3 px-8 rounded-full transition-colors border border-purple-700"
                >
                  <Zap size={20} /> LET AI TRY
                </button>
              </div>
           </div>
        )}
      </div>

      {/* Manual Controls Hints */}
      {gameMode === GameMode.MANUAL ? (
        <>
          <div className="md:hidden w-full">
             <Controls onDirectionChange={handleDirectionChange} />
          </div>
          <div className="hidden md:block mt-6 text-gray-500 text-sm text-center">
            Use <span className="text-gray-300 font-bold bg-gray-800 px-2 py-1 rounded mx-1">Arrow Keys</span> to move
          </div>
        </>
      ) : (
        <div className="mt-6 flex flex-col items-center gap-2 text-center animate-pulse">
           <div className="flex items-center gap-2 text-purple-400 font-bold">
             <FastForward /> TRAINING IN PROGRESS
           </div>
           <p className="text-xs text-gray-500 max-w-xs">
             The AI is exploring the grid. It gets rewarded for eating and punished for dying. Over time, "Exploration" drops and it uses its learned memory.
           </p>
           <button 
             onClick={() => setStatus(GameStatus.IDLE)} 
             className="mt-2 text-xs text-red-400 border border-red-900/50 px-3 py-1 rounded hover:bg-red-900/20"
           >
             STOP TRAINING
           </button>
        </div>
      )}

    </div>
  );
};