export type Level = "Region" | "District" | "Zone" | "Area" | "Section" | "Cell";

export interface TreeNode {
  level: Level;
  name: string;
  code: string;
  children: TreeNode[] | null;
  leader: string;
  status?: "approved" | "pending" | "missing";
  channel?: "WhatsApp" | "Web";
  time?: string;
  streak?: number;
  cellType?: string;
  cells: number;
  ok: number;
  pend: number;
  miss: number;
  chronic: number;
}

function rnd(seed: number) {
  let s = (seed * 7919 + 104729) % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = 0; i < 5; i++) next();
  return next;
}

const PLACES = ["Ijegun", "Ikotun", "Igando", "Egbeda", "Akowonjo", "Idimu", "Ayobo", "Iyana Ipaja", "Abule Egba", "Dopemu", "Shasha", "Baruwa", "Command", "Isheri", "Aboru", "Abesan", "Ekoro", "Alagbado", "Meiran", "Oke Odo", "Pleasure", "Governor Road", "Ile Epo", "Alakuko", "Amikanle", "Elere", "Orisunbare", "Agbelekale"];
const CELL_NAMES = ["Grace", "Faith", "Zion", "Bethel", "Hebron", "Eden", "Shiloh", "Rehoboth", "Peniel", "Gilgal", "Carmel", "Salem", "Antioch", "Berea", "Cana", "Bethany", "Jabez", "Elim", "Horeb", "Tabor", "Emmaus", "Mizpah", "Bethesda", "Kidron", "Zoar", "Succoth", "Ophir", "Sychar"];
const FIRST = ["Tunde", "Bola", "Chidi", "Ngozi", "Femi", "Aisha", "Emeka", "Folake", "Segun", "Adaeze", "Kunle", "Ifeoma", "Yemi", "Uche", "Dare", "Blessing", "Sola", "Nneka", "Gbenga", "Halima", "Tayo", "Chinedu", "Bisi", "Kelechi", "Wale", "Amaka", "Seyi", "Obinna", "Toyin", "Ezinne"];
const LAST = ["Bakare", "Adeyemi", "Okonkwo", "Balogun", "Eze", "Ogunleye", "Nwosu", "Adebayo", "Ilesanmi", "Okafor", "Sodipo", "Ajayi", "Umeh", "Oladipo", "Anyanwu", "Fasasi", "Obi", "Alabi", "Nnaji", "Salami", "Oyelaran", "Ibe", "Akinola", "Chukwu", "Odunsi"];
const TYPES = ["Adult", "Teens", "Preteens", "Adult/Children", "Online/Virtual", "Adult"];
const TIMES = ["6:12pm", "6:42pm", "7:08pm", "8:31pm", "9:04pm", "Mon 7:20am"];
const LEVEL_CHAIN: Level[] = ["Region", "District", "Zone", "Area", "Section", "Cell"];

function buildTree(): TreeNode {
  const r = rnd(20260823);
  let pi = 0, ci = 0, ni = 0, li = 0, ti = 0, code = 100;
  const nm = () => `${FIRST[ni++ % FIRST.length]} ${LAST[li++ % LAST.length]}`;
  const pl = () => PLACES[pi++ % PLACES.length];

  const mk = (level: Level, name: string, depth: number): TreeNode => {
    const node: TreeNode = {
      level,
      name,
      code: level[0] + "-" + code++,
      children: null,
      leader: "",
      cells: 0,
      ok: 0,
      pend: 0,
      miss: 0,
      chronic: 0,
    };
    if (level === "Cell") {
      const q = r();
      node.status = q < 0.62 ? "approved" : q < 0.83 ? "pending" : "missing";
      node.channel = r() < 0.34 ? "WhatsApp" : "Web";
      node.time = TIMES[Math.floor(r() * 6)];
      node.streak = node.status === "missing" ? (r() < 0.34 ? 3 + Math.floor(r() * 3) : 1) : 0;
      node.cellType = TYPES[ti++ % TYPES.length];
      node.leader = nm();
      node.children = null;
    } else {
      const kids: TreeNode[] = [];
      for (let i = 0; i < 3; i++) {
        const child = LEVEL_CHAIN[depth + 1];
        let cn: string;
        if (child === "Cell") cn = CELL_NAMES[ci++ % CELL_NAMES.length] + " Cell";
        else if (child === "Section") cn = pl() + " Section " + (i + 1);
        else cn = pl() + " " + child;
        kids.push(mk(child, cn, depth + 1));
      }
      node.children = kids;
      node.leader = nm();
    }
    return node;
  };

  const root = mk("Region", "Region 7", 0);

  const agg = (n: TreeNode): TreeNode => {
    if (!n.children) {
      n.cells = 1;
      n.ok = n.status === "approved" ? 1 : 0;
      n.pend = n.status === "pending" ? 1 : 0;
      n.miss = n.status === "missing" ? 1 : 0;
      n.chronic = (n.streak ?? 0) >= 3 ? 1 : 0;
      return n;
    }
    n.cells = n.ok = n.pend = n.miss = n.chronic = 0;
    n.children.forEach((c) => {
      agg(c);
      n.cells += c.cells;
      n.ok += c.ok;
      n.pend += c.pend;
      n.miss += c.miss;
      n.chronic += c.chronic;
    });
    return n;
  };
  agg(root);
  return root;
}

let cachedTree: TreeNode | null = null;
export function getTree(): TreeNode {
  if (!cachedTree) cachedTree = buildTree();
  return cachedTree;
}

export function titleFor(level: Level): string {
  return {
    Region: "Regional Coordinator",
    District: "District Coordinator",
    Zone: "Zonal Coordinator",
    Area: "Area Coordinator",
    Section: "Section Leader",
    Cell: "Cell Leader",
  }[level];
}

export type Scope = "Region" | "District" | "Zone" | "Area" | "Section";
const SCOPE_DEPTH: Record<Scope, number> = { Region: 0, District: 1, Zone: 2, Area: 3, Section: 4 };

export function scopeRoot(scope: Scope): TreeNode {
  const depth = SCOPE_DEPTH[scope];
  let n = getTree();
  for (let i = 0; i < depth; i++) {
    if (!n.children) break;
    n = n.children[0];
  }
  return n;
}

export function current(scope: Scope, path: number[]): { node: TreeNode; chain: TreeNode[] } {
  let n = scopeRoot(scope);
  const chain = [n];
  path.forEach((i) => {
    if (n.children && n.children[i]) {
      n = n.children[i];
      chain.push(n);
    }
  });
  return { node: n, chain };
}

export function pendingCells(): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode) => {
    if (!n.children) {
      if (n.status === "pending") out.push(n);
      return;
    }
    n.children.forEach(walk);
  };
  walk(getTree());
  return out.slice(0, 6);
}

export interface CellRow extends TreeNode {
  section: string;
}

export function allCells(scope: Scope): CellRow[] {
  const out: CellRow[] = [];
  const walk = (n: TreeNode, section: string) => {
    if (!n.children) {
      out.push(Object.assign({ section }, n));
      return;
    }
    n.children.forEach((c) => walk(c, n.level === "Section" ? n.name : section));
  };
  const root = scopeRoot(scope);
  walk(root, root.name);
  return out;
}

export { rnd };
