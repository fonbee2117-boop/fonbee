
import React, { useState, useEffect } from 'react';
import { GameState, PlayerStats, Settings } from './types';
import { INITIAL_PLAYER_STATS } from './constants';
import GameCanvas from './components/GameCanvas';
import MainMenu from './components/MainMenu';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  
  // Persistent State
  const [totalMoney, setTotalMoney] = useState(0);
  const [upgrades, setUpgrades] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<Settings>({ soundEnabled: true, musicEnabled: true });

  // Session State
  const [playerStats, setPlayerStats] = useState<PlayerStats>({
      ...INITIAL_PLAYER_STATS,
      xp: 0,
      maxXp: 100,
      level: 1,
      money: 0,
      wave: 1
  });

  // Apply HP upgrade on start
  useEffect(() => {
     if (gameState === GameState.PLAYING && playerStats.wave === 1 && playerStats.level === 1) {
         const hpMult = 1 + (upgrades['upg_hp'] || 0) * 0.1;
         setPlayerStats(prev => ({
             ...prev,
             maxHp: INITIAL_PLAYER_STATS.maxHp * hpMult,
             hp: INITIAL_PLAYER_STATS.maxHp * hpMult
         }));
     }
  }, [gameState]);

  const handleBuyUpgrade = (id: string, cost: number) => {
      if (totalMoney >= cost) {
          setTotalMoney(prev => prev - cost);
          setUpgrades(prev => ({
              ...prev,
              [id]: (prev[id] || 0) + 1
          }));
      }
  };

  const handleStartGame = () => {
      setPlayerStats({
        ...INITIAL_PLAYER_STATS,
        xp: 0,
        maxXp: 100,
        level: 1,
        money: 0,
        wave: 1
      });
      setGameState(GameState.PLAYING);
  };

  const handleGameOver = () => {
      setGameState(GameState.GAME_OVER);
      setTotalMoney(prev => prev + playerStats.money);
  };

  const handleVictory = () => {
      setGameState(GameState.VICTORY);
      setTotalMoney(prev => prev + playerStats.money + 5000); // Bonus
  };

  return (
    <div className="w-full h-screen overflow-hidden font-sans select-none">
      {gameState === GameState.MENU && (
          <MainMenu 
            money={totalMoney} 
            upgrades={upgrades} 
            onBuyUpgrade={handleBuyUpgrade}
            onStartGame={handleStartGame}
            settings={settings}
            onToggleSound={() => setSettings(s => ({...s, soundEnabled: !s.soundEnabled}))}
          />
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.LEVEL_UP) && (
          <GameCanvas 
            gameState={gameState}
            setGameState={setGameState}
            playerStats={playerStats}
            setPlayerStats={setPlayerStats}
            upgrades={upgrades}
            settings={settings}
            onGameOver={handleGameOver}
            onVictory={handleVictory}
          />
      )}

      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center text-white z-50 animate-in fade-in duration-500">
              <h1 className="text-8xl font-black mb-4 drop-shadow-lg">DEFEAT</h1>
              <p className="text-2xl mb-8 opacity-80">The carrier has been sunk.</p>
              <div className="text-4xl font-mono mb-12 bg-black/30 p-4 rounded">Earned: ${playerStats.money}</div>
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="px-12 py-6 bg-white text-red-900 font-bold text-xl rounded shadow-xl hover:scale-105 transition"
              >
                  RETURN TO BASE
              </button>
          </div>
      )}

      {gameState === GameState.VICTORY && (
          <div className="absolute inset-0 bg-yellow-600/90 flex flex-col items-center justify-center text-white z-50 animate-in fade-in duration-500">
              <h1 className="text-8xl font-black mb-4 drop-shadow-lg">VICTORY</h1>
              <p className="text-2xl mb-8 opacity-80">Enemy fleet neutralized.</p>
              <div className="text-4xl font-mono mb-12 bg-black/30 p-4 rounded">
                  Earned: ${playerStats.money} <span className="text-green-300 text-sm block text-center">+ $5000 Mission Bonus</span>
              </div>
              <button 
                onClick={() => setGameState(GameState.MENU)}
                className="px-12 py-6 bg-white text-yellow-600 font-bold text-xl rounded shadow-xl hover:scale-105 transition"
              >
                  RETURN TO BASE
              </button>
          </div>
      )}
    </div>
  );
};

export default App;
