
import React, { useRef, useEffect, useState } from 'react';
import { GameState, Entity, Enemy, Projectile, Particle, PlayerStats, EnemyType, Skill, FriendlyUnit, Point } from '../types';
import { CANVAS_WIDTH, CANVAS_HEIGHT, WAVE_CONFIG, SKILL_DEFINITIONS } from '../constants';
import { soundManager } from '../SoundManager';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  playerStats: PlayerStats;
  setPlayerStats: React.Dispatch<React.SetStateAction<PlayerStats>>;
  upgrades: Record<string, number>;
  settings: { soundEnabled: boolean };
  onGameOver: () => void;
  onVictory: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  gameState,
  setGameState,
  playerStats,
  setPlayerStats,
  upgrades,
  settings,
  onGameOver,
  onVictory
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Game Entities Refs
  const enemies = useRef<Enemy[]>([]);
  const projectiles = useRef<Projectile[]>([]);
  const particles = useRef<Particle[]>([]);
  const friendlies = useRef<FriendlyUnit[]>([]);
  
  // Ref for stats to access latest value in loop without re-binding
  const statsRef = useRef(playerStats);
  useEffect(() => { statsRef.current = playerStats; }, [playerStats]);

  // Cooldowns & State
  const frameCount = useRef(0);
  const remainingEnemiesToSpawn = useRef(0);
  const spawnTimer = useRef(0);
  const bossPhase = useRef(0);
  
  const skills = useRef<Record<string, number>>({
    escort_left: 0,
    escort_right: 0,
    repair: 0,
    fighter: 0,
    bomber: 0,
    rocket: 0
  });

  const weaponCooldowns = useRef<Record<string, number>>({
    mediumLeft: 0,
    mediumRight: 0,
    aa1: 0,
    aa2: 0,
    escortLeftMain: 0,
    escortLeftSmall: 0,
    escortLeftAA: 0,
    escortRightMain: 0,
    escortRightSmall: 0,
    escortRightAA: 0,
    rocket: 0,
    repair: 0,
    fighterSpawn: 0,
    bomberSpawn: 0
  });

  // Level Up State
  const [levelUpOptions, setLevelUpOptions] = useState<{id: string, name: string, desc: string, maxLevel: number}[]>([]);

  // Init Wave Logic
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        soundManager.toggleSound(settings.soundEnabled);
    }
  }, [gameState, settings.soundEnabled]);
  
  // Initialize wave count when wave changes
  useEffect(() => {
      const isBoss = playerStats.wave === WAVE_CONFIG.BOSS_WAVE;
      remainingEnemiesToSpawn.current = isBoss ? 1 : Math.floor(10 + playerStats.wave * 1.5);
      // Reset cooldowns
      spawnTimer.current = 60;
  }, [playerStats.wave]);

  const getMult = (key: string) => 1 + (upgrades[key] || 0) * 0.1;

  // --- DRAWING HELPERS ---

  const getTargetAngle = (cx: number, cy: number, type: 'air' | 'surface'): number => {
      // Find nearest target of type
      let nearest: Entity | null = null;
      let minDst = Infinity;
      
      enemies.current.forEach(e => {
          const isPlane = e.enemyType.includes('PLANE');
          const isSurface = e.enemyType.includes('SHIP') || e.enemyType === 'BOSS';
          
          if ((type === 'air' && isPlane) || (type === 'surface' && isSurface)) {
              const d = (e.x - cx)**2 + (e.y - cy)**2;
              if (d < minDst) {
                  minDst = d;
                  nearest = e;
              }
          }
      });

      if (nearest) {
          // @ts-ignore
          return Math.atan2(nearest.y - cy, nearest.x - cx) - (-Math.PI/2); // Offset for vertical drawing
      }
      return 0; // Default facing up relative to ship rotation
  };

  const drawShipParts = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
    ctx.save();
    ctx.translate(x, y);

    // 1. Runway (Center) - Section 1 to 4 span
    ctx.fillStyle = '#334155';
    ctx.fillRect(-25, -120, 50, 240);
    // Runway stripes
    ctx.strokeStyle = '#e2e8f0';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.lineTo(0, 110);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hull base
    ctx.fillStyle = '#475569';
    // Left side hull
    ctx.beginPath();
    ctx.moveTo(-25, -120);
    ctx.lineTo(-40, -100);
    ctx.lineTo(-40, 100);
    ctx.lineTo(-25, 120);
    ctx.fill();
    // Right side hull
    ctx.beginPath();
    ctx.moveTo(25, -120);
    ctx.lineTo(40, -100);
    ctx.lineTo(40, 100);
    ctx.lineTo(25, 120);
    ctx.fill();

    // 2. Tower (Right Side)
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(30, -30, 20, 60);
    ctx.fillStyle = '#64748b'; // Windows
    ctx.fillRect(35, -25, 10, 10);

    // Calculate targeting angles based on world position
    // AA Guns track planes
    const aaAngleTL = getTargetAngle(x - 35, y - 80, 'air');
    const aaAngleTR = getTargetAngle(x + 35, y - 80, 'air');
    const aaAngleBL = getTargetAngle(x - 35, y + 80, 'air');
    const aaAngleBR = getTargetAngle(x + 35, y + 80, 'air');

    // Medium Guns track ships
    const medAngleL = getTargetAngle(x - 45, y, 'surface');
    const medAngleR = getTargetAngle(x + 45, y + 40, 'surface');

    // 3. AA Guns (Section 1 & 4, L/R) -> 4 points
    drawTurret(ctx, -35, -80, 8, '#94a3b8', aaAngleTL, 'aa');
    drawTurret(ctx, 35, -80, 8, '#94a3b8', aaAngleTR, 'aa');
    drawTurret(ctx, -35, 80, 8, '#94a3b8', aaAngleBL, 'aa');
    drawTurret(ctx, 35, 80, 8, '#94a3b8', aaAngleBR, 'aa');

    // 4. Medium Guns (Section 2 & 4 -> Left/Right Mid)
    drawTurret(ctx, -45, 0, 14, '#64748b', medAngleL, 'medium');
    drawTurret(ctx, 45, 40, 14, '#64748b', medAngleR, 'medium');
    
    // Rear Rocket (Section 4) if skill active
    if (skills.current.rocket > 0) {
        ctx.fillStyle = '#ea580c';
        ctx.fillRect(-10, 100, 20, 20);
    }

    ctx.restore();
  };

  const drawTurret = (ctx: CanvasRenderingContext2D, dx: number, dy: number, size: number, color: string, relativeAngle: number, type: 'aa'|'medium'|'heavy') => {
      ctx.save();
      ctx.translate(dx, dy);
      // Base rotation is -90deg (facing up) so we add relativeAngle
      ctx.rotate(-Math.PI/2 + relativeAngle); 
      
      // Turret Base
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      
      // Barrel
      ctx.fillStyle = '#0f172a';
      // Drawing relative to "facing right" as 0deg after rotation? 
      // Actually standard draw is facing right. 
      // If we rotated by (-PI/2 + angle), then "Right" is the direction of the angle.
      
      if (type === 'aa') {
          // Double barrel AA
          ctx.fillRect(0, -3, size+5, 2);
          ctx.fillRect(0, 1, size+5, 2);
      } else if (type === 'medium') {
          // Single thick barrel
          ctx.fillRect(0, -3, size+10, 6);
          // Breech block
          ctx.fillStyle = '#334155';
          ctx.fillRect(-2, -5, 6, 10);
      } else {
           // Heavy Triple Barrel
          ctx.fillRect(0, -6, size+15, 4);
          ctx.fillRect(0, -2, size+15, 4);
          ctx.fillRect(0, 2, size+15, 4);
      }
      ctx.restore();
  };

  const drawEscort = (ctx: CanvasRenderingContext2D, x: number, y: number, isLeft: boolean, level: number) => {
    ctx.save();
    ctx.translate(x, y);
    // Hull
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.quadraticCurveTo(20, -30, 20, 50);
    ctx.lineTo(0, 60);
    ctx.lineTo(-20, 50);
    ctx.quadraticCurveTo(-20, -30, 0, -60);
    ctx.fill();

    // Targeting
    const aaAngleF = getTargetAngle(x, y - 40, 'air');
    const aaAngleR = getTargetAngle(x, y + 20, 'air');
    const heavyAngleF = getTargetAngle(x, y - 10, 'surface');
    const heavyAngleR = getTargetAngle(x, y + 40, 'surface');

    // 1. Bow: Small Gun (AA function in this context per spec)
    drawTurret(ctx, 0, -40, 6, '#94a3b8', aaAngleF, 'aa');

    // 2. Mid-Top: Heavy Cannon
    drawTurret(ctx, 0, -10, 10, '#1e293b', heavyAngleF, 'heavy');

    // 3. Mid-Bot: AA
    drawTurret(ctx, 0, 20, 6, '#94a3b8', aaAngleR, 'aa'); 

    // 4. Stern: Heavy Cannon
    drawTurret(ctx, 0, 40, 10, '#1e293b', heavyAngleR, 'heavy');

    ctx.restore();
  };

  const drawWW2Plane = (ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, type: 'fighter' | 'bomber', isShadow: boolean, team: 'player' | 'enemy', damagePoints?: Point[]) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle + Math.PI/2); 
      
      // Scaled down: Fighter 0.35, Bomber 0.55
      const scale = type === 'bomber' ? 0.55 : 0.35;
      ctx.scale(scale, scale);

      const baseColor = isShadow ? 'rgba(0,0,0,0.3)' : (team === 'player' ? '#eab308' : (type === 'bomber' ? '#3f6212' : '#064e3b'));
      const markingColor = isShadow ? 'rgba(0,0,0,0)' : '#dc2626'; 
      
      ctx.fillStyle = baseColor;

      if (type === 'fighter') {
          // WWII Fighter Silhouette
          ctx.beginPath();
          ctx.moveTo(0, -25);
          ctx.quadraticCurveTo(5, -10, 5, 10);
          ctx.lineTo(2, 25);
          ctx.lineTo(-2, 25);
          ctx.lineTo(-5, 10);
          ctx.quadraticCurveTo(-5, -10, 0, -25);
          ctx.fill();

          ctx.beginPath();
          ctx.moveTo(4, -5); ctx.lineTo(38, 5); ctx.quadraticCurveTo(40, 10, 38, 15); ctx.lineTo(4, 10); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(-4, -5); ctx.lineTo(-38, 5); ctx.quadraticCurveTo(-40, 10, -38, 15); ctx.lineTo(-4, 10); ctx.fill();

          ctx.beginPath();
          ctx.moveTo(0, 18); ctx.lineTo(14, 24); ctx.lineTo(14, 28); ctx.lineTo(0, 26); ctx.lineTo(-14, 28); ctx.lineTo(-14, 24); ctx.lineTo(0, 18); ctx.fill();

          if (!isShadow) {
              ctx.fillStyle = '#bae6fd'; 
              ctx.beginPath(); ctx.ellipse(0, -5, 3, 6, 0, 0, Math.PI*2); ctx.fill();
              
              if (team === 'enemy') {
                  ctx.fillStyle = markingColor;
                  ctx.beginPath(); ctx.arc(25, 10, 4, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(-25, 10, 4, 0, Math.PI*2); ctx.fill();
              } else {
                  ctx.fillStyle = '#1d4ed8';
                  ctx.beginPath(); ctx.arc(25, 10, 4, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(-25, 10, 4, 0, Math.PI*2); ctx.fill();
                  ctx.fillStyle = '#fff';
                  ctx.beginPath(); ctx.arc(25, 10, 1.5, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(-25, 10, 1.5, 0, Math.PI*2); ctx.fill();
              }
          }
      } else {
          // WWII Medium Bomber
          ctx.beginPath(); ctx.ellipse(0, 5, 7, 40, 0, 0, Math.PI*2); ctx.fill();

          ctx.beginPath(); ctx.moveTo(5, -10); ctx.lineTo(60, 0); ctx.lineTo(60, 15); ctx.lineTo(5, 10); ctx.fill();
          ctx.beginPath(); ctx.moveTo(-5, -10); ctx.lineTo(-60, 0); ctx.lineTo(-60, 15); ctx.lineTo(-5, 10); ctx.fill();

          ctx.fillStyle = isShadow ? baseColor : '#172554';
          ctx.beginPath(); ctx.ellipse(25, 2, 6, 14, 0, 0, Math.PI*2); ctx.fill();
          ctx.beginPath(); ctx.ellipse(-25, 2, 6, 14, 0, 0, Math.PI*2); ctx.fill();

          ctx.fillStyle = baseColor;
          ctx.beginPath(); ctx.moveTo(2, 35); ctx.lineTo(24, 45); ctx.lineTo(-24, 45); ctx.lineTo(-2, 35); ctx.fill();

          if (!isShadow) {
               ctx.fillStyle = '#bae6fd';
               ctx.beginPath(); ctx.arc(0, -32, 5, 0, Math.PI, true); ctx.fill();
               ctx.fillRect(-3, -20, 6, 10); 
               
               if (team === 'enemy') {
                  ctx.fillStyle = markingColor;
                  ctx.beginPath(); ctx.arc(45, 8, 5, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(-45, 8, 5, 0, Math.PI*2); ctx.fill();
               } else {
                  ctx.fillStyle = '#1d4ed8';
                  ctx.beginPath(); ctx.arc(45, 8, 5, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(-45, 8, 5, 0, Math.PI*2); ctx.fill();
                  ctx.fillStyle = '#fff';
                  ctx.beginPath(); ctx.arc(45, 8, 2, 0, Math.PI*2); ctx.fill();
                  ctx.beginPath(); ctx.arc(-45, 8, 2, 0, Math.PI*2); ctx.fill();
               }
          }
      }
      
      if (!isShadow) {
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          if (type === 'fighter') {
             ctx.beginPath(); ctx.arc(0, -28, 12, 0, Math.PI*2); ctx.fill();
          } else {
             ctx.beginPath(); ctx.arc(25, -10, 10, 0, Math.PI*2); ctx.fill();
             ctx.beginPath(); ctx.arc(-25, -10, 10, 0, Math.PI*2); ctx.fill();
          }

          // Render active fires on the plane
          if (damagePoints && damagePoints.length > 0) {
              damagePoints.forEach(p => {
                  const flicker = Math.random() * 0.4 + 0.6;
                  ctx.fillStyle = `rgba(255, ${Math.floor(Math.random()*100)+50}, 0, ${flicker})`;
                  ctx.beginPath(); 
                  ctx.arc(p.x, p.y, 4 + Math.random()*2, 0, Math.PI*2); 
                  ctx.fill();
                  // Inner white hot core
                  ctx.fillStyle = `rgba(255, 255, 200, ${flicker})`;
                  ctx.beginPath(); 
                  ctx.arc(p.x, p.y, 2, 0, Math.PI*2); 
                  ctx.fill();
              });
          }
      }

      ctx.restore();
  };

  const drawEnemyShip = (ctx: CanvasRenderingContext2D, enemy: Enemy) => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.rotation - Math.PI/2); 

      const isMedium = enemy.enemyType === EnemyType.SHIP_MEDIUM;
      const w = enemy.width;
      const h = enemy.height;

      // Hull
      ctx.fillStyle = '#4b5563'; 
      ctx.beginPath();
      ctx.moveTo(0, h/2);
      ctx.quadraticCurveTo(w/2, h/4, w/2, -h/4);
      ctx.lineTo(0, -h/2);
      ctx.lineTo(-w/2, -h/4);
      ctx.quadraticCurveTo(-w/2, h/4, 0, h/2);
      ctx.fill();

      // Deck
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(-w/3, -h/3, w*0.66, h*0.6);

      // Superstructure
      ctx.fillStyle = '#374151';
      ctx.fillRect(-w/4, -h/6, w/2, h/3);

      // Turrets - Enemies don't have dynamic tracking implemented visually yet for simplicity, or we can add it
      // Simple fixed rotation for enemy ships as they mostly face down
      if (isMedium) {
          drawTurret(ctx, 0, -h/3, 8, '#1f2937', 0, 'medium');
          drawTurret(ctx, 0, h/3, 8, '#1f2937', Math.PI, 'medium');
      } else {
          drawTurret(ctx, 0, 0, 6, '#1f2937', 0, 'medium');
      }

      ctx.restore();
  };

  // --- LOGIC ---

  const fireProjectile = (source: {x:number, y:number, rotation?:number}, target: Entity | null, type: 'bullet'|'cannon'|'bomb'|'rocket', owner: 'player'|'enemy'|'friendly', dmg: number, overrideAngle?: number) => {
      let angle = source.rotation || 0;
      
      // Calculate angle to target if provided (overriding source rotation)
      if (overrideAngle !== undefined) {
          angle = overrideAngle;
      } else if (target) {
          angle = Math.atan2(target.y - source.y, target.x - source.x);
      } else if (owner === 'player' && type !== 'rocket' && type !== 'bomb') {
          // If player firing without specific target ref (e.g. from cooldown logic), try to find where the turret *should* be aiming
          // But usually we pass a target in the update loop.
          // If no target passed, stick to angle 0 (right) or source rotation.
          // For fixed forward firing:
          if (!source.rotation && owner==='player') angle = -Math.PI/2; 
      }

      if (owner === 'player') {
          const acc = getMult('upg_acc');
          const maxSpread = 0.2 / acc;
          angle += (Math.random() - 0.5) * maxSpread;
      } else {
           const spread = type === 'bullet' ? 0.3 : 0.1;
           angle += (Math.random() - 0.5) * spread;
      }
      
      const muzzleOffset = type === 'cannon' ? 30 : type === 'rocket' ? 10 : 20;
      const mx = source.x + Math.cos(angle) * muzzleOffset;
      const my = source.y + Math.sin(angle) * muzzleOffset;

      if (type !== 'bomb') {
        // Muzzle Flash
        particles.current.push({
            id: Math.random().toString(),
            x: mx, y: my, width: 0, height: 0, rotation: angle, 
            hp: 0, maxHp: 0, type: 'muzzle', 
            vx: Math.cos(angle) * 1, vy: Math.sin(angle) * 1, 
            markedForDeletion: false, life: 6, maxLife: 6, color: '#fff', size: type === 'cannon' ? 25 : 12
        });

        // Smoke Puff from barrel
        particles.current.push({
            id: Math.random().toString(),
            x: mx, y: my, width: 0, height: 0, rotation: Math.random()*Math.PI*2,
            hp: 0, maxHp: 0, type: 'smoke',
            vx: Math.cos(angle) * (type === 'cannon' ? 3 : 1) + (Math.random()-0.5), 
            vy: Math.sin(angle) * (type === 'cannon' ? 3 : 1) + (Math.random()-0.5),
            markedForDeletion: false, life: type === 'cannon' ? 25 : 15, maxLife: 25, 
            color: '#e5e7eb', size: type === 'cannon' ? 10 : 5
        });
      }

      const p: Projectile = {
          id: Math.random().toString(),
          x: mx, y: my, // Start at muzzle
          width: type === 'bullet' ? 3 : type === 'cannon' ? 6 : 8,
          height: type === 'bullet' ? 6 : type === 'cannon' ? 12 : 16,
          rotation: angle,
          hp: 1, maxHp: 1, type: type,
          vx: Math.cos(angle) * (type === 'rocket' ? 2 : 6 * (owner === 'player' ? getMult('upg_speed') : 1)),
          vy: Math.sin(angle) * (type === 'rocket' ? 2 : 6 * (owner === 'player' ? getMult('upg_speed') : 1)),
          markedForDeletion: false,
          damage: dmg,
          owner: owner,
          isSplash: type !== 'bullet',
          splashRadius: type === 'cannon' ? 30 : type === 'bomb' ? 50 : type === 'rocket' ? 80 : 0,
          targetType: (type === 'bullet' || type === 'rocket') ? 'both' : 'water',
          targetId: type === 'rocket' ? target?.id : undefined,
          traveled: 0
      };
      
      if ((type === 'cannon' || type === 'bomb') && target) {
          const dist = Math.sqrt(Math.pow(target.x - source.x, 2) + Math.pow(target.y - source.y, 2));
          p.maxDist = dist; 
      }
      
      if (type === 'cannon') p.targetType = 'water'; 
      if (owner === 'player' && type === 'bullet') p.targetType = 'air'; 
      if (owner === 'enemy') p.targetType = 'water'; 
      if (owner === 'friendly' && type === 'bomb') p.targetType = 'water';

      projectiles.current.push(p);
      
      if (type === 'bomb') {
          soundManager.playBombDrop();
      } else {
          const sfxType = type === 'bullet' ? 'small' : type === 'rocket' ? 'rocket' : 'cannon';
          soundManager.playShoot(sfxType);
      }
  };

  const spawnDebris = (source: Entity, color: string, scale: number) => {
      const parts = ['debris_body', 'debris_wing', 'debris_wing', 'debris_tail'];
      parts.forEach((type, idx) => {
           // Randomize velocity but keep forward momentum
           const angleVar = (Math.random() - 0.5) * 1;
           const speedVar = Math.random() * 2 + 1;
           const direction = source.rotation + angleVar;
           
           particles.current.push({
               id: Math.random().toString(),
               x: source.x + (Math.random()-0.5)*10,
               y: source.y + (Math.random()-0.5)*10,
               width: 0, height: 0, 
               rotation: source.rotation,
               hp: 0, maxHp: 0, 
               type: type, // debris type
               vx: source.vx + Math.cos(direction) * speedVar,
               vy: source.vy + Math.sin(direction) * speedVar,
               markedForDeletion: false,
               life: 40 + Math.random() * 20, // Time before it "hits water"
               maxLife: 60,
               color: color,
               size: scale * (type === 'debris_body' ? 30 : 15) // Approximate size
           });
      });
  };

  const update = () => {
    frameCount.current++;
    const stats = statsRef.current; // Use ref for current stats
    const waveMult = Math.pow(WAVE_CONFIG.ENEMY_HP_SCALE, stats.wave - 1);
    const dmgScale = Math.pow(WAVE_CONFIG.ENEMY_DMG_SCALE, stats.wave - 1);

    // 1. Spawning
    const spawnLimit = 20; 
    if (remainingEnemiesToSpawn.current > 0 && enemies.current.length < spawnLimit) {
        if (spawnTimer.current <= 0) {
            const isBoss = stats.wave === WAVE_CONFIG.BOSS_WAVE && remainingEnemiesToSpawn.current === 1;
            let type = EnemyType.PLANE_SMALL;
            if (isBoss) type = EnemyType.BOSS;
            else {
                const r = Math.random();
                if (stats.wave > 2 && r < 0.2) type = EnemyType.PLANE_LARGE;
                else if (stats.wave > 4 && r < 0.3) type = EnemyType.SHIP_SMALL;
                else if (stats.wave > 8 && r < 0.35) type = EnemyType.SHIP_MEDIUM;
            }

            if ((type === EnemyType.SHIP_SMALL || type === EnemyType.SHIP_MEDIUM) && enemies.current.filter(e=>e.enemyType.includes('SHIP')).length > 6) {
                type = EnemyType.PLANE_SMALL;
            }

            let e: Enemy = {
                id: Math.random().toString(),
                x: Math.random() * (CANVAS_WIDTH - 100) + 50,
                y: -100,
                width: 40, height: 40, rotation: Math.PI/2,
                hp: 10, maxHp: 10, type: 'enemy', enemyType: type,
                vx: 0, vy: 2, markedForDeletion: false,
                scoreValue: 10, moneyValue: 10, damage: 1,
                hitChance: 0.2, attackCooldown: 0, maxAttackCooldown: 60,
                state: 'entry',
                pathData: { startX: Math.random() * CANVAS_WIDTH, startY: -50, progress: 0, direction: Math.random() > 0.5 ? 1 : -1 },
                burstCount: 0, burstTimer: 0,
                damagePoints: []
            };

            if (type === EnemyType.PLANE_SMALL) {
                e.hp = 10 * waveMult; 
                e.damage = 0.2 * dmgScale;
                e.hitChance = 0.2;
                e.moneyValue = 5;
                e.width=25; e.height=25; // Scaled down
                e.vy = 3;
            } else if (type === EnemyType.PLANE_LARGE) {
                e.hp = 100 * waveMult; 
                e.damage = 2 * dmgScale; 
                e.width=50; e.height=50; // Scaled down
                e.hitChance = 0.1; // 10% hit chance for big bombs
                e.moneyValue = 20;
                e.state = 'attack'; // Start attacking mode
                e.vy = 1.0; // Very slow speed
            } else if (type === EnemyType.SHIP_SMALL) {
                e.hp = 200 * waveMult; e.damage = 0.5 * dmgScale; e.width=50; e.height=100;
                e.moneyValue = 30;
                e.y = -120;
            } else if (type === EnemyType.SHIP_MEDIUM) {
                e.hp = 600 * waveMult; e.damage = 2 * dmgScale; e.width=70; e.height=140;
                e.moneyValue = 50;
                e.y = -160;
            } else if (type === EnemyType.BOSS) {
                e.hp = 1500; e.maxHp=1500; e.damage = 5; e.width=150; e.height=300;
                e.moneyValue = 5000;
                e.x = CANVAS_WIDTH/2;
            }
            e.maxHp = e.hp;

            enemies.current.push(e);
            remainingEnemiesToSpawn.current--;
            spawnTimer.current = isBoss ? 9999 : 30;
        } else {
            spawnTimer.current--;
        }
    } else if (remainingEnemiesToSpawn.current === 0 && enemies.current.length === 0) {
        if (stats.wave === WAVE_CONFIG.BOSS_WAVE) onVictory();
        else {
            setPlayerStats(p => ({...p, wave: p.wave + 1}));
        }
    }

    const playerCenter = { x: CANVAS_WIDTH/2, y: CANVAS_HEIGHT - 100 };

    // 2. Enemy Updates
    enemies.current.forEach(e => {
        // Emit smoke from damage points
        if (e.damagePoints && e.damagePoints.length > 0) {
            e.damagePoints.forEach(p => {
                if (Math.random() < 0.3) {
                     // Translate relative point to world space
                     const angle = e.rotation + Math.PI/2; 
                     // Scale factor needs to match draw function (0.35 or 0.55)
                     const scale = e.enemyType === EnemyType.PLANE_LARGE ? 0.55 : 0.35;
                     
                     // Transform logic: The damagePoints were set in relative unscaled space
                     const rx = p.x * scale * Math.cos(angle) - p.y * scale * Math.sin(angle);
                     const ry = p.x * scale * Math.sin(angle) + p.y * scale * Math.cos(angle);
                     
                     particles.current.push({
                        id:Math.random().toString(), x: e.x + rx, y: e.y + ry, 
                        width:0, height:0, rotation:0, hp:0, maxHp:0, type:'smoke', 
                        vx: e.vx * 0.5, vy: e.vy * 0.5 - 1, 
                        markedForDeletion:false, life:30, maxLife:30, color:'#333', size:5 + Math.random()*5
                     });
                }
            });
        }

        if (e.enemyType === EnemyType.BOSS) {
            if (e.y < 150) e.y += 0.5;
        } else if (e.enemyType === EnemyType.PLANE_SMALL) {
            const turnRadius = 60;
            const speed = 4;
            
            if (e.state === 'entry') {
                e.y += speed;
                e.x += Math.sin(frameCount.current * 0.05 + parseFloat(e.id)) * 1; 
                e.rotation = Math.PI/2 + Math.cos(frameCount.current * 0.05 + parseFloat(e.id)) * 0.1;
                
                if (e.y > CANVAS_HEIGHT - 150) {
                    e.state = 'turn_up';
                    const isRightTurn = e.x < CANVAS_WIDTH/2;
                    e.pathData!.direction = isRightTurn ? 1 : -1;
                    e.pathData!.turnCenter = { x: e.x + turnRadius * (isRightTurn ? 1 : -1), y: e.y };
                    e.pathData!.turnAngle = isRightTurn ? Math.PI : 0; 
                }
            } else if (e.state === 'turn_up') {
                const dir = e.pathData!.direction!;
                e.rotation += 0.05 * dir;
                e.vx = Math.cos(e.rotation) * speed;
                e.vy = Math.sin(e.rotation) * speed;
                e.x += e.vx;
                e.y += e.vy;

                if (Math.abs(e.rotation - (-Math.PI/2)) < 0.2 || (dir===1 && e.rotation > 3*Math.PI/2) ) {
                    e.state = 'retreat';
                    e.rotation = -Math.PI/2;
                }
            } else if (e.state === 'retreat') {
                e.y -= speed;
                e.rotation = -Math.PI/2;
                if (e.y < 100) {
                    e.state = 'turn_down';
                     const isRightTurn = e.x < CANVAS_WIDTH/2;
                    e.pathData!.direction = isRightTurn ? 1 : -1;
                }
            } else if (e.state === 'turn_down') {
                const dir = e.pathData!.direction!;
                e.rotation += 0.05 * dir;
                e.vx = Math.cos(e.rotation) * speed;
                e.vy = Math.sin(e.rotation) * speed;
                e.x += e.vx;
                e.y += e.vy;
                 if (Math.abs(e.rotation - (Math.PI/2)) < 0.2 || e.y > 110) {
                    e.state = 'entry';
                    e.rotation = Math.PI/2;
                }
            }
        } else if (e.enemyType === EnemyType.PLANE_LARGE) {
            const speed = 1.0;
            const turnRadius = 120; // Wide arc

            if (e.state === 'entry' || e.state === 'attack') {
                e.y += speed;
                e.rotation = Math.PI/2; // Facing down
                
                // Fly PAST player (bottom of screen) before turning
                if (e.y > CANVAS_HEIGHT) {
                    e.state = 'turn_up';
                    const isRightTurn = e.x < CANVAS_WIDTH/2;
                    e.pathData = {
                        startX: e.x, startY: e.y,
                        direction: isRightTurn ? 1 : -1,
                        turnCenter: { x: e.x + turnRadius * (isRightTurn ? 1 : -1), y: e.y },
                        turnAngle: 0
                    };
                }
            } else if (e.state === 'turn_up') {
                 // Wide circular turn from Down (PI/2) to Up (-PI/2)
                 const dir = e.pathData!.direction!;
                 e.rotation += 0.015 * dir; 
                 e.vx = Math.cos(e.rotation) * speed;
                 e.vy = Math.sin(e.rotation) * speed;
                 e.x += e.vx;
                 e.y += e.vy;
                 
                 // Check if facing up
                 if (Math.abs(e.rotation - (-Math.PI/2)) < 0.1 || (dir===1 && e.rotation > 3*Math.PI/2)) {
                     e.state = 'retreat';
                     e.rotation = -Math.PI/2;
                 }
            } else if (e.state === 'retreat') {
                 e.y -= speed;
                 e.rotation = -Math.PI/2;
                 if (e.y < 100) {
                     e.state = 'turn_down';
                     const isRightTurn = e.x < CANVAS_WIDTH/2;
                     e.pathData = {
                        startX: e.x, startY: e.y,
                        direction: isRightTurn ? 1 : -1
                     };
                 }
            } else if (e.state === 'turn_down') {
                 const dir = e.pathData!.direction!;
                 e.rotation += 0.015 * dir;
                 e.vx = Math.cos(e.rotation) * speed;
                 e.vy = Math.sin(e.rotation) * speed;
                 e.x += e.vx;
                 e.y += e.vy;
                 
                 // Check if facing down
                 if (Math.abs(e.rotation - (Math.PI/2)) < 0.1 || e.y > 110) {
                     e.state = 'attack';
                     e.rotation = Math.PI/2;
                 }
            }
        } else {
            e.y += 0.3;
            if (e.y > CANVAS_HEIGHT - 300) e.y -= 0.3; 
            e.x += Math.sin(frameCount.current * 0.01) * 0.5;
        }

        // Enemy Weapons
        if (e.enemyType === EnemyType.PLANE_SMALL) {
            e.attackCooldown++; 
            const distToPlayer = Math.sqrt(Math.pow(e.x - playerCenter.x, 2) + Math.pow(e.y - playerCenter.y, 2));
            const inRange = distToPlayer < 400 && e.y < playerCenter.y;

            if (e.attackCooldown > 120 && inRange && e.burstCount === 0) {
                e.burstCount = 3;
                e.burstTimer = 0;
                e.attackCooldown = 0; 
            }

            if ((e.burstCount || 0) > 0) {
                e.burstTimer = (e.burstTimer || 0) + 1;
                if (e.burstTimer > 10) {
                    e.burstTimer = 0;
                    e.burstCount!--;
                    
                    const isHit = Math.random() < e.hitChance;
                    let targetX = playerCenter.x;
                    let targetY = playerCenter.y;
                    
                    if (!isHit) {
                        targetX += (Math.random() - 0.5) * 200;
                        targetY += (Math.random() - 0.5) * 200;
                    }
                    fireProjectile(e, {x: targetX, y: targetY, width:0, height:0, hp:0, maxHp:0, id:'p', rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'bullet', 'enemy', e.damage);
                }
            }
        }
        else if (e.enemyType === EnemyType.PLANE_LARGE) {
            // Drop 3 bombs when approaching and passing over player
            // Trigger between 400px above and 100px below player center to cover approach
            if (e.state === 'attack' && e.y > playerCenter.y - 400 && e.y < playerCenter.y + 100) {
                 e.attackCooldown++;
                 // Start burst
                 if (e.attackCooldown > 120 && e.burstCount === 0) {
                     e.burstCount = 3;
                     e.burstTimer = 0;
                     e.attackCooldown = 0;
                 }
            }
            
            if ((e.burstCount || 0) > 0) {
                e.burstTimer = (e.burstTimer || 0) + 1;
                // Drop 1 bomb every 15 frames for spacing
                if (e.burstTimer > 15) {
                     e.burstTimer = 0;
                     e.burstCount!--;
                     
                     // 10% hit chance hardcoded logic
                     const isHit = Math.random() < 0.1; 
                     
                     let targetX = playerCenter.x;
                     let targetY = playerCenter.y;

                     if (isHit) {
                         // Hit deck random spot
                         targetX += (Math.random() - 0.5) * 40;
                         targetY += (Math.random() - 0.5) * 100;
                     } else {
                         // Miss: Drop to the side of the ship (in water)
                         // Simulates dropping "on ground after/around bomber"
                         const offset = 90 + Math.random() * 80;
                         const side = Math.random() > 0.5 ? 1 : -1;
                         targetX += offset * side;
                         targetY += (Math.random() - 0.5) * 200; 
                     }
                     
                     const targetEntity = {
                        x: targetX,
                        y: targetY,
                        width: 10, height: 10,
                        id: 'ground', rotation: 0, hp: 0, maxHp: 0, type: 'dummy', vx: 0, vy: 0, markedForDeletion: false
                     };
                     
                     fireProjectile(e, targetEntity, 'bomb', 'enemy', e.damage);
                }
            }
        }
        else if (e.enemyType.includes('SHIP')) {
            e.attackCooldown++;
             if (e.enemyType === EnemyType.SHIP_SMALL && e.attackCooldown > 180) {
                fireProjectile(e, {x: playerCenter.x, y: playerCenter.y, width:0, height:0, hp:0, maxHp:0, id:'p', rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'bullet', 'enemy', e.damage);
                e.attackCooldown = 0;
            }
            else if (e.enemyType === EnemyType.SHIP_MEDIUM && e.attackCooldown > 180) {
                fireProjectile(e, {x: playerCenter.x, y: playerCenter.y, width:0, height:0, hp:0, maxHp:0, id:'p', rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'cannon', 'enemy', e.damage);
                e.attackCooldown = 0;
            }
        }
        else if (e.enemyType === EnemyType.BOSS && e.attackCooldown > 240) {
            const phase = bossPhase.current % 3;
            if (phase === 0) {
                fireProjectile({x: e.x-40, y: e.y}, {x: playerCenter.x, y: playerCenter.y, width:0, height:0, hp:0, maxHp:0, id:'p', rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'cannon', 'enemy', 5);
                fireProjectile({x: e.x+40, y: e.y}, {x: playerCenter.x, y: playerCenter.y, width:0, height:0, hp:0, maxHp:0, id:'p', rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'cannon', 'enemy', 5);
            } else if (phase === 1) {
                fireProjectile({x: e.x, y: e.y}, {x: playerCenter.x, y: playerCenter.y, id:'p', width:0, height:0, hp:0, maxHp:0, rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'rocket', 'enemy', 5);
                fireProjectile({x: e.x, y: e.y}, {x: playerCenter.x, y: playerCenter.y, id:'p', width:0, height:0, hp:0, maxHp:0, rotation:0, type:'player', vx:0, vy:0, markedForDeletion:false}, 'rocket', 'enemy', 5);
            } else {
                enemies.current.push({
                     id: Math.random().toString(),
                     x: e.x, y: e.y, width: 25, height: 25, rotation: Math.PI/2,
                     hp: 10, maxHp: 10, type: 'enemy', enemyType: EnemyType.PLANE_SMALL,
                     vx: 0, vy: 3, markedForDeletion: false,
                     scoreValue: 0, moneyValue: 0, damage: 1, hitChance: 0.2, attackCooldown: 0, maxAttackCooldown: 60, state: 'entry',
                     pathData: { startX: e.x, startY: e.y, progress: 0, direction: 1 }, burstCount: 0
                });
            }
            bossPhase.current++;
            e.attackCooldown = 0;
        } else if (e.enemyType === EnemyType.BOSS) {
            e.attackCooldown++;
        }
    });

    // 3. Player Weapons Logic
    const dmgMult = getMult('upg_dmg');
    const xpMult = getMult('upg_xp');
    const moneyMult = getMult('upg_money');

    if (skills.current.repair > 0) {
        weaponCooldowns.current.repair++;
        const interval = skills.current.repair === 3 ? 150 : 300;
        const amount = skills.current.repair === 1 ? 2 : skills.current.repair === 2 ? 4 : 5;
        if (weaponCooldowns.current.repair >= interval) {
            setPlayerStats(p => ({...p, hp: Math.min(p.maxHp, p.hp + amount)}));
            weaponCooldowns.current.repair = 0;
        }
    }

    weaponCooldowns.current.mediumLeft++;
    if (weaponCooldowns.current.mediumLeft >= 60) {
        const targets = enemies.current.filter(e => (e.enemyType.includes('SHIP') || e.enemyType === 'BOSS') && e.y > 0);
        if (targets.length > 0) {
            const t = targets[0]; 
            // Calculate fire origin points
            const p1 = { x: playerCenter.x - 45, y: playerCenter.y };
            const p2 = { x: playerCenter.x + 45, y: playerCenter.y + 40 };

            for(let i=0; i<3; i++) {
                setTimeout(() => fireProjectile(p1, t, 'cannon', 'player', 10 * dmgMult), i * 100);
                setTimeout(() => fireProjectile(p2, t, 'cannon', 'player', 10 * dmgMult), i * 100);
            }
            weaponCooldowns.current.mediumLeft = -20;
        }
    }

    weaponCooldowns.current.aa1++;
    if (weaponCooldowns.current.aa1 >= 60) {
        const targets = enemies.current.filter(e => e.enemyType.includes('PLANE'));
        if (targets.length > 0) {
            const t = targets[Math.floor(Math.random() * targets.length)];
            const pos = [
                {x: playerCenter.x - 35, y: playerCenter.y - 80},
                {x: playerCenter.x + 35, y: playerCenter.y - 80},
                {x: playerCenter.x - 35, y: playerCenter.y + 80},
                {x: playerCenter.x + 35, y: playerCenter.y + 80}
            ];

            for(let i=0; i<5; i++) {
                setTimeout(() => {
                    pos.forEach(p => fireProjectile(p, t, 'bullet', 'player', 5 * dmgMult));
                }, i * 50);
            }
            weaponCooldowns.current.aa1 = -20;
        }
    }

    if (skills.current.escort_left > 0) {
        const ex = playerCenter.x - 120, ey = playerCenter.y + 50;
        const level = skills.current.escort_left;
        
        weaponCooldowns.current.escortLeftMain++;
        if (weaponCooldowns.current.escortLeftMain >= 360) {
             const targets = enemies.current.filter(e => e.enemyType.includes('SHIP') || e.enemyType === 'BOSS');
             if (targets.length > 0) {
                 const t = targets[0];
                 const dmg = (level === 1 ? 100 : level === 2 ? 150 : 300) * 2 * dmgMult;
                 fireProjectile({x: ex, y: ey-10}, t, 'cannon', 'player', dmg);
                 fireProjectile({x: ex, y: ey+40}, t, 'cannon', 'player', dmg);
                 weaponCooldowns.current.escortLeftMain = 0;
             }
        }
        weaponCooldowns.current.escortLeftSmall++;
        if (weaponCooldowns.current.escortLeftSmall >= 60) {
             const targets = enemies.current.filter(e => e.enemyType.includes('SHIP'));
             if (targets.length > 0) {
                 const t = targets[0];
                 for(let i=0; i<3; i++) setTimeout(() => fireProjectile({x: ex, y: ey-40}, t, 'cannon', 'player', 10 * dmgMult), i*100);
                 weaponCooldowns.current.escortLeftSmall = 0;
             }
        }
        weaponCooldowns.current.escortLeftAA++;
        if (weaponCooldowns.current.escortLeftAA >= 60) {
            const targets = enemies.current.filter(e => e.enemyType.includes('PLANE'));
            if(targets.length > 0) {
                const t = targets[0];
                for(let i=0; i<5; i++) setTimeout(() => fireProjectile({x: ex, y: ey+20}, t, 'bullet', 'player', 5 * dmgMult), i*50);
                weaponCooldowns.current.escortLeftAA = 0;
            }
        }
    }

    if (skills.current.escort_right > 0) {
        const ex = playerCenter.x + 120, ey = playerCenter.y + 50;
        const level = skills.current.escort_right;
        
        weaponCooldowns.current.escortRightMain++;
        if (weaponCooldowns.current.escortRightMain >= 360) {
             const targets = enemies.current.filter(e => e.enemyType.includes('SHIP') || e.enemyType === 'BOSS');
             if (targets.length > 0) {
                 const t = targets[0];
                 const dmg = (level === 1 ? 100 : level === 2 ? 150 : 300) * 2 * dmgMult;
                 fireProjectile({x: ex, y: ey-10}, t, 'cannon', 'player', dmg);
                 fireProjectile({x: ex, y: ey+40}, t, 'cannon', 'player', dmg);
                 weaponCooldowns.current.escortRightMain = 0;
             }
        }
        weaponCooldowns.current.escortRightSmall++;
        if (weaponCooldowns.current.escortRightSmall >= 60) {
             const targets = enemies.current.filter(e => e.enemyType.includes('SHIP'));
             if (targets.length > 0) {
                 const t = targets[0];
                 for(let i=0; i<3; i++) setTimeout(() => fireProjectile({x: ex, y: ey-40}, t, 'cannon', 'player', 10 * dmgMult), i*100);
                 weaponCooldowns.current.escortRightSmall = 0;
             }
        }
        weaponCooldowns.current.escortRightAA++;
        if (weaponCooldowns.current.escortRightAA >= 60) {
            const targets = enemies.current.filter(e => e.enemyType.includes('PLANE'));
            if(targets.length > 0) {
                const t = targets[0];
                for(let i=0; i<5; i++) setTimeout(() => fireProjectile({x: ex, y: ey+20}, t, 'bullet', 'player', 5 * dmgMult), i*50);
                weaponCooldowns.current.escortRightAA = 0;
            }
        }
    }

    if (skills.current.fighter > 0) {
        const maxFighters = skills.current.fighter === 1 ? 2 : skills.current.fighter === 2 ? 4 : 8;
        if (friendlies.current.filter(f => f.unitType === 'fighter').length < maxFighters) {
            weaponCooldowns.current.fighterSpawn++;
            if (weaponCooldowns.current.fighterSpawn > 180) { 
                friendlies.current.push({
                    id: Math.random().toString(), unitType: 'fighter', x: playerCenter.x, y: playerCenter.y, width: 20, height: 20, rotation: -Math.PI/2,
                    hp: 100, maxHp: 100, type: 'friendly', vx: 0, vy: -6, markedForDeletion: false,
                    state: 'launching', ammo: 50, maxAmmo: 50, damagePoints: []
                });
                weaponCooldowns.current.fighterSpawn = 0;
            }
        }
    }

    if (skills.current.bomber > 0) {
        const maxBombers = skills.current.bomber; 
        if (friendlies.current.filter(f => f.unitType === 'bomber').length < maxBombers) {
            weaponCooldowns.current.bomberSpawn++;
            if (weaponCooldowns.current.bomberSpawn > 300) {
                friendlies.current.push({
                    id: Math.random().toString(), unitType: 'bomber', x: playerCenter.x, y: playerCenter.y, width: 45, height: 45, rotation: -Math.PI/2,
                    hp: 100, maxHp: 100, type: 'friendly', vx: 0, vy: -4, markedForDeletion: false,
                    state: 'launching', ammo: 3, maxAmmo: 3, damagePoints: []
                });
                weaponCooldowns.current.bomberSpawn = 0;
            }
        }
    }

    if (skills.current.rocket > 0) {
        weaponCooldowns.current.rocket++;
        if (weaponCooldowns.current.rocket >= 300) { 
            const dmg = (skills.current.rocket === 1 ? 200 : skills.current.rocket === 2 ? 300 : 400) * dmgMult;
            const target = enemies.current.find(e => e.enemyType === EnemyType.BOSS) || enemies.current.find(e => e.enemyType.includes('SHIP'));
            if (target) {
                fireProjectile({x: playerCenter.x, y: playerCenter.y + 100}, target, 'rocket', 'player', dmg);
                weaponCooldowns.current.rocket = 0;
            }
        }
    }
    
    // Prepare rearming queue for positioning logic
    const rearmingQueue = friendlies.current.filter(f => f.state === 'rearming');

    friendlies.current.forEach(f => {
        // Friendly smoke
        if (f.damagePoints && f.damagePoints.length > 0) {
             f.damagePoints.forEach(p => {
                if (Math.random() < 0.3) {
                     // Translate relative point to world space
                     const angle = f.rotation + Math.PI/2; 
                     const scale = f.unitType === 'bomber' ? 0.55 : 0.35;
                     const rx = p.x * scale * Math.cos(angle) - p.y * scale * Math.sin(angle);
                     const ry = p.x * scale * Math.sin(angle) + p.y * scale * Math.cos(angle);
                     
                     particles.current.push({
                        id:Math.random().toString(), x: f.x + rx, y: f.y + ry, 
                        width:0, height:0, rotation:0, hp:0, maxHp:0, type:'smoke', 
                        vx: f.vx * 0.5, vy: f.vy * 0.5 - 1, 
                        markedForDeletion:false, life:30, maxLife:30, color:'#333', size:5 + Math.random()*5
                     });
                }
            });
        }

        // Logic Helpers
        const runY = playerCenter.y; // Deck center Y approx
        const landingApproachY = runY + 300;
        const launchEndY = runY - 200;
        const landSpeed = f.unitType === 'fighter' ? 4 : 2;
        const sternY = runY + 120; // End of runway

        if (f.state === 'launching') {
            // Accelerate upwards
            if (f.vy > -8) f.vy -= 0.2;
            f.y += f.vy;
            f.rotation = -Math.PI/2;
            f.x = playerCenter.x; // Stay centered on runway
            
            // Catapult steam
            if (Math.random() < 0.5) {
                particles.current.push({
                    id: Math.random().toString(), x: f.x + (Math.random()-0.5)*10, y: f.y + 20, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'smoke', 
                    vx:(Math.random()-0.5)*2, vy:2, markedForDeletion:false, life:30, maxLife:30, color:'#e2e8f0', size:8
                });
            }

            if (f.y < launchEndY) {
                f.state = 'airborne';
                f.timer = 0; // Reset timer for cooldowns
            }
            return; // Skip other states
        }

        if (f.state === 'returning') {
            // Fly to approach point (behind carrier)
            const targetX = playerCenter.x;
            const targetY = landingApproachY;
            const dx = targetX - f.x;
            const dy = targetY - f.y;
            const angle = Math.atan2(dy, dx);
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            f.rotation = angle;
            const speed = 5;
            f.x += Math.cos(angle) * speed;
            f.y += Math.sin(angle) * speed;

            if (dist < 20) {
                f.state = 'landing';
                f.x = targetX;
                f.y = targetY;
                f.rotation = -Math.PI/2;
            }
            return;
        }

        if (f.state === 'landing') {
            // Move up runway to parking spot - target Stern to enter deck
            const targetY = sternY;
            const dist = Math.abs(f.y - targetY);
            
            if (dist < 5) {
                f.state = 'rearming';
                f.y = targetY; // Snap to deck entry
                f.timer = 180; // 3 seconds at 60fps
                // Tire smoke on stop
                for(let i=0; i<5; i++) {
                     particles.current.push({
                        id: Math.random().toString(), x: f.x + (Math.random()-0.5)*10, y: f.y + 10, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'smoke', 
                        vx:(Math.random()-0.5), vy:0, markedForDeletion:false, life:40, maxLife:40, color:'#94a3b8', size:5
                    });
                }
            } else {
                // Decelerate approach
                f.y -= landSpeed;
                f.rotation = -Math.PI/2;
                f.x = playerCenter.x + (Math.random()-0.5)*2; // Jitter
            }
            return;
        }

        if (f.state === 'rearming') {
            const queueIndex = rearmingQueue.indexOf(f);
            // Park starting from top of runway (bow) backwards
            // Clamp so they don't fall off the back too much visually
            const parkingY = Math.min((runY - 80) + (queueIndex * 35), runY + 130);
            
            // Taxi logic
            const dist = f.y - parkingY;
            // Only move if significant distance
            if (Math.abs(dist) > 2) {
                f.y -= Math.sign(dist) * 2; // Taxi speed
            } else {
                f.y = parkingY;
            }

            f.x = playerCenter.x;
            f.rotation = -Math.PI/2;
            
            if (f.timer && f.timer > 0) {
                f.timer--;
                // Visual healing/rearming
                if (f.timer % 30 === 0) {
                     particles.current.push({
                         id: Math.random().toString(), x: f.x + (Math.random()-0.5)*20, y: f.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'spark', 
                         vx:0, vy:-1, markedForDeletion:false, life:20, maxLife:20, color:'#4ade80', size:3
                     });
                }
            } else {
                // Done rearming
                f.hp = f.maxHp;
                f.ammo = f.maxAmmo;
                f.damagePoints = [];
                f.state = 'launching';
                f.vy = -1; // Initial launch speed
            }
            return;
        }

        // --- AIRBORNE COMBAT LOGIC ---
        if (f.ammo <= 0) {
            f.state = 'returning';
            return;
        }

        const targetPlane = enemies.current.find(e => e.enemyType.includes('PLANE'));
        const targetShip = enemies.current.find(e => e.enemyType.includes('SHIP') || e.enemyType === 'BOSS');

        if (f.unitType === 'fighter') {
            let target = targetPlane || targetShip;
            if (target) {
                let destX = target.x;
                let destY = target.y;

                // CHASE LOGIC: maintain distance behind planes
                if (target.enemyType.includes('PLANE')) {
                    const chaseDist = target.width * 4; // 4 aircraft lengths based on hitbox
                    // Calculate position behind the enemy based on its rotation
                    destX = target.x - Math.cos(target.rotation) * chaseDist;
                    destY = target.y - Math.sin(target.rotation) * chaseDist;
                }

                const dx = destX - f.x;
                const dy = destY - f.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                const angle = Math.atan2(dy, dx);
                
                f.rotation = angle;
                
                const speed = 5;
                const moveDist = Math.min(speed, dist);
                f.x += Math.cos(angle) * moveDist; 
                f.y += Math.sin(angle) * moveDist;
                
                // If in formation/chase position (close to dest), align rotation with target
                if (dist < 20 && target.enemyType.includes('PLANE')) {
                    f.rotation = target.rotation;
                }
                
                if (Math.random() < 0.1) {
                        if (target.enemyType.includes('PLANE')) {
                            // Only fire if reasonably aligned to actual target
                             const realDx = target.x - f.x;
                             const realDy = target.y - f.y;
                             const realDist = Math.sqrt(realDx*realDx + realDy*realDy);
                             // If chasing (behind), fire.
                             if (realDist < 400) {
                                fireProjectile(f, target, 'bullet', 'friendly', 1);
                                f.ammo--;
                             }
                        } else {
                            const realDx = target.x - f.x;
                            const realDy = target.y - f.y;
                            if (Math.abs(realDx) < 40 && Math.abs(realDy) < 40) {
                                fireProjectile(f, target, 'bomb', 'friendly', 100);
                                f.ammo -= 10;
                            }
                        }
                }
            } else {
                // Patrol pattern
                f.y -= 2;
                if (f.y < 0) {
                     f.y = 0; 
                     f.rotation += Math.PI;
                }
            }
        } else if (f.unitType === 'bomber') {
            // Updated Bomber Logic: Fly Over + 70% Hit Chance
            let target = targetShip;
            if (target) {
                    const dx = target.x - f.x;
                    const dy = target.y - f.y;
                    const distToTarget = Math.sqrt(dx*dx + dy*dy);
                    
                    // Fly THROUGH the target (fly over)
                    // If we are close (less than 150px), lock the rotation so we don't snap/turn instantly.
                    // This creates a smooth fly-over effect.
                    if (distToTarget > 150) {
                        f.rotation = Math.atan2(dy, dx);
                    }

                    f.x += Math.cos(f.rotation) * 3; 
                    f.y += Math.sin(f.rotation) * 3;
                    
                    // Decrement drop cooldown
                    if (f.timer && f.timer > 0) f.timer--;

                    // Bomb Drop Logic
                    // Trigger when close, ammo avail, and cooldown ready
                    if (distToTarget < 30 && f.ammo > 0 && (!f.timer || f.timer <= 0)) {
                        // 70% Hit Chance Logic
                        const isHit = Math.random() < 0.7;
                        
                        // If it's a hit, aim at the ship center
                        // If it's a miss, aim at a random spot offset from the ship (in the water)
                        let targetEntity: Entity | null = target;
                        let overrideAngle: number | undefined = undefined;

                        if (!isHit) {
                            // Create a fake target point in the water
                            // Offset by ship width + random margin
                            const offset = target.width + 50 + Math.random() * 50;
                            const side = Math.random() > 0.5 ? 1 : -1;
                            
                            // We construct a fake entity for the projectile to aim at
                            targetEntity = {
                                ...target,
                                x: target.x + offset * side,
                                y: target.y + (Math.random() - 0.5) * 50
                            };
                        }

                        fireProjectile(f, targetEntity, 'bomb', 'friendly', 100);
                        
                        f.ammo--;
                        f.timer = 30; // 0.5s cooldown between drops if multiple ammo
                    }
            } else {
                    f.y -= 2;
                    if (f.y < -100) f.y = CANVAS_HEIGHT;
            }
        }
    });

    projectiles.current.forEach(p => {
        const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
        p.x += p.vx; p.y += p.vy;
        if (p.traveled !== undefined) p.traveled += speed;

        if (p.type === 'rocket' && frameCount.current % 3 === 0) {
            particles.current.push({
                id: Math.random().toString(),
                x: p.x - p.vx + (Math.random()-0.5)*5,
                y: p.y - p.vy + (Math.random()-0.5)*5,
                width:0, height:0, rotation:0, hp:0, maxHp:0, type:'smoke', vx:0, vy:0, markedForDeletion:false,
                life: 20, maxLife: 20, color: '#9ca3af', size: 4
            });
        }
        
        if (p.maxDist && p.traveled && p.traveled >= p.maxDist) {
            p.markedForDeletion = true;
            
            const isHeavy = p.type === 'cannon' || p.type === 'bomb' || p.type === 'rocket';
            soundManager.playSplash(isHeavy ? 'large' : 'small');

            particles.current.push({
                 id: Math.random().toString(), x: p.x, y: p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, 
                 type: isHeavy ? 'splash_heavy' : 'splash',
                 vx:0, vy:0, markedForDeletion:false, 
                 life: isHeavy ? 45 : 30, 
                 maxLife: isHeavy ? 45 : 30, 
                 color: '#fff', 
                 size: isHeavy ? 40 : 20
            });

            if (isHeavy) {
                 particles.current.push({
                    id: Math.random().toString(), x: p.x, y: p.y, width:0, height:0, rotation:0, hp:0, maxHp:0,
                    type: 'ripple',
                    vx: 0, vy: 0, markedForDeletion: false,
                    life: 50, maxLife: 50, color: '#fff', size: 10
                 });
            }
            return; 
        }

        if (p.targetId) {
             const t = enemies.current.find(e => e.id === p.targetId);
             if(t) {
                 const a = Math.atan2(t.y - p.y, t.x - p.x);
                 p.rotation = a; 
                 p.vx = Math.cos(a) * 6; p.vy = Math.sin(a) * 6;
             }
        }

        if (p.owner === 'player' || p.owner === 'friendly') {
            enemies.current.forEach(e => {
                if(p.markedForDeletion) return;
                const dist = Math.sqrt(Math.pow(p.x - e.x, 2) + Math.pow(p.y - e.y, 2));
                const hitDist = Math.max(e.width, e.height) / 2;
                
                const canHit = p.targetType === 'both' || 
                              (p.targetType === 'air' && e.enemyType.includes('PLANE')) ||
                              (p.targetType === 'water' && (e.enemyType.includes('SHIP') || e.enemyType === 'BOSS'));

                if (dist < hitDist && canHit) {
                     p.markedForDeletion = true;
                     e.hp -= p.damage;
                     
                     // ADD DAMAGE POINT LOGIC
                     if (e.enemyType.includes('PLANE') && e.hp > 0) {
                        const hpPct = e.hp / e.maxHp;
                        const maxFires = hpPct < 0.3 ? 3 : hpPct < 0.6 ? 2 : 1;
                        if ((!e.damagePoints || e.damagePoints.length < maxFires) && Math.random() < 0.4) {
                             if (!e.damagePoints) e.damagePoints = [];
                             // Random spot on wing or fuselage (unscaled coords)
                             // Model width ~ 80, height ~ 60 roughly in drawing coords
                             e.damagePoints.push({
                                 x: (Math.random() - 0.5) * 60,
                                 y: (Math.random() - 0.5) * 40
                             });
                        }
                     }
                     
                     soundManager.playHit('enemy');
                     for(let i=0; i<4; i++) {
                        particles.current.push({
                            id:Math.random().toString(), x:p.x, y:p.y, width:0, height:0, rotation:Math.random()*Math.PI*2, 
                            hp:0, maxHp:0, type:'spark', vx:(Math.random()-0.5)*10, vy:(Math.random()-0.5)*10, 
                            markedForDeletion:false, life:10, maxLife:10, color:'#fef08a', size:4
                        });
                     }
                     particles.current.push({
                         id:Math.random().toString(), x:p.x, y:p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'smoke', 
                         vx:0, vy:0, markedForDeletion:false, life:20, maxLife:20, color:'#6b7280', size:10
                     });

                     // Special Bomb Hit Effect
                     if (p.type === 'bomb' && p.owner === 'friendly') {
                         soundManager.playExplosion('extra_large');
                         // Massive shockwave
                         particles.current.push({
                             id:Math.random().toString(), x:p.x, y:p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'shockwave', 
                             vx:0, vy:0, markedForDeletion:false, life:20, maxLife:20, color:'#fbbf24', size:60
                         });
                         // Heavy fire
                         for(let i=0; i<12; i++) {
                             particles.current.push({
                                 id:Math.random().toString(), x:p.x, y:p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'fire', 
                                 vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, markedForDeletion:false, 
                                 life:40+Math.random()*20, maxLife:60, color: '', size:Math.random()*25 + 10
                             });
                         }
                     }

                     if (e.hp <= 0 && !e.markedForDeletion) {
                         e.markedForDeletion = true;
                         soundManager.playExplosion('large');
                         
                         // Check if plane -> spawn structural debris
                         if (e.enemyType.includes('PLANE')) {
                             const color = e.enemyType === EnemyType.PLANE_LARGE ? '#3f6212' : '#064e3b';
                             spawnDebris(e, color, e.enemyType === EnemyType.PLANE_LARGE ? 1.0 : 0.6);
                         } else {
                             // Ships standard explosion
                             for(let i=0; i<6; i++) {
                                particles.current.push({
                                    id:Math.random().toString(), x:e.x, y:e.y, width:0, height:0, rotation:Math.random()*Math.PI, 
                                    hp:0, maxHp:0, type:'debris', vx:(Math.random()-0.5)*8, vy:(Math.random()-0.5)*8, 
                                    markedForDeletion:false, life:40, maxLife:40, color:'#374151', size:6 + Math.random()*6
                                });
                             }
                         }

                         setPlayerStats(stats => {
                             let nextXp = stats.xp + e.scoreValue * xpMult;
                             let lvlUp = false;
                             if (nextXp >= stats.maxXp) {
                                 nextXp -= stats.maxXp;
                                 lvlUp = true;
                             }
                             if(lvlUp) setGameState(GameState.LEVEL_UP);
                             return {
                                 ...stats,
                                 xp: nextXp,
                                 maxXp: lvlUp ? stats.maxXp * 1.5 : stats.maxXp,
                                 level: lvlUp ? stats.level + 1 : stats.level,
                                 money: stats.money + e.moneyValue * moneyMult
                             };
                         });
                         
                         particles.current.push({
                             id:Math.random().toString(), x:e.x, y:e.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'shockwave', 
                             vx:0, vy:0, markedForDeletion:false, life:15, maxLife:15, color:'#fff', size:e.width
                         });
                         
                         for(let i=0; i<10; i++) {
                             particles.current.push({
                                 id:Math.random().toString(), x:e.x, y:e.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'fire', 
                                 vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, markedForDeletion:false, 
                                 life:30+Math.random()*20, maxLife:50, color: '', size:Math.random()*30
                             });
                         }
                     }
                }
            });
        } else {
            const px = playerCenter.x, py = playerCenter.y;
            // Check collisions for enemy projectiles hitting player
            // Use simple box or circle check
            if (p.x > px - 40 && p.x < px + 40 && p.y > py - 100 && p.y < py + 100) {
                 p.markedForDeletion = true;
                 
                 // If Bomb, play heavy explosion sound
                 if (p.type === 'bomb') {
                     soundManager.playExplosion('large');
                 } else {
                     soundManager.playHit('player');
                 }

                 setPlayerStats(prev => {
                     const nhp = prev.hp - p.damage;
                     if(nhp <= 0) onGameOver();
                     return {...prev, hp: nhp};
                 });
                 
                 particles.current.push({id:Math.random().toString(), x:p.x, y:p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, type:'fire', vx:0, vy:0, markedForDeletion:false, life:20, maxLife:20, color:'', size:15});
                 particles.current.push({id:Math.random().toString(), x:p.x, y:p.y, width:0, height:0, rotation:Math.random(), hp:0, maxHp:0, type:'spark', vx:(Math.random()-0.5)*5, vy:(Math.random()-0.5)*5, markedForDeletion:false, life:10, maxLife:10, color:'#ef4444', size:5});
            }
        }

        if (p.x < 0 || p.x > CANVAS_WIDTH || p.y < -100 || p.y > CANVAS_HEIGHT) p.markedForDeletion = true;
    });

    enemies.current = enemies.current.filter(e => !e.markedForDeletion);
    projectiles.current = projectiles.current.filter(p => !p.markedForDeletion);
    particles.current.forEach(p => { 
        p.life--; 
        p.x += p.vx; 
        p.y += p.vy; 
        
        // Debris Logic
        if (p.type.includes('debris_')) {
            p.rotation += 0.1;
            // Trail smoke/fire
            if (Math.random() < 0.3) {
                particles.current.push({
                    id: Math.random().toString(), x: p.x, y: p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, 
                    type: Math.random()>0.5 ? 'fire' : 'smoke', 
                    vx:0, vy:-1, markedForDeletion:false, life:20, maxLife:20, color: '#333', size: 5 + Math.random()*5
                });
            }
            // Splash on death
            if (p.life <= 0) {
                soundManager.playSplash('large');
                const isBig = p.type === 'debris_body';
                particles.current.push({
                    id: Math.random().toString(), x: p.x, y: p.y, width:0, height:0, rotation:0, hp:0, maxHp:0, 
                    type: isBig ? 'splash_heavy' : 'splash',
                    vx:0, vy:0, markedForDeletion:false, 
                    life: 30, maxLife: 30, color: '#fff', 
                    size: p.size
                });
            }
        }
        
        if(p.life<=0) p.markedForDeletion=true; 
    });
    particles.current = particles.current.filter(p => !p.markedForDeletion);
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    const grd = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    grd.addColorStop(0, '#1e3a8a');
    grd.addColorStop(1, '#172554');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = '#3b82f6';
    ctx.globalAlpha = 0.2;
    const time = frameCount.current * 0.02;
    for(let y=0; y<CANVAS_HEIGHT; y+=40) {
        ctx.beginPath();
        for(let x=0; x<CANVAS_WIDTH; x+=20) {
             ctx.lineTo(x, y + Math.sin(x*0.01 + time)*5);
        }
        ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Draw Shadows first for airborne friendlies
    friendlies.current.forEach(f => {
        if (f.state === 'airborne' || f.state === 'returning' || (f.state === 'landing' && f.y > CANVAS_HEIGHT-300)) {
            // Shadow offset varies by state/altitude
            let shadowOff = 40;
            if (f.state === 'landing') shadowOff = 10;
            drawWW2Plane(ctx, f.x + shadowOff/2, f.y + shadowOff, f.rotation, f.unitType, true, 'player', []);
        }
    });

    enemies.current.forEach(e => {
        if (e.enemyType.includes('PLANE')) {
            drawWW2Plane(ctx, e.x + 20, e.y + 40, e.rotation, e.enemyType === EnemyType.PLANE_LARGE ? 'bomber' : 'fighter', true, 'enemy', []);
        }
    });

    if (skills.current.escort_left > 0) drawEscort(ctx, CANVAS_WIDTH/2 - 120, CANVAS_HEIGHT - 50, true, skills.current.escort_left);
    if (skills.current.escort_right > 0) drawEscort(ctx, CANVAS_WIDTH/2 + 120, CANVAS_HEIGHT - 50, false, skills.current.escort_right);

    drawShipParts(ctx, CANVAS_WIDTH/2, CANVAS_HEIGHT - 100);

    // Draw Friendly Planes ON DECK (no shadow or very close)
    friendlies.current.forEach(f => {
        const onDeck = f.state === 'landing' || f.state === 'rearming' || f.state === 'launching';
        // If on deck, they are on top of ship parts, but under bridge? 
        // We draw them here so they are on top of deck.
        drawWW2Plane(ctx, f.x, f.y, f.rotation, f.unitType, false, 'player', f.damagePoints);
    });

    enemies.current.forEach(e => {
        if (e.enemyType === EnemyType.BOSS) {
            ctx.fillStyle = '#7f1d1d';
            ctx.fillRect(e.x - e.width/2, e.y - e.height/2, e.width, e.height);
            ctx.fillStyle = '#991b1b';
            ctx.fillRect(e.x - e.width/2 + 10, e.y - e.height/2 + 20, e.width-20, e.height-40);
        } else if (e.enemyType.includes('SHIP')) {
            drawEnemyShip(ctx, e);
        } else {
            drawWW2Plane(ctx, e.x, e.y, e.rotation, e.enemyType === EnemyType.PLANE_LARGE ? 'bomber' : 'fighter', false, 'enemy', e.damagePoints);
        }
        const hpPct = e.hp / e.maxHp;
        ctx.fillStyle = 'red'; ctx.fillRect(e.x - 20, e.y - 30, 40, 4);
        ctx.fillStyle = '#22c55e'; ctx.fillRect(e.x - 20, e.y - 30, 40 * hpPct, 4);
    });

    projectiles.current.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        if (p.type === 'bullet') {
            const len = 15;
            const grad = ctx.createLinearGradient(0, 0, -len, 0);
            grad.addColorStop(0, '#fff');
            grad.addColorStop(0.2, '#facc15'); 
            grad.addColorStop(1, 'rgba(250, 204, 21, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(0, -1.5);
            ctx.lineTo(0, 1.5);
            ctx.lineTo(-len, 0.5);
            ctx.lineTo(-len, -0.5);
            ctx.fill();
            
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 4;
        } else if (p.type === 'cannon') {
            ctx.fillStyle = '#1f2937';
            ctx.beginPath(); ctx.ellipse(0, 0, 6, 4, 0, 0, Math.PI*2); ctx.fill();
            ctx.fillStyle = '#9ca3af';
            ctx.beginPath(); ctx.ellipse(-2, -1.5, 2, 1, 0, 0, Math.PI*2); ctx.fill();
        } else if (p.type === 'rocket') {
            ctx.fillStyle = '#cbd5e1'; 
            ctx.fillRect(-10, -3, 20, 6);
            ctx.fillStyle = '#ef4444';
            ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(15, 0); ctx.lineTo(10, 3); ctx.fill();
            ctx.fillStyle = '#475569';
            ctx.fillRect(-10, -6, 5, 12);
        } else if (p.type === 'bomb') {
            // Enhanced visual for bombs
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.ellipse(0, 0, 8, 5, 0, 0, Math.PI*2);
            ctx.fill();
            // Tail fins
            ctx.fillStyle = '#334155';
            ctx.beginPath();
            ctx.moveTo(-6, -5); ctx.lineTo(-12, 0); ctx.lineTo(-6, 5);
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#64748b';
            ctx.beginPath(); ctx.ellipse(-2, -2, 3, 1.5, 0, 0, Math.PI*2); ctx.fill();
        } else {
             ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
        }
        ctx.restore();
    });

    particles.current.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);
        
        if (p.type.includes('debris_')) {
            ctx.rotate(p.rotation);
            ctx.fillStyle = p.color; // Base plane color
            const s = p.size; 
            
            if (p.type === 'debris_wing') {
                ctx.beginPath();
                ctx.moveTo(0,0);
                ctx.lineTo(s, s/2);
                ctx.lineTo(s, -s/2);
                ctx.fill();
                // Charred effect
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(s/2, s/4); ctx.lineTo(s/2, -s/4); ctx.fill();
            } else if (p.type === 'debris_tail') {
                ctx.beginPath();
                ctx.moveTo(-s/2, 0);
                ctx.lineTo(s/2, s/2);
                ctx.lineTo(s/2, -s/2);
                ctx.fill();
            } else { // body
                ctx.fillRect(-s, -s/3, s*2, s*0.66);
                ctx.fillStyle = 'rgba(0,0,0,0.5)'; // Burnt holes
                ctx.beginPath(); ctx.arc(0,0, s/3, 0, Math.PI*2); ctx.fill();
            }
        }
        else if (p.type === 'splash' || p.type === 'splash_heavy') {
            const isHeavy = p.type === 'splash_heavy';
            const lifePct = p.life / p.maxLife;
            const invLife = 1 - lifePct;
            
            if (isHeavy) {
                // 1. Water Column (Vertical Spike)
                ctx.save();
                const spikeHeight = p.size * 3 * Math.sin(lifePct * Math.PI); 
                const spikeWidth = p.size * 0.8 * lifePct;

                const grad = ctx.createLinearGradient(0, 0, 0, -spikeHeight);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.9)'); 
                grad.addColorStop(0.6, 'rgba(180, 230, 255, 0.6)'); 
                grad.addColorStop(1, 'rgba(180, 230, 255, 0)'); 

                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.moveTo(-spikeWidth/2, 0);
                ctx.quadraticCurveTo(0, -spikeHeight, spikeWidth/2, 0);
                ctx.ellipse(0, 0, spikeWidth/2, spikeWidth/4, 0, 0, Math.PI);
                ctx.fill();

                // 2. Base Foam
                ctx.beginPath();
                ctx.ellipse(0, 0, p.size * invLife * 1.2, p.size * invLife * 0.6, 0, 0, Math.PI*2);
                ctx.fillStyle = `rgba(255, 255, 255, ${lifePct * 0.7})`;
                ctx.fill();
                
                ctx.restore();
            } else {
                ctx.strokeStyle = `rgba(200, 240, 255, ${lifePct})`;
                ctx.lineWidth = 2;
                ctx.beginPath(); 
                ctx.ellipse(0,0, p.size * (0.5 + invLife), p.size * (0.5 + invLife) * 0.5, 0, 0, Math.PI*2);
                ctx.stroke();
            }
            
            // Droplets
            ctx.fillStyle = `rgba(220, 245, 255, ${lifePct})`;
            const count = isHeavy ? 16 : 6;
            const radiusMult = isHeavy ? 1.8 : 1.2;
            for(let i=0; i<count; i++) {
                 const ang = (i/count)*Math.PI*2 + (p.id.charCodeAt(0));
                 const dist = p.size * (0.2 + invLife * radiusMult);
                 const ySquish = Math.sin(ang) * dist * 0.5;
                 const xSpread = Math.cos(ang) * dist;
                 const dSize = (isHeavy ? 3.5 : 1.5) * lifePct;
                 
                 ctx.beginPath(); 
                 ctx.arc(xSpread, ySquish, dSize, 0, Math.PI*2); 
                 ctx.fill();
            }
        } else if (p.type === 'ripple') {
             const lifePct = p.life / p.maxLife;
             const invLife = 1 - lifePct;
             
             ctx.save();
             ctx.scale(1, 0.6); // Perspective for water surface

             // Inner intense ring
             ctx.beginPath();
             ctx.arc(0, 0, p.size + invLife * 40, 0, Math.PI * 2);
             ctx.strokeStyle = `rgba(255, 255, 255, ${lifePct})`;
             ctx.lineWidth = 4 * lifePct;
             ctx.stroke();
             
             // Outer dissipating ring
             ctx.beginPath();
             ctx.arc(0, 0, p.size + invLife * 80, 0, Math.PI * 2);
             ctx.strokeStyle = `rgba(200, 240, 255, ${lifePct * 0.5})`;
             ctx.lineWidth = 2;
             ctx.stroke();

             // Flash/Foam fill at start
             if (lifePct > 0.7) {
                 ctx.fillStyle = `rgba(255, 255, 255, ${(lifePct - 0.7) * 2})`;
                 ctx.beginPath();
                 ctx.arc(0, 0, p.size + invLife * 20, 0, Math.PI * 2);
                 ctx.fill();
             }
             
             ctx.restore();
        } else if (p.type === 'muzzle') {
            ctx.rotate(p.rotation);
            const alpha = p.life / p.maxLife;
            // Flash Core
            ctx.fillStyle = `rgba(255, 255, 220, ${alpha})`;
            ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5, 0, Math.PI*2); ctx.fill();
            
            // Star burst
            ctx.fillStyle = `rgba(255, 200, 50, ${alpha * 0.8})`;
            ctx.beginPath();
            const spikes = 5; // Jagged
            const outerRadius = p.size;
            const innerRadius = p.size * 0.2;
            for (let i = 0; i < spikes * 2; i++) {
                const r = i % 2 === 0 ? outerRadius : innerRadius;
                const a = (Math.PI * i) / spikes;
                ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            const lifePct = p.life / p.maxLife;
            if (p.type === 'shockwave') {
                ctx.beginPath();
                ctx.arc(0, 0, p.size * (1 + (1-lifePct)*2), 0, Math.PI*2);
                ctx.strokeStyle = `rgba(255, 255, 255, ${lifePct})`;
                ctx.lineWidth = 3;
                ctx.stroke();
            } else if (p.type === 'smoke') {
                ctx.fillStyle = `rgba(100, 100, 100, ${lifePct * 0.4})`;
                // Drifting smoke puff
                ctx.beginPath(); ctx.arc(0,0, p.size * (1 + (1-lifePct)), 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'fire') {
                ctx.fillStyle = `rgba(255, ${Math.floor(lifePct*150)}, 0, ${lifePct})`;
                ctx.beginPath(); ctx.arc(0,0, p.size * lifePct, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'spark') {
                ctx.rotate(p.rotation);
                ctx.fillStyle = `rgba(255, 255, 200, ${lifePct})`;
                ctx.fillRect(-p.size/2, -p.size/2, p.size, p.size/5);
                ctx.fillRect(-p.size/5, -p.size/2, p.size/5, p.size);
            }
        }
        ctx.restore();
    });
  };

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      if (gameState === GameState.PLAYING) {
        update();
      }
      const canvas = canvasRef.current;
      if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) draw(ctx);
      }
      if (gameState === GameState.PLAYING) {
        animationFrameId = requestAnimationFrame(render);
      }
    };
    if (gameState === GameState.PLAYING) {
        render();
    } else if (gameState === GameState.LEVEL_UP) {
        // Redraw static frame
        const canvas = canvasRef.current;
        if(canvas) {
            const ctx = canvas.getContext('2d');
            if(ctx) draw(ctx);
        }
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [gameState]); // Removed stats dependency, using ref

  // Select 3 random skills
  useEffect(() => {
      if (gameState === GameState.LEVEL_UP) {
          const available = SKILL_DEFINITIONS.filter(s => skills.current[s.id] < s.maxLevel);
          setLevelUpOptions(available.sort(() => 0.5 - Math.random()).slice(0, 3));
      }
  }, [gameState]);

  const handleSkillSelect = (skillId: string) => {
      skills.current[skillId]++;
      setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-full h-full flex justify-center bg-slate-900">
      <canvas 
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="h-full object-contain bg-[#1e3a8a] shadow-2xl"
      />
      
      {/* HUD */}
      <div className="absolute top-4 left-4 text-white font-mono text-xl space-y-2 pointer-events-none drop-shadow-md">
          <div className="flex items-center gap-2">
              <div className="w-32 h-4 bg-slate-700 border border-slate-500 relative">
                  <div 
                    className="h-full bg-green-500 transition-all duration-300"
                    style={{width: `${Math.max(0, (playerStats.hp / playerStats.maxHp) * 100)}%`}} 
                  />
              </div>
              <span>HP {Math.ceil(playerStats.hp)}/{Math.ceil(playerStats.maxHp)}</span>
          </div>
          <div className="text-yellow-400">MONEY: ${playerStats.money}</div>
          <div className="text-blue-300">WAVE: {playerStats.wave}</div>
          <div className="text-purple-300">LVL: {playerStats.level}</div>
      </div>

      {/* Level Up Modal */}
      {gameState === GameState.LEVEL_UP && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50">
             <div className="bg-slate-800 p-8 rounded-xl border-2 border-yellow-500 max-w-4xl w-full mx-4 shadow-2xl animate-in zoom-in-95">
                 <h2 className="text-4xl font-bold text-center text-yellow-400 mb-8">LEVEL UP! CHOOSE UPGRADE</h2>
                 <div className="grid grid-cols-3 gap-4">
                     {levelUpOptions.map(skill => (
                         <button 
                            key={skill.id}
                            onClick={() => handleSkillSelect(skill.id)}
                            className="bg-slate-700 hover:bg-slate-600 p-6 rounded border border-slate-500 hover:border-yellow-400 transition group flex flex-col items-center text-center"
                         >
                             <div className="text-xl font-bold text-white mb-2 group-hover:text-yellow-300">{skill.name}</div>
                             <div className="text-sm text-slate-300 flex-grow mb-4">{skill.desc}</div>
                             <div className="text-xs font-mono text-green-400 bg-slate-900 px-2 py-1 rounded">
                                 Current Level: {skills.current[skill.id]} / {skill.maxLevel}
                             </div>
                         </button>
                     ))}
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
