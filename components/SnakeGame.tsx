import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play, RotateCcw, Trophy, BrainCircuit } from 'lucide-react';
import { Coordinate, Direction, GameStatus } from '../types';
import { Controls } from './Controls';
import { generateGameCommentary } from '../services/geminiService';

const GRID_SIZE = 20;
const INITIAL_SPEED = 150;

export const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState<Coordinate[]>([{ x: 10, y: 10 }]);
  const [food, setFood] = useState<Coordinate>({ x: 15, y: 10 });
  const [direction, setDirection] = useState<Direction>(Direction.RIGHT);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [aiCommentary, setAiCommentary] = useState<string>("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Refs for mutable values needed inside the game loop to avoid closure staleness
  const directionRef = useRef<Direction>(Direction.RIGHT);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Handle high score persistence
  useEffect(() => {
    const saved = localStorage.getItem('snake_highscore');
    if (saved) setHighScore(parseInt(saved, 10));
  }, []);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('snake_highscore', score.toString());
    }
  }, [score, highScore]);

  // Generate random food position ensuring it doesn't overlap snake
  const generateFood = useCallback((currentSnake: Coordinate[]): Coordinate => {
    let newFood: Coordinate;
    let isOnSnake = true;
    while (isOnSnake) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      // eslint-disable-next-line no-loop-func
      isOnSnake = currentSnake.some(segment => segment.x === newFood.x && segment.y === newFood.y);
      if (!isOnSnake) return newFood;
    }
    return { x: 0, y: 0 }; // Fallback
  }, []);

  const gameOver = useCallback(async () => {
    if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    setStatus(GameStatus.GAME_OVER);
    
    // Trigger AI Commentary
    setIsAiLoading(true);
    const comment = await generateGameCommentary(score);
    setAiCommentary(comment);
    setIsAiLoading(false);
  }, [score]);

  const resetGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setScore(0);
    setDirection(Direction.RIGHT);
    directionRef.current = Direction.RIGHT;
    setStatus(GameStatus.PLAYING);
    setFood(generateFood([{ x: 10, y: 10 }]));
    setAiCommentary("");
  };

  const handleDirectionChange = useCallback((newDir: Direction) => {
    // Prevent 180 degree turns
    const currentDir = directionRef.current;
    if (newDir === Direction.UP && currentDir === Direction.DOWN) return;
    if (newDir === Direction.DOWN && currentDir === Direction.UP) return;
    if (newDir === Direction.LEFT && currentDir === Direction.RIGHT) return;
    if (newDir === Direction.RIGHT && currentDir === Direction.LEFT) return;
    
    directionRef.current = newDir;
    setDirection(newDir);
  }, []);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp': handleDirectionChange(Direction.UP); break;
        case 'ArrowDown': handleDirectionChange(Direction.DOWN); break;
        case 'ArrowLeft': handleDirectionChange(Direction.LEFT); break;
        case 'ArrowRight': handleDirectionChange(Direction.RIGHT); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleDirectionChange]);

  // Game Loop
  useEffect(() => {
    if (status !== GameStatus.PLAYING) return;

    const moveSnake = () => {
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
          newHead.x < 0 || 
          newHead.x >= GRID_SIZE || 
          newHead.y < 0 || 
          newHead.y >= GRID_SIZE
        ) {
          gameOver();
          return prevSnake;
        }

        // Self Collision
        if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          gameOver();
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Eat Food
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 1);
          setFood(generateFood(newSnake));
          // Don't pop tail to grow
        } else {
          newSnake.pop(); // Remove tail
        }

        return newSnake;
      });
    };

    gameLoopRef.current = setInterval(moveSnake, Math.max(50, INITIAL_SPEED - (score * 2)));

    return () => {
      if (gameLoopRef.current) clearInterval(gameLoopRef.current);
    };
  }, [status, food, score, generateFood, gameOver]);


  return (
    <div className="flex flex-col items-center w-full max-w-lg mx-auto p-4">
      
      {/* Score Board */}
      <div className="flex justify-between w-full mb-4 bg-gray-800 p-4 rounded-xl border border-gray-700 shadow-xl">
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
                index === 0 ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)] z-10' : 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]'
              }`}
              style={{
                left: `${(segment.x / GRID_SIZE) * 100}%`,
                top: `${(segment.y / GRID_SIZE) * 100}%`,
                width: `${100 / GRID_SIZE}%`,
                height: `${100 / GRID_SIZE}%`,
                opacity: Math.max(0.3, 1 - index / (snake.length + 5)) // Fade tail
              }}
            />
          ))}
        </div>

        {/* Overlays */}
        {status === GameStatus.IDLE && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm z-20">
              <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 mb-6 drop-shadow-lg">
                NEON SNAKE
              </h1>
              <button 
                onClick={resetGame}
                className="group flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-8 rounded-full transition-all transform hover:scale-105 shadow-[0_0_20px_rgba(8,145,178,0.5)]"
              >
                <Play className="fill-current" /> START GAME
              </button>
           </div>
        )}

        {status === GameStatus.GAME_OVER && (
           <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-20 p-6 text-center">
              <h2 className="text-4xl font-bold text-red-500 mb-2 font-mono glitch-text">GAME OVER</h2>
              <p className="text-gray-300 mb-6">Final Score: <span className="text-white font-bold">{score}</span></p>
              
              {/* AI Commentary Section */}
              <div className="w-full bg-gray-800/80 rounded-lg p-4 mb-6 border border-purple-500/30 min-h-[100px] flex flex-col items-center justify-center">
                <div className="flex items-center gap-2 text-purple-400 text-sm font-bold tracking-wider mb-2">
                   <BrainCircuit size={16} /> AI COMMENTARY
                </div>
                {isAiLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 animate-pulse">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
                    <span className="text-xs">Processing failure...</span>
                  </div>
                ) : (
                  <p className="text-purple-100 italic text-sm md:text-base">"{aiCommentary}"</p>
                )}
              </div>

              <button 
                onClick={resetGame}
                className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-8 rounded-full transition-colors border border-gray-500"
              >
                <RotateCcw size={20} /> TRY AGAIN
              </button>
           </div>
        )}
      </div>

      {/* Mobile Controls */}
      <div className="md:hidden w-full">
         <Controls onDirectionChange={handleDirectionChange} />
      </div>

      {/* Desktop Hints */}
      <div className="hidden md:block mt-6 text-gray-500 text-sm text-center">
        Use <span className="text-gray-300 font-bold bg-gray-800 px-2 py-1 rounded mx-1">Arrow Keys</span> to move
      </div>

    </div>
  );
};