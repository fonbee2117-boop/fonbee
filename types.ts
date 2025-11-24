
export enum GameState {
  MENU,
  PLAYING,
  LEVEL_UP,
  GAME_OVER,
  VICTORY
}

export enum EnemyType {
  PLANE_SMALL = 'PLANE_SMALL',
  PLANE_LARGE = 'PLANE_LARGE',
  SHIP_SMALL = 'SHIP_SMALL',
  SHIP_MEDIUM = 'SHIP_MEDIUM',
  BOSS = 'BOSS'
}

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  hp: number;
  maxHp: number;
  type: string;
  vx: number;
  vy: number;
  markedForDeletion: boolean;
  frameTimer?: number;
  damagePoints?: Point[];
}

export interface Enemy extends Entity {
  enemyType: EnemyType;
  scoreValue: number;
  moneyValue: number;
  damage: number;
  hitChance: number; // 0-1
  attackCooldown: number;
  maxAttackCooldown: number;
  burstCount?: number;
  burstTimer?: number;
  state: 'entry' | 'attack' | 'loop' | 'retreat' | 'bombing' | 'hover' | 'turn_up' | 'turn_down'; 
  pathData?: { startX: number; startY: number; progress: number; direction: number; turnCenter?: {x:number, y:number}, turnAngle?: number };
}

export interface Projectile extends Entity {
  damage: number;
  targetId?: string; // For homing
  isSplash: boolean;
  splashRadius?: number;
  owner: 'player' | 'enemy' | 'friendly';
  targetType: 'air' | 'water' | 'both';
  isFire?: boolean; // For lvl 3 escort
  maxDist?: number;
  traveled?: number;
}

export interface FriendlyUnit extends Entity {
  unitType: 'fighter' | 'bomber';
  state: 'airborne' | 'returning' | 'landing' | 'rearming' | 'launching';
  targetId?: string;
  ammo: number;
  maxAmmo: number;
  timer?: number; // For rearming/wait times
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface PlayerStats {
  hp: number;
  maxHp: number;
  xp: number;
  maxXp: number;
  level: number;
  money: number;
  wave: number;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
}

export interface Settings {
  soundEnabled: boolean;
  musicEnabled: boolean;
}
