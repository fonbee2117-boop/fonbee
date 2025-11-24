
export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 900;

export const WAVE_CONFIG = {
  BOSS_WAVE: 20,
  ENEMY_HP_SCALE: 1.10, // +10% per wave
  ENEMY_DMG_SCALE: 1.10,
};

export const INITIAL_PLAYER_STATS = {
  hp: 100, // 100 "ticks"
  maxHp: 100,
};

export const SKILL_DEFINITIONS = [
  { 
    id: 'escort_left', 
    name: 'เรือคุ้มกันฝั่งซ้าย (Left Escort)', 
    maxLevel: 3, 
    desc: 'Level 1: เรือรบช่วยยิงปืนใหญ่และปืนกล. Level 2: ปืนคู่ (Double Cannon). Level 3: ปืนสามลำกล้องกระสุนเพลิง (Triple Cannon Fire).' 
  },
  { 
    id: 'escort_right', 
    name: 'เรือคุ้มกันฝั่งขวา (Right Escort)', 
    maxLevel: 3, 
    desc: 'Level 1: เรือรบช่วยยิงปืนใหญ่และปืนกล. Level 2: ปืนคู่ (Double Cannon). Level 3: ปืนสามลำกล้องกระสุนเพลิง (Triple Cannon Fire).' 
  },
  { 
    id: 'repair', 
    name: 'ซ่อมแซม (Repair)', 
    maxLevel: 3, 
    desc: 'ฟื้นฟูพลังชีวิต: Lv1: 2HP/5s, Lv2: 4HP/5s, Lv3: 5HP/2.5s' 
  },
  { 
    id: 'fighter', 
    name: 'ฝูงบินขับไล่ (Fighters)', 
    maxLevel: 3, 
    desc: 'ปล่อยเครื่องบินขับไล่: Lv1: 2 ลำ, Lv2: 4 ลำ, Lv3: 8 ลำ (ไล่ยิงเครื่องบินและทิ้งระเบิดเรือ)' 
  },
  { 
    id: 'bomber', 
    name: 'ฝูงบินทิ้งระเบิด (Bombers)', 
    maxLevel: 3, 
    desc: 'ปล่อยเครื่องบินทิ้งระเบิดหนัก: Lv1: 1 ลำ, Lv2: 2 ลำ, Lv3: 3 ลำ (ทิ้งระเบิดรุนแรง 3 ลูก)' 
  },
  { 
    id: 'rocket', 
    name: 'จรวดท้ายเรือ (Rear Rockets)', 
    maxLevel: 3, 
    desc: 'ยิงจรวดติดตามระยะไกล: Lv1: 200dmg, Lv2: 300dmg, Lv3: 400dmg' 
  },
];

export const UPGRADES_LIST = [
  { id: 'upg_hp', name: 'ความทนทาน (Max HP +10%)', baseCost: 100 },
  { id: 'upg_money', name: 'โชคลาภ (Money Gain +10%)', baseCost: 100 },
  { id: 'upg_speed', name: 'ความเร็วกระสุน (Proj Speed +10%)', baseCost: 100 },
  { id: 'upg_xp', name: 'ประสบการณ์ (XP Gain +10%)', baseCost: 100 },
  { id: 'upg_dmg', name: 'พลังโจมตี (Damage +10%)', baseCost: 150 },
  { id: 'upg_acc', name: 'ความแม่นยำ (Accuracy +10%)', baseCost: 120 },
];
