export const BOARD_WIDTH = 600;
export const BOARD_HEIGHT = 900;

// Upgrades database template
export const UPGRADES = [
  {
    id: "max_orbs",
    name: "Orb Capacity",
    description: "Increases the starting launch orb count by +1.",
    cost: 100,
    costMultiplier: 1.6,
    level: 0,
    maxLevel: 10,
    value: 5, // starts with 5 orbs
    valueStep: 1
  },
  {
    id: "split_pegs",
    name: "Splitter Pegs",
    description: "Adds rare Green Splitter Pegs to the board that duplicate falling orbs.",
    cost: 150,
    costMultiplier: 1.7,
    level: 0,
    maxLevel: 5,
    value: 1, // starts with 1 splitter peg
    valueStep: 2
  },
  {
    id: "gravity_well",
    name: "Gravity Well",
    description: "Activates a central Black Hole that bends orb trajectories.",
    cost: 300,
    costMultiplier: 2.5,
    level: 0,
    maxLevel: 3,
    value: 0, // starts disabled (mass = 0)
    valueStep: 12000 // mass increments
  },
  {
    id: "bin_size",
    name: "Magnet Bins",
    description: "Increases the magnetic grab radius of the bottom catcher bins.",
    cost: 200,
    costMultiplier: 1.5,
    level: 0,
    maxLevel: 5,
    value: 40, // initial half-width of bin
    valueStep: 6
  }
];

// Generates peg coordinates arranged in a triangular grid
export function generatePegs(mode = "classic") {
  const pegs = [];
  const startY = 180;
  const endY = 700;
  const rowSpacing = 42;
  const colSpacing = 42;
  
  let pegCount = 0;
  
  for (let y = startY, row = 0; y <= endY; y += rowSpacing, row++) {
    const isEven = row % 2 === 0;
    const offset = isEven ? colSpacing / 2 : 0;
    
    // Rows get wider/narrower in the center to create a diamond shape
    const numCols = isEven ? 10 : 11;
    const startX = (BOARD_WIDTH - (numCols - 1) * colSpacing) / 2 + offset;
    
    for (let col = 0; col < numCols; col++) {
      const x = startX + col * colSpacing;
      
      // Skip center pegs for vortex mode to leave room for the black hole
      if (mode === "vortex") {
        const distToCenter = Math.sqrt(Math.pow(x - BOARD_WIDTH / 2, 2) + Math.pow(y - 450, 2));
        if (distToCenter < 75) continue; // leave clear pocket for black hole
      }

      pegs.push({
        id: `peg-${pegCount++}`,
        x,
        y,
        radius: 7,
        type: "standard",
        active: false,
        hitTime: 0,
        scoreValue: 10,
        charge: 0,
        destroyed: false
      });
    }
  }

  // Set splitters based on game mode
  let numSplitters = 2; // Default for classic
  if (mode === "vortex") {
    numSplitters = 3;
  } else if (mode === "chaos") {
    // 35% of all pegs are splitters!
    numSplitters = Math.floor(pegs.length * 0.35);
  }

  // Convert standard pegs into special splitters
  if (numSplitters > 0 && pegs.length > 0) {
    const step = Math.floor(pegs.length / (numSplitters + 1));
    for (let i = 1; i <= numSplitters; i++) {
      const idx = (i * step) % pegs.length;
      pegs[idx].type = "splitter";
      pegs[idx].scoreValue = 50;
      pegs[idx].health = 3;
      pegs[idx].maxHealth = 3;
    }
  }

  return pegs;
}

export function generateBins() {
  const halfWidth = 45; // Fixed premium size since upgrade shop is removed

  return [
    { id: "bin-1", label: "CONTAIN", mult: 1, x: 70, y: 80, width: halfWidth * 2, score: 50, color: "#00f2fe", stardust: 2 },
    { id: "bin-2", label: "CONTAIN", mult: 1, x: 180, y: 80, width: halfWidth * 2, score: 50, color: "#00f2fe", stardust: 2 },
    { id: "bin-3", label: "REACTOR CORE", mult: 1, x: 300, y: 80, width: halfWidth * 2, score: 150, color: "#ffd700", stardust: 6, isJackpot: true },
    { id: "bin-4", label: "CONTAIN", mult: 1, x: 420, y: 80, width: halfWidth * 2, score: 50, color: "#00f2fe", stardust: 2 },
    { id: "bin-5", label: "CONTAIN", mult: 1, x: 530, y: 80, width: halfWidth * 2, score: 50, color: "#00f2fe", stardust: 2 }
  ];
}
