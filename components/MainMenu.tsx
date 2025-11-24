
import React from 'react';
import { UPGRADES_LIST } from '../constants';

interface MainMenuProps {
  money: number;
  upgrades: Record<string, number>;
  onBuyUpgrade: (id: string, cost: number) => void;
  onStartGame: () => void;
  settings: { soundEnabled: boolean; musicEnabled: boolean };
  onToggleSound: () => void;
}

const MainMenu: React.FC<MainMenuProps> = ({ money, upgrades, onBuyUpgrade, onStartGame, settings, onToggleSound }) => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white">
      <h1 className="text-6xl font-black mb-4 text-blue-500 tracking-tighter shadow-blue-500/50 drop-shadow-lg">
        NAVAL DEFENSE 1942
      </h1>
      <p className="text-slate-400 mb-8 text-xl">Protect the Carrier. Rule the Waves.</p>
      
      <div className="flex gap-12 w-full max-w-6xl h-[600px]">
         {/* Upgrade Shop */}
         <div className="flex-1 bg-slate-800/50 p-6 rounded-xl border border-slate-700 overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-800/90 p-2 z-10">
                <h2 className="text-2xl font-bold text-yellow-400">Dockyard Upgrades</h2>
                <div className="text-xl font-mono bg-slate-900 px-4 py-2 rounded text-green-400 border border-green-900">
                    $ {money}
                </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                {UPGRADES_LIST.map(u => {
                    const level = upgrades[u.id] || 0;
                    const cost = Math.floor(u.baseCost * Math.pow(1.2, level)); // Easier scaling
                    const canAfford = money >= cost;

                    return (
                        <div key={u.id} className="bg-slate-900 p-4 rounded border border-slate-700 flex flex-col justify-between hover:bg-slate-800/80 transition">
                            <div className="mb-2">
                                <div className="font-bold text-blue-200">{u.name}</div>
                                <div className="text-xs text-slate-400">Current Level: {level}</div>
                            </div>
                            <button 
                                onClick={() => onBuyUpgrade(u.id, cost)}
                                disabled={!canAfford}
                                className={`w-full py-2 rounded font-bold text-sm transition ${canAfford ? 'bg-yellow-600 hover:bg-yellow-500 text-white shadow-lg' : 'bg-gray-700 text-gray-500 cursor-not-allowed'}`}
                            >
                                Upgrade ${cost}
                            </button>
                        </div>
                    );
                })}
            </div>
         </div>

         {/* Start Panel */}
         <div className="w-1/3 flex flex-col gap-6">
             <div className="bg-blue-900/20 p-6 rounded-xl border border-blue-500/30 text-center flex-1 flex flex-col justify-center">
                 <h3 className="text-2xl font-bold mb-4 text-white">Mission Briefing</h3>
                 <p className="text-blue-200 mb-6 leading-relaxed">
                    Survive 20 waves of enemy assaults.<br/>
                    Defeat the <span className="text-red-400 font-bold">Yamato Flagship</span> in the final wave.<br/>
                    Use funds to upgrade your carrier's hull and weaponry.
                 </p>
                 
                 <div className="flex justify-center gap-4 mb-6">
                    <button 
                        onClick={onToggleSound}
                        className={`px-4 py-2 rounded font-bold border ${settings.soundEnabled ? 'bg-green-600 border-green-400' : 'bg-red-600 border-red-400'}`}
                    >
                        Sound: {settings.soundEnabled ? 'ON' : 'OFF'}
                    </button>
                 </div>

                 <button 
                    onClick={onStartGame}
                    className="w-full py-6 bg-blue-600 hover:bg-blue-500 text-white text-3xl font-black rounded-lg shadow-xl shadow-blue-600/20 transition transform hover:scale-105 active:scale-95"
                 >
                    BATTLE STATIONS
                 </button>
             </div>
         </div>
      </div>
    </div>
  );
};

export default MainMenu;
